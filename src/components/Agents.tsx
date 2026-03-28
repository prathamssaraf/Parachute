"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Eye,
  ShieldCheck,
  PlayCircle,
  Sparkles,
  BookOpen,
  Video,
  Image,
} from "lucide-react";

const agents = [
  {
    icon: Brain,
    name: "Orchestrator Agent",
    role: "Master Controller",
    model: "GPT-4 + AST Engine",
    description:
      "The master LLM overseeing all agents and users. Prevents conflicts, eliminates duplicate work, manages cross-file dependencies, reassigns tasks in real-time, and ensures no two agents touch the same code region.",
    color: "emerald",
    active: true,
  },
  {
    icon: Eye,
    name: "Mind Reader Agent",
    role: "Intent Prediction",
    model: "Gemini 3 Pro",
    description:
      "Anticipates developer intent by analyzing cursor context and real-time actions of collaborators. Suggests relevant completions and next steps.",
    color: "purple",
    active: true,
  },
  {
    icon: ShieldCheck,
    name: "Conflict Guard",
    role: "Merge Protection",
    model: "Logic-based (AST)",
    description:
      "Predicts and warns about potential merge conflicts in real-time by tracking concurrent edits and analyzing function dependencies.",
    color: "cyan",
    active: true,
  },
  {
    icon: PlayCircle,
    name: "Shadow Runner",
    role: "Background Testing",
    model: "Gemini 3 Pro",
    description:
      "Automatically executes code in the background to identify runtime errors and edge cases instantly without interrupting the developer.",
    color: "blue",
    active: true,
  },
  {
    icon: Sparkles,
    name: "Refactoring Agent",
    role: "Code Quality",
    model: "MiniMax-M2",
    description:
      "Proactively scans the codebase to identify code smells and suggests modernizations or performance improvements.",
    color: "yellow",
    active: true,
  },
  {
    icon: BookOpen,
    name: "Code Explainer",
    role: "Context Aware",
    model: "MiniMax-M2",
    description:
      "Provides instant, context-aware explanations for complex code snippets on demand. Perfect for onboarding and code reviews.",
    color: "rose",
    active: true,
  },
  {
    icon: Video,
    name: "Visualizer (Video)",
    role: "Animated Diagrams",
    model: "T2V-01 (MiniMax)",
    description:
      "Generates animated flowcharts and UML-style diagrams to visualize code execution paths and logic flow.",
    color: "orange",
    active: false,
  },
  {
    icon: Image,
    name: "Visualizer (Image)",
    role: "Static Diagrams",
    model: "Gemini 3 Pro Image",
    description:
      "Creates high-quality static architectural and conceptual diagrams to visualize code structure and relationships.",
    color: "teal",
    active: false,
  },
];

const dotColors: Record<string, string> = {
  emerald: "bg-emerald-400",
  purple: "bg-purple-400",
  cyan: "bg-cyan-400",
  blue: "bg-blue-400",
  yellow: "bg-yellow-400",
  rose: "bg-rose-400",
  orange: "bg-orange-400",
  teal: "bg-teal-400",
};

const iconColors: Record<string, string> = {
  emerald: "text-emerald-400",
  purple: "text-purple-400",
  cyan: "text-cyan-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
  rose: "text-rose-400",
  orange: "text-orange-400",
  teal: "text-teal-400",
};

export default function Agents() {
  return (
    <section id="agents" className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <p className="text-sm text-emerald-400 font-medium mb-4 tracking-wider uppercase">
            Ghost Agents
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Intelligent agents that
            <br />
            <span className="gradient-text">work alongside you.</span>
          </h2>
          <p className="mt-6 text-gray-400 max-w-2xl mx-auto">
            A master Orchestrator LLM coordinates every agent in the workspace —
            preventing conflicts, stopping duplicate work, and managing
            dependencies so your team ships faster without stepping on each
            other.
          </p>
        </motion.div>

        {/* Active count badge */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex justify-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-accent text-emerald-400 text-xs font-mono">
            Active Agents: {agents.filter((a) => a.active).length}/{agents.length}
          </div>
        </motion.div>

        {/* Agent Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={`glass rounded-xl p-5 hover:border-white/10 transition-all group ${
                !agent.active ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <agent.icon
                  className={`w-5 h-5 ${iconColors[agent.color]}`}
                  strokeWidth={1.5}
                />
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-pulse-dot ${
                    agent.active ? dotColors[agent.color] : "bg-gray-600"
                  }`}
                />
              </div>
              <h3 className="text-sm font-semibold text-white mb-0.5">
                {agent.name}
              </h3>
              <p className="text-[10px] text-gray-500 font-mono mb-3">
                {agent.role} · {agent.model}
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                {agent.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
