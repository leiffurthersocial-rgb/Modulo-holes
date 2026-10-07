/**
 * BilliardsGame — turn flow for every billiards mode, independent of React.
 * The view reads balls / aim / phase every frame; the HUD mirrors a small zustand store.
 */
import { TUNING } from "@/config/tuning";
import { mulberry32 } from "@/engine/rng";
import {
  anyMoving,
  cloneBalls,
  HEAD_STRING_X,
  makeBall,
  newResult,
  respot,
  stepBalls,
  strike,
  validPlacement,
  breakChaos,
  type Ball,
  type PhysEvent,
  type SimResult,
} from "../sim/physics";
import { rack8, rack9 } from "../sim/racks";
import { initialState, judge, legalTargets, isOnEight, type RuleSet, type RulesState, type Verdict } from "../sim/rules";
import { planShot, type AiLevel, type AiPlan } from "../sim/ai";
import { TRICK_SHOTS, trickBalls, trickSuccess, type TrickShot } from "../sim/trickshots";

export type BMode = "ai" | "local" | "trick" | "practice";
export type BPhase = "aim" | "rolling" | "ai" | "over" | "trickDone";

export interface PlayerInfo {
  name: string;
  ai: AiLevel | null;
}

export interface ShotOutcome {
  verdict: Verdict | null;
  trickSuccess?: boolean;
  shooter: 0 | 1;
  potted: number[];
}

const DT = TUNING.billiards.physics.dt;

export class BilliardsGame {
  mode: BMode;
  rules: RuleSet;
  players: [PlayerInfo, PlayerInfo];
  balls: Ball[] = [];
  state!: RulesState;
  phase: BPhase = "aim";
  aim = { dx: 1, dz: 0 };
  power = 0;
  spin = { x: 0, y: 0 };
  events: PhysEvent[] = [];
  /** Cue strikes since the view last drained them (power values). */
  strikes: number[] = [];
  result: SimResult = newResult();
  shotTime = 0;
  streak = 0;
  stats = { pots: [0, 0], fouls: [0, 0], bestStreak: 0, shots: 0 };
  trick: TrickShot | null = null;
  attempts = 0;
  /** Seconds since each ball dropped (for the pocket animation). */
  potTimes = new Map<number, number>();
  aiProgress = 0;
  aiStage: "think" | "aim" | "pull" | null = null;
  private aiGen: Generator<number, AiPlan> | null = null;
  private aiPlan: AiPlan | null = null;
  private aiTimer = 0;
  private aiAimFrom = { dx: 1, dz: 0 };
  private acc = 0;
  private rand: () => number;
  private shooter: 0 | 1 = 0;
  winnerAnnounced = false;
  /** Called after every shot resolves. */
  onShotResolved: ((o: ShotOutcome) => void) | null = null;

  constructor(opts: { mode: BMode; rules: RuleSet; players: [PlayerInfo, PlayerInfo]; trickId?: string; seed?: number }) {
    this.mode = opts.mode;
    this.rules = opts.mode === "trick" || opts.mode === "practice" ? "practice" : opts.rules;
    this.players = opts.players;
    this.rand = mulberry32(opts.seed ?? Math.floor(Math.random() * 1e9));
    if (opts.mode === "trick") this.trick = TRICK_SHOTS.find((t) => t.id === opts.trickId) ?? TRICK_SHOTS[0];
    this.reset();
  }

  reset() {
    this.potTimes.clear();
    this.events = [];
    this.streak = 0;
    this.winnerAnnounced = false;
    if (this.trick) {
      this.balls = trickBalls(this.trick);
      this.state = initialState("practice", this.balls.filter((b) => b.id).map((b) => b.id));
      this.state.ballInHand = false;
      this.state.breakShot = false;
      this.aimAtNearest();
      this.phase = "aim";
      return;
    }
    this.balls = this.rules === "9ball" ? rack9(this.rand) : rack8(this.rand);
    const first = (this.stats.shots === 0 ? 0 : Math.round(this.rand())) as 0 | 1;
    this.state = initialState(this.rules, this.balls.filter((b) => b.id).map((b) => b.id), first);
    if (this.mode === "practice") {
      this.state.ballInHand = false;
      this.state.kitchen = false;
      this.state.breakShot = false;
    }
    this.stats = { pots: [0, 0], fouls: [0, 0], bestStreak: 0, shots: 0 };
    this.aimAtNearest();
    this.beginTurn();
  }

