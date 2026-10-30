// Byte Runner's art: one SVG inside the page's own content root (fizlet/arcade `attach`: a
// ledger-owned shadow host, so it scrolls and transforms with the page natively and Recall removes
// it). `measure` and `geometryKey` read layout (the read phase only); `render` writes the SVG from
// the world's arrays (render only), change-only, with no CSS timers or animation frames of its own.
import type { BoardPage } from "../vendor/fizlet/board-page";
import type { Maze, Wall } from "./maze.js";
import type { Frame, World } from "./world.js";
import * as Wd from "./world.js";
import { FROG, FROG_BODIES, FROG_EYES, FROG_FEET, FLY_BODY, FLY_EYES, FLY_PUPILS, FLY_WINGS, FLY_FEET, FLY_COLORS, WING, CREAM } from "./art.js";
import { createRunnerAnimation, runnerFrame, wingFrame } from "./animation.js";
import { MAX_GHOSTS } from "./rules.js";

export const CHERRY =
  '<path d="M7 7V3h3V1h2v2h-1v6H9V5H8v4Z" fill="#4bce82"/><path d="M2 7h4v1h2v5H6v1H2v-1H1V9h1Zm8 2h4v1h1v4h-1v1h-4v-1H9v-4h1Z" fill="#f4457a"/><path d="M2 8h2v2H2zm8 2h2v2h-2Z" fill="#fff4ff"/>';
export const BERRY =
  '<path d="M3 1h3v2h4V1h3v3h-3v2H6V4H3Z" fill="#4bce82"/><path d="M3 5h10v1h2v4h-2v2h-2v2H9v1H7v-1H5v-2H3v-2H1V6h2Z" fill="#ee6875"/><path d="M4 6h1v2H4zm6 0h1v2h-1zM7 9h1v2H7Z" fill="#fff4ff"/>';
const NS = "http://www.w3.org/2000/svg";
const VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
/** Native parts of the page the trails route around (and the frog never lands on). */
const OBSTACLES = 'button,a[href],input,select,textarea,summary,[role="button"],[contenteditable="true"],img,svg,canvas,video,iframe,object,embed,pre,table,hr,figure,fieldset,details,[role="img"]';
/** Text that is never terrain: code, controls, and any Fizlet host (our own art and scoreboard). */
const NOT_TEXT = "script,style,noscript,svg,canvas,button,a[href],input,select,textarea,pre,table,[data-fizlet-host],[data-dom-virus-root],[data-virus-ui],[data-fz-announce]";

const set = (node: Element, key: string, value: string) => {
  if (node.getAttribute(key) !== value) node.setAttribute(key, value);
};

