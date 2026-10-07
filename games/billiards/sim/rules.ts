/**
 * 8-ball and 9-ball rules (WPA-style, simplified where noted):
 *  8-ball: open table after the break; first legally pocketed ball assigns groups; you must hit
 *  your group first, and something must be pocketed or hit a rail after contact. Clear your group,
 *  then sink the 8. Sinking the 8 early or with a foul loses. 8 on the break is re-spotted.
 *  9-ball: always hit the lowest ball first; sink the 9 legally (any time) to win.
 *  Fouls give the opponent ball-in-hand (behind the head string after a break scratch).
 */
import type { SimResult } from "./physics";
import { isSolid, isStripe } from "./racks";

export type RuleSet = "8ball" | "9ball" | "practice";
export type Group = "solids" | "stripes";

export interface RulesState {
  rules: RuleSet;
  turn: 0 | 1;
  groups: [Group | null, Group | null];
  breakShot: boolean;
  ballInHand: boolean;
  /** Ball in hand restricted to the kitchen (behind the head string). */
  kitchen: boolean;
  winner: 0 | 1 | null;
  /** Object balls still on the table. */
  onTable: number[];
}

export interface Verdict {
  state: RulesState;
  foul: string | null;
  /** Did the shooter keep the table? */
  continues: boolean;
  /** Short announcement for the HUD ("Solids!", "Foul: scratch"). */
  message: string | null;
  respot: number[];
  gameOver: boolean;
  /** Balls the shooter legally pocketed this shot. */
  scored: number[];
}

export function initialState(rules: RuleSet, objectBalls: number[], firstTurn: 0 | 1 = 0): RulesState {
  return { rules, turn: firstTurn, groups: [null, null], breakShot: rules !== "practice", ballInHand: rules !== "practice", kitchen: rules !== "practice", winner: null, onTable: objectBalls };
}

const groupOf = (id: number): Group | null => (isSolid(id) ? "solids" : isStripe(id) ? "stripes" : null);

/** Which balls may legally be hit first. */
export function legalTargets(s: RulesState): number[] {
  if (s.rules === "practice") return s.onTable;
  if (s.rules === "9ball") return s.onTable.length ? [Math.min(...s.onTable)] : [];
  const g = s.groups[s.turn];
  if (!g) return s.onTable.filter((b) => b !== 8);
  const mine = s.onTable.filter((b) => groupOf(b) === g);
  return mine.length ? mine : [8];
}

export function isOnEight(s: RulesState, player: 0 | 1) {
  const g = s.groups[player];
  return s.rules === "8ball" && !!g && !s.onTable.some((b) => groupOf(b) === g);
}

export function judge(prev: RulesState, r: SimResult): Verdict {
  const s: RulesState = { ...prev, groups: [...prev.groups] as RulesState["groups"], onTable: prev.onTable.filter((b) => !r.pocketed.includes(b)) };
  const shooter = prev.turn;
  const other = (1 - shooter) as 0 | 1;
  const scratch = r.pocketed.includes(0);
  const objPotted = r.pocketed.filter((b) => b !== 0);
  const respot: number[] = [];
  let foul: string | null = null;
  let message: string | null = null;
  s.breakShot = false;
  s.ballInHand = false;
  s.kitchen = false;

  if (prev.rules === "practice") {
    if (scratch) {
      s.ballInHand = true;
      message = "Scratch — place the cue ball";
    }
    return { state: s, foul: null, continues: true, message, respot, gameOver: false, scored: objPotted };
  }

  const legal = legalTargets(prev);
  if (r.firstHit === null) foul = "No ball hit";
  else if (!legal.includes(r.firstHit)) foul = prev.rules === "9ball" ? `Must hit the ${legal[0]} first` : r.firstHit === 8 ? "Hit the 8 first" : "Wrong ball first";
  else if (!prev.breakShot && objPotted.length === 0 && !r.railAfterContact) foul = "No rail after contact";
  if (scratch) foul = "Scratch";

  if (prev.rules === "9ball") {
    if (objPotted.includes(9)) {
      if (foul) {
        respot.push(9);
        s.onTable.push(9);
      } else {
        s.winner = shooter;
        return { state: s, foul: null, continues: false, message: "Nine-ball!", respot, gameOver: true, scored: objPotted };
      }
    }
    const continues = !foul && objPotted.length > 0;
    if (foul) {
      s.turn = other;
      s.ballInHand = true;
      message = `Foul: ${foul}`;
    } else if (!continues) s.turn = other;
    return { state: s, foul, continues, message, respot, gameOver: false, scored: foul ? [] : objPotted };
  }

  // ---- 8-ball ----
  if (objPotted.includes(8)) {
    if (prev.breakShot) {
      // 8 on the break: re-spot.
      respot.push(8);
      s.onTable.push(8);
      message = "8 on the break — re-spotted";
    } else if (isOnEight(prev, shooter) && !foul) {
      s.winner = shooter;
      return { state: s, foul: null, continues: false, message: "Eight-ball!", respot, gameOver: true, scored: objPotted };
    } else {
      s.winner = other;
      return { state: s, foul: foul ?? "Early 8", continues: false, message: foul ? "Sank the 8 on a foul" : "Sank the 8 too early", respot, gameOver: true, scored: [] };
    }
  }

  const scoredObjs = objPotted.filter((b) => b !== 8);
  // Assign groups on an open table after a legal pot (not on the break).
  if (!foul && !prev.breakShot && !prev.groups[shooter] && scoredObjs.length) {
    const g = groupOf(scoredObjs[0])!;
    s.groups[shooter] = g;
    s.groups[other] = g === "solids" ? "stripes" : "solids";
    message = g === "solids" ? "Solids!" : "Stripes!";
  }
  const myGroup = s.groups[shooter];
  const mine = myGroup ? scoredObjs.filter((b) => groupOf(b) === myGroup) : scoredObjs;
  const continues = !foul && (prev.breakShot ? scoredObjs.length > 0 : mine.length > 0);

  if (foul) {
    s.turn = other;
    s.ballInHand = true;
    s.kitchen = prev.breakShot && scratch;
    message = `Foul: ${foul}`;
  } else if (!continues) s.turn = other;

  return { state: s, foul, continues, message, respot, gameOver: false, scored: foul ? [] : mine };
}
