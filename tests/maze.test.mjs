import test from "node:test";
import assert from "node:assert/strict";
import {
  makeMaze,
  distances,
  blocked,
  guideToTrail,
  TRAIL_CLEARANCE,
} from "../src/maze.ts";
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test("desktop, mobile and ultrawide mazes keep every pellet reachable and clear of native walls", () => {
  for (const [width, height] of [
    [375, 650],
    [1280, 850],
    [2500, 1400],
    [650, 375],
  ])
    for (let seed = 1; seed <= 12; seed++) {
      const walls = [
        {
          left: width * 0.3,
          right: width * 0.6,
          top: height * 0.3,
          bottom: height * 0.5,
        },
        { left: width - 230, right: width, top: 0, bottom: 120 },
      ];
      const m = makeMaze(width, height, walls, rng(seed));
      assert.ok(m.cells.length >= 4);
      assert.ok(m.cells.length <= 952);
      assert.ok(m.pellets.length <= 420);
      assert.ok([...distances(m, m.start)].every((d) => d >= 0));
      assert.ok(m.pellets.filter((p) => p.power).length >= 6);
      assert.ok(m.pellets.filter((p) => p.power).length <= 8);
      for (const p of m.pellets) {
        assert.equal(blocked(p, p, walls, m.clearance), false);
        assert.ok(p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height);
      }
      for (const a of m.cells)
        for (const id of a.exits) {
          const b = m.cells[id];
          assert.equal(blocked(a, b, walls, m.clearance), false);
          assert.ok(b.exits.includes(a.id));
        }
    }
});
test("solid dividers never leave food on an unreachable island", () => {
  const m = makeMaze(
    600,
    600,
    [{ left: 270, right: 320, top: 0, bottom: 600 }],
    rng(9),
  );
  assert.ok([...distances(m, m.start)].every((d) => d >= 0));
  assert.ok(
    m.pellets.every((p) => p.x < 270) || m.pellets.every((p) => p.x > 320),
  );
});
test("an occluded viewport has no fake corridors through page elements", () => {
  const m = makeMaze(
    300,
    300,
    [{ left: 0, right: 300, top: 0, bottom: 300 }],
    rng(1),
  );
  assert.equal(m.cells.length, 0);
  assert.equal(m.pellets.length, 0);
});

test("text, pellets and the full soft corridor width never overlap", () => {
  const text = [];
  for (let i = 0; i < 14; i++)
    text.push({
      left: 100,
      right: 580,
      top: 90 + i * 30,
      bottom: 108 + i * 30,
    });
  const m = makeMaze(900, 650, [], rng(8), text);
  assert.ok(m.pellets.length <= 420, `bounded food: ${m.pellets.length}`);
  assert.ok([...distances(m, m.start)].every((d) => d >= 0));
  for (const a of m.cells)
    for (const id of a.exits)
      assert.equal(
        blocked(a, m.cells[id], text, TRAIL_CLEARANCE),
        false,
        "entire corridor clears text",
      );
  for (const p of m.pellets)
    assert.ok(
      !text.some(
        (r) =>
          p.x > r.left - 3 &&
          p.x < r.right + 3 &&
          p.y > r.top - 3 &&
          p.y < r.bottom + 3,
      ),
      "pellets stay outside text",
    );
  assert.ok(m.cells.length > 2);
});

test("short viewports remain one clearable food run", () => {
  const maze = makeMaze(900, 68, [], rng(4));
  assert.equal(new Set(maze.pellets.map((p) => p.y)).size, 1);
  assert.ok(maze.pellets.length > 10);
});

test("magnet assists parallel travel but never traps perpendicular or distant movement", () => {
  const maze = {
    cells: [
      { id: 0, x: 20, y: 40, exits: [1] },
      { id: 1, x: 200, y: 40, exits: [0, 2] },
      { id: 2, x: 200, y: 180, exits: [1] },
    ],
  };
  assert.deepEqual(guideToTrail(maze, { x: 80, y: 48 }, 0, 4), {
    x: 80,
    y: 46.88,
  });
  assert.deepEqual(guideToTrail(maze, { x: 80, y: 48 }, 1, 4), {
    x: 80,
    y: 48,
  });
  assert.deepEqual(guideToTrail(maze, { x: 80, y: 60 }, 0, 4), {
    x: 80,
    y: 60,
  });
  assert.deepEqual(guideToTrail(maze, { x: 80, y: 48 }, 0, 0), {
    x: 80,
    y: 48,
  });
  assert.deepEqual(guideToTrail(maze, { x: 192, y: 100 }, 3, 4), {
    x: 193.12,
    y: 100,
  });
});

test("narrow mobile gutters retain a useful route for every starting branch", () => {
  const text = Array.from({ length: 8 }, (_, i) => ({
    left: 29,
    right: 350,
    top: 170 + i * 27,
    bottom: 190 + i * 27,
  }));
  const walls = [
    { left: 10, right: 380, top: 60, bottom: 120 },
    { left: 160, right: 380, top: 10, bottom: 179 },
    { left: 29, right: 361, top: 683, bottom: 948 },
    { left: 27, right: 205, top: 427, bottom: 469 },
    { left: 29, right: 203, top: 487, bottom: 529 },
  ];
  for (let seed = 1; seed <= 20; seed++) {
    const m = makeMaze(390, 900, walls, rng(seed), text);
    assert.ok(m.pellets.length > 20);
    for (const a of m.cells)
      for (const id of a.exits)
        assert.equal(
          blocked(a, m.cells[id], [...walls, ...text], m.clearance),
          false,
        );
  }
});

// Recorded 0.8.0 route lengths for this unchanged obstacle fixture: 1400/2874/5584 px.
// Require broader navigable coverage, not merely more closely packed food.
test("expanded maze more than doubles whitespace route coverage", () => {
  for (const [width,height,previous] of [[390,844,1400],[1200,900,2874],[2500,1400,5584]]) {
    const m=makeMaze(width,height,[{left:width*.3,right:width*.6,top:height*.3,bottom:height*.5}],()=>.4);
    const length=m.cells.reduce((sum,a)=>sum+a.exits.filter(id=>id>a.id).reduce((n,id)=>n+Math.hypot(a.x-m.cells[id].x,a.y-m.cells[id].y),0),0);
    assert.ok(length>=previous*2, `${width}: ${length}`);
    assert.ok(m.pellets.length<=420);
  }
});
