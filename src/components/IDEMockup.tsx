"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  GitBranch,
  Users,
  Circle,
  CheckCircle2,
  AlertTriangle,
  Hexagon,
  Maximize2,
  Minimize2,
  X,
  Search,
  Settings,
  Bell,
  Play,
  RefreshCw,
  MessageSquare,
  Eye,
  Sparkles,
  Bot,
  Check,
  Loader2,
} from "lucide-react";

// ===== TYPES =====

interface TeamMember {
  name: string;
  company: string;
  agent: string;
  color: string;
  avatar: string;
  status: string;
  activeFile: string;
  activeLine: number;
  branchName: string;
  agentStatus: string;
  agentPhase: "thinking" | "writing" | "reviewing" | "idle";
  changes: string;
  changeTime: string;
}

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  modified?: boolean;
  modifiedBy?: string;
  conflict?: boolean;
  lang?: string;
}

// ===== DATA =====

const teamMembers: TeamMember[] = [
  {
    name: "You",
    company: "Acme Corp",
    agent: "Claude Code",
    color: "purple",
    avatar: "Y",
    status: "editing schema.ts",
    activeFile: "schema.ts",
    activeLine: 8,
    branchName: "feat/user-schema",
    agentStatus: "Adding role column to users table...",
    agentPhase: "writing",
    changes: "+24 -3",
    changeTime: "now",
  },
  {
    name: "Sarah K.",
    company: "Vercel",
    agent: "Codex",
    color: "blue",
    avatar: "S",
    status: "writing API routes",
    activeFile: "routes.ts",
    activeLine: 5,
    branchName: "feat/api-routes",
    agentStatus: "Creating POST /api/users endpoint...",
    agentPhase: "writing",
    changes: "+46 -1",
    changeTime: "30s ago",
  },
  {
    name: "Mike R.",
    company: "Stripe",
    agent: "Gemini",
    color: "cyan",
    avatar: "M",
    status: "adding tests",
    activeFile: "api.test.ts",
    activeLine: 6,
    branchName: "feat/api-tests",
    agentStatus: "Generating test coverage for user endpoints...",
    agentPhase: "thinking",
    changes: "+82",
    changeTime: "1m ago",
  },
  {
    name: "Priya D.",
    company: "Shopify",
    agent: "Cursor",
    color: "yellow",
    avatar: "P",
    status: "reviewing auth.ts",
    activeFile: "auth.ts",
    activeLine: 4,
    branchName: "feat/auth-middleware",
    agentStatus: "Reviewing JWT verification logic...",
    agentPhase: "reviewing",
    changes: "+12 -5",
    changeTime: "now",
  },
];

const fileTree: FileNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "api",
        type: "folder",
        children: [
          { name: "routes.ts", type: "file", modified: true, modifiedBy: "Sarah K.", lang: "ts" },
          { name: "middleware.ts", type: "file", lang: "ts" },
          { name: "handlers.ts", type: "file", modified: true, modifiedBy: "Sarah K.", lang: "ts" },
        ],
      },
      {
        name: "db",
        type: "folder",
        children: [
          { name: "schema.ts", type: "file", modified: true, modifiedBy: "You", lang: "ts" },
          { name: "migrations.ts", type: "file", lang: "ts" },
        ],
      },
      {
        name: "auth",
        type: "folder",
        children: [
          { name: "auth.ts", type: "file", modified: true, modifiedBy: "Priya D.", conflict: true, lang: "ts" },
          { name: "session.ts", type: "file", lang: "ts" },
        ],
      },
      { name: "index.ts", type: "file", lang: "ts" },
    ],
  },
  {
    name: "tests",
    type: "folder",
    children: [
      { name: "api.test.ts", type: "file", modified: true, modifiedBy: "Mike R.", lang: "ts" },
      { name: "auth.test.ts", type: "file", modified: true, modifiedBy: "Mike R.", lang: "ts" },
    ],
  },
  { name: "package.json", type: "file", lang: "json" },
  { name: "tsconfig.json", type: "file", lang: "json" },
];

const editorTabs = [
  { name: "schema.ts", path: "src/db/schema.ts", modified: true },
  { name: "routes.ts", path: "src/api/routes.ts", modified: true },
  { name: "auth.ts", path: "src/auth/auth.ts", modified: true },
  { name: "api.test.ts", path: "tests/api.test.ts", modified: true },
];

const orchestratorLogs = [
  { time: "12:04:05", type: "info" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "Scanning all agents — analyzing task overlap and code regions..." },
  { time: "12:04:12", type: "info" as const, agent: "Claude Code", agentColor: "purple", user: "You", msg: "Editing users table schema — added role column" },
  { time: "12:04:19", type: "warning" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "Duplicate work detected: Mike (Gemini) starting user validation — already covered by You (Claude Code). Redirecting Mike to API test coverage instead." },
  { time: "12:04:28", type: "success" as const, agent: "Codex", agentColor: "blue", user: "Sarah K.", msg: "Created 3 new API route handlers" },
  { time: "12:04:35", type: "info" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "Task graph updated — 4 agents, 0 overlaps, 12 files tracked" },
  { time: "12:04:41", type: "warning" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "Conflict: You & Priya both editing user model in schema.ts — auto-merge initiated" },
  { time: "12:04:46", type: "success" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "Auto-merge successful. AST analysis: no breaking changes detected." },
  { time: "12:04:52", type: "info" as const, agent: "Gemini", agentColor: "cyan", user: "Mike R.", msg: "Generated 8 test cases for /api/users (reassigned by Orchestrator)" },
  { time: "12:05:01", type: "suggestion" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "Suggestion to Sarah (Codex): Your routes.ts imports schema.ts — wait for You to finish schema changes before adding type refs." },
  { time: "12:05:08", type: "info" as const, agent: "Cursor", agentColor: "yellow", user: "Priya D.", msg: "Reviewing auth middleware — found 1 improvement" },
  { time: "12:05:15", type: "success" as const, agent: "Orchestrator", agentColor: "emerald", user: "", msg: "All agents synced. Schema finalized → triggering dependent tasks: route types, migration, tests." },
  { time: "12:05:22", type: "success" as const, agent: "Gemini", agentColor: "cyan", user: "Mike R.", msg: "All 14 tests passing" },
];

