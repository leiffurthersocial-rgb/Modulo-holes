"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Volume2, Music, Smartphone, Gauge, Hand, Moon, Trash2 } from "lucide-react";
import { Button, Segmented, Sheet, Slider, Toggle, TopBar } from "@/components/ui";
import { useSettings, type Quality, type ThemePref } from "@/engine/save/settings";
import { wipeAllSaves } from "@/engine/save/storage";
import { useMounted } from "@/engine/save/useMounted";

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06] text-ink">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-display font-semibold">{title}</div>
        {sub && <div className="text-sm text-dim">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const s = useSettings();
  const mounted = useMounted();
  const [confirm, setConfirm] = useState(false);
  if (!mounted) return null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl pb-12">
      <TopBar title="Settings" onBack={() => router.back()} />
      <div className="space-y-6 px-4 sm:px-6">
        <section className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-soft">
          <Row icon={<Volume2 size={20} />} title="Sound effects">
            <Toggle label="Sound effects" checked={s.sound} onChange={(v) => s.set({ sound: v })} />
            {s.sound && (
              <div className="w-full pl-14">
                <Slider label="Sound volume" value={s.sfxVolume} onChange={(v) => s.set({ sfxVolume: v })} />
              </div>
            )}
          </Row>
          <Row icon={<Music size={20} />} title="Music" sub="Generated live, never repeats">
            <Toggle label="Music" checked={s.music} onChange={(v) => s.set({ music: v })} />
            {s.music && (
              <div className="w-full pl-14">
                <Slider label="Music volume" value={s.musicVolume} onChange={(v) => s.set({ musicVolume: v })} />
              </div>
            )}
          </Row>
          <Row icon={<Smartphone size={20} />} title="Haptics" sub="Vibration on supported devices">
            <Toggle label="Haptics" checked={s.haptics} onChange={(v) => s.set({ haptics: v })} />
          </Row>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-soft">
          <Row icon={<Gauge size={20} />} title="Graphics quality" sub={s.quality === "auto" ? `Auto (currently ${s.autoQuality})` : "Lower = smoother on older phones"}>
            <div className="w-full">
              <Segmented<Quality>
                value={s.quality}
                onChange={(v) => s.set({ quality: v })}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Med" },
                  { value: "high", label: "High" },
                ]}
              />
            </div>
          </Row>
          <Row icon={<Moon size={20} />} title="Theme">
            <div className="w-full">
              <Segmented<ThemePref>
                value={s.theme}
                onChange={(v) => s.set({ theme: v })}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
          </Row>
          <Row icon={<Hand size={20} />} title="Left-handed UI" sub="Mirror in-game controls">
            <Toggle label="Left-handed UI" checked={s.leftHanded} onChange={(v) => s.set({ leftHanded: v })} />
          </Row>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-soft">
          <Row icon={<Trash2 size={20} />} title="Reset progress" sub="Erase stars, scores and unlocks">
            <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
              Reset
            </Button>
          </Row>
        </section>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <h3 className="font-display text-2xl font-bold">Erase everything?</h3>
        <p className="mt-2 text-dim">All stars, best scores and unlocks will be gone for good.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" block onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button
            block
            className="!bg-bad"
            onClick={() => {
              wipeAllSaves();
              window.location.replace(window.location.origin);
            }}
          >
            Erase
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
