// Byte Runner, the rules: the frog, the flies, the food, the bonus fruit and the levels, as one
// Fizlet system. DOM-free: the page comes in through `Board` (fizlet/board-page in the game, a fake
// in tests), the maze through `load` (built from the page's layout in the read phase), the controls
// through `ctl` and `input`. Every running number lives in a typed array, so a step never allocates.
// What happens goes on the engine's event ring; the game layer turns it into sound, sparks, popups
// and the HUD. The numbers are 0.10.2's (the DOM VIRUS core build), unchanged.
import type { Engine, System } from "../vendor/fizlet/kernel/engine";
import { BIN, DX, DY, closest, compile, dirOf, distances, exitToward, linked } from "./graph.js";
import type { Graph } from "./graph.js";
import type { Maze, Wall } from "./maze.js";
import { MAX_GHOSTS, PELLET_RETURN_SECONDS, POWER_RETURN_SECONDS, TONGUE_REACH, extendPower } from "./rules.js";

/** A page target (a gate): hp is the game's. */
export interface Target {
  hp: number;
}
/** The page as the board (fizlet/board-page satisfies it). */
export interface Board {
  readonly targets: readonly Target[];
  /** Unspent on-screen glyphs touching the circle, into `out`; how many. */
  near(x: number, y: number, r: number, out: Int32Array): number;
  consume(i: number, as?: "binary" | "erase"): boolean;
}
/** The intents a step reads (fizlet/input satisfies it). */
export interface Intents {
  hit(intent: string): boolean;
  /** Held right now (the arcade's up / down / left / right keys and pad). */
  down(intent: string): boolean;
}
/** The visible part of the content root the maze covers, measured in the read phase: its offset in
 *  the root, size and scale (local CSS px), where the root is in the viewport, and the solid walls
 *  (the scoreboard, the touch pad, `[data-byte-wall]`) the frog can't jump through. */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  ox: number;
  oy: number;
  walls: readonly Wall[];
  solids: readonly Wall[];
}

/** Controls, written once per frame before the steps (fizlet/arcade's slots): move x, y (-1..1). */
const KX = 4, KY = 5;
/** World state slots. Read them for the HUD and drawing; the game writes W, H, REDUCED, OX and OY. */
export const W = 0, H = 1, REDUCED = 2, TIME = 3, OVER = 4, SCORE = 5, LIVES = 6, WAVE = 7, EATEN = 8, POWER = 9, SHIELD = 10;
export const COMBO = 11, REMAINING = 12, COLLECTED = 13, TOTAL = 14, REQUESTED = 15, TRANSITION = 16, SPAWN_IN = 17, FRUIT_IN = 18;
export const FRUIT_COUNT = 19, ATTACHED = 20, JUMP_UNTIL = 21, LAST_INPUT = 22, LAST_TAP = 23, TAP_AT = 24, CHASE_IN = 25, SEAL = 26;
/** READY: there is a maze to play on. REGEN: the read phase builds the next maze (1 a new level, 2 the same one reflowed). */
export const READY = 27, REGEN = 28, SEQ = 29, REVISION = 30, PLAYER = 31;
/** The frame (see Frame) and where the root is in the viewport. */
export const FX = 32, FY = 33, FW = 34, FH = 35, SX = 36, SY = 37, OX = 38, OY = 39, WALLS = 40;
export const FRUIT = 41, FRUIT_X = 42, FRUIT_Y = 43, FRUIT_KIND = 44, FRUIT_LIFE = 45;
/** The frog's animation (simulation time and real movement only). */
export const MOVING = 46, RUN_T = 47, CHOMP = 48, JUMPING = 49, TONGUE_UNTIL = 50, TONGUE_X = 51, TONGUE_Y = 52, TONGUE = 53;
/** FRESH: the next maze is a new level (a build for one failed; retry it as one, not as a reflow). */
export const FRESH = 54;
const STAMP = 55, SLOTS = 56;
const MOVES = ["right", "down", "left", "up"] as const;
const MAX_SOLIDS = 32, NOT = -1;
/** Hub event payloads, by ring event `a`. */
export const PICKUP_KINDS = ["fruit"] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Length of (x, y). Not Math.hypot: V8's allocates. */
const dist = (x: number, y: number) => Math.sqrt(x * x + y * y);
const opposite = (d: number) => (d + 2) % 4;

