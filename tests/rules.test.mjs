import test from "node:test";
import assert from "node:assert/strict";
import {
  earnsOrb,
  extendPower,
  spawnInterval,
  MAX_GHOSTS,
} from "../src/rules.js";
test("six fresh letters unlock each new orb", () => {
  assert.equal(earnsOrb(0), false);
  assert.equal(earnsOrb(5), false);
  assert.equal(earnsOrb(6), true);
  assert.equal(earnsOrb(12), true);
});
test("power time is capped so stacked pickups cannot create infinite immunity", () => {
  assert.equal(extendPower(0), 6);
  assert.equal(extendPower(5), 9);
  assert.equal(extendPower(999), 9);
  assert.ok(spawnInterval(100) >= 0.55);
  assert.equal(MAX_GHOSTS, 40);
});
