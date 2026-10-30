// The announcer (src/announce.ts, the fizlet/announce contract): one polite region per document,
// coalescing per key, at most one write per gap, identical text spoken again, timers cleared.
// A minimal fake document stands in for the DOM; mock timers drive setTimeout and Date.
import test from "node:test";
import assert from "node:assert/strict";
import { announcer } from "../src/announce.ts";

function fakeDoc() {
  const body = { children: [], append(el) { el.isConnected = true; el.parent = body; body.children.push(el); } };
  const make = (tag) => {
    const attrs = new Map();
    const el = {
      tagName: tag.toUpperCase(), style: { cssText: "" }, textContent: "", isConnected: false, writes: [],
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      remove() { body.children.splice(body.children.indexOf(el), 1); el.isConnected = false; },
    };
    let text = "";
    Object.defineProperty(el, "textContent", { get: () => text, set: (v) => { text = v; el.writes.push(v); } });
    return el;
  };
  return {
    body,
    createElement: make,
    querySelector: (sel) => (sel === "[data-fz-announce]" ? body.children.find((c) => c.hasAttribute("data-fz-announce")) ?? null : null),
  };
}

test("one polite, atomic, visually hidden region, created lazily and removed by its creator", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10_000 });
  const doc = fakeDoc(), a = announcer({ doc }), b = announcer({ doc });
  assert.equal(doc.body.children.length, 0, "nothing until the first write");
  a.say("score", "Score 10");
  t.mock.timers.tick(0);
  b.say("lives", "Lives 2");
  t.mock.timers.tick(0);
  assert.equal(doc.body.children.length, 1, "one shared region per document");
  const r = doc.body.children[0];
  assert.equal(r.getAttribute("role"), "status");
  assert.equal(r.getAttribute("aria-live"), "polite");
  assert.equal(r.getAttribute("aria-atomic"), "true");
  assert.match(r.style.cssText, /clip-path:inset\(50%\)/);
  assert.doesNotMatch(r.style.cssText, /display:\s*none|visibility:\s*hidden/);
  assert.deepEqual(r.writes, ["Score 10", "Lives 2"]);
  b.destroy();
  assert.equal(doc.body.children.length, 1, "only the creator removes it");
  a.destroy();
  assert.equal(doc.body.children.length, 0);
});

test("coalescing: the newest text per key, keys joined in first-queued order", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10_000 });
  const doc = fakeDoc(), a = announcer({ doc });
  a.say("score", "Score 10");
  a.say("lives", "Lives 2");
  a.say("score", "Score 20");
  a.say("score", "Score 30");
  t.mock.timers.tick(0);
  assert.deepEqual(doc.body.children[0].writes, ["Score 30. Lives 2"]);
  a.destroy();
});

test("rate limit: at most one write per gap; flush writes now; identical text is spoken again", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10_000 });
  const doc = fakeDoc(), a = announcer({ doc, gap: 1 });
  a.say("score", "Score 10");
  t.mock.timers.tick(0);
  const r = doc.body.children[0];
  for (let i = 1; i <= 9; i++) (a.say("score", `Score ${10 + i * 10}`), t.mock.timers.tick(100));
  assert.deepEqual(r.writes, ["Score 10"], "nothing more inside the gap");
  t.mock.timers.tick(100);
  assert.deepEqual(r.writes, ["Score 10", "Score 100"], "one write when the gap is up, the latest score");
  a.say("status", "Paused");
  a.flush();
  assert.equal(r.writes.at(-1), "Paused", "flush does not wait");
  t.mock.timers.tick(1000);
  a.say("status", "Paused");
  t.mock.timers.tick(0);
  assert.equal(r.writes.at(-1), "Paused ", "the same words again still change the region");
  a.say("score", "Score 5");
  a.destroy();
  t.mock.timers.tick(5000);
  assert.equal(r.writes.at(-1), "Paused ", "destroy clears the pending timer");
  a.say("score", "Score 6");
  t.mock.timers.tick(5000);
  assert.equal(doc.body.children.length, 0, "a destroyed announcer stays silent");
});
