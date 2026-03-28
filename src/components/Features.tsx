"use client";

import { motion } from "framer-motion";
import {
  Users,
  Bot,
  Shield,
  GitBranch,
  Activity,
  Monitor,
  Brain,
  Ban,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Orchestrator AI",
    description:
      "A master LLM that watches every agent across every user. It understands who is doing what, prevents overlap, manages task dependencies, and keeps the entire swarm aligned.",
    tag: "Core",
    color: "emerald",
  },
  {
    icon: Ban,
    title: "No Duplicate Work",
    description:
      "The Orchestrator detects when two agents start working on the same thing and automatically reassigns one to the next priority task. No wasted tokens, no wasted time.",
    tag: "Smart Routing",
    color: "purple",
  },
  {
    icon: Shield,
    title: "Conflict Prevention",
    description:
      "Real-time AST analysis across all agents. The Orchestrator predicts merge conflicts before they happen and auto-merges or blocks conflicting writes.",
    tag: "AST Analysis",
    color: "cyan",
  },
  {
    icon: Bot,
    title: "Any Agent, Any User",
    description:
      "Each developer brings their own AI agent — Claude Code, Codex, Gemini, Cursor. The Orchestrator speaks to all of them and coordinates their work.",
    tag: "Universal",
    color: "blue",
  },
  {
    icon: Activity,
    title: "Dependency Awareness",
    description:
      "The Orchestrator builds a live dependency graph of your codebase. It holds agents from writing to files that depend on unfinished upstream changes.",
    tag: "Task Graph",
    color: "yellow",
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    description:
      "Multiple developers across different companies work simultaneously. Live cursors, presence, and an activity feed powered by the Orchestrator.",
    tag: "Live Sync",
    color: "rose",
  },
];

const colorMap: Record<string, string> = {
  emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  cyan: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  rose: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

const iconColorMap: Record<string, string> = {
  emerald: "text-emerald-400",
  purple: "text-purple-400",
  cyan: "text-cyan-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
  rose: "text-rose-400",
};

export default function Features() {
  return (
    <section id="features" className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-sm text-emerald-400 font-medium mb-4 tracking-wider uppercase">
            Features
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Everything you need.
            <br />
            <span className="gradient-text-subtle">Nothing you don&apos;t.</span>
          </h2>
          <p className="mt-6 text-gray-400 max-w-xl mx-auto">
            Built from the ground up for teams that want to harness AI agents
            without the chaos. Real-time sync, conflict prevention, and full
            visibility.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-xl p-6 hover:border-white/10 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <feature.icon
                  className={`w-8 h-8 ${iconColorMap[feature.color]}`}
                  strokeWidth={1.5}
                />
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorMap[feature.color]}`}
                >
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
