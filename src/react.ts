// React adapter: mounts Byte Runner while `active`, and gives the page back on unmount.
import { useEffect } from "react";
import { createByteRunner } from "./game.js";
import type { ByteRunnerOptions } from "./game.js";

export function ByteRunner({ active = true, options }: { active?: boolean; options?: ByteRunnerOptions }) {
  useEffect(() => {
    if (!active) return;
    const game = createByteRunner(options);
    game.start();
    return () => game.destroy();
  }, [active, options]);
  return null;
}
