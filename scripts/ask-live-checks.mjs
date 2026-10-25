import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Demo ask-core is an inert compatibility module: no live model calls,
// no snapshot sections, no commentary pack. These assertions pin the
// exact behaviour the demo module actually implements.
const {
  SYSTEM_PROMPT, TRIAGE_PROMPT, ADVISOR_SYSTEM_PROMPT,
  buildAskContext, buildAdvisorContext, buildThreadHistory,
  parseAskReply, parseTriageReply, resolveKind,
} = await import("../lib/ask-core.js");

assert.equal(SYSTEM_PROMPT, "Ask is disabled in this public synthetic-data demo.");
assert.equal(TRIAGE_PROMPT, SYSTEM_PROMPT);
assert.equal(ADVISOR_SYSTEM_PROMPT, SYSTEM_PROMPT);

assert.equal(resolveKind("update", null), "update");
assert.equal(resolveKind("question", null), "question");
assert.equal(resolveKind("ambiguous", null), "ambiguous");
assert.equal(resolveKind("junk", null), "ambiguous");
assert.equal(resolveKind(null, null), "ambiguous");
assert.equal(resolveKind("question", "instruction"), "update");
assert.equal(resolveKind("update", "question"), "question");
assert.equal(resolveKind(null, "instruction"), "update");
assert.equal(resolveKind(null, "question"), "question");

// Context: exactly five named demo files, each rendered as
// "<filename>\n<pretty JSON>" and joined with a blank line, in order.
const requested = [];
const stub = (name) => {
  requested.push(name);
  if (name === "meta.json") return { household: "Daniel and Maya Carter", net_worth: 386271.38 };
  if (name === "accounts.json") return [{ name: "Bluebonnet Rewards Card", mask: "5183" }];
  return null;
};
const context = buildAskContext(stub);
assert.deepEqual(requested, ["meta.json", "accounts.json", "budgets.json", "income_2026.json", "portfolio.json"], "context reads the five demo files in order");
assert.ok(context.startsWith("meta.json\n"), "context opens with the meta section");
assert.ok(context.includes("Daniel and Maya Carter"), "context carries the demo household name");
assert.ok(context.includes("386271.38"), "context carries the demo net worth from the supplied meta data");
assert.ok(context.includes("Bluebonnet Rewards Card"), "context carries the demo card from the supplied accounts data");
assert.ok(context.indexOf("meta.json") < context.indexOf("accounts.json"), "meta precedes accounts");
assert.ok(context.indexOf("accounts.json") < context.indexOf("budgets.json"), "accounts precedes budgets");
assert.ok(context.indexOf("budgets.json") < context.indexOf("income_2026.json"), "budgets precedes income");
assert.ok(context.indexOf("income_2026.json") < context.indexOf("portfolio.json"), "income precedes portfolio");
assert.ok(!context.includes("SNAPSHOT") && !context.includes("TRANSACTIONS 2026"), "demo context has no snapshot or transactions sections");
assert.ok(!context.includes("snapshot.json") && !context.includes("commentary.json") && !context.includes("regime_brief.json"), "demo context reads no snapshot, commentary or regime files");

// Default data function yields nulls: every section heading is present
// with an empty body, and nothing throws.
const emptyContext = buildAskContext();
for (const name of ["meta.json", "accounts.json", "budgets.json", "income_2026.json", "portfolio.json"]) {
  assert.ok(emptyContext.includes(name), `default context includes the ${name} heading`);
}

// A data function that throws for one file drops only that section.
const throwingContext = buildAskContext((name) => {
  if (name === "accounts.json") throw new Error("missing");
  return { ok: true };
});
assert.ok(!throwingContext.includes("accounts.json"), "a throwing file is skipped");
assert.ok(throwingContext.includes("meta.json") && throwingContext.includes("portfolio.json"), "other sections survive a throwing file");

