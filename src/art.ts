/** Owning pixel geometry for the game and generated website artwork. */
export interface PixelLayer {
  d: string;
  fill: string;
}
export interface PixelArt {
  viewBox: string;
  layers: PixelLayer[];
}
export const FROG = {
  body: "#3ecb74",
  edge: "#19774d",
  power: "#8de45c",
  powerEdge: "#438c40",
  eye: "#fff5d7",
  pupil: "#152820",
} as const;
export const FLY_COLORS = ["#8573ee", "#f4457a", "#06c4ff"] as const;
export const FLY_EDGES = ["#524486", "#973451", "#12677e"] as const;
export const CREAM = "#fff5d7",
  WING = "#d9f0f3";
export type Facing = 0 | 1 | 2 | 3;
const bodyRows = [
  [8, 20],
  [6, 21],
  [4, 22],
  [3, 23],
  [2, 24],
  [1, 24],
  [1, 24],
  [0, 24],
  [0, 24],
  [0, 24],
  [1, 24],
  [1, 24],
  [2, 23],
  [3, 22],
  [4, 21],
  [6, 20],
  [8, 18],
] as const;
function mask(front: boolean, mouth: number, facing: Facing) {
  const cells = new Set<string>();
  bodyRows.forEach(([left, right], row) => {
    const width = right - left,
      start = front ? Math.floor((24 - width) / 2) : left;
    for (let x = start; x < start + width; x++) cells.add(`${x},${row + 4}`);
  });
  if (!front) {
    const widths =
      mouth === 2
        ? [4, 7, 10, 12, 10, 7, 4]
        : mouth === 1
          ? [4, 7, 9, 7, 4]
          : [9];
    const top = mouth === 2 ? 9 : mouth === 1 ? 10 : 12;
    widths.forEach((width, row) => {
      for (let x = 24 - width; x < 24; x++) cells.delete(`${x},${top + row}`);
    });
  } else {
    const top = facing === 3 ? 7 : 14,
      height = mouth === 2 ? 5 : mouth === 1 ? 3 : 1;
    for (let y = top; y < top + height; y++)
      for (let x = 7; x < 18; x++) cells.delete(`${x},${y}`);
  }
  return cells;
}
function path(cells: Set<string>) {
  // Horizontal runs keep paths compact, with no stroke grid between pixels.
  const rows = new Map<number, number[]>();
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    const row = rows.get(y) ?? [];
    row.push(x);
    rows.set(y, row);
  }
  let result = "";
  for (const [y, row] of [...rows].sort((a, b) => a[0] - b[0])) {
    row.sort((a, b) => a - b);
    for (let i = 0; i < row.length; ) {
      const x = row[i]!;
      let end = x;
      i++;
      while (i < row.length && row[i] === end + 1) end = row[i++]!;
      result += `M${x} ${y}h${end - x + 1}v1H${x}Z`;
    }
  }
  return result;
}
function expand(cells: Set<string>) {
  const rim = new Set(cells);
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      rim.add(`${x + dx!},${y + dy!}`);
  }
  return rim;
}
export const FROG_BODIES = Array.from({ length: 4 }, (_, facing) =>
  Array.from({ length: 3 }, (_, mouth) => {
    const pixels = mask(facing === 1 || facing === 3, mouth, facing as Facing);
    return { body: path(pixels), rim: path(expand(pixels)) };
  }),
);
export const FROG_EYES = {
  side: {
    stems: "M7 0h5v2h2v5H7V2H6V1h1ZM16 0h5v2h2v5h-7Z",
    cream: "M9 1h5v2h-2v3h2v1H9V6H8V2h1ZM18 1h5v2h-2v3h2v1h-5V6h-1V2h1Z",
    pupils: "M12 2h2v4h-2ZM21 2h2v4h-2Z",
  },
  front: {
    stems: "M5 0h5v1h1v7H4V2h1ZM15 0h5v2h1v6h-7V1h1Z",
    cream: "M6 1h4v6H5V2h1ZM16 1h4v1h1v5h-6V2h1Z",
    pupils: "M7 3h2v3H7ZM17 3h2v3h-2Z",
  },
} as const;
export const FROG_FEET = [
  "M4 20h4v2h1v2H2v-2h2ZM17 20h4v2h2v2h-7v-2h1Z",
  "M3 20h4v2h2v2H2v-1H1v-2h2ZM18 20h4v2h2v1h-6Z",
  "M4 20h4v2h2v1H3v-1h1ZM17 20h4v2h2v2h-7v-1h-1v-2h2Z",
  "M5 20h4v2h2v1H4v-1h1ZM16 20h4v2h1v2h-7v-2h2Z",
  "M3 20h4v2h2v1H2v-1h1ZM18 20h4v2h2v2h-7v-2h1Z",
] as const;
export const FLY_BODY =
  "M9 5h8v1h3v2h2v9h-1v2h-3v1h-2v-2h-3v2h-3v-2H7v-2H6v-5h1V8h2Z";
export const FLY_EYES = "M10 8h4v6h-4V13H9V9h1ZM17 8h4v1h1v5h-5Z";
export const FLY_PUPILS = "M12 9h2v4h-2ZM20 9h2v4h-2Z";
export const FLY_WINGS = [
  "M2 0h2v2h2v2h1v5H5V7H3V5H1V2h1ZM21 1h2v2h1v2h1v4h-3V6h-2V3h1Z",
  "M0 7h3v1h2v2h2v3H4v-1H2v-1H0ZM23 7h2v1h2v3h-2v1h-3v1h-2v-3h1V9h2Z",
] as const;
export const FLY_FEET = "M9 18h3v3H9Zm7 0h3v3h-3Z";
export function frogArt(mouth = 1, power = false): PixelArt {
  const body = FROG_BODIES[0]![mouth]!,
    eyes = FROG_EYES.side;
  return {
    viewBox: "-2 -2 28 28",
    layers: [
      { d: FROG_FEET[0], fill: power ? FROG.power : FROG.body },
      { d: body.rim, fill: power ? FROG.powerEdge : FROG.edge },
      { d: body.body, fill: power ? FROG.power : FROG.body },
      { d: eyes.stems, fill: power ? FROG.power : FROG.body },
      { d: eyes.cream, fill: FROG.eye },
      { d: eyes.pupils, fill: FROG.pupil },
    ],
  };
}
export function flyArt(kind = 0, vulnerable = false): PixelArt {
  return {
    viewBox: "-1 -2 29 27",
    layers: [
      { d: FLY_WINGS[0], fill: WING },
      { d: FLY_FEET, fill: "#273148" },
      { d: FLY_BODY, fill: vulnerable ? "#628dce" : FLY_COLORS[kind % 3]! },
      { d: FLY_EYES, fill: CREAM },
      { d: FLY_PUPILS, fill: "#152820" },
    ],
  };
}
export const websiteSprites = {
  runner: /* @__PURE__ */ frogArt(),
  "runner-overclock": /* @__PURE__ */ frogArt(1, true),
  "fly-chaser": /* @__PURE__ */ flyArt(0),
  "fly-interceptor": /* @__PURE__ */ flyArt(1),
  "fly-roamer": /* @__PURE__ */ flyArt(2),
  "fly-vulnerable": /* @__PURE__ */ flyArt(0, true),
};
