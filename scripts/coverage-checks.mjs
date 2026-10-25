import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Coverage in the demo means EOB coverage, not year-over-year account
// coverage. The demo's data/coverage.json is the healthcare EOB file
// (the same counts data/healthcare.json carries under its `coverage`
// key): three EOB documents, all claim-parsed and validated. The
// pipeline-shaped YoY dataset lib/coverage.js was built for — gap
// accounts, affected categories, per-person exposure, a caveat — does
// NOT exist in the demo: both transaction years run through the same
// six account masks, so there are no absent accounts to derive it
// from, and no such dataset is fabricated here. These checks pin the
// demo file's actual EOB semantics, pin what the YoY helpers in
// lib/coverage.js do with demo data (no caveat, nothing affected,
// nobody flagged — so CoverageNote renders nothing on any surface),
// and pin the YoY wiring that consumes those helpers.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  },
});

const { loadCoverage, isAffected, personFlagged, affectedCategories } = await import("../lib/coverage.js");

const read = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const cov = read("coverage.json");

// --- Shape: the demo EOB coverage file, exactly ---
assert.deepEqual(cov, {
  as_of: "2026-10-22",
  eobs_claim_parsed: 3,
  eob_documents: 3,
  eobs_summary_only: 0,
  summaries_validated: 3,
  summaries_total: 3,
  note: "Synthetic coverage note.",
}, "demo coverage.json is the EOB coverage file");

// --- EOB semantics: the counts are internally consistent ---
assert.ok(cov.eobs_claim_parsed <= cov.eob_documents, "parsed EOBs never exceed EOB documents");
assert.equal(cov.eobs_claim_parsed + cov.eobs_summary_only, cov.eob_documents, "parsed + summary-only = all EOB documents");
assert.ok(cov.summaries_validated <= cov.summaries_total, "validated summaries never exceed summaries total");
assert.equal(cov.summaries_validated, cov.summaries_total, "every demo summary is validated");
assert.equal(cov.eob_documents, cov.summaries_total, "one summary per EOB document");

// --- The same coverage counts live inside healthcare.json ---
const healthcare = read("healthcare.json");
for (const key of ["eobs_claim_parsed", "eob_documents", "eobs_summary_only", "summaries_validated", "summaries_total", "note"]) {
  assert.equal(healthcare.coverage[key], cov[key], `healthcare coverage ${key} matches coverage.json`);
}
assert.equal(healthcare.coverage.claim_service_start, "2026-01-01", "coverage window start");
assert.equal(healthcare.coverage.claim_service_end, cov.as_of, "coverage window ends on the coverage as-of date");
assert.equal(healthcare.claims.length, cov.eobs_claim_parsed, "one parsed claim per claim-parsed EOB");
assert.equal(healthcare.totals_by_year["2026"].eobs_validated, cov.summaries_validated, "validated EOBs in the totals match coverage");
assert.equal(healthcare.totals_by_year["2026"].claims, cov.eob_documents, "totals claim count matches the EOB documents");

// --- No YoY pipeline dataset exists in the demo file ---
for (const key of ["prior_year", "current_year", "materiality_threshold", "caveat", "marker_note", "absent_accounts", "gap_accounts", "affected_categories", "person_gap", "person_note"]) {
  assert.equal(cov[key], undefined, `demo coverage.json has no YoY ${key}`);
}

// --- Why: both years run through the same accounts, so nothing is absent ---
const rowsP = read("transactions_2025.json");
const rowsC = read("transactions_2026.json");
const masksP = new Set(rowsP.map((t) => t.m));
const masksC = new Set(rowsC.map((t) => t.m));
assert.deepEqual([...masksC].sort(), ["2946", "4102", "5183", "7264", "7734", "8842"],
  "2026 ledger masks are the six demo transaction masks (Cedar Bank, Bluebonnet Credit Union and Riverbend Auto Finance accounts)");
assert.deepEqual([...masksP].sort(), [...masksC].sort(), "2025 ledger uses exactly the same masks as 2026");
const absentMasks = [...masksC].filter((m) => !masksP.has(m));
assert.deepEqual(absentMasks, [], "no current-year account is absent from the prior year");

// --- lib/coverage.js on demo data: no caveat, nothing flagged ---
assert.deepEqual(loadCoverage(), cov, "loadCoverage returns the demo coverage file");
assert.equal(affectedCategories(cov).size, 0, "no affected categories in the demo");
for (const cat of read("categories_2026.json").categories) {
  assert.equal(isAffected(cov, cat.name), false, `${cat.name} is not coverage-affected in the demo`);
}
for (const who of ["Daniel", "Maya", "Joint"]) {
  assert.equal(personFlagged(cov, who), false, `${who} is not coverage-flagged in the demo`);
}
assert.equal(isAffected(null, "Groceries"), false, "no coverage data means nothing is affected");
assert.equal(personFlagged(null, "Daniel"), false, "no coverage data means nobody is flagged");
assert.equal(affectedCategories(null).size, 0, "no coverage data means an empty affected set");

// The demo briefing publishes no movers, so no mover row can be flagged.
const briefing = read("briefing.json");
const movers = (briefing.months || []).flatMap((m) => m.movers || []);
assert.equal(movers.length, 0, "demo briefing publishes no movers");
for (const mv of movers) assert.equal(isAffected(cov, mv.category), false, "no demo mover is coverage-flagged");

// --- Wiring: every YoY surface renders the caveat through the helpers,
// gated to when the prior year is actually in play. On demo data the
// caveat itself is absent, so CoverageNote renders nothing (its guard
// is pinned in lib/coverage-note.js). ---
const noteSrc = src("lib/coverage-note.js");
assert.match(noteSrc, /if \(!cov\?\.caveat\) return null/, "CoverageNote renders nothing when the coverage file carries no caveat");

const briefingPage = src("app/(main)/briefing/page.js");
assert.match(briefingPage, /CoverageNote cov=\{cov\}/, "briefing renders the coverage note");
assert.match(briefingPage, /e\.income_ly != null \|\| e\.spend_ly != null/, "briefing note gated on LY figures being in play");
assert.match(briefingPage, /isAffected\(cov, mv\.category\) \? <GapMark cov=\{cov\} \/>/, "briefing flags affected mover rows");

const spendingPage = src("app/(main)/spending/page.js");
assert.match(spendingPage, /year !== "2025" \? <CoverageNote cov=\{cov\}/, "spending note renders in the comparison (current-year) view");
assert.match(spendingPage, /isAffected\(cov, moverUp\.name\)/, "spending flags the up-mover insight");
assert.match(spendingPage, /isAffected\(cov, moverDown\.name\)/, "spending flags the down-mover insight");
assert.match(spendingPage, /gapFlagged: year === "2025" \? false : personFlagged\(cov, person\)/, "person flag is never set in the prior-year view");

const report = src("app/(main)/spending/report.js");
assert.match(report, /r\.gapFlagged \? <sup/, "person report marks a flagged person's YoY stat");

const cashFlow = src("app/(main)/cash-flow/page.js");
assert.match(cashFlow, /range !== "2026" \? <CoverageNote cov=\{cov\} \/>/, "cash flow note renders only when prior-year months are in the range");

console.log("coverage checks: all passed");
