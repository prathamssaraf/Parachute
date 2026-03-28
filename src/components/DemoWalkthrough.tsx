"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
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
  Bot,
  Loader2,
  Sparkles,
  Eye,
  Play,
  SkipForward,
  Pause,
  ArrowRight,
} from "lucide-react";

// ===== STEP DEFINITIONS =====

const STEPS = [
  { duration: 3000, caption: "A new project begins. One workspace, shared by four developers from four companies.", label: "Setup" },
  { duration: 7000, caption: "Four developers join from Acme Corp, Vercel, Stripe, and Shopify \u2014 each bringing their own AI agent.", label: "Join" },
  { duration: 9000, caption: "All four AI agents begin coding simultaneously \u2014 each in their own branch, each on their own task.", label: "Code" },
  { duration: 7000, caption: "The Orchestrator spots Mike\u2019s agent duplicating work already being done \u2014 and instantly reassigns him.", label: "Duplicate" },
  { duration: 5000, caption: "A conflict is detected instantly \u2014 two agents edited the same region of the same file.", label: "Conflict" },
  { duration: 5000, caption: "The Orchestrator performs AST-level analysis and auto-merges the conflict. Zero manual intervention.", label: "Resolve" },
  { duration: 6000, caption: "The Orchestrator manages dependencies \u2014 holding Sarah\u2019s agent until the schema is finalized.", label: "Deps" },
  { duration: 7000, caption: "All 14 tests pass. Four branches merge cleanly into main. A pull request is created automatically.", label: "Ship" },
  { duration: 8000, caption: "Four companies. Four AI agents. One Orchestrator. Zero conflicts. This is Parachute.", label: "Finale" },
];

const TEAM = [
  { name: "You", company: "Acme Corp", agent: "Claude Code", color: "purple", avatar: "Y", file: "schema.ts", branch: "feat/user-schema", task: "DB schema + migrations" },
  { name: "Sarah K.", company: "Vercel", agent: "Codex", color: "blue", avatar: "S", file: "routes.ts", branch: "feat/api-routes", task: "API routes + handlers" },
  { name: "Mike R.", company: "Stripe", agent: "Gemini", color: "cyan", avatar: "M", file: "api.test.ts", branch: "feat/api-tests", task: "User validation tests" },
  { name: "Priya D.", company: "Shopify", agent: "Cursor", color: "yellow", avatar: "P", file: "auth.ts", branch: "feat/auth-middleware", task: "Auth + security review" },
];

const TEST_LINES = [
  "\u2713 GET /api/users returns 200 (12ms)",
  "\u2713 POST /api/users creates user (18ms)",
  "\u2713 filters admin users from response (8ms)",
  "\u2713 requires authentication for POST (14ms)",
  "\u2713 pagination returns max 20 results (9ms)",
  "\u2713 rejects invalid user payload (6ms)",
  "\u2713 returns 404 for unknown user (11ms)",
  "\u2713 updates user role correctly (15ms)",
  "\u2713 deletes user and cascades (13ms)",
  "\u2713 rate limits after 100 requests (22ms)",
  "\u2713 validates email format (5ms)",
  "\u2713 hashes password on create (19ms)",
  "\u2713 auth middleware rejects invalid JWT (11ms)",
  "\u2713 auth middleware passes valid JWT (7ms)",
];

// ===== COLOR MAPS =====
const cDot: Record<string, string> = { purple: "bg-purple-400", blue: "bg-blue-400", cyan: "bg-cyan-400", yellow: "bg-yellow-400", emerald: "bg-emerald-400" };
const cText: Record<string, string> = { purple: "text-purple-400", blue: "text-blue-400", cyan: "text-cyan-400", yellow: "text-yellow-400", emerald: "text-emerald-400" };
const cBg: Record<string, string> = { purple: "bg-purple-500/15", blue: "bg-blue-500/15", cyan: "bg-cyan-500/15", yellow: "bg-yellow-500/15" };

// ===== COMPONENT =====

