// The maze as typed arrays: what a step reads. `makeMaze` (./maze) builds the trails from the
// page's layout (in the read phase, when the layout changes); `compile` turns its cells, exits and
// food into fixed arrays plus a spatial index of the food, so moving, eating and chasing never
// allocate. Coordinates are the maze's own (the attached art's local CSS pixels).
import type { Maze } from "./maze.js";

/** Food is binned in 36 px squares (the reach of a bite is 12 px). */
export const BIN = 36;
/** Direction of b from a: 0 right, 1 down, 2 left, 3 up (the dominant axis). */
export const dirOf = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(bx - ax) > Math.abs(by - ay) ? (bx > ax ? 0 : 2) : by > ay ? 1 : 3;
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

export interface Graph {
  /** Cells: position, exits (4 slots each, -1 when unused) and how many. */
  n: number;
  x: Float64Array;
  y: Float64Array;
  exits: Int16Array;
  deg: Uint8Array;
  start: number;
  /** Food: position, cell, power (1/0) and state (eaten, cleared, when it returns). */
  pn: number;
  px: Float64Array;
  py: Float64Array;
  power: Uint8Array;
  eaten: Uint8Array;
  cleared: Uint8Array;
  respawnAt: Float64Array;
  /** Food index: bin b holds items[binStart[b] .. binStart[b + 1]). */
  cols: number;
  rows: number;
  binStart: Int32Array;
  items: Int16Array;
  radius: number;
}

export function compile(maze: Maze, width: number, height: number): Graph {
  const n = maze.cells.length, pn = maze.pellets.length;
  const g: Graph = {
    n, x: new Float64Array(n), y: new Float64Array(n), exits: new Int16Array(n * 4).fill(-1), deg: new Uint8Array(n), start: maze.start,
    pn, px: new Float64Array(pn), py: new Float64Array(pn), power: new Uint8Array(pn), eaten: new Uint8Array(pn), cleared: new Uint8Array(pn), respawnAt: new Float64Array(pn),
    cols: Math.max(1, Math.ceil(width / BIN) + 1), rows: Math.max(1, Math.ceil(height / BIN) + 1), binStart: new Int32Array(0), items: new Int16Array(pn), radius: maze.radius,
  };
  for (const c of maze.cells) {
    g.x[c.id] = c.x;
    g.y[c.id] = c.y;
    for (const e of c.exits) if (g.deg[c.id]! < 4) g.exits[c.id * 4 + g.deg[c.id]!++] = e;
  }
  for (const p of maze.pellets) {
    g.px[p.id] = p.x;
    g.py[p.id] = p.y;
    g.power[p.id] = p.power ? 1 : 0;
    g.eaten[p.id] = p.eaten ? 1 : 0;
    g.cleared[p.id] = p.cleared ? 1 : 0;
    g.respawnAt[p.id] = p.respawnAt;
  }
  // Counting sort of the food into bins (CSR).
  const bins = g.cols * g.rows, count = new Int32Array(bins + 1);
  const binOf = (i: number) => Math.min(g.rows - 1, Math.max(0, Math.floor(g.py[i]! / BIN))) * g.cols + Math.min(g.cols - 1, Math.max(0, Math.floor(g.px[i]! / BIN)));
  for (let i = 0; i < pn; i++) count[binOf(i) + 1]!++;
  for (let b = 0; b < bins; b++) count[b + 1]! += count[b]!;
  g.binStart = count.slice();
  for (let i = 0; i < pn; i++) g.items[count[binOf(i)]!++] = i;
  return g;
}

/** The exit of cell c that heads in direction d, or -1. */
export function exitToward(g: Graph, c: number, d: number) {
  for (let k = 0; k < g.deg[c]!; k++) {
    const e = g.exits[c * 4 + k]!;
    if (dirOf(g.x[c]!, g.y[c]!, g.x[e]!, g.y[e]!) === d) return e;
  }
  return -1;
}
/** Is e an exit of c? */
export function linked(g: Graph, c: number, e: number) {
  for (let k = 0; k < g.deg[c]!; k++) if (g.exits[c * 4 + k] === e) return true;
  return false;
}
/** The cell closest to (x, y). */
export function closest(g: Graph, x: number, y: number) {
  let best = 0, d = Infinity;
  for (let i = 0; i < g.n; i++) {
    const dx = g.x[i]! - x, dy = g.y[i]! - y, dd = dx * dx + dy * dy;
    if (dd < d) (d = dd), (best = i);
  }
  return best;
}
/** Breadth-first steps from `start` to every cell, into `out` (-1: unreachable); `queue` is scratch. */
export function distances(g: Graph, start: number, out: Int16Array, queue: Int16Array) {
  out.fill(-1, 0, g.n);
  if (start < 0 || start >= g.n) return;
  out[start] = 0;
  queue[0] = start;
  for (let head = 0, tail = 1; head < tail; head++) {
    const c = queue[head]!;
    for (let k = 0; k < g.deg[c]!; k++) {
      const e = g.exits[c * 4 + k]!;
      if (out[e] === -1) (out[e] = out[c]! + 1), (queue[tail++] = e);
    }
  }
}
