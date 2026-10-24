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
  cleared: boolean;
  respawnAt: number;
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
  const empty = (): Maze => ({
    cells: [],
    pellets: [],
    step: 64,
    start: 0,
    path: "",
  });
  if (width < 64 || height < 64) return empty();
  const inset = 22;
  const bound = (n: number, limit: number) =>
    Math.max(inset, Math.min(limit - inset, n));
  const inText = (p: Point) =>
    text.some(
      (r) =>
        p.x > r.left - 3 &&
        p.x < r.right + 3 &&
        p.y > r.top - 3 &&
        p.y < r.bottom + 3,
    );
  const crossings = (a: Point, b: Point) =>
    text.filter((r) => blocked(a, b, [r], 3)).length;
  // Keep a handful of real line runs, not a viewport-filling maze. Widely spaced
  // anchors reduce clutter while retaining the shape of columns and paragraphs.
  const lines = text
    .filter(
      (r) =>
        r.right - r.left > 55 && r.bottom > inset && r.top < height - inset,
    )
    .sort((a, b) => a.top - b.top || a.left - b.left);
  const initialLine = lines[Math.floor(random() * Math.min(3, lines.length))];
  const selected: Wall[] = [];
  const limit = Math.min(7, Math.max(3, Math.floor(height / 120)));
  for (let i = 0; i < limit && lines.length; i++) {
    let best = lines[0]!,
      score = -1;
    for (const r of lines) {
      if (selected.includes(r)) continue;
      const d = selected.length
        ? Math.min(
            ...selected.map(
              (s) => Math.abs(r.top - s.top) + Math.abs(r.left - s.left) * 0.3,
            ),
          )
        : r === initialLine
          ? height + 1
          : height - r.top;
      if (d > score) {
        best = r;
        score = d;
      }
    }
    if (selected.length && score < 64) break;
    selected.push(best);
  }
  selected.sort((a, b) => a.top - b.top);
  const runs: [Point, Point][] = [];
  for (const [i, r] of selected.entries()) {
    const left = bound(r.left - 20, width),
      right = bound(r.right + 20, width);
    const candidates = [bound(r.bottom + 8, height), bound(r.top - 8, height)];
    candidates.sort(
      (a, b) =>
        crossings({ x: left, y: a }, { x: right, y: a }) -
        crossings({ x: left, y: b }, { x: right, y: b }),
    );
    runs.push([
      { x: left, y: candidates[0]! },
      { x: right, y: candidates[0]! },
    ]);
    // Short bites follow real text baselines. Letters replace food here; they
    // are mutated by the board and never synthesized or regenerated as pellets.
    if (i % 3 === 1) {
      const y = bound((r.top + r.bottom) / 2, height);
      runs.push([
        { x: left, y },
        { x: right, y },
      ]);
    }
  }
  if (!runs.length) {
    // Empty pages still get three compact, readable trails with open space around them.
    for (const f of height < 160 ? [0.5] : [0.3, 0.5, 0.7])
      runs.push([
        { x: bound(width * 0.2, width), y: bound(height * f, height) },
        { x: bound(width * 0.8, width), y: bound(height * f, height) },
      ]);
  }
  const axis = (
    values: number[],
    extras: number[],
    size: number,
    cap: number,
  ) => {
    const result = [...new Set(values.map((n) => Math.round(n)))];
    for (const n of extras) {
      const v = Math.round(bound(n, size));
      if (result.length < cap && result.every((x) => Math.abs(x - v) >= 18))
        result.push(v);
    }
    return result.sort((a, b) => a - b);
  };
  const points = runs.flat();
  const xs = axis(
    points.map((p) => p.x),
    [
      inset,
      width - inset,
      ...walls.flatMap((r) => [r.left - 20, r.right + 20]),
    ],
    width,
    24,
  );
  const ys = axis(
    points.map((p) => p.y),
    [
      inset,
      height - inset,
      ...walls.flatMap((r) => [r.top - 20, r.bottom + 20]),
    ],
    height,
    28,
  );
  const grid: Cell[] = [],
    map = new Map<number, Cell>();
  for (const [row, y] of ys.entries())
    for (const [col, x] of xs.entries()) {
      const cell: Cell = { id: grid.length, row, col, x, y, exits: [] };
      if (!blocked(cell, cell, walls)) {
        grid.push(cell);
        map.set(row * xs.length + col, cell);
      }
    }
  for (const cell of grid)
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      const next = map.get((cell.row + dy!) * xs.length + cell.col + dx!);
      if (
        next &&
        (dx ? next.row === cell.row : next.col === cell.col) &&
        !blocked(cell, next, walls)
      ) {
        cell.exits.push(next.id);
        next.exits.push(cell.id);
      }
    }
  if (!grid.length) return empty();
  // A shortest-path tree joins selected food runs through the cheapest gutters.
  // Candidate graph size is bounded (24 × 28); only the chosen routes survive.
  const full: Maze = { ...empty(), cells: grid };
  const anchors = runs.map(
    ([a, b]) => [closest(full, a), closest(full, b)] as const,
  );
  const root = anchors[0]![0];
  const costs = new Float64Array(grid.length).fill(Infinity),
    previous = new Int16Array(grid.length).fill(-1),
    done = new Set<number>();
  costs[root] = 0;
  for (let n = 0; n < grid.length; n++) {
    let id = -1,
      best = Infinity;
    for (let i = 0; i < grid.length; i++)
      if (!done.has(i) && costs[i]! < best) {
        id = i;
        best = costs[i]!;
      }
    if (id < 0) break;
    done.add(id);
    const a = grid[id]!;
    for (const next of a.exits) {
      const b = grid[next]!,
        length = Math.hypot(a.x - b.x, a.y - b.y);
      const cost = best + length + crossings(a, b) * (a.x === b.x ? 320 : 100);
      if (cost < costs[next]!) {
        costs[next] = cost;
        previous[next] = id;
      }
    }
  }
  const edges = new Set<string>();
  const connect = (a: number, b: number) =>
    edges.add(a < b ? `${a},${b}` : `${b},${a}`);
  const route = (id: number) => {
    while (previous[id]! >= 0) {
      connect(id, previous[id]!);
      id = previous[id]!;
    }
  };
  for (const pair of anchors) {
    const [a, b] = Number.isFinite(costs[pair[0]]!)
      ? pair
      : ([pair[1], pair[0]] as const);
    if (!Number.isFinite(costs[a]!)) continue;
    route(a);
    if (Number.isFinite(costs[b]!)) route(b);
    // Retain each actual line run as an alternate route, including after food is eaten.
    if (grid[a]!.row === grid[b]!.row) {
      let current = a;
      while (current !== b) {
        const c = grid[current]!,
          next = c.exits.find(
            (id) =>
              grid[id]!.row === c.row &&
              Math.sign(grid[id]!.x - c.x) === Math.sign(grid[b]!.x - c.x),
          );
        if (next === undefined || !Number.isFinite(costs[next]!)) break;
        connect(current, next);
        route(next);
        current = next;
      }
    }
  }
  const used = [
    ...new Set([...edges].flatMap((e) => e.split(",").map(Number))),
  ];
  const ids = new Map(used.map((id, i) => [id, i]));
  const cells = used.map((id, i) => ({
    ...grid[id]!,
    id: i,
    exits: [] as number[],
  }));
  for (const edge of edges) {
    const [a, b] = edge.split(",").map((id) => ids.get(Number(id))!) as [
      number,
      number,
    ];
    cells[a]!.exits.push(b);
    cells[b]!.exits.push(a);
  }
  const maze: Maze = { ...empty(), cells };
  if (!cells.length) return maze;
  maze.start = closest(maze, { x: width * 0.35, y: height * 0.55 });
  const food = (p: Point, cell: number) => {
    if (
      !inText(p) &&
      maze.pellets.length < 280 &&
      !maze.pellets.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 17)
    )
      maze.pellets.push({
        ...p,
        id: maze.pellets.length,
        cell,
        power: false,
        eaten: false,
        cleared: false,
        respawnAt: 0,
      });
  };
  const paths: string[] = [];
  for (const cell of cells) {
    if (cell.id !== maze.start) food(cell, cell.id);
    for (const id of cell.exits)
      if (id > cell.id) {
        const next = cells[id]!,
          length = Math.hypot(next.x - cell.x, next.y - cell.y),
          pieces = Math.max(1, Math.round(length / 27));
        paths.push(`M${cell.x},${cell.y}L${next.x},${next.y}`);
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
  // Spread generous power food across the compact trails, away from the spawn.
  const powers: Pellet[] = [];
  for (
    let i = 0;
    i <
    Math.min(
      8,
      Math.max(6, Math.floor(maze.pellets.length / 24)),
      maze.pellets.length,
    );
    i++
  ) {
    let best: Pellet | undefined,
      score = -1;
    for (const p of maze.pellets) {
      if (p.power) continue;
      const d = Math.min(
        Math.hypot(p.x - cells[maze.start]!.x, p.y - cells[maze.start]!.y),
        ...powers.map((q) => Math.hypot(p.x - q.x, p.y - q.y)),
      );
      if (d > score) {
        best = p;
        score = d;
      }
    }
    if (best) {
      best.power = true;
      powers.push(best);
    }
  }
  // A seed may choose an equivalent starting branch without rebuilding a full random maze.
  const exits = cells[maze.start]!.exits;
  if (exits.length > 1 && random() > 0.5) exits.reverse();
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
