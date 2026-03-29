"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  File,
  Folder,
  FolderOpen,
  Bot,
  Play,
  Users,
  Circle,
  CheckCircle2,
  AlertTriangle,
  // Hexagon removed — using Logo component
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Loader2,
  Zap,
  Lock,
  Pencil,
  Clock,
  Terminal as TerminalIcon,
  Plus,
  ArrowRight,
  PanelBottomClose,
  PanelBottomOpen,
  FilePlus,
  FolderPlus,
  Save,
  Trash2,
  RefreshCw,
  X,
} from "lucide-react";
import { createWorkspace } from "@/lib/yjs";
import { runAgentSimulation, ActivityEvent, AgentFlow, AgentStatus } from "@/components/workspace/AgentSimulator";
import { runK2Agent } from "@/lib/k2Agent";
import {
  registerAgent, unregisterAgent, broadcastEvent, determineFlow,
  observeOrchestratorEvents, observeAgentRegistry,
  type AgentRegistration, type OrchestratorEvent,
} from "@/lib/orchestrator";
import type { WebsocketProvider } from "y-websocket";
import type * as YType from "yjs";

const Editor = dynamic(() => import("@/components/workspace/Editor"), { ssr: false });
const TerminalPanel = dynamic(() => import("@/components/workspace/Terminal"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

interface OnlineUser {
  clientId: number;
  name: string;
  color: string;
  activeFile: string;
  agentFile: string | null;
  agentStatus: AgentStatus;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const USER_COLORS = ["blue", "purple", "cyan", "yellow", "green", "orange", "pink", "red"];

const colorText: Record<string, string> = {
  blue: "text-blue-400", purple: "text-purple-400", cyan: "text-cyan-400",
  yellow: "text-yellow-400", green: "text-emerald-400", orange: "text-orange-400",
  pink: "text-pink-400", red: "text-red-400", emerald: "text-emerald-400",
};
const colorBg: Record<string, string> = {
  blue: "bg-blue-500/15", purple: "bg-purple-500/15", cyan: "bg-cyan-500/15",
  yellow: "bg-yellow-500/15", green: "bg-emerald-500/15", orange: "bg-orange-500/15",
  pink: "bg-pink-500/15", red: "bg-red-500/15", emerald: "bg-emerald-500/15",
};
const colorDot: Record<string, string> = {
  blue: "bg-blue-400", purple: "bg-purple-400", cyan: "bg-cyan-400",
  yellow: "bg-yellow-400", green: "bg-emerald-400", orange: "bg-orange-400",
  pink: "bg-pink-400", red: "bg-red-400",
};
const colorBorder: Record<string, string> = {
  blue: "border-blue-500/30", purple: "border-purple-500/30", cyan: "border-cyan-500/30",
  yellow: "border-yellow-500/30", green: "border-emerald-500/30", orange: "border-orange-500/30",
  pink: "border-pink-500/30", red: "border-red-500/30",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogIcon({ type }: { type: string }) {
  if (type === "success") return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
  if (type === "warning")  return <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />;
  if (type === "conflict") return <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />;
  return <Circle className="w-3 h-3 text-blue-400 shrink-0" />;
}

function AgentStatusBadge({ status, agentFile }: { status: AgentStatus; agentFile: string | null }) {
  if (status === "idle" || !agentFile) return null;

  const cfg = {
    thinking: { icon: <Loader2 className="w-2.5 h-2.5 animate-spin" />, label: "thinking", cls: "text-blue-400 bg-blue-500/10" },
    writing:  { icon: <Pencil className="w-2.5 h-2.5" />,              label: "writing",  cls: "text-emerald-400 bg-emerald-500/10" },
    waiting:  { icon: <Clock className="w-2.5 h-2.5" />,               label: "waiting",  cls: "text-yellow-400 bg-yellow-500/10" },
  }[status] || { icon: null, label: status, cls: "text-gray-300" };

  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Join / Create splash ────────────────────────────────────────────────────

function JoinSplash({ workspaceId, onJoin }: { workspaceId: string; onJoin: (name: string, color: string, code: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [mode, setMode] = useState<"choose" | "join" | "create">(workspaceId === "new" ? "choose" : "join");
  const [joinCode, setJoinCode] = useState(workspaceId === "new" ? "" : workspaceId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workspaces", { method: "POST" });
      const data = await res.json();
      if (data.code) {
        // Update the URL without full reload
        window.history.replaceState(null, "", `/workspace/${data.code}`);
        onJoin(name.trim(), color, data.code);
      }
    } catch (e) {
      setError("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !joinCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/workspaces/join?code=${joinCode.trim()}`);
      const data = await res.json();
      if (res.ok) {
        window.history.replaceState(null, "", `/workspace/${data.code}`);
        onJoin(name.trim(), color, data.code);
      } else {
        setError(data.error || "Workspace not found");
      }
    } catch (e) {
      setError("Failed to join workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="text-emerald-400 font-bold text-sm">P</span>
          <span className="text-white font-semibold text-lg tracking-tight">Parachute</span>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 border border-white/[0.08]">

          {mode === "choose" ? (
            <>
              <h1 className="text-xl font-semibold text-white mb-6 text-center">Get Started</h1>
              <div className="space-y-3">
                <button onClick={() => setMode("create")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition text-left">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">Create Workspace</div>
                    <div className="text-xs text-gray-300">Start a new collaborative session</div>
                  </div>
                </button>
                <button onClick={() => setMode("join")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.07] border border-white/[0.08] hover:bg-white/[0.12] transition text-left">
                  <ArrowRight className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">Join Workspace</div>
                    <div className="text-xs text-gray-300">Enter a workspace code to join</div>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white mb-1">
                {mode === "create" ? "Create Workspace" : "Join Workspace"}
              </h1>
              {mode === "join" && joinCode && (
                <p className="text-sm text-gray-300 mb-4">
                  Code: <span className="font-mono text-emerald-400/80">{joinCode}</span>
                </p>
              )}
              <div className="mt-4">
                  <label className="block text-xs text-gray-300 mb-2 font-medium">Your Name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)} maxLength={24}
                    onKeyDown={e => {
                      if (e.key === "Enter" && name.trim()) {
                        mode === "create" ? handleCreate() : handleJoin();
                      }
                    }}
                    placeholder="e.g. Alice"
                    className="w-full bg-white/[0.07] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none focus:border-emerald-400/40 transition mb-4"
                  />

                  {mode === "join" && workspaceId === "new" && (
                    <>
                      <label className="block text-xs text-gray-300 mb-2 font-medium">Workspace Code</label>
                      <input
                        type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={10}
                        placeholder="e.g. a1b2c3"
                        className="w-full bg-white/[0.07] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none focus:border-emerald-400/40 transition mb-4 font-mono"
                      />
                    </>
                  )}

                  <label className="block text-xs text-gray-300 mb-3 font-medium">Your Color</label>
                  <div className="flex gap-2 flex-wrap mb-5">
                    {USER_COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-all ${colorDot[c]} ${
                          color === c ? "ring-2 ring-white/50 ring-offset-2 ring-offset-[#020202] scale-110" : "opacity-60 hover:opacity-90"
                        }`} />
                    ))}
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 mb-3">{error}</p>
                  )}

                  <button
                    onClick={mode === "create" ? handleCreate : handleJoin}
                    disabled={!name.trim() || loading || (mode === "join" && !joinCode.trim())}
                    className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition disabled:opacity-40">
                    {loading ? "..." : mode === "create" ? "Create Workspace" : "Join Workspace"} →
                  </button>

                  {workspaceId === "new" && (
                    <button onClick={() => setMode("choose")}
                      className="w-full mt-3 text-xs text-gray-300 hover:text-gray-300 transition">
                      ← Back
                    </button>
                  )}
                </div>
            </>
          )}
        </motion.div>

        {/* Free tier warning */}
        <p className="text-center text-[11px] text-yellow-500/60 mt-5 leading-relaxed max-w-sm mx-auto">
          Hosted on Render&apos;s free tier (0.1 CPU / 512 MB RAM).
          Performance may be limited — for the best experience, request a local demo.
        </p>
      </div>
    </div>
  );
}

// ─── File tree item ───────────────────────────────────────────────────────────

function FileItem({
  node, depth = 0, activeFile, onSelect, modifiedFiles, fileUsers,
}: {
  node: FileNode; depth?: number; activeFile: string;
  onSelect: (n: string) => void; modifiedFiles: Set<string>;
  fileUsers: Record<string, { name: string; color: string }[]>;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = node.type === "folder";
  const filePath = node.path || node.name;
  const isActive = !isFolder && filePath === activeFile;
  const users = !isFolder ? (fileUsers[filePath] || []) : [];

  return (
    <div>
      <div onClick={() => isFolder ? setOpen(o => !o) : onSelect(filePath)}
        className={`flex items-center gap-1.5 py-0.5 rounded cursor-pointer text-[12px] transition-colors select-none ${
          isActive ? "bg-white/[0.1] text-white" : "text-gray-300 hover:text-gray-200 hover:bg-white/[0.12]"
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: "8px" }}>
        {isFolder ? (
          <>
            {open ? <ChevronDown className="w-3 h-3 shrink-0 text-gray-300" /> : <ChevronRight className="w-3 h-3 shrink-0 text-gray-300" />}
            {open ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400/80 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-yellow-400/80 shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {modifiedFiles.has(filePath) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
        {users.slice(0, 3).map((u, i) => (
          <span key={`${u.name}-${i}`} className={`w-3 h-3 rounded-full shrink-0 ${colorDot[u.color]}`} title={u.name} />
        ))}
      </div>
      {isFolder && open && node.children?.map(child => (
        <FileItem key={child.path || child.name} node={child} depth={depth + 1}
          activeFile={activeFile} onSelect={onSelect}
          modifiedFiles={modifiedFiles} fileUsers={fileUsers} />
      ))}
    </div>
  );
}

// ─── Activity entry ───────────────────────────────────────────────────────────

function ActivityEntry({ event }: { event: ActivityEvent }) {
  const isOrch = event.agent === "Orchestrator";
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      className={`flex gap-2 py-1.5 px-2 rounded-lg border ${
        event.type === "conflict" ? "bg-red-500/[0.06] border-red-500/20" :
        event.type === "warning"  ? "bg-yellow-500/[0.06] border-yellow-500/20" :
        event.type === "success"  ? "bg-emerald-500/[0.06] border-emerald-500/20" :
        "bg-white/[0.02] border-white/[0.04]"
      }`}>
      <LogIcon type={event.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-semibold ${isOrch ? "text-emerald-400" : colorText[event.agentColor]}`}>
            {event.agent}
          </span>
          <span className="text-[9px] text-gray-300">{event.time}</span>
        </div>
        <p className="text-[11px] text-gray-300 leading-relaxed">{event.msg}</p>
      </div>
    </motion.div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [resolvedCode, setResolvedCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState("");
  const [userColor, setUserColor] = useState("blue");

  const docRef      = useRef<YType.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [yjsReady, setYjsReady] = useState(false);

  const [activeFile,    setActiveFile]    = useState("index.ts");
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const [lockedFile,    setLockedFile]    = useState("");

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);

  const [terminalOpen, setTerminalOpen] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  const [agentRunning, setAgentRunning] = useState(false);
  const [activeAgents, setActiveAgents] = useState<AgentRegistration[]>([]);
  const currentRunId = useRef<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Claude Code");
  const [copied, setCopied] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(256);
  const terminalDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNewFileInput, setShowNewFileInput] = useState<"file" | "folder" | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const newFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { params.then(p => setWorkspaceId(p.id)); }, [params]);

  // ── Fetch file tree ──
  const fetchFiles = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/workspaces/files?code=${code}`);
      if (res.ok) {
        const data = await res.json();
        setFileTree(data.tree || []);
        setAllFiles(data.files || []);
      }
    } catch {}
  }, []);

  // Poll for file tree updates
  useEffect(() => {
    if (!resolvedCode) return;
    fetchFiles(resolvedCode);
    const interval = setInterval(() => fetchFiles(resolvedCode), 2000);
    return () => clearInterval(interval);
  }, [resolvedCode, fetchFiles]);

  // ── Init Yjs ──
  useEffect(() => {
    if (!joined || !resolvedCode || !userName) return;
    const { doc, provider } = createWorkspace(resolvedCode, userName, userColor);
    docRef.current      = doc;
    providerRef.current = provider;

    // Set initial awareness fields
    provider.awareness.setLocalStateField("activeFile",  "index.ts");
    provider.awareness.setLocalStateField("agentFile",   null);
    provider.awareness.setLocalStateField("agentStatus", "idle");

    provider.on("sync", () => setYjsReady(true));
    const t = setTimeout(() => setYjsReady(true), 500);

    // Presence + agent-state awareness
    const updatePresence = () => {
      const states = provider.awareness.getStates();
      const users: OnlineUser[] = [];
      states.forEach((state, clientId) => {
        const u = state.user as { name: string; color: string } | undefined;
        if (!u) return;
        users.push({
          clientId,
          name: u.name,
          color: u.color,
          activeFile:  (state.activeFile  as string)      || "index.ts",
          agentFile:   (state.agentFile   as string|null) || null,
          agentStatus: (state.agentStatus as AgentStatus) || "idle",
        });
      });
      setOnlineUsers(users);
    };
    provider.awareness.on("change", updatePresence);
    updatePresence();

    // Watch lock state from Y.Map
    const meta = doc.getMap("agent-meta");
    const updateLock = () => setLockedFile((meta.get("lockFile") as string) || "");
    meta.observe(updateLock);
    updateLock();

    // Subscribe to orchestrator events (shared across all clients)
    const seenIds = new Set<string>();
    const unsubOrch = observeOrchestratorEvents(doc, (event) => {
      if (seenIds.has(event.id)) return;
      seenIds.add(event.id);
      setActivityFeed(prev => [...prev.slice(-49), event]);
    });

    // Subscribe to agent registry changes
    const unsubAgents = observeAgentRegistry(doc, setActiveAgents);

    return () => {
      clearTimeout(t);
      provider.awareness.off("change", updatePresence);
      meta.unobserve(updateLock);
      unsubOrch();
      unsubAgents();
      provider.destroy();
      doc.destroy();
    };
  }, [joined, resolvedCode, userName, userColor]);

  // Sync activeFile → awareness
  useEffect(() => {
    providerRef.current?.awareness.setLocalStateField("activeFile", activeFile);
  }, [activeFile]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [activityFeed]);

  const addEvent = useCallback((e: ActivityEvent) => {
    setActivityFeed(prev => [...prev.slice(-49), e]);
  }, []);

  // Status update callback
  const handleStatusUpdate = useCallback((agentFile: string | null, status: AgentStatus) => {
    providerRef.current?.awareness.setLocalStateField("agentFile",   agentFile);
    providerRef.current?.awareness.setLocalStateField("agentStatus", status);
    if (agentFile) {
      setActiveFile(agentFile);
      setModifiedFiles(prev => new Set([...prev, agentFile]));
    }
  }, []);

  const handleRunAgent = async () => {
    if (!docRef.current || agentRunning) return;

    const doc = docRef.current;
    const agentName = `${selectedAgent} (${userName})`;
    const runId = Math.random().toString(36).slice(2, 9);
    currentRunId.current = runId;

    // Ask orchestrator what flow and file to use
    const decision = determineFlow(doc, activeFile, agentName);

    // Register this agent in the shared registry (all clients see it)
    registerAgent(doc, {
      runId,
      clientId: providerRef.current?.awareness.clientID || 0,
      userName,
      userColor,
      targetFile: activeFile,
      assignedFile: decision.assignedFile,
      flow: decision.flow,
      status: "running",
      startedAt: Date.now(),
    });

    // Broadcast orchestrator events (visible to ALL clients)
    broadcastEvent(doc, "info", "Orchestrator", "emerald",
      `${userName}'s agent started — targeting ${activeFile}`);

    if (decision.lockedBy) {
      broadcastEvent(doc, "conflict", "Orchestrator", "emerald",
        `⚠ ${activeFile} is locked by ${decision.lockedBy} — rerouting ${userName} → ${decision.assignedFile}`);
    } else if (decision.flow === "detour") {
      broadcastEvent(doc, "info", "Orchestrator", "emerald",
        `${userName} assigned to work on ${decision.assignedFile} (parallel track)`);
    } else if (decision.flow === "integrator") {
      broadcastEvent(doc, "info", "Orchestrator", "emerald",
        `${userName} assigned as integrator — will unify changes across files`);
    }

    setAgentRunning(true);

    const targetFile = decision.assignedFile;
    const hasRealPrompt = prompt.trim().length > 0;

    // Wrap onEvent to also broadcast
    const broadcastingOnEvent = (event: ActivityEvent) => {
      broadcastEvent(doc, event.type, event.agent, event.agentColor, event.msg);
    };

    try {
      if (hasRealPrompt) {
        // ── REAL K2 AGENT ──
        const meta = doc.getMap("agent-meta");
        meta.set("lockFile", targetFile);
        meta.set("lockOwner", agentName);

        broadcastEvent(doc, "info", agentName, userColor,
          `Thinking about: "${prompt.trim().slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`);
        handleStatusUpdate(targetFile, "thinking");

        await runK2Agent({
          doc,
          workspaceCode: resolvedCode,
          filePath: targetFile,
          prompt: prompt.trim(),
          agentName,
          agentColor: userColor,
          allFiles,
          onThinking: (text) => {
            handleStatusUpdate(targetFile, "thinking");
          },
          onTyping: (file) => {
            broadcastEvent(doc, "info", agentName, userColor, `Writing code to ${file}...`);
            handleStatusUpdate(file, "writing");
            setModifiedFiles(prev => new Set([...prev, file]));
          },
          onDone: (summary) => {
            broadcastEvent(doc, "success", agentName, userColor, summary);
          },
          onError: (err) => {
            broadcastEvent(doc, "warning", agentName, userColor, `Error: ${err}`);
          },
        });

        meta.set("lockFile", "");
        meta.set("lockOwner", "");
        setPrompt("");
      } else {
        // ── DEMO SIMULATION (no prompt) ──
        await runAgentSimulation({
          doc,
          activeFile: targetFile,
          agentName,
          agentColor: userColor,
          flow: decision.flow,
          lockedBy: decision.lockedBy,
          onEvent: broadcastingOnEvent,
          onStatusUpdate: handleStatusUpdate,
        });
      }

      broadcastEvent(doc, "success", "Orchestrator", "emerald",
        `${userName}'s agent completed work on ${targetFile} ✓`);
    } catch (err) {
      broadcastEvent(doc, "warning", "Orchestrator", "emerald",
        `${userName}'s agent encountered an error`);
    } finally {
      unregisterAgent(doc, runId);
      currentRunId.current = null;
      const cleanupMeta = doc.getMap("agent-meta");
      if (cleanupMeta?.get("lockOwner") === agentName) {
        cleanupMeta.set("lockFile", "");
        cleanupMeta.set("lockOwner", "");
      }
      handleStatusUpdate(null, "idle");
      setAgentRunning(false);
    }
  };

  const handleCreateFile = async (type: "file" | "folder") => {
    if (!newFileName.trim() || !resolvedCode) return;
    try {
      const res = await fetch("/api/workspaces/files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: resolvedCode, filePath: newFileName.trim(), type }),
      });
      if (res.ok) {
        if (type === "file") setActiveFile(newFileName.trim());
        fetchFiles(resolvedCode);
      }
    } catch {}
    setNewFileName("");
    setShowNewFileInput(null);
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!resolvedCode) return;
    try {
      await fetch("/api/workspaces/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: resolvedCode, filePath }),
      });
      fetchFiles(resolvedCode);
      if (activeFile === filePath && allFiles.length > 1) {
        setActiveFile(allFiles.find(f => f !== filePath) || "index.ts");
      }
    } catch {}
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/workspace/${resolvedCode}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-HTTPS (LAN access)
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!workspaceId) return null;

  if (!joined) {
    return (
      <JoinSplash workspaceId={workspaceId} onJoin={(name, color, code) => {
        setUserName(name); setUserColor(color); setResolvedCode(code); setJoined(true);
      }} />
    );
  }

  const myClientId = providerRef.current?.awareness.clientID;

  // Build a map: fileName → users who are currently on that file
  const fileUsers: Record<string, { name: string; color: string }[]> = {};
  allFiles.forEach(f => { fileUsers[f] = []; });
  onlineUsers.forEach(u => {
    if (u.agentFile) {
      if (!fileUsers[u.agentFile]) fileUsers[u.agentFile] = [];
      fileUsers[u.agentFile].push({ name: u.name, color: u.color });
    } else {
      if (!fileUsers[u.activeFile]) fileUsers[u.activeFile] = [];
      fileUsers[u.activeFile].push({ name: u.name, color: u.color });
    }
  });

  // Get list of open tab files (active + any in allFiles)
  const openTabs = allFiles.length > 0 ? allFiles.slice(0, 8) : ["index.ts"];

  return (
    <div className="h-screen bg-[#0e0e0e] flex flex-col overflow-hidden">

      {/* ── Menu bar ── */}
      <div className="h-9 border-b border-white/[0.1] flex items-center px-2 gap-0 shrink-0 select-none text-[12px]"
        onClick={() => setActiveMenu(null)}>
        <div className="flex items-center gap-1.5 px-2 mr-2">
          <span className="text-emerald-400 font-bold text-xs">P</span>
        </div>

        {/* File menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
            onMouseEnter={() => activeMenu && setActiveMenu("file")}
            className={`px-2.5 py-1 rounded text-gray-300 hover:text-white hover:bg-white/[0.12] transition ${activeMenu === "file" ? "bg-white/[0.1] text-white" : ""}`}>
            File
          </button>
          {activeMenu === "file" && (
            <div className="absolute top-full left-0 mt-0.5 w-56 bg-[#252525] border border-white/[0.1] rounded-lg shadow-2xl py-1 z-50">
              <button onClick={() => { setShowNewFileInput("file"); setActiveMenu(null); setTimeout(() => newFileInputRef.current?.focus(), 50); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/[0.12] hover:text-white transition text-left">
                <FilePlus className="w-3.5 h-3.5 text-gray-300" /> New File
                <span className="ml-auto text-[10px] text-gray-300">Ctrl+N</span>
              </button>
              <button onClick={() => { setShowNewFileInput("folder"); setActiveMenu(null); setTimeout(() => newFileInputRef.current?.focus(), 50); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/[0.12] hover:text-white transition text-left">
                <FolderPlus className="w-3.5 h-3.5 text-gray-300" /> New Folder
              </button>
              <div className="h-px bg-white/[0.06] my-1" />
              <button onClick={() => { handleDeleteFile(activeFile); setActiveMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition text-left">
                <Trash2 className="w-3.5 h-3.5 text-gray-300" /> Delete File
                <span className="ml-auto text-[10px] text-gray-300">{activeFile.split("/").pop()}</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setActiveMenu(activeMenu === "edit" ? null : "edit")}
            onMouseEnter={() => activeMenu && setActiveMenu("edit")}
            className={`px-2.5 py-1 rounded text-gray-300 hover:text-white hover:bg-white/[0.12] transition ${activeMenu === "edit" ? "bg-white/[0.1] text-white" : ""}`}>
            Edit
          </button>
          {activeMenu === "edit" && (
            <div className="absolute top-full left-0 mt-0.5 w-48 bg-[#252525] border border-white/[0.1] rounded-lg shadow-2xl py-1 z-50">
              <div className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 text-left cursor-default">
                <span>Undo</span><span className="ml-auto text-[10px]">Ctrl+Z</span>
              </div>
              <div className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 text-left cursor-default">
                <span>Redo</span><span className="ml-auto text-[10px]">Ctrl+Y</span>
              </div>
              <div className="h-px bg-white/[0.06] my-1" />
              <div className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 text-left cursor-default">
                <span>Find</span><span className="ml-auto text-[10px]">Ctrl+F</span>
              </div>
              <div className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 text-left cursor-default">
                <span>Replace</span><span className="ml-auto text-[10px]">Ctrl+H</span>
              </div>
            </div>
          )}
        </div>

        {/* View menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
            onMouseEnter={() => activeMenu && setActiveMenu("view")}
            className={`px-2.5 py-1 rounded text-gray-300 hover:text-white hover:bg-white/[0.12] transition ${activeMenu === "view" ? "bg-white/[0.1] text-white" : ""}`}>
            View
          </button>
          {activeMenu === "view" && (
            <div className="absolute top-full left-0 mt-0.5 w-48 bg-[#252525] border border-white/[0.1] rounded-lg shadow-2xl py-1 z-50">
              <button onClick={() => { setTerminalOpen(o => !o); setActiveMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/[0.12] hover:text-white transition text-left">
                <TerminalIcon className="w-3.5 h-3.5 text-gray-300" /> Terminal
                <span className="ml-auto text-[10px] text-gray-300">Ctrl+`</span>
              </button>
              <button onClick={() => { fetchFiles(resolvedCode); setActiveMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/[0.12] hover:text-white transition text-left">
                <RefreshCw className="w-3.5 h-3.5 text-gray-300" /> Refresh Files
              </button>
            </div>
          )}
        </div>

        {/* Spacer + right side */}
        <div className="flex-1" />
        <span className="text-[11px] text-gray-300 mr-3">{resolvedCode}</span>
        <div className="flex items-center gap-1.5 mr-3">
          <div className={`w-1.5 h-1.5 rounded-full ${yjsReady ? "bg-emerald-400" : "bg-yellow-400 animate-pulse"}`} />
          <span className="text-[11px] text-gray-300">{yjsReady ? "connected" : "connecting..."}</span>
        </div>
        <button onClick={copyInviteLink}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-[11px] text-gray-300 transition">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Invite"}
        </button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar — file tree */}
        <div className="w-48 border-r border-white/[0.1] flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-white/[0.1] flex items-center justify-between">
            <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">Explorer</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => { setShowNewFileInput("file"); setTimeout(() => newFileInputRef.current?.focus(), 50); }}
                className="p-1 rounded hover:bg-white/[0.12] text-gray-300 hover:text-gray-300 transition" title="New File">
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setShowNewFileInput("folder"); setTimeout(() => newFileInputRef.current?.focus(), 50); }}
                className="p-1 rounded hover:bg-white/[0.12] text-gray-300 hover:text-gray-300 transition" title="New Folder">
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => fetchFiles(resolvedCode)}
                className="p-1 rounded hover:bg-white/[0.12] text-gray-300 hover:text-gray-300 transition" title="Refresh">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1 px-1">
            {showNewFileInput && (
              <div className="flex items-center gap-1 px-2 py-1 mb-1">
                {showNewFileInput === "folder" ? <Folder className="w-3 h-3 text-yellow-400/80 shrink-0" /> : <File className="w-3 h-3 text-gray-300 shrink-0" />}
                <input ref={newFileInputRef} type="text" value={newFileName}
                  onChange={e => setNewFileName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newFileName.trim()) {
                      e.preventDefault();
                      const t = showNewFileInput!;
                      const n = newFileName.trim();
                      setShowNewFileInput(null);
                      setNewFileName("");
                      fetch("/api/workspaces/files/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: resolvedCode, filePath: n, type: t }),
                      }).then(res => {
                        if (res.ok) {
                          if (t === "file") setActiveFile(n);
                          fetchFiles(resolvedCode);
                        }
                      });
                    }
                    if (e.key === "Escape") { setShowNewFileInput(null); setNewFileName(""); }
                  }}
                  onBlur={() => setTimeout(() => { setShowNewFileInput(null); setNewFileName(""); }, 150)}
                  placeholder={showNewFileInput === "folder" ? "folder name" : "filename.ts"}
                  className="flex-1 bg-white/[0.06] border border-emerald-500/40 rounded px-1.5 py-0.5 text-[11px] text-white placeholder-gray-500 outline-none min-w-0"
                />
              </div>
            )}
            {fileTree.length > 0 ? (
              fileTree.map(node => (
                <FileItem key={node.path || node.name} node={node}
                  activeFile={activeFile} onSelect={setActiveFile}
                  modifiedFiles={modifiedFiles} fileUsers={fileUsers} />
              ))
            ) : (
              <div className="text-[11px] text-gray-300 px-2 py-4">Loading files...</div>
            )}
          </div>
        </div>

        {/* Editor + Terminal area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="h-9 border-b border-white/[0.1] flex items-end px-2 gap-0.5 shrink-0 overflow-x-auto">
            {openTabs.map(file => (
              <button key={file} onClick={() => setActiveFile(file)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-[11px] transition-colors border-t border-l border-r ${
                  activeFile === file
                    ? "bg-[#161616] border-white/[0.08] text-white"
                    : "bg-transparent border-transparent text-gray-300 hover:text-gray-300"
                }`}>
                <File className="w-3 h-3" />
                {file.split("/").pop()}
                {lockedFile === file && <Lock className="w-2.5 h-2.5 text-yellow-400/80" />}
                {modifiedFiles.has(file) && lockedFile !== file && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                )}
              </button>
            ))}
          </div>

          {/* Monaco */}
          <div className={`overflow-hidden ${terminalOpen ? "flex-1 min-h-0" : "flex-1"}`}>
            {yjsReady && docRef.current && providerRef.current ? (
              <Editor
                doc={docRef.current}
                provider={providerRef.current}
                filePath={activeFile}
                initialContent=""
                workspaceCode={resolvedCode}
                onContentChange={() => setModifiedFiles(prev => new Set([...prev, activeFile]))}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Connecting to workspace...</span>
                </div>
              </div>
            )}
          </div>

          {/* Terminal panel */}
          {terminalOpen && (
            <div style={{ height: terminalHeight }} className="border-t border-white/[0.1] flex flex-col shrink-0">
              {/* Drag handle */}
              <div
                className="h-1 cursor-row-resize hover:bg-emerald-400/30 active:bg-emerald-400/50 transition-colors"
                onMouseDown={e => {
                  e.preventDefault();
                  terminalDragRef.current = { startY: e.clientY, startH: terminalHeight };
                  const onMove = (ev: MouseEvent) => {
                    if (!terminalDragRef.current) return;
                    const delta = terminalDragRef.current.startY - ev.clientY;
                    const newH = Math.min(Math.max(terminalDragRef.current.startH + delta, 100), window.innerHeight * 0.7);
                    setTerminalHeight(newH);
                  };
                  const onUp = () => {
                    terminalDragRef.current = null;
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              />
              <div className="h-8 flex items-center px-3 gap-2 border-b border-white/[0.1] shrink-0">
                <TerminalIcon className="w-3.5 h-3.5 text-gray-300" />
                <span className="text-[11px] text-gray-300 font-medium">Terminal</span>
                <div className="flex-1" />
                <button onClick={() => setTerminalOpen(false)}
                  className="text-gray-300 hover:text-gray-300 transition">
                  <PanelBottomClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <TerminalPanel workspaceCode={resolvedCode} />
              </div>
            </div>
          )}

          {/* Bottom bar with agent prompt + terminal toggle */}
          <div className="h-14 border-t border-white/[0.1] flex items-center gap-3 px-4 shrink-0">
            <button onClick={() => setTerminalOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition border ${
                terminalOpen
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-white/[0.07] border-white/[0.08] text-gray-300 hover:text-gray-200"
              }`}>
              {terminalOpen ? <PanelBottomClose className="w-3 h-3" /> : <PanelBottomOpen className="w-3 h-3" />}
              Terminal
            </button>
            <div className="w-px h-6 bg-white/[0.06]" />
            {/* Agent picker */}
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="bg-white/[0.07] border border-white/[0.1] rounded-lg text-[11px] text-gray-300 px-2 py-1.5 outline-none cursor-pointer hover:bg-white/[0.12] transition appearance-none"
              style={{ backgroundImage: "none" }}
            >
              <option value="Claude Code" style={{ background: "#1a1a1a" }}>Claude Code</option>
              <option value="Codex" style={{ background: "#1a1a1a" }}>Codex</option>
              <option value="Gemini" style={{ background: "#1a1a1a" }}>Gemini</option>
              <option value="Cursor" style={{ background: "#1a1a1a" }}>Cursor</option>
            </select>
            <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text" value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !agentRunning && handleRunAgent()}
              placeholder={`Ask ${selectedAgent} to edit ${activeFile}...`}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
            <button onClick={handleRunAgent} disabled={agentRunning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                agentRunning
                  ? "bg-emerald-500/20 text-emerald-400 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black"
              }`}>
              {agentRunning
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Running...</>
                : <><Play className="w-3 h-3" /> Run Agent</>}
            </button>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-64 border-l border-white/[0.1] flex flex-col shrink-0 overflow-hidden">

          {/* TEAM section */}
          <div className="border-b border-white/[0.1] p-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Users className="w-3.5 h-3.5 text-gray-300" />
              <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">
                Team ({onlineUsers.length})
              </span>
            </div>

            <div className="space-y-2">
              {onlineUsers.map(u => {
                const isMe = u.clientId === myClientId;
                const hasAgent = u.agentStatus !== "idle" && !!u.agentFile;
                return (
                  <div key={u.clientId}
                    className={`rounded-lg border px-2 py-1.5 ${colorBg[u.color]} ${colorBorder[u.color]}`}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${colorBg[u.color]} ${colorText[u.color]}`}>
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <span className={`text-[11px] font-semibold ${colorText[u.color]} truncate flex-1`}>{u.name}</span>
                      {isMe && <span className="text-[9px] text-gray-300 shrink-0">you</span>}
                      <div className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${colorDot[u.color]}`} />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 pl-6">
                      <File className="w-2.5 h-2.5 text-gray-300 shrink-0" />
                      <span className="text-[10px] text-gray-300 truncate">
                        {hasAgent ? u.agentFile : u.activeFile}
                      </span>
                      {hasAgent && (
                        <AgentStatusBadge status={u.agentStatus} agentFile={u.agentFile} />
                      )}
                    </div>
                  </div>
                );
              })}

              {onlineUsers.length === 0 && (
                <p className="text-[11px] text-gray-300 pl-1">No one online yet</p>
              )}
            </div>
          </div>

          {/* FILES section */}
          <div className="border-b border-white/[0.1] p-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <Folder className="w-3.5 h-3.5 text-gray-300" />
              <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">Files</span>
            </div>

            <div className="space-y-1">
              {allFiles.map(file => {
                const users = fileUsers[file] || [];
                const isLocked = lockedFile === file;
                return (
                  <button key={file} onClick={() => setActiveFile(file)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors text-left ${
                      activeFile === file
                        ? "bg-white/[0.1] text-white"
                        : "text-gray-300 hover:text-gray-200 hover:bg-white/[0.03]"
                    }`}>
                    <File className="w-3 h-3 text-gray-300 shrink-0" />
                    <span className="truncate flex-1">{file}</span>
                    {isLocked && <Lock className="w-2.5 h-2.5 text-yellow-400 shrink-0" />}
                    <div className="flex gap-0.5 shrink-0">
                      {users.slice(0, 3).map((u, i) => (
                        <span key={`${u.name}-${i}`}
                          className={`w-3.5 h-3.5 rounded-full ${colorDot[u.color]}`}
                          title={u.name} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE AGENTS banner */}
          {activeAgents.length > 0 && (
            <div className="border-b border-white/[0.1] px-3 py-2 shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">
                  Active Agents ({activeAgents.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {activeAgents.map(a => (
                  <div key={a.runId} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${colorDot[a.userColor]} text-black`}>
                      {a.userName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-emerald-300 font-medium truncate">{a.userName}</div>
                      <div className="text-[9px] text-gray-300 truncate">
                        {a.flow === "primary" ? "→" : a.flow === "detour" ? "↪" : "⊕"} {a.assignedFile}
                        {a.status === "redirected" && " (redirected)"}
                      </div>
                    </div>
                    <Loader2 className="w-3 h-3 text-emerald-400 animate-spin shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVITY feed */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-white/[0.1] flex items-center gap-1.5 shrink-0">
              <Zap className="w-3.5 h-3.5 text-yellow-400/70" />
              <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">Activity</span>
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto p-2 space-y-1.5">
              <AnimatePresence initial={false}>
                {activityFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 gap-2 mt-4">
                    <Bot className="w-5 h-5 text-gray-700" />
                    <p className="text-[11px] text-gray-300 text-center">Click &quot;Run Agent&quot; to start</p>
                  </div>
                ) : (
                  activityFeed.map(event => <ActivityEntry key={event.id} event={event} />)
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
