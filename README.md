# Byte Runner · coded.design

## Play and develop the Astro site

Product page: https://coded-dot-design.github.io/byte-runner/ (available after Pages is enabled and the deployment succeeds). Created by **Chris Cooley / coded.design**.

Use Node **24** (`nvm use`), then run from this repository, where `package.json` lives:

```sh
npm ci
npm run dev
```

Open the exact local URL Astro prints, including the `/byte-runner/` base path. `npm ci` uses the committed lockfile. `npm run dev:playground` keeps the original Vite regression playground available. The product site loads built game distributions; after editing game source, run `npm run build` and restart `npm run dev`.

```sh
npm run check
npm run site:build
npm run site:preview
```

`site:build` writes static output to `artifacts/site` and checks the launch script, styles and Pages asset paths. Pages builds run on every push to `main`; PR checks also build the product site. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. No custom domain or paid hosting is required for this public repository. If the deploy job ran before enabling Pages, rerun that failed job afterward.

The page defaults to your system color scheme, with persistent light/dark overrides. Game launches are explicit and lazy-loaded. Recall destroys the active controller and restores eligible game-owned edits. Menu controls, code examples and the launcher are excluded from game targets.



**The page is the game board.** A small, independent MIT-licensed DOM arcade game in the DOM VIRUS collection.

Food trails follow real UI whitespace and gutters, with small pixel squares, larger glowing power squares, and fruit. The round green frog can leave the trails to eat real page letters; only explicitly marked walls and controls block it. Clear food for a 500 × level bonus. Power makes flies edible for six seconds (stacking to nine). Three lives. Up to five flies arrive immediately, building toward nine on the first level and twelve later where space permits.

## Run locally

Node **22.12+** or Node 24, npm, and Git:

```sh
git clone https://github.com/coded-dot-design/byte-runner.git
cd byte-runner
npm ci
npm run dev
```

Open the Vite URL, normally **http://127.0.0.1:5173**, and click **Play**. This repository includes its own fictional test page. To switch between all three games, use the separate [DOM VIRUS playground](https://github.com/coded-dot-design/dom-virus).

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
npm install github:coded-dot-design/byte-runner#v0.5.0
```

```js
import { createByteRunner } from '@coded-design/byte-runner';

const game = createByteRunner(); // generic page defaults
// Call this after mounting and after the player chooses to play:
game.start();
// game.pause(); game.resume(); game.stop(); game.destroy();
```

The npm-compatible package exports its prebuilt self-contained module. You do not need to install DOM VIRUS or any other game at runtime. The package uses this scoped name; npm registry availability is not claimed.

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

Arrows/WASD or the touch D-pad: choose a direction. The frog sticks to the pipe centerline, queues turns, and carries speed around bends. Space / the Jump button or a quick double-tap releases it anywhere; after a short hop, touching another trail reattaches it. M / Refresh maze rebuilds the pipes. Flies occasionally hop between trails but stay inside the viewport. Power lets the red tongue catch vulnerable flies up to 54 pixels ahead. Eat each small and glowing pellet once to clear a level. Eaten food leaves a grey trail and returns after 12 seconds (20 for power); returning food scores without resetting level progress. Real letters do not regenerate. Fruit is optional bonus food, not a power-up.

**P** pauses/resumes. **G** jumps to a gate. **Escape** or **Recall** exits and restores the page. The HUD can be folded. Focusing a form field pauses play; modifier shortcuts and typing are not captured. Theme follows the system unless overridden. Reduced-motion preference removes particles and decorative pulses.

## Develop and verify

```sh
npm run typecheck
npm test
npm run build
npm run size
npm run playground:build
```

`src/simulation.ts` owns gameplay, `src/maze.ts` owns connected corridor generation and movement, and `src/presentation.ts` owns native SVG sprites and food. `src/rules.ts` owns balance constants. `src/index.ts` exposes the factory. The engine, shared entity pools, factory selection and React lifecycle adapter are maintained once in DOM VIRUS. All engine and game implementation sources use strict TypeScript. Generated declarations preserve game-specific snapshot fields and ship with the package; the browser receives plain JavaScript. This repository includes a generated, versioned `shared/core.js` snapshot with its source fingerprint in `shared/ORIGIN.json`; do not edit that generated file. Builds use the snapshot, so this repo works independently. A sibling `dom-virus` checkout enables live source iteration in Vite. To refresh the engine snapshot, run `npm run sync:games` in that checkout, then rebuild this game. A game build never silently replaces its pinned snapshot. A runtime update never silently changes a released game.

The regular distribution is budgeted below **27 KB gzip including its runtime**. Runtime entities and geometry work are capped: at most 952 routing candidates during layout, 420 food nodes, twelve flies and one bonus fruit. Safe text runs, gutter connections, whitespace branches and broad loops become playable trails. The budget includes whitespace routing, native SVG presentation, synthesized sound and shared controls. Tests and Vite never ship in the package. See [shared performance notes](https://github.com/coded-dot-design/dom-virus/blob/main/PERFORMANCE.md) and [reference study](https://github.com/coded-dot-design/dom-virus/blob/main/REFERENCES.md).

## First-cut support

Modern browsers with Canvas 2D, Shadow DOM and Intl.Segmenter. CSS Highlights are optional and only fade already-mutated digits. Text replacement and Recall work without that API. Cross-origin frames and closed shadow roots are outside the board. Choose a content root and exclusions carefully for framework-driven or frequently changing pages.

MIT © 2026 Chris Cooley. Original character artwork is procedural and included under the same license.

## Version tags

After checks pass on `main`, CI creates the tag matching `package.json` (for example `v0.2.0`) if it does not already exist. Existing tags never move. Bump the package version for the next release.

Target beacons now attach to their actual elements. Native layout handles their scrolling, clipping and transforms. Mobile uses stationary rings and stable fills. See the [shared DOM ownership design](https://github.com/coded-dot-design/dom-virus/blob/main/docs/dom-ownership.md).

Frog and fly artwork is owned by `src/art.ts`; builds generate `site/art.json` for the website. The frog combines separate body/mouth, eyes and feet. Its four-frame run advances only on actual movement, with a wider independent chomp while moving or eating. Characters have no outline or protection ring; protection uses a restrained opacity cue. Fly wings use stable individual phases. Reduced motion disables bobbing, foot loops and wing flaps.

### Whitespace trails

Food and soft corridor edges keep clear of visible text, native controls and media. The frog locks to the route centerline until a deliberate jump releases it. Turns queue at junctions and unambiguous bends carry momentum. Flies follow the connected graph with occasional short, viewport-contained escapes to another trail. Maze geometry is stable until scrolling, resizing, a new wave, or an explicit refresh. Vertical frog poses show its eyes and round body without a mouth cutout.

Mark a composite panel with `data-byte-obstacle` to keep food, flies and guide edges around its whole rectangle while the frog remains free to cross it. `data-byte-wall` also blocks the frog.

### Sound and controls

The scoreboard always keeps sound, pause/resume, minimize/expand and Recall in the same order. Sound uses quiet synthesized effects, starts after a real gesture and can be muted. Pause stops active voices; Recall closes audio and restores the page. Mobile movement, Jump and Refresh maze remain available while the scoreboard is minimized.
