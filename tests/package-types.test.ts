import { createByteRunner } from "@coded-design/byte-runner";
import { ByteRunner } from "@coded-design/byte-runner/react";
const game = createByteRunner({ root: "main" });
game.getSnapshot().power?.toFixed();
// @ts-expect-error Generated declarations preserve game-specific fields.
game.getSnapshot().power?.toUpperCase();
// @ts-expect-error Published React declarations preserve configuration types.
ByteRunner({ options: { targetSelector: 42 } });
ByteRunner({ active: true, options: { theme: "system" } });
