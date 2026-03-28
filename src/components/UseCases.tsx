"use client";

import { motion } from "framer-motion";
import { User, Users, GraduationCap, Briefcase } from "lucide-react";

const cases = [
  {
    icon: User,
    title: "Solo Developers",
    subtitle: "AI-enhanced pair programming",
    points: [
      "Mind Reader predicts your intent",
      "Shadow Runner tests in the background",
      "Refactoring Agent suggests improvements",
    ],
    color: "emerald",
  },
  {
    icon: Users,
    title: "Remote Teams",
    subtitle: "Seamless collaboration at scale",
    points: [
      "Conflict Guard predicts merge conflicts",
      "Real-time collaborative editing",
      "Orchestrator coordinates all agents",
    ],
    color: "cyan",
  },
  {
    icon: GraduationCap,
    title: "Learning & Education",
    subtitle: "Code visualization and explanation",
    points: [
      "Code Explainer provides instant context",
      "Visualization agents create diagrams",
      "Animated flowcharts for logic flow",
    ],
    color: "purple",
  },
  {
    icon: Briefcase,
    title: "Technical Interviews",
    subtitle: "AI-augmented pair programming sessions",
    points: [
      "Live collaborative coding environment",
      "Real-time code analysis and feedback",
      "Instant visualization of solutions",
    ],
    color: "yellow",
  },
];

const borderColors: Record<string, string> = {
  emerald: "hover:border-emerald-500/20",
  cyan: "hover:border-cyan-500/20",
  purple: "hover:border-purple-500/20",
  yellow: "hover:border-yellow-500/20",
};

const iconBgColors: Record<string, string> = {
  emerald: "bg-emerald-400/10 text-emerald-400",
  cyan: "bg-cyan-400/10 text-cyan-400",
  purple: "bg-purple-400/10 text-purple-400",
  yellow: "bg-yellow-400/10 text-yellow-400",
};

const dotColors: Record<string, string> = {
  emerald: "bg-emerald-400",
  cyan: "bg-cyan-400",
  purple: "bg-purple-400",
  yellow: "bg-yellow-400",
};

export default function UseCases() {
  return (
    <section id="use-cases" className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-sm text-emerald-400 font-medium mb-4 tracking-wider uppercase">
            Use Cases
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Perfect for{" "}
            <span className="gradient-text">everyone.</span>
          </h2>
          <p className="mt-6 text-gray-400 max-w-xl mx-auto">
            From solo developers to distributed teams, Parachute adapts to your
            workflow with intelligent agents that understand context.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`glass rounded-xl p-6 transition-all ${borderColors[c.color]}`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${iconBgColors[c.color]}`}
              >
                <c.icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {c.title}
              </h3>
              <p className="text-xs text-gray-500 mb-4">{c.subtitle}</p>
              <ul className="space-y-2">
                {c.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-sm text-gray-400"
                  >
                    <span
                      className={`w-1 h-1 rounded-full mt-2 shrink-0 ${dotColors[c.color]}`}
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
