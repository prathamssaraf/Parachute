import { Hexagon } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Hexagon className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight">
              Para<span className="text-emerald-400">chute</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Docs
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
          </div>

          {/* Copyright */}
          <p className="text-xs text-gray-600">
            &copy; 2026 Parachute. Built at YHack.
          </p>
        </div>
      </div>
    </footer>
  );
}
