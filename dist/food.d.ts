import type { Pellet } from "./maze.js";
export declare const PELLET_RETURN_SECONDS = 12;
export declare const POWER_RETURN_SECONDS = 20;
/** Regrown food is a bonus. Only the first bite counts toward clearing a level. */
export declare function eatPellet(pellet: Pellet, time: number): boolean;
export declare function refillPellet(pellet: Pellet, time: number): boolean;