// Typing events — lines that agents "type" live (loops continuously)
const typingEvents = [
  { file: "schema.ts", text: '  avatar: text("avatar").default("default.png"),', color: "purple", agent: "Claude Code", thinkMsg: "Analyzing schema structure..." },
  { file: "routes.ts", text: '  const filtered = result.filter(u => u.role !== "admin")', color: "blue", agent: "Codex", thinkMsg: "Generating query filter logic..." },
  { file: "api.test.ts", text: '  it("filters admin users from response", async () => {', color: "cyan", agent: "Gemini", thinkMsg: "Generating test case..." },
  { file: "schema.ts", text: '  isActive: text("is_active").default("true"),', color: "purple", agent: "Claude Code", thinkMsg: "Adding user status field..." },
  { file: "routes.ts", text: '  const paginated = filtered.slice(0, 20)', color: "blue", agent: "Codex", thinkMsg: "Implementing pagination..." },
  { file: "auth.ts", text: '  // TODO: Add rate limiting — Priya', color: "yellow", agent: "Cursor", thinkMsg: "Reviewing security patterns..." },
  { file: "api.test.ts", text: '    expect(res.body.length).toBeLessThanOrEqual(20)', color: "cyan", agent: "Gemini", thinkMsg: "Validating pagination bounds..." },
  { file: "schema.ts", text: '  orgId: uuid("org_id").references(() => orgs.id),', color: "purple", agent: "Claude Code", thinkMsg: "Adding organization relation..." },
  { file: "routes.ts", text: '  return c.json({ data: paginated, total: result.length })', color: "blue", agent: "Codex", thinkMsg: "Formatting API response..." },
  { file: "api.test.ts", text: '  it("requires authentication for POST", async () => {', color: "cyan", agent: "Gemini", thinkMsg: "Testing auth requirements..." },
];

// ===== COLOR HELPERS =====

const colorDot: Record<string, string> = { purple: "bg-purple-400", blue: "bg-blue-400", cyan: "bg-cyan-400", yellow: "bg-yellow-400", emerald: "bg-emerald-400" };
const colorText: Record<string, string> = { purple: "text-purple-400", blue: "text-blue-400", cyan: "text-cyan-400", yellow: "text-yellow-400", emerald: "text-emerald-400" };
const colorBg: Record<string, string> = { purple: "bg-purple-500/15", blue: "bg-blue-500/15", cyan: "bg-cyan-500/15", yellow: "bg-yellow-500/15", emerald: "bg-emerald-500/15" };
const colorBorder: Record<string, string> = { purple: "border-purple-500/30", blue: "border-blue-500/30", cyan: "border-cyan-500/30", yellow: "border-yellow-500/30", emerald: "border-emerald-500/30" };
const colorGlow: Record<string, string> = { purple: "shadow-purple-500/20", blue: "shadow-blue-500/20", cyan: "shadow-cyan-500/20", yellow: "shadow-yellow-500/20" };

// ===== SUBCOMPONENTS =====

function K({ children, c }: { children: React.ReactNode; c: string }) {
  return <span className={c}>{children}</span>;
}