/** `ctl`: the controls array to read (fizlet/arcade's, in the game); a fresh one by default (tests). */
export function createWorld(e: Engine, board: Board, ctl: Float64Array = new Float64Array(11), input: Intents = { hit: () => false, down: () => false }) {
  const s = new Float64Array(SLOTS);
  // Actors: 0 is the frog, 1 … the flies (fly k is actor k + 1). Position, edge (from → to), how far
  // along it, heading (-1 none, 0 right, 1 down, 2 left, 3 up).
  const A = MAX_GHOSTS + 1;
  const ax = new Float64Array(A), ay = new Float64Array(A), af = new Int32Array(A), at = new Int32Array(A), ao = new Float64Array(A), ad = new Int32Array(A);
  // Flies: id (art identity), kind (0..2), wing phase, time to the next hop, landing cell (-1: none).
  const gid = new Int32Array(MAX_GHOSTS), gkind = new Uint8Array(MAX_GHOSTS), gphase = new Float64Array(MAX_GHOSTS), ghop = new Float64Array(MAX_GHOSTS), gland = new Int32Array(MAX_GHOSTS);
  const n = new Int32Array(2), GN = 0, SOLIDS = 1;
  const solids = new Float64Array(MAX_SOLIDS * 4), glyphs = new Int32Array(8);
  // When each move key went down (0: up), so the newest held key wins.
  const pressedAt = new Float64Array(4);
  // The maze and its scratch (sized on load, in the read phase).
  let g: Graph = compile({ cells: [], pellets: [], step: 64, radius: 15, clearance: 18, start: 0, path: "" }, 0, 0);
  let near = new Int16Array(0), ahead = new Int16Array(0), spawnField = new Int16Array(0), queue = new Int16Array(0);
  // catchTrail's answer: found, x, y, from, to, offset, heading.
  const c = new Float64Array(7);

  // ---------- Geometry (local maze px; the viewport is OX/OY + (frame + p) × scale) ----------
  const vx = (x: number) => s[OX]! + (s[FX]! + x) * s[SX]!;
  const vy = (y: number) => s[OY]! + (s[FY]! + y) * s[SY]!;
  function blocked(x0: number, y0: number, x1: number, y1: number, pad: number) {
    for (let i = 0, m = n[SOLIDS]! * 4; i < m; i += 4)
      if ((x0 > x1 ? x0 : x1) > solids[i]! - pad && (x0 < x1 ? x0 : x1) < solids[i + 1]! + pad && (y0 > y1 ? y0 : y1) > solids[i + 2]! - pad && (y0 < y1 ? y0 : y1) < solids[i + 3]! + pad) return true;
    return false;
  }
  const inX = (x: number) => clamp(x, 15, s[FW]! - 15), inY = (y: number) => clamp(y, 18, s[FH]! - 18);
  function place(i: number, cell: number) {
    ax[i] = g.x[cell]!;
    ay[i] = g.y[cell]!;
    af[i] = at[i] = cell;
    ao[i] = 0;
    ad[i] = -1;
  }
  const edge = (a: number, b: number) => dist(g.x[b]! - g.x[a]!, g.y[b]! - g.y[a]!);
  function reverse(i: number) {
    if (af[i] === at[i]) return;
    const a = af[i]!;
    af[i] = at[i]!;
    at[i] = a;
    ao[i] = edge(a, af[i]!) - ao[i]!;
    ad[i] = opposite(ad[i]!);
  }
  /** The nearest point on any trail within `radius` (projected onto the edge, so catching a pipe
   *  never skips food), heading along it unless that is against `heading`. Into `c`. */
  function catchTrail(px: number, py: number, heading: number, radius: number) {
    let d = radius;
    c[0] = 0;
    for (let a = 0; a < g.n; a++)
      for (let k = 0; k < g.deg[a]!; k++) {
        const b = g.exits[a * 4 + k]!;
        if (b < a) continue;
        const x0 = g.x[a]!, y0 = g.y[a]!, ex = g.x[b]! - x0, ey = g.y[b]! - y0, len = dist(ex, ey);
        const t = clamp(((px - x0) * ex + (py - y0) * ey) / (len * len), 0, 1);
        const x = x0 + ex * t, y = y0 + ey * t, dd = dist(x - px, y - py);
        if (dd > d) continue;
        d = dd;
        c[0] = 1; c[1] = x; c[2] = y; c[3] = a; c[4] = b; c[5] = t * len; c[6] = dirOf(x0, y0, g.x[b]!, g.y[b]!);
        if (heading === opposite(c[6]!)) (c[3] = b), (c[4] = a), (c[5] = len - c[5]!), (c[6] = opposite(c[6]!));
        if (c[5]! < 0.001) c[4] = c[3]!;
        else if (len - c[5]! < 0.001) (c[3] = c[4]!), (c[5] = 0);
      }
    return c[0] === 1;
  }
  function take(i: number) {
    ax[i] = c[1]!; ay[i] = c[2]!; af[i] = c[3]!; at[i] = c[4]!; ao[i] = c[5]!; ad[i] = c[6]!;
  }

  // ---------- Choosing at junctions ----------
  const toward = (a: number, b: number) => dirOf(g.x[a]!, g.y[a]!, g.x[b]!, g.y[b]!);
  /** The frog: the requested exit, else straight on, else the only way that isn't back. */
  function choosePlayer(cell: number) {
    const want = exitToward(g, cell, s[REQUESTED]!);
    if (want >= 0) return want;
    let only = NOT, count = 0;
    for (let k = 0; k < g.deg[cell]!; k++) {
      const x = g.exits[cell * 4 + k]!, d = toward(cell, x);
      if (d === opposite(ad[0]!)) continue;
      if (d === ad[0]) return x;
      only = x;
      count++;
    }
    return count === 1 ? only : NOT;
  }
  /** A fly: never back unless it must; toward the frog (away while it has power) on its field;
   *  the third kind sometimes picks at random. */
  function chooseFly(cell: number, j: number, field: Int16Array) {
    const back = opposite(ad[j + 1]!), power = s[POWER]! > 0;
    let forward = 0;
    for (let k = 0; k < g.deg[cell]!; k++) {
      const x = g.exits[cell * 4 + k]!;
      if (toward(cell, x) !== back) forward++;
    }
    const all = forward === 0, count = all ? g.deg[cell]! : forward;
    if (!count) return NOT;
    if (gkind[j] === 2 && !power && e.random() < 0.2) {
      let pick = Math.floor(e.random() * count);
      for (let k = 0; k < g.deg[cell]!; k++) {
        const x = g.exits[cell * 4 + k]!;
        if ((all || toward(cell, x) !== back) && pick-- === 0) return x;
      }
    }
    let best = NOT;
    for (let k = 0; k < g.deg[cell]!; k++) {
      const x = g.exits[cell * 4 + k]!;
      if ((all || toward(cell, x) !== back) && (best === NOT || (power ? field[x]! > field[best]! : field[x]! < field[best]!))) best = x;
    }
    return best;
  }
  /** Spend `distance` along valid edges in ≤ 6 px steps, choosing at junctions. Actor 0 (the frog)
   *  eats along the way. */
  function advance(i: number, distance: number, field: Int16Array) {
    while (distance > 0.001) {
      if (af[i] === at[i]) {
        const next = i === 0 ? choosePlayer(af[i]!) : chooseFly(af[i]!, i - 1, field);
        if (next < 0 || !linked(g, af[i]!, next)) break;
        at[i] = next;
        ao[i] = 0;
        ad[i] = dirOf(g.x[af[i]!]!, g.y[af[i]!]!, g.x[next]!, g.y[next]!);
      }
      const a = af[i]!, b = at[i]!, len = edge(a, b), step = Math.min(distance, len - ao[i]!, 6);
      ao[i]! += step;
      distance -= step;
      ax[i] = g.x[a]! + ((g.x[b]! - g.x[a]!) * ao[i]!) / len;
      ay[i] = g.y[a]! + ((g.y[b]! - g.y[a]!) * ao[i]!) / len;
      if (i === 0) collect(ax[0]!, ay[0]!);
      if (ao[i]! >= len - 0.001) (af[i] = at[i]!), (ao[i] = 0);
    }
  }

  // ---------- Eating ----------
  function chomp() {
    s[CHOMP] = s[TIME]! + 0.3;
  }
  function collect(px: number, py: number) {
    const bx = Math.floor(px / BIN), by = Math.floor(py / BIN);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const cx = bx + dx, cy = by + dy;
        if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) continue;
        const b = cy * g.cols + cx;
        for (let k = g.binStart[b]!; k < g.binStart[b + 1]!; k++) {
          const p = g.items[k]!;
          if (g.eaten[p] || dist(g.px[p]! - px, g.py[p]! - py) > 12) continue;
          // Regrown food is a bonus: only the first bite counts toward clearing the level.
          const first = !g.cleared[p];
          g.eaten[p] = g.cleared[p] = 1;
          g.respawnAt[p] = s[TIME]! + (g.power[p] ? POWER_RETURN_SECONDS : PELLET_RETURN_SECONDS);
          chomp();
          if (first) s[REMAINING]!--, s[COLLECTED]!++;
          s[SCORE]! += g.power[p] ? 50 : 10;
          if (g.power[p]) {
            s[POWER] = extendPower(s[POWER]!);
            s[SEAL] = s[POWER]!;
            s[COMBO] = 0;
            for (let j = 0; j < n[GN]!; j++) reverse(j + 1);
            e.events.emit("power", s[POWER]!, 0, vx(g.px[p]!), vy(g.py[p]!));
          }
          e.events.emit("pellet", s[REMAINING]!, g.power[p]!, vx(g.px[p]!), vy(g.py[p]!), s[SCORE]!);
        }
      }
    // Letters are optional bonus food along the corridor: at most two per bite.
    const x = vx(px), y = vy(py);
    for (let k = 0, m = board.near(x, y, 13, glyphs), eaten = 0; k < m && eaten < 2; k++)
      if (board.consume(glyphs[k]!, "binary")) {
        chomp();
        s[EATEN]!++;
        s[SCORE]! += 5;
        eaten++;
        e.events.emit("letter", s[EATEN]!, 0, x, y, s[SCORE]!);
      }
    if (s[FRUIT] && dist(s[FRUIT_X]! - px, s[FRUIT_Y]! - py) < 18) {
      const bonus = (s[FRUIT_KIND] ? 300 : 100) * s[WAVE]!;
      s[SCORE]! += bonus;
      chomp();
      s[FRUIT] = 0;
      e.events.emit("fruit", bonus, s[FRUIT_KIND]!, x, y, s[SCORE]!);
    }
  }

  // ---------- Flies ----------
  function spawnFly() {
    if (!s[PLAYER] || n[GN]! >= Math.min(MAX_GHOSTS, 9 + Math.floor((s[WAVE]! - 1) / 2))) return;
    distances(g, at[0]!, spawnField, queue);
    const reach = Math.min(220, Math.max(100, s[FW]! * 0.25));
    let count = 0;
    for (let k = 0; k < g.n; k++) if (farCell(k, reach)) count++;
    if (!count) return;
    let pick = Math.floor(e.random() * count), cell = 0;
    for (let k = 0; k < g.n; k++) if (farCell(k, reach) && pick-- === 0) (cell = k), (k = g.n);
    const j = n[GN]!++;
    place(j + 1, cell);
    gid[j] = s[SEQ]!++;
    gkind[j] = j % 3;
    gphase[j] = (s[SEQ]! * 0.381966 + e.random()) % 1;
    ghop[j] = 4 + e.random() * 5;
    gland[j] = NOT;
    e.events.emit("spawn", gid[j]!);
  }
  function farCell(k: number, reach: number) {
    if (spawnField[k]! < 2 || dist(g.x[k]! - ax[0]!, g.y[k]! - ay[0]!) < reach) return false;
    for (let j = 0; j < n[GN]!; j++) if (dist(g.x[k]! - ax[j + 1]!, g.y[k]! - ay[j + 1]!) <= 40) return false;
    return true;
  }
  /** Remove fly j, keeping the others in order (the order decides who touches the frog first). */
  function removeFly(j: number) {
    const last = --n[GN]!;
    for (let k = j; k < last; k++) {
      const a = k + 1, b = k + 2;
      ax[a] = ax[b]!; ay[a] = ay[b]!; af[a] = af[b]!; at[a] = at[b]!; ao[a] = ao[b]!; ad[a] = ad[b]!;
      gid[k] = gid[k + 1]!; gkind[k] = gkind[k + 1]!; gphase[k] = gphase[k + 1]!; ghop[k] = ghop[k + 1]!; gland[k] = gland[k + 1]!;
    }
  }
  /** A hop: a short flight to a visible cell 45–180 px away, closer to the frog on its field
   *  (farther while the frog has power), never through a wall. */
  function hopCell(k: number, j: number, field: Int16Array) {
    const x = ax[j + 1]!, y = ay[j + 1]!, d = dist(g.x[k]! - x, g.y[k]! - y);
    return d > 45 && d < 180 && Math.abs(g.x[k]! - x) > 18 && Math.abs(g.y[k]! - y) > 18 && !blocked(x, y, g.x[k]!, g.y[k]!, 15) && (s[POWER] ? field[k]! > field[at[j + 1]!]! : field[k]! < field[at[j + 1]!]!);
  }
  function tongueTarget(x: number, y: number) {
    const d = Math.max(0, ad[0]!), dx = DX[d]!, dy = DY[d]!, rx = x - ax[0]!, ry = y - ay[0]!;
    return rx * dx + ry * dy > 0 && dist(rx, ry) <= TONGUE_REACH && Math.abs(rx * dy - ry * dx) <= 18;
  }

  // ---------- Runs, levels, mazes ----------
  function resetFrog() {
    place(0, g.start);
    ax[0] = inX(ax[0]!);
    ay[0] = inY(ay[0]!);
    s[REQUESTED] = NOT;
    s[ATTACHED] = 1;
    s[JUMP_UNTIL] = 0;
    s[MOVING] = 0;
  }
  function reset() {
    // The viewport, the motion setting and where the root is belong to the page, not the run.
    const w = s[W]!, h = s[H]!, calm = s[REDUCED]!, ox = s[OX]!, oy = s[OY]!;
    s.fill(0);
    s[W] = w; s[H] = h; s[REDUCED] = calm; s[OX] = ox; s[OY] = oy;
    s[LIVES] = 3; s[WAVE] = 1; s[SHIELD] = 2.5; s[REGEN] = 1; s[FRUIT_IN] = 14;
    s[LAST_INPUT] = s[LAST_TAP] = s[TAP_AT] = s[REQUESTED] = NOT;
    n[GN] = 0;
    pressedAt.fill(0);
    for (let i = 0; i < board.targets.length; i++) board.targets[i]!.hp = 100;
  }
  const gx = new Float64Array(MAX_GHOSTS), gy = new Float64Array(MAX_GHOSTS);
  /**
   * The read phase built a maze from the page (`makeMaze`): play on it. `preserve` (a scroll, a
   * resize, M) keeps the run: the frog and the flies stay where they are on screen, and the share
   * of food left carries over (a reflow never scores or refills a level). False when the visible
   * part of the page has no room for trails (the maze waits; nothing else changes).
   */
  function load(maze: Maze, frame: Frame, preserve: boolean) {
    s[REGEN] = 0;
    if (maze.cells.length < 2 || !maze.pellets.length) return (s[READY] = 0), (s[FRESH] = preserve ? s[FRESH]! : 1), false;
    s[FRESH] = 0;
    const had = preserve && s[PLAYER] === 1, px = vx(ax[0]!), py = vy(ay[0]!), heading = ad[0]!;
    const flies = preserve ? n[GN]! : 0;
    for (let j = 0; j < flies; j++) (gx[j] = vx(ax[j + 1]!)), (gy[j] = vy(ay[j + 1]!));
    if (preserve) {
      // Spread the food that is left evenly over the new trails.
      const target = Math.max(1, Math.round((maze.pellets.length * s[REMAINING]!) / (g.pn || 1)));
      const cleared = Math.max(0, maze.pellets.length - target);
      let oldCleared = 0, oldEaten = 0, due = Infinity;
      for (let p = 0; p < g.pn; p++) if (g.cleared[p]) oldCleared++, g.eaten[p] && (oldEaten++, (due = Math.min(due, g.respawnAt[p]!)));
      if (!oldEaten) due = s[TIME]! + PELLET_RETURN_SECONDS;
      const share = oldEaten / Math.max(1, oldCleared), m = maze.pellets.length;
      let count = 0;
      maze.pellets.forEach((p, i) => {
        p.cleared = Math.floor(((i + 1) * cleared) / m) !== Math.floor((i * cleared) / m);
        if (p.cleared) {
          p.eaten = Math.floor((count + 1) * share) !== Math.floor(count * share);
          p.respawnAt = Math.max(s[TIME]!, due);
          count++;
        }
      });
    } else (s[COLLECTED] = 0), (s[FRUIT_COUNT] = 0), (s[FRUIT_IN] = 14);
    s[FX] = frame.x; s[FY] = frame.y; s[FW] = frame.width; s[FH] = frame.height; s[SX] = frame.scaleX; s[SY] = frame.scaleY;
    s[OX] = frame.ox; s[OY] = frame.oy; s[WALLS] = frame.walls.length;
    n[SOLIDS] = Math.min(MAX_SOLIDS, frame.solids.length);
    for (let i = 0; i < n[SOLIDS]!; i++) {
      const w = frame.solids[i]!;
      solids[i * 4] = w.left; solids[i * 4 + 1] = w.right; solids[i * 4 + 2] = w.top; solids[i * 4 + 3] = w.bottom;
    }
    g = compile(maze, frame.width, frame.height);
    if (near.length < g.n) (near = new Int16Array(g.n)), (ahead = new Int16Array(g.n)), (spawnField = new Int16Array(g.n)), (queue = new Int16Array(g.n));
    s[READY] = 1;
    s[REMAINING] = 0;
    for (let p = 0; p < g.pn; p++) if (!g.cleared[p]) s[REMAINING]!++;
    s[TOTAL] = s[COLLECTED]! + s[REMAINING]!;
    s[PLAYER] = 1;
    resetFrog();
    s[LAST_INPUT] = s[LAST_TAP] = NOT;
    if (!preserve) s[RUN_T] = s[CHOMP] = 0;
    n[GN] = 0;
    // A reflow keeps the fruit, moved onto the nearest cell of the new trails.
    if (preserve && s[FRUIT]) {
      const k = closest(g, s[FRUIT_X]!, s[FRUIT_Y]!);
      s[FRUIT_X] = g.x[k]!;
      s[FRUIT_Y] = g.y[k]!;
    }
    else s[FRUIT] = 0;
    s[SPAWN_IN] = 1.2;
    s[SHIELD] = Math.max(s[SHIELD]!, preserve ? 0.6 : 2);
    s[CHASE_IN] = 0;
    if (had) {
      ax[0] = inX((px - s[OX]!) / s[SX]! - s[FX]!);
      ay[0] = inY((py - s[OY]!) / s[SY]! - s[FY]!);
      if (catchTrail(ax[0]!, ay[0]!, heading, Infinity)) take(0);
      ad[0] = heading;
    }
    // Flies keep their identities, kinds, wing phases and hop clocks. A reflow is not locomotion.
    for (let j = 0; j < flies; j++) {
      const gidj = gid[j]!, kind = gkind[j]!, phase = gphase[j]!, hop = ghop[j]!, dir = ad[j + 1]!;
      place(j + 1, closest(g, (gx[j]! - s[OX]!) / s[SX]! - s[FX]!, (gy[j]! - s[OY]!) / s[SY]! - s[FY]!));
      gid[j] = gidj; gkind[j] = kind; gphase[j] = phase; ghop[j] = hop; gland[j] = NOT; ad[j + 1] = dir;
    }
    n[GN] = flies;
    if (!preserve) for (let i = 0; i < 5; i++) spawnFly();
    e.events.emit(preserve ? "maze-reflow" : "level-start", s[WAVE]!, s[REMAINING]!, 0, 0, s[WALLS]!);
    return true;
  }
  /** Jump: leave the trail for 0.24 s (Space, or a second tap on the same direction). */
  function jump(heading: number) {
    if (!s[PLAYER] || !s[READY] || s[TRANSITION]! > 0) return;
    if (heading >= 0) ad[0] = heading;
    else if (ad[0]! < 0) ad[0] = 0;
    s[ATTACHED] = 0;
    s[JUMP_UNTIL] = s[TIME]! + 0.24;
  }
  /** The held direction (4-way). Keys: the newest held one wins (a key pressed later turns, even
   *  while the opposite one is still down). Otherwise the move axes (the touch stick): the stronger. */
  function heading() {
    let d = -1, newest = 0;
    for (let k = 0; k < 4; k++) {
      if (!input.down(MOVES[k]!)) pressedAt[k] = 0;
      else if (!pressedAt[k]) pressedAt[k] = ++s[STAMP]!;
      if (pressedAt[k]! > newest) (newest = pressedAt[k]!), (d = k);
    }
    if (d >= 0) return d;
    const kx = ctl[KX]!, ky = ctl[KY]!;
    if (!kx && !ky) return -1;
    return Math.abs(kx) >= Math.abs(ky) ? (kx > 0 ? 0 : 2) : ky > 0 ? 1 : 3;
  }

  // ---------- The step ----------
  function step(dt: number) {
    s[TIME]! += dt;
    const dir = heading();
    if (input.hit("jump")) jump(dir);
    if (input.hit("refresh") && s[TRANSITION]! <= 0) s[REVISION]!++, (s[REGEN] = 2);
    if (s[OVER] || s[REGEN] || !s[READY] || !s[PLAYER] || g.n < 2) return;
    if (s[TRANSITION]! > 0) {
      s[MOVING] = 0;
      s[TRANSITION]! -= dt;
      if (s[TRANSITION]! <= 0) s[WAVE]!++, (s[POWER] = 0), (s[REGEN] = 1);
      return;
    }
    // Food grows back on the simulation clock (a pause pauses it).
    for (let p = 0; p < g.pn; p++) if (g.eaten[p] && s[TIME]! >= g.respawnAt[p]!) g.eaten[p] = 0;
    s[SHIELD] = Math.max(0, s[SHIELD]! - dt);
    const powered = s[POWER]! > 0;
    s[POWER] = Math.max(0, s[POWER]! - dt);
    if (powered && s[POWER] === 0) (s[COMBO] = 0), e.events.emit("power-end");
    const bx = ax[0]!, by = ay[0]!;
    // A second press (not key repeat or a held direction) deliberately breaks out.
    const pressed = dir >= 0 && dir !== s[LAST_INPUT];
    if (pressed) {
      if (s[LAST_TAP] === dir && s[TIME]! - s[TAP_AT]! < 0.26) jump(dir);
      s[LAST_TAP] = dir;
      s[TAP_AT] = s[TIME]!;
    }
    s[LAST_INPUT] = dir;
    if (dir >= 0) s[REQUESTED] = dir;
    if (s[ATTACHED] && dir >= 0) {
      if (pressed && s[REQUESTED] === opposite(ad[0]!)) reverse(0);
      advance(0, (Math.min(300, 230 + s[WAVE]! * 7) * dt) / Math.max(s[SX]!, s[SY]!), near);
    } else if (!s[ATTACHED] && (dir >= 0 || s[TIME]! < s[JUMP_UNTIL]!)) {
      ad[0] = dir >= 0 ? dir : Math.max(0, ad[0]!);
      const dx = DX[ad[0]!]!, dy = DY[ad[0]!]!;
      let travel = (s[TIME]! < s[JUMP_UNTIL]! ? 280 : 185) * dt;
      while (travel > 0.001) {
        const len = Math.min(5, travel);
        travel -= len;
        const x = inX(ax[0]! + (dx * len) / s[SX]!), y = inY(ay[0]! + (dy * len) / s[SY]!);
        if (blocked(ax[0]!, ay[0]!, x, y, 15)) break;
        ax[0] = x;
        ay[0] = y;
        collect(x, y);
        if (s[TIME]! >= s[JUMP_UNTIL]! && catchTrail(x, y, ad[0]!, 10) && !blocked(x, y, c[1]!, c[2]!, 15)) {
          take(0);
          s[ATTACHED] = 1;
          break;
        }
      }
    }
    s[JUMPING] = s[TIME]! < s[JUMP_UNTIL]! ? 1 : 0;
    s[MOVING] = dist(ax[0]! - bx, ay[0]! - by) > 0.01 ? 1 : 0;
    if (s[MOVING]) s[RUN_T]! += Math.max(0, dt);
    if (!s[ATTACHED]) af[0] = at[0] = closest(g, ax[0]!, ay[0]!);
    if (!s[REMAINING]) {
      s[TRANSITION] = 1.25;
      s[SCORE]! += 500 * s[WAVE]!;
      e.events.emit("level-clear", s[WAVE]!, 500 * s[WAVE]!, vx(ax[0]!), vy(ay[0]!), s[SCORE]!);
      return;
    }
    // Bonus fruit: twice a level, at 30 % and 70 % eaten (or on its timer), for 18 s.
    s[FRUIT_IN]! -= dt;
    const progress = s[COLLECTED]! / Math.max(1, s[TOTAL]!);
    if (!s[FRUIT] && s[FRUIT_COUNT]! < 2 && (s[FRUIT_IN]! <= 0 || progress >= (s[FRUIT_COUNT] ? 0.7 : 0.3))) {
      const from = af[0]!, count = g.n - (from >= 0 && from < g.n ? 1 : 0);
      if (count > 0) {
        let pick = Math.floor(e.random() * count), cell = 0;
        for (let k = 0; k < g.n; k++) if (k !== from && pick-- === 0) (cell = k), (k = g.n);
        s[FRUIT] = 1; s[FRUIT_X] = g.x[cell]!; s[FRUIT_Y] = g.y[cell]!; s[FRUIT_KIND] = s[FRUIT_COUNT]!; s[FRUIT_LIFE] = 18;
        s[FRUIT_COUNT]!++;
        s[FRUIT_IN] = 22;
        e.events.emit("pickup-spawn", 0);
      }
    }
    if (s[FRUIT] && (s[FRUIT_LIFE]! -= dt) <= 0) s[FRUIT] = 0;
    if (!s[POWER] && (s[SPAWN_IN]! -= dt) <= 0) spawnFly(), (s[SPAWN_IN] = 1.15);
    // The gates are the page's buttons: their fill shows the power time left.
    const hp = s[POWER]! > 0 ? 100 * (1 - s[POWER]! / s[SEAL]!) : 100;
    for (let i = 0; i < board.targets.length; i++) board.targets[i]!.hp = hp;
    // Chase fields: steps to the frog, and to three cells ahead of it (the second kind cuts it off).
    if ((s[CHASE_IN]! -= dt) <= 0) {
      s[CHASE_IN] = 0.2;
      let to = at[0]!;
      for (let k = 0; k < 3; k++) {
        const x = exitToward(g, to, ad[0]!);
        if (x >= 0) to = x;
      }
      distances(g, at[0]!, near, queue);
      distances(g, to, ahead, queue);
    }
    for (let j = n[GN]! - 1; j >= 0; j--) {
      const i = j + 1, field = gkind[j] === 1 ? ahead : near;
      ghop[j]! -= dt;
      if (gland[j]! < 0 && ghop[j]! <= 0) {
        ghop[j] = 5 + e.random() * 5;
        // Occasional short escapes reconnect to a visible pipe; never off the page.
        let count = 0;
        for (let k = 0; k < g.n; k++) if (hopCell(k, j, field)) count++;
        if (count) {
          let pick = Math.floor(e.random() * count);
          for (let k = 0; k < g.n; k++) if (hopCell(k, j, field) && pick-- === 0) (gland[j] = k), (k = g.n);
        }
      }
      if (gland[j]! >= 0) {
        const to = gland[j]!, d = dist(g.x[to]! - ax[i]!, g.y[to]! - ay[i]!), len = Math.min(d, 145 * dt);
        ad[i] = dirOf(ax[i]!, ay[i]!, g.x[to]!, g.y[to]!);
        if (d <= len) place(i, to), (gland[j] = NOT);
        else (ax[i]! += ((g.x[to]! - ax[i]!) * len) / d), (ay[i]! += ((g.y[to]! - ay[i]!) * len) / d);
      } else advance(i, (s[POWER] ? 78 : Math.min(170, 90 + s[WAVE]! * 5 + gkind[j]! * 5)) * dt, field);
      const grab = s[POWER]! > 0 && tongueTarget(ax[i]!, ay[i]!) && !blocked(ax[0]!, ay[0]!, ax[i]!, ay[i]!, 5);
      if (!grab && dist(ax[0]! - ax[i]!, ay[0]! - ay[i]!) >= 23) continue;
      if (s[POWER]! > 0) {
        chomp();
        s[TONGUE_UNTIL] = s[TIME]! + 0.18;
        s[TONGUE] = 1; s[TONGUE_X] = ax[i]!; s[TONGUE_Y] = ay[i]!;
        s[COMBO]!++;
        const value = 100 * Math.min(s[COMBO]!, 4);
        s[SCORE]! += value;
        e.events.emit("ghost-eaten", value, s[COMBO]!, vx(ax[i]!), vy(ay[i]!), s[SCORE]!);
        removeFly(j);
      } else if (s[SHIELD]! <= 0) {
        s[LIVES]!--;
        e.events.emit("hurt", s[LIVES]!, 0, vx(ax[i]!), vy(ay[i]!));
        if (s[LIVES]! <= 0) {
          s[OVER] = 1;
          e.events.emit("over", 0, s[SCORE]!);
          return;
        }
        resetFrog();
        s[RUN_T] = s[CHOMP] = 0;
        n[GN] = 0;
        s[SHIELD] = 2.5;
        s[SPAWN_IN] = 1.2;
        break;
      }
    }
  }
  const system: System = { step: (_e, dt) => step(dt) };
  e.add(system);

  return {
    s,
    ctl,
    /** Actors (0 the frog, k + 1 fly k) and the flies. */
    actors: { x: ax, y: ay, from: af, to: at, offset: ao, dir: ad },
    flies: {
      get count() {
        return n[GN]!;
      },
      id: gid,
      kind: gkind,
      phase: gphase,
    },
    /** The maze being played (typed; replaced on load). */
    get graph() {
      return g;
    },
    reset,
    load,
    step,
    system,
    /** Power food still on the trails. */
    powerLeft() {
      let k = 0;
      for (let p = 0; p < g.pn; p++) if (g.power[p] && !g.eaten[p]) k++;
      return k;
    },
    viewport: { x: vx, y: vy },
  };
}
export type World = ReturnType<typeof createWorld>;
