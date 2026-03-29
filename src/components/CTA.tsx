"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section id="waitlist" className="relative py-32">
      <div className="max-w-3xl mx-auto px-6 text-center">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Ready to build{" "}
            <span className="gradient-text">together?</span>
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-10">
            Join the waitlist for early access. Be among the first to experience
            collaborative AI-powered development.
          </p>

          {/* Email form */}
          <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
            />
            <button className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors text-sm">
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-600">
            No spam. We&apos;ll only email you when it&apos;s ready.
          </p>

          {/* Judge preview button */}
          <div className="mt-10 pt-8 border-t border-white/[0.06]">
            <p className="text-sm text-gray-500 mb-4">Are you a judge? Try the live preview.</p>
            <a
              href="/workspace/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-emerald-500/30 text-white font-medium rounded-lg transition-all text-sm"
            >
              Try Live Preview
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
