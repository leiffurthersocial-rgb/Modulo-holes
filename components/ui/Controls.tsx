"use client";
import { motion } from "framer-motion";
import { sfx } from "@/engine/audio/audio";
import { haptic } from "@/engine/juice/haptics";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        sfx.play("toggle");
        haptic("tick");
        onChange(!checked);
      }}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-good" : "bg-ink/15"}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow"
        style={{ left: checked ? 28 : 4 }}
      />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="relative flex rounded-2xl bg-ink/[0.06] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => {
              sfx.play("toggle");
              haptic("tick");
              onChange(o.value);
            }}
            className={`relative z-10 flex-1 rounded-xl font-display font-semibold transition-colors ${size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-3 py-2"} ${active ? "text-ink" : "text-dim"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join("")}`}
                className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-soft"
                transition={{ type: "spring", stiffness: 600, damping: 35 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      aria-label={label}
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink/10 accent-[var(--accent)]"
    />
  );
}
