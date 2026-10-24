import test from "node:test";
import assert from "node:assert/strict";
import {
  createRunnerAnimation,
  moveAnimation,
  runnerFrame,
  wingFrame,
} from "../src/animation.js";
import { frogArt, FROG_BODIES, FROG_EYES } from "../src/art.js";
test("feet advance only with locomotion while food chomp is independent", () => {
  const state = createRunnerAnimation();
  const seen = new Set();
  state.chompUntil = 1;
  for (let i = 0; i < 8; i++) {
    moveAnimation(state, 3, 0, 1 / 24);
    const f = runnerFrame(state, i / 24, false);
    seen.add(f.step);
    assert.ok(f.bob >= -1 && f.bob <= 0);
    assert.ok(f.mouth >= 0 && f.mouth <= 2);
  }
  assert.equal(seen.size, 4);
  const time = state.runTime;
  moveAnimation(state, 0, 0, 1);
  assert.equal(state.runTime, time);
  assert.equal(runnerFrame(state, 0.2, false).step, 0);
  assert.ok(runnerFrame(state, 0.2, false).mouth > 0);
  assert.equal(runnerFrame(state, 2, false).mouth, 0);
});
test("reduced motion keeps idle feet and stable wings, with readable chomp", () => {
  const state = { moving: true, runTime: 3, chompUntil: 10 };
  assert.deepEqual(runnerFrame(state, 2, true), { step: 0, mouth: 1, bob: 0 });
  assert.equal(wingFrame(2, 0.3, true), wingFrame(3, 0.8, true));
  assert.notEqual(wingFrame(2, 0, false), wingFrame(2, 0.6, false));
});
test("all directions and startup clock edges have finite, defined geometry", () => {
  const state = createRunnerAnimation();
  for (const t of [-0.04, 0, 0.12, 4]) {
    const f = runnerFrame(state, t, false);
    for (let facing = 0; facing < 4; facing++)
      assert.ok(FROG_BODIES[facing][f.mouth].body);
  }
  assert.ok(FROG_EYES.front.cream);
  assert.equal(frogArt().viewBox, "-2 -1 28 31");
});

test("running keeps a wide chomp cycle even between food, with no rim layer", () => {
  const state = { moving: true, runTime: 0, chompUntil: 0 },
    frames = new Set();
  for (let i = 0; i < 16; i++) {
    state.runTime = i / 32;
    frames.add(runnerFrame(state, 10, false).mouth);
  }
  assert.deepEqual([...frames].sort(), [0, 1, 2]);
  assert.ok(FROG_BODIES.every((poses) => poses.every((p) => !("rim" in p))));
  assert.ok(
    frogArt().layers.every(
      (layer) => !["#19774d", "#438c40"].includes(layer.fill),
    ),
  );
});

test("vertical poses keep the whole round body across every chomp frame", () => {
  for (const direction of [1, 3])
    assert.equal(new Set(FROG_BODIES[direction].map((f) => f.body)).size, 1);
  assert.equal(FROG_BODIES[1][0].body, FROG_BODIES[3][0].body);
  assert.notEqual(FROG_BODIES[0][0].body, FROG_BODIES[0][2].body);
});
