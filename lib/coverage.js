// YoY coverage helpers (P3-21). coverage.json is derived by the pipeline
// (gen_site_data.py) from the two attributed ledgers: accounts present in
// the current year but absent from the frozen prior-year export (deposit
// accounts excluded — their payments were recorded in the prior year
// through the household's then-checking account), the categories whose
// current-year spend runs materially through those gap accounts, and each
// person's exposure. Pages use it to caveat year-over-year figures and to
// flag the distorted rows with a † instead of presenting them as
// like-for-like. The number itself is never suppressed.
import { data } from "./data";

export function loadCoverage() {
  try { return data("coverage.json"); } catch { return null; }
}

export function affectedCategories(cov) {
  return new Set((cov?.affected_categories || []).map((c) => c.category));
}

export function isAffected(cov, category) {
  return affectedCategories(cov).has(category);
}

// True when at least the materiality threshold of this person's
// current-year spend runs through the missing-coverage accounts, so their
// year-over-year comparison is materially distorted.
export function personFlagged(cov, person) {
  return !!cov?.person_gap?.[person]?.flagged;
}

// The React components (CoverageNote, GapMark) live in lib/coverage-note.js
// so this module stays JSX-free for the node check suites.
