"use client";
import { motion } from "framer-motion";

/** Dark glass card used for in-game overlays (results, pause, turn hand-off). */
export function GameCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.7, y: 40, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.9, y: 20, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className={`relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/10 bg-[#13151f]/92 p-6 text-white shadow-2xl backdrop-blur-xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

export const overlayBackdrop = "fixed inset-0 z-40 flex items-center justify-center p-4";
