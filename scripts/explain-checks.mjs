import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEVELS, EXPLAIN_SYSTEM, extractFigures, figuresFaithful } from "../lib/explain.js";

// Levels: three generated depths + the original. (lib/explain.js still
// ships unchanged in the demo; only the route behind it is disabled.)
assert.deepEqual(Object.keys(LEVELS).map(Number).sort(), [1, 2, 3, 4]);
assert.equal(LEVELS[1].label, "Why it matters");
assert.equal(LEVELS[2].label, "Like I'm 12");
assert.equal(LEVELS[3].label, "Plain English");
assert.equal(LEVELS[4].label, "Original");
assert.match(LEVELS[1].instruction, /exactly ONE sentence/);
assert.match(LEVELS[2].instruction, /12-year-old/);
assert.match(LEVELS[2].instruction, /no baby talk/);
assert.match(LEVELS[3].instruction, /PLAIN ENGLISH/);
assert.equal(LEVELS[4].instruction, null);
assert.match(EXPLAIN_SYSTEM, /Never add a fact, a figure/);

// Figure guardrail: exact figures pass, invented figures fail, the
// bp -> percentage-points restatement is licensed one way only.
const source = "The Fed held at 5.25% after a 550bp hiking cycle; the 10-year sits near 4.6%.";
assert.equal(figuresFaithful(source, "Rates are 5.25% and the 10-year is 4.6%."), true);
assert.equal(figuresFaithful(source, "Rates rose 5.5 percentage points in the cycle."), true);
assert.equal(figuresFaithful(source, "Rates are 5.25% and unemployment is 3.9%."), false);
assert.equal(figuresFaithful(source, "Rates are about five percent."), true, "no digits = nothing to check");
assert.equal(figuresFaithful(source, "The cycle was 550bp."), true);
assert.equal(figuresFaithful("Growth was 5.5% last year.", "Growth was 550bp last year."), false, "percent does not license inventing a bp figure");
assert.equal(extractFigures("paid $1,234.56 at 2x").length, 2);

// Route wiring in the demo: /api/explain is a disabled stub — it runs
// no model, checks no session and rewrites nothing.
const route = readFileSync(new URL("../app/api/explain/route.js", import.meta.url), "utf8");
assert.ok(route.includes("export const POST"), "explain route exposes POST");
assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), "explain route returns the disabled 405 stub");
for (const fragment of ["publishedBullets", "sessionUser", "data_collection", "deepseek", "figuresFaithful", "EXPLAIN_SYSTEM", "takeDailySlot"]) {
  assert.ok(!route.includes(fragment), `disabled explain route has no ${fragment}`);
}

// Client slider still ships: four stops with the creative level names,
// calling the (now disabled) endpoint only when a level is chosen.
const client = readFileSync(new URL("../app/(main)/investments/regime-bullets.js", import.meta.url), "utf8");
assert.match(client, /type="range"/);
assert.ok(client.includes('fetch("/api/explain"'), "slider still calls the explain endpoint");
for (const label of ["Why it matters", "Like I'm 12", "Plain English", "Original"]) {
  assert.ok(client.includes(label), `slider shows ${label}`);
}

console.log("explain checks: all passed");
