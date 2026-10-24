import { advance, direction, opposite, reverse, DIRECTIONS } from "./maze.js";
import type { Actor, Maze, Point } from "./maze.js";

/** Project onto an edge, not its endpoints: catching a pipe never skips food. */
export function catchTrail(
  maze: Maze,
  point: Point,
  heading: number,
  radius = 10,
): Actor | null {
  let best: Actor | null = null,
    distance = radius;
  for (const a of maze.cells)
    for (const id of a.exits) {
      if (id < a.id) continue;
      const b = maze.cells[id]!,
        length = Math.hypot(b.x - a.x, b.y - a.y);
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) /
            (length * length),
        ),
      );
      const x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t,
        d = Math.hypot(x - point.x, y - point.y);
      if (d > distance) continue;
      distance = d;
      best = {
        x,
        y,
        from: a.id,
        to: b.id,
        offset: t * length,
        direction: direction(a, b),
      };
      if (heading === opposite(best.direction)) reverse(maze, best);
      if (best.offset < 0.001) best.to = best.from;
      else if (length - best.offset < 0.001) {
        best.from = best.to;
        best.offset = 0;
      }
    }
  return best;
}
/** Queue turns at junctions; carry momentum around unambiguous bends. */
export function runPipe(
  maze: Maze,
  actor: Actor,
  requested: number,
  travel: number,
  visit: (p: Point) => void,
  reversePressed = true,
) {
  if (reversePressed && requested === opposite(actor.direction))
    reverse(maze, actor);
  advance(
    maze,
    actor,
    travel,
    (cell) => {
      const wanted = cell.exits.find(
        (id) => direction(cell, maze.cells[id]!) === requested,
      );
      if (wanted !== undefined) return wanted;
      const ahead = cell.exits.filter(
        (id) => direction(cell, maze.cells[id]!) !== opposite(actor.direction),
      );
      return (
        ahead.find(
          (id) => direction(cell, maze.cells[id]!) === actor.direction,
        ) ?? (ahead.length === 1 ? ahead[0] : undefined)
      );
    },
    visit,
  );
}
export const TONGUE_REACH = 54; // About two normal pellet spacings.
export function tongueTarget(player: Actor, target: Point) {
  const [dx, dy] = DIRECTIONS[Math.max(0, player.direction)]!;
  const x = target.x - player.x,
    y = target.y - player.y;
  return (
    x * dx + y * dy > 0 &&
    Math.hypot(x, y) <= TONGUE_REACH &&
    Math.abs(x * dy - y * dx) <= 18
  );
}
