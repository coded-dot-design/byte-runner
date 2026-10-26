# Byte Runner: Phase 1 handoff

## Start here (for agents)

Byte Runner (`@coded-design/byte-runner`, `0.10.2`, MIT) is a maze chase that plays on a live web
page: a pixel frog runs pellet "pipes" routed through the page's whitespace, eats letters as bonus
food and hunts flies. It is an engine game on a DOM VIRUS engine snapshot (`0.21.0`), the only one
with a 4-way stick and no Fire, and is cartridge 04 on the hub. Ecosystem context is in the hub
[HANDOFF.md](https://github.com/coded-dot-design/dom-virus/blob/main/HANDOFF.md); next steps are in
[FUTURE.md](FUTURE.md). Play: https://coded-dot-design.github.io/dom-virus/games/byte-runner/

| Task | Where |
|---|---|
| Levels, flies, power, tongue, scoring, reflow | `src/simulation.ts` |
| Whitespace routing, trails, pellets | `src/maze.ts` |
| Pipe running, queued turns, tongue reach | `src/movement.ts` |
| SVG maze, food and actor nodes, twinkle | `src/presentation.ts` |
| Frog/fly pixel art (game and hub artwork) | `src/art.ts`; frames in `src/animation.ts` |
| Food regrow rules; fly cap and power timings | `src/food.ts`; `src/rules.ts` |
| Actions, touch mode, hint | `src/index.ts` |
| Hub page copy and controls list | `site/game.json` (`site/art.json` is generated) |
| Engine, touch kit, HUD, audio | not here: `dom-virus/src`, then `npm run sync:games` |
| Size budget | `scripts/size.mjs` |

**Invariants**

- Never edit `shared/` by hand. Change `dom-virus/src`, run `npm run sync:games` there, rebuild.
  CI fails on any drift in `dist/` or `shared/`.
- Never hand-edit `site/art.json`; `npm run build` regenerates it from `src/art.ts`.
- A release bumps `package.json`, both top-level version fields in `package-lock.json` and
  `CHANGELOG.md` together, with the rebuilt `dist/` and `site/art.json`. CI tags `v<version>`;
  update the hub pin in `dom-virus/games.json` only after the tag exists.
- Any button you add follows the 3D press rule (top over a hard base; hover lifts the top, press
  lands exactly on the base, selected stays pressed, no overshoot, no `scale()`).
- Hot paths move only transforms, opacity and existing SVG attributes; no layout reads per frame.
  The maze is rebuilt only on scroll, resize, a new wave or Refresh, never by its own writes.
- Respect reduced motion (the food twinkle stops under `api.reducedMotion`).
- Mobile must stay smooth. Keep `touch.stick: "4way"`; 8-way flickers at maze corners.
- Size headroom is under 1 KB: measure before adding code.

**Verify before you push**

```sh
npm ci                  # Node 24 (.nvmrc); engines >= 22.23.4
npm run check           # typecheck, unit tests, build (+ art.json), package types
npm run size            # fails above 30,000 B gzip per file
npm run playground:build
git status              # dist/ and site/art.json must be committed and match the build
# Browser tests (touch, pipes, whitespace) live in the hub and use this sibling checkout:
cd ../dom-virus && CHROMIUM_PATH=/path/to/chrome npm run test:browser
```

## 1. The game

Follow the pellet trail, grab a power square (flies turn blue for 6 s, stacking to 9 s), catch
vulnerable flies with the tongue (54 px reach), eat every pellet once to clear the level. Jump out
of a pipe to eat real letters, then touch another trail to reattach. Eaten food regrows (12 s
pellets, 20 s power) as a bonus that never resets level progress. Up to 12 flies (Chaser,
Interceptor, Roamer) and an optional bonus fruit.

## 2. How it uses the DOM

- **The UI is the maze.** Visible text, controls and media are occupied terrain; pipes route
  through the whitespace around them. Soft edges are an SVG mask, so junctions have no crossbars.
- **Letters are optional food**: eating one writes `0`/`1` into the Text node; they do not regrow
  until Recall.
- **Buttons are gates**; their native liquid fill shows remaining power time.
- The maze, food and actors are SVG nodes inside the real page root, so native scrolling carries
  them.

## 3. Architecture

`src/index.ts` calls `createArcade` with the Jump (Space) and Refresh (M) actions,
`touch: { stick: "4way", primary: "jump" }` and forced `controls: "keyboard"`; `src/react.ts`
wraps it with `createGameComponent`. `shared/` (`core.js`, `react.js`, `types/`,
`build-game.mjs`, `ORIGIN.json` with version and SHA-256) is the engine snapshot.
`scripts/build.mjs` runs `shared/build-game.mjs` then `scripts/build-art.ts`. The repo hosts no
site: `pages.yml` deploys a redirect to the hub page.

## 4. Controls

- **Keyboard:** arrows/WASD choose a direction (turns queue at junctions); Space or a quick
  double-tap of a direction jumps out; M refresh maze, P pause, G next area, Esc Recall.
- **Mobile:** the shared engine touch kit in 4-way mode (dominant axis with hysteresis), Jump as the
  large round primary button (acts on press), Refresh maze as a secondary arcade button. No Fire.

## 5. Performance

Presentation updates are quantized on the simulation clock (food twinkle at 8 steps per second,
stable per-pellet phases), with no CSS timers or extra animation frames. Refills reuse the same SVG
nodes; reflow keeps fly identities and wing phases. Routing is bounded (≤420 food nodes, ≤12
flies; past the line budget a native parent is blocked conservatively). A cheap viewport identity
ignores animated text, buttons and the game's own mutations.

## 6. Size

Budget 30,000 B gzip each for `dist/index.js` and `dist/react.js`. At 0.10.2: 29,160 B and
29,244 B gzip (75,624 / 75,809 B raw), the largest engine game. Raised from 28 KB in 0.10.2.

## 7. Release

CI (`check.yml`): typecheck, test, build, test:package, size, playground:build,
`git diff --exit-code -- dist shared`; then `tag-version` tags `v<package.version>` on `main` once.
Unit tests: `animation`, `food`, `maze`, `movement`, `rules`, plus type tests. The hub's hourly
build already follows the newest tag in the pinned major line; the pin is the reproducible record.

## 8. On the hub

Cartridge **04**, accent lime, "DOM CHASE". One action: PRESS START, then the screen morphs into
`/games/byte-runner/`. "TEST A RELEASE" offers `v0.2.0`.

## 9. Lessons and pitfalls

- A temporarily occluded root must not count as a cleared level.
- Scroll or resize must never score or refill a level; food is redistributed, not re-earned.
- A deliberate second press breaks out of a pipe; key repeat or a held direction must not.
- Project onto pipe edges, not endpoints, so catching a pipe never skips food.
- Flies may hop between trails but must stay inside the visible playfield.
- `MAX_GHOSTS` (`src/rules.ts`) caps flies at 12 (it was 8 until 0.7.0).

## Keeping this file current

Update HANDOFF.md and FUTURE.md as part of any change that alters behaviour, architecture or
workflow. Every repo in the ecosystem keeps both files.
