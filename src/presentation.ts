import type { GameContext } from "@coded-design/dom-virus";
import type { Actor, Maze, Point, Wall } from "./maze.js";
import {
  FROG,
  FROG_BODIES,
  FROG_EYES,
  FROG_FEET,
  FLY_BODY,
  FLY_EYES,
  FLY_PUPILS,
  FLY_WINGS,
  FLY_FEET,
  FLY_COLORS,
  WING,
  CREAM,
} from "./art.js";
import { runnerFrame, wingFrame } from "./animation.js";
import type { RunnerAnimation } from "./animation.js";
export const CHERRY =
  '<path d="M7 7V3h3V1h2v2h-1v6H9V5H8v4Z" fill="#4bce82"/><path d="M2 7h4v1h2v5H6v1H2v-1H1V9h1Zm8 2h4v1h1v4h-1v1h-4v-1H9v-4h1Z" fill="#f4457a"/><path d="M2 8h2v2H2zm8 2h2v2h-2Z" fill="#fff4ff"/>';
export const BERRY =
  '<path d="M3 1h3v2h4V1h3v3h-3v2H6V4H3Z" fill="#4bce82"/><path d="M3 5h10v1h2v4h-2v2h-2v2H9v1H7v-1H5v-2H3v-2H1V6h2Z" fill="#ee6875"/><path d="M4 6h1v2H4zm6 0h1v2h-1zM7 9h1v2H7Z" fill="#fff4ff"/>';
