import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Cards page, demo data: exactly two transaction-backed cards (the
// Bluebonnet Rewards Card and the Cedar Cash Card) plus the Carter
// Digital Card, which the demo's records fixture carries with no
// statements. Balances pin to the demo account snapshot and to the
// published card statements.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  },
});

const read = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));
const { buildCardsData } = await import("../lib/cards-data.js");
const { cards, totals, asOf } = buildCardsData();
const byName = Object.fromEntries(cards.map((card) => [card.name, card]));

// --- The demo card set, exactly ---
assert.equal(cards.length, 3, "demo has two ledger cards plus the digital card");
assert.deepEqual(cards.map((c) => c.name).sort(),
  ["Bluebonnet Rewards Card", "Carter Digital Card", "Cedar Cash Card"],
  "card names are the demo cards");
assert.equal(asOf, "2026-10-22", "card data as-of is the demo snapshot date");

const bluebonnet = byName["Bluebonnet Rewards Card"];
assert.ok(bluebonnet, "includes the Bluebonnet Rewards Card");
assert.equal(bluebonnet.institution, "Bluebonnet Credit Union", "Bluebonnet institution");
assert.equal(bluebonnet.mask, "5183", "Bluebonnet mask");
assert.equal(bluebonnet.owner, "Joint", "Bluebonnet is the joint card");
assert.equal(bluebonnet.balance, 4992.98, "Bluebonnet balance");

const cedar = byName["Cedar Cash Card"];
assert.ok(cedar, "includes the Cedar Cash Card");
assert.equal(cedar.institution, "Cedar Bank", "Cedar Cash institution");
assert.equal(cedar.mask, "7264", "Cedar Cash mask");
assert.equal(cedar.owner, "Daniel", "Cedar Cash is Daniel's card");
assert.equal(cedar.balance, 812.12, "Cedar Cash balance");

const digital = byName["Carter Digital Card"];
assert.ok(digital, "includes the Carter Digital Card from the records fixture");
assert.equal(digital.institution, "Cedar Bank", "digital card institution");
assert.equal(digital.balance, 0, "digital card carries no balance in the demo fixture");
assert.equal(digital.due, "2026-11-15", "digital card due date from the records fixture");
assert.equal(digital.statementAsOf, "2026-10-22", "digital card statements as-of");
assert.equal(digital.byYear[2025].spend, 0, "digital card has no 2025 statement charges in the demo");
assert.equal(digital.byYear[2026].spend, 0, "digital card has no 2026 statement charges in the demo");

assert.equal(cards.some((card) => card.name.includes("Loan")), false, "excludes the Riverbend auto loan and other non-card liabilities");

// --- Balances and charges reconcile with the published demo files ---
const accounts = read("accounts.json");
for (const card of [bluebonnet, cedar]) {
  const acct = accounts.find((a) => a.name === card.name);
  assert.ok(acct, `${card.name} exists in accounts.json`);
  assert.equal(card.balance, acct.dashboard_value, `${card.name} balance matches the account snapshot`);
  assert.equal(card.mask, acct.mask, `${card.name} mask matches the account snapshot`);
}
const statements = read("card_statements.json").statements;
assert.equal(statements.length, 2, "two published card statements");
for (const st of statements) {
  const card = byName[st.card];
  assert.ok(card, `${st.card} statement has a card row`);
  assert.equal(card.balance, st.balance, `${st.card} balance matches its statement`);
  assert.equal(card.mask, st.mask, `${st.card} mask matches its statement`);
}
assert.equal(bluebonnet.byYear[2026].spend, 5805.18, "Bluebonnet 2026 charges");
assert.equal(bluebonnet.byYear[2025].spend, 7237.8, "Bluebonnet 2025 charges");
assert.equal(cedar.byYear[2026].spend, 3092.36, "Cedar Cash 2026 charges");
assert.equal(cedar.byYear[2025].spend, 3899.76, "Cedar Cash 2025 charges");

assert.ok(cards.every((card) => card.balance >= 0 && card.byYear[2025].spend >= 0 && card.byYear[2026].spend >= 0), "card balances and annual charges are nonnegative");
assert.equal(totals.balance, 5805.1, "total balance is the two card balances (digital card is $0)");
assert.equal(totals.spend2025, 11137.56, "total 2025 charges");
assert.equal(totals.spend2026, 8897.54, "total 2026 charges");
assert.equal(totals.balance, Math.round(cards.reduce((sum, card) => sum + card.balance, 0) * 100) / 100, "balance total matches card rows");
assert.equal(totals.spend2025, Math.round(cards.reduce((sum, card) => sum + card.byYear[2025].spend, 0) * 100) / 100, "2025 charge total matches card rows");
assert.equal(totals.spend2026, Math.round(cards.reduce((sum, card) => sum + card.byYear[2026].spend, 0) * 100) / 100, "2026 charge total matches card rows");

// Sidebar destinations live in NAV; SECTIONS remains shared with the command palette.
const nav = readFileSync(new URL("../lib/nav-items.js", import.meta.url), "utf8");
assert.match(nav, /\["\/accounts", "Accounts", "accounts", \["\/accounts", "\/cards"\]\]/, "Accounts sidebar entry matches Cards routes");
assert.match(nav, /\["\/records", "Records", "records", \["\/records", "\/deadlines"\]\]/, "Records sidebar entry covers records and deadlines");
assert.match(nav, /\["\/guides", "Guides", "info", \["\/guides"\]\]/, "Guides has its own sidebar entry");
const page = readFileSync(new URL("../app/(main)/cards/page.js", import.meta.url), "utf8");
for (const label of ["Card balances", "Charges in 2026", "Charges in 2025", "Balances come from the synthetic account snapshot"]) {
  assert.ok(page.includes(label), `Cards page includes ${label}`);
}

console.log("cards checks: all passed");
