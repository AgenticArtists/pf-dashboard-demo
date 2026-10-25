import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Weekly digest card: pinned to the demo digest.json the site ships and
// to the Briefing page wiring that renders it. The demo payload is
// exactly headline / week / lines — it carries no has_news flag and no
// sections block.
const read = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));
const digest = read("digest.json");

assert.deepEqual(Object.keys(digest).sort(), ["headline", "lines", "week"], "demo digest carries exactly headline, week and lines");
assert.equal(Object.hasOwn(digest, "has_news"), false, "demo digest has no has_news flag");
assert.equal(Object.hasOwn(digest, "sections"), false, "demo digest has no sections block");
assert.equal(digest.headline, "Synthetic demo household stayed within its monthly plan.", "demo digest headline");
assert.ok(typeof digest.headline === "string" && digest.headline.length > 0, "digest carries a headline");
assert.deepEqual(digest.lines, [
  "Payroll deposits and recurring bills are present.",
  "No real accounts or people are represented.",
], "demo digest lines");
assert.ok(Array.isArray(digest.lines) && digest.lines.length >= 1, "digest carries lines");
assert.ok(digest.lines.length <= 10, "digest stays tight (<=10 lines)");
for (const line of digest.lines) assert.ok(line !== digest.headline, "lines do not repeat the headline");

// The week window is the demo snapshot week, ending on the as-of date.
assert.deepEqual(digest.week, { start: "2026-10-16", end: "2026-10-22" }, "demo digest week window");
assert.equal(digest.week.end, read("snapshot.json").as_of, "digest week ends on the snapshot as-of date");
assert.equal(digest.week.end, read("meta.json").as_of, "digest week ends on the meta as-of date");

// The headline makes no net-worth claim, and the household figure the
// site pins elsewhere is the demo snapshot's $386,271.38.
assert.equal(read("snapshot.json").net_worth, 386271.38, "demo snapshot net worth");
assert.equal(read("meta.json").net_worth, 386271.38, "demo meta net worth agrees with the snapshot");

// Wiring: the Briefing page renders the card from digest.json.
const pageSrc = readFileSync(new URL("../app/(main)/briefing/page.js", import.meta.url), "utf8");
assert.match(pageSrc, /data\("digest\.json"\)/, "briefing page loads digest.json");
assert.match(pageSrc, /This week/, "briefing page carries the This week card");
assert.match(pageSrc, /digest\.headline/, "card renders the digest headline");
assert.match(pageSrc, /digest\.lines/, "card renders the digest lines");

console.log("digest checks: all passed");
