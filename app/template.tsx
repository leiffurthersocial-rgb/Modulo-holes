"use client";
import { motion } from "framer-motion";

/** Smooth screen transition between routes. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="min-h-dvh"
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
