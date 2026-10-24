import type {
  GameContext,
  GameSimulation,
  GameStats,
  Player,
} from "@coded-design/dom-virus";
import { seededRandom, clamp } from "@coded-design/dom-virus";
import {
  actorAt,
  advance,
  closest,
  direction,
  distances,
  makeMaze,
  opposite,
  reverse,
  blocked,
  DIRECTIONS,
} from "./maze.js";
import type { Actor, Maze, Pellet, Point } from "./maze.js";
import { createPresentation } from "./presentation.js";
import type { Frame } from "./presentation.js";
import { MAX_GHOSTS, extendPower } from "./rules.js";
import { eatPellet, refillPellet, PELLET_RETURN_SECONDS } from "./food.js";
import { createRunnerAnimation, moveAnimation } from "./animation.js";

interface Ghost extends Actor {
  id: number;
  kind: number;
  phase: number;
}
interface Fruit extends Point {
  kind: number;
  life: number;
}
export interface ByteRunnerStats extends GameStats {
  score: number;
  lives: number;
  wave: number;
  eaten: number;
  power: number;
  alive: number;
  pickups: number;
  player: Player;
  detail: string;
  pellets: number;
  pelletsRemaining: number;
  pelletsTotal: number;
  powerPellets: number;
}
export function createGame(api: GameContext): GameSimulation<ByteRunnerStats> {
  const view = createPresentation(api);
  let animation = createRunnerAnimation(),
    sequence = 0;
  const seed = Math.floor(api.random() * 0x7fffffff);
  let maze: Maze,
    frame: Frame,
    player: Actor | null = null;
  let ghosts: Ghost[] = [],
    fruit: Fruit | null = null;
  let score = 0,
    lives = 3,
    wave = 1,
    eaten = 0,
    power = 0,
    shield = 2.5,
    combo = 0;
  let remaining = 0,
    collected = 0,
    total = 0;
  let requested = -1,
    transition = 0,
    spawnIn = 1.2,
    fruitIn = 14,
    fruitCount = 0;
  let geometryIn = 0,
    pendingKey = "",
    chaseIn = 0;
  let fields: Int16Array[] = [];
  let sealDuration = 6;
  let food = new Map<string, Pellet[]>();
  const bin = (p: Point) => `${Math.floor(p.x / 36)},${Math.floor(p.y / 36)}`;
  const event = (type: string, data: Record<string, unknown> = {}) =>
    api.emit(type, data);
  function generate(preserve = false, nextFrame = view.measure()) {
    const oldFood = maze?.pellets ?? [];
    const oldRemaining = remaining,
      oldTotal = maze?.pellets.length || 1;
    const oldPlayer =
      player && preserve
        ? { ...view.viewport(player), direction: player.direction }
        : null;
    const oldGhosts = preserve
        ? ghosts.map((g) => ({ ...g, screen: view.viewport(g) }))
        : [],
      oldFruit = fruit;
    const nextMaze = makeMaze(
      nextFrame.width,
      nextFrame.height,
      nextFrame.walls,
      seededRandom(seed + wave * 7919),
      nextFrame.text,
    );
    // A temporarily occluded root must not count as a cleared level.
    if (nextMaze.cells.length < 2 || !nextMaze.pellets.length) {
      if (!maze) {
        maze = nextMaze;
        frame = nextFrame;
        view.mount(maze, frame);
      }
      return false;
    }
    maze = nextMaze;
    frame = nextFrame;
    if (preserve) {
      const target = Math.max(
        1,
        Math.round((maze.pellets.length * oldRemaining) / oldTotal),
      );
      // Spread remaining food evenly. A scroll/resize never scores or refills a level.
      const cleared = Math.max(0, maze.pellets.length - target);
      const oldCleared = oldFood.filter((p) => p.cleared);
      const oldEaten = oldCleared.filter((p) => p.eaten);
      const eatenShare = oldEaten.length / Math.max(1, oldCleared.length);
      const due = oldEaten.length
        ? Math.min(...oldEaten.map((p) => p.respawnAt))
        : api.time + PELLET_RETURN_SECONDS;
      let count = 0;
      maze.pellets.forEach((p, i) => {
        p.cleared =
          Math.floor(((i + 1) * cleared) / maze.pellets.length) !==
          Math.floor((i * cleared) / maze.pellets.length);
        if (p.cleared) {
          p.eaten =
            Math.floor((count + 1) * eatenShare) !==
            Math.floor(count * eatenShare);
          p.respawnAt = Math.max(api.time, due);
          count++;
        }
      });
    } else {
      collected = 0;
      fruitCount = 0;
      fruitIn = 14;
    }
    remaining = maze.pellets.filter((p) => !p.cleared).length;
    total = collected + remaining;
    food = new Map();
    for (const p of maze.pellets) {
      const key = bin(p);
      const group = food.get(key) ?? [];
      group.push(p);
      food.set(key, group);
    }
    player = actorAt(maze, maze.start);
    requested = -1;
    animation.moving = false;
    if (!preserve) {
      animation.runTime = 0;
      animation.chompUntil = 0;
    }
    ghosts = [];
    fruit = null;
    spawnIn = 1.2;
    shield = Math.max(shield, preserve ? 0.6 : 2);
    chaseIn = 0;
    if (preserve) {
      // Reflow preserves fly identities and wing phases. It is not locomotion.
      if (oldFruit) {
        const cell = maze.cells[closest(maze, oldFruit)]!;
        fruit = { ...oldFruit, x: cell.x, y: cell.y };
      }
    }
    view.mount(maze, frame);
    view.syncPosition();
    if (oldPlayer) {
      const point = view.local(oldPlayer);
      player.x = clamp(point.x, 14, frame.width - 14);
      player.y = clamp(point.y, 14, frame.height - 14);
      player.from = player.to = closest(maze, player);
      player.direction = oldPlayer.direction;
    }
    for (const g of oldGhosts) {
      const cell = closest(maze, view.local(g.screen));
      ghosts.push({
        ...actorAt(maze, cell),
        id: g.id,
        kind: g.kind,
        phase: g.phase,
        direction: g.direction,
      });
    }
    if (!preserve) for (let i = 0; i < 3; i++) spawnGhost();
    event(preserve ? "maze-reflow" : "level-start", {
      wave,
      pellets: remaining,
      walls: frame.walls.length,
    });
    return true;
  }
  function reset() {
    animation = createRunnerAnimation();
    sequence = 0;
    score = 0;
    lives = 3;
    wave = 1;
    eaten = 0;
    power = 0;
    shield = 2.5;
    combo = 0;
    remaining = 0;
    collected = 0;
    total = 0;
    transition = 0;
    geometryIn = 0;
    pendingKey = "";
    fruitCount = 0;
    api.board.resetTargets(100);
    generate();
  }
  function collect(point: Point) {
    const x = Math.floor(point.x / 36),
      y = Math.floor(point.y / 36);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const p of food.get(`${x + dx},${y + dy}`) ?? []) {
          if (p.eaten || Math.hypot(p.x - point.x, p.y - point.y) > 12)
            continue;
          const first = eatPellet(p, api.time);
          animation.chompUntil = api.time + 0.3;
          if (first) {
            remaining--;
            collected++;
          }
          score += p.power ? 50 : 10;
          view.eat(p.id);
          if (p.power) {
            power = extendPower(power);
            sealDuration = power;
            combo = 0;
            ghosts.forEach((g) => reverse(maze, g));
            const at = view.viewport(p);
            api.burst(at.x, at.y, "#f4457a", 10);
            event("power", { seconds: power });
          }
          event("pellet", { remaining, power: p.power, score });
        }
    // Letters are optional bonus food along the actual corridor, never replaced sprites.
    const at = view.viewport(point);
    let consumed = 0;
    for (const glyph of api.board.near(at.x, at.y, 13)) {
      if (consumed >= 2) break;
      if (api.board.consume(glyph, "binary")) {
        animation.chompUntil = api.time + 0.3;
        eaten++;
        score += 5;
        consumed++;
        event("letter", { eaten, score });
      }
    }
    if (fruit && Math.hypot(fruit.x - point.x, fruit.y - point.y) < 18) {
      const bonus = (fruit.kind ? 300 : 100) * wave;
      score += bonus;
      animation.chompUntil = api.time + 0.3;
      api.popup(at.x, at.y, `+${bonus}`, "score");
      fruit = null;
      event("fruit", { score });
    }
  }
  function spawnGhost() {
    if (
      !player ||
      ghosts.length >= Math.min(MAX_GHOSTS, 6 + Math.floor((wave - 1) / 2))
    )
      return;
    const field = distances(maze, player.to);
    const far = maze.cells.filter(
      (c) =>
        field[c.id]! >= 2 &&
        Math.hypot(c.x - player!.x, c.y - player!.y) >=
          Math.min(220, Math.max(100, frame.width * 0.25)) &&
        ghosts.every((g) => Math.hypot(c.x - g.x, c.y - g.y) > 40),
    );
    if (!far.length) return;
    const cell = far[Math.floor(api.random() * far.length)]!;
    ghosts.push({
      ...actorAt(maze, cell.id),
      id: sequence++,
      kind: ghosts.length % 3,
      phase: (sequence * 0.381966 + api.random()) % 1,
    });
    event("spawn");
  }
  function inputDirection() {
    let value = -1;
    for (const key of api.input.keys) {
      if (key === "ArrowRight" || key === "KeyD") value = 0;
      if (key === "ArrowDown" || key === "KeyS") value = 1;
      if (key === "ArrowLeft" || key === "KeyA") value = 2;
      if (key === "ArrowUp" || key === "KeyW") value = 3;
    }
    if (
      value < 0 &&
      api.input.mode === "mouse" &&
      api.input.pointer.active &&
      player
    )
      value = direction(view.viewport(player), api.input.pointer);
    return value;
  }
  function update(dt: number) {
    view.syncPosition();
    geometryIn -= dt;
    if (geometryIn <= 0) {
      geometryIn = 0.35;
      const next = view.measure();
      if (next.key !== frame.key) {
        if (pendingKey === next.key) {
          generate(!!player, next);
          pendingKey = "";
        } else pendingKey = next.key;
      } else pendingKey = "";
    }
    view.syncPosition();
    if (!player || maze.cells.length < 2) return;
    if (transition > 0) {
      animation.moving = false;
      transition -= dt;
      if (transition <= 0) {
        wave++;
        power = 0;
        generate();
      }
      return;
    }
    // Refills reuse the same SVG nodes and graph. A pause also pauses their clock.
    for (const p of maze.pellets)
      if (refillPellet(p, api.time)) view.refill(p.id);
    shield = Math.max(0, shield - dt);
    const wasPowered = power > 0;
    power = Math.max(0, power - dt);
    if (wasPowered && power === 0) {
      combo = 0;
      event("power-end");
    }
    const nextDirection = inputDirection(),
      beforeMove = { x: player.x, y: player.y };
    // Food trails guide exploration; no synthetic maze wall locks the player in.
    if (nextDirection >= 0) {
      requested = nextDirection;
      player.direction = requested;
      const [dx, dy] = DIRECTIONS[requested]!;
      let travel = Math.min(220, 155 + wave * 6) * dt;
      while (travel > 0.001) {
        const step = Math.min(6, travel);
        travel -= step;
        const next = {
          x: clamp(player.x + (dx * step) / frame.scaleX, 14, frame.width - 14),
          y: clamp(
            player.y + (dy * step) / frame.scaleY,
            14,
            frame.height - 14,
          ),
        };
        if (blocked(player, next, frame.solids, 15)) break;
        player.x = next.x;
        player.y = next.y;
        collect(player);
      }
    }
    moveAnimation(
      animation,
      player.x - beforeMove.x,
      player.y - beforeMove.y,
      dt,
    );
    player.from = player.to = closest(maze, player);
    if (!remaining) {
      transition = 1.25;
      score += 500 * wave;
      const at = view.viewport(player);
      api.popup(at.x, at.y, `LEVEL ${wave} CLEAR +${500 * wave}`, "upgrade");
      event("level-clear", { wave, score });
      return;
    }
    fruitIn -= dt;
    const progress = collected / Math.max(1, total);
    if (
      !fruit &&
      fruitCount < 2 &&
      (fruitIn <= 0 || progress >= (fruitCount ? 0.7 : 0.3))
    ) {
      const choices = maze.cells.filter((c) => c.id !== player!.from);
      const cell = choices[Math.floor(api.random() * choices.length)];
      if (cell) {
        fruit = { x: cell.x, y: cell.y, kind: fruitCount, life: 18 };
        fruitCount++;
        fruitIn = 22;
        event("pickup-spawn", { kind: "fruit" });
      }
    }
    if (fruit) {
      fruit.life -= dt;
      if (fruit.life <= 0) fruit = null;
    }
    if (!power) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnGhost();
        spawnIn = 1.15;
      }
    }
    // These are the actual gate buttons: their native fill reflects power time.
    for (const gate of api.board.targets)
      gate.health = power > 0 ? 100 * (1 - power / sealDuration) : 100;
    chaseIn -= dt;
    if (chaseIn <= 0) {
      chaseIn = 0.2;
      let ahead = player.to;
      for (let n = 0; n < 3; n++)
        ahead =
          maze.cells[ahead]!.exits.find(
            (id) =>
              direction(maze.cells[ahead]!, maze.cells[id]!) ===
              player!.direction,
          ) ?? ahead;
      fields = [distances(maze, player.to), distances(maze, ahead)];
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i]!,
        field = fields[g.kind === 1 ? 1 : 0]!;
      advance(
        maze,
        g,
        (power ? 78 : Math.min(170, 90 + wave * 5 + g.kind * 5)) * dt,
        (cell) => {
          const forward = cell.exits.filter(
            (id) => direction(cell, maze.cells[id]!) !== opposite(g.direction),
          );
          const choices = forward.length ? forward : cell.exits;
          if (g.kind === 2 && !power && api.random() < 0.2)
            return choices[Math.floor(api.random() * choices.length)];
          return choices
            .slice()
            .sort((a, b) =>
              power ? field[b]! - field[a]! : field[a]! - field[b]!,
            )[0];
        },
      );
      if (Math.hypot(player.x - g.x, player.y - g.y) < 23) {
        const at = view.viewport(g);
        if (power > 0) {
          animation.chompUntil = api.time + 0.3;
          combo++;
          const value = 100 * Math.min(combo, 4);
          score += value;
          ghosts.splice(i, 1);
          api.popup(at.x, at.y, `+${value}`, "score");
          event("ghost-eaten", { score, combo });
        } else if (shield <= 0) {
          lives--;
          event("hurt", { lives });
          api.burst(at.x, at.y, "#ee6875", 12);
          if (lives <= 0) {
            api.finish();
            return;
          }
          player = actorAt(maze, maze.start);
          requested = -1;
          animation.moving = false;
          animation.runTime = 0;
          animation.chompUntil = 0;
          ghosts = [];
          shield = 2.5;
          spawnIn = 1.2;
          break;
        }
      }
    }
  }
  return {
    reset,
    update,
    draw() {
      view.render(player, ghosts, power, shield, fruit, animation);
    },
    // The maze, food and actors are descendants of the page root. Scroll is native.
    snapshot() {
      const at = player ? view.viewport(player) : { x: 0, y: 0 };
      return {
        score,
        lives,
        wave,
        eaten,
        power,
        alive: ghosts.length,
        pickups:
          (maze?.pellets.filter((p) => p.power && !p.eaten).length ?? 0) +
          Number(!!fruit),
        pellets: collected,
        pelletsRemaining: remaining,
        pelletsTotal: total,
        powerPellets:
          maze?.pellets.filter((p) => p.power && !p.eaten).length ?? 0,
        player: {
          ...at,
          angle: (Math.max(0, player?.direction ?? 0) * Math.PI) / 2,
        },
        detail: !player
          ? "Scroll to an open part of the page to find food trails"
          : transition > 0
            ? `LEVEL ${wave} CLEAR · Next trails incoming`
            : `${remaining} PELLETS LEFT · ${power > 0 ? `POWER ${power.toFixed(1)}s · Hunt flies` : "Arrows / WASD · Follow the bites · Fruit = bonus"}`,
      };
    },
  };
}
