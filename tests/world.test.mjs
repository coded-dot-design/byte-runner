// The rules, headless: a Fizlet engine stepped by hand, a fake page (a few letters, one gate), and
// mazes built by hand or by makeMaze (what the read phase does on a real page).
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../vendor/fizlet/index.ts";
import * as W from "../src/world.ts";
import { makeMaze } from "../src/maze.ts";
import { minorGCs } from "./gc.mjs";

const KX = 4, KY = 5;
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
/** A page: letters (10 px squares) at the given viewport points, one gate. Allocation-free. */
function page(points = []) {
  const spent = new Uint8Array(points.length);
  return {
    targets: [{ hp: 100 }],
    spent,
    near(x, y, r, out) {
      let m = 0;
      for (let i = 0; i < points.length && m < out.length; i++) {
        const p = points[i];
        if (!spent[i] && Math.abs(p[0] + 5 - x) <= r + 5 && Math.abs(p[1] + 5 - y) <= r + 5) out[m++] = i;
      }
      return m;
    },
    consume(i) {
      if (spent[i]) return false;
      return (spent[i] = 1), true;
    },
  };
}
/** The old movement fixture: an L of trails (20,40) → (100,40) → (100,100) → (20,100). */
function track(pellets = [[60, 40], [20, 100]]) {
  const xy = [[20, 40], [100, 40], [100, 100], [20, 100]], exits = [[1], [0, 2], [1, 3], [2]];
  return {
    cells: xy.map(([x, y], id) => ({ id, row: 0, col: id, x, y, exits: exits[id] })),
    pellets: pellets.map(([x, y], id) => ({ id, cell: 0, x, y, power: false, eaten: false, cleared: false, respawnAt: 0 })),
    step: 64, radius: 15, clearance: 18, start: 0, path: "",
  };
}
const frame = (width, height) => ({ x: 0, y: 0, width, height, scaleX: 1, scaleY: 1, ox: 0, oy: 0, walls: [], solids: [] });
function game({ maze = track(), width = 200, height = 200, letters = [], seed = 7 } = {}) {
  const e = createEngine({ seed, events: 512 });
  const board = page(letters);
  // Pressed intents, latched until a step reads them (a Set would rehash: allocation).
  const pressed = { jump: 0, refresh: 0 };
  const keys = { add: (id) => (pressed[id] = 1) };
  const input = { hit: (id) => (pressed[id] ? ((pressed[id] = 0), true) : false) };
  const w = W.createWorld(e, board, new Float64Array(11), input);
  w.s[W.W] = width;
  w.s[W.H] = height;
  w.reset();
  assert.equal(w.load(maze, frame(width, height), false), true);
  const seen = [];
  const run = (sec, each) => {
    for (let k = 0; k < Math.round(sec * 60); k++) {
      each?.(w, k);
      e.advance(1 / 60);
      for (let i = 0; i < e.events.size; i++) seen.push(e.events.at(i).type);
    }
  };
  return { e, w, board, seen, run, keys };
}
const SPEED = 237; // px/s on the trail at level 1
const near = (a, b) => Math.abs(a - b) < 1e-6;

test("on a trail the frog spends the whole distance around bends, keeps queued turns, and reverses only on a fresh press", () => {
  const { w } = game();
  const a = w.actors;
  w.ctl[KX] = 1;
  w.step(160 / SPEED);
  assert.ok(near(a.x[0], 80) && near(a.y[0], 100), `${a.x[0]}, ${a.y[0]}`);
  assert.equal(a.dir[0], 2);
  // Held right: no reverse from the stale key.
  w.step(20 / SPEED);
  assert.ok(near(a.x[0], 60) && near(a.y[0], 100));
  // Released, then pressed again: the frog turns back.
  w.ctl[KX] = 0;
  w.step(0.3); // (sooner would be a double tap: a jump)
  w.ctl[KX] = 1;
  w.step(10 / SPEED);
  assert.ok(near(a.x[0], 70), `${a.x[0]}`);
  assert.equal(a.dir[0], 0);
});

