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
  power: "#8de45c",
  eye: "#fff5d7",
  pupil: "#152820",
} as const;
export const FLY_COLORS = ["#8573ee", "#f4457a", "#06c4ff"] as const;
export const CREAM = "#fff5d7",
  WING = "#d9f0f3";
export type Facing = 0 | 1 | 2 | 3;
// A 24 × 24 stepped disc: the mouth cuts the silhouette, never a dark outline.
function mask(front: boolean, mouth: number) {
  const cells = new Set<string>();
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      const dx = x - 11.5,
        dy = y - 11.5;
      if (dx * dx + dy * dy <= 12 * 12) cells.add(`${x},${y + 3}`);
    }
  if (front) return cells; // Eyes-only vertical poses keep the round body whole.
  const slope = mouth === 2 ? 0.95 : mouth === 1 ? 0.48 : 0;
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    const forward = x - 11.5,
      across = Math.abs(y - 14.5);
    if (forward > 0 && across <= Math.max(0.5, forward * slope))
      cells.delete(key);
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
export const FROG_BODIES = Array.from({ length: 4 }, (_, facing) =>
  Array.from({ length: 3 }, (_, mouth) => {
    const pixels = mask(facing === 1 || facing === 3, mouth);
    return { body: path(pixels) };
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
// Two tiny stepped balls, alternating their height without moving the hitbox.
const foot = (x: number, y: number) =>
  `M${x + 1} ${y}h3v1h1v3h-1v1h-3v-1h-1v-3h1Z`;
export const FROG_FEET = [
  foot(3, 23) + foot(16, 23),
  foot(2, 22) + foot(17, 24),
  foot(3, 23) + foot(16, 23),
  foot(4, 24) + foot(15, 22),
  foot(3, 24) + foot(16, 23),
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
    viewBox: "-2 -1 28 31",
    layers: [
      { d: FROG_FEET[0], fill: power ? FROG.power : FROG.body },
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
