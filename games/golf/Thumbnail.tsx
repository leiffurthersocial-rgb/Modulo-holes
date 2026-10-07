"use client";
import { motion } from "framer-motion";

/** Animated hub-card illustration: rolling hills, a flag and a ball rolling to the cup. */
export function GolfThumbnail({ active = true }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3ff" />
          <stop offset="1" stopColor="#d9f3ff" />
        </linearGradient>
        <linearGradient id="g-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7bd35a" />
          <stop offset="1" stopColor="#4caf50" />
        </linearGradient>
        <linearGradient id="g-hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fc46a" />
          <stop offset="1" stopColor="#2f9a5b" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#g-sky)" />
      <motion.g animate={active ? { x: [0, 14, 0] } : undefined} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}>
        <ellipse cx="60" cy="40" rx="26" ry="10" fill="#fff" opacity="0.9" />
        <ellipse cx="80" cy="36" rx="18" ry="9" fill="#fff" opacity="0.9" />
        <ellipse cx="240" cy="28" rx="22" ry="8" fill="#fff" opacity="0.8" />
      </motion.g>
      <path d="M0 120 Q80 70 170 110 T320 95 V200 H0Z" fill="url(#g-hill2)" />
      <path d="M0 150 Q100 105 200 140 T320 130 V200 H0Z" fill="url(#g-hill)" />
      {/* Fairway stripes */}
      <path d="M0 175 Q120 140 320 160 V200 H0Z" fill="#8fe06a" opacity="0.6" />
      {/* Cup + flag */}
      <ellipse cx="240" cy="158" rx="11" ry="4" fill="#1d1d1d" />
      <rect x="239" y="96" width="2.6" height="62" rx="1.3" fill="#fff" />
      <motion.path
        d="M241.5 97 L272 106 L241.5 116 Z"
        fill="#ff4d5e"
        animate={active ? { d: ["M241.5 97 L272 106 L241.5 116 Z", "M241.5 97 L270 108 L241.5 116 Z", "M241.5 97 L272 106 L241.5 116 Z"] } : undefined}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      {/* Windmill */}
      <g transform="translate(110 108)">
        <path d="M-12 30 L-8 -6 L8 -6 L12 30Z" fill="#fff4e3" />
        <path d="M-12 -6 L0 -18 L12 -6Z" fill="#ff5d73" />
        <motion.g animate={active ? { rotate: 360 } : undefined} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
          {[0, 90, 180, 270].map((r) => (
            <rect key={r} x="-2" y="-30" width="4" height="26" rx="2" fill="#fff" transform={`rotate(${r})`} />
          ))}
        </motion.g>
      </g>
      {/* Ball */}
      <motion.g
        animate={active ? { x: [0, 150, 150], y: [0, -8, 0], opacity: [1, 1, 0] } : undefined}
        transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.85, 1], ease: "easeOut", repeatDelay: 0.6 }}
      >
        <circle cx="90" cy="162" r="6.5" fill="#fff" stroke="rgba(0,0,0,0.12)" />
        <ellipse cx="90" cy="169" rx="6" ry="1.6" fill="#000" opacity="0.15" />
      </motion.g>
    </svg>
  );
}
