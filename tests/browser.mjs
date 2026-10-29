// The built package in a real browser: trails in the page, eating, the page's own clicks and
// fields, M (a new maze, same run), scrolling, pause, game over, the phone joystick, and Recall giving
// the page back byte for byte.
// Run after `npm run build`: node tests/browser.mjs (CHROMIUM_PATH picks a browser binary).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
if (!existsSync("dist/index.js")) throw new Error("Build first: npm run build");
const types = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(root, path === "/" ? "tests/fixtures/page.html" : path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const snapshot = (page) => page.evaluate(() => document.documentElement.outerHTML);
const state = (page) => page.evaluate(() => window.game.getSnapshot());
const art = (page, sel) => page.evaluate((s) => document.querySelector("[data-fizlet-host=byte-runner-art]")?.shadowRoot?.querySelectorAll(s).length ?? -1, sel);
/** Hold keys in turn (a little square), `ms` each. */
async function run(page, keys, ms) {
  for (const k of keys) {
    await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    await page.keyboard.up(k);
  }
}
let where = "start";
try {
  where = "play and recall";
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  const before = await snapshot(page);
  await page.evaluate(() => window.launch());
  assert.equal((await state(page)).status, "running");
  assert.equal(await page.locator("[data-fizlet-host=byte-runner]").count(), 1, "the scoreboard is on the page");
  // The trails and food are drawn inside the page's own root (they scroll with it).
  assert.equal(await page.locator("#board > [data-fizlet-host=byte-runner-art]").count(), 1, "the art lives in the root");
  await page.waitForFunction(() => window.game.getSnapshot().pelletsTotal > 20);
  assert.ok((await art(page, "[data-byte-pellet],[data-byte-power]")) > 20, "food on the trails");
  assert.ok((await art(page, "[data-byte-fly][visibility=visible]")) >= 1, "flies are out");
  await run(page, ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"], 450);
  let s = await state(page);
  assert.ok(s.score > 0 && s.pellets > 0, `ate (${s.score}, ${s.pellets} pellets)`);
  assert.equal(s.pelletsRemaining + s.pellets, s.pelletsTotal);
  assert.notEqual(await snapshot(page), before, "the page is in play");
  // A click on a link does not follow it while playing.
  await page.click("#link");
  assert.ok(!page.url().endsWith("#away"), "links don't navigate while playing");
  // Typing in the page's own field stays the page's.
  await page.click("#field");
  await page.keyboard.type("hi there");
  assert.equal(await page.inputValue("#field"), "hi there");
  await page.locator("#field").blur();
  // M: a new maze, the same run (score kept).
  const score = (await state(page)).score;
  await page.keyboard.press("KeyM");
  await page.waitForFunction(() => window.events.includes("maze-reflow"));
  s = await state(page);
  assert.ok(s.score >= score && s.wave === 1, "M keeps the run");
  // Scrolling reflows the trails (the run carries over).
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(700);
  s = await state(page);
  assert.equal(s.status, "running");
  assert.ok(s.pelletsTotal > 0, "trails in the scrolled view");
  // Pause and resume (P), then Recall (Escape) gives every letter and button back.
  await page.keyboard.press("KeyP");
  assert.equal((await state(page)).status, "paused");
  const t = (await state(page)).elapsed;
  await page.waitForTimeout(300);
  assert.equal((await state(page)).elapsed, t, "paused time stands still");
  await page.keyboard.press("KeyP");
  assert.equal((await state(page)).status, "running");
  await page.keyboard.press("Escape");
  assert.equal((await state(page)).status, "idle");
  await page.fill("#field", "");
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(100);
  assert.equal(await snapshot(page), before, "Recall restores the page exactly");
  assert.deepEqual(errors, []);

  where = "frame time";
  await page.evaluate(() => window.launch());
  await run(page, ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"], 500);
  s = await state(page);
  assert.ok(s.frameMs < 4, `average frame work ${s.frameMs.toFixed(2)} ms`);
  assert.ok(s.board.indexed > 0 && s.board.measurements <= 900, JSON.stringify(s.board));
  await page.evaluate(() => window.game.destroy());
  assert.equal(await page.locator("[data-fizlet-host]").count(), 0);
  await page.close();

  where = "game over";
  // The frog never moves: the flies find it, three times.
  const over = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await over.goto(url);
  const bare = await snapshot(over);
  await over.evaluate(() => window.launch());
  await over.waitForFunction(() => window.game.getSnapshot().status === "gameover", null, { timeout: 120000 });
  s = await state(over);
  assert.equal(s.lives, 0);
  assert.match(await over.locator("[data-fizlet-host=byte-runner]").evaluate((h) => h.shadowRoot.textContent), /GAME OVER/);
  assert.equal(await over.locator("[data-fizlet-host=byte-runner-art]").count(), 0, "the art is gone with the run");
  await over.keyboard.press("Escape");
  assert.equal((await state(over)).status, "idle");
  assert.equal(await snapshot(over), bare, "the page is back after the run ends");
  await over.close();

  where = "phone";
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.goto(url);
  await pp.evaluate(() => window.launch());
  await pp.waitForFunction(() => window.game.getSnapshot().pelletsTotal > 0);
  const pad = await pp.evaluate(() => {
    const r = document.querySelector("[data-fizlet-host=byte-runner]").shadowRoot.querySelector(".bui-stick").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  });
  const cdp = await phone.newCDPSession(pp);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  // Push the joystick toward each side in turn: the frog runs.
  const p0 = (await state(pp)).player;
  let moved = 0;
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    await touch("touchStart", pad.x, pad.y);
    await touch("touchMove", pad.x + dx * pad.w * 0.4, pad.y + dy * pad.w * 0.4);
    await pp.waitForTimeout(400);
    await touch("touchEnd");
    const p = (await state(pp)).player;
    moved = Math.max(moved, Math.hypot(p.x - p0.x, p.y - p0.y));
  }
  assert.ok(moved > 30, `the joystick runs the frog (${moved.toFixed(0)} px)`);
  await phone.close();
  console.log("Byte Runner browser: trails in the page, eating, links and fields, M, scroll, pause, Recall restores exactly, frame time, game over, phone joystick passed.");
} catch (err) {
  console.error(`browser test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
  server.close();
}
