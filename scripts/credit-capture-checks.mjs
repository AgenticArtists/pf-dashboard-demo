import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  },
});

const raw = JSON.parse(readFileSync(new URL("../data/credit_tracker.json", import.meta.url), "utf8"));
const { buildCreditCapture } = await import("../lib/credit-capture.js");
const capture = buildCreditCapture();

// The view model mirrors the pipeline JSON exactly - the page renders
// these figures, it never recomputes them.
assert.equal(capture.asOf, raw.as_of, "as-of comes from credit_tracker.json");
assert.equal(capture.credits.length, raw.credits.length, "every tracked credit is rendered");
for (const c of capture.credits) {
  const src = raw.credits.find((x) => x.id === c.id);
  assert.ok(src, `${c.id} exists in the pipeline JSON`);
  assert.equal(c.captured_ytd, src.captured_ytd, `${c.id} captured matches the JSON`);
  assert.equal(c.available_ytd, src.available_ytd, `${c.id} available matches the JSON`);
  assert.equal(c.missed, src.missed, `${c.id} missed matches the JSON`);
  assert.equal(c.remaining_current, src.remaining_current, `${c.id} remaining matches the JSON`);
  if (c.trackable) {
    assert.ok(c.captured_ytd <= c.available_ytd, `${c.id} captured never exceeds offered`);
    assert.ok(Math.abs(c.pct - (c.captured_ytd / c.available_ytd) * 100) < 0.11, `${c.id} bar pct matches its figures`);
  }
}
assert.equal(capture.totals.captured_ytd, raw.totals.captured_ytd, "totals captured matches the JSON");
assert.equal(capture.totals.available_ytd, raw.totals.available_ytd, "totals available matches the JSON");
assert.equal(capture.totals.missed, raw.totals.missed, "totals missed matches the JSON");
assert.equal(capture.expiringSoon.length, raw.expiring_soon.length, "expiring-soon list matches the JSON");

// Demo headline pins: the demo tracks a single credit, the Streamleaf
// monthly credit on the Bluebonnet Rewards Card ····5183 — $5/month,
// $45 of the $50 offered through October captured, nothing missed.
assert.equal(raw.as_of, "2026-10-22", "tracker as-of is the demo snapshot date");
assert.equal(raw.year, 2026, "tracker year");
assert.equal(capture.credits.length, 1, "demo tracks exactly one credit");
const byId = Object.fromEntries(capture.credits.map((c) => [c.id, c]));
const streamleaf = byId["streamleaf-credit"];
assert.ok(streamleaf, "the Streamleaf credit is the tracked credit");
assert.equal(streamleaf.name, "Streamleaf monthly credit", "credit name");
assert.equal(streamleaf.card, "Bluebonnet Rewards Card", "credit sits on the Bluebonnet Rewards Card");
assert.equal(streamleaf.amount_per_period, 5, "credit is $5 per period");
assert.equal(streamleaf.period_type, "monthly", "credit period is monthly");
assert.equal(streamleaf.periodNoun, "month", "period noun renders as month");
assert.equal(streamleaf.annual_total, 60, "credit annual total is $60");
assert.equal(streamleaf.trackable, true, "credit is ledger-trackable");
assert.equal(streamleaf.captured_ytd, 45, "Streamleaf: $45 captured YTD");
assert.equal(streamleaf.available_ytd, 50, "Streamleaf: $50 offered YTD");
assert.equal(streamleaf.missed, 0, "Streamleaf: nothing missed");
assert.equal(streamleaf.remaining_current, 5, "Streamleaf: $5 remaining in the current period");
assert.equal(streamleaf.pct, 90, "Streamleaf: capture bar is 90%");
assert.equal(streamleaf.captured_ytd + streamleaf.remaining_current, streamleaf.available_ytd, "captured + remaining = offered");
assert.equal(streamleaf.available_ytd, streamleaf.amount_per_period * 10, "offered YTD is $5 x the 10 months through October");
assert.equal(streamleaf.annual_total, streamleaf.amount_per_period * 12, "annual total is $5 x 12 months");
assert.deepEqual(streamleaf.missedPeriods, [], "no ended period leaked");
assert.equal(streamleaf.expiring, null, "credit is not in the expiring-soon list");
assert.equal(capture.totals.captured_ytd, 45, "totals captured is the single credit's $45");
assert.equal(capture.totals.available_ytd, 50, "totals available is the single credit's $50");
assert.equal(capture.totals.missed, 0, "totals missed is $0");
assert.deepEqual(capture.expiringSoon, [], "nothing expiring soon in the demo tracker");

// The section is wired into the Cards page and driven by the JSON.
const page = readFileSync(new URL("../app/(main)/cards/page.js", import.meta.url), "utf8");
assert.ok(page.includes("buildCreditCapture"), "Cards page builds the credit-capture view model");
assert.ok(page.includes("Credit capture"), "Cards page renders the Credit capture section");
assert.ok(page.includes("credit.missedPeriods"), "Cards page shows expired-period leaks per credit");

console.log("credit capture checks: all passed");
