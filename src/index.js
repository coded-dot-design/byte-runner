import { createArcade } from "@coded-design/dom-virus";
import { createGame } from "./simulation.js";

export function createByteRunner(options = {}) {
  return createArcade(
    {
      id: "byte-runner",
      title: "BYTE RUNNER",
      color: "#cbff69",
      hint: "Arrows / WASD · Eat 6 letters to spawn an orb · G: next gate",
      create: createGame,
    },
    { ...options, controls: "keyboard" },
  );
}
