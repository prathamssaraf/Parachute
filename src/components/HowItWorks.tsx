"use client";

import { motion } from "framer-motion";
import { Users, Bot, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Connect",
    subtitle: "Create a workspace. Invite your team.",
    description:
      "Spin up a cloud workspace, share the link, and everyone joins with a VS Code-like editor in their browser. No setup, no installs.",
    color: "emerald",
  },
  {
    number: "02",
    icon: Bot,
    title: "Deploy Agents",
    subtitle: "Each developer picks their AI agent.",
    description:
      "Choose your preferred AI agent — Claude Code, Codex, Gemini — and deploy it into the shared workspace. The Orchestrator starts monitoring instantly.",
    color: "cyan",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Ship Together",
    subtitle: "The Orchestrator handles the rest.",
    description:
      "The Orchestrator AI watches every agent, prevents duplicate work, auto-resolves conflicts, manages file dependencies, and reassigns tasks when priorities shift. You just code.",
    color: "purple",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-sm text-emerald-400 font-medium mb-4 tracking-wider uppercase">
            How It Works
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Three steps.
            <br />
            <span className="gradient-text-subtle">Infinite possibilities.</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="space-y-16">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col md:flex-row items-start gap-8"
            >
              {/* Number */}
              <div className="shrink-0">
                <span className="text-6xl font-bold text-white/5 font-mono">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <div className="glass rounded-xl p-8 flex-1 w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      step.color === "emerald"
                        ? "bg-emerald-400/10"
                        : step.color === "cyan"
                        ? "bg-cyan-400/10"
                        : "bg-purple-400/10"
                    }`}
                  >
                    <step.icon
                      className={`w-5 h-5 ${
                        step.color === "emerald"
                          ? "text-emerald-400"
                          : step.color === "cyan"
                          ? "text-cyan-400"
                          : "text-purple-400"
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-500">{step.subtitle}</p>
                  </div>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
