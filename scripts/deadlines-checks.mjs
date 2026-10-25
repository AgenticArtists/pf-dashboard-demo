import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Deadline center, demo data: deadlines.json carries exactly two
// entries — the Cedar Grove lease review (2027-11-01, the notice date
// in the demo lease record) and the fictional benefits review
// (2027-04-30) — both referenced to generated_for 2026-10-22. The demo
// has no tax, insurance-gap, vesting, or statement-staleness deadlines.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  },
});

const { groupByBand, nextDeadlines, daysLeft, bandFor, withFresh } = await import("../lib/deadlines.js");

const read = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));
const payload = read("deadlines.json");
const list = payload.deadlines || [];
const byId = Object.fromEntries(list.map((e) => [e.id, e]));
const ref = payload.generated_for;

// --- The demo entries, exactly ---
assert.equal(ref, "2026-10-22", "deadlines generated_for is the demo snapshot date");
assert.equal(list.length, 2, "demo carries exactly two deadlines");
assert.deepEqual(list.map((e) => e.id).sort(), ["benefits", "lease-renewal"], "deadline ids are the two demo entries");
assert.equal(byId["lease-renewal"]?.date, "2027-11-01", "lease review date");
assert.equal(byId["lease-renewal"]?.title, "Review Cedar Grove lease", "lease review title");
assert.equal(byId["lease-renewal"]?.category, "lease", "lease review category");
assert.equal(byId.benefits?.date, "2027-04-30", "benefits review date");
assert.equal(byId.benefits?.title, "Review fictional benefits election", "benefits review title");
assert.equal(byId.benefits?.category, "benefits", "benefits review category");
for (const absent of ["lease_notice", "lease_end", "tax_filing", "renters_coverage_gap", "apple_card_stale"]) {
  assert.equal(byId[absent], undefined, `demo has no ${absent} deadline`);
}

// The lease review date traces to the demo lease record on file.
const lease = read("records.json").lease;
assert.equal(byId["lease-renewal"]?.date, lease.notice_deadline_for_current_term, "lease review date = the record's notice deadline for the current term");

// The demo tax projection is federal-only, so no tax deadline is derived.
const projection = read("tax_projection.json");
assert.equal(Object.hasOwn(projection, "state"), false, "tax projection has no state key (federal only)");
assert.equal(projection.combined_balance_due, projection.federal.balance_due, "combined balance due is the federal balance due");
assert.equal(projection.combined_balance_due, 6316.69, "demo projected federal balance due");

// --- days_left in the file agrees with the site's recomputation ---
assert.equal(byId["lease-renewal"]?.days_left, 375, "lease review is 375 days out from generated_for");
assert.equal(byId.benefits?.days_left, 190, "benefits review is 190 days out from generated_for");
for (const e of list) {
  assert.equal(daysLeft(e, ref), e.days_left, `${e.id}: site daysLeft matches the file's`);
  assert.equal(bandFor(e.days_left), "later", `${e.id}: both demo deadlines sit in the later band`);
  assert.equal(withFresh(e, ref).urgency, "later", `${e.id}: recomputed urgency is later`);
  assert.ok(e.title && e.consequence && e.source && e.category, `${e.id}: carries title/consequence/source/category`);
}

// --- Grouping covers every entry exactly once, bands in order ---
const groups = groupByBand(list, ref);
const grouped = groups.flatMap((g) => g.items.map((e) => e.id));
assert.deepEqual([...grouped].sort(), list.map((e) => e.id).sort(), "grouping covers all deadlines");
assert.equal(new Set(grouped).size, grouped.length, "no deadline appears in two bands");
const bandOrder = ["overdue", "within_30", "within_90", "later"];
assert.deepEqual(groups.map((g) => g.key), bandOrder.filter((b) => groups.some((g) => g.key === b)), "bands render in urgency order");
assert.deepEqual(groups.map((g) => g.key), ["later"], "demo deadlines form a single later band");
assert.deepEqual(groups[0].items.map((e) => e.id), ["benefits", "lease-renewal"], "later band is date-ascending (benefits review first)");

// --- Dashboard strip: top 3 by date, overdue or within range only ---
// At the lib default (180 days) neither demo deadline qualifies; the
// Dashboard calls nextDeadlines with withinDays: 200, which admits
// exactly the benefits review (190 days).
const stripDefault = nextDeadlines(list, ref);
assert.deepEqual(stripDefault, [], "no demo deadline is within the default 180-day strip window");
const strip = nextDeadlines(list, ref, { withinDays: 200 });
assert.deepEqual(strip.map((e) => e.id), ["benefits"], "dashboard strip (200-day window) holds only the benefits review");
for (const e of strip) assert.ok(e.days_left < 0 || e.days_left <= 200, `${e.id}: strip entry is overdue or within 200 days`);
const far = nextDeadlines([{ id: "x", date: "2030-01-01" }], ref);
assert.equal(far.length, 0, "a deadline beyond the window stays off the strip");
const overdue = nextDeadlines([{ id: "y", date: "2020-01-01" }], ref);
assert.equal(overdue.length, 1, "an overdue deadline always shows on the strip");

// --- Watchdog tie-in: the demo watchdog carries no deadline findings ---
const watchdog = read("watchdog.json");
const dlFindings = (watchdog.findings || []).filter((f) => f.type === "deadline");
assert.equal(dlFindings.length, 0, "demo watchdog has no deadline findings");
assert.deepEqual((watchdog.findings || []).map((f) => f.id), ["demo|review"], "demo watchdog carries only its synthetic review finding");
for (const f of watchdog.findings || []) assert.ok(f.first_seen, `${f.id}: carries first_seen for the ack contract`);

// --- Wiring: nav, page and Dashboard strip read the same data ---
const nav = readFileSync(new URL("../lib/nav-items.js", import.meta.url), "utf8");
assert.match(nav, /\["\/deadlines", "Deadlines", "calendar"\]/, "nav carries the Deadlines entry");
const page = readFileSync(new URL("../app/(main)/deadlines/page.js", import.meta.url), "utf8");
assert.match(page, /data\("deadlines\.json"\)/, "deadlines page reads deadlines.json");
assert.match(page, /groupByBand/, "deadlines page groups by urgency band");
const home = readFileSync(new URL("../app/(main)/page.js", import.meta.url), "utf8");
assert.match(home, /nextDeadlines\(deadlinesPayload\.deadlines/, "dashboard strip selects from deadlines.json");
assert.match(home, /withinDays: 200/, "dashboard strip uses the 200-day window");
assert.match(home, /href="\/deadlines"/, "dashboard strip links to the Deadlines page");
assert.match(home, /Upcoming deadlines/, "dashboard carries the strip card");

console.log("deadline checks: all passed");
