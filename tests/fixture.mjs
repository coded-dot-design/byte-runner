// The test page and helpers the world tests share: a Fizlet engine stepped by hand, a fake page (a
// few letters, one gate), and mazes built by hand or by makeMaze (what the read phase does).
import assert from "node:assert/strict";
import { createEngine } from "../vendor/fizlet/index.ts";
import * as W from "../src/world.ts";

export const KX = 4, KY = 5;
export function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
/** A page: letters (10 px squares) at the given viewport points, one gate. Allocation-free. */
export function page(points = []) {
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
export function track(pellets = [[60, 40], [20, 100]]) {
  const xy = [[20, 40], [100, 40], [100, 100], [20, 100]], exits = [[1], [0, 2], [1, 3], [2]];
  return {
    cells: xy.map(([x, y], id) => ({ id, row: 0, col: id, x, y, exits: exits[id] })),
    pellets: pellets.map(([x, y], id) => ({ id, cell: 0, x, y, power: false, eaten: false, cleared: false, respawnAt: 0 })),
    step: 64, radius: 15, clearance: 18, start: 0, path: "",
  };
}
export const frame = (width, height) => ({ x: 0, y: 0, width, height, scaleX: 1, scaleY: 1, ox: 0, oy: 0, walls: [], solids: [] });
export function game({ maze = track(), width = 200, height = 200, letters = [], seed = 7 } = {}) {
  const e = createEngine({ seed, events: 512 });
  const board = page(letters);
  // Pressed intents, latched until a step reads them (a Set would rehash: allocation).
  const pressed = { jump: 0, refresh: 0 };
  const keys = { add: (id) => (pressed[id] = 1) };
  const held = { right: 0, down: 0, left: 0, up: 0 };
  const input = { hit: (id) => (pressed[id] ? ((pressed[id] = 0), true) : false), down: (id) => held[id] === 1 };
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
  return { e, w, board, seen, run, keys, held };
}
/** A scripted run: turn every half second, jump now and then. */
export function script(w, keys) {
  return (_, k) => {
    const d = Math.floor(k / 30) % 4;
    w.ctl[KX] = d === 0 ? 1 : d === 2 ? -1 : 0;
    w.ctl[KY] = d === 1 ? 1 : d === 3 ? -1 : 0;
    if (k % 97 === 0) keys.add("jump");
    if (w.s[W.LIVES] < 2) w.s[W.LIVES] = 3;
  };
}