  get cue() {
    return this.balls[0];
  }

  get currentPlayer() {
    return this.players[this.state.turn];
  }

  isAiTurn() {
    return this.mode === "ai" && !!this.currentPlayer.ai && this.phase !== "over";
  }

  /** Aim at the nearest legal ball (sensible default each turn). */
  aimAtNearest() {
    const legal = legalTargets(this.state);
    const cue = this.cue;
    let best: Ball | null = null;
    for (const b of this.balls) {
      if (!b.onTable || b.id === 0 || !legal.includes(b.id)) continue;
      if (!best || Math.hypot(b.x - cue.x, b.z - cue.z) < Math.hypot(best.x - cue.x, best.z - cue.z)) best = b;
    }
    if (best) {
      const dx = best.x - cue.x, dz = best.z - cue.z;
      const l = Math.hypot(dx, dz) || 1;
      this.aim = { dx: dx / l, dz: dz / l };
    }
  }

  private beginTurn() {
    if (!this.cue.onTable) {
      // Put the cue ball back so it can be placed.
      Object.assign(this.cue, makeBall(0, HEAD_STRING_X - 0.12, 0));
      this.findFreeCueSpot();
    }
    this.spin = { x: 0, y: 0 };
    this.power = 0;
    if (this.isAiTurn()) {
      this.phase = "ai";
      this.aiStage = "think";
      this.aiProgress = 0;
      this.aiTimer = 0;
      this.aiGen = planShot(cloneBalls(this.balls), { ...this.state }, this.currentPlayer.ai!, this.rand);
      this.aiPlan = null;
    } else {
      this.phase = "aim";
      this.aiStage = null;
    }
  }

  private findFreeCueSpot() {
    const c = this.cue;
    if (validPlacement(this.balls, c.x, c.z, this.state.kitchen)) return;
    for (let r = 0.05; r < 1.2; r += 0.05)
      for (let a = 0; a < Math.PI * 2; a += 0.5) {
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (validPlacement(this.balls, x, z, this.state.kitchen)) {
          c.x = x;
          c.z = z;
          return;
        }
      }
  }

  canPlaceCue() {
    return (this.phase === "aim" && this.state.ballInHand) || (this.mode === "practice" && this.phase === "aim");
  }

  placeCue(x: number, z: number) {
    if (!validPlacement(this.balls, x, z, this.state.kitchen)) return false;
    this.cue.x = x;
    this.cue.z = z;
    this.cue.onTable = true;
    return true;
  }

  shoot(power = this.power) {
    if (this.phase !== "aim" && !(this.phase === "ai" && this.aiStage === "pull")) return false;
    if (power < 0.02) return false;
    this.shooter = this.state.turn;
    this.result = newResult();
    strike(this.cue, { dx: this.aim.dx, dz: this.aim.dz, power, spinX: this.spin.x, spinY: this.spin.y, isBreak: this.state.breakShot });
    this.power = power;
    this.phase = "rolling";
    this.shotTime = 0;
    this.acc = 0;
    this.stats.shots++;
    if (this.trick) this.attempts++;
    this.strikes.push(power);
    return true;
  }

  /** Advance with (time-scaled) dt. */
  update(dt: number) {
    for (const [id, t] of this.potTimes) this.potTimes.set(id, t + dt);
    if (this.phase === "rolling") {
      this.acc += dt;
      this.shotTime += dt;
      let n = 0;
      while (this.acc >= DT && n < 64) {
        breakChaos.active = this.state.breakShot && this.shotTime < 0.5;
        stepBalls(this.balls, DT, this.events, this.result);
        this.acc -= DT;
        n++;
      }
      breakChaos.active = false;
      for (const e of this.events) if (e.type === "pocket") this.potTimes.set(e.ball, 0);
      if (!anyMoving(this.balls) || this.shotTime > 30) this.finishShot();
    } else if (this.phase === "ai") {
      this.updateAi(dt);
    }
  }

