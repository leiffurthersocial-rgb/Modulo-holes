/**
 * DartsGame — turn flow for every darts mode, independent of React. The 3D view reads `darts`,
 * `aim` and `phase` every frame; juice is driven by the `events` queue.
 */
import { TUNING } from "@/config/tuning";
import { RING, score, type Hit } from "../sim/board";
import { checkout } from "../sim/checkout";
import { Match, type DartOutcome, type DartsMode } from "../sim/rules";
import { aiThrow, chooseTarget, type AiLevel } from "../sim/ai";
import { targetPoint } from "../sim/board";
import { gauss, resolveFlick, type FlickQuality } from "../sim/throw";
import { CHALLENGES, type Challenge } from "../sim/challenges";

const D = TUNING.darts;

export type DMode = "ai" | "local" | "clock" | "challenge" | "practice";
export type DPhase = "aim" | "flying" | "turnEnd" | "ai" | "over" | "challengeDone";

export interface DPlayer {
  name: string;
  ai: AiLevel | null;
  color: string;
}

export interface ThrownDart {
  id: number;
  owner: number;
  state: "flying" | "stuck" | "bouncing" | "gone";
  /** Board-space landing point. */
  x: number;
  y: number;
  t: number;
  /** Start of flight in world space. */
  from: [number, number, number];
  hit: Hit | null;
  tiltX: number;
  tiltY: number;
  /** Bounce-out velocity/position (world). */
  bp: [number, number, number];
  bv: [number, number, number];
  quiver: number;
}

export type DartsEvent =
  | { type: "throw"; quality: FlickQuality | "ai"; deciding: boolean }
  | { type: "hit"; dart: ThrownDart; outcome: DartOutcome }
  | { type: "bounce"; dart: ThrownDart }
  | { type: "turnEnd"; total: number; bust: boolean; player: number }
  | { type: "legWon"; player: number; checkout: number }
  | { type: "matchWon"; player: number }
  | { type: "challenge"; ok: boolean }
  | { type: "cancel" };

let nextId = 1;

export class DartsGame {
  mode: DMode;
  match: Match;
  players: DPlayer[];
  phase: DPhase = "aim";
  /** Reticle (board space, metres) — human aim or animated AI aim. */
  aim = { x: 0, y: 0.1 };
  holding = false;
  holdTime = 0;
  darts: ThrownDart[] = [];
  events: DartsEvent[] = [];
  challenge: Challenge | null = null;
  attempts = 0;
  challengeHits: Hit[] = [];
  lastQuality: FlickQuality | null = null;
  /** Synchronous listeners (the play screen uses these for overlays & saves). */
  listeners = new Set<(e: DartsEvent) => void>();
  private timer = 0;
  private aiTarget: string | null = null;
  private aiAimFrom = { x: 0, y: 0 };
  private t = 0;
  private flightTime: number = D.flight.time;

  constructor(opts: { mode: DMode; game: DartsMode; start?: number; doubleOut?: boolean; legsToWin?: number; players: DPlayer[]; challengeId?: string }) {
    this.mode = opts.mode;
    this.players = opts.players;
    if (opts.mode === "challenge") this.challenge = CHALLENGES.find((c) => c.id === opts.challengeId) ?? CHALLENGES[0];
    const start = this.challenge?.start ?? opts.start ?? 501;
    const game: DartsMode = this.challenge ? (this.challenge.start ? "x01" : "practice") : opts.game;
    this.match = new Match({ mode: game, start, doubleOut: opts.doubleOut ?? true, legsToWin: opts.legsToWin ?? 1, players: opts.players.length });
    this.beginTurn();
  }

  get current() {
    return this.players[this.match.turn];
  }

  isAiTurn() {
    return !!this.current.ai && this.phase !== "over";
  }

  /** Suggested checkout route for the current player (x01). */
  route(): string[] | null {
    const m = this.match;
    if (m.cfg.mode !== "x01") return null;
    const r = m.remaining[m.turn];
    return r <= 170 ? checkout(r, 3 - m.darts.length, m.cfg.doubleOut) : null;
  }

  /** Is the next dart a potential game-winner? (drives slow-mo) */
  decidingDart() {
    const route = this.route();
    return !!route && route.length === 1;
  }

  private beginTurn() {
    this.holding = false;
    this.holdTime = 0;
    if (this.isAiTurn()) {
      this.phase = "ai";
      this.timer = 0;
      this.aiTarget = null;
    } else this.phase = "aim";
  }

  /** Current hand sway (board metres) — grows when the player holds too long. */
  sway(): [number, number] {
    const s = D.sway;
    const amp = Math.min(s.max, s.base + Math.max(0, this.holdTime - s.steadyTime) * s.growth);
    const t = this.t;
    return [amp * (Math.sin(t * 1.9) + 0.6 * Math.sin(t * 3.7 + 1.3)), amp * (Math.cos(t * 1.5) + 0.5 * Math.sin(t * 4.3 + 0.4))];
  }

  /** Human throw: flick velocity in screen-heights per second (vy > 0 = upward). */
  flick(vx: number, vy: number) {
    if (this.phase !== "aim") return false;
    const [sx, sy] = this.sway();
    const r = resolveFlick(this.aim.x + sx, this.aim.y + sy, vx, vy);
    this.holding = false;
    this.holdTime = 0;
    if (!r) {
      this.emit({ type: "cancel" });
      return false;
    }
    this.lastQuality = r.quality;
    this.launch(r.x, r.y, r.quality);
    return true;
  }

