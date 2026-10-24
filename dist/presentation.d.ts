import type { GameContext } from './core/index.js';
import type { Actor, Maze, Point, Wall } from './maze.js';
export declare const RUNNER_OPEN = "M4 0h6v1h2v2h2v1h-2v1h-2v1H8v2h2v1h2v1h2v1h-2v2h-2v1H4v-1H2v-2H1V9H0V5h1V3h1V1h2Z";
export declare const RUNNER_CLOSED = "M4 0h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H4v-1H2v-2H1V9H0V5h1V3h1V1h2Z";
export declare const GHOST = "M4 0h6v1h2v2h1v2h1v9h-2v-2h-2v2H8v-2H6v2H4v-2H2v2H0V5h1V3h1V1h2Z";
export declare const CHERRY = "<path d=\"M7 7V3h3V1h2v2h-1v6H9V5H8v4Z\" fill=\"#4bce82\"/><path d=\"M2 7h4v1h2v5H6v1H2v-1H1V9h1Zm8 2h4v1h1v4h-1v1h-4v-1H9v-4h1Z\" fill=\"#f4457a\"/><path d=\"M2 8h2v2H2zm8 2h2v2h-2Z\" fill=\"#fff4ff\"/>";
export declare const BERRY = "<path d=\"M3 1h3v2h4V1h3v3h-3v2H6V4H3Z\" fill=\"#4bce82\"/><path d=\"M3 5h10v1h2v4h-2v2h-2v2H9v1H7v-1H5v-2H3v-2H1V6h2Z\" fill=\"#ee6875\"/><path d=\"M4 6h1v2H4zm6 0h1v2h-1zM7 9h1v2H7Z\" fill=\"#fff4ff\"/>";
export interface Frame {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    left: number;
    top: number;
    walls: Wall[];
    key: string;
}
export declare function createPresentation(api: GameContext): {
    measure: () => Frame;
    mount: (maze: Maze, nextFrame: Frame) => void;
    viewport: (p: Point) => Point;
    syncPosition: () => void;
    eat(id: number): void;
    render(player: Actor | null, ghosts: readonly (Actor & {
        kind: number;
    })[], power: number, shield: number, bonus: (Point & {
        kind: number;
    }) | null): void;
};
