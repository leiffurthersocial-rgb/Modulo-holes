/**
 * Darts match rules.
 *  - x01 (301/501): count down to exactly zero; with double-out the last dart must be a
 *    double (bull counts). Going below zero, to 1, or to zero without a double = BUST:
 *    the turn's score is wiped and play passes.
 *  - Cricket: close 15–20 and the bull with 3 marks each (single 1, double 2, treble 3;
 *    outer bull 1, bull 2). Extra marks on a number you've closed score its value while the
 *    opponent still has it open. Close everything with at least as many points to win.
 *  - Around the Clock: hit 1 → 20 then the bull, in order, in as few darts as possible.
 *  - Practice: free scoring.
 */
import type { Hit } from "./board";

export type DartsMode = "x01" | "cricket" | "clock" | "practice";
export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25] as const;

export interface MatchConfig {
  mode: DartsMode;
  start: number;
  doubleOut: boolean;
  legsToWin: number;
  players: number;
}

export interface PlayerStats {
  darts: number;
  points: number;
  tons: number;
  oneEighties: number;
  bulls: number;
  bestTurn: number;
  checkouts: number;
}

export interface DartOutcome {
  hit: Hit;
  /** Points that actually counted. */
  scored: number;
  bust: boolean;
  turnOver: boolean;
  legWon: boolean;
  matchWon: boolean;
  /** Turn total after this dart (0 on bust). */
  turnTotal: number;
  /** Cricket: marks added this dart; Clock: did we advance. */
  marks: number;
  advanced: boolean;
}

const newStats = (): PlayerStats => ({ darts: 0, points: 0, tons: 0, oneEighties: 0, bulls: 0, bestTurn: 0, checkouts: 0 });

export class Match {
  cfg: MatchConfig;
  turn = 0;
  legStarter = 0;
  darts: DartOutcome[] = [];
  remaining: number[];
  turnStartRemaining: number;
  marks: number[][];
  points: number[];
  clockTarget: number[];
  legs: number[];
  winner: number | null = null;
  stats: PlayerStats[];
  totalDarts = 0;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.remaining = Array(cfg.players).fill(cfg.start);
    this.turnStartRemaining = cfg.start;
    this.marks = Array.from({ length: cfg.players }, () => CRICKET_NUMBERS.map(() => 0));
    this.points = Array(cfg.players).fill(0);
    this.clockTarget = Array(cfg.players).fill(1);
    this.legs = Array(cfg.players).fill(0);
    this.stats = Array.from({ length: cfg.players }, newStats);
  }

  get turnTotal() {
    return this.darts.reduce((a, d) => a + d.scored, 0);
  }

  /** Is this player on a finish this turn (x01)? */
  onFinish(p = this.turn) {
    return this.cfg.mode === "x01" && this.remaining[p] <= 170;
  }

  isClosed(p: number, n: number) {
    return this.marks[p][CRICKET_NUMBERS.indexOf(n as (typeof CRICKET_NUMBERS)[number])] >= 3;
  }

  register(hit: Hit): DartOutcome {
    const p = this.turn;
    const st = this.stats[p];
    st.darts++;
    this.totalDarts++;
    if (hit.number === 25) st.bulls++;
    const o: DartOutcome = { hit, scored: 0, bust: false, turnOver: false, legWon: false, matchWon: false, turnTotal: 0, marks: 0, advanced: false };

    switch (this.cfg.mode) {
      case "x01": {
        const left = this.remaining[p] - hit.points;
        const isDouble = hit.multiplier === 2;
        if (left < 0 || (this.cfg.doubleOut && left === 1) || (left === 0 && this.cfg.doubleOut && !isDouble)) {
          o.bust = true;
          // Wipe the turn.
          this.remaining[p] = this.turnStartRemaining;
          o.turnOver = true;
        } else {
          o.scored = hit.points;
          this.remaining[p] = left;
          if (left === 0) {
            o.legWon = true;
            st.checkouts++;
          }
        }
        break;
      }
      case "cricket": {
        const i = CRICKET_NUMBERS.indexOf(hit.number as (typeof CRICKET_NUMBERS)[number]);
        if (i >= 0) {
          let m = hit.number === 25 ? hit.multiplier : hit.multiplier;
          const need = Math.max(0, 3 - this.marks[p][i]);
          const closing = Math.min(need, m);
          this.marks[p][i] += closing;
          o.marks = m;
          m -= closing;
          const othersOpen = this.marks.some((row, q) => q !== p && row[i] < 3);
          if (m > 0 && othersOpen) {
            o.scored = m * (hit.number === 25 ? 25 : hit.number);
            this.points[p] += o.scored;
          }
          if (m > 0 && !othersOpen) this.marks[p][i] += m; // cosmetic
        }
        const allClosed = this.marks[p].every((v) => v >= 3);
        if (allClosed && this.points[p] >= Math.max(...this.points.filter((_, q) => q !== p), 0)) o.legWon = true;
        break;
      }
      case "clock": {
        const t = this.clockTarget[p];
        const hitIt = t === 21 ? hit.number === 25 : hit.number === t;
        if (hitIt) {
          o.advanced = true;
          this.clockTarget[p] = t + 1;
          if (t === 21) o.legWon = true;
        }
        o.scored = hit.points;
        break;
      }
      case "practice":
        o.scored = hit.points;
        break;
    }

    this.darts.push(o);
    o.turnTotal = o.bust ? 0 : this.turnTotal;
    if (this.darts.length >= 3) o.turnOver = true;
    if (o.legWon) {
      o.turnOver = true;
      this.legs[p]++;
      if (this.legs[p] >= this.cfg.legsToWin) {
        o.matchWon = true;
        this.winner = p;
      }
    }
    if (o.turnOver) {
      const total = o.bust ? 0 : this.turnTotal;
      st.points += total;
      st.bestTurn = Math.max(st.bestTurn, total);
      if (total >= 100) st.tons++;
      if (total === 180) st.oneEighties++;
    }
    return o;
  }

  /** Advance to the next player's turn (or the next leg). */
  nextTurn() {
    const last = this.darts[this.darts.length - 1];
    this.darts = [];
    if (last?.legWon && !last.matchWon) {
      this.resetLeg();
      return;
    }
    this.turn = (this.turn + 1) % this.cfg.players;
    this.turnStartRemaining = this.remaining[this.turn];
  }

  private resetLeg() {
    this.remaining = this.remaining.map(() => this.cfg.start);
    this.marks = this.marks.map(() => CRICKET_NUMBERS.map(() => 0));
    this.points = this.points.map(() => 0);
    this.clockTarget = this.clockTarget.map(() => 1);
    this.legStarter = (this.legStarter + 1) % this.cfg.players;
    this.turn = this.legStarter;
    this.turnStartRemaining = this.remaining[this.turn];
  }

  /** 3-dart average for a player. */
  average(p: number) {
    const s = this.stats[p];
    return s.darts ? (s.points / s.darts) * 3 : 0;
  }
}
