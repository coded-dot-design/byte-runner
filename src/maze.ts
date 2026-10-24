/** A connected, bounded corridor graph. Native page rectangles cut real walls. */
export interface Point {
  x: number;
  y: number;
}
export interface Wall {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface Cell extends Point {
  id: number;
  row: number;
  col: number;
  exits: number[];
}
export interface Pellet extends Point {
  id: number;
  cell: number;
  power: boolean;
  eaten: boolean;
}
export interface Maze {
  cells: Cell[];
  pellets: Pellet[];
  step: number;
  start: number;
  path: string;
}
export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
export const opposite = (direction: number) => (direction + 2) % 4;
export function direction(a: Point, b: Point) {
  return Math.abs(b.x - a.x) > Math.abs(b.y - a.y)
    ? b.x > a.x
      ? 0
      : 2
    : b.y > a.y
      ? 1
      : 3;
}
export function blocked(
  a: Point,
  b: Point,
  walls: readonly Wall[],
  padding = 17,
) {
  return walls.some(
    (w) =>
      Math.max(a.x, b.x) > w.left - padding &&
      Math.min(a.x, b.x) < w.right + padding &&
      Math.max(a.y, b.y) > w.top - padding &&
      Math.min(a.y, b.y) < w.bottom + padding,
  );
}
export function distances(maze: Maze, start: number) {
  const result = new Int16Array(maze.cells.length).fill(-1),
    queue = [start];
  result[start] = 0;
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]!;
    for (const next of maze.cells[cell]!.exits)
      if (result[next] === -1) {
        result[next] = result[cell]! + 1;
        queue.push(next);
      }
  }
  return result;
}
export function closest(maze: Maze, point: Point) {
  let best = 0,
    distance = Infinity;
  for (const cell of maze.cells) {
    const d = (cell.x - point.x) ** 2 + (cell.y - point.y) ** 2;
    if (d < distance) {
      best = cell.id;
      distance = d;
    }
  }
  return best;
}
export function makeMaze(
  width: number,
  height: number,
  walls: readonly Wall[],
  random: () => number,
  text: readonly Wall[] = [],
): Maze {
  if (width < 32 || height < 32)
    return { cells: [], pellets: [], step: 44, start: 0, path: "" };
  // Never create an unbounded DOM grid on ultrawide screens.
  const step = Math.max(44, Math.ceil(Math.sqrt((width * height) / 260)));
  const cols = Math.max(1, Math.floor(width / step)),
    rows = Math.max(1, Math.floor(height / step));
  const ox = (width - (cols - 1) * step) / 2,
    oy = (height - (rows - 1) * step) / 2;
  // Snap the sampling axes toward actual line gaps and element gutters.
  const axes = (
    count: number,
    origin: number,
    limit: number,
    candidates: number[],
  ) => {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      const raw = origin + i * step;
      const choices = candidates.filter(
        (n) =>
          n >= 15 &&
          n <= limit - 15 &&
          Math.abs(n - raw) <= step * 0.4 &&
          (!result.length || n - result[result.length - 1]! >= 28),
      );
      result.push(
        choices.sort((a, b) => Math.abs(a - raw) - Math.abs(b - raw))[0] ?? raw,
      );
    }
    return result;
  };
  const terrain = [...walls, ...text];
  const xs = axes(
    cols,
    ox,
    width,
    terrain.flatMap((r) => [r.left - 16, r.right + 16]),
  );
  const ys = axes(
    rows,
    oy,
    height,
    terrain.flatMap((r) => [r.top - 9, r.bottom + 9]),
  );
  const inText = (p: Point) =>
    text.some(
      (r) =>
        p.x > r.left - 2 &&
        p.x < r.right + 2 &&
        p.y > r.top - 2 &&
        p.y < r.bottom + 2,
    );
  const crossing = (a: Point, b: Point) =>
    text.filter((r) => blocked(a, b, [r], 2)).length;
  const grid: Cell[] = [],
    map = new Map<number, Cell>();
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const cell: Cell = {
        id: grid.length,
        row,
        col,
        x: xs[col]!,
        y: ys[row]!,
        exits: [],
      };
      if (!blocked(cell, cell, walls) && !inText(cell)) {
        grid.push(cell);
        map.set(row * cols + col, cell);
      }
    }
  for (const cell of grid)
    for (const [dx, dy] of DIRECTIONS) {
      // A short bridge can cross text where a continuous gutter is unavailable.
      for (let gap = 1; gap <= 3; gap++) {
        const col = cell.col + dx * gap,
          row = cell.row + dy * gap;
        if (col < 0 || col >= cols || row < 0 || row >= rows) break;
        const next = map.get(row * cols + col);
        if (!next) continue;
        if (!blocked(cell, next, walls)) cell.exits.push(next.id);
        break;
      }
    }
  // Only the largest connected component is playable: no stranded food.
  const seen = new Set<number>();
  let component: number[] = [];
  for (const cell of grid) {
    if (seen.has(cell.id)) continue;
    const queue = [cell.id];
    seen.add(cell.id);
    for (let i = 0; i < queue.length; i++)
      for (const id of grid[queue[i]!]!.exits)
        if (!seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
    if (queue.length > component.length) component = queue;
  }
  const ids = new Map(component.map((id, i) => [id, i]));
  const cells = component.map((id, i) => ({
    ...grid[id]!,
    id: i,
    exits: [] as number[],
  }));
  const neighbors = component.map((id) =>
    grid[id]!.exits.map((id) => ids.get(id)!).filter((id) => id !== undefined),
  );
  const maze: Maze = { cells, pellets: [], step, start: 0, path: "" };
  if (!cells.length) return maze;
  maze.start = closest(maze, { x: width * 0.35, y: height * 0.55 });
  const visited = new Set([maze.start]),
    stack = [maze.start];
  const connect = (a: number, b: number) => {
    cells[a]!.exits.push(b);
    cells[b]!.exits.push(a);
  };
  while (stack.length) {
    const id = stack[stack.length - 1]!,
      choices = neighbors[id]!.filter((id) => !visited.has(id));
    if (!choices.length) {
      stack.pop();
      continue;
    }
    choices.sort(
      (a, b) =>
        crossing(cells[id]!, cells[a]!) - crossing(cells[id]!, cells[b]!),
    );
    const best = crossing(cells[id]!, cells[choices[0]!]!);
    const preferred = choices.filter(
      (next) => crossing(cells[id]!, cells[next]!) === best,
    );
    const next =
      preferred[
        Math.min(preferred.length - 1, Math.floor(random() * preferred.length))
      ]!;
    connect(id, next);
    visited.add(next);
    stack.push(next);
  }
  // Braided loops provide escape routes and let a queued turn pay off.
  for (const cell of cells)
    for (const id of neighbors[cell.id]!)
      if (
        id > cell.id &&
        !cell.exits.includes(id) &&
        crossing(cell, cells[id]!) === 0 &&
        (cell.exits.length === 1 || random() < 0.18)
      )
        connect(cell.id, id);
  const starts = cells.filter((c) => c.exits.some((id) => cells[id]!.x > c.x));
  if (starts.length)
    maze.start = starts.sort(
      (a, b) =>
        Math.hypot(a.x - width * 0.35, a.y - height * 0.55) -
        Math.hypot(b.x - width * 0.35, b.y - height * 0.55),
    )[0]!.id;
  const fromStart = distances(maze, maze.start),
    powers = new Set<number>();
  for (let i = 0; i < Math.min(4, Math.floor(cells.length / 8)); i++) {
    const fields = [...powers].map((id) => distances(maze, id));
    let best = maze.start,
      score = -1;
    for (const cell of cells) {
      const d = Math.min(
        fromStart[cell.id]!,
        ...fields.map((field) => field[cell.id]!),
      );
      if (!powers.has(cell.id) && d > score) {
        best = cell.id;
        score = d;
      }
    }
    powers.add(best);
  }
  const food = (point: Point, cell: number, power = false) => {
    if (power || maze.pellets.length < 1500)
      maze.pellets.push({
        ...point,
        id: maze.pellets.length,
        cell,
        power,
        eaten: false,
      });
  };
  const paths: string[] = [];
  for (const cell of cells) {
    if (cell.id !== maze.start) food(cell, cell.id, powers.has(cell.id));
    for (const id of cell.exits)
      if (id > cell.id) {
        const next = cells[id]!;
        paths.push(`M${cell.x},${cell.y}L${next.x},${next.y}`);
        const pieces = Math.max(
          2,
          Math.min(
            12,
            Math.round(Math.hypot(next.x - cell.x, next.y - cell.y) / 20),
          ),
        );
        for (let p = 1; p < pieces; p++)
          food(
            {
              x: cell.x + ((next.x - cell.x) * p) / pieces,
              y: cell.y + ((next.y - cell.y) * p) / pieces,
            },
            cell.id,
          );
      }
  }
  maze.path = paths.join("");
  return maze;
}

