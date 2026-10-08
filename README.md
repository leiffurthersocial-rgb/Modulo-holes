# Modulo: Holes

A tiny, polished browser game hub with juicy gameplay. Three games so far:

- **Golf**: 27 mini-golf holes across 3 worlds (Sunny Meadow, Neon Night, Candy Land). Loops, windmills, teleporters, half-pipes, conveyors and one-way gates. Modes: Campaign, Quick Round, Daily Challenge and Pass & Play.
- **Billiards**: 8-ball and 9-ball against a 3-level AI or a friend, 10 trick-shot puzzles, and a practice table. Includes spin (english), a ghost-ball aim guide and 7 unlockable table themes.
- **Darts**: 501, 301 and Cricket against a 3-level AI or a friend (single leg or best of 3), Around the Clock, 10 three-dart challenges, and practice. Flick to throw, with bounce-outs, checkout hints, and 180 celebrations. Includes 4 unlockable boards and 5 flight designs.

All visuals, sounds and music are generated at runtime. The repo ships no image or audio assets and needs no API keys or backend. Progress, settings and best scores are stored in `localStorage`.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (static prerender of every route) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (Next core-web-vitals and TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:courses` | Headless Rapier solver that proves every golf hole is completable (pass world or hole ids to limit it) |
| `npm run verify:trickshots` | Brute-force search that proves every billiards trick shot is achievable |
| `npm run selfplay:billiards` | AI-vs-AI games as a smoke test for the rules and AI |
| `npm run verify:darts` | Darts checks: board scoring geometry, every checkout from 2 to 170, challenge plans, the flick model, and AI self-play averages per level |

Requires Node 20 or newer (developed on Node 22).

## Deploy to Vercel

The project needs no configuration on Vercel:

1. Push the repo to GitHub, GitLab or Bitbucket.
2. In Vercel, choose **Add New → Project** and import the repo. The Next.js framework preset is detected automatically.
3. Click **Deploy**. You don't need any environment variables.

Or deploy from the CLI with `npx vercel` (preview) or `npx vercel --prod`.

Every route is statically prerendered, so the site can also be hosted on any static host after `next build`.

## Controls

**Golf**
- Drag back from the ball and release to putt. The pull distance sets power, and the dotted line previews the shot and bends at the first bounce.
- Drag anywhere else to orbit the camera. Pinch or scroll to zoom.
- The map button gives an overview of the whole hole. The ↻ button restarts the hole instantly.

**Billiards**
- Drag on the table to aim. The ghost ball shows the contact point, the yellow line shows where the object ball goes, and the faint line shows the cue ball's deflection.
- Drag down on the **Pull** bar and release to shoot.
- Tap or drag on the cue-ball widget to add follow, draw or side spin (double-tap to reset).
- Use ‹ › to fine-tune the aim. The camera button switches between the overhead view and the cue view.
- With ball in hand, drag the cue ball to place it.

**Darts**
- Hold anywhere to aim. On touch the reticle sits just above your finger and follows it at reduced speed for precision.
- Flick up to throw. A smooth, quick flick flies true, a soft one drops low, an over-hard one sails high, and a sideways flick pulls the dart.
- Don't hold too long: after a moment your hand starts to wobble, and the reticle shows it.
- In x01 the checkout chip suggests a finishing route.

Settings cover sound, music, haptics, graphics quality (auto, low, medium or high), light or dark theme, and left-handed controls, which mirror the in-game HUD.

## Architecture

```
app/                     Next.js App Router routes (hub, game menu, mode setup, play, settings)
components/ui/           UI kit: springy Button, Stars, AnimatedNumber, Toggle, Segmented, Sheet, PauseMenu…
components/hub/          Hub, game menu, setup/play route shells (lazy-load game code)
config/tuning.ts         All feel constants (physics, juice, camera, audio, AI) in one place
engine/
  audio/                 Procedural WebAudio SFX and generative music (moods per world/game)
  juice/                 Time control (hit-stop, slow-mo), trauma screen shake, camera punch,
                         haptics, particle bus and <ParticleSystem/>, popup text layer
  camera/                Camera rig state and <CameraRig/> (smoothing, shake, punch)
  physics/               Lazy Rapier loader and fixed-timestep stepper
  input/                 Unified pointer gestures (drag, pinch, wheel)
  render/GameCanvas.tsx  Shared R3F canvas: adaptive quality, shadows, bloom/vignette/tone mapping
  save/                  Safe localStorage + zustand persistence, settings store
games/
  types.ts               The GameModule interface
  registry.ts            The list of games shown in the hub
  golf/                  courses/ (data), sim/ (builder + GolfSim), view/ (3D), play/ (flow + HUD), setup/
  billiards/             sim/ (physics, rules, AI, trick shots), play/ (3D + HUD + flow), setup/
scripts/                 Headless verifiers (courses, trick shots) and an AI self-play test
```

### Adding a game

1. Create `games/<id>/index.ts` that exports a `GameModule` (see `games/types.ts`). It provides the title, colours, an animated thumbnail, menu entries (modes), how-to-play bullets and a music mood, plus lazy `loadPlay` and optional `loadSetup` imports. It can also provide `quickPlay`, `useProgressLabel` and `useTrophies` hooks for the hub.
2. Add the module to `GAMES` in `games/registry.ts`.

Routes, the hub card, the game menu, quick-play and the trophy strip then work automatically. Game code is code-split, so the hub stays light.

### Golf: data-driven courses

Holes are plain data (`games/golf/courses/*.ts`, schema in `courses/types.ts`). A hole is a list of pieces: `floor` polygons (per-vertex heights make ramps), `halfpipe`, `loop`, `bumper`, `boost`, `bounce`, `conveyor`, `sand`, `ice`, `teleport`, `mover`, `tilt`, `spinner`, `windmill`, `gate`, `block` and `decor`, plus `coins`, the `tee`, the `cup` and `par`.

`games/golf/sim/build.ts` turns pieces into geometry:

- All walkable static geometry (floors, cliff faces, cup, half-pipes, loops) is merged into **one Rapier trimesh**. Vertices are snapped to a grid and use `FIX_INTERNAL_EDGES`, so the ball rolls over seams without bumps. The cup is a real hole cut into the floor.
- Rails are generated along polygon edges, except edges listed in `open`.
- Moving parts are kinematic bodies driven by pure `pose(t)` functions, so the simulation is deterministic.

`GolfSim` uses a frictionless, rotation-locked sphere with CCD and adds its own rolling resistance relative to the ground's surface velocity. That one rule makes moving platforms, tilting decks and conveyor belts carry the ball naturally. Sand and ice are zones that change the resistance. One-way gates use a Rapier contact-filter hook.

`npm run verify:courses` runs a beam search over shots, using Rapier world snapshots, against the real simulation and fails if any hole can't be finished within par + 1.

### Billiards: a dedicated solver

General rigid-body engines don't model the sliding-to-rolling transition of a cue ball, and that transition is where stun, follow and draw come from. Billiards therefore uses a small analytic solver (`games/billiards/sim/physics.ts`):

- Contact-point velocity decays with the classic 7/2 factor, so follow and draw emerge from tip offset.
- Side spin decays independently and bends cushion rebounds.
- Pockets have jaws built from cushion segments with rounded ends.
- The timestep is fixed at 1/960 s, so results are deterministic.

The AI reuses this solver for look-ahead:

1. List ghost-ball pot candidates with clear-path checks.
2. Simulate the best ones at several speeds and spins against the real rules.
3. Reward pots and good cue-ball position, and fall back to a safety.

The search runs as a generator spread across animation frames, so the UI never stutters. Difficulty sets the search breadth and the execution noise.

### Darts: flick throwing

`games/darts/sim/` is pure TypeScript:

- `board.ts`: regulation ring radii, sector order, scoring, and the distance to the nearest wire (used for bounce-outs).
- `rules.ts`: x01 with double-out and busts, Cricket, and Around the Clock.
- `checkout.ts`: fewest-dart routes that prefer the classic doubles.
- `throw.ts`: turns flick speed and angle into an error relative to the aim.
- `ai.ts`: picks targets like a player would (T20, checkout routes, cricket strategy) and throws with a per-level scatter.

The browser gesture code finds where the final upward swipe began, so uneven touch events still measure the flick correctly. The aim snaps back to where it was before the flick started.

### Tuning feel

Every feel constant is in `config/tuning.ts`: shot power curves, rolling resistance per surface, bumper kick, boost speed, cup assist, camera distances, celebration slow-mo, shake decay, billiards friction coefficients, darts flick bands, sway and bounce-out odds, AI noise and more.

## Progression

- **Golf**: stars (3 per hole, based on strokes vs par) unlock worlds: Neon Night at 12★ and Candy Land at 30★. Holes unlock in order. Stars and coins unlock 9 ball skins.
- **Billiards**: wins (including beating the Hustler AI) and trick-shot stars unlock 7 table themes. Trick shots unlock in order.
- **Darts**: wins, 180s, bulls and challenge stars unlock boards (Ally Pally, Neon Arcade, Sugar Rush) and flight designs. Challenges unlock in order.
- The hub shows a trophy strip. Settings can reset all progress.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · three.js via @react-three/fiber and drei · @react-three/postprocessing · Rapier (`@dimforge/rapier3d-compat`) · Zustand · Framer Motion · Lucide icons · Fredoka and Nunito fonts (self-hosted via Fontsource, SIL OFL).
