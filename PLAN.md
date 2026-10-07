# Modulo: Holes — Plan

A minimal, premium game hub with juicy, data-driven games. Next.js (App Router) + R3F + Rapier.

## Folder structure

```
app/                     Next.js routes (hub, per-game screens, settings)
  page.tsx               Home hub — game cards
  play/[gameId]/         Game menu → mode setup → play (all client-side)
  settings/              Settings screen
components/ui/           UI kit: Button, Card, Sheet, Stars, AnimatedNumber, Toggle, Segmented…
config/tuning.ts         ALL feel constants (physics, juice, camera, audio) in one place
engine/
  physics/               Rapier loader + fixed-step world wrapper (time scale, hit-stop aware)
  camera/                Camera rig: smooth follow, orbit, zoom, punch, shake (trauma)
  input/                 Pointer/touch gesture helpers (drag-to-aim, orbit, pinch)
  audio/                 Procedural WebAudio SFX + generative music
  juice/                 Juice bus: shake, hit-stop, slow-mo, haptics, particles, popups
  save/                  Versioned localStorage save system (progress, settings, bests)
  render/                Shared Canvas wrapper: adaptive quality, post-processing, lights
  rng.ts, math.ts        Seeded RNG (daily challenge), helpers
games/
  types.ts               GameModule interface
  registry.ts            Register games here — adding a game = one line
  golf/                  Golf module (courses as data, builder, scene, HUD, rules)
  billiards/             Billiards module (2D ball solver, 8/9-ball rules, AI, trick shots)
scripts/verify-courses.ts  Headless Rapier check that every golf hole is solvable
```

## Milestones (vertical slices) — all complete ✅

1. **Setup + hub + engine** — Next/Tailwind/TS/ESLint, design tokens (dark/light), fonts, hub cards,
   GameModule registry, save system, settings, audio, juice bus, canvas wrapper. ✅ build + lint.
2. **One polished golf hole** — data-driven hole builder (floors w/ real cup, rails, ramps), drag-to-shoot
   with power/trajectory preview (bends at first bounce), follow camera + hole zoom, full celebration juice.
3. **All golf elements + 27 holes** — ramps/jumps, half-pipes, loops, bumpers, boost/bounce pads,
   moving & tilting platforms, windmills, spinners, teleporters, sand, ice, water, conveyors, one-way gates,
   bridges, coins. 3 worlds × 9 holes. Modes: Campaign, Quick Round, Daily, Pass-and-play.
4. **Billiards** — custom sliding/rolling 2D ball solver w/ english, 8-ball & 9-ball rules, AI (3 levels),
   local 2P, trick-shot puzzles, ghost-ball preview, pull-back power, spin selector.
5. **Progression** — stars unlock worlds, ball skins & table themes unlocked via stars/wins.
6. **Polish + perf** — adaptive quality (DPR/shadows/bloom), transitions, results screens, README.

After each milestone: `npm run build && npm run lint`, fix everything before moving on.

## Key decisions
- Golf uses Rapier (trimesh floors with `FIX_INTERNAL_EDGES`, kinematic movers, contact hooks for one-way gates).
- Billiards uses a dedicated analytic 2D solver (sliding→rolling friction, spin, cushion english) inside the
  engine layer: general rigid-body engines don't model cue-ball spin/rolling well, and the AI needs fast,
  deterministic look-ahead simulation.
- All SFX/music are synthesized with WebAudio at runtime — zero audio assets, zero licensing concerns.
