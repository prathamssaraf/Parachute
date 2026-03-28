"use client";

import { useEffect, useRef } from "react";
import type { Terminal as XTermTerminal } from "@xterm/xterm";

interface TerminalProps {
  workspaceCode: string;
}

export default function Terminal({ workspaceCode }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");

      // Load xterm CSS
      if (!document.getElementById("xterm-css")) {
        const link = document.createElement("link");
        link.id = "xterm-css";
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css";
        document.head.appendChild(link);
      }

      if (disposed) return;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
        lineHeight: 1.4,
        theme: {
          background: "#0a0a0a",
          foreground: "#e2e8f0",
          cursor: "#34d399",
          cursorAccent: "#0a0a0a",
          selectionBackground: "#34d39930",
          black: "#1e1e2e",
          red: "#f87171",
          green: "#34d399",
          yellow: "#facc15",
          blue: "#60a5fa",
          magenta: "#a78bfa",
          cyan: "#22d3ee",
          white: "#e2e8f0",
          brightBlack: "#6b7280",
          brightRed: "#fca5a5",
          brightGreen: "#6ee7b7",
          brightYellow: "#fde68a",
          brightBlue: "#93c5fd",
          brightMagenta: "#c4b5fd",
          brightCyan: "#67e8f9",
          brightWhite: "#f8fafc",
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current!);
      fitAddon.fit();

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Connect WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal/?workspace=${workspaceCode}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send initial size
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "output") {
            term.write(msg.data);
          } else if (msg.type === "exit") {
            term.writeln(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m`);
          }
        } catch {}
      };

      ws.onclose = () => {
        term.writeln("\r\n\x1b[90m[Connection closed]\x1b[0m");
      };

      // Terminal input → WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (!disposed) {
          fitAddon.fit();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        }
      });
      resizeObserver.observe(containerRef.current!);

      return () => {
        resizeObserver.disconnect();
      };
    }

    const cleanupPromise = init();

    return () => {
      disposed = true;
      cleanupPromise.then((cleanup) => cleanup?.());
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, [workspaceCode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: "8px 0 0 8px", background: "#0a0a0a" }}
    />
  );
}
