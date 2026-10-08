"use client";
import { motion } from "framer-motion";

const SECT = Array.from({ length: 20 }, (_, i) => i);

/** Animated hub-card illustration: brick wall, board, and darts thudding in. */
export function DartsThumbnail({ active = true }: { active?: boolean }) {
  const cx = 160, cy = 100;
  const wedge = (r0: number, r1: number, i: number) => {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180, a1 = ((i * 18 + 9 - 90) * Math.PI) / 180;
    const p = (r: number, a: number) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
    return `M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
  };
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="d-light" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#ffe2b0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill="#5e2c1d" />
      {Array.from({ length: 10 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) => <rect key={`${r}-${c}`} x={c * 44 + (r % 2) * 22 - 20} y={r * 20} width="40" height="17" rx="2" fill="#7a3b28" opacity={0.7 + ((r * 7 + c * 3) % 5) * 0.06} />),
      )}
      <rect width="320" height="200" fill="url(#d-light)" />
      <circle cx={cx} cy={cy} r="74" fill="#111" />
      {SECT.map((i) => (
        <g key={i}>
          <path d={wedge(9, 34, i)} fill={i % 2 ? "#efe1bd" : "#1b1a18"} />
          <path d={wedge(34, 38, i)} fill={i % 2 ? "#14803c" : "#cf2a2a"} />
          <path d={wedge(38, 57, i)} fill={i % 2 ? "#efe1bd" : "#1b1a18"} />
          <path d={wedge(57, 62, i)} fill={i % 2 ? "#14803c" : "#cf2a2a"} />
        </g>
      ))}
      <circle cx={cx} cy={cy} r="9" fill="#14803c" />
      <circle cx={cx} cy={cy} r="4" fill="#cf2a2a" />
      {[
        { x: 160, y: 64, d: 0 },
        { x: 152, y: 66, d: 0.6 },
        { x: 167, y: 63, d: 1.2 },
      ].map((dart, i) => (
        <motion.g
          key={i}
          initial={false}
          animate={active ? { x: [120, 0, 0, 0], y: [140, 0, 0, 0], opacity: [0, 1, 1, 0] } : undefined}
          transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.08, 0.9, 1], delay: dart.d, ease: "easeOut" }}
        >
          <line x1={dart.x} y1={dart.y} x2={dart.x + 18} y2={dart.y + 22} stroke="#9aa0a8" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${dart.x + 16} ${dart.y + 19} l10 4 l-2 10 l-10 -4z`} fill="#ff5d5d" />
        </motion.g>
      ))}
    </svg>
  );
}
