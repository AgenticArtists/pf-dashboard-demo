import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { SYSTEM_PROMPT, ADVISOR_SYSTEM_PROMPT, TRIAGE_PROMPT, buildAdvisorContext, buildAskContext } = await import("../lib/ask-core.js");

// Demo disposition: there are no live compensation prompts to pin —
// every prompt export in the demo ask-core is the same disabled
// notice, and both context builders are the same inert function.
assert.equal(SYSTEM_PROMPT, "Ask is disabled in this public synthetic-data demo.", "simple prompt is the disabled notice");
assert.equal(ADVISOR_SYSTEM_PROMPT, SYSTEM_PROMPT, "advisor prompt is the same disabled notice");
assert.equal(TRIAGE_PROMPT, SYSTEM_PROMPT, "triage prompt is the same disabled notice");

// What the demo context does contain, fed the real demo data files:
// the whole demo picture across its five sections — household meta,
// accounts (including both demo cards), budgets, 2026 income and the
// portfolio — for the simple and advisor builders alike.
const readData = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const dataFn = (name) => readData(name);
for (const [label, ctx] of [["simple context", buildAskContext(dataFn)], ["advisor pack", buildAdvisorContext(dataFn)]]) {
  assert.ok(ctx.includes("Daniel and Maya Carter"), `${label} carries the demo household name`);
  assert.ok(ctx.includes("386271.38"), `${label} carries the demo net worth`);
  assert.ok(ctx.includes("Bluebonnet Rewards Card") && ctx.includes("5183"), `${label} carries the demo joint card`);
  assert.ok(ctx.includes("Cedar Cash Card") && ctx.includes("7264"), `${label} carries the demo personal card`);
  assert.ok(ctx.includes("Home Expenses"), `${label} carries the demo budget lines`);
  assert.ok(ctx.includes("Northstar Systems"), `${label} carries the demo employer from the income file`);
  assert.ok(ctx.includes("150000"), `${label} carries the demo 2026 income total`);
  assert.ok(ctx.includes("159200"), `${label} carries the demo portfolio total`);
  const order = ["meta.json", "accounts.json", "budgets.json", "income_2026.json", "portfolio.json"].map((n) => ctx.indexOf(n));
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), `${label} keeps the five sections in file order`);
  assert.ok(!ctx.includes("Cedar Grove Apartments"), `${label} includes no records data — records.json is never read`);
}
assert.equal(buildAdvisorContext(dataFn), buildAskContext(dataFn), "advisor and simple contexts are identical in the demo");

console.log("comp checks: all passed");
