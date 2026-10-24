import test from "node:test";
import assert from "node:assert/strict";
import { eatPellet, refillPellet } from "../src/food.ts";
const food = (power = false) => ({
  id: 0,
  cell: 0,
  x: 20,
  y: 30,
  power,
  eaten: false,
  cleared: false,
  respawnAt: 0,
});
test("regular food returns after twelve simulation seconds without resetting level progress", () => {
  const p = food();
  assert.equal(eatPellet(p, 4), true);
  assert.equal(p.respawnAt, 16);
  assert.equal(refillPellet(p, 15.9), false);
  assert.equal(p.eaten, true);
  // Repeated paused frames do not advance a timer or refill the food.
  for (let i = 0; i < 100; i++) assert.equal(refillPellet(p, 4), false);
  assert.equal(refillPellet(p, 16), true);
  assert.equal(p.cleared, true);
  assert.equal(p.eaten, false);
  assert.equal(eatPellet(p, 17), false);
  assert.equal(p.respawnAt, 29);
});
test("power food has a longer return time and never becomes a new level requirement", () => {
  const p = food(true);
  assert.equal(eatPellet(p, 0), true);
  assert.equal(refillPellet(p, 19.9), false);
  assert.equal(refillPellet(p, 20), true);
  assert.equal(eatPellet(p, 21), false);
  assert.equal(p.cleared, true);
});
