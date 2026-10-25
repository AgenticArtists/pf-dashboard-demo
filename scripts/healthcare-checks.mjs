import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Healthcare page: figures pinned to the shipped demo
// data/healthcare.json — three synthetic Cedar Grove Clinic claims in
// 2026 — and internally reconciled against its own claims list and
// totals block.
const read = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));
const h = read("healthcare.json");
const eq2 = (a, b) => Math.abs(a - b) < 0.005;
const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);

assert.equal(h.as_of, "2026-10-22", "healthcare as-of is the demo snapshot date");
assert.equal(h.claims.length, 3, "demo carries exactly three claims");
assert.deepEqual(h.claims.map((c) => c.patient), ["Daniel", "Maya", "Child"], "claim patients in file order");
assert.ok(h.claims.every((c) => c.provider === "Cedar Grove Clinic"), "all demo claims are Cedar Grove Clinic");

// --- Totals by year reconcile with the claims list ---
assert.deepEqual(Object.keys(h.totals_by_year), ["2026"], "totals cover 2026 only");
const t26 = h.totals_by_year["2026"];
assert.equal(t26.claims, h.claims.length, "totals claim count matches the claims list");
assert.equal(t26.billed, 1200, "2026 billed");
assert.equal(t26.allowed, 980, "2026 allowed");
assert.ok(eq2(t26.discounts, t26.billed - t26.allowed), "discounts = billed - allowed");
assert.equal(t26.plan_paid, 740, "2026 plan paid");
assert.ok(eq2(t26.responsibility_eob, sum(h.claims, (c) => c.responsibility)), "responsibility_eob = sum of claim responsibility");
assert.equal(t26.responsibility_eob, 240, "2026 patient responsibility is $240");
assert.ok(eq2(t26.allowed, t26.plan_paid + t26.responsibility_eob), "allowed = plan paid + patient responsibility");
assert.equal(t26.card_paid, 160, "2026 totals card-paid split matches the claim rows");
assert.equal(t26.hsa_paid, 80, "2026 totals HSA-paid split matches the claim rows");
assert.ok(eq2(t26.card_paid + t26.hsa_paid, t26.responsibility_eob), "card + HSA splits sum to the responsibility total");
assert.equal(t26.unmatched_claims, 0, "2026 has no unmatched claims");
assert.equal(t26.unmatched_dollars, 0, "2026 unmatched dollars are $0");

// Claim-row sums by payment status (the claims list's own split).
const cardPaid = h.claims.filter((c) => c.status === "card_paid");
const hsaPaid = h.claims.filter((c) => c.status === "hsa_paid");
assert.equal(cardPaid.length, 2, "two claims are card-paid");
assert.ok(eq2(sum(cardPaid, (c) => c.responsibility), 160), "card-paid claim rows sum to $160");
assert.equal(hsaPaid.length, 1, "one claim is HSA-paid");
assert.ok(eq2(sum(hsaPaid, (c) => c.responsibility), 80), "HSA-paid claim rows sum to $80");

// --- Unreimbursed figure is the full demo patient responsibility ---
assert.equal(h.unreimbursed.total, 240, "unreimbursed total is $240");
assert.ok(eq2(h.unreimbursed.total, t26.responsibility_eob), "unreimbursed == 2026 responsibility_eob");
assert.deepEqual(h.unreimbursed.by_year, { 2026: 240 }, "unreimbursed by year is 2026 only");
assert.ok(eq2(h.total, 860), "healthcare headline total is $860");
assert.equal(h.hsa_direct_spend, 120, "HSA direct spend is $120");

// --- Unmatched buckets reconcile with the claims / charges in the file ---
const unmatchedClaims = h.claims.filter((c) => c.status === "unmatched");
assert.equal(h.unmatched_claims.count, unmatchedClaims.length, "unmatched claim count");
assert.equal(h.unmatched_claims.count, 0, "demo has no unmatched claims");
assert.ok(eq2(h.unmatched_claims.dollars, sum(unmatchedClaims, (c) => c.responsibility)), "unmatched claim dollars");
assert.equal(h.unmatched_charges.count, h.unmatched_charges.rows.length, "unmatched charge count");
assert.equal(h.unmatched_charges.count, 0, "demo has no unmatched charges");
assert.ok(eq2(h.unmatched_charges.dollars, sum(h.unmatched_charges.rows, (r) => r.amount)), "unmatched charge dollars");
assert.deepEqual(h.recent_charges, { count: 0, dollars: 0 }, "no recent charges in the demo file");

// --- Coverage is stated, claims are oldest first, payments follow ---
assert.equal(h.coverage.claim_service_start, "2026-01-01", "coverage window start");
assert.equal(h.coverage.claim_service_end, "2026-10-22", "coverage window end");
assert.equal(h.coverage.eob_documents, 3, "three EOB documents");
assert.equal(h.coverage.eobs_claim_parsed, 3, "three EOBs claim-parsed");
assert.equal(h.coverage.eobs_summary_only, 0, "no summary-only EOBs");
assert.equal(h.coverage.summaries_validated, 3, "three summaries validated");
assert.equal(h.coverage.summaries_total, 3, "three summaries total");
assert.ok(h.coverage.eobs_claim_parsed <= h.coverage.eob_documents, "parsed never exceeds documents");
assert.equal(h.coverage.eobs_claim_parsed + h.coverage.eobs_summary_only, h.coverage.eob_documents, "parsed + summary-only = documents");
assert.equal(t26.eobs_validated, h.coverage.summaries_validated, "totals validated count matches coverage");
const dates = h.claims.map((c) => c.date);
assert.deepEqual(dates, ["2026-03-14", "2026-06-08", "2026-09-02"], "demo claim dates in file order");
assert.deepEqual(dates, [...dates].sort(), "claims are oldest first in the demo file");
for (const c of h.claims) {
  assert.ok(c.status_label, "every claim carries a status label");
  assert.equal(c.status_label, "Matched", "every demo claim is matched");
  const paid = new Date(`${c.payment_date}T12:00:00`);
  const served = new Date(`${c.date}T12:00:00`);
  assert.equal((paid - served) / 86400000, 1, `${c.date}: payment lands the day after service`);
}

// --- Wiring: the page renders from healthcare.json and nav links to it ---
const pageSrc = readFileSync(new URL("../app/(main)/healthcare/page.js", import.meta.url), "utf8");
assert.match(pageSrc, /data\("healthcare\.json"\)/, "page reads healthcare.json");
assert.match(pageSrc, /Unreimbursed HSA-eligible spend/, "page carries the unreimbursed card");
assert.match(pageSrc, /Charges with no EOB/, "page carries the unmatched-charges table");
assert.match(pageSrc, /EOBs with no payment found/, "page carries the unmatched-claims table");
const navSrc = readFileSync(new URL("../lib/nav-items.js", import.meta.url), "utf8");
assert.match(navSrc, /\["\/healthcare", "Healthcare"/, "nav links to /healthcare");

console.log("healthcare checks: all passed");
