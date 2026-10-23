import type { GameOptions, GameController } from "./core/index.js";
import type { ByteRunnerStats } from "./simulation.js";
export type { ByteRunnerStats } from "./simulation.js";
export type { GameOptions, GameController, GameSnapshot, } from "./core/index.js";
export type ByteRunnerOptions = GameOptions<ByteRunnerStats>;
export declare function createByteRunner(options?: ByteRunnerOptions): GameController<ByteRunnerStats>;
