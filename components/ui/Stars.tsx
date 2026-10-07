"use client";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { sfx } from "@/engine/audio/audio";

export function StarIcon({ filled, size = 18, className = "" }: { filled: boolean; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3 6.2 20.4l1.2-6.5L2.6 9.4l6.5-.8z"
        fill={filled ? "var(--gold)" : "currentColor"}
        opacity={filled ? 1 : 0.18}
        stroke={filled ? "rgba(0,0,0,0.12)" : "none"}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Row of 3 stars. `animate` pops them in one by one with rising chimes. */
export function Stars({ count, max = 3, size = 18, animate = false, delay = 0 }: { count: number; max?: number; size?: number; animate?: boolean; delay?: number }) {
  useEffect(() => {
    if (!animate) return;
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(window.setTimeout(() => sfx.play("star", { pitch: i * 4 }), (delay + 0.25 + i * 0.22) * 1000));
    }
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [animate, count, delay]);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) =>
        animate ? (
          <motion.span
            key={i}
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 12, delay: delay + 0.25 + i * 0.22 }}
          >
            <StarIcon filled={i < count} size={size} />
          </motion.span>
        ) : (
          <StarIcon key={i} filled={i < count} size={size} />
        ),
      )}
    </div>
  );
}
