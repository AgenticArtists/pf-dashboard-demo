import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { entriesForUser, tokenConfigured, getOverrides, getInstructions, getQuestions, getInvestmentDecisions, addQuestion, addInstruction, upsertOverride } = await import("../lib/overrides.js");

// Fixture behaviour of the surviving helper: own entries only, fail
// closed on everything else. Fixture names are the demo household's.
const entries = [
  { id: "1", author: "daniel", text: "mine" },
  { id: "2", author: "maya", text: "hers" },
  { id: "3", text: "no author" },
  { id: "4", author: "mallory", text: "unknown user" },
  null,
  "junk",
];
assert.deepEqual(entriesForUser(entries, "daniel").map((e) => e.id), ["1"]);
assert.deepEqual(entriesForUser(entries, "maya").map((e) => e.id), ["2"]);
assert.deepEqual(entriesForUser(entries, ""), []);
assert.deepEqual(entriesForUser(entries, null), []);
assert.deepEqual(entriesForUser(null, "daniel"), []);
assert.deepEqual(entriesForUser(undefined, "maya"), []);
assert.deepEqual(entriesForUser([], "daniel"), []);

// In the demo the store behind the helper is inert: nothing is read
// back and nothing can be written, so no per-user data can leak at all.
assert.equal(tokenConfigured(), false, "demo override store is never configured");
assert.deepEqual(await getOverrides(), [], "demo overrides read back empty");
assert.deepEqual(await getInstructions(), [], "demo instructions read back empty");
assert.deepEqual(await getQuestions(), [], "demo questions read back empty");
assert.deepEqual(await getInvestmentDecisions(), [], "demo investment decisions read back empty");
assert.deepEqual(await addQuestion(), { ok: false, reason: "disabled in demo" }, "adding a question is disabled");
assert.deepEqual(await addInstruction(), { ok: false, reason: "disabled in demo" }, "adding an instruction is disabled");
assert.deepEqual(await upsertOverride(), { ok: false, reason: "disabled in demo" }, "writing an override is disabled");

// The user-facing routes are disabled stubs: they return no entries,
// filtered or otherwise, and reference no session identity.
for (const name of ["questions", "instructions"]) {
  const route = readFileSync(new URL(`../app/api/${name}/route.js`, import.meta.url), "utf8");
  assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), `${name} route returns the disabled 405 stub`);
  assert.ok(!route.includes("entriesForUser") && !route.includes("getQuestions") && !route.includes("getInstructions"), `${name} route reads no stored entries`);
  assert.ok(!route.includes("session") && !route.includes("cookie"), `${name} route uses no session identity`);
}

// The Ask page itself is the static stub: it loads no initial entries
// and performs no per-user filtering because it renders no user data.
const page = readFileSync(new URL("../app/(main)/ask/page.js", import.meta.url), "utf8");
assert.ok(page.includes("does not save questions or instructions"), "stub page states nothing is saved");
assert.ok(!page.includes("entriesForUser"), "stub page performs no entry filtering");
assert.ok(!page.includes("session"), "stub page uses no session identity");
assert.ok(!page.includes("getQuestions") && !page.includes("getInstructions"), "stub page loads no stored entries");

console.log("ask privacy checks: all passed");
