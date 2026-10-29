# Byte Runner · coded.design

> **Play it and read about it on DOM Virus:** https://coded-dot-design.github.io/dom-virus/games/byte-runner/ — this README holds the full technical details.

**The page is the game board.** A small, independent MIT-licensed DOM arcade game in the DOM VIRUS collection. Created by **Chris Cooley / coded.design**.

Food trails follow real UI whitespace and gutters, with small pixel squares, larger glowing power squares, and fruit. The round green frog can leave the trails to eat real page letters; only explicitly marked walls and controls block it. Clear food for a 500 × level bonus. Power makes flies edible for six seconds (stacking to nine). Three lives. Up to five flies arrive immediately, building toward nine on the first level and twelve later where space permits.

## Where the game lives

This repository is the game package. The game page lives on the DOM Virus hub at https://coded-dot-design.github.io/dom-virus/games/byte-runner/. This repository's Pages workflow only publishes a redirect to that page; there is no per-game site to build. The hub reads `site/game.json` (page copy) and `site/art.json` (generated frog and fly art) from here and loads the tagged package.

## Run locally

Use Node 24 (see `.nvmrc`), npm and Git:

```sh
git clone https://github.com/coded-dot-design/byte-runner.git
cd byte-runner
npm ci
npm run dev:playground
```

