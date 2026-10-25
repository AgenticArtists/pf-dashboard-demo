import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// Decisions & theses surface (Option B Phase 3) + annex contested
// gating (Phase 2): nav wiring, page data contract, and the
// bullet_meta rendering in the Research basis annex.

const nav = readFileSync(new URL("../lib/nav-items.js", import.meta.url), "utf8");
assert.match(nav, /\["\/decisions", "Decisions & theses"/, "command palette lists /decisions");
assert.match(nav, /\["\/decisions", "Decisions"\]/, "Plan tabs include Decisions");
assert.match(nav, /"\/enrollment", "\/decisions"\]/, "Plan nav group matches /decisions for highlighting");

const pagePath = new URL("../app/(main)/decisions/page.js", import.meta.url);
assert.ok(existsSync(pagePath), "decisions page exists");
const page = readFileSync(pagePath, "utf8");
for (const name of ["theses.json", "decisions.json", "source_scores.json"]) {
  assert.ok(page.includes(`data("${name}")`), `decisions page reads ${name}`);
}
assert.match(page, /Allocation theses/, "theses section renders");
assert.match(page, /Decision journal/, "journal section renders");
assert.match(page, /Revision conditions/, "theses show revision conditions");
assert.match(page, /What would prove it wrong/, "journal shows falsification conditions");
assert.match(page, /Source track record/, "score section renders when data exists");

const bullets = readFileSync(new URL("../app/(main)/investments/regime-bullets.js", import.meta.url), "utf8");
assert.match(bullets, /meta/, "regime bullets accept bullet meta");
assert.match(bullets, /Contested — sources disagree/, "contested bullets are flagged");
assert.match(bullets, /Forecast-based/, "forecast-basis bullets are flagged");
assert.match(bullets, /Opinion-based/, "opinion-basis bullets are flagged");
assert.match(bullets, /contested \? "contested"/, "contested bullets get the demotion class");

const investments = readFileSync(new URL("../app/(main)/investments/page.js", import.meta.url), "utf8");
assert.match(investments, /bullet_meta/, "investments page passes bullet_meta into the annex");

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert.match(css, /\.insights li\.contested/, "contested demotion style exists");
assert.match(css, /\.bullet-flags/, "bullet flags style exists");

console.log("decisions checks: all passed");