function CodeLine({
  num, children, highlight, highlightColor, cursor, cursorColor, cursorLabel, isTyping,
}: {
  num: number; children: React.ReactNode; highlight?: boolean; highlightColor?: string;
  cursor?: boolean; cursorColor?: string; cursorLabel?: string; isTyping?: boolean;
}) {
  return (
    <div className={`flex h-[22px] items-center ${
      highlight
        ? `${highlightColor === "purple" ? "bg-purple-500/[0.06] border-l-2 border-purple-400/60"
            : highlightColor === "blue" ? "bg-blue-500/[0.06] border-l-2 border-blue-400/60"
            : highlightColor === "cyan" ? "bg-cyan-500/[0.06] border-l-2 border-cyan-400/60"
            : highlightColor === "yellow" ? "bg-yellow-500/[0.06] border-l-2 border-yellow-400/60"
            : ""} -mx-4 px-4`
        : ""
    }`}>
      <span className={`w-8 text-right pr-4 text-[11px] select-none shrink-0 ${highlight ? (colorText[highlightColor || ""] || "text-gray-700") : "text-gray-700"}`}>
        {num}
      </span>
      <span className="text-[12px] whitespace-pre">{children}</span>
      {cursor && (
        <>
          <span className={`inline-block w-[2px] h-[14px] ml-0.5 animate-cursor-blink ${
            cursorColor === "purple" ? "bg-purple-400" : cursorColor === "blue" ? "bg-blue-400"
            : cursorColor === "cyan" ? "bg-cyan-400" : cursorColor === "yellow" ? "bg-yellow-400" : "bg-white"
          }`} />
          {cursorLabel && (
            <span className={`ml-2 text-[9px] px-1.5 py-0 rounded flex items-center gap-1 ${
              cursorColor === "purple" ? "bg-purple-500/20 text-purple-400"
              : cursorColor === "blue" ? "bg-blue-500/20 text-blue-400"
              : cursorColor === "cyan" ? "bg-cyan-500/20 text-cyan-400"
              : cursorColor === "yellow" ? "bg-yellow-500/20 text-yellow-400" : ""
            }`}>
              {isTyping && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {cursorLabel}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ThinkingDots({ color }: { color: string }) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".");
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <span className={colorText[color]}>{dots || "."}</span>;
}

function ShimmerLines({ count, color, message }: { count: number; color: string; message?: string }) {
  return (
    <div className="py-1 pl-12">
      {/* Generating label */}
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className={`w-3 h-3 animate-spin ${colorText[color]}`} />
        <span className={`text-[10px] ${colorText[color]} font-medium`}>
          {message || "Generating"}<ThinkingDots color={color} />
        </span>
      </div>
      {/* Shimmer skeleton lines */}
      <div className="space-y-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-2"
          >
            <div
              className={`h-[14px] rounded shimmer-line ${
                color === "purple" ? "bg-purple-500/[0.06]"
                : color === "blue" ? "bg-blue-500/[0.06]"
                : color === "cyan" ? "bg-cyan-500/[0.06]"
                : "bg-yellow-500/[0.06]"
              }`}
              style={{ width: `${40 + (i * 17) % 45}%`, animationDelay: `${i * 0.3}s` }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Minimap({ lineCount, highlights }: { lineCount: number; highlights: { line: number; color: string }[] }) {
  return (
    <div className="w-10 border-l border-white/[0.03] py-3 px-1.5 hidden sm:block">
      {Array.from({ length: lineCount }).map((_, i) => {
        const hl = highlights.find(h => h.line === i + 1);
        return (
          <div
            key={i}
            className={`h-[2px] my-[1.5px] rounded-full ${
              hl ? `${colorDot[hl.color]} opacity-50` : "bg-white/[0.06]"
            }`}
            style={{ width: hl ? "100%" : `${30 + ((i * 7 + 13) % 17) * 3.5}%` }}
          />
        );
      })}
    </div>
  );
}

// ===== MAIN COMPONENT =====

export default function IDEMockup() {
  const [activeTab, setActiveTab] = useState("schema.ts");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "api", "db", "auth", "tests"]));
  const [selectedAgent, setSelectedAgent] = useState("Claude Code");
  const [visibleLogs, setVisibleLogs] = useState(3);
  const [showConflictBanner, setShowConflictBanner] = useState(true);
  const [conflictResolved, setConflictResolved] = useState(false);
  const [activePanel, setActivePanel] = useState<"orchestrator" | "terminal" | "problems">("orchestrator");
  const [testCount, setTestCount] = useState({ pass: 12, pending: 4, fail: 0 });
  const [notification, setNotification] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember>(teamMembers[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Typing animation state
  const [currentTypingIdx, setCurrentTypingIdx] = useState(-1); // -1 = not started
  const [typedChars, setTypedChars] = useState(0);
  const [agentPhase, setAgentPhase] = useState<"thinking" | "writing" | "idle">("idle");
  const [typedLines, setTypedLines] = useState<Record<string, string[]>>({}); // file -> completed typed lines

  // ===== EFFECTS =====

  // Animate orchestrator logs
  useEffect(() => {
    if (visibleLogs < orchestratorLogs.length) {
      const timer = setTimeout(() => {
        setVisibleLogs(v => v + 1);
        if (visibleLogs === 6) setTestCount({ pass: 14, pending: 0, fail: 0 });
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [visibleLogs]);

  // Typing animation cycle — starts quickly and loops forever
  useEffect(() => {
    const startTimer = setTimeout(() => {
      setCurrentTypingIdx(0);
      setAgentPhase("thinking");
    }, 1500);
    return () => clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (currentTypingIdx < 0) return;
    const event = typingEvents[currentTypingIdx % typingEvents.length];

    if (agentPhase === "thinking") {
      // Show shimmer + "Generating..." for 2s
      const timer = setTimeout(() => setAgentPhase("writing"), 2000);
      return () => clearTimeout(timer);
    }

    if (agentPhase === "writing") {
      if (typedChars < event.text.length) {
        // Variable speed: faster for spaces/punctuation, slower for code tokens
        const char = event.text[typedChars];
        const speed = char === " " || char === "," || char === "." ? 15 : 30 + Math.random() * 30;
        const timer = setTimeout(() => setTypedChars(c => c + 1), speed);
        return () => clearTimeout(timer);
      }
      // Line done — save it and move to next
      setTypedLines(prev => ({
        ...prev,
        [event.file]: [...(prev[event.file] || []), event.text],
      }));
      setTypedChars(0);
      setAgentPhase("idle");
      // Brief pause then continue to next event (loops forever)
      const nextTimer = setTimeout(() => {
        setCurrentTypingIdx(i => i + 1);
        setAgentPhase("thinking");
      }, 1800);
      return () => clearTimeout(nextTimer);
    }
  }, [currentTypingIdx, agentPhase, typedChars]);

  // Escape key for fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // ===== HANDLERS =====

  const toggleFolder = useCallback((name: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  }, []);

  const resolveConflict = useCallback(() => {
    setConflictResolved(true);
    setShowConflictBanner(false);
    showNotification("Conflict resolved — changes merged successfully");
  }, [showNotification]);

  const selectMember = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setActiveTab(member.activeFile);
    setSelectedAgent(member.agent);
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 400);
  }, []);

  // ===== RENDER HELPERS =====

  const currentTypingEvent = currentTypingIdx >= 0 ? typingEvents[currentTypingIdx % typingEvents.length] : null;
  const isTypingInFile = (file: string) => currentTypingEvent?.file === file && agentPhase === "writing";
  const isThinkingInFile = (file: string) => currentTypingEvent?.file === file && agentPhase === "thinking";
  const getThinkMsg = (file: string) => currentTypingEvent?.file === file ? currentTypingEvent.thinkMsg : undefined;

  // Get the active member's context for agent bar
  const activeMember = selectedMember;
  const isSelectedMemberTyping = currentTypingEvent && teamMembers.find(m => m.agent === currentTypingEvent.agent)?.name === selectedMember.name;
  const activeMemberPhase = isSelectedMemberTyping ? agentPhase : selectedMember.agentPhase;
  const activeMemberStatus = isSelectedMemberTyping && currentTypingEvent
    ? (agentPhase === "thinking" ? currentTypingEvent.thinkMsg : agentPhase === "writing" ? `Writing: ${currentTypingEvent.text.slice(0, 40)}...` : selectedMember.agentStatus)
    : selectedMember.agentStatus;

  // File tree renderer
  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedFolders.has(node.name);
      const isFolder = node.type === "folder";
      const isActive = !isFolder && node.name === activeTab;
      const isBeingEdited = teamMembers.some(m => m.activeFile === node.name);

      return (
        <div key={node.name}>
          <div
            onClick={() => {
              if (isFolder) toggleFolder(node.name);
              else if (editorTabs.find(t => t.name === node.name)) setActiveTab(node.name);
            }}
            className={`flex items-center gap-1 py-[3px] px-1.5 rounded-[4px] cursor-pointer text-[11px] font-mono transition-colors ${
              isActive ? "bg-white/[0.07] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
            }`}
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
          >
            {isFolder ? (
              isExpanded ? <ChevronDown className="w-3 h-3 text-gray-600 shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
            ) : <span className="w-3 shrink-0" />}
            {isFolder ? (
              isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-emerald-400/50 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-gray-600 shrink-0" />
            ) : (
              <File className={`w-3.5 h-3.5 shrink-0 ${node.lang === "ts" ? "text-blue-400/50" : "text-gray-600"}`} />
            )}
            <span className="truncate">{node.name}</span>
            {isBeingEdited && !node.conflict && (
              <span className={`w-1.5 h-1.5 rounded-full ml-auto shrink-0 animate-pulse-dot ${
                colorDot[teamMembers.find(m => m.activeFile === node.name)?.color || "emerald"]
              }`} />
            )}
            {node.conflict && !conflictResolved && <AlertTriangle className="w-3 h-3 text-yellow-400 ml-auto shrink-0" />}
            {node.modified && !node.conflict && !isBeingEdited && <span className="text-[8px] text-emerald-400 ml-auto shrink-0">M</span>}
            {node.conflict && conflictResolved && <Check className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />}
          </div>
          {isFolder && isExpanded && node.children && <div>{renderFileTree(node.children, depth + 1)}</div>}
        </div>
      );
    });
  };

  // ===== CODE RENDERERS =====
  // Each returns lines + metadata about where cursors & typing happen

  const renderSchemaFile = () => {
    const extraLines = typedLines["schema.ts"] || [];
    return (
      <div className="py-2 font-mono leading-[22px]">
        <CodeLine num={1}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">pgTable, text, timestamp, uuid</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "drizzle-orm/pg-core"'}</K></CodeLine>
        <CodeLine num={2}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">relations</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "drizzle-orm"'}</K></CodeLine>
        <CodeLine num={3}><K c="text-gray-700">{""}</K></CodeLine>
        <CodeLine num={4}><K c="text-gray-600">{"// User table — schema by You (Acme Corp)"}</K></CodeLine>
        <CodeLine num={5}><K c="text-purple-400">export const</K><K c="text-cyan-300">{" users"}</K><K c="text-gray-500">{" = "}</K><K c="text-yellow-300">pgTable</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"users"'}</K><K c="text-gray-500">{", {"}</K></CodeLine>
        <CodeLine num={6}><K c="text-gray-300">{"  id"}</K><K c="text-gray-500">{": "}</K><K c="text-yellow-300">uuid</K><K c="text-gray-500">{'("id").defaultRandom().primaryKey(),'}</K></CodeLine>
        <CodeLine num={7}><K c="text-gray-300">{"  email"}</K><K c="text-gray-500">{": "}</K><K c="text-yellow-300">text</K><K c="text-gray-500">{'("email").unique().notNull(),'}</K></CodeLine>
        <CodeLine num={8} highlight highlightColor="purple" cursor cursorColor="purple" cursorLabel="You · Claude Code" isTyping={isTypingInFile("schema.ts")}>
          <K c="text-gray-300">{"  role"}</K><K c="text-gray-500">{": "}</K><K c="text-yellow-300">text</K><K c="text-gray-500">{'("role").default("member"),'}</K>
        </CodeLine>
        {/* Typed lines appear here */}
        {extraLines.map((line, i) => (
          <CodeLine key={`typed-${i}`} num={9 + i} highlight highlightColor="purple">
            <K c="text-gray-400">{line}</K>
          </CodeLine>
        ))}
        {/* Currently typing line */}
        {isTypingInFile("schema.ts") && currentTypingEvent && (
          <CodeLine num={9 + extraLines.length} highlight highlightColor="purple">
            <K c="text-emerald-400/70">{currentTypingEvent.text.slice(0, typedChars)}</K>
            <span className="inline-block w-[2px] h-[14px] bg-purple-400 animate-cursor-blink" />
          </CodeLine>
        )}
        {/* Shimmer when thinking */}
        {isThinkingInFile("schema.ts") && <ShimmerLines count={3} color="purple" message={getThinkMsg("schema.ts")} />}
        <CodeLine num={9 + extraLines.length + (isTypingInFile("schema.ts") ? 1 : 0)}><K c="text-gray-300">{"  company"}</K><K c="text-gray-500">{": "}</K><K c="text-yellow-300">text</K><K c="text-gray-500">{'("company").notNull(),'}</K></CodeLine>
        <CodeLine num={10 + extraLines.length + (isTypingInFile("schema.ts") ? 1 : 0)}><K c="text-gray-300">{"  createdAt"}</K><K c="text-gray-500">{": "}</K><K c="text-yellow-300">timestamp</K><K c="text-gray-500">{'("created_at").defaultNow(),'}</K></CodeLine>
        <CodeLine num={11 + extraLines.length + (isTypingInFile("schema.ts") ? 1 : 0)} highlight highlightColor="yellow" cursor cursorColor="yellow" cursorLabel="Priya D. · Cursor">
          <K c="text-gray-300">{"  lastLogin"}</K><K c="text-gray-500">{": "}</K><K c="text-yellow-300">timestamp</K><K c="text-gray-500">{'("last_login"),'}</K>
        </CodeLine>
        <CodeLine num={12 + extraLines.length + (isTypingInFile("schema.ts") ? 1 : 0)}><K c="text-gray-500">{"})"}</K></CodeLine>
      </div>
    );
  };

  const renderRoutesFile = () => {
    const extraLines = typedLines["routes.ts"] || [];
    return (
      <div className="py-2 font-mono leading-[22px]">
        <CodeLine num={1}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">Hono</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "hono"'}</K></CodeLine>
        <CodeLine num={2}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">users</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "../db/schema"'}</K></CodeLine>
        <CodeLine num={3}><K c="text-gray-700">{""}</K></CodeLine>
        <CodeLine num={4}><K c="text-purple-400">const</K><K c="text-cyan-300">{" app"}</K><K c="text-gray-500">{" = "}</K><K c="text-purple-400">new</K><K c="text-yellow-300">{" Hono"}</K><K c="text-gray-500">{"()"}</K></CodeLine>
        <CodeLine num={5} highlight highlightColor="blue" cursor cursorColor="blue" cursorLabel="Sarah K. · Codex" isTyping={isTypingInFile("routes.ts")}>
          <K c="text-gray-600">{"// GET /api/users — Sarah (Vercel)"}</K>
        </CodeLine>
        <CodeLine num={6}><K c="text-gray-300">{"app"}</K><K c="text-gray-500">{"."}</K><K c="text-yellow-300">get</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"/users"'}</K><K c="text-gray-500">{", "}</K><K c="text-purple-400">async</K><K c="text-gray-500">{" (c) => {"}</K></CodeLine>
        <CodeLine num={7}><K c="text-gray-500">{"  "}</K><K c="text-purple-400">const</K><K c="text-gray-300">{" result"}</K><K c="text-gray-500">{" = "}</K><K c="text-purple-400">await</K><K c="text-gray-300">{" db"}</K><K c="text-gray-500">{"."}</K><K c="text-yellow-300">select</K><K c="text-gray-500">{"()."}</K><K c="text-yellow-300">from</K><K c="text-gray-500">{"(users)"}</K></CodeLine>
        {/* Typed lines */}
        {extraLines.map((line, i) => (
          <CodeLine key={`typed-${i}`} num={8 + i} highlight highlightColor="blue"><K c="text-gray-400">{line}</K></CodeLine>
        ))}
        {isTypingInFile("routes.ts") && currentTypingEvent && (
          <CodeLine num={8 + extraLines.length} highlight highlightColor="blue">
            <K c="text-emerald-400/70">{currentTypingEvent.text.slice(0, typedChars)}</K>
            <span className="inline-block w-[2px] h-[14px] bg-blue-400 animate-cursor-blink" />
          </CodeLine>
        )}
        {isThinkingInFile("routes.ts") && <ShimmerLines count={3} color="blue" message={getThinkMsg("routes.ts")} />}
        <CodeLine num={8 + extraLines.length + (isTypingInFile("routes.ts") ? 1 : 0)}><K c="text-gray-500">{"  "}</K><K c="text-purple-400">return</K><K c="text-gray-300">{" c"}</K><K c="text-gray-500">{"."}</K><K c="text-yellow-300">json</K><K c="text-gray-500">{"(result)"}</K></CodeLine>
        <CodeLine num={9 + extraLines.length + (isTypingInFile("routes.ts") ? 1 : 0)}><K c="text-gray-500">{"})"}</K></CodeLine>
      </div>
    );
  };

  const renderAuthFile = () => {
    const extraLines = typedLines["auth.ts"] || [];
    return (
      <div className="py-2 font-mono leading-[22px]">
        <CodeLine num={1}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">verify</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "jsonwebtoken"'}</K></CodeLine>
        <CodeLine num={2}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">sessions</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "../db/schema"'}</K></CodeLine>
        <CodeLine num={3}><K c="text-gray-700">{""}</K></CodeLine>
        <CodeLine num={4} highlight highlightColor="yellow" cursor cursorColor="yellow" cursorLabel="Priya D. · Cursor" isTyping={isTypingInFile("auth.ts")}>
          <K c="text-gray-600">{"// Auth middleware — Priya (Shopify)"}</K>
        </CodeLine>
        <CodeLine num={5}><K c="text-purple-400">export const</K><K c="text-cyan-300">{" authMiddleware"}</K><K c="text-gray-500">{" = "}</K><K c="text-purple-400">async</K><K c="text-gray-500">{" (c, next) => {"}</K></CodeLine>
        <CodeLine num={6}><K c="text-gray-500">{"  "}</K><K c="text-purple-400">const</K><K c="text-gray-300">{" token"}</K><K c="text-gray-500">{" = c.req.header("}</K><K c="text-emerald-400">{'"Authorization"'}</K><K c="text-gray-500">{")"}</K></CodeLine>
        <CodeLine num={7}><K c="text-gray-500">{"  "}</K><K c="text-purple-400">if</K><K c="text-gray-500">{" (!token) "}</K><K c="text-purple-400">return</K><K c="text-gray-300">{" c"}</K><K c="text-gray-500">{"."}</K><K c="text-yellow-300">json</K><K c="text-gray-500">{"({ "}</K><K c="text-gray-300">error</K><K c="text-gray-500">{": "}</K><K c="text-emerald-400">{'"Unauthorized"'}</K><K c="text-gray-500">{" }, 401)"}</K></CodeLine>
        <CodeLine num={8}><K c="text-gray-500">{"  "}</K><K c="text-purple-400">const</K><K c="text-gray-300">{" payload"}</K><K c="text-gray-500">{" = "}</K><K c="text-yellow-300">verify</K><K c="text-gray-500">{"(token, process.env."}</K><K c="text-cyan-300">JWT_SECRET</K><K c="text-gray-500">{")"}</K></CodeLine>
        <CodeLine num={9}><K c="text-gray-500">{"  c.set("}</K><K c="text-emerald-400">{'"user"'}</K><K c="text-gray-500">{", payload)"}</K></CodeLine>
        <CodeLine num={10}><K c="text-gray-500">{"  "}</K><K c="text-purple-400">await</K><K c="text-yellow-300">{" next"}</K><K c="text-gray-500">{"()"}</K></CodeLine>
        <CodeLine num={11}><K c="text-gray-500">{"}"}</K></CodeLine>
        {/* Typed lines from Cursor agent */}
        {extraLines.map((line, i) => (
          <CodeLine key={`typed-${i}`} num={12 + i} highlight highlightColor="yellow"><K c="text-gray-400">{line}</K></CodeLine>
        ))}
        {isTypingInFile("auth.ts") && currentTypingEvent && (
          <CodeLine num={12 + extraLines.length} highlight highlightColor="yellow">
            <K c="text-emerald-400/70">{currentTypingEvent.text.slice(0, typedChars)}</K>
            <span className="inline-block w-[2px] h-[14px] bg-yellow-400 animate-cursor-blink" />
          </CodeLine>
        )}
        {isThinkingInFile("auth.ts") && <ShimmerLines count={3} color="yellow" message={getThinkMsg("auth.ts")} />}
      </div>
    );
  };

  const renderTestFile = () => {
    const extraLines = typedLines["api.test.ts"] || [];
    return (
      <div className="py-2 font-mono leading-[22px]">
        <CodeLine num={1}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">describe, it, expect</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "vitest"'}</K></CodeLine>
        <CodeLine num={2}><K c="text-purple-400">import</K><K c="text-gray-500">{" { "}</K><K c="text-gray-300">app</K><K c="text-gray-500">{" } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "../src/api/routes"'}</K></CodeLine>
        <CodeLine num={3}><K c="text-gray-700">{""}</K></CodeLine>
        <CodeLine num={4}><K c="text-gray-600">{"// API tests — Mike (Stripe)"}</K></CodeLine>
        <CodeLine num={5}><K c="text-yellow-300">describe</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"GET /api/users"'}</K><K c="text-gray-500">{", () => {"}</K></CodeLine>
        <CodeLine num={6} highlight highlightColor="cyan" cursor cursorColor="cyan" cursorLabel="Mike R. · Gemini" isTyping={isTypingInFile("api.test.ts")}>
          <K c="text-yellow-300">{"  it"}</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"returns 200 with user list"'}</K><K c="text-gray-500">{", "}</K><K c="text-purple-400">async</K><K c="text-gray-500">{" () => {"}</K>
        </CodeLine>
        <CodeLine num={7}><K c="text-gray-500">{"    "}</K><K c="text-purple-400">const</K><K c="text-gray-300">{" res"}</K><K c="text-gray-500">{" = "}</K><K c="text-purple-400">await</K><K c="text-gray-300">{" app"}</K><K c="text-gray-500">{"."}</K><K c="text-yellow-300">request</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"/api/users"'}</K><K c="text-gray-500">{")"}</K></CodeLine>
        <CodeLine num={8}><K c="text-gray-500">{"    "}</K><K c="text-yellow-300">expect</K><K c="text-gray-500">{"(res.status)."}</K><K c="text-yellow-300">toBe</K><K c="text-gray-500">{"("}</K><K c="text-cyan-300">200</K><K c="text-gray-500">{")"}</K></CodeLine>
        <CodeLine num={9}><K c="text-gray-500">{"  })"}</K></CodeLine>
        {/* Typed lines */}
        {extraLines.map((line, i) => (
          <CodeLine key={`typed-${i}`} num={10 + i} highlight highlightColor="cyan"><K c="text-gray-400">{line}</K></CodeLine>
        ))}
        {isTypingInFile("api.test.ts") && currentTypingEvent && (
          <CodeLine num={10 + extraLines.length} highlight highlightColor="cyan">
            <K c="text-emerald-400/70">{currentTypingEvent.text.slice(0, typedChars)}</K>
            <span className="inline-block w-[2px] h-[14px] bg-cyan-400 animate-cursor-blink" />
          </CodeLine>
        )}
        {isThinkingInFile("api.test.ts") && <ShimmerLines count={3} color="cyan" message={getThinkMsg("api.test.ts")} />}
        <CodeLine num={10 + extraLines.length + (isTypingInFile("api.test.ts") ? 1 : 0)}><K c="text-gray-500">{"})"}</K></CodeLine>
      </div>
    );
  };

  const renderEditorContent = () => {
    if (activeTab === "schema.ts") return renderSchemaFile();
    if (activeTab === "routes.ts") return renderRoutesFile();
    if (activeTab === "auth.ts") return renderAuthFile();
    if (activeTab === "api.test.ts") return renderTestFile();
    return null;
  };

  // Get minimap highlights for current file
  const getMinimapHighlights = () => {
    const member = teamMembers.find(m => m.activeFile === activeTab);
    const others = teamMembers.filter(m => m.activeFile === activeTab && m.name !== member?.name);
    const highlights = [];
    if (member) highlights.push({ line: member.activeLine, color: member.color });
    for (const o of others) highlights.push({ line: o.activeLine, color: o.color });
    return highlights;
  };

  // ===== RENDER =====

  const ideContent = (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50">
      {/* ===== TITLE BAR ===== */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d0d] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-gray-600 font-mono">Parachute</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
          <Hexagon className="w-3 h-3 text-emerald-400" strokeWidth={2} />
          <span className="text-gray-400">workspace</span>
          <span className="text-gray-700">/</span>
          <span className="text-white">acme-saas-app</span>
          {selectedMember.name !== "You" && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-600">
              · viewing as <span className={colorText[selectedMember.color]}>{selectedMember.name}</span>
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-1.5">
            {teamMembers.map(m => (
              <div
                key={m.name}
                onClick={() => selectMember(m)}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 cursor-pointer transition-all ${
                  selectedMember.name === m.name ? `border-white/30 scale-110 ${colorBg[m.color]}` : "border-[#0d0d0d]"
                } ${m.color === "purple" ? "bg-purple-500/30 text-purple-300"
                  : m.color === "blue" ? "bg-blue-500/30 text-blue-300"
                  : m.color === "cyan" ? "bg-cyan-500/30 text-cyan-300"
                  : "bg-yellow-500/30 text-yellow-300"}`}
                title={`${m.name} — ${m.company}`}
              >
                {m.avatar}
              </div>
            ))}
          </div>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-dot" />
            4 online
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }}
            className="text-gray-600 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div className={`flex bg-[#080808] ${isFullscreen ? "h-[calc(100vh-80px)]" : "h-[520px]"}`}>
        {/* ===== LEFT SIDEBAR ===== */}
        <div className="w-56 border-r border-white/[0.04] flex flex-col hidden md:flex bg-[#090909]">
          {/* Team members */}
          <div className="p-2.5 border-b border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-gray-600" />
                <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Collaborators</span>
              </div>
              <span className="text-[9px] text-emerald-400 font-mono">4/4</span>
            </div>
            {teamMembers.map(member => (
              <div
                key={member.name}
                onClick={() => selectMember(member)}
                className={`flex items-center gap-2 px-1.5 py-[5px] rounded-md cursor-pointer transition-all ${
                  selectedMember.name === member.name
                    ? `${colorBg[member.color]} border ${colorBorder[member.color]}`
                    : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    member.color === "purple" ? "bg-purple-500/20 text-purple-400"
                    : member.color === "blue" ? "bg-blue-500/20 text-blue-400"
                    : member.color === "cyan" ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {member.avatar}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-[#090909] ${colorDot[member.color]}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-gray-300 font-medium truncate">{member.name}</p>
                    <span className="text-[8px] text-gray-700">·</span>
                    <span className="text-[8px] text-gray-600 truncate">{member.company}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bot className="w-2.5 h-2.5 text-gray-700" />
                    <p className="text-[9px] text-gray-600 truncate">{member.agent}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* File tree */}
          <div className="flex-1 overflow-y-auto p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Explorer</span>
            </div>
            {renderFileTree(fileTree)}
          </div>

          {/* Agent selector */}
          <div className="p-2.5 border-t border-white/[0.04]">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-medium mb-2">Your Agent</div>
            <div className="flex flex-wrap gap-1">
              {[
                { name: "Claude Code", color: "purple" },
                { name: "Codex", color: "blue" },
                { name: "Gemini", color: "cyan" },
                { name: "Cursor", color: "yellow" },
              ].map(agent => (
                <button
                  key={agent.name}
                  onClick={() => { setSelectedAgent(agent.name); showNotification(`Switched to ${agent.name}`); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-all ${
                    selectedAgent === agent.name
                      ? `${colorBg[agent.color]} ${colorText[agent.color]} border border-white/[0.08]`
                      : "text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-sm ${colorDot[agent.color]} ${selectedAgent === agent.name ? "opacity-100" : "opacity-30"}`} />
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== CENTER: EDITOR + TERMINAL ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Conflict banner */}
          <AnimatePresence>
            {showConflictBanner && !conflictResolved && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-yellow-500/[0.06] border-b border-yellow-500/20 px-3 py-2 flex items-center justify-between overflow-hidden"
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400 font-medium">Merge conflict detected</span>
                  <span className="text-gray-500">— You and Priya D. are both editing the user model</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resolveConflict} className="text-[10px] px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 transition-colors">Auto-merge</button>
                  <button onClick={() => { setActiveTab("schema.ts"); setShowConflictBanner(false); }} className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 text-gray-400 border border-white/[0.06] hover:bg-white/10 transition-colors">Review</button>
                  <button onClick={() => setShowConflictBanner(false)} className="text-gray-600 hover:text-gray-400"><X className="w-3 h-3" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent activity bar */}
          <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] ${colorBg[activeMember.color]} transition-colors`}>
            <Bot className={`w-3 h-3 ${colorText[activeMember.color]}`} />
            <span className={`text-[10px] font-medium ${colorText[activeMember.color]}`}>{activeMember.agent}</span>
            <span className="text-gray-700">|</span>
            <span className="text-[10px] text-gray-400 flex-1 truncate flex items-center gap-1.5">
              {activeMemberPhase === "thinking" && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
              {activeMemberPhase === "writing" && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
              {activeMemberPhase === "reviewing" && <Eye className="w-3 h-3 text-yellow-400" />}
              {activeMemberPhase === "idle" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              {activeMemberStatus}
            </span>
            {/* Progress shimmer + tokens counter */}
            {(activeMemberPhase === "thinking" || activeMemberPhase === "writing") && (
              <>
                <div className="w-24 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className={`h-full w-10 rounded-full ${activeMember.color === "purple" ? "bg-purple-400/50" : activeMember.color === "blue" ? "bg-blue-400/50" : activeMember.color === "cyan" ? "bg-cyan-400/50" : "bg-yellow-400/50"} progress-shimmer`} />
                </div>
                <span className="text-[9px] text-gray-600 font-mono shrink-0">
                  {activeMemberPhase === "writing" ? "~42 tok/s" : "analyzing..."}
                </span>
              </>
            )}
            {activeMemberPhase === "idle" && (
              <span className="text-[9px] text-emerald-400/60 font-mono shrink-0">done</span>
            )}
          </div>

          {/* Editor tabs */}
          <div className="flex items-center bg-[#0a0a0a] border-b border-white/[0.04] overflow-x-auto">
            {editorTabs.map(tab => {
              const owner = teamMembers.find(m => m.activeFile === tab.name);
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono border-r border-white/[0.04] whitespace-nowrap transition-colors ${
                    activeTab === tab.name
                      ? `bg-[#080808] text-gray-300 border-t-2 ${owner ? `border-t-${owner.color}-400` : "border-t-emerald-400"}`
                      : "text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]"
                  }`}
                  style={activeTab === tab.name && owner ? { borderTopColor: owner.color === "purple" ? "#c084fc" : owner.color === "blue" ? "#60a5fa" : owner.color === "cyan" ? "#22d3ee" : "#facc15" } : undefined}
                >
                  <File className="w-3 h-3" />
                  <span>{tab.name}</span>
                  {tab.modified && <Circle className="w-1.5 h-1.5 fill-current text-emerald-400" />}
                  {owner && activeTab === tab.name && (
                    <span className={`text-[8px] ${colorText[owner.color]} flex items-center gap-0.5`}>
                      {owner.avatar}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="flex-1" />
            <div className="flex items-center gap-3 px-3 text-[9px] text-gray-600 font-mono">
              <span>TypeScript</span>
              <span>UTF-8</span>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="px-3 py-1 bg-[#0a0a0a]/50 text-[10px] text-gray-600 font-mono flex items-center gap-1 border-b border-white/[0.03]">
            <span>src</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>{activeTab === "schema.ts" ? "db" : activeTab === "routes.ts" ? "api" : activeTab === "auth.ts" ? "auth" : "tests"}</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span className="text-gray-400">{activeTab}</span>
          </div>

          {/* Code editor + minimap */}
          <div className="flex-1 overflow-auto flex">
            <motion.div
              className="flex-1 overflow-auto"
              animate={isTransitioning ? { opacity: [0.5, 1], scale: [0.995, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {renderEditorContent()}
                </motion.div>
              </AnimatePresence>
            </motion.div>
            <Minimap lineCount={16} highlights={getMinimapHighlights()} />
          </div>

          {/* ===== BOTTOM PANEL ===== */}
          <div className="border-t border-white/[0.04]">
            <div className="flex items-center bg-[#0a0a0a] border-b border-white/[0.04]">
              {[
                { id: "orchestrator" as const, label: "Orchestrator", live: true },
                { id: "terminal" as const, label: "Terminal", live: false },
                { id: "problems" as const, label: "Problems", live: false, count: conflictResolved ? 0 : 1 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActivePanel(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                    activePanel === tab.id ? "text-emerald-400 border-b border-emerald-400" : "text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {tab.live && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-dot" />}
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-[8px] px-1 rounded ${tab.count > 0 ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>{tab.count}</span>
                  )}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }} className="px-3 text-gray-700 hover:text-gray-400 transition-colors">
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            </div>

            <div className={`overflow-y-auto bg-[#060606] font-mono text-[11px] leading-[18px] ${isFullscreen ? "h-[200px]" : "h-[130px]"}`}>
              {activePanel === "orchestrator" && (
                <div className="p-3">
                  <div className="text-gray-700 mb-2">
                    <span className="text-emerald-400">◆</span> Orchestrator v1.0 — Monitoring <span className="text-white">4 agents</span> across <span className="text-white">4 companies</span> — Workspace: acme-saas-app
                  </div>
                  {orchestratorLogs.slice(0, visibleLogs).map((log, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 py-0.5">
                      <span className="text-gray-700 shrink-0">[{log.time}]</span>
                      {log.type === "warning" ? <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                        : log.type === "success" ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        : log.type === "suggestion" ? <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        : <span className="w-3 shrink-0" />}
                      <span className="text-gray-500">
                        <span className={colorText[log.agentColor]}>{log.agent}</span>
                        {log.user && <span className="text-gray-700"> ({log.user})</span>}
                        {" — "}
                        <span className={log.type === "warning" ? "text-yellow-400" : log.type === "success" ? "text-emerald-400" : log.type === "suggestion" ? "text-emerald-300" : "text-gray-400"}>
                          {log.msg}
                        </span>
                      </span>
                    </motion.div>
                  ))}
                  <div className="mt-2 flex items-center gap-1 text-gray-600">
                    <span className="text-emerald-400">❯</span>
                    <span className="inline-block w-[6px] h-3 bg-emerald-400/50 animate-cursor-blink" />
                  </div>
                </div>
              )}
              {activePanel === "terminal" && (
                <div className="p-3 text-gray-500">
                  <div><span className="text-emerald-400">❯</span> npm run dev</div>
                  <div className="text-gray-600 mt-1">Server running on http://localhost:3000</div>
                  <div className="text-emerald-400 mt-1">✓ Ready in 1.2s</div>
                  <div className="mt-2 flex items-center gap-1"><span className="text-emerald-400">❯</span><span className="inline-block w-[6px] h-3 bg-emerald-400/50 animate-cursor-blink" /></div>
                </div>
              )}
              {activePanel === "problems" && (
                <div className="p-3">
                  {!conflictResolved ? (
                    <div className="flex items-start gap-2 text-yellow-400">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <div>
                        <p>Merge conflict in src/db/schema.ts</p>
                        <p className="text-gray-600 text-[10px]">You (Acme Corp) and Priya D. (Shopify) are editing overlapping regions</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="w-3 h-3" /><span>No problems detected</span></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <div className="w-60 border-l border-white/[0.04] flex-col hidden lg:flex bg-[#090909]">
          {/* Swarm status */}
          <div className="p-3 border-b border-white/[0.04]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-dot" />
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Swarm Status</span>
              </div>
              <span className="text-[9px] text-gray-600 font-mono">LIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: testCount.pass, label: "Tests Pass", color: "text-emerald-400" },
                { value: 4, label: "Agents", color: "text-gray-300" },
                { value: 7, label: "Files Changed", color: "text-cyan-400" },
                { value: conflictResolved ? 0 : 1, label: "Conflicts", color: conflictResolved ? "text-emerald-400" : "text-yellow-400" },
              ].map(stat => (
                <div key={stat.label} className="rounded-md bg-white/[0.02] p-2 text-center">
                  <motion.p
                    key={stat.value}
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`text-[18px] font-bold ${stat.color}`}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="text-[8px] text-gray-600 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Orchestrator Intelligence */}
          <div className="p-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Hexagon className="w-3 h-3 text-emerald-400" strokeWidth={2} />
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Orchestrator AI</span>
              <Loader2 className="w-2.5 h-2.5 text-emerald-400/50 animate-spin ml-auto" />
            </div>

            {/* Task assignments */}
            <div className="space-y-1.5">
              {[
                { user: "You", color: "purple", task: "DB schema + migrations", status: "active" as const },
                { user: "Sarah K.", color: "blue", task: "API routes + handlers", status: "active" as const },
                { user: "Mike R.", color: "cyan", task: "Test coverage (reassigned)", status: "active" as const },
                { user: "Priya D.", color: "yellow", task: "Auth + security review", status: "reviewing" as const },
              ].map(assignment => (
                <div key={assignment.user} className="flex items-center gap-2 py-1 px-1.5 rounded-md bg-white/[0.02]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorDot[assignment.color]} ${assignment.status === "active" ? "animate-pulse-dot" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <span className={`text-[9px] ${colorText[assignment.color]} font-medium`}>{assignment.user}</span>
                    <p className="text-[8px] text-gray-600 truncate">{assignment.task}</p>
                  </div>
                  <span className={`text-[7px] px-1 py-0.5 rounded ${
                    assignment.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"
                  }`}>
                    {assignment.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Dependency graph */}
            <div className="mt-2.5 p-2 rounded-md bg-emerald-500/[0.04] border border-emerald-500/10">
              <p className="text-[9px] text-emerald-400 font-medium mb-1 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Dependency Chain
              </p>
              <div className="text-[8px] text-gray-500 font-mono space-y-0.5">
                <p><span className="text-purple-400">schema.ts</span> → <span className="text-blue-400">routes.ts</span> → <span className="text-cyan-400">api.test.ts</span></p>
                <p><span className="text-purple-400">schema.ts</span> → <span className="text-yellow-400">auth.ts</span></p>
              </div>
              <p className="text-[8px] text-gray-600 mt-1">Orchestrator holding Sarah until schema finalizes</p>
            </div>
          </div>

          {/* Live changes */}
          <div className="p-3 border-b border-white/[0.04] flex-1 overflow-y-auto">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Live Changes</span>
            <div className="mt-2.5 space-y-2">
              {teamMembers.map(member => (
                <div
                  key={member.name}
                  onClick={() => selectMember(member)}
                  className={`rounded-md glass p-2 cursor-pointer transition-all ${
                    selectedMember.name === member.name
                      ? `border ${colorBorder[member.color]} ${colorBg[member.color]}`
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${colorDot[member.color]} animate-pulse-dot`} />
                      <span className={`text-[10px] ${colorText[member.color]} font-medium`}>{member.name}</span>
                      <span className="text-[8px] text-gray-700">{member.company}</span>
                    </div>
                    <span className="text-[8px] text-gray-700">{member.changeTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 font-mono">{member.activeFile}</span>
                    <span className="text-[9px] text-emerald-400 font-mono">{member.changes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="p-3 border-t border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Quick Actions</span>
            <div className="mt-2 space-y-1">
              {[
                { icon: Play, label: "Run All Tests", action: () => showNotification("Running test suite...") },
                { icon: Eye, label: "Review All Changes", action: () => showNotification("Opening diff view...") },
                { icon: MessageSquare, label: "Team Chat", action: () => showNotification("Chat opened") },
                { icon: GitBranch, label: "Create PR", action: () => showNotification("PR draft created") },
              ].map(item => (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition-colors text-left">
                  <item.icon className="w-3 h-3" />{item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className="flex items-center justify-between px-3 py-1 bg-emerald-500/[0.08] border-t border-emerald-500/20 text-[10px] font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-400">
            <GitBranch className="w-3 h-3" />
            {selectedMember.branchName}
          </span>
          <span className="flex items-center gap-1 text-gray-500"><RefreshCw className="w-2.5 h-2.5" />synced</span>
          <span className="text-gray-600">4 collaborators · 4 agents active</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">Ln {selectedMember.activeLine}, Col 42</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />E2E Encrypted
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Toast notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium backdrop-blur-xl"
          >
            <CheckCircle2 className="w-4 h-4" />
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen mode */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={() => setIsFullscreen(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={isFullscreen ? { opacity: 1 } : { opacity: 1 }}
        className={
          isFullscreen
            ? "fixed inset-4 z-[101]"
            : "mt-20 w-full max-w-[1200px] mx-auto relative"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer glow */}
        {!isFullscreen && (
          <div className="absolute -inset-2 bg-gradient-to-b from-emerald-500/20 via-cyan-500/5 to-transparent rounded-2xl blur-2xl pointer-events-none" />
        )}

        <div className="relative h-full">
          {ideContent}
        </div>
      </motion.div>
    </>
  );
}
