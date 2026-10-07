"use client";
import { AnimatePresence, motion } from "framer-motion";
import { usePopups, type PopupStyle } from "./popups";

const STYLE: Record<PopupStyle, string> = {
  hero: "text-6xl sm:text-8xl font-display font-bold tracking-tight",
  big: "text-4xl sm:text-6xl font-display font-bold",
  small: "text-xl sm:text-2xl font-display font-semibold",
  bad: "text-3xl sm:text-4xl font-display font-bold",
  coin: "text-2xl font-display font-bold",
};

/** HTML overlay for juicy floating text ("HOLE IN ONE!", "+1", combo streaks…). */
export function PopupLayer() {
  const popups = usePopups((s) => s.popups);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {popups.map((p) => (
          <motion.div
            key={p.id}
            className="absolute left-0 right-0 flex flex-col items-center text-center"
            style={{ top: `${p.y ?? 30}%`, left: p.x !== undefined ? `${p.x - 50}%` : 0 }}
            initial={{ opacity: 0, scale: 0.3, y: 30, rotate: p.style === "hero" ? -8 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: p.style === "hero" ? -3 : 0 }}
            exit={{ opacity: 0, scale: 1.25, y: -50, transition: { duration: 0.35 } }}
            transition={{ type: "spring", stiffness: 520, damping: p.style === "hero" ? 11 : 17 }}
          >
            <span
              className={`${STYLE[p.style]} drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] [-webkit-text-stroke:2px_rgba(0,0,0,0.15)]`}
              style={{ color: p.color ?? (p.style === "bad" ? "#ff6b6b" : "#ffffff"), textShadow: "0 6px 30px rgba(0,0,0,0.35)" }}
            >
              {p.text}
            </span>
            {p.sub && (
              <motion.span
                className="mt-1 font-display text-lg font-semibold text-white/90 drop-shadow"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}
              >
                {p.sub}
              </motion.span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
