"use client";

import { useEffect, useRef, useState } from "react";
import MonacoEditor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditorNS } from "monaco-editor";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";

interface EditorProps {
  doc: Y.Doc;
  provider: WebsocketProvider;
  filePath: string;
  initialContent: string;
  onContentChange?: (content: string) => void;
}

const COLOR_HEX: Record<string, string> = {
  blue: "#60a5fa",
  purple: "#a78bfa",
  cyan: "#22d3ee",
  yellow: "#facc15",
  green: "#34d399",
  red: "#f87171",
  orange: "#fb923c",
  pink: "#f472b6",
};

function getLang(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".css")) return "css";
  return "plaintext";
}

export default function Editor({
  doc,
  provider,
  filePath,
  initialContent,
  onContentChange,
}: EditorProps) {
  const editorRef     = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef     = useRef<Monaco | null>(null);
  const decorationsRef = useRef<MonacoEditorNS.IEditorDecorationsCollection | null>(null);
  const suppressRef   = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const yText = doc.getText(`file:${filePath}`);

  // Seed Y.Text with initial content the first time (when doc is empty for this file)
  useEffect(() => {
    if (yText.toString() === "") {
      doc.transact(() => yText.insert(0, initialContent));
    }
  }, [doc, yText, filePath, initialContent]);

  // Y.Text → Monaco: apply remote changes into the editor
  useEffect(() => {
    if (!isReady) return;
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    // Sync initial state
    const current = yText.toString();
    if (model.getValue() !== current) {
      suppressRef.current = true;
      model.setValue(current);
      suppressRef.current = false;
    }

    const observer = (event: Y.YTextEvent) => {
      if (suppressRef.current) return;
      suppressRef.current = true;
      let index = 0;
      for (const delta of event.changes.delta) {
        if (delta.retain !== undefined) {
          index += delta.retain;
        } else if (delta.insert !== undefined) {
          const pos = model.getPositionAt(index);
          const text = delta.insert as string;
          editor.executeEdits("yjs", [{
            range: {
              startLineNumber: pos.lineNumber,
              startColumn: pos.column,
              endLineNumber: pos.lineNumber,
              endColumn: pos.column,
            },
            text,
            forceMoveMarkers: true,
          }]);
          index += text.length;
        } else if (delta.delete !== undefined) {
          const start = model.getPositionAt(index);
          const end   = model.getPositionAt(index + delta.delete);
          editor.executeEdits("yjs", [{
            range: {
              startLineNumber: start.lineNumber,
              startColumn: start.column,
              endLineNumber: end.lineNumber,
              endColumn: end.column,
            },
            text: "",
            forceMoveMarkers: true,
          }]);
        }
      }
      suppressRef.current = false;
      onContentChange?.(yText.toString());
    };

    yText.observe(observer);
    return () => yText.unobserve(observer);
  }, [isReady, filePath, yText, onContentChange]);

  // Monaco → Y.Text: push local edits into the shared doc
  useEffect(() => {
    if (!isReady) return;
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const disposable = model.onDidChangeContent(
      (e: MonacoEditorNS.IModelContentChangedEvent) => {
        if (suppressRef.current) return;
        suppressRef.current = true;
        doc.transact(() => {
          for (const change of e.changes) {
            const { rangeOffset, rangeLength, text } = change;
            if (rangeLength > 0) yText.delete(rangeOffset, rangeLength);
            if (text.length  > 0) yText.insert(rangeOffset, text);
          }
        });
        suppressRef.current = false;
        onContentChange?.(yText.toString());
      },
    );

    return () => disposable.dispose();
  }, [isReady, filePath, doc, yText, onContentChange]);

  // Awareness → remote cursor decorations
  useEffect(() => {
    if (!isReady || !provider) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection([]);
    }
    const collection = decorationsRef.current;

    const updateDecorations = () => {
      const states = provider.awareness.getStates();
      const newDecorations: MonacoEditorNS.IModelDeltaDecoration[] = [];

      states.forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID) return;
        const user   = state.user   as { name: string; color: string } | undefined;
        const cursor = state.cursor as { offset: number }              | undefined;
        if (!user || !cursor) return;

        const pos = model.getPositionAt(cursor.offset);
        const hex = COLOR_HEX[user.color] ?? "#ffffff";

        newDecorations.push({
          range: new monaco.Range(
            pos.lineNumber, pos.column,
            pos.lineNumber, pos.column + 1,
          ),
          options: {
            className: `remote-cursor-${user.color}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: { value: `**${user.name}**`, isTrusted: true },
            before: {
              content: "\u200b",
              inlineClassName: `remote-cursor-caret`,
              inlineClassNameAffectsLetterSpacing: false,
            },
            after: {
              content: ` ${user.name}`,
              inlineClassName: `remote-cursor-label-${user.color}`,
            },
          },
        });

        // Inject per-color CSS once
        const styleId = `cursor-style-${user.color}`;
        if (!document.getElementById(styleId)) {
          const s = document.createElement("style");
          s.id = styleId;
          s.textContent = `
            .remote-cursor-${user.color} { border-left: 2px solid ${hex}; }
            .remote-cursor-label-${user.color} {
              color: ${hex}; font-size: 10px; font-weight: 600;
              margin-left: 2px; opacity: 0.85;
            }
          `;
          document.head.appendChild(s);
        }
      });

      collection.set(newDecorations);
    };

    provider.awareness.on("change", updateDecorations);
    updateDecorations();
    return () => provider.awareness.off("change", updateDecorations);
  }, [isReady, provider]);

  // Broadcast local cursor position via awareness
  useEffect(() => {
    if (!isReady || !provider) return;
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const disposable = editor.onDidChangeCursorPosition(
      (e: MonacoEditorNS.ICursorPositionChangedEvent) => {
        provider.awareness.setLocalStateField("cursor", {
          offset: model.getOffsetAt(e.position),
        });
      },
    );

    return () => disposable.dispose();
  }, [isReady, provider]);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        language={getLang(filePath)}
        theme="vs-dark"
        defaultValue={initialContent}
        options={{
          fontSize: 13,
          fontFamily: "var(--font-geist-mono), 'JetBrains Mono', monospace",
          lineHeight: 22,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: "gutter",
          smoothScrolling: true,
          cursorBlinking: "smooth",
          bracketPairColorization: { enabled: true },
          formatOnPaste: false,
          formatOnType: false,
        }}
        onMount={(editor, monaco) => {
          editorRef.current  = editor;
          monacoRef.current  = monaco;
          setIsReady(true);

          monaco.editor.defineTheme("parachute-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "comment",  foreground: "6b7280", fontStyle: "italic" },
              { token: "keyword",  foreground: "a78bfa" },
              { token: "string",   foreground: "34d399" },
              { token: "number",   foreground: "fb923c" },
              { token: "type",     foreground: "22d3ee" },
            ],
            colors: {
              "editor.background":                    "#0a0a0a",
              "editor.foreground":                    "#e2e8f0",
              "editorLineNumber.foreground":           "#374151",
              "editorLineNumber.activeForeground":     "#6b7280",
              "editor.selectionBackground":            "#34d39930",
              "editor.lineHighlightBackground":        "#ffffff08",
              "editorCursor.foreground":               "#34d399",
              "editorIndentGuide.background1":         "#1f2937",
              "editorIndentGuide.activeBackground1":   "#374151",
              "scrollbarSlider.background":            "#33333366",
              "scrollbarSlider.hoverBackground":       "#34d39966",
            },
          });
          monaco.editor.setTheme("parachute-dark");
        }}
      />
    </div>
  );
}
