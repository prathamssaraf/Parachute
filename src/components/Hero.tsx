"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, ArrowRight, Users, Bot, Zap, Shield } from "lucide-react";
import IDEMockup from "./IDEMockup";
import DemoWalkthrough from "./DemoWalkthrough";

export default function Hero() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start pt-16 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Radial gradient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-10">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-accent text-emerald-400 text-xs font-medium mb-8"
          >
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-dot" />
            Built for YHack 2026
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] max-w-4xl"
          >
            The Collaborative{" "}
            <br className="hidden sm:block" />
            <span className="gradient-text">Workspace</span> for{" "}
            <br className="hidden sm:block" />
            AI Agents.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-6 text-lg text-gray-400 max-w-2xl leading-relaxed"
          >
            One workspace. Many developers. Infinite AI agents. A single
            Orchestrator AI watches every agent — preventing conflicts,
            eliminating duplicate work, managing dependencies, and keeping
            your entire team shipping in sync.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row items-center gap-4"
          >
            <a
              href="#waitlist"
              className="group flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-all"
            >
              Get Early Access
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <button
              onClick={() => setShowDemo(true)}
              className="flex items-center gap-2 px-6 py-3 glass hover:border-white/15 text-gray-300 hover:text-white font-medium rounded-lg transition-all"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
          >
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Multi-player</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Any AI Agent</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Real-time Sync</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Conflict Prevention</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* IDE Mockup - full width, extends below fold */}
      <div className="relative z-10 w-full px-6 pb-20">
        <IDEMockup />
      </div>

      {/* Demo Walkthrough Overlay */}
      {showDemo && <DemoWalkthrough onClose={() => setShowDemo(false)} />}
    </section>
  );
}
