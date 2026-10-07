"use client";
import { motion } from "framer-motion";
import { Lock, Play, Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { SetupProps } from "@/games/types";
import { Button, Segmented, Stars, TopBar } from "@/components/ui";
import { useMounted } from "@/engine/save/useMounted";
import { sfx } from "@/engine/audio/audio";
import { todayKey } from "@/engine/rng";
import { WORLDS } from "../courses";
import { useGolfSave, totalStars, totalCoins } from "../save";
import { SKINS, skinUnlocked } from "../skins";
import { dailyHoles, PLAYER_COLORS } from "../play/round";
import { formatToPar } from "../scoring";
import { ballTextureCss } from "./ballCss";

export default function GolfSetup({ entryId, onStart, onBack }: SetupProps) {
  const mounted = useMounted();
  if (!mounted) return null;
  if (entryId === "daily") return <DailySetup onStart={onStart} onBack={onBack} />;
  if (entryId === "party") return <PartySetup onStart={onStart} onBack={onBack} />;
  return <CampaignSetup onStart={onStart} onBack={onBack} />;
}

type P = Pick<SetupProps, "onStart" | "onBack">;

function CampaignSetup({ onStart, onBack }: P) {
  const holes = useGolfSave((s) => s.holes);
  const last = useGolfSave((s) => s.last);
  const stars = totalStars(holes);
  const [worldId, setWorldId] = useState(last?.world ?? "meadow");
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const worldLocked = world.unlockStars > stars;
  const worldStars = world.holes.reduce((a, h) => a + (holes[h.id]?.stars ?? 0), 0);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl pb-12">
      <TopBar onBack={onBack} title="Campaign" subtitle={`${stars} ★ collected`} />
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:px-6">
        {WORLDS.map((w) => {
          const locked = w.unlockStars > stars;
          const sel = w.id === worldId;
          return (
            <motion.button
              key={w.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                sfx.play("tap");
                setWorldId(w.id);
              }}
              className={`relative min-w-[200px] flex-1 snap-start overflow-hidden rounded-[24px] p-4 text-left text-white shadow-soft transition-transform ${sel ? "ring-4 ring-accent/70" : "opacity-85"}`}
              style={{ background: `linear-gradient(140deg, ${w.theme.skyTop}, ${w.theme.grass})` }}
            >
              <div className="text-3xl">{w.emoji}</div>
              <div className="mt-2 font-display text-xl font-bold drop-shadow">{w.name}</div>
              <div className="text-sm text-white/85 drop-shadow">{locked ? `Unlock with ${w.unlockStars} ★` : w.subtitle}</div>
              {locked && (
                <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[2px]">
                  <Lock size={28} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 px-4 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">{world.name}</h2>
          <span className="text-sm font-semibold text-dim">
            {worldStars}/{world.holes.length * 3} ★
          </span>
        </div>
        {worldLocked ? (
          <div className="rounded-[22px] border border-line bg-surface p-6 text-center text-dim shadow-soft">
            Collect {world.unlockStars - stars} more ★ to unlock {world.name}.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {world.holes.map((h, i) => {
              const rec = holes[h.id];
              const prevDone = i === 0 || !!holes[world.holes[i - 1].id];
              const locked = !prevDone && !rec;
              return (
                <motion.button
                  key={h.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={locked ? undefined : { y: -3 }}
                  whileTap={locked ? { x: [0, -5, 5, 0] } : { scale: 0.94 }}
                  onClick={() => {
                    if (locked) return sfx.play("foul");
                    sfx.play("whoosh");
                    onStart({ world: world.id, hole: String(i) });
                  }}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-[22px] border border-line bg-surface shadow-soft ${locked ? "opacity-50" : ""}`}
                >
                  {h.wow && !locked && <span className="absolute right-2 top-2 rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase text-white">wow</span>}
                  {locked ? (
                    <Lock size={22} className="text-dim" />
                  ) : (
                    <>
                      <div className="font-display text-3xl font-bold">{i + 1}</div>
                      <Stars count={rec?.stars ?? 0} size={15} />
                      <div className="mt-0.5 text-[11px] font-semibold text-dim">{rec ? `Best ${rec.best} · Par ${h.par}` : `Par ${h.par}`}</div>
                      {(h.coins?.length ?? 0) > 0 && (
                        <div className="mt-1 flex gap-0.5">
                          {h.coins!.map((_, ci) => (
                            <span key={ci} className={`h-1.5 w-1.5 rounded-full ${rec?.coins.includes(ci) ? "bg-gold" : "bg-ink/15"}`} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
        <SkinPicker />
      </div>
    </main>
  );
}

function SkinPicker() {
  const holes = useGolfSave((s) => s.holes);
  const skin = useGolfSave((s) => s.skin);
  const setSkin = useGolfSave((s) => s.setSkin);
  const stars = totalStars(holes);
  const coins = totalCoins(holes);
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Ball</h2>
        <span className="text-sm font-semibold text-dim">
          {stars} ★ · {coins} coins
        </span>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {SKINS.map((s) => {
          const ok = skinUnlocked(s, stars, coins);
          const sel = s.id === skin;
          return (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (!ok) return sfx.play("foul");
                sfx.play("unlock");
                setSkin(s.id);
              }}
              className={`flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 ${sel ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
            >
              <div className="relative h-11 w-11 rounded-full shadow-inner" style={{ background: ballTextureCss(s) }}>
                {!ok && (
                  <div className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white">
                    <Lock size={16} />
                  </div>
                )}
                {sel && (
                  <div className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold">{s.name}</div>
              {!ok && <div className="text-[10px] text-dim">{s.unlock.stars ? `${s.unlock.stars} ★` : `${s.unlock.coins} coins`}</div>}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function DailySetup({ onStart, onBack }: P) {
  const date = todayKey();
  const best = useGolfSave((s) => s.daily[date]);
  const holes = dailyHoles(date);
  const par = holes.reduce((a, h) => a + h.hole.par, 0);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl pb-12">
      <TopBar onBack={onBack} title="Daily Challenge" subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
      <div className="px-4 sm:px-6">
        <div className="rounded-[28px] bg-gradient-to-br from-[#ff8a5b] to-[#ff4f9a] p-6 text-white shadow-soft">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Today&apos;s course</div>
          <div className="mt-1 font-display text-4xl font-bold">3 holes · Par {par}</div>
          <div className="mt-1 text-white/90">{best !== undefined ? `Your best today: ${formatToPar(best)}` : "Same holes for everyone, new ones tomorrow."}</div>
        </div>
        <div className="mt-4 space-y-2.5">
          {holes.map((h, i) => (
            <div key={h.hole.id} className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl font-display text-xl font-bold text-white" style={{ background: h.world.theme.accent }}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold">{h.hole.name}</div>
                <div className="text-sm text-dim">
                  {h.world.emoji} {h.world.name} · Par {h.hole.par}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button size="xl" block className="mt-6" sound="whoosh" onClick={() => onStart({ date })}>
          <Play size={22} fill="currentColor" /> Play today&apos;s challenge
        </Button>
      </div>
    </main>
  );
}

function PartySetup({ onStart, onBack }: P) {
  const holes = useGolfSave((s) => s.holes);
  const stars = totalStars(holes);
  const [players, setPlayers] = useState(2);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const [worldId, setWorldId] = useState("meadow");
  const [count, setCount] = useState<"3" | "9">("3");
  const available = WORLDS.filter((w) => w.unlockStars <= stars && w.holes.length > 0);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl pb-12">
      <TopBar onBack={onBack} title="Pass & Play" subtitle="Take turns on one device" />
      <div className="space-y-6 px-4 sm:px-6">
        <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Players</h2>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" aria-label="Fewer players" onClick={() => setPlayers((p) => Math.max(2, p - 1))}>
                <Minus size={16} />
              </Button>
              <span className="w-6 text-center font-display text-2xl font-bold">{players}</span>
              <Button variant="secondary" size="sm" aria-label="More players" onClick={() => setPlayers((p) => Math.min(4, p + 1))}>
                <Plus size={16} />
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: players }, (_, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                <input
                  value={names[i]}
                  maxLength={12}
                  placeholder={`Player ${i + 1}`}
                  onChange={(e) => setNames((n) => n.map((v, j) => (j === i ? e.target.value : v)))}
                  className="h-11 w-full select-text rounded-xl border border-line bg-surface-2 px-3 font-semibold outline-none focus:border-accent"
                />
              </motion.div>
            ))}
          </div>
        </section>
        <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <h2 className="mb-3 font-display text-lg font-bold">Course</h2>
          <Segmented value={worldId} onChange={setWorldId} options={available.map((w) => ({ value: w.id, label: `${w.emoji} ${w.name.split(" ")[0]}` }))} />
          <div className="mt-3">
            <Segmented value={count} onChange={setCount} options={[{ value: "3", label: "3 holes" }, { value: "9", label: "9 holes" }]} />
          </div>
        </section>
        <Button
          size="xl"
          block
          sound="whoosh"
          onClick={() => onStart({ players: String(players), world: worldId, holes: count, names: names.slice(0, players).map((n) => n.trim().replace(/,/g, "")).join(",") })}
        >
          <Play size={22} fill="currentColor" /> Tee off
        </Button>
      </div>
    </main>
  );
}
