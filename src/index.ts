import type { GameOptions, GameController } from "@coded-design/dom-virus";
import type { ByteRunnerStats } from "./simulation.js";
export type { ByteRunnerStats } from "./simulation.js";
export type {
  GameOptions,
  GameController,
  GameSnapshot,
} from "@coded-design/dom-virus";
export type ByteRunnerOptions = GameOptions<ByteRunnerStats>;
import { createArcade } from "@coded-design/dom-virus";
import { createGame } from "./simulation.js";

export function createByteRunner(
  options: ByteRunnerOptions = {},
): GameController<ByteRunnerStats> {
  return createArcade(
    {
      id: "byte-runner",
      title: "BYTE RUNNER",
      color: "#cbff69",
      hint: "Arrows / WASD · Eat 6 letters to spawn an orb · G: next gate",
      create: createGame,
    },
    { targetEffects: "liquid", ...options, controls: "keyboard" },
  );
}