Open the URL Vite prints (normally **http://127.0.0.1:5173**) and click **Play**. The playground in `playground/` is a fictional test page; it does not ship in the package.

## Embed without a build system

Copy this repository's `dist/index.js` into your website assets. It contains the complete runtime, with no network imports, images, fonts, or third-party runtime dependency:

```html
<button id="play-game" data-virus-ignore>Play Byte Runner</button>
<script type="module">
  let game;
  document.querySelector('#play-game').addEventListener('click', async () => {
    const { createByteRunner } = await import('/games/byte-runner/index.js');
    game?.destroy();
    game = createByteRunner();
    game.start();
  });
</script>
```

The import is deferred until the player clicks. Keep the MIT license with redistributed code. No npm registry publication is required for this approach.

## npm-compatible install

```sh
npm install github:coded-dot-design/byte-runner#v1.0.0
```

```js
import { createByteRunner } from '@coded-design/byte-runner';

const game = createByteRunner(); // generic page defaults
// Call this after mounting and after the player chooses to play:
game.start();
// game.pause(); game.resume(); game.stop(); game.destroy();
```

The npm-compatible package exports its prebuilt self-contained module (Fizlet is bundled). You do not need to install Fizlet, DOM VIRUS or any other game at runtime. The package uses this scoped name; npm registry availability is not claimed.

## Configure the board

```js
const game = createByteRunner({
  root: 'main',
  textSelector: '[data-virus-text]',
  targetSelector: '[data-virus-target]',
  excludeSelector: '[data-virus-ignore]',
  theme: 'system',
  onState: snapshot => console.log(snapshot.status, snapshot.score),
});
```

With no config, the root is `document.body`; text defaults to h1–h6, p, li, blockquote, and `[data-virus-text]`; targets default to buttons, `[role="button"]`, `a.button`, `a.btn`, and `[data-virus-target]`. Explicit selectors replace those defaults. `root` accepts an element or a CSS selector. Forms, editable fields, dialogs, code, live regions, and game controls remain excluded. Add `data-virus-ignore` to any container you want protected.

Hits replace characters in the existing DOM Text nodes with literal 0 or 1. There are no canvas replacement letters, cloned text, or per-letter wrappers. The ownership ledger records the original and latest game-written value per node. Recall restores only still-owned values; newer host edits win. Changing a proportional-font letter into a digit can reflow text, so the bounded geometry cache is invalidated and refreshed.

Flies spawn on reachable corridors far from the player and route through the same maze. Use **G** or **Next gate** to travel to another section; ordinary scrolling remains available. SVG food and sprites are attached inside the selected HTML root, so they follow native scrolling and transforms even while paused. The active board adapts after a viewport change while retaining progress, without awarding points or clearing a level. Explicit walls use `[data-byte-wall]`; no pellets are placed in disconnected regions.

## React

```jsx
import { useMemo } from 'react';
import { ByteRunner } from '@coded-design/byte-runner/react';

function Game({ playing }) {
  const options = useMemo(() => ({ root: 'main', theme: 'system' }), []);
  return <ByteRunner active={playing} options={options} />;
}
```

Set `playing` from a user action. The adapter mounts only in an effect, destroys on unmount, and handles React Strict Mode cleanup. Memoize options; a new options object restarts the game. React is an optional peer dependency; the regular entry is framework-free. Do not import both regular and React controllers for the same active round.

## Controls

Arrows/WASD, or the touch joystick (4-way) on phones: choose a direction. The frog sticks to the pipe centerline, queues turns, and carries speed around bends. Space / the Jump button or a quick double-tap releases it anywhere; after a short hop, touching another trail reattaches it. M / Refresh maze rebuilds the pipes. Flies occasionally hop between trails but stay inside the viewport. Power lets the red tongue catch vulnerable flies up to 54 pixels ahead. Eat each small and glowing pellet once to clear a level. Eaten food leaves a grey trail and returns after 12 seconds (20 for power); returning food scores without resetting level progress. Real letters do not regenerate. Fruit is optional bonus food, not a power-up.

**P** pauses/resumes. **G** jumps to a gate. **Escape** or **Recall** exits and restores the page. The scoreboard can be folded. Typing in a form field stays the page's (keys there never steer), and modifier shortcuts are not captured. While a run is live, a click on the page doesn't follow links. Theme follows the system unless overridden. Reduced-motion preference removes particles and decorative pulses.

## Develop and verify

```sh
npm run check            # typecheck, unit tests, build, package types, vendor check
npm run size             # gzip sizes against the budget
npm run test:browser     # the built package in Chromium (CHROMIUM_PATH picks a binary)
npm run playground:build
```

Byte Runner runs on [Fizlet](https://github.com/coded-dot-design/fizlet), the micro animation and game engine for the DOM. `src/world.ts` owns the rules as one Fizlet system: DOM-free, on typed arrays, so a step never allocates (tested: 20,000 busy steps, no minor GC) and the same seed with the same inputs replays the same run (tested). `src/maze.ts` builds the connected trails from the page's layout in the read phase, and `src/graph.ts` compiles them into fixed arrays with a spatial index of the food for the steps. `src/presentation.ts` owns the native SVG sprites and food. `src/rules.ts` owns balance constants. `src/game.ts` is the game's definition on `fizlet/arcade`, the shell shared with Null Invaders (engine per run, page as the board, scoreboard, keys, touch pad, sound, sparks, popups and the controller). `src/index.ts` exposes the factory. `vendor/fizlet/` is a generated snapshot of Fizlet with its provenance in `vendor/fizlet/ORIGIN.json`; never edit it by hand: change Fizlet, then run `npm run sync` (from a sibling `fizlet` checkout) and rebuild.

`dist/index.js` is **33,711 B gzip** and budgeted at 34,000 B (`npm run size`, `scripts/size.mjs`, fails the build above that); 0.10.2 on the DOM VIRUS core was 29,160 B. The Board UI kit's CSS (keys, readouts, toast, touch pad: the family's one button language) is 2,958 B of it; the same build without that CSS is 30,753 B. Runtime entities and geometry work are capped: at most 952 routing candidates during layout, 420 food nodes, twelve flies and one bonus fruit. Safe text runs, gutter connections, whitespace branches and broad loops become playable trails. Tests and Vite never ship in the package. See the [reference study](https://github.com/coded-dot-design/dom-virus/blob/main/REFERENCES.md).

## First-cut support

Modern browsers with Canvas 2D, Shadow DOM and Intl.Segmenter. CSS Highlights are optional and only color already-mutated digits. Text replacement and Recall work without that API. Cross-origin frames and closed shadow roots are outside the board. Choose a content root and exclusions carefully for framework-driven or frequently changing pages.

MIT © 2026 Chris Cooley. Original character artwork is procedural and included under the same license.

## Version tags

After checks pass on `main`, CI creates the tag matching `package.json` (for example `v1.0.0`) if it does not already exist. Existing tags never move. Bump the package version for the next release.

Gates (the page's buttons) show the power time left as a level inside the button and a beacon ring around it.

Frog and fly artwork is owned by `src/art.ts`; builds generate `site/art.json` for the website. The frog combines separate body/mouth, eyes and feet. Its four-frame run advances only on actual movement, with a wider independent chomp while moving or eating. Characters have no outline or protection ring; protection uses a restrained opacity cue. Fly wings use stable individual phases. Reduced motion disables bobbing, foot loops and wing flaps.

### Whitespace trails

Food and soft corridor edges keep clear of visible text, native controls and media. The frog locks to the route centerline until a deliberate jump releases it. Turns queue at junctions and unambiguous bends carry momentum. Flies follow the connected graph with occasional short, viewport-contained escapes to another trail. Maze geometry is stable until scrolling, resizing, a new wave, or an explicit refresh. Vertical frog poses show its eyes and round body without a mouth cutout.

Mark a composite panel with `data-byte-obstacle` to keep food, flies and guide edges around its whole rectangle while the frog remains free to cross it. `data-byte-wall` also blocks the frog.

### Sound and controls

The scoreboard always keeps sound, pause/resume, minimize/expand and Recall in the same order. Sound uses quiet synthesized effects, starts after a real gesture and can be muted. Pause stops active voices; Recall closes audio and restores the page. Mobile movement, Jump and Refresh maze remain available while the scoreboard is minimized. The touch pad's keys never select text or open callouts.
