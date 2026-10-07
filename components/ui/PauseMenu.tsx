"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Home, Music, Play, RotateCcw, Smartphone, Volume2, VolumeX } from "lucide-react";
import { useSettings } from "@/engine/save/settings";
import { Button } from "./Button";
import { Toggle } from "./Controls";
import { GameCard, overlayBackdrop } from "./GameCard";

/** Shared pause menu with quick audio/haptics toggles. */
export function PauseMenu({ open, onResume, onRestart, onQuit, restartLabel = "Restart hole" }: { open: boolean; onResume: () => void; onRestart: () => void; onQuit: () => void; restartLabel?: string }) {
  const s = useSettings();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={overlayBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onResume} />
          <GameCard className="text-center">
            <div className="font-display text-4xl font-bold">Paused</div>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button size="lg" block onClick={onResume}>
                <Play size={20} fill="currentColor" /> Resume
              </Button>
              <Button variant="glass" size="lg" block onClick={onRestart}>
                <RotateCcw size={20} /> {restartLabel}
              </Button>
              <Button variant="glass" size="lg" block onClick={onQuit} sound="back">
                <Home size={20} /> Quit
              </Button>
            </div>
            <div className="mt-5 space-y-3 rounded-2xl bg-white/[0.06] p-4 text-left">
              <QuickToggle icon={s.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} label="Sound" checked={s.sound} onChange={(v) => s.set({ sound: v })} />
              <QuickToggle icon={<Music size={18} />} label="Music" checked={s.music} onChange={(v) => s.set({ music: v })} />
              <QuickToggle icon={<Smartphone size={18} />} label="Haptics" checked={s.haptics} onChange={(v) => s.set({ haptics: v })} />
            </div>
          </GameCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QuickToggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/70">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
