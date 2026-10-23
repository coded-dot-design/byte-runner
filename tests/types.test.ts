import { createByteRunner } from "../src/index.js";
import { ByteRunner } from "../src/react.js";
const game = createByteRunner({
  onState(state) {
    const value: number | undefined = state.power;
    void value;
    // @ts-expect-error Game-specific snapshot fields retain their type.
    const wrong: string = state.power;
    void wrong;
  },
});
game.destroy();
// @ts-expect-error Invalid controls are caught before running a game.
createByteRunner({ controls: "joystick" });
// @ts-expect-error The shared React adapter preserves option types.
ByteRunner({ options: { targetSelector: 12 } });
