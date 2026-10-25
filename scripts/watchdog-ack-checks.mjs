import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { tokenConfigured, getOverrides, upsertOverride } = await import("../lib/overrides.js");

// Demo disposition: watchdog acknowledgement was a write through the
// overrides API to a remote-backed store. In the demo that store is
// inert and the route is a disabled stub, so no finding can be
// acknowledged or restored — the read-only guarantee is what is pinned.

// The demo watchdog data is a single synthetic notice, not a real alert.
const watchdog = JSON.parse(readFileSync(new URL("../data/watchdog.json", import.meta.url), "utf8"));
assert.equal(watchdog.findings.length, 1, "demo watchdog has exactly one finding");
assert.deepEqual(watchdog.findings[0], {
  id: "demo|review",
  type: "review",
  title: "Demo data is synthetic",
  first_seen: "2026-10-22",
  detail: "This is a fictional household dataset.",
}, "the only demo finding is the synthetic-data notice for Daniel and Maya Carter's fictional dataset");

// The override store never reports configured, reads back empty and
// refuses the acknowledgement write.
assert.equal(tokenConfigured(), false, "demo override store is never configured");
assert.deepEqual(await getOverrides(), [], "demo overrides read back empty, so nothing starts acknowledged");
assert.deepEqual(await upsertOverride(), { ok: false, reason: "disabled in demo" }, "the acknowledgement write is disabled");

// The overrides route itself is the disabled 405 stub for both verbs.
const route = readFileSync(new URL("../app/api/overrides/route.js", import.meta.url), "utf8");
assert.ok(route.includes("export const GET") && route.includes("export const POST"), "overrides route exposes GET and POST");
assert.ok(route.includes('{ error: "disabled in demo" }') && route.includes("status: 405"), "overrides route returns the disabled 405 stub");
assert.ok(!route.includes("upsertOverride") && !route.includes("getOverrides"), "overrides route touches no store functions");

// The briefing page still renders the panel but wires it with the
// demo's unconfigured flag, and still derives any acknowledgements
// from watchdog-typed records (of which the demo store returns none).
const page = readFileSync(new URL("../app/(main)/briefing/page.js", import.meta.url), "utf8");
assert.ok(page.includes("WatchdogPanel"), "briefing renders the watchdog panel");
assert.ok(page.includes('r.target_type === "watchdog"'), "briefing derives acknowledgements from watchdog records");
assert.ok(page.includes("configured={tokenConfigured()}"), "briefing passes the configured flag from the store helper");

// The panel component still ships and still posts acknowledgements,
// but every acknowledge/restore button is disabled when unconfigured —
// which, per the assertions above, is always the case in the demo.
const panel = readFileSync(new URL("../app/(main)/briefing/watchdog.js", import.meta.url), "utf8");
assert.ok(panel.includes('fetch("/api/overrides"'), "panel still posts acknowledgements to the overrides endpoint");
assert.ok(panel.includes('target_type: "watchdog"') && panel.includes('field: "acknowledged"'), "panel posts the watchdog acknowledgement shape");
assert.ok(panel.includes("disabled={!configured"), "panel disables its buttons when unconfigured");
assert.ok(panel.includes("Acknowledging switches on once the site's GitHub token is added"), "panel explains why acknowledging is off");

console.log("watchdog ack checks: all passed");
