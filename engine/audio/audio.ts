"use client";
/**
 * Procedural audio engine — every sound is synthesised with WebAudio at runtime,
 * so the project ships zero audio assets.
 *
 * Usage: `sfx.play("putt", { intensity: 0.7 })`. The AudioContext is created lazily and
 * unlocked on the first user gesture (browsers block autoplay).
 */
import { TUNING } from "@/config/tuning";
import { getSettings, useSettings } from "@/engine/save/settings";

export type SfxName =
  | "tap"
  | "back"
  | "whoosh"
  | "toggle"
  | "putt"
  | "bounce"
  | "rail"
  | "cupRattle"
  | "cupDrop"
  | "splash"
  | "coin"
  | "boost"
  | "bumper"
  | "boing"
  | "teleport"
  | "gate"
  | "star"
  | "fanfare"
  | "bigFanfare"
  | "tick"
  | "aim"
  | "cueStrike"
  | "ballClick"
  | "cushion"
  | "pocket"
  | "foul"
  | "unlock"
  | "countUp"
  | "dartThrow"
  | "dartHit"
  | "dartWire"
  | "dartWall"
  | "crowd"
  | "crowdSmall";

export interface PlayOpts {
  /** 0..1 — scales volume and often pitch/brightness. */
  intensity?: number;
  /** Semitone offset. */
  pitch?: number;
  /** Stereo pan -1..1 */
  pan?: number;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  private musicStop: (() => void) | null = null;
  private currentMood: MusicMood | null = null;

