/** Animation state uses simulation time and real movement, never DOM relocation. */
export interface RunnerAnimation {
  moving: boolean;
  runTime: number;
  chompUntil: number;
}
export const createRunnerAnimation = (): RunnerAnimation => ({
  moving: false,
  runTime: 0,
  chompUntil: 0,
});
export function moveAnimation(
  state: RunnerAnimation,
  dx: number,
  dy: number,
  dt: number,
) {
  state.moving = Math.hypot(dx, dy) > 0.01;
  if (state.moving) state.runTime += Math.max(0, dt);
}
export function runnerFrame(
  state: RunnerAnimation,
  time: number,
  reduced: boolean,
) {
  time = Math.max(0, time);
  const step =
    state.moving && !reduced ? 1 + (Math.floor(state.runTime * 12) % 4) : 0;
  const mouth =
    state.moving || time < state.chompUntil
      ? reduced
        ? 1
        : [0, 1, 2, 1][
            Math.floor((state.moving ? state.runTime : time) * 16) % 4
          ]!
      : 0;
  return { step, mouth, bob: step && step % 2 === 0 ? -1 : 0 };
}
export const wingFrame = (time: number, phase: number, reduced: boolean) =>
  reduced ? 0 : Math.floor(time * 8 + phase * 2) % 2;