  private updateAi(dt: number) {
    const cfg = TUNING.billiards.ai[this.currentPlayer.ai!];
    this.aiTimer += dt;
    if (this.aiStage === "think") {
      // Run the search in small time slices so the frame never hitches.
      const t0 = performance.now();
      while (this.aiGen && !this.aiPlan && performance.now() - t0 < 6) {
        const r = this.aiGen.next();
        if (r.done) this.aiPlan = r.value;
        else this.aiProgress = r.value;
      }
      if (this.aiPlan && this.aiTimer > cfg.thinkTime) {
        if (this.aiPlan.place && !this.placeCue(this.aiPlan.place.x, this.aiPlan.place.z)) this.findFreeCueSpot();
        this.aiStage = "aim";
        this.aiTimer = 0;
        this.aiAimFrom = { ...this.aim };
        this.spin = { x: this.aiPlan.shot.spinX, y: this.aiPlan.shot.spinY };
      }
    } else if (this.aiStage === "aim" && this.aiPlan) {
      const k = Math.min(1, this.aiTimer / 0.7);
      const e = k * k * (3 - 2 * k);
      const a0 = Math.atan2(this.aiAimFrom.dz, this.aiAimFrom.dx);
      let a1 = Math.atan2(this.aiPlan.shot.dz, this.aiPlan.shot.dx);
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2;
      const a = a0 + (a1 - a0) * e;
      this.aim = { dx: Math.cos(a), dz: Math.sin(a) };
      if (k >= 1) {
        this.aiStage = "pull";
        this.aiTimer = 0;
      }
    } else if (this.aiStage === "pull" && this.aiPlan) {
      const k = Math.min(1, this.aiTimer / 0.55);
      this.power = this.aiPlan.shot.power * k;
      if (k >= 1 && this.aiTimer > 0.7) {
        this.aim = { dx: this.aiPlan.shot.dx, dz: this.aiPlan.shot.dz };
        this.shoot(this.aiPlan.shot.power);
        this.aiStage = null;
      }
    }
  }

  private finishShot() {
    const res = this.result;
    const shooter = this.shooter;
    const potted = res.pocketed.filter((b) => b !== 0);

    if (this.trick) {
      const ok = trickSuccess(this.trick, res, this.balls);
      this.phase = "trickDone";
      this.onShotResolved?.({ verdict: null, trickSuccess: ok, shooter, potted });
      return;
    }

    const v = judge(this.state, res);
    for (const id of v.respot) respot(this.balls, this.balls.find((b) => b.id === id)!);
    if (v.foul) this.stats.fouls[shooter]++;
    this.stats.pots[shooter] += v.scored.length;
    this.streak = v.continues && v.scored.length ? this.streak + v.scored.length : 0;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
    this.state = v.state;
    if (this.mode === "practice" && res.pocketed.includes(0)) this.state.ballInHand = true;

    if (v.gameOver) {
      this.phase = "over";
      this.onShotResolved?.({ verdict: v, shooter, potted });
      return;
    }
    this.onShotResolved?.({ verdict: v, shooter, potted });
    this.aimAtNearest();
    this.beginTurn();
  }

  retryTrick() {
    if (!this.trick) return;
    this.balls = trickBalls(this.trick);
    this.potTimes.clear();
    this.phase = "aim";
    this.aimAtNearest();
    this.spin = { x: 0, y: 0 };
  }

  /** Is the given player on the 8 (for the HUD)? */
  onEight(p: 0 | 1) {
    return isOnEight(this.state, p);
  }

  /** The game-deciding ball for slow-mo drama. */
  decidingBall(): number | null {
    if (this.rules === "9ball") return 9;
    if (this.rules === "8ball" && this.onEight(this.state.turn)) return 8;
    return null;
  }
}