  /** Must be called from a user gesture at least once. Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = TUNING.audio.masterVolume;
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(comp).connect(this.ctx.destination);
      this.noiseBuf = this.makeNoise();
      this.applySettings();
      useSettings.subscribe(() => this.applySettings());
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.currentMood && !this.musicStop) this.startMusic(this.currentMood);
  }

  private applySettings() {
    if (!this.ctx) return;
    const s = getSettings();
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(s.sound ? TUNING.audio.sfxVolume * s.sfxVolume : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music ? TUNING.audio.musicVolume * s.musicVolume : 0, t, 0.2);
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- primitive voices ----------

  private out(pan = 0): AudioNode {
    const ctx = this.ctx!;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(this.sfxBus);
      return p;
    }
    return this.sfxBus;
  }

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      vol?: number;
      attack?: number;
      glideTo?: number;
      delay?: number;
      dest?: AudioNode;
      bus?: AudioNode;
    } = {},
  ) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), t0 + dur);
    const vol = opts.vol ?? 0.3;
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(opts.dest ?? opts.bus ?? this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(
    dur: number,
    opts: {
      vol?: number;
      filter?: BiquadFilterType;
      freq?: number;
      freqTo?: number;
      q?: number;
      delay?: number;
      attack?: number;
      dest?: AudioNode;
    } = {},
  ) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter ?? "bandpass";
    f.frequency.setValueAtTime(opts.freq ?? 1000, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(opts.dest ?? this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  // ---------- public ----------

  play(name: SfxName, o: PlayOpts = {}) {
    if (!this.ctx || this.ctx.state !== "running" || !getSettings().sound) return;
    // Throttle identical sounds so physics chatter doesn't machine-gun.
    const now = performance.now();
    const minGap = name === "ballClick" || name === "rail" || name === "bounce" ? 28 : 12;
    if (now - (this.lastPlayed.get(name) ?? 0) < minGap) return;
    this.lastPlayed.set(name, now);

    const k = Math.max(0, Math.min(1, o.intensity ?? 1));
    const p = Math.pow(2, (o.pitch ?? 0) / 12);
    const dest = this.out(o.pan ?? 0);
    const T = (f: number, d: number, x: Parameters<AudioEngine["tone"]>[2] = {}) =>
      this.tone(f * p, d, { dest, ...x });
    const N = (d: number, x: Parameters<AudioEngine["noise"]>[1] = {}) => this.noise(d, { dest, ...x });

    switch (name) {
      case "tap":
        T(880, 0.06, { type: "triangle", vol: 0.16 });
        T(1320, 0.05, { type: "sine", vol: 0.08, delay: 0.01 });
        break;
      case "back":
        T(660, 0.07, { type: "triangle", vol: 0.14, glideTo: 440 });
        break;
      case "toggle":
        T(1040, 0.05, { type: "square", vol: 0.05 });
        break;
      case "whoosh":
        N(0.32, { filter: "bandpass", freq: 400, freqTo: 2400, q: 0.8, vol: 0.12 * (0.4 + k), attack: 0.12 });
        break;
      case "aim":
        T(300 + k * 700, 0.04, { type: "sine", vol: 0.04 });
        break;
      case "tick":
        T(1800, 0.025, { type: "square", vol: 0.04 });
        break;
      case "putt":
        // Woody "tock": short resonant body + click transient.
        N(0.03, { filter: "highpass", freq: 3000, vol: 0.25 * (0.4 + k) });
        T(520 + k * 180, 0.12, { type: "sine", vol: 0.32 * (0.4 + k), glideTo: 300 });
        T(1250, 0.05, { type: "triangle", vol: 0.12 * k });
        break;
      case "bounce":
        T(160 + k * 80, 0.12, { type: "sine", vol: 0.28 * k, glideTo: 80 });
        N(0.05, { filter: "lowpass", freq: 900, vol: 0.12 * k });
        break;
      case "rail":
        T(240 + k * 120, 0.09, { type: "triangle", vol: 0.24 * k, glideTo: 160 });
        N(0.04, { filter: "bandpass", freq: 2500, q: 2, vol: 0.12 * k });
        break;
      case "cupRattle":
        for (let i = 0; i < 4; i++) T(900 + Math.random() * 600, 0.05, { type: "triangle", vol: 0.1, delay: i * 0.05 });
        break;
      case "cupDrop":
        T(340, 0.18, { type: "sine", vol: 0.35, glideTo: 180 });
        T(880, 0.05, { type: "triangle", vol: 0.12, delay: 0.09 });
        T(660, 0.05, { type: "triangle", vol: 0.1, delay: 0.16 });
        break;
      case "splash":
        N(0.6, { filter: "lowpass", freq: 2600, freqTo: 300, vol: 0.35, attack: 0.01 });
        N(0.25, { filter: "bandpass", freq: 900, q: 3, vol: 0.15, delay: 0.05 });
        T(120, 0.3, { type: "sine", vol: 0.2, glideTo: 60 });
        break;
      case "coin":
        T(1318, 0.09, { type: "square", vol: 0.07 });
        T(1975, 0.22, { type: "square", vol: 0.07, delay: 0.07 });
        T(2637, 0.16, { type: "sine", vol: 0.06, delay: 0.07 });
        break;
      case "boost":
        N(0.45, { filter: "bandpass", freq: 300, freqTo: 3500, q: 1.2, vol: 0.22, attack: 0.02 });
        T(220, 0.4, { type: "sawtooth", vol: 0.06, glideTo: 880 });
        break;
      case "bumper":
        T(520, 0.18, { type: "square", vol: 0.12 * (0.5 + k), glideTo: 1040 });
        T(260, 0.2, { type: "sine", vol: 0.25 * (0.5 + k) });
        break;
      case "boing":
        T(180, 0.35, { type: "sine", vol: 0.32, glideTo: 620 });
        T(360, 0.3, { type: "triangle", vol: 0.08, glideTo: 1240 });
        break;
      case "teleport":
        T(300, 0.35, { type: "sine", vol: 0.2, glideTo: 2400 });
        T(2400, 0.3, { type: "sine", vol: 0.12, glideTo: 600, delay: 0.18 });
        N(0.4, { filter: "highpass", freq: 4000, vol: 0.05 });
        break;
      case "gate":
        T(700, 0.06, { type: "triangle", vol: 0.12, glideTo: 500 });
        break;
      case "star":
        T(880 * Math.pow(2, (o.pitch ?? 0) / 12), 0.25, { type: "triangle", vol: 0.16 });
        T(1760 * Math.pow(2, (o.pitch ?? 0) / 12), 0.25, { type: "sine", vol: 0.08, delay: 0.02 });
        break;
      case "countUp":
        T(1200 + k * 800, 0.03, { type: "sine", vol: 0.05 });
        break;
      case "fanfare": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => T(f, 0.28, { type: "triangle", vol: 0.14, delay: i * 0.08 }));
        T(1046.5, 0.6, { type: "sine", vol: 0.1, delay: 0.32 });
        break;
      }
      case "bigFanfare": {
        const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
        seq.forEach((f, i) => {
          T(f, 0.32, { type: "triangle", vol: 0.15, delay: i * 0.07 });
          T(f / 2, 0.32, { type: "square", vol: 0.04, delay: i * 0.07 });
        });
        [1046.5, 1318.5, 1568].forEach((f) => T(f, 1.1, { type: "sine", vol: 0.09, delay: 0.45, attack: 0.05 }));
        N(1.2, { filter: "highpass", freq: 6000, vol: 0.05, delay: 0.42, attack: 0.1 });
        break;
      }
      case "unlock":
        [784, 988, 1175, 1568].forEach((f, i) => T(f, 0.3, { type: "triangle", vol: 0.13, delay: i * 0.06 }));
        break;
      case "cueStrike":
        N(0.025, { filter: "highpass", freq: 2500, vol: 0.3 * (0.3 + k) });
        T(300, 0.06, { type: "sine", vol: 0.25 * (0.3 + k), glideTo: 180 });
        break;
      case "ballClick":
        // Phenolic resin click: very short, bright, pitch rises with impact.
        T(2600 + k * 1600, 0.035, { type: "sine", vol: 0.45 * k });
        T(5200 + k * 1800, 0.02, { type: "sine", vol: 0.12 * k });
        N(0.012, { filter: "highpass", freq: 5000, vol: 0.2 * k });
        break;
      case "cushion":
        T(140, 0.1, { type: "sine", vol: 0.3 * k, glideTo: 90 });
        N(0.05, { filter: "lowpass", freq: 600, vol: 0.18 * k });
        break;
      case "pocket":
        T(200, 0.16, { type: "sine", vol: 0.3, glideTo: 110 });
        N(0.12, { filter: "lowpass", freq: 700, vol: 0.2 });
        T(1600, 0.05, { type: "triangle", vol: 0.05, delay: 0.12 });
        T(1300, 0.05, { type: "triangle", vol: 0.04, delay: 0.2 });
        break;
      case "dartThrow":
        N(0.22, { filter: "bandpass", freq: 900, freqTo: 3200, q: 1.4, vol: 0.12 * (0.5 + k), attack: 0.03 });
        T(1600 + k * 400, 0.12, { type: "sine", vol: 0.02, glideTo: 900 });
        break;
      case "dartHit":
        // Sisal "thunk": a dull body + short fibrous crunch; trebles/bulls add a bright ping via pitch.
        T(150 + k * 40, 0.14, { type: "sine", vol: 0.42, glideTo: 70 });
        N(0.06, { filter: "lowpass", freq: 1400, vol: 0.32 });
        N(0.025, { filter: "bandpass", freq: 3200, q: 2, vol: 0.12 });
        if ((o.pitch ?? 0) > 0) T(1800 * Math.pow(2, (o.pitch ?? 0) / 12), 0.25, { type: "sine", vol: 0.06, delay: 0.02 });
        break;
      case "dartWire":
        T(3400, 0.18, { type: "triangle", vol: 0.12, glideTo: 2900 });
        T(5100, 0.12, { type: "sine", vol: 0.06 });
        N(0.03, { filter: "highpass", freq: 4000, vol: 0.12 });
        break;
      case "dartWall":
        T(95, 0.18, { type: "sine", vol: 0.35, glideTo: 55 });
        N(0.09, { filter: "lowpass", freq: 600, vol: 0.25 });
        break;
      case "crowd":
      case "crowdSmall": {
        // Crowd roar: layered band-passed noise swells plus a scatter of claps.
        const big = name === "crowd";
        const dur = big ? 2.6 : 1.3;
        N(dur, { filter: "bandpass", freq: 700, q: 0.6, vol: big ? 0.22 : 0.1, attack: 0.25 });
        N(dur * 0.9, { filter: "bandpass", freq: 1800, q: 0.8, vol: big ? 0.12 : 0.05, attack: 0.3 });
        for (let i = 0; i < (big ? 26 : 10); i++) N(0.03, { filter: "bandpass", freq: 1500 + Math.random() * 2000, q: 1.5, vol: 0.06 + Math.random() * 0.06, delay: 0.1 + Math.random() * dur * 0.8 });
        if (big) T(220, 1.6, { type: "sawtooth", vol: 0.015, glideTo: 330, attack: 0.4 });
        break;
      }
      case "foul":
        T(220, 0.22, { type: "sawtooth", vol: 0.08, glideTo: 150 });
        T(165, 0.3, { type: "sawtooth", vol: 0.07, delay: 0.12, glideTo: 110 });
        break;
    }
  }

  // ---------- generative music ----------

  setMood(mood: MusicMood | null) {
    if (mood === this.currentMood) return;
    this.currentMood = mood;
    this.musicStop?.();
    this.musicStop = null;
    if (mood && this.ctx) this.startMusic(mood);
  }

  private startMusic(mood: MusicMood) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const def = MOODS[mood];
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    // Soft echo for space.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = (60 / def.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    bus.connect(this.musicBus);
    bus.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.musicBus);

    const beat = 60 / def.bpm;
    let step = 0;
    let nextTime = ctx.currentTime + 0.15;
    let stopped = false;
    const rand = mulberry(1234);

    const schedule = () => {
      if (stopped) return;
      while (nextTime < ctx.currentTime + 0.4) {
        const bar = Math.floor(step / 8);
        const chord = def.chords[bar % def.chords.length];
        const delayFromNow = nextTime - ctx.currentTime;
        // Pad on bar start.
        if (step % 8 === 0) {
          chord.forEach((n) =>
            this.tone(midi(n), beat * 8, { type: "sine", vol: 0.045, attack: 0.6, delay: delayFromNow, bus }),
          );
          this.tone(midi(chord[0] - 12), beat * 4, { type: "triangle", vol: 0.07, attack: 0.02, delay: delayFromNow, bus });
        }
        if (step % 8 === 4) {
          this.tone(midi(chord[0] - 12 + (def.fifthBass ? 7 : 0)), beat * 3, {
            type: "triangle",
            vol: 0.06,
            attack: 0.02,
            delay: delayFromNow,
            bus,
          });
        }
        // Sparse arpeggio / melody.
        if (rand() < def.density) {
          const scale = def.scale;
          const n = chord[0] + 12 + scale[Math.floor(rand() * scale.length)];
          this.tone(midi(n), beat * 0.9, { type: def.lead, vol: 0.035, attack: 0.01, delay: delayFromNow, bus });
        }
        if (def.hats && step % 2 === 1) {
          this.noise(0.04, { filter: "highpass", freq: 7000, vol: 0.018, delay: delayFromNow, dest: bus });
        }
        nextTime += beat / 2;
        step++;
      }
    };
    const id = window.setInterval(schedule, 100);
    schedule();
    this.musicStop = () => {
      stopped = true;
      window.clearInterval(id);
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0, t, 0.3);
      window.setTimeout(() => bus.disconnect(), 2000);
    };
  }
}

export type MusicMood = "hub" | "meadow" | "neon" | "candy" | "lounge" | "pub";

interface MoodDef {
  bpm: number;
  chords: number[][];
  scale: number[];
  density: number;
  lead: OscillatorType;
  hats: boolean;
  fifthBass: boolean;
}

const MOODS: Record<MusicMood, MoodDef> = {
  hub: { bpm: 84, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [62, 65, 69, 72]], scale: [0, 2, 4, 7, 9], density: 0.28, lead: "sine", hats: false, fifthBass: true },
  meadow: { bpm: 96, chords: [[60, 64, 67], [65, 69, 72], [57, 60, 64], [67, 71, 74]], scale: [0, 2, 4, 7, 9, 12], density: 0.35, lead: "triangle", hats: false, fifthBass: true },
  neon: { bpm: 108, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], scale: [0, 3, 5, 7, 10], density: 0.42, lead: "square", hats: true, fifthBass: false },
  candy: { bpm: 112, chords: [[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]], scale: [0, 2, 4, 7, 9, 12, 14], density: 0.4, lead: "triangle", hats: true, fifthBass: true },
  pub: { bpm: 92, chords: [[55, 59, 62, 65], [60, 64, 67, 70], [55, 59, 62, 65], [62, 66, 69, 72]], scale: [0, 3, 5, 6, 7, 10], density: 0.3, lead: "triangle", hats: true, fifthBass: true },
  lounge: { bpm: 76, chords: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 61, 64, 67]], scale: [0, 2, 3, 5, 7, 9, 10], density: 0.3, lead: "sine", hats: true, fifthBass: true },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sfx = new AudioEngine();
