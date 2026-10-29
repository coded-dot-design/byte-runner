// Byte Runner on Fizlet: a frog runs whitespace trails between the page's own words, eats the food
// and the letters along them (a bite turns a letter into a 0 or 1), and hunts the flies after power
// food. The page's buttons are the gates: their fill shows the power time left. Recall gives every
// letter and button back. The shell (engine per run, page, overlay, scoreboard, keys, touch pad,
// sound, sparks, popups, the controller the DOM VIRUS hub drives) is fizlet/arcade; the rules are
// ./world; the trails are built from the page's layout by ./maze in the read phase; the art is an
// SVG inside the page (./presentation). This file is the game's definition.
import { arcade, CALM, TARGET_HP, VH, VW } from "../vendor/fizlet/arcade";
import { seeded } from "../vendor/fizlet/kernel/random";
import { makeMaze } from "./maze.js";
import { createPresentation } from "./presentation.js";
import * as Wd from "./world.js";

declare const __KIT_CSS__: string;

// The public types are written out here (the same shapes as fizlet/arcade's), so the package's
// declarations stand alone: a consumer type-checks without the vendored engine.
export type ByteRunnerStatus = "idle" | "running" | "paused" | "won" | "gameover" | "destroyed";
export interface ByteRunnerStats {
  score: number;
  lives: number;
  wave: number;
  /** Letters eaten. */
  eaten: number;
  /** Power seconds left. */
  power: number;
  /** Flies alive. */
  alive: number;
  /** Power food on the trails, plus the fruit when it is out. */
  pickups: number;
  player: { x: number; y: number; angle: number };
  detail: string;
  /** Food eaten this level (first bites), left, and the level's total. */
  pellets: number;
  pelletsRemaining: number;
  pelletsTotal: number;
  powerPellets: number;
}
export interface ByteRunnerOptions {
  /** The content root the trails run through (a selector or an element; default document.body). */
  root?: string | Element;
  /** Text that holds edible letters (default headings, paragraphs, list items, blockquotes). */
  textSelector?: string;
  /** Elements that become gates (default buttons and button-like links). */
  targetSelector?: string;
  /** More of the page to leave alone (fields, editable text and dialogs always are). */
  excludeSelector?: string;
  /** "system" (default) follows the visitor's colour scheme. */
  theme?: "dark" | "light" | "system";
  /** Same seed, same run (trails, flies, fruit). */
  seed?: number;
  /** Calm effects (default: the visitor's prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Start with sound on (default true; it waits for a click or key to unlock). */
  sound?: boolean;
  /** Byte Runner is keys only (the mouse never steers); "keyboard" is accepted for the hub. */
  controls?: "mouse" | "keyboard";
  onState?: (state: ByteRunnerSnapshot) => void;
  onEvent?: (event: { type: string; game: string; [key: string]: unknown }) => void;
  onError?: (error: unknown) => void;
}
export type ByteRunnerSnapshot = Partial<ByteRunnerStats> & {
  id: string;
  status: ByteRunnerStatus;
  elapsed: number;
  frameMs: number;
  maxFrameMs: number;
  notice: string;
  /** Letters indexed, on screen and turned to bits, and the range reads the last measurement made. */
  board?: { indexed: number; visible: number; spent: number; measurements: number };
  /** Sparks alive (at most 100). */
  particles?: number;
};
export interface ByteRunnerController {
  start(): ByteRunnerSnapshot;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
  getSnapshot(): ByteRunnerSnapshot;
}

const COLOR = "#3ecb74";
const pad = (n: number, k: number) => String(n).padStart(k, "0");

