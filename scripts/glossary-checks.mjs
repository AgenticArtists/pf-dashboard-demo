import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { segmentText, splitCitation, CURATED_TERMS } = await import("../lib/glossary.js");

// lib/glossary.js still ships unchanged in the demo; the segmentation
// battery below is the original fixture-level coverage.
const terms = [
  { term: "10-year Treasury yield", kind: "term" },
  { term: "yields", kind: "term" },
  { term: "allocation targets", kind: "term" },
  { term: "central bank", kind: "term" },
  { term: "bank", kind: "term" },
  { term: "S&P 500", kind: "term" },
  { term: "Apple", kind: "business" },
];
const text = "The 10-year Treasury yield rose as yields climbed and the central bank held; allocation targets stand. The S&P 500 beat Apple stock, though an apple a day is fine. (Weekly Wrap, 2026-10-16)";
const segs = segmentText(text, terms);
const hits = segs.filter((s) => s.term).map((s) => s.text);
assert.deepEqual(hits, ["10-year Treasury yield", "yields", "central bank", "allocation targets", "S&P 500", "Apple"], `unexpected highlights: ${JSON.stringify(hits)}`);
assert.ok(!hits.includes("bank"), "longest match must win over 'bank' inside 'central bank'");
assert.ok(segs.every((s) => !s.term || !/Weekly Wrap/.test(s.text)), "citation tail must not highlight");
const joined = segs.map((s) => s.text).join("");
assert.equal(joined, text, "segmentation must preserve the full text exactly");
assert.deepEqual(splitCitation("Claim (Source, 2026-01-01)")[1], " (Source, 2026-01-01)");
assert.deepEqual(segmentText("Nothing to mark.", []), [{ text: "Nothing to mark." }]);
assert.deepEqual(segmentText("Nothing to mark.", null), [{ text: "Nothing to mark." }]);
const caseSegs = segmentText("Yields rose.", terms).filter((s) => s.term);
assert.equal(caseSegs.length, 1, "kind term matches case-insensitively at sentence start");

const curatedNames = CURATED_TERMS.map((t) => t.term.toLowerCase());
for (const need of ["sharpe", "max drawdown", "drawdown", "volatility", "risk contribution", "backtest"]) {
  assert.ok(curatedNames.includes(need), `curated terms include ${need}`);
}
const riskSegs = segmentText("A Sharpe of 0.49 with a max drawdown of -22.1% and volatility of 12.8%.", CURATED_TERMS);
assert.deepEqual(riskSegs.filter((s) => s.term).map((s) => s.text), ["Sharpe", "max drawdown", "volatility"], "curated segmentation highlights the risk terms");

// Route wiring in the demo: /api/glossary is a disabled stub — it
// defines nothing, checks no session and calls no model.
const route = readFileSync(new URL("../app/api/glossary/route.js", import.meta.url), "utf8");
assert.ok(route.includes("export const POST"), "glossary route exposes POST");
assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), "glossary route returns the disabled 405 stub");
for (const fragment of ["checkRequestGuard", "sessionUser", "glossary_terms", "CURATED_TERMS", "deepseek", "data_collection", "OPENROUTER", "takeDailySlot", "createHash"]) {
  assert.ok(!route.includes(fragment), `disabled glossary route has no ${fragment}`);
}

// The explainer components still ship and still default to the
// curated terms; in the demo their definition fetches hit the stub.
const explainer = readFileSync(new URL("../app/(main)/investments/explainer-text.js", import.meta.url), "utf8");
assert.match(explainer, /\/api\/glossary/, "explainer component calls the glossary endpoint");
assert.match(explainer, /CURATED_TERMS/, "explainer defaults to the curated terms");
assert.match(explainer, /terms = CURATED_TERMS/, "explainer's default term set is the curated list");
const comp = readFileSync(new URL("../app/(main)/investments/regime-bullets.js", import.meta.url), "utf8");
assert.match(comp, /gloss-term/, "component renders gloss-term buttons");
assert.match(comp, /<dialog/, "component uses a dialog for definitions");
assert.match(comp, /\/api\/glossary/, "component calls the glossary endpoint");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert.match(css, /\.gloss-term \{[^}]*italic/, "gloss-term is italicized");
assert.match(css, /\.gloss-term \{[^}]*color: var\(--link\)/, "gloss-term is blue text (the theme link color)");
assert.ok(!/\.gloss-term \{[^}]*background: rgba/.test(css), "gloss-term has no background highlight (blue text, not a highlight)");
assert.match(css, /\.gloss-term \{[^}]*background: none/, "gloss-term explicitly clears any background");

console.log("glossary checks: all passed");
