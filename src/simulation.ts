import type {
  GameContext,
  GameSimulation,
  GameStats,
  Player,
  Point,
} from "@coded-design/dom-virus";
interface Ghost extends Point {
  age: number;
  kind: number;
  phase: number;
}
interface Pickup extends Point {
  kind: "orb" | "fruit";
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
}
import {
  clamp,
  distance,
  EntityPool,
  chooseSpawn,
  translateEntities,
} from "@coded-design/dom-virus";
import { MAX_GHOSTS, spawnInterval, earnsOrb, extendPower } from "./rules.js";

export function createGame(api: GameContext): GameSimulation<ByteRunnerStats> {
  let player: Player = { x: 0, y: 0, angle: 0 };
  const ghostPool = new EntityPool<Ghost>(MAX_GHOSTS, () => ({
    x: 0,
    y: 0,
    age: 0,
    kind: 0,
    phase: 0,
  }));
  const pickupPool = new EntityPool<Pickup>(4, () => ({
    x: 0,
    y: 0,
    kind: "orb",
    life: 0,
  }));
  const ghosts = ghostPool.active,
    pickups = pickupPool.active;
  const old: Point = { x: 0, y: 0 };
  let score = 0,
    lives = 3,
    wave = 1,
    eaten = 0,
    power = 0,
    spawnIn = 2,
    fruitIn = 14,
    shield = 2,
    combo = 0;
  let sealDuration = 6;
  const reset = () => {
    player = { x: api.width * 0.45, y: api.height * 0.45, angle: 0 };
    ghostPool.clear();
    pickupPool.clear();
    api.board.resetTargets(100);
    score = 0;
    lives = 3;
    wave = 1;
    eaten = 0;
    power = 0;
    spawnIn = 2;
    fruitIn = 14;
    shield = 2;
    combo = 0;
  };
  function spawn() {
    if (ghosts.length >= MAX_GHOSTS) return;
    const spawn = chooseSpawn(api.board.targets, api.random, api.width, 16);
    if (!spawn) return;
    const g = ghostPool.acquire();
    if (!g) return;
    Object.assign(g, {
      x: spawn.x,
      y: spawn.y,
      age: 0,
      kind: Math.floor(api.random() * 3),
      phase: api.random() * 6.28,
    });
    api.emit("spawn", { target: spawn.target?.id });
  }
  function pickup(kind: Pickup["kind"] = "orb") {
    const item = pickupPool.acquire();
    if (!item) return;
    const angle = api.random() * Math.PI * 2;
    Object.assign(item, {
      x: clamp(player.x + Math.cos(angle) * 70, 25, api.width - 25),
      y: clamp(player.y + Math.sin(angle) * 70, 80, api.height - 25),
      kind,
      life: 12,
    });
    api.emit("pickup-spawn", { kind });
  }
  function update(dt: number) {
    old.x = player.x;
    old.y = player.y;
    api.move(player, dt, 260, true); // Last pressed direction wins; no diagonal shortcuts.
    shield = Math.max(0, shield - dt);
    const before = power;
    power = Math.max(0, power - dt);
    wave = 1 + Math.floor(api.time / 22);
    if (before > 0 && power === 0) {
      spawnIn = 0.7;
      combo = 0;
      api.emit("power-end");
    }
    // Sample movement so a low frame rate cannot skip a line of edible text.
    const steps = Math.max(1, Math.ceil(distance(old, player) / 7));
    let consumed = 0;
    for (let s = 1; s <= steps; s++)
      for (const g of api.board.near(
        old.x + ((player.x - old.x) * s) / steps,
        old.y + ((player.y - old.y) * s) / steps,
        7,
      )) {
        if (consumed >= 6) break;
        if (g.rect && api.board.consume(g, "binary")) {
          eaten++;
          score += 10;
          consumed++;
          api.burst(
            g.rect.left + g.rect.width / 2,
            g.rect.top + g.rect.height / 2,
            "#cbff69",
            3,
          );
          if (earnsOrb(eaten)) pickup();
          api.emit("letter", { eaten, score });
        }
      }
    fruitIn -= dt;
    if (fruitIn <= 0) {
      fruitIn = 18;
      pickup("fruit");
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]!;
      p.life -= dt;
      if (distance(player, p) < 23) {
        power = extendPower(power);
        sealDuration = power;
        for (const gate of api.board.targets)
          api.board.damage(gate, gate.health);
        score += p.kind === "fruit" ? 100 : 25;
        pickupPool.releaseAt(i);
        api.burst(p.x, p.y, "#cbff69", 12);
        api.emit("power", { seconds: power });
      } else if (p.life <= 0) pickupPool.releaseAt(i);
    }
    // The real button fill is the gate lock timer: empty while newly sealed,
    // refilling as overclock expires. Spawning resumes only when fully open.
    for (const gate of api.board.targets)
      gate.health = power > 0 ? 100 * (1 - power / sealDuration) : 100;
    if (power <= 0) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = spawnInterval(wave);
        for (let i = 0; i < Math.min(3, 1 + Math.floor(wave / 3)); i++) spawn();
      }
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i]!;
      g.age += dt;
      const aimX = player.x + (g.kind === 1 ? Math.cos(player.angle) * 60 : 0),
        aimY = player.y + (g.kind === 1 ? Math.sin(player.angle) * 60 : 0);
      let a = Math.atan2(aimY - g.y, aimX - g.x);
      if (power > 0) a += Math.PI;
      const speed = power > 0 ? 65 : Math.min(205, 55 + wave * 9 + g.kind * 10);
      g.x += Math.cos(a) * speed * dt;
      g.y += Math.sin(a) * speed * dt;
      if (power > 0) {
        g.x = clamp(g.x, 14, api.width - 14);
        g.y = clamp(g.y, 14, api.height - 14);
      }
      if (distance(player, g) < 23) {
        if (power > 0) {
          combo++;
          score += 100 * Math.min(combo, 4);
          api.burst(g.x, g.y, "#b8a0ff", 12);
          ghostPool.releaseAt(i);
          api.emit("ghost-eaten", { score, combo });
        } else if (shield <= 0) {
          lives--;
          shield = 2.5;
          api.burst(player.x, player.y, "#ff8b92", 15);
          ghostPool.releaseAt(i);
          api.emit("hurt", { lives });
          if (lives <= 0) {
            api.finish();
            return;
          }
        }
      } else if (
        g.y < -api.height ||
        g.y > api.height * 2 ||
        g.x < -api.width ||
        g.x > api.width * 2
      ) {
        ghostPool.releaseAt(i);
      }
    }
  }
  function draw(ctx: CanvasRenderingContext2D) {
    for (const t of api.board.targets)
      if (t.visible && t.rect) {
        const r = t.rect;
        ctx.save();
        ctx.strokeStyle = power > 0 ? "#cbff69" : "#b899ff";
        ctx.lineWidth = 2;
        ctx.setLineDash(power > 0 ? [4, 5] : []);
        ctx.strokeRect(r.left - 3, r.top - 3, r.width + 6, r.height + 6);
        ctx.restore();
      }
    for (const p of pickups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.kind === "fruit" ? "#ff9dce" : "#e4ff9f";
      ctx.strokeStyle = "#142522";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (p.kind === "fruit") {
        ctx.moveTo(0, -12);
        ctx.lineTo(11, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-11, 0);
        ctx.closePath();
      } else
        ctx.arc(
          0,
          0,
          9 + (api.reducedMotion ? 0 : Math.sin(api.time * 5)),
          0,
          Math.PI * 2,
        );
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const g of ghosts) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle =
        power > 0
          ? "#70a9ef"
          : (["#b491ff", "#ff9fba", "#7de2da"][g.kind] ?? "#b491ff");
      ctx.strokeStyle = "#191627";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 11);
      ctx.lineTo(-12, -2);
      ctx.quadraticCurveTo(-12, -15, 0, -15);
      ctx.quadraticCurveTo(12, -15, 12, -2);
      ctx.lineTo(12, 11);
      for (let x = 12; x >= -12; x -= 6)
        ctx.lineTo(
          x,
          8 + (api.reducedMotion ? 2 : Math.sin(g.age * 8 + x) * 3),
        );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0c1530";
      ctx.fillRect(-6, -5, 4, 5);
      ctx.fillRect(3, -5, 4, 5);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    if (shield > 0 || power > 0) {
      ctx.strokeStyle = power > 0 ? "#caff7a" : "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    const jaw = api.reducedMotion
      ? 4
      : 3 + Math.abs(Math.sin(api.time * 11)) * 7;
    ctx.fillStyle = power > 0 ? "#eeffb3" : "#cbff69";
    ctx.strokeStyle = "#13271d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(0, -16);
    ctx.lineTo(16, -jaw);
    ctx.lineTo(1, 0);
    ctx.lineTo(16, jaw);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#13271d";
    ctx.fillRect(-3, -10, 3, 3);
    ctx.restore();
  }
  return {
    reset,
    update,
    draw,
    scroll(dx, dy) {
      translateEntities(ghosts, dx, dy);
      translateEntities(pickups, dx, dy);
    },
    snapshot() {
      return {
        score,
        lives,
        wave,
        eaten,
        power,
        alive: ghosts.length,
        pickups: pickups.length,
        player: { ...player },
        detail:
          power > 0
            ? `OVERCLOCK ${power.toFixed(1)}s · Gates sealed · Eat ghosts`
            : `${eaten % 6}/6 LETTERS → ORB · Arrows / WASD to move`,
      };
    },
  };
}
