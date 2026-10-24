/** Whitespace routes guide food and flies; their soft edges never fence in the frog. */
export interface Point {
    x: number;
    y: number;
}
export interface Wall {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
export interface Cell extends Point {
    id: number;
    row: number;
    col: number;
    exits: number[];
}
export interface Pellet extends Point {
    id: number;
    cell: number;
    power: boolean;
    eaten: boolean;
    cleared: boolean;
    respawnAt: number;
}
export interface Maze {
    cells: Cell[];
    pellets: Pellet[];
    step: number;
    radius: number;
    clearance: number;
    start: number;
    path: string;
}
export declare const TRAIL_RADIUS = 15;
export declare const TRAIL_CLEARANCE: number;
export declare const DIRECTIONS: readonly [readonly [1, 0], readonly [0, 1], readonly [-1, 0], readonly [0, -1]];
export declare const opposite: (direction: number) => number;
export declare function direction(a: Point, b: Point): 0 | 1 | 2 | 3;
export declare function blocked(a: Point, b: Point, walls: readonly Wall[], padding?: number): boolean;
export declare function distances(maze: Maze, start: number): Int16Array<ArrayBuffer>;
export declare function closest(maze: Maze, point: Point): number;
export declare function makeMaze(width: number, height: number, walls: readonly Wall[], random: () => number, text?: readonly Wall[]): Maze;
export interface Actor extends Point {
    from: number;
    to: number;
    offset: number;
    direction: number;
}
export declare function actorAt(maze: Maze, id: number): Actor;
/** Select at junctions, then spend the whole frame's distance along valid edges. */
export declare function advance(maze: Maze, actor: Actor, distance: number, choose: (cell: Cell) => number | undefined, visit?: (point: Point) => void): void;
export declare function reverse(maze: Maze, actor: Actor): void;
/** Correct only sideways drift onto a nearby parallel trail. A perpendicular
 * input always leaves it, so there is no snap, lock, idle drift or forced turn. */
export declare function guideToTrail(maze: Maze, point: Point, heading: number, travel: number): Point;
