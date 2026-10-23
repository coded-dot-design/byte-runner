import { useEffect, useRef } from "react";
import { createByteRunner } from "./index.js";
/** Memoize options. Changing the options object recalls and remounts the game. */
export function ByteRunner({ active = true, options }) {
  const controller = useRef(null);
  useEffect(() => {
    if (!active) return;
    const game = createByteRunner(options);
    controller.current = game;
    game.start();
    return () => {
      game.destroy();
      controller.current = null;
    };
  }, [active, options]);
  return null;
}
