"use client";
import { motion } from "framer-motion";

const BALLS = [
  { x: 210, y: 100, c: "#ffd400" },
  { x: 226, y: 91, c: "#1f4fd8" },
  { x: 226, y: 109, c: "#e53935" },
  { x: 242, y: 82, c: "#6a1b9a" },
  { x: 242, y: 100, c: "#111111" },
  { x: 242, y: 118, c: "#ff7a00" },
];

/** Animated hub-card illustration: felt, rack, and a cue ball breaking. */
export function BilliardsThumbnail({ active = true }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="b-felt" cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#2aa37a" />
          <stop offset="1" stopColor="#0b5c47" />
        </radialGradient>
        <radialGradient id="b-shine" cx="0.35" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill="#3a2414" />
      <rect x="18" y="18" width="284" height="164" rx="14" fill="#5a3820" />
      <rect x="30" y="30" width="260" height="140" rx="6" fill="url(#b-felt)" />
      {[
        [30, 30],
        [160, 26],
        [290, 30],
        [30, 170],
        [160, 174],
        [290, 170],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="#0a0a0a" />
      ))}
      <line x1="95" y1="30" x2="95" y2="170" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.5" />
      {BALLS.map((b, i) => (
        <motion.g
          key={i}
          animate={active ? { x: [0, 0, (i % 3) * 14 - 8 + i * 3, (i % 3) * 14 - 8 + i * 3], y: [0, 0, (i % 2 ? 1 : -1) * (10 + i * 4), (i % 2 ? 1 : -1) * (10 + i * 4)] } : undefined}
          transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.38, 0.6, 1], ease: "easeOut" }}
        >
          <circle cx={b.x} cy={b.y} r="8.5" fill={b.c} />
          <circle cx={b.x} cy={b.y} r="3.4" fill="#fff" opacity="0.9" />
          <circle cx={b.x} cy={b.y} r="8.5" fill="url(#b-shine)" />
        </motion.g>
      ))}
      <motion.g animate={active ? { x: [0, 110, 104, 104] } : undefined} transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.38, 0.5, 1], ease: "easeIn" }}>
        <circle cx="90" cy="100" r="8.5" fill="#fbfbf5" />
        <circle cx="90" cy="100" r="8.5" fill="url(#b-shine)" />
      </motion.g>
      <motion.g animate={active ? { x: [-10, 18, 18, -10], opacity: [1, 1, 0, 0] } : undefined} transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.3, 0.45, 1] }}>
        <rect x="-20" y="98" width="96" height="4" rx="2" fill="#e8c48a" />
        <rect x="70" y="98" width="6" height="4" rx="1" fill="#2b6cb0" />
      </motion.g>
    </svg>
  );
}
