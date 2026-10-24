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

Eat letters on a real webpage while ghosts emerge from buttons. Every six fresh letters spawns an orb nearby; collect it to stop new ghosts and eat existing ones. Power lasts six seconds and stacks to at most nine. Glitch fruit appears periodically. When power ends, gates reopen and spawning accelerates with each 22-second wave. Three lives; survive for a high score.

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
npm install github:coded-dot-design/byte-runner#v0.2.0
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

A page with no factories uses edge spawns. Only visible, unclipped factories spawn enemies. Use **G** or **Next gate** to travel to another section; ordinary scrolling remains available.

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

Arrows/WASD: move in four directions. When holding two directions, the last pressed direction wins. Touch devices receive a D-pad. Eat six new letters to create an orb, then move to the orb to activate it.

**P** pauses/resumes. **G** jumps to a gate. **Escape** or **Recall** exits and restores the page. The HUD can be folded. Focusing a form field pauses play; modifier shortcuts and typing are not captured. Theme follows the system unless overridden. Reduced-motion preference removes particles and decorative pulses.

## Develop and verify

```sh
npm run typecheck
npm test
npm run build
npm run size
npm run playground:build
```

`src/simulation.ts` owns gameplay. `src/rules.ts` owns balance constants. `src/index.ts` exposes the factory. The engine, shared entity pools, factory selection and React lifecycle adapter are maintained once in DOM VIRUS. All engine and game implementation sources use strict TypeScript. Generated declarations preserve game-specific snapshot fields and ship with the package; the browser receives plain JavaScript. This repository includes a generated, versioned `shared/core.js` snapshot with its source fingerprint in `shared/ORIGIN.json`; do not edit that generated file. Builds use the snapshot, so this repo works independently. A sibling `dom-virus` checkout enables live source iteration in Vite. To refresh the engine snapshot, run `npm run sync:games` in that checkout, then rebuild this game. A game build never silently replaces its pinned snapshot. A runtime update never silently changes a released game.

The regular distribution is budgeted below **18 KB gzip including its runtime**. Runtime entities and geometry work are capped. Tests and Vite never ship in the package. See [shared performance notes](https://github.com/coded-dot-design/dom-virus/blob/main/PERFORMANCE.md) and [reference study](https://github.com/coded-dot-design/dom-virus/blob/main/REFERENCES.md).

## First-cut support

Modern browsers with Canvas 2D, Shadow DOM and Intl.Segmenter. CSS Highlights are optional and only fade already-mutated digits. Text replacement and Recall work without that API. Cross-origin frames and closed shadow roots are outside the board. Choose a content root and exclusions carefully for framework-driven or frequently changing pages.

MIT © 2026 Chris Cooley. Original character artwork is procedural and included under the same license.

## Version tags

After checks pass on `main`, CI creates the tag matching `package.json` (for example `v0.2.0`) if it does not already exist. Existing tags never move. Bump the package version for the next release.
