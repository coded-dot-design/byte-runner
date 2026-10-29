export type ByteRunnerStatus = "idle" | "running" | "paused" | "won" | "gameover" | "destroyed";
export interface ByteRunnerStats {
    score: number;
    lives: number;
    wave: number;
    /** Letters eaten. */
    eaten: number;
    /** Power seconds left. */
    power: number;
    /** Flies alive. */
    alive: number;
    /** Power food on the trails, plus the fruit when it is out. */
    pickups: number;
    player: {
        x: number;
        y: number;
        angle: number;
    };
    detail: string;
    /** Food eaten this level (first bites), left, and the level's total. */
    pellets: number;
    pelletsRemaining: number;
    pelletsTotal: number;
    powerPellets: number;
}
export interface ByteRunnerOptions {
    /** The content root the trails run through (a selector or an element; default document.body). */
    root?: string | Element;
    /** Text that holds edible letters (default headings, paragraphs, list items, blockquotes). */
    textSelector?: string;
    /** Elements that become gates (default buttons and button-like links). */
    targetSelector?: string;
    /** More of the page to leave alone (fields, editable text and dialogs always are). */
    excludeSelector?: string;
    /** "system" (default) follows the visitor's colour scheme. */
    theme?: "dark" | "light" | "system";
    /** Same seed, same run (trails, flies, fruit). */
    seed?: number;
    /** Calm effects (default: the visitor's prefers-reduced-motion). */
    reducedMotion?: boolean;
    /** Start with sound on (default true; it waits for a click or key to unlock). */
    sound?: boolean;
    /** Byte Runner is keys only (the mouse never steers); "keyboard" is accepted for the hub. */
    controls?: "mouse" | "keyboard";
    onState?: (state: ByteRunnerSnapshot) => void;
    onEvent?: (event: {
        type: string;
        game: string;
        [key: string]: unknown;
    }) => void;
    onError?: (error: unknown) => void;
}
export type ByteRunnerSnapshot = Partial<ByteRunnerStats> & {
    id: string;
    status: ByteRunnerStatus;
    elapsed: number;
    frameMs: number;
    maxFrameMs: number;
    notice: string;
    /** Letters indexed, on screen and turned to bits, and the range reads the last measurement made. */
    board?: {
        indexed: number;
        visible: number;
        spent: number;
        measurements: number;
    };
    /** Sparks alive (at most 100). */
    particles?: number;
};
export interface ByteRunnerController {
    start(): ByteRunnerSnapshot;
    pause(): void;
    resume(): void;
    stop(): void;
    destroy(): void;
    getSnapshot(): ByteRunnerSnapshot;
}
export declare function createByteRunner(options?: ByteRunnerOptions): ByteRunnerController;
