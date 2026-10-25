import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { checkRequestGuard } from "../lib/request-guard.js";
import { applyRecordsToTxns, fingerprint } from "../lib/overrides.js";
import { mutateJsonWithRetries, tokenConfigured } from "../lib/github.js";

// Demo disposition: the session/auth subject of the original suite is
// gone — there is no auth module, no login page and no session gate.
// What remains is the demo's no-auth guarantee, plus the guard,
// override-rendering and mutation-loop libraries that still ship.

// --- No-auth guarantee -------------------------------------------------
assert.ok(!existsSync(new URL("../lib/auth.js", import.meta.url)), "demo ships no auth module");
assert.ok(!existsSync(new URL("../app/(main)/login", import.meta.url)), "demo has no login page under the main layout");
assert.ok(!existsSync(new URL("../app/login", import.meta.url)), "demo has no top-level login page");

const middleware = readFileSync(new URL("../middleware.js", import.meta.url), "utf8");
assert.ok(middleware.includes("NextResponse.next()"), "middleware passes every request through");
assert.ok(middleware.includes("no session gate"), "middleware documents the public-demo posture");
for (const fragment of ["DASH_PASSWORD", "SESSION_SECRET", "pf_session", "sessionUser", "redirect", "/login"]) {
  assert.ok(!middleware.includes(fragment), `middleware has no ${fragment}`);
}

// Every API route in the demo is the same disabled 405 stub.
for (const name of ["ask", "explain", "glossary", "instructions", "investments", "login", "logout", "overrides", "questions"]) {
  const route = readFileSync(new URL(`../app/api/${name}/route.js`, import.meta.url), "utf8");
  assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), `${name} route returns the disabled 405 stub`);
  assert.ok(!route.includes("checkCredentials") && !route.includes("makeSessionValue"), `${name} route performs no credential or session work`);
}

// --- Request guard (lib/request-guard.js still ships) ------------------
const request = (url, headers = {}) => new Request(url, { headers });
assert.deepEqual(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "https://dash.example",
})), { ok: true }, "matching origin passes");
assert.equal(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "https://attacker.example",
})).reason, "bad_origin", "mismatched origin fails");
assert.deepEqual(checkRequestGuard(request("https://dash.example/api/write", { host: "dash.example" })), { ok: true }, "absent origin passes");
assert.deepEqual(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "https://dash.example", "content-type": "application/json; charset=utf-8",
}), { json: true }), { ok: true }, "JSON content type with charset passes");
assert.equal(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "https://dash.example", "content-type": "text/plain",
}), { json: true }).status, 415, "text/plain fails JSON guard");
assert.deepEqual(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "https://dash.example:443",
})), { ok: true }, "explicit default-port origin matches bare host");
assert.equal(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "https://dash.example:8443",
})).reason, "bad_origin", "non-default origin port mismatch fails");
assert.equal(checkRequestGuard(request("https://dash.example/api/write", {
  host: "dash.example", origin: "null",
})).reason, "bad_origin", "null origin fails by default");
assert.deepEqual(checkRequestGuard(request("https://dash.example/api/login", {
  host: "dash.example", origin: "null",
}), { allowNullOrigin: true }), { ok: true }, "null origin passes when a caller opts in");

// --- Override rendering (lib/overrides.js still ships) -----------------
const row = { d: "2026-01-02", m: "5183", a: -25, n: "Test merchant", c: "Original", p: "Joint", sc: "Original subcategory" };
assert.equal(fingerprint(row), "2026-01-02|5183|-25|Test merchant", "fingerprint joins date, mask, amount and name");
const key = fingerprint(row);
const malformed = { target_type: "transaction", target_key: key, field: "category", value: { x: 1 } };
const untouched = applyRecordsToTxns([row], [malformed])[0];
assert.equal(untouched.c, row.c, "malformed record leaves the category untouched");
assert.equal(untouched.p, row.p, "malformed record leaves the person untouched");
assert.equal(untouched.sc, row.sc, "malformed record leaves the subcategory untouched");
assert.doesNotThrow(() => applyRecordsToTxns([row], [malformed]), "malformed records never throw during rendering");
const applied = applyRecordsToTxns([row], [{ ...malformed, value: "Groceries" }])[0];
assert.equal(applied.c, "Groceries", "normal string record still applies");

// --- Mutation loop (lib/github.js still ships) -------------------------
const savedToken = process.env.GITHUB_TOKEN;
delete process.env.GITHUB_TOKEN;
try {
  assert.equal(tokenConfigured(), false, "no token is configured in the demo test run");
  const { writeRepoJsonMutating } = await import("../lib/github.js");
  assert.deepEqual(await writeRepoJsonMutating("web/mock.json", (doc) => doc, "test"), { ok: false, reason: "not_configured" }, "mutating writes report not_configured without a token");
} finally {
  if (savedToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = savedToken;
}

let simulatedRepo = { value: { daniel: 0, maya: 0 }, sha: "sha-0" };
let revision = 0;
const simulatedRead = async () => ({ value: { ...simulatedRepo.value }, sha: simulatedRepo.sha });
const simulatedWrite = async (value, sha) => {
  if (sha !== simulatedRepo.sha) return "conflict";
  simulatedRepo = { value, sha: `sha-${++revision}` };
  return true;
};
const bump = (user) => (doc) => ({ ...doc, [user]: doc[user] + 1 });
const [writeA, writeB] = await Promise.all([
  mutateJsonWithRetries(bump("daniel"), simulatedRead, simulatedWrite),
  mutateJsonWithRetries(bump("maya"), simulatedRead, simulatedWrite),
]);
assert.equal(writeA, true);
assert.equal(writeB, true);
assert.deepEqual(simulatedRepo.value, { daniel: 1, maya: 1 }, "interleaved concurrent mutations preserve both bumps");
const githubSource = readFileSync(new URL("../lib/github.js", import.meta.url), "utf8");
assert.match(githubSource, /\(\) => currentJsonSnapshot\(filePath\)/, "production mutator uses the paired snapshot reader");
assert.match(githubSource, /return \{ exists: true, value: JSON\.parse\(content\), sha: body\.sha \}/, "snapshot content and SHA come from the same Contents response");

console.log("security round 2 checks: all passed");
