"use client";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";
import { sfx } from "@/engine/audio/audio";

/** Number that springs/counts to its new value (with optional tick sounds). */
export function AnimatedNumber({ value, duration = 0.6, ticks = false, className = "", format = (n: number) => String(Math.round(n)) }: { value: number; duration?: number; ticks?: boolean; className?: string; format?: (n: number) => string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    let last = Math.round(mv.get());
    const c = animate(mv, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        const r = Math.round(v);
        if (ticks && r !== last) sfx.play("countUp", { intensity: Math.min(1, Math.abs(r) / 50) });
        last = r;
      },
    });
    return () => c.stop();
  }, [value, duration, ticks, mv]);
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.25 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 14 }}
      className={`inline-block tabular-nums ${className}`}
    >
      {text}
    </motion.span>
  );
}
