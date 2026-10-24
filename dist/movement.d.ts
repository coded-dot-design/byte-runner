import type { Actor, Maze, Point } from "./maze.js";
/** Project onto an edge, not its endpoints: catching a pipe never skips food. */
export declare function catchTrail(maze: Maze, point: Point, heading: number, radius?: number): Actor | null;
/** Queue turns at junctions; carry momentum around unambiguous bends. */
export declare function runPipe(maze: Maze, actor: Actor, requested: number, travel: number, visit: (p: Point) => void, reversePressed?: boolean): void;
export declare const TONGUE_REACH = 54;
export declare function tongueTarget(player: Actor, target: Point): boolean;