const NS = "http://www.w3.org/2000/svg";
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
  walls: Wall[];
  solids: Wall[];
  text: Wall[];
  key: string;
}
interface Fly extends Actor {
  id: number;
  kind: number;
  phase: number;
}
const set = (node: Element, key: string, value: string) => {
  if (node.getAttribute(key) !== value) node.setAttribute(key, value);
};
export function createPresentation(api: GameContext) {
  const doc = api.options.document ?? globalThis.document;
  const root =
    typeof api.options.root === "string"
      ? doc.querySelector(api.options.root)
      : (api.options.root ?? doc.body);
  const shadow = root && api.board.attach?.(root);
  if (!shadow)
    throw new Error("Byte Runner needs an attachable HTML content root.");
  const host = shadow.host as HTMLElement;
  host.style.setProperty("z-index", "2147482990", "important");
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("data-byte-maze", "");
  svg.setAttribute("data-byte-trails", "");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "position:absolute;pointer-events:none;overflow:hidden;isolation:isolate;";
  shadow.append(svg);
  let frame: Frame,
    origin = { x: 0, y: 0 };
  let runner: SVGGElement,
    pose: SVGGElement,
    torso: SVGGElement,
    body: SVGPathElement,
    stems: SVGPathElement,
    cream: SVGPathElement,
    pupils: SVGPathElement,
    feet: SVGPathElement,
    foodLayer: SVGGElement,
    fruit: SVGGElement,
    flyLayer: SVGGElement;
  let pellets: SVGElement[] = [],
    flyScale = 1.1;
  const flies = new Map<
    number,
    {
      node: SVGGElement;
      wing: SVGPathElement;
      body: SVGPathElement;
      pupils: SVGPathElement;
    }
  >();
  function measure(): Frame {
    const box = host.getBoundingClientRect(),
      scaleX = box.width / (host.clientWidth || box.width) || 1,
      scaleY = box.height / (host.clientHeight || box.height) || 1;
    const left = Math.max(0, box.left),
      top = Math.max(0, box.top),
      right = Math.min(api.width, box.right),
      bottom = Math.min(api.height, box.bottom);
    const convert = (r: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }): Wall => ({
      left: (r.left - left) / scaleX,
      right: (r.right - left) / scaleX,
      top: (r.top - top) / scaleY,
      bottom: (r.bottom - top) / scaleY,
    });
    const visible = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.right > left &&
      r.left < right &&
      r.bottom > top &&
      r.top < bottom;
    const explicit = new Set<Element>(
      root!.querySelectorAll("[data-byte-wall]"),
    );
    const hud = doc.querySelector("[data-dom-virus-root]")?.shadowRoot;
    for (const el of hud?.querySelectorAll(".hud,.dpad") ?? [])
      explicit.add(el);
    const targets = new Set<Element>([
      ...api.board.targets.map((t) => t.element).filter(Boolean),
      ...explicit,
      ...doc.querySelectorAll("[data-byte-obstacle]"),
      ...root!.querySelectorAll(
        'button,a[href],input,select,textarea,summary,[role="button"],[contenteditable="true"],img,svg,canvas,video,iframe,object,embed,pre,table,hr,figure,fieldset,details,[role="img"]',
      ),
    ]);
    const walls: Wall[] = [],
      solids: Wall[] = [];
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (visible(r)) {
        const w = convert(r);
        walls.push(w);
        if (explicit.has(el)) solids.push(w);
      }
    }
    // All visible text is occupied terrain, including non-edible labels. Only
    // collection uses the board's eligible glyphs. No wrappers or text mutation
    // are needed to measure whitespace.
    const text: Wall[] = [],
      range = doc.createRange();
    const walker = doc.createTreeWalker(root!, 4);
    const boxes = new Map<Element, DOMRect>(),
      fallback = new Map<Element, Wall>();
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          "script,style,noscript,svg,canvas,button,a[href],input,select,textarea,pre,table,[data-dom-virus-root],[data-virus-ui]",
        )
      )
        continue;
      let box = boxes.get(parent);
      if (!box) {
        box = parent.getBoundingClientRect();
        boxes.set(parent, box);
      }
      if (!visible(box)) continue;
      // Beyond the detailed line budget, block the native parent conservatively.
      if (text.length >= 200) {
        if (!fallback.has(parent)) {
          const r = convert(box);
          text.push(r);
          fallback.set(parent, r);
        }
        continue;
      }
      range.selectNodeContents(node);
      for (const r of range.getClientRects())
        if (visible(r)) text.push(convert(r));
    }
    const width = Math.max(0, (right - left) / scaleX),
      height = Math.max(0, (bottom - top) / scaleY),
      x = (left - box.left) / scaleX,
      y = (top - box.top) / scaleY;
    const key =
      [
        x,
        y,
        width,
        height,
        ...walls.flatMap((w) => [w.left, w.top, w.right, w.bottom]),
      ]
        .map((n) => Math.round(n / 2))
        .join(",") +
      "|" +
      text
        .flatMap((r) => [r.left, r.top, r.right, r.bottom])
        .map((n) => Math.round(n / 2))
        .join(",");
    return {
      x,
      y,
      width,
      height,
      scaleX,
      scaleY,
      left,
      top,
      walls,
      solids,
      text,
      key,
    };
  }
  function mount(maze: Maze, next: Frame) {
    frame = next;
    flyScale = maze.radius < 12 ? 0.78 : 1.1;
    svg.style.left = `${frame.x}px`;
    svg.style.top = `${frame.y}px`;
    set(svg, "width", String(frame.width));
    set(svg, "height", String(frame.height));
    set(svg, "viewBox", `0 0 ${frame.width || 1} ${frame.height || 1}`);
    // Two strokes in a mask leave only the soft outside edges of the union.
    // The center stays transparent, with no crossbars across route junctions.
    if (!runner)
      svg.innerHTML =
        '<defs><mask id="byte-trail-edge" maskUnits="userSpaceOnUse"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path data-byte-edge-outer stroke="white"/><path data-byte-edge-inner stroke="black"/></g></mask></defs><path data-byte-guides fill="none" stroke-linecap="round" stroke-linejoin="round" mask="url(#byte-trail-edge)"/><g data-byte-food shape-rendering="crispEdges"></g><g data-byte-fruit visibility="hidden" shape-rendering="crispEdges"></g><g data-byte-flies></g><g data-byte-runner><g transform="scale(1.2) translate(-12 -15)"><g data-byte-pose shape-rendering="crispEdges"><path data-byte-feet/><g data-byte-torso><path data-byte-body/><g data-byte-eyes><path data-stems/><path data-cream/><path data-pupils/></g></g></g></g></g>';
    const dark =
      api.options.theme === "dark" ||
      (api.options.theme !== "light" &&
        doc.defaultView!.matchMedia("(prefers-color-scheme:dark)").matches);
    const mask = svg.querySelector("mask")!;
    for (const [key, value] of Object.entries({
      x: 0,
      y: 0,
      width: frame.width,
      height: frame.height,
    }))
      set(mask, key, String(value));
    for (const [selector, width] of [
      ["[data-byte-edge-outer]", maze.radius * 2],
      ["[data-byte-edge-inner]", maze.radius * 2 - 3],
      ["[data-byte-guides]", maze.radius * 2],
    ] as const) {
      const path = svg.querySelector(selector)!;
      set(path, "d", maze.path);
      set(path, "stroke-width", String(width));
    }
    const guides = svg.querySelector("[data-byte-guides]")!;
    set(guides, "stroke", dark ? "#b1a1e8" : "#8573bb");
    set(guides, "opacity", dark ? ".25" : ".32");
    const food = (foodLayer =
      svg.querySelector<SVGGElement>("[data-byte-food]")!);
    food.replaceChildren();
    pellets = maze.pellets.map((p) => {
      const n = doc.createElementNS(NS, p.power ? "g" : "rect");
      n.setAttribute(
        p.power ? "data-byte-power" : "data-byte-pellet",
        String(p.id),
      );
      if (p.power) {
        n.setAttribute("transform", `translate(${p.x} ${p.y})`);
        const halo = Math.min(14, maze.radius),
          glow = Math.min(10, maze.radius - 1),
          core = Math.min(7, maze.radius - 2);
        n.innerHTML = `<rect x="${-halo}" y="${-halo}" width="${halo * 2}" height="${halo * 2}" fill="#f4457a" opacity=".1"/><rect x="${-glow}" y="${-glow}" width="${glow * 2}" height="${glow * 2}" fill="#f4457a" opacity=".24"/><rect x="${-core}" y="${-core}" width="${core * 2}" height="${core * 2}" fill="#f4457a"/>`;
      } else {
        n.setAttribute("x", String(p.x - 2));
        n.setAttribute("y", String(p.y - 2));
        n.setAttribute("width", "4");
        n.setAttribute("height", "4");
        n.setAttribute("fill", dark ? "#fff5d7" : "#6758bd");
      }
      n.setAttribute(
        "data-food-color",
        p.power ? "#f4457a" : dark ? "#fff5d7" : "#6758bd",
      );
      n.setAttribute("data-eaten", String(p.eaten));
      food.append(n);
      return n;
    });
    runner = svg.querySelector("[data-byte-runner]")!;
    pose = svg.querySelector("[data-byte-pose]")!;
    torso = svg.querySelector("[data-byte-torso]")!;
    body = svg.querySelector("[data-byte-body]")!;
    feet = svg.querySelector("[data-byte-feet]")!;
    stems = svg.querySelector("[data-stems]")!;
    cream = svg.querySelector("[data-cream]")!;
    pupils = svg.querySelector("[data-pupils]")!;
    fruit = svg.querySelector("[data-byte-fruit]")!;
    flyLayer = svg.querySelector("[data-byte-flies]")!;
    maze.pellets.forEach((p) => foodState(p.id, p.eaten));
  }
  const syncPosition = () => {
    const r = host.getBoundingClientRect();
    origin = { x: r.left, y: r.top };
  };
  const viewport = (p: Point): Point => ({
    x: origin.x + (frame.x + p.x) * frame.scaleX,
    y: origin.y + (frame.y + p.y) * frame.scaleY,
  });
  const local = (p: Point): Point => ({
    x: (p.x - origin.x) / frame.scaleX - frame.x,
    y: (p.y - origin.y) / frame.scaleY - frame.y,
  });
  function render(
    player: Actor | null,
    enemies: readonly Fly[],
    power: number,
    shield: number,
    bonus: (Point & { kind: number }) | null,
    animation: RunnerAnimation,
  ) {
    if (!runner) return;
    set(runner, "visibility", player ? "visible" : "hidden");
    if (!player) return;
    set(
      runner,
      "transform",
      `translate(${player.x.toFixed(2)} ${player.y.toFixed(2)})`,
    );
    const facing = Math.max(0, player.direction),
      f = runnerFrame(animation, api.time, api.reducedMotion),
      pixels = FROG_BODIES[facing]![f.mouth]!,
      eyes = facing === 1 || facing === 3 ? FROG_EYES.front : FROG_EYES.side;
    set(
      pose,
      "transform",
      facing === 2 ? "translate(24 0) scale(-1 1)" : "translate(0 0)",
    );
    set(pose, "data-facing", String(facing));
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
    set(
      pupils,
      "transform",
      `translate(0 ${facing === 1 ? 1 : facing === 3 ? -1 : 0})`,
    );
    set(feet, "d", FROG_FEET[f.step]!);
    set(feet, "fill", power ? FROG.power : FROG.body);
    set(feet, "data-frame", String(f.step));
    set(runner, "data-protected", String(shield > 0));
    set(
      runner,
      "opacity",
      shield > 0
        ? api.reducedMotion
          ? ".8"
          : Math.floor(api.time * 4) % 2
            ? ".65"
            : "1"
        : "1",
    );
    // One quantized pulse for the entire food layer; no per-pellet animations.
    set(
      foodLayer,
      "opacity",
      api.reducedMotion
        ? "1"
        : ["1", ".85", ".7", ".85"][Math.floor(api.time * 2) % 4]!,
    );
    const alive = new Set<number>();
    for (const g of enemies) {
      alive.add(g.id);
      let sprite = flies.get(g.id);
      if (!sprite) {
        const n = doc.createElementNS(NS, "g");
        n.setAttribute("data-byte-fly", String(g.id));
        n.setAttribute("shape-rendering", "crispEdges");
        n.innerHTML = `<path data-wings fill="${WING}"/><path d="${FLY_FEET}" fill="#273148"/><path data-body d="${FLY_BODY}"/><path d="${FLY_EYES}" fill="${CREAM}"/><path data-pupils d="${FLY_PUPILS}" fill="#152820"/>`;
        flyLayer.append(n);
        sprite = {
          node: n,
          wing: n.querySelector("[data-wings]")!,
          body: n.querySelector("[data-body]")!,
          pupils: n.querySelector("[data-pupils]")!,
        };
        flies.set(g.id, sprite);
      }
      set(
        sprite.node,
        "transform",
        `translate(${g.x.toFixed(2)} ${g.y.toFixed(2)}) scale(${flyScale}) translate(-13 -11)`,
      );
      const flap = wingFrame(api.time, g.phase, api.reducedMotion);
      set(sprite.wing, "d", FLY_WINGS[flap]!);
      set(sprite.wing, "data-frame", String(flap));
      const warning =
        power > 0 &&
        power < 2 &&
        !api.reducedMotion &&
        Math.floor(api.time * 2) % 2;
      set(
        sprite.body,
        "fill",
        power > 0 ? (warning ? "#86a8df" : "#628dce") : FLY_COLORS[g.kind % 3]!,
      );
      set(sprite.node, "data-vulnerable", String(power > 0));
      set(
        sprite.pupils,
        "transform",
        `translate(${g.direction === 2 ? -2 : g.direction === 0 ? 0 : -1} ${g.direction === 1 ? 1 : g.direction === 3 ? -1 : 0})`,
      );
    }
    for (const [id, sprite] of flies)
      if (!alive.has(id)) {
        sprite.node.remove();
        flies.delete(id);
      }
    set(fruit, "visibility", bonus ? "visible" : "hidden");
    if (bonus) {
      set(
        fruit,
        "transform",
        `translate(${bonus.x - 12} ${bonus.y - 12}) scale(1.6)`,
      );
      if (fruit.getAttribute("data-kind") !== String(bonus.kind)) {
        set(fruit, "data-kind", String(bonus.kind));
        fruit.innerHTML = bonus.kind ? BERRY : CHERRY;
      }
    }
  }
  function foodState(id: number, eaten: boolean) {
    const node = pellets[id];
    if (!node) return;
    set(node, "data-eaten", String(eaten));
    set(node, "opacity", eaten ? ".3" : "1");
    if (node.tagName === "rect")
      set(
        node,
        "fill",
        eaten ? "#8c929d" : node.getAttribute("data-food-color")!,
      );
    else
      for (const rect of node.children)
        set(rect, "fill", eaten ? "#8c929d" : "#f4457a");
  }
  return {
    measure,
    visible(show: boolean) {
      set(svg, "visibility", show ? "visible" : "hidden");
    },
    mount,
    viewport,
    local,
    syncPosition,
    render,
    refill(id: number) {
      foodState(id, false);
    },
    eat(id: number) {
      foodState(id, true);
    },
  };
}