export default function DemoWalkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0); // ms elapsed in current step

  // Step-specific states
  const [teamJoined, setTeamJoined] = useState(0);
  const [filesVisible, setFilesVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("schema.ts");
  const [typingIdx, setTypingIdx] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [conflictState, setConflictState] = useState<"none" | "detected" | "resolved">("none");
  const [mikeReassigned, setMikeReassigned] = useState(false);
  const [depWaiting, setDepWaiting] = useState(false);
  const [depReleased, setDepReleased] = useState(false);
  const [testLines, setTestLines] = useState<string[]>([]);
  const [mergeState, setMergeState] = useState<"none" | "merging" | "pr" | "done">("none");
  const [showFinale, setShowFinale] = useState(false);
  const [agentBarText, setAgentBarText] = useState("Initializing workspace...");
  const [agentBarColor, setAgentBarColor] = useState("emerald");
  const [agentBarPhase, setAgentBarPhase] = useState<"thinking" | "writing" | "idle">("thinking");
  const [statsPass, setStatsPass] = useState(0);
  const [statsAgents, setStatsAgents] = useState(0);
  const [statsFiles, setStatsFiles] = useState(0);
  const [statsConflicts, setStatsConflicts] = useState(0);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); setIsPaused(p => !p); }
      if (e.key === "ArrowRight" && step < STEPS.length - 1) advanceStep();
      if (e.key === "ArrowLeft" && step > 0) setStep(s => s - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, onClose]);

  // Step timer
  useEffect(() => {
    if (isPaused || step >= STEPS.length) return;
    const timer = setTimeout(() => {
      if (step < STEPS.length - 1) advanceStep();
    }, STEPS[step].duration);
    return () => clearTimeout(timer);
  }, [step, isPaused]);

  // Elapsed timer for progress bar
  useEffect(() => {
    if (isPaused) return;
    setElapsed(0);
    const interval = setInterval(() => setElapsed(e => e + 100), 100);
    return () => clearInterval(interval);
  }, [step, isPaused]);

  const advanceStep = useCallback(() => {
    setStep(s => s + 1);
    setElapsed(0);
  }, []);

  // ===== STEP ORCHESTRATION =====

  // Step 0: Curtain rise
  useEffect(() => {
    if (step === 0) {
      setAgentBarText("Initializing workspace...");
      setAgentBarColor("emerald");
      setAgentBarPhase("thinking");
    }
  }, [step]);

  // Step 1: Developers join
  useEffect(() => {
    if (step !== 1) return;
    setTeamJoined(0);
    const timers = TEAM.map((_, i) =>
      setTimeout(() => {
        setTeamJoined(i + 1);
        setStatsAgents(i + 1);
      }, i * 1400)
    );
    const fileTimer = setTimeout(() => {
      setFilesVisible(true);
      setStatsFiles(7);
    }, TEAM.length * 1400 + 500);
    const logTimer = setTimeout(() => {
      setLogs(["Scanning all agents \u2014 analyzing task overlap and code regions..."]);
    }, TEAM.length * 1400 + 800);
    return () => { timers.forEach(clearTimeout); clearTimeout(fileTimer); clearTimeout(logTimer); };
  }, [step]);

  // Step 2: Parallel coding — cycle through tabs
  useEffect(() => {
    if (step !== 2) return;
    const files = ["schema.ts", "routes.ts", "api.test.ts", "auth.ts"];
    const agents = [
      { text: "Adding role column to users table...", color: "purple" },
      { text: "Creating POST /api/users endpoint...", color: "blue" },
      { text: "Generating test coverage for user endpoints...", color: "cyan" },
      { text: "Reviewing JWT verification logic...", color: "yellow" },
    ];
    const logMsgs = [
      "Claude Code (You) \u2014 Editing users table schema",
      "Codex (Sarah K.) \u2014 Creating API route handlers",
      "Gemini (Mike R.) \u2014 Starting user validation tests",
      "Cursor (Priya D.) \u2014 Writing auth middleware",
    ];
    let idx = 0;
    setActiveTab(files[0]);
    setAgentBarText(agents[0].text);
    setAgentBarColor(agents[0].color);
    setAgentBarPhase("writing");
    setTypingIdx(0);
    setTypedChars(0);

    const cycle = setInterval(() => {
      idx = (idx + 1) % 4;
      setActiveTab(files[idx]);
      setAgentBarText(agents[idx].text);
      setAgentBarColor(agents[idx].color);
      setAgentBarPhase("writing");
      setTypingIdx(idx);
      setTypedChars(0);
      setLogs(prev => [...prev.slice(-3), logMsgs[idx]]);
    }, 2200);

    // Typing within each tab
    const typeInterval = setInterval(() => {
      setTypedChars(c => c + 1);
    }, 40);

    return () => { clearInterval(cycle); clearInterval(typeInterval); };
  }, [step]);

  // Step 3: Duplicate work detection
  useEffect(() => {
    if (step !== 3) return;
    setActiveTab("api.test.ts");
    setAgentBarText("Starting user validation logic...");
    setAgentBarColor("cyan");
    setAgentBarPhase("writing");
    setTypedChars(0);

    const typeInt = setInterval(() => setTypedChars(c => c + 1), 45);

    const warnTimer = setTimeout(() => {
      clearInterval(typeInt);
      setAgentBarText("Duplicate work detected! Reassigning...");
      setAgentBarColor("emerald");
      setAgentBarPhase("thinking");
      setLogs(prev => [...prev.slice(-2), "\u26a0 Duplicate work detected: Mike (Gemini) starting user validation \u2014 already covered by You. Redirecting to test coverage."]);
    }, 2000);

    const reassignTimer = setTimeout(() => {
      setMikeReassigned(true);
      setAgentBarText("Generating test coverage for user endpoints...");
      setAgentBarColor("cyan");
      setAgentBarPhase("writing");
      setTypedChars(0);
      setLogs(prev => [...prev.slice(-2), "Task graph updated \u2014 4 agents, 0 overlaps, 12 files tracked"]);
    }, 4500);

    const typeResumed = setTimeout(() => {
      const int2 = setInterval(() => setTypedChars(c => c + 1), 40);
      setTimeout(() => clearInterval(int2), 2000);
    }, 5000);

    return () => { clearInterval(typeInt); clearTimeout(warnTimer); clearTimeout(reassignTimer); clearTimeout(typeResumed); };
  }, [step]);

  // Step 4: Conflict detected
  useEffect(() => {
    if (step !== 4) return;
    setActiveTab("schema.ts");
    setAgentBarText("Editing user schema...");
    setAgentBarColor("purple");
    setAgentBarPhase("writing");

    const detectTimer = setTimeout(() => {
      setConflictState("detected");
      setStatsConflicts(1);
      setLogs(prev => [...prev.slice(-2), "\u26a0 Conflict: You & Priya both editing user model in schema.ts \u2014 auto-merge initiated"]);
    }, 1500);

    return () => clearTimeout(detectTimer);
  }, [step]);

  // Step 5: Conflict resolved
  useEffect(() => {
    if (step !== 5) return;
    const resolveTimer = setTimeout(() => {
      setConflictState("resolved");
      setStatsConflicts(0);
      setAgentBarText("Auto-merge successful. No breaking changes.");
      setAgentBarColor("emerald");
      setAgentBarPhase("idle");
      setLogs(prev => [...prev.slice(-2), "\u2713 Auto-merge successful. AST analysis: no breaking changes detected."]);
    }, 1800);
    return () => clearTimeout(resolveTimer);
  }, [step]);

  // Step 6: Dependency management
  useEffect(() => {
    if (step !== 6) return;
    setActiveTab("routes.ts");
    setAgentBarText("Waiting for schema.ts to finalize...");
    setAgentBarColor("blue");
    setAgentBarPhase("thinking");
    setDepWaiting(true);
    setDepReleased(false);

    const logTimer = setTimeout(() => {
      setLogs(prev => [...prev.slice(-2), "\u2728 Suggestion to Sarah: routes.ts imports schema.ts \u2014 wait for schema changes."]);
    }, 1000);

    const releaseTimer = setTimeout(() => {
      setDepWaiting(false);
      setDepReleased(true);
      setAgentBarText("Schema finalized! Resuming route generation...");
      setAgentBarColor("blue");
      setAgentBarPhase("writing");
      setLogs(prev => [...prev.slice(-2), "\u2713 Schema finalized \u2192 triggering dependent tasks: route types, migration, tests."]);
    }, 3500);

    return () => { clearTimeout(logTimer); clearTimeout(releaseTimer); };
  }, [step]);

  // Step 7: Tests + Merge + PR
  useEffect(() => {
    if (step !== 7) return;
    setActiveTab("terminal");
    setAgentBarText("Running test suite...");
    setAgentBarColor("emerald");
    setAgentBarPhase("writing");
    setTestLines([]);
    setMergeState("none");

    // Stream test results
    const testTimers = TEST_LINES.map((line, i) =>
      setTimeout(() => {
        setTestLines(prev => [...prev, line]);
        setStatsPass(i + 1);
      }, 500 + i * 200)
    );

    // Merge
    const mergeTimer = setTimeout(() => {
      setMergeState("merging");
      setLogs(prev => [...prev.slice(-1), "\u2713 All 14 tests passing. Merging branches..."]);
    }, 500 + TEST_LINES.length * 200 + 500);

    // PR
    const prTimer = setTimeout(() => {
      setMergeState("pr");
      setAgentBarText("Pull request #47 created successfully");
      setAgentBarPhase("idle");
    }, 500 + TEST_LINES.length * 200 + 1500);

    const doneTimer = setTimeout(() => setMergeState("done"), 500 + TEST_LINES.length * 200 + 2500);

    return () => { testTimers.forEach(clearTimeout); clearTimeout(mergeTimer); clearTimeout(prTimer); clearTimeout(doneTimer); };
  }, [step]);

  // Step 8: Finale
  useEffect(() => {
    if (step !== 8) return;
    setAgentBarText("Session complete. 0 unresolved conflicts.");
    setAgentBarColor("emerald");
    setAgentBarPhase("idle");

    const finaleTimer = setTimeout(() => setShowFinale(true), 2500);
    setLogs(prev => [...prev.slice(-1), "Session complete. 4 agents, 4 companies, 7 files, 14 tests, 0 conflicts."]);
    return () => clearTimeout(finaleTimer);
  }, [step]);

  // ===== RENDER HELPERS =====

  const K = ({ c, children }: { c: string; children: React.ReactNode }) => <span className={c}>{children}</span>;

  // Code content for each file (simplified for demo)
  const codeForFile = (file: string) => {
    const maxChars = typedChars;
    if (file === "schema.ts") {
      const lines = [
        { n: 1, c: <><K c="text-purple-400">import</K><K c="text-gray-500">{" { pgTable, text, uuid } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "drizzle-orm/pg-core"'}</K></> },
        { n: 2, c: <K c="text-gray-700">{""}</K> },
        { n: 3, c: <><K c="text-purple-400">export const</K><K c="text-cyan-300">{" users"}</K><K c="text-gray-500">{" = pgTable("}</K><K c="text-emerald-400">{'"users"'}</K><K c="text-gray-500">{", {"}</K></> },
        { n: 4, c: <><K c="text-gray-300">{"  id"}</K><K c="text-gray-500">{': uuid("id").primaryKey(),'}</K></> },
        { n: 5, c: <><K c="text-gray-300">{"  email"}</K><K c="text-gray-500">{': text("email").unique(),'}</K></> },
        { n: 6, c: <><K c="text-gray-300">{"  role"}</K><K c="text-gray-500">{': text("role").default("member"),'}</K></>, hl: "purple", cursor: step >= 2 },
        { n: 7, c: <><K c="text-gray-300">{"  company"}</K><K c="text-gray-500">{': text("company").notNull(),'}</K></> },
        { n: 8, c: <><K c="text-gray-300">{"  lastLogin"}</K><K c="text-gray-500">{': timestamp("last_login"),'}</K></>, hl: step >= 4 ? "yellow" : undefined, cursor: step >= 4 },
        { n: 9, c: <K c="text-gray-500">{"})"}</K> },
      ];
      return lines;
    }
    if (file === "routes.ts") {
      return [
        { n: 1, c: <><K c="text-purple-400">import</K><K c="text-gray-500">{" { Hono } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "hono"'}</K></> },
        { n: 2, c: <><K c="text-purple-400">import</K><K c="text-gray-500">{" { users } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "../db/schema"'}</K></> },
        { n: 3, c: <K c="text-gray-700">{""}</K> },
        { n: 4, c: <><K c="text-purple-400">const</K><K c="text-cyan-300">{" app"}</K><K c="text-gray-500">{" = new Hono()"}</K></> },
        { n: 5, c: <><K c="text-gray-500">{"app.get("}</K><K c="text-emerald-400">{'"/users"'}</K><K c="text-gray-500">{", async (c) => {"}</K></>, hl: "blue", cursor: true },
        { n: 6, c: <><K c="text-gray-500">{"  const result = await db.select().from(users)"}</K></> },
        { n: 7, c: <><K c="text-gray-500">{"  return c.json(result)"}</K></> },
        { n: 8, c: <K c="text-gray-500">{"})"}</K> },
      ];
    }
    if (file === "api.test.ts") {
      return [
        { n: 1, c: <><K c="text-purple-400">import</K><K c="text-gray-500">{" { describe, it, expect } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "vitest"'}</K></> },
        { n: 2, c: <K c="text-gray-700">{""}</K> },
        { n: 3, c: <><K c="text-yellow-300">describe</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"GET /api/users"'}</K><K c="text-gray-500">{", () => {"}</K></> },
        { n: 4, c: <><K c="text-yellow-300">{"  it"}</K><K c="text-gray-500">{"("}</K><K c="text-emerald-400">{'"returns 200"'}</K><K c="text-gray-500">{", async () => {"}</K></>, hl: "cyan", cursor: true },
        { n: 5, c: <><K c="text-gray-500">{"    const res = await app.request("}</K><K c="text-emerald-400">{'"/api/users"'}</K><K c="text-gray-500">{")"}</K></> },
        { n: 6, c: <><K c="text-gray-500">{"    expect(res.status).toBe(200)"}</K></> },
        { n: 7, c: <K c="text-gray-500">{"  })"}</K> },
        { n: 8, c: <K c="text-gray-500">{"})"}</K> },
      ];
    }
    if (file === "auth.ts") {
      return [
        { n: 1, c: <><K c="text-purple-400">import</K><K c="text-gray-500">{" { verify } "}</K><K c="text-purple-400">from</K><K c="text-emerald-400">{' "jsonwebtoken"'}</K></> },
        { n: 2, c: <K c="text-gray-700">{""}</K> },
        { n: 3, c: <><K c="text-purple-400">export const</K><K c="text-cyan-300">{" authMiddleware"}</K><K c="text-gray-500">{" = async (c, next) => {"}</K></> },
        { n: 4, c: <><K c="text-gray-500">{'  const token = c.req.header("Authorization")'}</K></>, hl: "yellow", cursor: true },
        { n: 5, c: <><K c="text-gray-500">{"  if (!token) return c.json({ error: "}</K><K c="text-emerald-400">{'"Unauthorized"'}</K><K c="text-gray-500">{" }, 401)"}</K></> },
        { n: 6, c: <><K c="text-gray-500">{"  const payload = verify(token, process.env.JWT_SECRET)"}</K></> },
        { n: 7, c: <><K c="text-gray-500">{"  await next()"}</K></> },
        { n: 8, c: <K c="text-gray-500">{"}"}</K> },
      ];
    }
    return [];
  };

  // Typing line visual
  const typingLine = (text: string, color: string, chars: number) => {
    const visible = text.slice(0, Math.min(chars, text.length));
    return (
      <div className={`flex h-[22px] items-center -mx-4 px-4 ${
        color === "purple" ? "bg-purple-500/[0.06] border-l-2 border-purple-400/60"
        : color === "blue" ? "bg-blue-500/[0.06] border-l-2 border-blue-400/60"
        : color === "cyan" ? "bg-cyan-500/[0.06] border-l-2 border-cyan-400/60"
        : "bg-yellow-500/[0.06] border-l-2 border-yellow-400/60"
      }`}>
        <span className="w-8 text-right pr-4 text-[11px] select-none shrink-0 text-gray-700">+</span>
        <span className="text-[12px] text-emerald-400/70 whitespace-pre">{visible}</span>
        <span className={`inline-block w-[2px] h-[14px] ml-0.5 animate-cursor-blink ${
          color === "purple" ? "bg-purple-400" : color === "blue" ? "bg-blue-400"
          : color === "cyan" ? "bg-cyan-400" : "bg-yellow-400"
        }`} />
      </div>
    );
  };

  // Overall progress
  const totalDuration = STEPS.reduce((a, s) => a + s.duration, 0);
  const elapsedTotal = STEPS.slice(0, step).reduce((a, s) => a + s.duration, 0) + Math.min(elapsed, STEPS[step]?.duration || 0);
  const progress = (elapsedTotal / totalDuration) * 100;

  // ===== MAIN RENDER =====

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="demo-overlay flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Hexagon className="w-4 h-4 text-emerald-400" strokeWidth={2} />
          <span className="text-sm text-gray-400 font-medium">Parachute Demo</span>
          <span className="text-xs text-gray-600 ml-2">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(p => !p)}
            className="text-gray-500 hover:text-white transition-colors p-1"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          {step < STEPS.length - 1 && (
            <button
              onClick={() => setStep(STEPS.length - 1)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
            >
              Skip <SkipForward className="w-3 h-3" />
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* IDE mockup area */}
      <div className="flex-1 px-6 pb-2 min-h-0">
        <div className="h-full max-w-[1200px] mx-auto flex flex-col">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex-1 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50 flex flex-col min-h-0"
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d0d] border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[11px] text-gray-600 font-mono">Parachute</span>
              </div>
              <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5">
                <Hexagon className="w-3 h-3 text-emerald-400" strokeWidth={2} />
                <span>workspace /</span>
                {step >= 0 && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white">
                    acme-saas-app
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Avatar stack — appears as team joins */}
                <div className="flex -space-x-1.5">
                  {TEAM.slice(0, teamJoined).map(m => (
                    <motion.div
                      key={m.name}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-[#0d0d0d] ${
                        m.color === "purple" ? "bg-purple-500/30 text-purple-300"
                        : m.color === "blue" ? "bg-blue-500/30 text-blue-300"
                        : m.color === "cyan" ? "bg-cyan-500/30 text-cyan-300"
                        : "bg-yellow-500/30 text-yellow-300"
                      }`}
                    >
                      {m.avatar}
                    </motion.div>
                  ))}
                </div>
                {teamJoined > 0 && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-dot" />
                    {teamJoined} online
                  </span>
                )}
              </div>
            </div>

            {/* Main layout */}
            <div className="flex flex-1 bg-[#080808] min-h-0">
              {/* Left sidebar */}
              <div className="w-52 border-r border-white/[0.04] flex flex-col bg-[#090909] hidden md:flex shrink-0">
                {/* Collaborators */}
                <div className="p-2.5 border-b border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-gray-600" />
                      <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Collaborators</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono">{teamJoined}/4</span>
                  </div>
                  <AnimatePresence>
                    {TEAM.slice(0, teamJoined).map(m => (
                      <motion.div
                        key={m.name}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center gap-2 px-1.5 py-[5px] rounded-md"
                      >
                        <div className="relative shrink-0">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${cBg[m.color]} ${cText[m.color]}`}>
                            {m.avatar}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-[#090909] ${cDot[m.color]}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="text-[10px] text-gray-300 font-medium truncate">{m.name}</p>
                            <span className="text-[8px] text-gray-700">{m.company}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bot className="w-2.5 h-2.5 text-gray-700" />
                            <p className="text-[9px] text-gray-600 truncate">{m.agent}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* File tree */}
                <div className="flex-1 overflow-y-auto p-2.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Explorer</span>
                  {filesVisible ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11px] font-mono space-y-0.5">
                      <div className="flex items-center gap-1 text-gray-400 py-0.5">
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-400/50" />
                        <span>src</span>
                      </div>
                      {["api", "db", "auth"].map(f => (
                        <div key={f} className="ml-3">
                          <div className="flex items-center gap-1 text-gray-500 py-0.5">
                            <ChevronDown className="w-3 h-3 text-gray-600" />
                            <FolderOpen className="w-3.5 h-3.5 text-emerald-400/50" />
                            <span>{f}</span>
                          </div>
                          <div className="ml-4">
                            {(f === "api" ? ["routes.ts", "handlers.ts"] : f === "db" ? ["schema.ts"] : ["auth.ts"]).map(file => (
                              <div key={file} className={`flex items-center gap-1 py-0.5 ${activeTab === file ? "text-white" : "text-gray-500"}`}>
                                <span className="w-3" />
                                <File className="w-3.5 h-3.5 text-blue-400/50" />
                                <span>{file}</span>
                                {conflictState === "detected" && file === "auth.ts" && <AlertTriangle className="w-3 h-3 text-yellow-400 ml-auto" />}
                                {conflictState === "resolved" && file === "auth.ts" && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
                                {file !== "auth.ts" && <span className="text-[8px] text-emerald-400 ml-auto">M</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-1 text-gray-400 py-0.5">
                        <ChevronDown className="w-3 h-3 text-gray-600" />
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-400/50" />
                        <span>tests</span>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-1 text-gray-500 py-0.5">
                          <span className="w-3" />
                          <File className="w-3.5 h-3.5 text-blue-400/50" />
                          <span>api.test.ts</span>
                          <span className="text-[8px] text-emerald-400 ml-auto">M</span>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="mt-4 text-[10px] text-gray-700 text-center">No files yet</div>
                  )}
                </div>

                {/* Agent selector */}
                <div className="p-2.5 border-t border-white/[0.04]">
                  <div className="text-[9px] uppercase tracking-wider text-gray-600 font-medium mb-2">Your Agent</div>
                  <div className="flex flex-wrap gap-1">
                    {[{ name: "Claude Code", color: "purple" }, { name: "Codex", color: "blue" }, { name: "Gemini", color: "cyan" }, { name: "Cursor", color: "yellow" }].map(a => (
                      <div key={a.name} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium ${
                        a.name === "Claude Code" ? `${cBg[a.color]} ${cText[a.color]} border border-white/[0.08]` : "text-gray-600"
                      }`}>
                        <span className={`w-2 h-2 rounded-sm ${cDot[a.color]} ${a.name === "Claude Code" ? "opacity-100" : "opacity-30"}`} />
                        {a.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center: Editor + Bottom panel */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Conflict banner */}
                <AnimatePresence>
                  {conflictState === "detected" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-yellow-500/[0.06] border-b border-yellow-500/20 px-3 py-2 flex items-center justify-between overflow-hidden shrink-0"
                    >
                      <div className="flex items-center gap-2 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-yellow-400 font-medium">Merge conflict detected</span>
                        <span className="text-gray-500">\u2014 You and Priya D. editing same region</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Auto-merge</span>
                        <span className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 text-gray-400 border border-white/[0.06]">Review</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Agent activity bar */}
                <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] ${cBg[agentBarColor] || "bg-emerald-500/15"} transition-colors shrink-0`}>
                  <Bot className={`w-3 h-3 ${cText[agentBarColor] || "text-emerald-400"}`} />
                  <span className={`text-[10px] font-medium ${cText[agentBarColor] || "text-emerald-400"}`}>
                    {agentBarColor === "emerald" ? "Orchestrator" : TEAM.find(t => t.color === agentBarColor)?.agent || "Agent"}
                  </span>
                  <span className="text-gray-700">|</span>
                  <span className="text-[10px] text-gray-400 flex-1 truncate flex items-center gap-1.5">
                    {agentBarPhase === "thinking" && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                    {agentBarPhase === "writing" && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                    {agentBarPhase === "idle" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {agentBarText}
                  </span>
                  {agentBarPhase !== "idle" && (
                    <div className="w-20 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className={`h-full w-10 rounded-full progress-shimmer ${
                        agentBarColor === "purple" ? "bg-purple-400/50"
                        : agentBarColor === "blue" ? "bg-blue-400/50"
                        : agentBarColor === "cyan" ? "bg-cyan-400/50"
                        : agentBarColor === "yellow" ? "bg-yellow-400/50"
                        : "bg-emerald-400/50"
                      }`} />
                    </div>
                  )}
                </div>

                {/* Editor tabs */}
                {step >= 2 && activeTab !== "terminal" && (
                  <div className="flex items-center bg-[#0a0a0a] border-b border-white/[0.04] overflow-x-auto shrink-0">
                    {["schema.ts", "routes.ts", "api.test.ts", "auth.ts"].map(tab => (
                      <div
                        key={tab}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono border-r border-white/[0.04] ${
                          activeTab === tab ? "bg-[#080808] text-gray-300 border-t-2 border-t-emerald-400" : "text-gray-600"
                        }`}
                      >
                        <File className="w-3 h-3" />
                        {tab}
                        <Circle className="w-1.5 h-1.5 fill-current text-emerald-400" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Editor content / Terminal */}
                <div className="flex-1 overflow-auto font-mono text-[12px] leading-[22px]">
                  {step < 2 ? (
                    // Empty state
                    <div className="flex items-center justify-center h-full text-gray-700 text-sm">
                      {step === 0 ? "Initializing workspace..." : "Waiting for agents to start..."}
                    </div>
                  ) : activeTab === "terminal" ? (
                    // Terminal view (step 7)
                    <div className="p-4 text-[11px] leading-[18px]">
                      <div className="text-gray-500"><span className="text-emerald-400">\u276f</span> npm run test</div>
                      <div className="mt-2 space-y-0.5">
                        {testLines.map((line, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-emerald-400">
                            {line}
                          </motion.div>
                        ))}
                      </div>
                      {testLines.length === TEST_LINES.length && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-gray-400">
                          <p>Test Suites: <span className="text-emerald-400">2 passed</span>, 2 total</p>
                          <p>Tests: <span className="text-emerald-400">14 passed</span>, 14 total</p>
                          <p>Time: <span className="text-white">1.847s</span></p>
                        </motion.div>
                      )}
                      {mergeState !== "none" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                          <div className="text-gray-500"><span className="text-emerald-400">\u276f</span> git merge --no-ff feat/user-schema feat/api-routes feat/api-tests feat/auth-middleware</div>
                          <div className="text-emerald-400 mt-1">Merge successful. 4 branches merged into main.</div>
                        </motion.div>
                      )}
                      {(mergeState === "pr" || mergeState === "done") && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
                          <div className="text-gray-500"><span className="text-emerald-400">\u276f</span> gh pr create --title &quot;feat: user management API&quot;</div>
                          <div className="text-emerald-400 mt-1">Pull request #47 created successfully</div>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    // Code editor
                    <div className="py-2 px-0">
                      {/* Dependency waiting overlay */}
                      {depWaiting && activeTab === "routes.ts" && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm"
                        >
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                          <span className="text-[11px] text-blue-400">Waiting for schema.ts to finalize...</span>
                        </motion.div>
                      )}
                      {codeForFile(activeTab).map((line: { n: number; c: React.ReactNode; hl?: string; cursor?: boolean }) => (
                        <div key={line.n} className={`flex h-[22px] items-center ${
                          line.hl ? `${line.hl === "purple" ? "bg-purple-500/[0.06] border-l-2 border-purple-400/60"
                            : line.hl === "blue" ? "bg-blue-500/[0.06] border-l-2 border-blue-400/60"
                            : line.hl === "cyan" ? "bg-cyan-500/[0.06] border-l-2 border-cyan-400/60"
                            : "bg-yellow-500/[0.06] border-l-2 border-yellow-400/60"} -mx-0 px-4` : "px-4"
                        }`}>
                          <span className="w-8 text-right pr-4 text-[11px] select-none shrink-0 text-gray-700">{line.n}</span>
                          <span className="text-[12px] whitespace-pre">{line.c}</span>
                          {line.cursor && (
                            <span className={`inline-block w-[2px] h-[14px] ml-0.5 animate-cursor-blink ${
                              line.hl === "purple" ? "bg-purple-400" : line.hl === "blue" ? "bg-blue-400"
                              : line.hl === "cyan" ? "bg-cyan-400" : "bg-yellow-400"
                            }`} />
                          )}
                          {line.cursor && line.hl && (
                            <span className={`ml-2 text-[9px] px-1.5 rounded flex items-center gap-1 ${
                              line.hl === "purple" ? "bg-purple-500/20 text-purple-400"
                              : line.hl === "blue" ? "bg-blue-500/20 text-blue-400"
                              : line.hl === "cyan" ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                              {agentBarPhase === "writing" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                              {TEAM.find(t => t.color === line.hl)?.name} \u00b7 {TEAM.find(t => t.color === line.hl)?.agent}
                            </span>
                          )}
                        </div>
                      ))}
                      {/* Shimmer when generating */}
                      {step >= 2 && agentBarPhase === "writing" && activeTab !== "terminal" && (
                        <div className="pl-12 mt-1 space-y-1.5">
                          <div className="flex items-center gap-2 mb-2">
                            <Loader2 className={`w-3 h-3 animate-spin ${cText[agentBarColor]}`} />
                            <span className={`text-[10px] ${cText[agentBarColor]} font-medium`}>Generating...</span>
                          </div>
                          {[65, 45, 80].map((w, i) => (
                            <div key={i} className={`h-[14px] rounded shimmer-line ${
                              agentBarColor === "purple" ? "bg-purple-500/[0.06]"
                              : agentBarColor === "blue" ? "bg-blue-500/[0.06]"
                              : agentBarColor === "cyan" ? "bg-cyan-500/[0.06]"
                              : "bg-yellow-500/[0.06]"
                            }`} style={{ width: `${w}%`, animationDelay: `${i * 0.3}s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom panel - Orchestrator */}
                <div className="border-t border-white/[0.04] shrink-0">
                  <div className="flex items-center bg-[#0a0a0a] border-b border-white/[0.04]">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-emerald-400 border-b border-emerald-400">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-dot" />
                      Orchestrator
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-gray-600">Terminal</div>
                  </div>
                  <div className="h-[100px] overflow-y-auto bg-[#060606] font-mono text-[11px] leading-[18px] p-3">
                    <div className="text-gray-700 mb-1">
                      <span className="text-emerald-400">\u25c6</span> Orchestrator v1.0 \u2014 Monitoring <span className="text-white">{statsAgents} agents</span> across <span className="text-white">{teamJoined} companies</span>
                    </div>
                    {logs.map((log, i) => (
                      <motion.div
                        key={`${i}-${log.slice(0, 20)}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="py-0.5 text-gray-500"
                      >
                        <span className="text-gray-700">[{`12:0${4 + Math.floor(i / 3)}:${String((12 + i * 8) % 60).padStart(2, "0")}`}]</span>{" "}
                        {log.startsWith("\u26a0") ? (
                          <span className="text-yellow-400">{log}</span>
                        ) : log.startsWith("\u2713") ? (
                          <span className="text-emerald-400">{log}</span>
                        ) : log.startsWith("\u2728") ? (
                          <span className="text-emerald-300">{log}</span>
                        ) : (
                          <span className="text-gray-400">{log}</span>
                        )}
                      </motion.div>
                    ))}
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-emerald-400">\u276f</span>
                      <span className="inline-block w-[6px] h-3 bg-emerald-400/50 animate-cursor-blink" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="w-56 border-l border-white/[0.04] flex-col hidden lg:flex bg-[#090909] shrink-0">
                {/* Swarm Status */}
                <div className="p-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-dot" />
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Swarm Status</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { value: statsPass, label: "Tests Pass", color: statsPass > 0 ? "text-emerald-400" : "text-gray-600" },
                      { value: statsAgents, label: "Agents", color: statsAgents > 0 ? "text-gray-300" : "text-gray-600" },
                      { value: statsFiles, label: "Files", color: statsFiles > 0 ? "text-cyan-400" : "text-gray-600" },
                      { value: statsConflicts, label: "Conflicts", color: statsConflicts > 0 ? "text-yellow-400" : "text-emerald-400" },
                    ].map(s => (
                      <div key={s.label} className="rounded-md bg-white/[0.02] p-2 text-center">
                        <motion.p key={s.value} initial={{ y: 3, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`text-[18px] font-bold ${s.color}`}>
                          {s.value}
                        </motion.p>
                        <p className="text-[8px] text-gray-600 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Orchestrator AI — task assignments */}
                <div className="p-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Hexagon className="w-3 h-3 text-emerald-400" strokeWidth={2} />
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Orchestrator AI</span>
                    {step >= 1 && <Loader2 className="w-2.5 h-2.5 text-emerald-400/50 animate-spin ml-auto" />}
                  </div>
                  {step >= 1 && (
                    <div className="space-y-1.5">
                      {TEAM.slice(0, teamJoined).map(m => (
                        <motion.div
                          key={m.name}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 py-1 px-1.5 rounded-md bg-white/[0.02]"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cDot[m.color]} animate-pulse-dot`} />
                          <div className="min-w-0 flex-1">
                            <span className={`text-[9px] ${cText[m.color]} font-medium`}>{m.name}</span>
                            <p className="text-[8px] text-gray-600 truncate">
                              {mikeReassigned && m.name === "Mike R." ? "Test coverage (reassigned)" : m.task}
                            </p>
                          </div>
                          <span className="text-[7px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                            {step >= 8 ? "done" : "active"}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Dependency chain */}
                  {step >= 6 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 p-2 rounded-md bg-emerald-500/[0.04] border border-emerald-500/10">
                      <p className="text-[9px] text-emerald-400 font-medium mb-1 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Dependency Chain
                      </p>
                      <div className="text-[8px] text-gray-500 font-mono">
                        <span className="text-purple-400">schema.ts</span> \u2192 <span className="text-blue-400">routes.ts</span> \u2192 <span className="text-cyan-400">api.test.ts</span>
                      </div>
                      <p className="text-[8px] text-gray-600 mt-1">
                        {depReleased ? "All dependencies resolved \u2713" : "Holding Sarah until schema finalizes"}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Live changes */}
                <div className="p-3 flex-1 overflow-y-auto">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Live Changes</span>
                  {step >= 2 && (
                    <div className="mt-2 space-y-1.5">
                      {TEAM.slice(0, teamJoined).map(m => (
                        <div key={m.name} className="rounded-md bg-white/[0.02] p-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${cDot[m.color]} animate-pulse-dot`} />
                            <span className={`text-[9px] ${cText[m.color]} font-medium`}>{m.name}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[8px] text-gray-600 font-mono">{m.file}</span>
                            <span className="text-[8px] text-emerald-400 font-mono">+{12 + TEAM.indexOf(m) * 11}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-emerald-500/[0.08] border-t border-emerald-500/20 text-[10px] font-mono shrink-0">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-emerald-400">
                  <GitBranch className="w-3 h-3" />
                  {step >= 7 ? "main" : TEAM[0].branch}
                </span>
                <span className="text-gray-600">{teamJoined} collaborators \u00b7 {statsAgents} agents</span>
              </div>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                E2E Encrypted
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Caption + Progress bar */}
      <div className="px-6 py-3 shrink-0">
        <div className="max-w-[1200px] mx-auto">
          {/* Caption */}
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-center text-gray-400 text-sm mb-3"
            >
              {STEPS[step]?.caption}
            </motion.p>
          </AnimatePresence>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden mb-2">
            <motion.div
              className="h-full bg-emerald-400/60 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? "bg-emerald-400 scale-125" : i < step ? "bg-emerald-400/40" : "bg-white/10"
                }`}
                title={s.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Finale overlay */}
      <AnimatePresence>
        {showFinale && step === 8 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center"
            >
              <Hexagon className="w-12 h-12 text-emerald-400 mx-auto mb-4" strokeWidth={1.5} />
              <h2 className="text-3xl font-bold mb-2">
                Para<span className="text-emerald-400">chute</span>
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                One workspace. Many developers. Infinite AI agents.
                <br />
                One Orchestrator to rule them all.
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="#waitlist"
                  onClick={onClose}
                  className="group flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-all"
                >
                  Get Early Access
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <button
                  onClick={() => {
                    setStep(0);
                    setShowFinale(false);
                    setTeamJoined(0);
                    setFilesVisible(false);
                    setActiveTab("schema.ts");
                    setLogs([]);
                    setConflictState("none");
                    setMikeReassigned(false);
                    setDepWaiting(false);
                    setDepReleased(false);
                    setTestLines([]);
                    setMergeState("none");
                    setStatsPass(0);
                    setStatsAgents(0);
                    setStatsFiles(0);
                    setStatsConflicts(0);
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-white font-medium rounded-lg transition-colors"
                >
                  Replay Demo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
