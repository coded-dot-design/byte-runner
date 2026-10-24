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
import { catchTrail, runPipe, tongueTarget } from "./movement.js";
import { createRunnerAnimation, moveAnimation } from "./animation.js";

interface Ghost extends Actor {
  id: number;
  kind: number;
  phase: number;
  hopIn: number;
  landing: number;
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
  let attached = true,
    jumpUntil = 0,
    lastInput = -1,
    lastTap = -1,
    tapAt = -1,
    layoutKey = "",
    revision = 0;
  let geometryIn = 0,
    chaseIn = 0;
  let fields: Int16Array[] = [];
  let sealDuration = 6,
    terrainReady = false;
  let food = new Map<string, Pellet[]>();
  const bin = (p: Point) => `${Math.floor(p.x / 36)},${Math.floor(p.y / 36)}`;
  const event = (type: string, data: Record<string, unknown> = {}) =>
    api.emit(type, data);
  const keepInView = (p: Point): Point => ({
    x: clamp(p.x, 15, frame.width - 15),
    y: clamp(p.y, 18, frame.height - 18),
  });
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
      seededRandom(seed + wave * 7919 + revision * 3571),
      nextFrame.text,
    );
    // A temporarily occluded root must not count as a cleared level.
    if (nextMaze.cells.length < 2 || !nextMaze.pellets.length) {
      terrainReady = false;
      view.visible(false);
      if (!maze) {
        maze = nextMaze;
        frame = nextFrame;
        view.mount(maze, frame);
      }
      return false;
    }
    layoutKey = view.geometryKey();
    terrainReady = true;
    view.visible(true);
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
    Object.assign(player, keepInView(player));
    requested = -1;
    attached = true;
    jumpUntil = 0;
    lastInput = lastTap = -1;
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
      Object.assign(player, keepInView(point));
      const caught = catchTrail(maze, player, oldPlayer.direction, Infinity);
      if (caught) Object.assign(player, caught);
      player.direction = oldPlayer.direction;
    }
    for (const g of oldGhosts) {
      const cell = closest(maze, view.local(g.screen));
      ghosts.push({
        ...actorAt(maze, cell),
        id: g.id,
        kind: g.kind,
        phase: g.phase,
        hopIn: g.hopIn,
        landing: -1,
        direction: g.direction,
      });
    }
    if (!preserve) for (let i = 0; i < 5; i++) spawnGhost();
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
    revision = 0;
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
      ghosts.length >= Math.min(MAX_GHOSTS, 9 + Math.floor((wave - 1) / 2))
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
      hopIn: 4 + api.random() * 5,
      landing: -1,
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
      if (!terrainReady || view.geometryKey() !== layoutKey) generate(!!player);
    }

    view.syncPosition();
    if (!terrainReady || !player || maze.cells.length < 2) return;
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
    // A second press (not key repeat or a held direction) deliberately breaks out.
    const turnPressed = nextDirection >= 0 && nextDirection !== lastInput;
    if (turnPressed) {
      if (lastTap === nextDirection && api.time - tapAt < 0.26)
        jump(nextDirection);
      lastTap = nextDirection;
      tapAt = api.time;
    }
    lastInput = nextDirection;
    if (nextDirection >= 0) requested = nextDirection;
    if (attached && nextDirection >= 0) {
      runPipe(
        maze,
        player,
        requested,
        (Math.min(300, 230 + wave * 7) * dt) /
          Math.max(frame.scaleX, frame.scaleY),
        collect,
        turnPressed,
      );
    } else if (!attached && (nextDirection >= 0 || api.time < jumpUntil)) {
      player.direction =
        nextDirection >= 0 ? nextDirection : Math.max(0, player.direction);
      const [dx, dy] = DIRECTIONS[player.direction]!;
      let travel = (api.time < jumpUntil ? 280 : 185) * dt;
      while (travel > 0.001) {
        const step = Math.min(5, travel);
        travel -= step;
        const next = keepInView({
          x: player.x + (dx * step) / frame.scaleX,
          y: player.y + (dy * step) / frame.scaleY,
        });
        if (blocked(player, next, frame.solids, 15)) break;
        Object.assign(player, next);
        collect(player);
        if (api.time >= jumpUntil) {
          const caught = catchTrail(maze, player, player.direction);
          if (caught && !blocked(player, caught, frame.solids, 15)) {
            Object.assign(player, caught);
            attached = true;
            break;
          }
        }
      }
    }
    animation.jumping = api.time < jumpUntil;
    moveAnimation(
      animation,
      player.x - beforeMove.x,
      player.y - beforeMove.y,
      dt,
    );
    if (!attached) player.from = player.to = closest(maze, player);
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
      g.hopIn -= dt;
      if (g.landing < 0 && g.hopIn <= 0) {
        g.hopIn = 5 + api.random() * 5;
        // Occasional short escapes reconnect to a visible pipe; never fly off-page.
        const choices = maze.cells.filter((c) => {
          const d = Math.hypot(c.x - g.x, c.y - g.y);
          return (
            d > 45 &&
            d < 180 &&
            Math.abs(c.x - g.x) > 18 &&
            Math.abs(c.y - g.y) > 18 &&
            !blocked(g, c, frame.solids, 15) &&
            (power ? field[c.id]! > field[g.to]! : field[c.id]! < field[g.to]!)
          );
        });
        if (choices.length)
          g.landing = choices[Math.floor(api.random() * choices.length)]!.id;
      }
      if (g.landing >= 0) {
        const target = maze.cells[g.landing]!,
          distance = Math.hypot(target.x - g.x, target.y - g.y),
          step = Math.min(distance, 145 * dt);
        g.direction = direction(g, target);
        if (distance <= step) {
          Object.assign(g, actorAt(maze, g.landing));
          g.landing = -1;
        } else {
          g.x += ((target.x - g.x) * step) / distance;
          g.y += ((target.y - g.y) * step) / distance;
        }
      } else
        advance(
          maze,
          g,
          (power ? 78 : Math.min(170, 90 + wave * 5 + g.kind * 5)) * dt,
          (cell) => {
            const forward = cell.exits.filter(
              (id) =>
                direction(cell, maze.cells[id]!) !== opposite(g.direction),
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
      const grab =
        power > 0 &&
        tongueTarget(player, g) &&
        !blocked(player, g, frame.solids, 5);
      if (grab || Math.hypot(player.x - g.x, player.y - g.y) < 23) {
        const at = view.viewport(g);
        if (power > 0) {
          animation.chompUntil = api.time + 0.3;
          animation.tongueUntil = api.time + 0.18;
          animation.tongue = { x: g.x, y: g.y };
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
          Object.assign(player, keepInView(player));
          requested = -1;
          attached = true;
          jumpUntil = 0;
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
  function jump(heading = inputDirection()) {
    if (!player || !terrainReady || transition > 0) return;
    if (heading >= 0) player.direction = heading;
    else if (player.direction < 0) player.direction = 0;
    attached = false;
    jumpUntil = api.time + 0.24;
  }
  return {
    reset,
    action(id: string) {
      if (id === "jump") jump();
      if (id === "refresh" && transition <= 0) {
        revision++;
        generate(!!player);
      }
    },
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
        detail:
          !terrainReady || !player
            ? "Scroll to an open part of the page to find food trails"
            : transition > 0
              ? `LEVEL ${wave} CLEAR · Next trails incoming`
              : `${remaining} PELLETS LEFT · ${power > 0 ? `POWER ${power.toFixed(1)}s · Hunt flies` : "Arrows / WASD · Space / double-tap to jump"}`,
      };
    },
  };
}