export interface Actor extends Point {
  from: number;
  to: number;
  offset: number;
  direction: number;
}
export function actorAt(maze: Maze, id: number): Actor {
  return {
    x: maze.cells[id]!.x,
    y: maze.cells[id]!.y,
    from: id,
    to: id,
    offset: 0,
    direction: -1,
  };
}
/** Select at junctions, then spend the whole frame's distance along valid edges. */
export function advance(
  maze: Maze,
  actor: Actor,
  distance: number,
  choose: (cell: Cell) => number | undefined,
  visit: (point: Point) => void = () => {},
) {
  while (distance > 0.001) {
    if (actor.from === actor.to) {
      const next = choose(maze.cells[actor.from]!);
      if (next === undefined || !maze.cells[actor.from]!.exits.includes(next))
        break;
      actor.to = next;
      actor.offset = 0;
      actor.direction = direction(maze.cells[actor.from]!, maze.cells[next]!);
    }
    const a = maze.cells[actor.from]!,
      b = maze.cells[actor.to]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y),
      step = Math.min(distance, length - actor.offset, 6);
    actor.offset += step;
    distance -= step;
    actor.x = a.x + ((b.x - a.x) * actor.offset) / length;
    actor.y = a.y + ((b.y - a.y) * actor.offset) / length;
    visit(actor);
    if (actor.offset >= length - 0.001) {
      actor.from = actor.to;
      actor.offset = 0;
    }
  }
}
export function reverse(maze: Maze, actor: Actor) {
  if (actor.from === actor.to) return;
  const a = actor.from;
  actor.from = actor.to;
  actor.to = a;
  actor.offset =
    Math.hypot(
      maze.cells[a]!.x - maze.cells[actor.from]!.x,
      maze.cells[a]!.y - maze.cells[actor.from]!.y,
    ) - actor.offset;
  actor.direction = opposite(actor.direction);
}