assert.equal(buildAdvisorContext(stub), buildAskContext(stub), "advisor context is the same builder output in the demo");

// Thread history: user turns only, the last eight text entries in
// array order (instructions first, then questions), each capped at
// 2000 characters with no truncation marker and no assistant turns.
const instructions = Array.from({ length: 5 }, (_, i) => ({ id: `i${i}`, text: `instruction ${i}` }));
const questions = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, text: `question ${i}` }));
const history = buildThreadHistory(instructions, questions);
assert.deepEqual(history.map((t) => t.content), [
  "instruction 2", "instruction 3", "instruction 4",
  "question 0", "question 1", "question 2", "question 3", "question 4",
], "history keeps the last eight entries in order");
assert.ok(history.every((t) => t.role === "user"), "demo history has only user turns");
assert.deepEqual(buildThreadHistory([{ text: 42 }, null, { text: "kept" }, {}], []), [{ role: "user", content: "kept" }], "non-string entries are dropped");
assert.deepEqual(buildThreadHistory(null, undefined), [], "non-array inputs yield an empty history");
const longHistory = buildThreadHistory([], [{ text: "a".repeat(5000) }]);
assert.equal(longHistory.length, 1);
assert.equal(longHistory[0].content, "a".repeat(2000), "each turn is capped at exactly 2000 characters");
assert.ok(!longHistory[0].content.endsWith("…"), "demo history adds no truncation marker");

// Reply parsing: strict kind allowlist plus a string reply; the triage
// parser always reports the simple lane and ignores any supplied lane.
assert.deepEqual(parseAskReply('{"kind":"question","reply":"Answer"}'), { kind: "question", reply: "Answer" });
assert.deepEqual(parseAskReply('```json\n{"kind":"update","reply":"Filed"}\n```'), { kind: "update", reply: "Filed" });
assert.deepEqual(parseAskReply('{"kind":"question","reply":""}'), { kind: "question", reply: "" }, "an empty string reply still parses in the demo parser");
assert.equal(parseAskReply("junk"), null);
assert.equal(parseAskReply('{"kind":"other","reply":"x"}'), null);
assert.equal(parseAskReply('{"kind":"question"}'), null, "a missing reply fails parsing");
assert.equal(parseAskReply('{"kind":"question","reply":42}'), null, "a non-string reply fails parsing");
assert.equal(parseAskReply(null), null);
assert.equal(parseAskReply(42), null);

assert.deepEqual(parseTriageReply('{"kind":"question","reply":"hi"}'), { kind: "question", reply: "hi", lane: "simple" });
assert.deepEqual(parseTriageReply('{"kind":"question","lane":"advisor","reply":""}'), { kind: "question", reply: "", lane: "simple" }, "triage always reports the simple lane");
assert.deepEqual(parseTriageReply('```json\n{"kind":"update","lane":"simple","reply":"Filed"}\n```'), { kind: "update", reply: "Filed", lane: "simple" });
assert.equal(parseTriageReply('{"kind":"question"}'), null, "triage requires a string reply like the base parser");
assert.equal(parseTriageReply("junk"), null);
assert.equal(parseTriageReply('{"kind":"other","reply":"x"}'), null);

// No live route, client or page wiring exists in the demo.
const route = readFileSync(new URL("../app/api/ask/route.js", import.meta.url), "utf8");
assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), "ask route is the disabled stub");
for (const fragment of ["OPENROUTER", "openrouter", "callModel", "maxDuration", "addQuestion", "addInstruction", "sessionUser"]) {
  assert.ok(!route.includes(fragment), `disabled ask route has no ${fragment}`);
}
const page = readFileSync(new URL("../app/(main)/ask/page.js", import.meta.url), "utf8");
assert.ok(page.includes("Ask is disabled in this demo."), "ask page is the static stub");
assert.ok(!page.includes("/api/ask") && !page.includes("liveConfigured"), "ask page has no live configuration");

console.log("ask live checks: all passed");
