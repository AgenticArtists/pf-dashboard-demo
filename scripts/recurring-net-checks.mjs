import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Recurring run rates NET of paired statement credits (demo-household
// instruction, 2026-10-19). Drives the real lib/recurring.js detection
// used by the Recurring page, on fixtures and on the generated data.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  },
});

const { detectRecurring, r2 } = await import("../lib/recurring.js");

const txn = (d, a, n, v, extra = {}) => ({
  d, a, n, v, c: "Subscriptions", sc: "Other", g: "Subscriptions", p: "Joint", ...extra,
});
const monthly = (day) => [0, 1, 2, 3, 4, 5].map((i) => `2026-0${i + 1}-${day}`);

// --- Paired program: charges split across two raw names, credits
// paired via the pr label — the group nets to zero.
{
  const rows = [];
  monthly("19").forEach((d, i) => {
    const charge = i < 2 ? txn(d, 9.99, "Streamleaf", "Streamleaf", { pr: "streamleaf" })
                         : txn(d, 9.99, "Payment to Streamleaf", "Streamleaf", { pr: "streamleaf" });
    const credit = i < 3 ? txn(d, -9.99, "Streamleaf Program Credit", "Streamleaf", { pr: "streamleaf" })
                         : txn(d, -9.99, "Payment to Streamleaf", "Streamleaf", { pr: "streamleaf" });
    rows.push(charge, credit);
  });
  const found = detectRecurring(rows, "2026-06-20").find((r) => r.vendor === "streamleaf");
  assert.ok(found, "streamleaf group detected");
  assert.equal(found.creditTypical, 9.99);
  assert.ok(found.grossMonthly > 0, "gross run rate still computed");
  assert.equal(found.monthly, 0, "streamleaf net monthly is $0");
  assert.equal(found.annual, 0, "streamleaf net annual is $0");
  assert.equal(found.ytdNet, 0, "streamleaf 2026 net is $0");
  console.log("PASS fixture: paired program nets to $0/mo");
}

// --- Program legs hide inside a general merchant blob; the pr label
// separates them, and unmarked shopping at the same merchant must not
// join the program group.
{
  const rows = [];
  monthly("14").forEach((d) => {
    rows.push(txn(d, 12.95, "General Store", "General Store", { pr: "cloudnest" }));
    rows.push(txn(d, -12.95, "Refunds from General Store", "General Store", { pr: "cloudnest" }));
  });
  rows.push(txn("2026-02-03", 64.2, "General Store", "General Store", { c: "Groceries", g: "Groceries" }));
  rows.push(txn("2026-04-19", 41.87, "General Store", "General Store", { c: "Groceries", g: "Groceries" }));
  const found = detectRecurring(rows, "2026-06-20").find((r) => r.vendor === "cloudnest");
  assert.ok(found, "cloudnest group detected");
  assert.equal(found.creditTypical, 12.95);
  assert.equal(found.monthly, 0, "cloudnest net monthly is $0");
  assert.equal(found.annual, 0, "cloudnest net annual is $0");
  console.log("PASS fixture: program legs inside a merchant blob net to $0/mo");
}

// --- Unpaired subscription: a plain merchant refund is NOT netted.
{
  const rows = monthly("15").map((d) => txn(d, 19.99, "Streamleaf", "Streamleaf", { sc: "Streaming" }));
  rows.push(txn("2026-03-16", -19.99, "Streamleaf", "Streamleaf", { sc: "Streaming" }));
  const found = detectRecurring(rows, "2026-06-20").find((r) => r.vendor === "Streamleaf");
  assert.ok(found, "Streamleaf detected");
  assert.equal(found.creditTypical, 0, "unpaired credit is not a program credit");
  assert.equal(found.monthly, found.grossMonthly, "net equals gross when unpaired");
  assert.equal(found.credits, -19.99, "unpaired credit still reported in credits");
  console.log("PASS fixture: unpaired subscription net equals gross");
}

