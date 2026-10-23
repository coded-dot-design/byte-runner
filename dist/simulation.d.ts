import type { GameContext, GameSimulation, GameStats, Player } from "./core/index.js";
export interface ByteRunnerStats extends GameStats {
    score: number;
    lives: number;
    wave: number;
    eaten: number;
    power: number;
    alive: number;
    pickups: number;
    player: Player;
    detail: string;
}
export declare function createGame(api: GameContext): GameSimulation<ByteRunnerStats>;