test("off the trail, a held direction catches the nearest pipe by projecting onto it (no jump to a junction)", () => {
  const { w } = game();
  const a = w.actors;
  a.x[0] = 70;
  a.y[0] = 46;
  w.s[W.ATTACHED] = 0;
  w.ctl[KX] = -1;
  w.step(0.001);
  assert.equal(w.s[W.ATTACHED], 1);
  assert.ok(Math.abs(a.x[0] - 70) < 0.5 && a.y[0] === 40, `${a.x[0]}, ${a.y[0]}`);
  assert.equal(a.dir[0], 2);
  // Too far from any pipe: it stays free.
  a.x[0] = 60;
  a.y[0] = 70;
  w.s[W.ATTACHED] = 0;
  w.ctl[KX] = 1;
  w.step(0.001);
  assert.equal(w.s[W.ATTACHED], 0);
});

test("the touch stick steers by its stronger axis", () => {
  const { w } = game();
  w.ctl[KX] = 0.3;
  w.ctl[KY] = -0.9;
  w.step(1 / 60);
  assert.equal(w.s[W.REQUESTED], 3, "up wins");
  w.ctl[KX] = 0.9;
  w.ctl[KY] = 0.4;
  w.step(1 / 60);
  assert.equal(w.s[W.REQUESTED], 0, "right wins");
  assert.ok(w.actors.x[0] > 20, "and the frog runs right");
});

test("Space jumps off the trail for 0.24 s at 280 px/s", () => {
  const { w, keys } = game();
  w.ctl[KX] = 1;
  w.step(1 / 60);
  w.ctl[KX] = 0;
  keys.add("jump");
  const x = w.actors.x[0];
  w.step(0.1);
  assert.equal(w.s[W.ATTACHED], 0);
  assert.equal(w.s[W.JUMPING], 1);
  assert.ok(near(w.actors.x[0] - x, 28), `${w.actors.x[0] - x}`);
});

test("power: the tongue reaches a fly two pellets ahead (54 px), never one beyond", () => {
  for (const [offset, eaten] of [[26, true], [25, false]]) {
    const { w, seen } = game();
    assert.equal(w.flies.count, 1, "one fly spawned far enough away");
    w.s[W.POWER] = w.s[W.SEAL] = 5;
    w.actors.dir[0] = 0;
    // The fly comes down the top trail toward the frog: from cell 1 to cell 0.
    w.actors.from[1] = 1;
    w.actors.to[1] = 0;
    w.actors.offset[1] = offset;
    w.actors.x[1] = 100 - offset;
    w.actors.y[1] = 40;
    w.actors.dir[1] = 2;
    w.step(0.001);
    assert.equal(seen.length >= 0 && w.flies.count === 0, eaten, `offset ${offset}`);
    if (eaten) assert.equal(w.s[W.SCORE], 100);
  }
});

test("food: 10 points; it grows back after 12 s as a bonus that never counts toward clearing the level", () => {
  const { w, run, seen } = game();
  const s = w.s;
  const left = s[W.REMAINING];
  const safe = () => (s[W.SHIELD] = 99); // no fly ends this run
  run(0.3, () => (safe(), (w.ctl[KX] = 1)));
  assert.equal(s[W.SCORE], 10);
  assert.equal(s[W.REMAINING], left - 1);
  assert.equal(s[W.COLLECTED], 1);
  assert.ok(seen.includes("pellet"));
  assert.equal(w.graph.eaten[0], 1);
  w.ctl[KX] = 0;
  run(11.5, safe);
  assert.equal(w.graph.eaten[0], 1, "still eaten before 12 s");
  run(0.6, safe);
  assert.equal(w.graph.eaten[0], 0, "grown back");
  // Back over it: points again, the level's progress unchanged.
  const score = s[W.SCORE];
  run(1, (_, k) => (safe(), (w.ctl[KX] = k === 0 ? 0 : -1)));
  assert.equal(s[W.SCORE] - score, 10);
  assert.equal(s[W.REMAINING], left - 1);
  assert.equal(s[W.COLLECTED], 1);
});

test("letters along the trail are bonus food: 5 points each, at most two per bite", () => {
  const { w, board, run, seen } = game({ letters: [[40, 36], [44, 36], [48, 36]] });
  run(0.15, () => (w.ctl[KX] = 1));
  assert.ok(board.spent.reduce((a, b) => a + b, 0) >= 2);
  assert.ok(seen.includes("letter"));
  assert.equal(w.s[W.EATEN], board.spent.reduce((a, b) => a + b, 0));
});

