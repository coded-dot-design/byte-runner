import test from 'node:test';
import assert from 'node:assert/strict';
import { extendPower, MAX_GHOSTS } from '../src/rules.ts';
test('power lasts six seconds and stacking cannot create infinite immunity',()=>{
  assert.equal(extendPower(0),6);assert.equal(extendPower(5),9);assert.equal(extendPower(999),9);assert.equal(extendPower(-5),6);
});
test('later mazes retain a bounded ghost roster',()=>assert.equal(MAX_GHOSTS,8));
