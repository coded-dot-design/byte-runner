# Byte Runner: Future phases

Repo-specific items. The shared roadmap (controls layer, hub performance, hardening, platform) is
the hub [FUTURE.md](https://github.com/coded-dot-design/dom-virus/blob/main/FUTURE.md). Phase 1
state is in [HANDOFF.md](HANDOFF.md). Move items to `CHANGELOG.md` when they ship.

## Phase 2

### Controls layer (shared, top priority)

- Drop the per-game control wiring (`touch: { stick: "4way", primary: "jump" }`, the forced
  `controls: "keyboard"`, the action keys). Declare an intent map instead: `move` (4-way grid),
  `primary: jump`, `secondary: [refresh]`, and let the shared controls layer render keyboard,
  gamepad (D-pad) and touch for each device.
- Make "double-tap a direction to jump" a declared gesture of the layer, so keyboard, stick flicks
  and gamepad get the same rule.
- Swipe-to-turn as an optional mobile layer input (common in maze games), sharing the 4-way
  hysteresis.

### Gameplay

- Per-fly personalities that react to the page (Roamers prefer long text runs, Chasers cut
  through gaps).
- Level themes from the page itself (headings as "boss rooms", lists as ladders).
- A high-score table per page (local only).

### Performance and size

- Win back headroom: the build is 29.2 KB against a 30 KB ceiling. Candidates: shared art paths,
  maze routing helpers, and the controls layer replacing per-game wiring.
- Re-tighten the budget after the controls layer lands.
- Measure maze routing time on long, dense pages and on a low-end Android device.

### Tests

- There is no `simulation.test.mjs` here (unlike the other engine games). Add one for level
  clear, power stacking, tongue catches and reflow without scoring.
- A browser smoke test in this repo (start, run a pipe, jump, eat a letter, Recall), plus 4-way
  stick and Jump on press.

### Accessibility

- Announce level clears and power mode for screen readers.
- Check pellet twinkle and power pulses against reduced motion (twinkle already stops).

### Docs and content cleanup

- `site/game.json` controls still say "touch D-pad"; mobile uses the 4-way stick.

## Phase 3

- Generated mazes as a reusable engine module (whitespace routing is useful to other games).
- Two-player chase (frog versus a player-controlled fly).
- Engine API docs that use Byte Runner as the example of a 4-way, no-fire game.
