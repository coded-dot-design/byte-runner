// Zero allocation, in its own process (node --test runs each file alone), so other tests' mazes
// don't shape what V8 learns about the step: one run, as on a real page.
import test from "node:test";
import assert from "node:assert/strict";
import * as W from "../src/world.ts";
import { makeMaze } from "../src/maze.ts";
import { game, rng, script } from "./fixture.mjs";
import { minorGCs } from "./gc.mjs";

test("a busy run steps without allocating (no minor GC in 20 000 steps)", async () => {
  const t = game({ maze: makeMaze(1200, 800, [], rng(4)), width: 1200, height: 800, letters: [[300, 200], [600, 400]] });
  const each = script(t.w, t.keys), s = t.w.s;
  // Power now and then, and the level never ends (the next maze is a read-phase job), so every
  // step path runs: trails, jumps, landing, hops, hunting, the tongue, hurts.
  const frames = (n) => {
    for (let k = 0; k < n; k++) {
      each(t.w, k);
      if (k % 600 === 0) s[W.POWER] = s[W.SEAL] = 6;
      if (s[W.REGEN] || s[W.TRANSITION] > 0) (s[W.REGEN] = 0), (s[W.TRANSITION] = 0), (s[W.REMAINING] = 50);
      t.e.advance(1 / 60);
    }
  };
  frames(20000); // warm up: the JIT settles (other tests' mazes reshaped the same functions)
  const gcs = await minorGCs(() => frames(20000));
  assert.ok(t.w.flies.count > 0, "flies were out");
  assert.equal(gcs, 0);
});
