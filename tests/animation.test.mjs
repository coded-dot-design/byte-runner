import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerAnimation,moveAnimation,runnerFrame,wingFrame} from '../src/animation.js';
import {frogArt,FROG_BODIES,FROG_EYES} from '../src/art.js';
test('feet advance only with locomotion while food chomp is independent',()=>{
 const state=createRunnerAnimation();const seen=new Set();state.chompUntil=1;
 for(let i=0;i<8;i++){moveAnimation(state,3,0,1/24);const f=runnerFrame(state,i/24,false);seen.add(f.step);assert.ok(f.bob>=-1&&f.bob<=0);assert.ok(f.mouth>=0&&f.mouth<=2);}
 assert.equal(seen.size,4);const time=state.runTime;moveAnimation(state,0,0,1);assert.equal(state.runTime,time);assert.equal(runnerFrame(state,.2,false).step,0);assert.ok(runnerFrame(state,.2,false).mouth>0);assert.equal(runnerFrame(state,2,false).mouth,0);
});
test('reduced motion keeps idle feet and stable wings, with readable chomp',()=>{
 const state={moving:true,runTime:3,chompUntil:10};assert.deepEqual(runnerFrame(state,2,true),{step:0,mouth:1,bob:0});assert.equal(wingFrame(2,.3,true),wingFrame(3,.8,true));assert.notEqual(wingFrame(2,0,false),wingFrame(2,.6,false));
});
test('all directions and startup clock edges have finite, defined geometry',()=>{
 const state=createRunnerAnimation();for(const t of [-.04,0,.12,4]){const f=runnerFrame(state,t,false);for(let facing=0;facing<4;facing++)assert.ok(FROG_BODIES[facing][f.mouth].body);}
 assert.ok(FROG_EYES.front.cream);assert.equal(frogArt().viewBox,'-2 -2 28 28');
});
