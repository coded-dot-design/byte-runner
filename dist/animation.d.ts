/** Animation state uses simulation time and real movement, never DOM relocation. */
export interface RunnerAnimation {
    moving: boolean;
    runTime: number;
    chompUntil: number;
    jumping: boolean;
    tongueUntil: number;
    tongue: {
        x: number;
        y: number;
    } | null;
}
export declare const createRunnerAnimation: () => RunnerAnimation;
export declare function moveAnimation(state: RunnerAnimation, dx: number, dy: number, dt: number): void;
export declare function runnerFrame(state: RunnerAnimation, time: number, reduced: boolean): {
    step: number;
    mouth: number;
    bob: number;
};
export declare const wingFrame: (time: number, phase: number, reduced: boolean) => number;
