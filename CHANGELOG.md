# Changelog

## 1.0.0: on Fizlet

The engine cut (DOM VIRUS ENGINE.md E3): Byte Runner runs on Fizlet 0.12.0 instead of the DOM VIRUS core snapshot. Same game, same numbers; the controller API (`createByteRunner`, start/pause/resume/stop/destroy/getSnapshot) and the snapshot fields are unchanged.

- **The rules are one Fizlet system** (`src/world.ts`), DOM-free, on typed arrays: the frog and the flies are actors in fixed arrays, the maze is compiled into a typed graph with a spatial index of the food (`src/graph.ts`), and chase fields reuse preallocated queues. A step never allocates (tested: 20,000 busy steps, no minor GC; `Math.hypot` is out of the step because V8's allocates) and the same seed with the same inputs replays the same run (tested).
- **The trails follow the page in the read phase:** `makeMaze` builds them from the layout every 0.35 s when the view changed, on a new level and on M; the steps never read layout.
- **The shell is `fizlet/arcade`** (Fizlet 0.12.0), shared with Null Invaders: the engine per run, page, overlay, scoreboard, keys, touch pad, sound, sparks, popups and the controller. The SVG trails, food and sprites live inside the page's own root through the arcade's `attach` (ledger-owned, so Recall removes it and puts the root's style back). `src/game.ts` is only the game's definition.
- **Scoreboard in the Board UI kit:** score, level, lives, power, a food meter, Jump / Refresh maze keys, and a comms toast. The phone joystick and the Jump key are the kit's pad: the stick turns by its stronger axis past the kit's 0.15 dead zone (0.10.2's own stick also had a release margin and hysteresis at the corners; the kit pad doesn't). On keys the newest held direction wins, as before.
- **Same seed, new maze:** the engine draws a different random sequence than the 0.10.x core, so a seed gives a different (still repeatable) food layout.
- **Removed:** `shared/` (the core snapshot), the movement and food helper modules (their rules live in `src/world.ts`; their tests moved to `tests/world.test.mjs`), the `targetEffects` and `document` options and the mobile page-wide selection and zoom locks. The touch pad itself never selects text.
- **Size:** `dist/index.js` is 33,694 B gzip (budget 34,000 B); 0.10.2 was 29,160 B. The Board UI kit's CSS is 2,958 B of it: without it the build is 30,736 B (+1,576 B over 0.10.2: the typed-array rules and graph are longer source than the object version, and the shared shell is general).
- **Tests:** rules (movement, catching a trail, jumps, the stick, the tongue, food regrowth, letters, power, level clear, game over, reflow), determinism and zero allocation in Node; the built package in Chromium (trails in the page, eating, links and fields, M, scrolling, pause, Recall restores the page byte for byte, frame time, game over, phone joystick). CI runs on ubuntu-24.04.

## 0.10.2

Mobile: the arrow D-pad becomes the shared analog thumbstick in 4-way mode (dominant axis, no corner flicker) for maze turns. Jump is the large round button and acts on press; Refresh maze is a Battlefield-style secondary button. Uses the dom-virus engine 0.21.0 snapshot; the gzip budget grows by 2 KB for the shared controls.

## 0.9.0

Expand safe whitespace mazes with additional branches and loops. Add synthesized eating, power, pursuit and level cues; adopt the shared scoreboard controls.

## 0.5.0

- Remove the dark background from native 0/1 highlights while retaining their game color.
- Replace timed free roaming with connected, viewport-filling pellet mazes; native page elements are walls.
- Add glowing power pellets, bonus cherries/strawberries, queued corridor turns and clear-to-advance levels.
- Attach the maze, food and simplified pixel sprites inside the real page root; preserve progress when the active view changes.
- Bound ghosts (now flies) to eight and increase the complete game budget to 24 KB gzip. The cap was raised to twelve in 0.7.0 (`MAX_GHOSTS` in `src/rules.ts`).

## 0.4.3

- Soften the site and game graphics to a flat color palette while retaining native attachments, raised controls and press feedback. Swarm colors remain unchanged.

## 0.4.2

- Neon runner and ghost graphics with bright green binary highlights, palette guide, and active keyboard ownership.

## 0.4.1

- Reversible mobile pinch/double-tap zoom lock while playing; native scrolling remains available. Pause and Recall restore the host policy. Set `lockZoom: false` to opt out.

## 0.4.0

- Independent touch D-pad and hold-to-fire controls, compact mobile scoreboard with expanded results, colored native bit highlights, and abstract site previews. Shared engine 0.9.0.

## 0.3.1

- Adopt engine 0.8.0: native target-attached beacons, quieter mobile fills, fewer board rescans and one reusable collision measurement Range.
- Preserve real text mutation and conditional Recall; pause/cancel native effects with the game lifecycle.

## 0.3.0

- Replace actual DOM text with literal 0/1 on every consumed letter; remove visual-only canvas substitution. Byte Runner leaves binary instead of erased spaces.
- Track original and latest owned Text values for Recall, preserving newer host updates and existing node identity.
- Adopt engine 0.7.0: fewer layout reads for spent text, no binary canvas, optional fading of real digits, and no CSS Highlights requirement.
- Update the integration guide and technical page to describe actual mutation and layout refresh.

## 0.2.1

- Add the Astro product/test page, system/light/dark themes, real game descriptions, measured package sizes, architecture diagrams, and creator attribution.
- Add a versioned shared site kit and CI-gated GitHub Pages builds. Commit the Node 24 toolchain and lockfile.
- Remove decorative game HUD shadows. Keep gameplay, colors, sprites, liquid fills and score effects unchanged.
