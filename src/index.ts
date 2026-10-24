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
      color: "#3ecb74",
      actions: [
        { id: "jump", key: "Space", label: "Space · Jump" },
        { id: "refresh", key: "KeyM", label: "M · Refresh maze" },
      ],
      hint: "Arrows / WASD · Space / double-tap: jump · M: refresh maze · G: next area",
      create: createGame,
    },
    { targetEffects: "liquid", ...options, controls: "keyboard" },
  );
}
