import type { GameContext, GameSimulation, GameStats, Player } from './core/index.js';
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
    pellets: number;
    pelletsRemaining: number;
    pelletsTotal: number;
    powerPellets: number;
}
export declare function createGame(api: GameContext): GameSimulation<ByteRunnerStats>;
