import test from "node:test";
import assert from "node:assert/strict";
import { actorAt } from "../src/maze.ts";
import { catchTrail, runPipe, tongueTarget } from "../src/movement.ts";
const maze = {
  cells: [
    { id: 0, x: 20, y: 40, exits: [1] },
    { id: 1, x: 100, y: 40, exits: [0, 2] },
    { id: 2, x: 100, y: 100, exits: [1, 3] },
    { id: 3, x: 20, y: 100, exits: [2] },
  ],
};
test("pipe consumes full distance around bends, keeps queued turns, and does not reverse from stale held input", () => {
  const p = actorAt(maze, 0),
    samples = [];
  runPipe(maze, p, 0, 160, (v) => samples.push({ ...v }));
  assert.equal(p.x, 80);
  assert.equal(p.y, 100);
  assert.equal(p.direction, 2);
  runPipe(maze, p, 0, 20, () => {}, false);
  assert.equal(p.x, 60);
  assert.equal(p.y, 100);
  assert.ok(samples.every((p) => p.y === 40 || p.x === 100 || p.y === 100));
  runPipe(maze, p, 0, 10, () => {}, true);
  assert.equal(p.x, 70);
});
test("catching a pipe projects onto the edge without teleporting to a junction", () => {
  const p = catchTrail(maze, { x: 70, y: 46 }, 2);
  assert.equal(p.x, 70);
  assert.equal(p.y, 40);
  assert.equal(p.direction, 2);
  runPipe(maze, p, 2, 10, () => {});
  assert.equal(p.x, 60);
  assert.equal(catchTrail(maze, { x: 60, y: 70 }, 0), null);
});
test("tongue reaches two pellets ahead, not behind or sideways", () => {
  const p = { ...actorAt(maze, 0), direction: 0 };
  assert.equal(tongueTarget(p, { x: 74, y: 40 }), true);
  assert.equal(tongueTarget(p, { x: 75, y: 40 }), false);
  assert.equal(tongueTarget(p, { x: 19, y: 40 }), false);
  assert.equal(tongueTarget(p, { x: 40, y: 65 }), false);
  p.direction = 3;
  assert.equal(tongueTarget(p, { x: 20, y: 0 }), true);
});
