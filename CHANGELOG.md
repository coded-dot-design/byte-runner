# 0.3.1

## 0.5.0

- Remove the dark background from native 0/1 highlights while retaining their game color.

- Replace timed free roaming with connected, viewport-filling pellet mazes; native page elements are walls.
- Add glowing power pellets, bonus cherries/strawberries, queued corridor turns and clear-to-advance levels.
- Attach the maze, food and simplified pixel sprites inside the real page root; preserve progress when the active view changes.
- Bound ghosts to eight and increase the complete game budget to 24 KB gzip.

## 0.4.2

- Neon runner and ghost graphics with bright green binary highlights, palette guide, and active keyboard ownership.

## 0.4.1

- Reversible mobile pinch/double-tap zoom lock while playing; native scrolling remains available. Pause and Recall restore the host policy. Set `lockZoom: false` to opt out.

## 0.4.0

- Independent touch D-pad and hold-to-fire controls, compact mobile scoreboard with expanded results, colored native bit highlights, and abstract site previews. Shared engine 0.9.0.

- Adopt engine 0.8.0: native target-attached beacons, quieter mobile fills, fewer board rescans and one reusable collision measurement Range.
- Preserve real text mutation and conditional Recall; pause/cancel native effects with the game lifecycle.

# 0.3.0

- Replace actual DOM text with literal 0/1 on every consumed letter; remove visual-only canvas substitution. Byte Runner leaves binary instead of erased spaces.
- Track original and latest owned Text values for Recall, preserving newer host updates and existing node identity.
- Adopt engine 0.7.0: fewer layout reads for spent text, no binary canvas, optional fading of real digits, and no CSS Highlights requirement.
- Update the integration guide and technical page to describe actual mutation and layout refresh.

# Changelog

## 0.4.3

- Soften the site and game graphics to a flat color palette while retaining native attachments, raised controls and press feedback. Swarm colors remain unchanged.
## 0.2.1 — 2026-10-23

- Add the Astro product/test page, system/light/dark themes, real game descriptions, measured package sizes, architecture diagrams, and creator attribution.
- Add a versioned shared site kit and CI-gated GitHub Pages builds. Commit the Node 24 toolchain and lockfile.
- Remove decorative game HUD shadows. Keep gameplay, colors, sprites, liquid fills and score effects unchanged.