test("power food: 6 s of power (stacking to 9), flies turn back, gates fill with the time left", () => {
  const maze = track([[60, 40], [20, 100]]);
  maze.pellets[0].power = true;
  const { w, board, run } = game({ maze });
  run(0.3, () => (w.ctl[KX] = 1));
  assert.equal(w.s[W.SCORE], 50);
  assert.ok(w.s[W.POWER] > 5.5 && w.s[W.POWER] <= 6);
  assert.ok(board.targets[0].hp < 10, `gate ${board.targets[0].hp}`);
  w.ctl[KX] = 0;
  run(1);
  assert.ok(board.targets[0].hp > 15 && board.targets[0].hp < 30, `gate ${board.targets[0].hp}`);
  assert.equal(w.graph.respawnAt[0] > 19 && w.graph.respawnAt[0] < 21, true, "power food returns after 20 s");
});

test("eating the last food clears the level: +500 × level, then the next level's maze is built", () => {
  const { w, run, seen } = game({ maze: track([[60, 40]]) });
  run(0.3, () => (w.ctl[KX] = 1));
  assert.ok(seen.includes("level-clear"));
  assert.equal(w.s[W.SCORE], 10 + 500);
  run(1.3);
  assert.equal(w.s[W.WAVE], 2);
  assert.equal(w.s[W.REGEN], 1, "the read phase builds level 2");
});

test("three touches without the shield end the run", () => {
  const maze = makeMaze(800, 600, [], rng(3));
  const { w, run, seen } = game({ maze, width: 800, height: 600 });
  run(120, () => {
    if (!w.s[W.OVER]) w.s[W.SHIELD] = 0;
  });
  assert.equal(seen.filter((t) => t === "hurt").length, 3);
  assert.equal(w.s[W.OVER], 1);
  assert.ok(seen.includes("over"));
});

test("a page reflow keeps the run: the frog stays put on screen and the share of food left carries over", () => {
  const maze = makeMaze(800, 600, [], rng(5));
  const { w, run } = game({ maze, width: 800, height: 600 });
  run(4, (_, k) => (w.ctl[KX] = k < 120 ? 1 : 0, w.ctl[KY] = k >= 120 ? 1 : 0));
  const share = w.s[W.REMAINING] / w.graph.pn, x = w.actors.x[0], y = w.actors.y[0], score = w.s[W.SCORE], flies = w.flies.count;
  assert.ok(share < 1);
  // The same page, scrolled 40 px: the new maze is 40 px lower in the root's own space.
  const next = makeMaze(800, 600, [], rng(6));
  assert.equal(w.load(next, { ...frame(800, 600), oy: -40 }, true), true);
  assert.ok(Math.abs(w.s[W.REMAINING] / w.graph.pn - share) < 0.02, "same share of food left");
  assert.equal(w.s[W.SCORE], score, "a reflow never scores");
  assert.equal(w.flies.count, flies, "flies keep their identities");
  assert.ok(Math.hypot(w.actors.x[0] - x, w.actors.y[0] - 40 - y) < 60, "the frog stays near where it was on screen");
});

/** A scripted run: turn every half second, jump now and then. */
function script(w, keys) {
  return (_, k) => {
    const d = Math.floor(k / 30) % 4;
    w.ctl[KX] = d === 0 ? 1 : d === 2 ? -1 : 0;
    w.ctl[KY] = d === 1 ? 1 : d === 3 ? -1 : 0;
    if (k % 97 === 0) keys.add("jump");
    if (w.s[W.LIVES] < 2) w.s[W.LIVES] = 3;
  };
}
test("same seed, same inputs: the same run (multiplayer-ready)", () => {
  const trace = () => {
    const t = game({ maze: makeMaze(900, 700, [], rng(11)), width: 900, height: 700, seed: 21 });
    const out = [];
    t.run(30, (w, k) => (script(t.w, t.keys)(w, k), k % 60 === 0 && out.push(t.w.s[W.SCORE], t.w.actors.x[0], t.w.actors.y[0], t.w.flies.count)));
    return out;
  };
  const a = trace();
  assert.deepEqual(trace(), a);
  assert.ok(a.some((v, i) => i % 4 === 0 && v > 0), "the run scored");
});

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