export function createPresentation(shadow: ShadowRoot, root: Element, board: BoardPage, id: string, dark: boolean) {
  const doc = root.ownerDocument, host = shadow.host as HTMLElement;
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("data-byte-maze", "");
  svg.setAttribute("data-byte-trails", "");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;pointer-events:none;overflow:hidden;isolation:isolate;";
  // Two strokes in a mask leave only the soft outside edges of the union. The center stays
  // transparent, with no crossbars across route junctions.
  svg.innerHTML =
    '<defs><mask id="byte-trail-edge" maskUnits="userSpaceOnUse"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path data-byte-edge-outer stroke="white"/><path data-byte-edge-inner stroke="black"/></g></mask></defs><path data-byte-guides fill="none" stroke-linecap="round" stroke-linejoin="round" mask="url(#byte-trail-edge)"/><g data-byte-food shape-rendering="crispEdges"></g><g data-byte-fruit visibility="hidden" shape-rendering="crispEdges"></g><g data-byte-flies></g><g data-byte-runner><path data-byte-tongue fill="none" stroke="#ee526a" stroke-width="4" stroke-linecap="round"/><g transform="scale(1.2) translate(-12 -15)"><g data-byte-pose shape-rendering="crispEdges"><path data-byte-feet/><g data-byte-torso><path data-byte-body/><g data-byte-eyes><path data-stems/><path data-cream/><path data-pupils/></g></g></g></g></g>';
  shadow.append(svg);
  const $ = <T extends Element>(s: string) => svg.querySelector<T>(s)!;
  const runner = $<SVGGElement>("[data-byte-runner]"), pose = $<SVGGElement>("[data-byte-pose]"), tongue = $<SVGPathElement>("[data-byte-tongue]");
  const torso = $<SVGGElement>("[data-byte-torso]"), body = $<SVGPathElement>("[data-byte-body]"), feet = $<SVGPathElement>("[data-byte-feet]");
  const stems = $<SVGPathElement>("[data-stems]"), cream = $<SVGPathElement>("[data-cream]"), pupils = $<SVGPathElement>("[data-pupils]");
  const fruit = $<SVGGElement>("[data-byte-fruit]"), food = $<SVGGElement>("[data-byte-food]"), flyLayer = $<SVGGElement>("[data-byte-flies]");
  // The flies: a fixed pool, shown and hidden (there are at most MAX_GHOSTS).
  const flies = Array.from({ length: MAX_GHOSTS }, () => {
    const n = doc.createElementNS(NS, "g");
    n.setAttribute("shape-rendering", "crispEdges");
    n.setAttribute("visibility", "hidden");
    n.innerHTML = `<path data-wings fill="${WING}"/><path d="${FLY_FEET}" fill="#273148"/><path data-body d="${FLY_BODY}"/><path d="${FLY_EYES}" fill="${CREAM}"/><path data-pupils d="${FLY_PUPILS}" fill="#152820"/>`;
    flyLayer.append(n);
    return { node: n, wing: n.querySelector("[data-wings]")!, body: n.querySelector("[data-body]")!, pupils: n.querySelector("[data-pupils]")! };
  });
  const animation = createRunnerAnimation();
  let pellets: SVGElement[] = [], rings: (SVGElement | null)[] = [], shown = new Uint8Array(0);
  let flyScale = 1.1, foodFrame = -1, pending: Maze | null = null, mounted = false;

  /** Cheap viewport identity: excludes animated text, buttons and our own writes (read phase). */
  function geometryKey() {
    const r = host.getBoundingClientRect();
    return [r.left, r.top, Math.min(r.right, innerWidth), Math.min(r.bottom, innerHeight), innerWidth, innerHeight, scrollX, scrollY].map(Math.round).join(",");
  }
  /** Where the root is in the viewport (read phase, every frame). */
  function origin(s: Float64Array) {
    const r = host.getBoundingClientRect();
    s[Wd.OX] = r.left;
    s[Wd.OY] = r.top;
  }
  /** The visible part of the root and its terrain, in its local px (read phase). */
  function measure(): Frame & { text: Wall[] } {
    const box = host.getBoundingClientRect(), scaleX = box.width / (host.clientWidth || box.width) || 1, scaleY = box.height / (host.clientHeight || box.height) || 1;
    const left = Math.max(0, box.left), top = Math.max(0, box.top), right = Math.min(innerWidth, box.right), bottom = Math.min(innerHeight, box.bottom);
    const convert = (r: { left: number; right: number; top: number; bottom: number }): Wall => ({ left: (r.left - left) / scaleX, right: (r.right - left) / scaleX, top: (r.top - top) / scaleY, bottom: (r.bottom - top) / scaleY });
    const visible = (r: DOMRect) => r.width > 0 && r.height > 0 && r.right > left && r.left < right && r.bottom > top && r.top < bottom;
    // Solid: the scoreboard and touch pad (the arcade's overlay) and [data-byte-wall].
    const explicit = new Set<Element>(root.querySelectorAll("[data-byte-wall]"));
    for (const el of doc.querySelector(`[data-fizlet-host="${id}"]`)?.shadowRoot?.querySelectorAll(".ar,.bui-pad") ?? []) explicit.add(el);
    const targets = new Set<Element>([...board.targets.map((t) => t.el), ...explicit, ...doc.querySelectorAll("[data-byte-obstacle]"), ...root.querySelectorAll(OBSTACLES)]);
    const walls: Wall[] = [], solids: Wall[] = [];
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (!visible(r)) continue;
      const w = convert(r);
      walls.push(w);
      if (explicit.has(el)) solids.push(w);
    }
    // All visible text is occupied terrain, including labels that are not food. Only eating uses
    // the board's glyphs. No wrappers or text writes are needed to measure whitespace.
    const text: Wall[] = [], range = doc.createRange(), walker = doc.createTreeWalker(root, 4), boxes = new Map<Element, DOMRect>(), fallback = new Set<Element>();
    for (let node: Node | null; (node = walker.nextNode()); ) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || parent.closest(NOT_TEXT)) continue;
      let b = boxes.get(parent);
      if (!b) boxes.set(parent, (b = parent.getBoundingClientRect()));
      if (!visible(b)) continue;
      // Beyond the detailed line budget, block the whole parent conservatively.
      if (text.length >= 200) {
        if (!fallback.has(parent)) text.push(convert(b)), fallback.add(parent);
        continue;
      }
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (visible(r)) text.push(convert(r));
    }
    return {
      x: (left - box.left) / scaleX, y: (top - box.top) / scaleY, width: Math.max(0, (right - left) / scaleX), height: Math.max(0, (bottom - top) / scaleY),
      scaleX, scaleY, ox: box.left, oy: box.top, walls, solids, text,
    };
  }

  /** Build the trails and food for a new maze (render). */
  function mount(maze: Maze, s: Float64Array) {
    const w = s[Wd.FW]!, h = s[Wd.FH]!;
    flyScale = maze.radius < 12 ? 0.78 : 1.1;
    svg.style.left = `${s[Wd.FX]}px`;
    svg.style.top = `${s[Wd.FY]}px`;
    set(svg, "width", String(w));
    set(svg, "height", String(h));
    set(svg, "viewBox", `0 0 ${w || 1} ${h || 1}`);
    const mask = svg.querySelector("mask")!;
    set(mask, "x", "0");
    set(mask, "y", "0");
    set(mask, "width", String(w));
    set(mask, "height", String(h));
    for (const [selector, width] of [["[data-byte-edge-outer]", maze.radius * 2], ["[data-byte-edge-inner]", maze.radius * 2 - 3], ["[data-byte-guides]", maze.radius * 2]] as const) {
      const path = $(selector);
      set(path, "d", maze.path);
      set(path, "stroke-width", String(width));
    }
    const guides = $("[data-byte-guides]");
    set(guides, "stroke", dark ? "#b1a1e8" : "#8573bb");
    set(guides, "opacity", dark ? ".25" : ".32");
    food.replaceChildren();
    foodFrame = -1;
    pellets = maze.pellets.map((p) => {
      const n = doc.createElementNS(NS, p.power ? "g" : "rect");
      n.setAttribute(p.power ? "data-byte-power" : "data-byte-pellet", String(p.id));
      if (p.power) {
        n.setAttribute("transform", `translate(${p.x} ${p.y})`);
        const halo = Math.min(14, maze.radius), glow = Math.min(10, maze.radius - 1), core = Math.min(7, maze.radius - 2);
        n.innerHTML = `<rect data-pulse x="${-halo}" y="${-halo}" width="${halo * 2}" height="${halo * 2}" fill="#f4457a" opacity=".1"/><rect x="${-glow}" y="${-glow}" width="${glow * 2}" height="${glow * 2}" fill="#f4457a" opacity=".24"/><rect x="${-core}" y="${-core}" width="${core * 2}" height="${core * 2}" fill="#f4457a"/>`;
      } else {
        n.setAttribute("x", String(p.x - 2));
        n.setAttribute("y", String(p.y - 2));
        n.setAttribute("width", "4");
        n.setAttribute("height", "4");
        n.setAttribute("fill", dark ? "#fff5d7" : "#6758bd");
      }
      n.setAttribute("data-food-color", p.power ? "#f4457a" : dark ? "#fff5d7" : "#6758bd");
      food.append(n);
      return n;
    });
    rings = pellets.map((n) => n.querySelector<SVGElement>("[data-pulse]"));
    shown = new Uint8Array(pellets.length).fill(2);
    mounted = true;
  }
  function foodState(i: number, eaten: boolean) {
    const node = pellets[i]!;
    set(node, "data-eaten", String(eaten));
    set(node, "opacity", eaten ? ".3" : "1");
    if (node.tagName === "rect") set(node, "fill", eaten ? "#8c929d" : node.getAttribute("data-food-color")!);
    else for (const rect of node.children) set(rect, "fill", eaten ? "#8c929d" : "#f4457a");
  }

  /** Draw the world (render). */
  function render(world: World, reduced: boolean) {
    const s = world.s, time = s[Wd.TIME]!;
    if (pending) mount(pending, s), (pending = null);
    set(svg, "visibility", s[Wd.READY] ? "visible" : "hidden");
    if (!mounted) return;
    const g = world.graph;
    for (let i = 0; i < pellets.length && i < g.pn; i++) if (shown[i] !== g.eaten[i]) (shown[i] = g.eaten[i]!), foodState(i, !!g.eaten[i]);
    const a = world.actors, player = !!s[Wd.PLAYER];
    set(runner, "visibility", player ? "visible" : "hidden");
    if (!player) return;
    const px = a.x[0]!, py = a.y[0]!, power = s[Wd.POWER]!, jumping = !!s[Wd.JUMPING];
    set(runner, "transform", `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
    animation.moving = !!s[Wd.MOVING];
    animation.runTime = s[Wd.RUN_T]!;
    animation.chompUntil = s[Wd.CHOMP]!;
    const facing = Math.max(0, a.dir[0]!), f = runnerFrame(animation, time, reduced), pixels = FROG_BODIES[facing]![f.mouth]!, eyes = facing === 1 || facing === 3 ? FROG_EYES.front : FROG_EYES.side;
    set(pose, "transform", facing === 2 ? `translate(24 ${jumping ? -3 : 0}) scale(-1 1)` : `translate(0 ${jumping ? -3 : 0})`);
    set(pose, "data-facing", String(facing));
    set(runner, "data-jumping", String(jumping));
    const grab = s[Wd.TONGUE] && time < s[Wd.TONGUE_UNTIL]!, nibble = time < s[Wd.CHOMP]!, [dx, dy] = VECTORS[facing]!;
    set(tongue, "visibility", grab || nibble ? "visible" : "hidden");
    set(tongue, "d", grab ? `M${dx * 8},${dy * 8 + 2}L${(s[Wd.TONGUE_X]! - px).toFixed(1)},${(s[Wd.TONGUE_Y]! - py).toFixed(1)}` : `M${dx * 8},${dy * 8 + 2}l${dx * 10},${dy * 10}`);
    set(torso, "transform", `translate(0 ${f.bob})`);
    set(body, "d", pixels.body);
    set(body, "data-mouth", String(f.mouth));
    set(body, "fill", power ? FROG.power : FROG.body);
    set(stems, "fill", power ? FROG.power : FROG.body);
    set(stems, "d", eyes.stems);
    set(cream, "d", eyes.cream);
    set(cream, "fill", FROG.eye);
    set(pupils, "d", eyes.pupils);
    set(pupils, "fill", FROG.pupil);
    set(pupils, "transform", `translate(0 ${facing === 1 ? 1 : facing === 3 ? -1 : 0})`);
    set(feet, "d", FROG_FEET[f.step]!);
    set(feet, "fill", power ? FROG.power : FROG.body);
    set(feet, "data-frame", String(f.step));
    const shield = s[Wd.SHIELD]! > 0;
    set(runner, "data-protected", String(shield));
    set(runner, "opacity", shield ? (reduced ? ".8" : Math.floor(time * 4) % 2 ? ".65" : "1") : "1");
    // One bounded, quantized update on the simulation clock.
    const tick = reduced ? -2 : Math.floor(time * 8);
    if (tick !== foodFrame) {
      foodFrame = tick;
      for (let i = 0; i < pellets.length; i++) {
        const node = pellets[i]!, ring = rings[i], eaten = shown[i] === 1, phase = ((tick + i * 13) % 19) / 19;
        // Stable per-pellet phases and periods give sparse, irregular twinkles.
        const dim = !reduced && (tick + i * 37) % (17 + (i % 13)) < 2;
        set(node, "opacity", eaten ? ".3" : ring || !dim ? "1" : ".35");
        if (ring) {
          set(ring, "transform", `scale(${eaten || reduced ? 1 : (0.6 + phase * 0.8).toFixed(2)})`);
          set(ring, "opacity", eaten || reduced ? ".15" : (0.55 * (1 - phase)).toFixed(2));
        }
      }
    }
    const fl = world.flies, warning = power > 0 && power < 2 && !reduced && Math.floor(time * 2) % 2;
    for (let j = 0; j < MAX_GHOSTS; j++) {
      const sprite = flies[j]!, on = j < fl.count;
      set(sprite.node, "visibility", on ? "visible" : "hidden");
      if (!on) continue;
      const k = j + 1, d = a.dir[k]!;
      set(sprite.node, "data-byte-fly", String(fl.id[j]));
      set(sprite.node, "transform", `translate(${a.x[k]!.toFixed(2)} ${a.y[k]!.toFixed(2)}) scale(${flyScale}) translate(-13 -11)`);
      const flap = wingFrame(time, fl.phase[j]!, reduced);
      set(sprite.wing, "d", FLY_WINGS[flap]!);
      set(sprite.wing, "data-frame", String(flap));
      set(sprite.body, "fill", power > 0 ? (warning ? "#86a8df" : "#628dce") : FLY_COLORS[fl.kind[j]! % 3]!);
      set(sprite.node, "data-vulnerable", String(power > 0));
      set(sprite.pupils, "transform", `translate(${d === 2 ? -2 : d === 0 ? 0 : -1} ${d === 1 ? 1 : d === 3 ? -1 : 0})`);
    }
    set(fruit, "visibility", s[Wd.FRUIT] ? "visible" : "hidden");
    if (s[Wd.FRUIT]) {
      set(fruit, "transform", `translate(${s[Wd.FRUIT_X]! - 12} ${s[Wd.FRUIT_Y]! - 12}) scale(1.6)`);
      const kind = String(s[Wd.FRUIT_KIND]);
      if (fruit.getAttribute("data-kind") !== kind) set(fruit, "data-kind", kind), (fruit.innerHTML = s[Wd.FRUIT_KIND] ? BERRY : CHERRY);
    }
  }
  return {
    geometryKey,
    origin,
    measure,
    /** A new maze to draw at the next render. */
    show(maze: Maze) {
      pending = maze;
    },
    render,
  };
}