// --- Over-credit pairing: the program credit ($25) exceeds the charge
// ($21.99) — the net goes negative and must not be floored at zero.
{
  const rows = [];
  monthly("15").forEach((d) => {
    rows.push(txn(d, 21.99, "Streamleaf Plus", "Streamleaf Plus", { pr: "streamleaf-plus", sc: "Streaming" }));
    rows.push(txn(d, -25, "Streamleaf Plus Program Credit", "Streamleaf Plus Program Credit", { pr: "streamleaf-plus" }));
  });
  const found = detectRecurring(rows, "2026-06-20").find((r) => r.vendor === "streamleaf-plus");
  assert.ok(found, "streamleaf-plus group detected");
  assert.equal(found.creditTypical, 25);
  assert.ok(found.monthly < 0, "net monthly is negative, not floored");
  assert.equal(found.monthly, r2(((21.99 - 25) * (365.25 / 31)) / 12));
  assert.ok(found.annual < 0, "net annual is negative");
  console.log("PASS fixture: over-credit pairing nets negative honestly");
}

// --- Demo generated data: recurring.json publishes no items (the page
// detects recurring charges live from the ledger), the only pr labels
// are the two subscription programs, and neither carries a credit leg
// in the ledger — so the live detection nets nothing and each
// program's net run rate equals its gross.
{
  const recurring = JSON.parse(readFileSync(new URL("../data/recurring.json", import.meta.url), "utf8"));
  assert.equal(recurring.as_of, "2026-10-22", "recurring file as-of is the demo snapshot date");
  assert.deepEqual(recurring.items, [], "demo recurring.json publishes no items; detection is live from the ledger");

  const tx26 = JSON.parse(readFileSync(new URL("../data/transactions_2026.json", import.meta.url), "utf8"));
  const tx25 = JSON.parse(readFileSync(new URL("../data/transactions_2025.json", import.meta.url), "utf8"));
  const all = [...tx26, ...tx25];
  const labels = [...new Set(all.map((t) => t.pr).filter(Boolean))].sort();
  assert.deepEqual(labels, ["cloudnest", "streamleaf"], "the only program labels in the demo ledger are cloudnest and streamleaf");
  for (const label of labels) {
    assert.ok(all.some((t) => t.pr === label && t.a > 0), `${label} charge legs are marked`);
    assert.equal(all.some((t) => t.pr === label && t.a < 0), false, `${label} has no credit leg in the demo ledger`);
  }

  const dataMax = all.reduce((mx, t) => (t.d > mx ? t.d : mx), "");
  assert.equal(dataMax, "2026-10-22", "ledger runs through the demo snapshot date");
  const rows = detectRecurring(all, dataMax);
  assert.equal(rows.length, 7, "live detection finds the seven demo recurring vendors");
  for (const r of rows) {
    assert.equal(r.creditTypical, 0, `${r.vendor}: no paired credit in the demo ledger`);
    assert.equal(r.monthly, r.grossMonthly, `${r.vendor}: net monthly equals gross when nothing is paired`);
    assert.equal(r.ytdNet, r.ytd, `${r.vendor}: net YTD equals gross YTD`);
  }

  const streamleaf = rows.find((r) => r.vendor === "streamleaf");
  assert.ok(streamleaf, "streamleaf renders on the Recurring page");
  assert.equal(streamleaf.typical, 24.99, "streamleaf typical charge is $24.99");
  assert.equal(streamleaf.monthly, 24.54, "streamleaf net monthly is its gross $24.54 (no credit leg)");
  assert.equal(streamleaf.annual, 294.44, "streamleaf annual run rate");
  assert.equal(streamleaf.ytd, 249.9, "streamleaf 2026 charges are 10 x $24.99");
  assert.equal(streamleaf.count, 22, "streamleaf has 22 charges across 2025-2026");

  const cloudnest = rows.find((r) => r.vendor === "cloudnest");
  assert.ok(cloudnest, "cloudnest renders on the Recurring page");
  assert.equal(cloudnest.typical, 18.99, "cloudnest typical charge is $18.99");
  assert.equal(cloudnest.monthly, 18.65, "cloudnest net monthly is its gross $18.65 (no credit leg)");
  assert.equal(cloudnest.annual, 223.75, "cloudnest annual run rate");
  assert.equal(cloudnest.ytd, 189.9, "cloudnest 2026 charges are 10 x $18.99");
  assert.equal(cloudnest.count, 22, "cloudnest has 22 charges across 2025-2026");
  console.log("PASS demo data: streamleaf and cloudnest render at gross = net (no paired credits in the ledger)");
}

console.log("recurring-net checks: all passed");
