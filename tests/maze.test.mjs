import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaze, distances, blocked, actorAt, advance, direction, reverse } from '../src/maze.ts';
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
test('desktop, mobile and ultrawide mazes keep every pellet reachable and clear of native walls', () => {
  for (const [width, height] of [[375,650],[1280,850],[2500,1400],[650,375]]) for (let seed=1;seed<=12;seed++) {
    const walls=[{left:width*.3,right:width*.6,top:height*.3,bottom:height*.5},{left:width-230,right:width,top:0,bottom:120}];
    const m=makeMaze(width,height,walls,rng(seed));
    assert.ok(m.cells.length>10); assert.ok(m.cells.length<=300); assert.ok(m.pellets.length<2000);
    assert.ok([...distances(m,m.start)].every(d=>d>=0));
    assert.equal(m.pellets.filter(p=>p.power).length,4);
    for(const p of m.pellets) {assert.equal(blocked(p,p,walls),false);assert.ok(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height);}
    for(const a of m.cells)for(const id of a.exits){const b=m.cells[id];assert.equal(blocked(a,b,walls),false);assert.ok(b.exits.includes(a.id));}
  }
});
test('solid dividers never leave food on an unreachable island',()=>{
  const m=makeMaze(600,600,[{left:270,right:320,top:0,bottom:600}],rng(9));
  assert.ok([...distances(m,m.start)].every(d=>d>=0));
  assert.ok(m.pellets.every(p=>p.x<270)||m.pellets.every(p=>p.x>320));
});
test('movement stays on corridors, stops at walls, samples food, and reverses without teleporting',()=>{
  const m=makeMaze(500,500,[],rng(5)),p=actorAt(m,m.start),start=m.cells[m.start],next=start.exits[0];
  const samples=[];advance(m,p,10,()=>next,point=>samples.push({...point}));
  assert.equal(p.direction,direction(start,m.cells[next]));assert.ok(samples.length>=2);
  const before={x:p.x,y:p.y};reverse(m,p);assert.deepEqual({x:p.x,y:p.y},before);
  advance(m,p,100,()=>undefined);
  assert.equal(p.from,p.to);assert.ok(Math.hypot(p.x-start.x,p.y-start.y)<.01);
  const still={...p};advance(m,p,500,()=>-1);assert.deepEqual(p,still);
});
test('an occluded viewport has no fake corridors through page elements',()=>{
  const m=makeMaze(300,300,[{left:0,right:300,top:0,bottom:300}],rng(1));
  assert.equal(m.cells.length,0);assert.equal(m.pellets.length,0);
});
