import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

// Demo subject: the Ask page is a static stub. There is no live Ask UI,
// no client component, and no character component in the demo tree —
// the page imports nothing but the shared page header.
const page = readFileSync(new URL("../app/(main)/ask/page.js", import.meta.url), "utf8");
assert.ok(page.includes('title="Ask"'), "page keeps the Ask title");
assert.ok(page.includes('subtitle="Static demo page"'), "page is labelled a static demo page");
assert.ok(page.includes("Ask is disabled in this demo."), "page shows the disabled heading");
assert.ok(
  page.includes("This public build makes no external AI calls and does not save questions or instructions."),
  "page states the demo makes no AI calls and saves nothing",
);
assert.ok(page.includes('from "../../../lib/ui"'), "page imports only the shared UI header");
assert.ok(!page.includes('"use client"'), "page is a server component, not a client UI");
assert.ok(!page.includes("<form"), "stub page has no form");
assert.ok(!page.includes("<input") && !page.includes("<textarea"), "stub page has no input fields");
assert.ok(!page.includes("fetch("), "stub page calls no endpoint");
assert.ok(!page.includes("/api/ask") && !page.includes("/api/questions") && !page.includes("/api/instructions"), "stub page references no Ask endpoints");
assert.ok(!page.includes("ask-client") && !page.includes("AskClient"), "stub page imports no Ask client");
assert.ok(!page.includes("AskCharacter") && !page.includes("character"), "stub page imports no character component");

// The Ask directory holds only the stub page and its loading placeholder:
// the former client and character modules are gone from the demo.
const askDir = readdirSync(new URL("../app/(main)/ask/", import.meta.url)).sort();
assert.deepEqual(askDir, ["loading.js", "page.js"], "ask directory contains only the stub page and loading file");
const loading = readFileSync(new URL("../app/(main)/ask/loading.js", import.meta.url), "utf8");
assert.ok(/export\s+default\s+function\s+Loading/.test(loading), "loading placeholder is default exported");
assert.ok(loading.includes('aria-busy="true"'), "loading placeholder marks itself busy for assistive tech");

// Every Ask-related API route is a disabled stub returning 405.
const askRoute = readFileSync(new URL("../app/api/ask/route.js", import.meta.url), "utf8");
assert.ok(askRoute.includes("export const POST"), "ask route exposes POST");
assert.ok(!askRoute.includes("export const GET"), "ask route exposes no GET");
assert.ok(askRoute.includes('{ error: "disabled in demo" }') && askRoute.includes("status: 405"), "ask route returns the disabled 405 stub");
for (const name of ["questions", "instructions"]) {
  const route = readFileSync(new URL(`../app/api/${name}/route.js`, import.meta.url), "utf8");
  assert.ok(route.includes("export const GET") && route.includes("export const POST"), `${name} route exposes GET and POST`);
  assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), `${name} route returns the disabled 405 stub`);
  assert.ok(!route.includes("fetch(") && !route.includes("openrouter") && !route.includes("OPENROUTER"), `${name} route makes no AI calls`);
}

// The shared Ask library module is inert in the demo.
const { SYSTEM_PROMPT } = await import("../lib/ask-core.js");
assert.equal(SYSTEM_PROMPT, "Ask is disabled in this public synthetic-data demo.", "ask-core prompt is the disabled-demo notice");
assert.ok(!existsSync(new URL("../lib/auth.js", import.meta.url)), "demo ships no auth module for Ask");

console.log("ask stub checks: all passed");
