import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// lib/rate-limit.js still ships unchanged in the demo: in-memory per
// instance by default, shared through an Upstash Redis REST endpoint
// when configured, falling back to memory when that endpoint fails.
// The paid routes behind it are disabled stubs (asserted below), so
// in the demo the limiter is exercised here at the library level only.
for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete process.env[k];
const { takeDailySlot } = await import("../lib/rate-limit.js");
const realFetch = globalThis.fetch;

// Memory mode: exactly `cap` slots per scope and user.
globalThis.fetch = () => { throw new Error("memory mode must not call fetch"); };
for (let i = 0; i < 3; i++) assert.equal(await takeDailySlot("t-mem", "daniel", 3), true, `slot ${i + 1} of 3`);
assert.equal(await takeDailySlot("t-mem", "daniel", 3), false, "fourth slot is refused");
assert.equal(await takeDailySlot("t-mem", "maya", 3), true, "caps are per user");
assert.equal(await takeDailySlot("t-mem2", "daniel", 3), true, "caps are per scope");

// Shared mode: INCR + EXPIRE on the REST pipeline; allowed while count <= cap.
process.env.KV_REST_API_URL = "https://redis.example.test/";
process.env.KV_REST_API_TOKEN = "test-token";
const counts = new Map();
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  const [[incr, key], [expire, expireKey, ttl]] = JSON.parse(init.body);
  assert.equal(incr, "INCR");
  assert.equal(expire, "EXPIRE");
  assert.equal(expireKey, key);
  assert.equal(ttl, "172800");
  counts.set(key, (counts.get(key) || 0) + 1);
  return new Response(JSON.stringify([{ result: counts.get(key) }, { result: 1 }]), { status: 200 });
};
assert.equal(await takeDailySlot("t-shared", "daniel", 2), true);
assert.equal(await takeDailySlot("t-shared", "daniel", 2), true);
assert.equal(await takeDailySlot("t-shared", "daniel", 2), false, "shared count past the cap is refused");
assert.equal(calls[0].url, "https://redis.example.test/pipeline", "trailing slash trimmed, pipeline endpoint");
assert.equal(calls[0].init.headers.Authorization, "Bearer test-token");
const day = new Date().toISOString().slice(0, 10);
assert.ok(counts.has(`pf:rate:t-shared:daniel:${day}`), "key binds scope, user and UTC day");

// Shared store down: the in-memory counter still bounds this instance.
globalThis.fetch = async () => new Response("unavailable", { status: 503 });
assert.equal(await takeDailySlot("t-down", "daniel", 1), true);
assert.equal(await takeDailySlot("t-down", "daniel", 1), false, "memory fallback enforces the cap");
globalThis.fetch = async () => { throw new TypeError("network down"); };
assert.equal(await takeDailySlot("t-down2", "daniel", 1), true);
assert.equal(await takeDailySlot("t-down2", "daniel", 1), false, "network errors fall back to memory too");
globalThis.fetch = realFetch;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

// Demo route wiring: the three formerly paid routes are disabled
// stubs, so none of them consumes a slot or keeps a private counter.
for (const file of ["ask", "explain", "glossary"]) {
  const route = readFileSync(new URL(`../app/api/${file}/route.js`, import.meta.url), "utf8");
  assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), `${file} route returns the disabled 405 stub`);
  assert.ok(!route.includes("takeDailySlot"), `${file} route does not call the shared limiter in the demo`);
  assert.ok(!route.includes("requestsByUserDay"), `${file} route has no private counter`);
}
const ask = readFileSync(new URL("../app/api/ask/route.js", import.meta.url), "utf8");
assert.ok(!ask.includes("ADVISOR_DAILY_CAP") && !ask.includes('"advisor"'), "disabled ask route has no advisor lane cap");

console.log("rate limit checks: all passed");
