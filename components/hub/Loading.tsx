"use client";
import { motion } from "framer-motion";

export function Loading({ label = "Loading", dark = false }: { label?: string; dark?: boolean }) {
  return (
    <div className={`fixed inset-0 grid place-items-center ${dark ? "bg-[#0c0d13] text-white" : "bg-bg text-ink"}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          <motion.div
            className="absolute left-1/2 top-0 h-6 w-6 -translate-x-1/2 rounded-full bg-accent"
            animate={{ y: [0, 34, 0], scaleY: [1, 0.8, 1], scaleX: [1, 1.2, 1] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute bottom-0 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-current opacity-15" />
        </div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.3em] opacity-60">{label}</p>
      </div>
    </div>
  );
}