  private launch(x: number, y: number, quality: FlickQuality | "ai") {
    const deciding = this.decidingDart();
    const side = this.match.darts.length - 1;
    this.darts.push({
      id: nextId++,
      owner: this.match.turn,
      state: "flying",
      x,
      y,
      t: 0,
      from: [0.08 + side * 0.03 + x * 0.25, D.boardHeight - 0.26, 0.6],
      hit: null,
      tiltX: 0.12 + gauss(Math.random) * 0.05,
      tiltY: gauss(Math.random) * 0.06,
      bp: [0, 0, 0],
      bv: [0, 0, 0],
      quiver: 0,
    });
    this.phase = "flying";
    this.emit({ type: "throw", quality, deciding });
  }

  update(dt: number, realDt: number) {
    this.t += realDt;
    if (this.holding) this.holdTime += realDt;

    for (const d of this.darts) {
      if (d.state === "flying") {
        d.t += dt;
        if (d.t >= this.flightTime) this.land(d);
      } else if (d.state === "stuck") {
        d.quiver += dt;
      } else if (d.state === "bouncing") {
        d.t += dt;
        d.bv[1] -= 9.8 * dt;
        for (let i = 0; i < 3; i++) d.bp[i] += d.bv[i] * dt;
        if (d.bp[1] < 0.02) d.state = "gone";
      }
    }

    if (this.phase === "turnEnd") {
      this.timer += dt;
      if (this.timer > 1.35) this.finishTurn();
    } else if (this.phase === "ai") this.updateAi(dt);
  }

  private land(d: ThrownDart) {
    let hit = score(d.x, d.y);
    const r = Math.hypot(d.x, d.y);
    // Bounce-outs off the wire (or off the number ring / surround edge).
    const onWire = hit.wireDist < D.bounceOut.wireZone && r < RING.doubleOut + 0.002;
    if (onWire && Math.random() < D.bounceOut.chance) {
      d.state = "bouncing";
      d.bp = [d.x, D.boardHeight + d.y, 0.06];
      d.bv = [(Math.random() - 0.5) * 0.6, 0.6, 1.1];
      d.hit = { ...hit, number: 0, multiplier: 0, points: 0, label: "BOUNCE" };
      hit = d.hit;
      this.emit({ type: "bounce", dart: d });
    } else {
      d.state = "stuck";
      d.quiver = 0;
      d.hit = hit;
    }
    const turnStart = this.match.turnStartRemaining;
    const outcome = this.match.register(hit);
    this.emit({ type: "hit", dart: d, outcome });

    if (this.challenge) {
      this.challengeHits.push(hit);
      const ok = this.challenge.check(this.challengeHits);
      if (ok || this.challengeHits.length >= 3 || outcome.bust) {
        this.attempts++;
        this.phase = ok ? "challengeDone" : "turnEnd";
        this.timer = 0;
        this.emit({ type: "challenge", ok });
        return;
      }
      this.phase = "aim";
      return;
    }

    if (outcome.legWon) {
      this.emit({ type: "legWon", player: this.match.turn, checkout: this.match.cfg.mode === "x01" ? turnStart : 0 });
    }
    if (outcome.matchWon) {
      this.phase = "over";
      this.emit({ type: "matchWon", player: this.match.turn });
      return;
    }
    if (outcome.turnOver) {
      this.phase = "turnEnd";
      this.timer = 0;
      this.emit({ type: "turnEnd", total: outcome.bust ? 0 : outcome.turnTotal, bust: outcome.bust, player: this.match.turn });
    } else this.beginTurn();
  }

  private finishTurn() {
    for (const d of this.darts) d.state = "gone";
    this.darts = [];
    if (this.challenge) {
      // Failed attempt → reset the challenge.
      this.challengeHits = [];
      this.match = new Match({ ...this.match.cfg });
      this.beginTurn();
      return;
    }
    this.match.nextTurn();
    this.beginTurn();
  }

  private updateAi(dt: number) {
    const cfg = D.ai[this.current.ai!];
    this.timer += dt;
    if (!this.aiTarget) {
      if (this.timer < cfg.think) return;
      this.aiTarget = chooseTarget(this.match);
      this.aiAimFrom = { ...this.aim };
      this.timer = 0;
      return;
    }
    // Glide the reticle onto the target, settle, throw.
    const [tx, ty] = targetPoint(this.aiTarget);
    const k = Math.min(1, this.timer / 0.45);
    const e = k * k * (3 - 2 * k);
    this.aim = { x: this.aiAimFrom.x + (tx - this.aiAimFrom.x) * e, y: this.aiAimFrom.y + (ty - this.aiAimFrom.y) * e };
    if (this.timer > 0.7) {
      const [x, y] = aiThrow(this.aiTarget, this.current.ai!);
      this.launch(x, y, "ai");
    }
  }

  private emit(e: DartsEvent) {
    this.events.push(e);
    this.listeners.forEach((l) => l(e));
  }

  /** Restart (rematch / retry challenge). */
  restart() {
    this.darts = [];
    this.challengeHits = [];
    this.match = new Match({ ...this.match.cfg });
    this.beginTurn();
  }

  /** Flight progress 0..1 for a dart. */
  flightProgress(d: ThrownDart) {
    return Math.min(1, d.t / this.flightTime);
  }
}