export function createByteRunner(options: ByteRunnerOptions = {}): ByteRunnerController {
  return arcade<ByteRunnerStats>(
    {
      id: "byte-runner",
      title: "Byte Runner",
      color: COLOR,
      hint: "Arrows / WASD · Space / double-tap: jump · M: refresh maze · G: next gate",
      touchHint: "Joystick to run · Jump to leap a gap",
      css: __KIT_CSS__,
      keyboard: true,
      actions: [
        { id: "jump", key: "Space", label: "Space · Jump" },
        { id: "refresh", key: "KeyM", label: "M · Refresh maze" },
      ],
      readouts: [["Score", "team", (v) => pad(v, 6)], ["Level", undefined, (v) => pad(v, 2)], ["Lives", undefined, undefined, true], ["Power", undefined, (v) => (v ? `${(v / 10).toFixed(1)}s` : "—"), true]],
      meter: { label: "Food eaten this level" },
      colors: [COLOR, "#f4457a", "#ee6875"],
      cues: { "level-start": "ready", pellet: "click", letter: "click", fruit: "power", power: "power", "ghost-eaten": "power", hurt: "hurt", "level-clear": "win" },
      create(ctx) {
        const rootOption = options.root;
        const root = (typeof rootOption === "string" ? document.querySelector(rootOption) : rootOption) ?? document.body;
        const shadow = ctx.attach(root);
        if (!shadow) throw new Error("Byte Runner needs an HTML content root it can draw inside.");
        (shadow.host as HTMLElement).style.setProperty("z-index", "2147482990", "important");
        const theme = options.theme ?? "system";
        const dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
        const view = createPresentation(shadow, root, ctx.board, "byte-runner", dark);
        const world = Wd.createWorld(ctx.engine, ctx.board, ctx.ctl, ctx.input);
        const { s, ctl } = world;
        const seed = Math.floor(ctx.engine.random() * 0x7fffffff);
        let key = "", checked = -1;
        // A maze from the page's layout (read phase): a new level, or the same run reflowed.
        function build(preserve: boolean) {
          const frame = view.measure();
          const maze = makeMaze(frame.width, frame.height, frame.walls, seeded(seed + s[Wd.WAVE]! * 7919 + s[Wd.REVISION]! * 3571), frame.text);
          if (world.load(maze, frame, preserve)) (key = view.geometryKey()), view.show(maze);
        }
        const sync = () => {
          s[Wd.W] = ctl[VW]!;
          s[Wd.H] = ctl[VH]!;
          s[Wd.REDUCED] = ctl[CALM]!;
          ctl[TARGET_HP] = 100;
          view.origin(s);
        };
        ctx.engine.add({
          read(e) {
            sync();
            // The trails follow the page: checked every 0.35 s (sooner when a level or M asks).
            if (!s[Wd.REGEN] && e.time - checked < 0.35) return;
            checked = e.time;
            if (s[Wd.REGEN] === 1 || s[Wd.FRESH]) build(false);
            else if (s[Wd.REGEN] || !s[Wd.READY] || view.geometryKey() !== key) build(!!s[Wd.PLAYER]);
          },
        });
        return {
          reset() {
            sync();
            world.reset();
            checked = -1;
            build(false);
          },
          over: () => s[Wd.OVER]!,
          react(ev) {
            switch (ev.type) {
              case "pellet": ctx.emit("pellet", { remaining: ev.a, power: !!ev.b, score: ev.v }); break;
              case "power": ctx.spark(ev.x, ev.y, 10, 1); ctx.emit("power", { seconds: ev.a }); break;
              case "power-end": ctx.emit("power-end"); break;
              case "letter": ctx.emit("letter", { eaten: ev.a, score: ev.v }); break;
              case "fruit": ctx.popup(ev.x, ev.y, ev.a, null, 0); ctx.emit("fruit", { score: ev.v }); break;
              case "pickup-spawn": ctx.emit("pickup-spawn", { kind: "fruit" }); break;
              case "spawn": ctx.emit("spawn"); break;
              case "ghost-eaten": ctx.popup(ev.x, ev.y, ev.a, null, 0); ctx.emit("ghost-eaten", { score: ev.v, combo: ev.b }); break;
              case "hurt": ctx.spark(ev.x, ev.y, 12, 2); ctx.emit("hurt", { lives: ev.a }); break;
              case "level-clear": ctx.popup(ev.x, ev.y, 0, `LEVEL ${ev.a} CLEAR +${ev.b}`, 1); ctx.say(`LEVEL ${ev.a} CLEAR · Next trails incoming`); ctx.emit("level-clear", { wave: ev.a, score: ev.v }); break;
              case "level-start": ctx.emit("level-start", { wave: ev.a, pellets: ev.b, walls: ev.v }); break;
              case "maze-reflow": ctx.emit("maze-reflow", { wave: ev.a, pellets: ev.b, walls: ev.v }); break;
            }
          },
          draw() {
            view.render(world, ctx.reduced());
          },
          hud(out) {
            out[0] = s[Wd.SCORE]!;
            out[1] = s[Wd.WAVE]!;
            out[2] = s[Wd.LIVES]!;
            out[3] = Math.ceil(s[Wd.POWER]! * 10);
            out[4] = s[Wd.REMAINING]! * 1024 + s[Wd.WAVE]! + (s[Wd.READY] ? 0 : 0.5); // the meter's change key
          },
          meter() {
            const left = s[Wd.REMAINING]!, total = s[Wd.TOTAL]!;
            return [`LEVEL ${s[Wd.WAVE]}`, s[Wd.READY] ? `${left} PELLETS LEFT` : "FINDING TRAILS", total ? s[Wd.COLLECTED]! / total : 0] as const;
          },
          stats() {
            const a = world.actors, on = !!s[Wd.PLAYER], power = s[Wd.POWER]!, powerLeft = world.powerLeft();
            return {
              score: s[Wd.SCORE]!, lives: s[Wd.LIVES]!, wave: s[Wd.WAVE]!, eaten: s[Wd.EATEN]!, power, alive: world.flies.count,
              pickups: powerLeft + (s[Wd.FRUIT] ? 1 : 0), pellets: s[Wd.COLLECTED]!, pelletsRemaining: s[Wd.REMAINING]!, pelletsTotal: s[Wd.TOTAL]!, powerPellets: powerLeft,
              player: { x: on ? world.viewport.x(a.x[0]!) : 0, y: on ? world.viewport.y(a.y[0]!) : 0, angle: (Math.max(0, a.dir[0]!) * Math.PI) / 2 },
              detail: !s[Wd.READY] || !on
                ? "Scroll to an open part of the page to find food trails"
                : s[Wd.TRANSITION]! > 0
                  ? `LEVEL ${s[Wd.WAVE]} CLEAR · Next trails incoming`
                  : `${s[Wd.REMAINING]} PELLETS LEFT · ${power > 0 ? `POWER ${power.toFixed(1)}s · Hunt flies` : "Arrows / WASD · Space / double-tap to jump"}`,
            };
          },
        };
      },
    },
    { ...options, controls: "keyboard" },
  );
}
