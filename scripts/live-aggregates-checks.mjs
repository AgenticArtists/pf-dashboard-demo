import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Live aggregates: the Cash flow page, the home cash-flow card and the
// Monthly briefing compute their totals from transaction rows +
// override records at render (lib/live-aggregates.js), reproducing the
// published aggregates. On the demo data this suite pins:
//   A. Parity battery — with NO override records applied, the live
//      computation reproduces the published briefing / monthly_cashflow
//      money aggregates to the cent for every month on file (income,
//      spend, net, loan principal, budget lines). Two documented demo
//      differences are pinned as such, not smoothed over: the lib
//      rounds savings rates to one decimal where the published files
//      carry two, and the published briefing's budget actuals are
//      placeholder zeros where the live partition computes the real
//      ones. Live spend is NET of loan principal (the published
//      monthly_cashflow spend is net too); the raw category totals in
//      categories_2026.json stay gross, exactly $2,700 (9 x $300 of
//      2026 principal) above the live net total.
//   B. The demo ships no override records (overrides.json is empty),
//      so applying the site's records changes zero rows.
//   C. Synthetic records move the totals by exactly the record's effect
//      (and a subcategory label that crosses the income taxonomy moves
//      nothing — it never reclassifies a row on its own).
//   D. Card Rewards rows are neither spend nor income at either layer;
//      the demo ledger contains none, and every excluded-category row
//      it does contain is classified neither as spend (nor, except
//      Income rows, as income).
//   E. The demo allowance ledger is empty (no people, no entries), so
//      the Budgets page's rollover section stays hidden.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  },
});

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const { prepareLiveRows, loanPrincipal, liveMonthly, liveCashflowSeries, liveBriefing, r2, r1 } = await import("../lib/live-aggregates.js");
const { fingerprint } = await import("../lib/overrides.js");

const rawRows = [...J("data/transactions_2025.json"), ...J("data/transactions_2026.json")];
const loanModel = J("data/loan_model.json");
const publishedMonthly = J("data/monthly_cashflow.json");
const publishedBriefing = J("data/briefing.json");
const budgets = J("data/budgets.json");
const records = J("overrides.json").records ?? [];

const eq = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: live=${a} published=${b}`);

// Demo loan model pins, used across the sections below.
assert.equal(loanModel.lender, "Riverbend Auto Finance", "demo loan lender");
assert.equal(loanModel.payment_mask, "4102", "loan payments come from joint checking ····4102");
assert.equal(loanModel.monthly_payment, 510, "demo loan payment is $510/mo");
assert.equal(loanModel.principal_per_payment, 300, "loan_model publishes $300 principal per payment");

// ---------- A. parity battery, no records ----------
{
  const prepared = prepareLiveRows(rawRows, []);
  const loan = loanPrincipal(prepared, loanModel);
  assert.deepEqual([...loan.principalByMonth.entries()].sort(),
    ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => [m, 300]),
    "principal is $300 in each of Jan-Sep 2026 and nothing outside it");
  const live = new Map(liveMonthly(prepared, loan, publishedMonthly).map((m) => [m.month, m]));
  assert.equal(live.size, publishedBriefing.months.length, "live month count");
  assert.equal(publishedBriefing.months.length, 22, "demo publishes 22 months (2025 + Jan-Oct 2026)");
  const publishedByMonth = new Map(publishedMonthly.map((m) => [m.month, m]));
  for (const pm of publishedBriefing.months) {
    const m = live.get(pm.month);
    assert.ok(m, `month ${pm.month} present`);
    eq(m.income, pm.income, `${pm.month} income`);
    eq(m.spend, pm.spend, `${pm.month} spend`);
    eq(m.net, pm.net, `${pm.month} net`);
    eq(m.loan_principal, pm.loan_principal, `${pm.month} loan_principal`);
    // Savings rates: the lib recomputes them at one decimal (r1); the
    // published files carry the same rates at two decimals.
    assert.equal(m.savings_rate, r1((100 * m.net) / m.income), `${pm.month} savings_rate is the r1 recomputation`);
    assert.ok(Math.abs(m.savings_rate - pm.savings_rate) <= 0.051, `${pm.month} savings_rate matches published ± rounding`);
    assert.equal(m.savings_rate_incl_retirement, r1((100 * (m.net + pm.deferrals_est)) / (m.income + pm.deferrals_est)), `${pm.month} incl-retirement rate is the r1 recomputation`);
    assert.ok(Math.abs(m.savings_rate_incl_retirement - pm.savings_rate_incl_retirement) <= 0.051, `${pm.month} incl-retirement rate matches published ± rounding`);
    assert.equal(m.partial, pm.partial, `${pm.month} partial`);
    // Last-year figures: the published briefing carries none; the live
    // layer computes them from the prior year's rows.
    if (pm.month.startsWith("2025")) {
      assert.equal(m.income_ly, null, `${pm.month} has no last-year income`);
      assert.equal(m.spend_ly, null, `${pm.month} has no last-year spend`);
    } else {
      const lyPub = publishedByMonth.get(`${Number(pm.month.slice(0, 4)) - 1}${pm.month.slice(4)}`);
      eq(m.income_ly, lyPub.income, `${pm.month} income_ly = published prior-year income`);
      eq(m.spend_ly, lyPub.expenses, `${pm.month} spend_ly = published prior-year spend`);
    }
  }
  // Demo year totals: 2026 ledger income is exactly $150,000 and the
  // live (net) 2026 spend equals the published monthly_cashflow spend.
  const live2026 = [...live.values()].filter((m) => m.month.startsWith("2026"));
  eq(live2026.reduce((s, m) => s + m.income, 0), 150000, "live 2026 income totals $150,000");
  eq(live2026.reduce((s, m) => s + m.spend, 0), 56352.4, "live 2026 spend (net of principal) totals $56,352.40");
  // Raw category totals stay gross: exactly the $2,700 of 2026 principal
  // above the net live total.
  const grossCategories = J("data/categories_2026.json").categories.reduce((s, c) => s + c.total, 0);
  eq(grossCategories, 59052.4, "categories_2026 raw (gross) total");
  eq(grossCategories - live2026.reduce((s, m) => s + m.spend, 0), 2700, "gross categories - net live spend = 9 x $300 principal");
  // Cash-flow series vs monthly_cashflow.json
  const series = liveCashflowSeries(rawRows, [], loanModel, publishedMonthly);
  assert.equal(series.length, publishedMonthly.length, "cashflow row count");
  for (const pub of publishedMonthly) {
    const row = series.find((r) => r.month === pub.month.slice(5) * 1 - 1 && r.year === Number(pub.month.slice(0, 4)));
    assert.ok(row, `cashflow row ${pub.month}`);
    eq(row.income, pub.income, `cashflow ${pub.month} income`);
    eq(row.expenses, pub.expenses, `cashflow ${pub.month} expenses`);
    eq(row.net, pub.net, `cashflow ${pub.month} net`);
    eq(row.loan_principal, pub.loan_principal, `cashflow ${pub.month} loan_principal`);
    assert.equal(row.savings_rate, r1((100 * row.net) / row.income), `cashflow ${pub.month} savings_rate is the r1 recomputation`);
    assert.ok(Math.abs(row.savings_rate - pub.savings_rate) <= 0.051, `cashflow ${pub.month} savings_rate matches published ± rounding`);
    assert.equal(row.deferrals_est, pub.deferrals_est, `cashflow ${pub.month} deferrals_est`);
    assert.equal(row.partial, pub.partial, `cashflow ${pub.month} partial`);
    assert.ok(row.short && row.long, `cashflow ${pub.month} labels`);
  }
  // Budget lines: published briefing lines carry the budgets.json caps
  // (demo budget_total $7,450/mo) with placeholder-zero actuals; the
  // live partition computes the real actuals, which sum to the month's
  // live net spend because the demo lines are a category partition.
  assert.ok(budgets.spend_lines.every((l) => l.match && l.match.category && !l.match.person), "demo budget lines match on category only (no person lines)");
  const lb = liveBriefing(rawRows, [], loanModel, publishedBriefing, budgets);
  for (const pm of publishedBriefing.months) {
    const lm = lb.months.find((x) => x.month === pm.month);
    assert.equal(lm.budget_total, 7450, `${pm.month} live budget_total is the demo $7,450`);
    assert.equal(pm.budget_total, 7450, `${pm.month} published budget_total is the demo $7,450`);
    assert.equal(lm.budget.length, pm.budget.length, `${pm.month} budget line count`);
    assert.equal(lm.budget.length, budgets.spend_lines.length, `${pm.month} live line count matches budgets.json`);
    for (const pl of pm.budget) {
      const ll = lm.budget.find((x) => x.id === pl.id);
      const bl = budgets.spend_lines.find((x) => x.id === pl.id);
      assert.ok(ll && bl, `${pm.month} line ${pl.id}`);
      assert.equal(pl.actual, 0, `${pm.month} published line ${pl.id} actual is the placeholder zero`);
      eq(ll.budget, bl.budget, `${pm.month} line ${pl.id} cap matches budgets.json`);
      eq(ll.delta, r2(ll.actual - ll.budget), `${pm.month} line ${pl.id} delta = actual - cap`);
      assert.ok(ll.actual >= 0, `${pm.month} line ${pl.id} live actual is nonnegative`);
    }
    eq(lm.budget.reduce((s, l) => s + l.actual, 0), live.get(pm.month).spend, `${pm.month} live budget lines sum to live net spend`);
  }
  console.log(`A. parity battery: ${publishedBriefing.months.length} months x (income/spend/net/principal to the cent; rates at lib rounding) + ${publishedMonthly.length} cashflow rows + all budget lines — live money == published`);
}

// ---------- B. current records: no unexplained deltas ----------
{
  assert.deepEqual(J("overrides.json"), {}, "demo overrides.json is empty — no override records ship");
  assert.equal(records.length, 0, "demo has zero override records");
  const targeted = new Set(records.filter((r) => r.target_type === "transaction").map((r) => r.target_key));
  const none = prepareLiveRows(rawRows, []);
  const withRecs = prepareLiveRows(rawRows, records);
  let changed = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const a = none[i], b = withRecs[i];
    const differs = a.isIncome !== b.isIncome || a.spend !== b.spend || a.lc !== b.lc
      || a.row.c !== b.row.c || a.row.sc !== b.row.sc || a.row.p !== b.row.p || a.row.g !== b.row.g;
    if (differs) {
      changed++;
      assert.ok(targeted.has(fingerprint(rawRows[i])), `row changed without a targeting record: ${fingerprint(rawRows[i])}`);
    }
  }
  assert.equal(changed, 0, "applying the demo's (empty) record set changes no rows");
  console.log(`B. current records (${records.length}): ${changed} rows changed — the demo record set is empty`);
}

// ---------- C. synthetic records move totals by exactly their effect ----------
{
  const T = (over) => ({ d: "2026-03-05", m: "4102", a: 0, n: "X", v: "X", c: "", p: "Joint", pc: "EXPENSE", ic: "", g: "", sc: "", desc: "", lc: "", ...over });
  const fixture = [
    T({ n: "Grocery Store", a: 100, c: "Groceries", g: "Food Expenses", sc: "Groceries", lc: "Groceries" }),
    T({ n: "Online Thing", a: 50, c: "Online Services", g: "Personal & Family", sc: "Online Services", lc: "Online Services", p: "Daniel" }),
    T({ n: "Payroll", a: -1000, c: "Employment", g: "Income", sc: "Salary", ic: "Salary", lc: "Income", pc: "INCOME" }),
    T({ n: "Payment to Streamleaf Plus", a: 12.95, c: "Subscriptions", g: "Personal & Family", sc: "Other", lc: "Subscriptions", p: "Daniel", m: "4102" }),
    T({ n: "Refunds from Streamleaf", a: -12.95, c: "Subscriptions", g: "Personal & Family", sc: "Other", lc: "Subscriptions" }),
  ];
  const pubMonths = [{ month: "2026-03", income: 0, spend: 0, net: 0, savings_rate: null, savings_rate_incl_retirement: null, deferrals_est: null, partial: false }];
  const monthOf = (rows, recs) => {
    const prepared = prepareLiveRows(rows, recs);
    return liveMonthly(prepared, loanPrincipal(prepared, null), pubMonths)[0];
  };
  const base = monthOf(fixture, []);
  eq(base.income, 1000, "fixture income");
  eq(base.spend, 150, "fixture spend"); // 100 + 50 + 12.95 - 12.95
  const rec = (t, field, value) => ({ target_type: "transaction", target_key: fingerprint(t), field, value, editor: "test", edited_at: "2026-10-19T00:00:00Z" });

  // C1: labelling the statement credit "Credit Card Rewards" moves nothing.
  const c1 = monthOf(fixture, [rec(fixture[4], "subcategory", "Credit Card Rewards")]);
  eq(c1.income, base.income, "C1 income unchanged by rewards label");
  eq(c1.spend, base.spend, "C1 spend unchanged by rewards label");

  // C2: a category record claims exactly the row amount for the target
  // line. The demo partition is category-only, and the fixture's
  // Online Services row is claimed by no line at baseline, so the
  // partition total rises by the row amount; month spend is unchanged.
  const lbBase = liveBriefing(fixture, [], null, { months: [{ ...pubMonths[0], budget: [], budget_total: 0, movers: [] }] }, budgets);
  const lbMoved = liveBriefing(fixture, [rec(fixture[1], "category", "Groceries")], null, { months: [{ ...pubMonths[0], budget: [], budget_total: 0, movers: [] }] }, budgets);
  const line = (lb, id) => lb.months[0].budget.find((l) => l.id === id).actual;
  const lineSum = (lb) => lb.months[0].budget.reduce((s, l) => s + l.actual, 0);
  eq(line(lbBase, "groceries"), 100, "C2 baseline groceries line holds only the grocery row");
  eq(line(lbMoved, "groceries") - line(lbBase, "groceries"), 50, "C2 groceries line +50");
  eq(lineSum(lbMoved) - lineSum(lbBase), 50, "C2 partition total +50 (the row was unclaimed at baseline)");
  eq(monthOf(fixture, [rec(fixture[1], "category", "Groceries")]).spend, base.spend, "C2 month spend unchanged");

  // C3: a person record retags exactly the targeted row. The demo
  // budget partition has no person lines, so no line and no month
  // total moves.
  const preparedPerson = prepareLiveRows(fixture, [rec(fixture[1], "person", "Joint")]);
  assert.equal(preparedPerson[1].row.p, "Joint", "C3 person record retags the targeted row");
  assert.equal(preparedPerson[0].row.p, "Joint", "C3 untargeted rows keep their person");
  const lbPerson = liveBriefing(fixture, [rec(fixture[1], "person", "Joint")], null, { months: [{ ...pubMonths[0], budget: [], budget_total: 0, movers: [] }] }, budgets);
  assert.deepEqual(lbPerson.months[0].budget, lbBase.months[0].budget, "C3 no budget line moves (demo lines are category-only)");
  eq(monthOf(fixture, [rec(fixture[1], "person", "Joint")]).spend, base.spend, "C3 month spend unchanged");
  eq(monthOf(fixture, [rec(fixture[1], "person", "Joint")]).income, base.income, "C3 month income unchanged");

  // C4: reclassifying an income row as spend moves both totals by its amount.
  const c4 = monthOf(fixture, [rec(fixture[2], "category", "Groceries")]);
  eq(c4.income, 0, "C4 income drops by the row amount");
  eq(c4.spend, base.spend - 1000, "C4 spend takes the (negative) row amount");
  console.log("C. synthetic records: label-only = no movement; category record claims exactly the row amount; person record retags only its row; income->spend reclass moves both totals exactly");
}

// ---------- D. Card Rewards: neither spend nor income at either layer ----------
{
  const { isSpend, EXCLUDED_SPEND } = await import("../lib/format.js");
  // The display-layer excluded set mirrors the pipeline's categorize.EXCLUDED.
  assert.deepEqual([...EXCLUDED_SPEND].sort(), ["Card Payments", "Card Rewards", "Income", "Transfers"], "EXCLUDED_SPEND mirrors pipeline categorize.EXCLUDED");
  const T = (over) => ({ d: "2026-03-05", m: "4102", a: 0, n: "X", v: "X", c: "", p: "Daniel", pc: "EXPENSE", ic: "", g: "", sc: "", desc: "", lc: "", ...over });
  const reward = T({ n: "Credit-Cash Back Reward", a: -16.13, c: "Card Rewards", g: "Card Rewards", lc: "Card Rewards" });
  assert.equal(isSpend(reward), false, "Card Rewards row is not spend at the display layer");
  // A display-layer spend sum (the Transactions explorer's filteredSpend
  // shape) ignores the row, and so do the live monthly totals — the row
  // moves neither spend nor income.
  const spendFixture = [T({ n: "Grocery Store", a: 100, c: "Groceries", g: "Food Expenses", sc: "Groceries", lc: "Groceries" }), reward];
  eq(spendFixture.filter(isSpend).reduce((s, t) => s + t.a, 0), 100, "D display spend sum ignores Card Rewards");
  const pubMonths = [{ month: "2026-03", income: 0, spend: 0, net: 0, savings_rate: null, savings_rate_incl_retirement: null, deferrals_est: null, partial: false }];
  const prepared = prepareLiveRows(spendFixture, []);
  assert.equal(prepared[1].spend, false, "D live row: Card Rewards not spend");
  assert.equal(prepared[1].isIncome, false, "D live row: Card Rewards not income");
  const m = liveMonthly(prepared, loanPrincipal(prepared, null), pubMonths)[0];
  eq(m.spend, 100, "D live monthly spend ignores Card Rewards");
  eq(m.income, 0, "D live monthly income ignores Card Rewards");
  // Demo data: the ledger contains no Card Rewards rows at all. The
  // excluded categories it does contain are never live spend, and only
  // Income rows are live income.
  const realPrepared = prepareLiveRows(rawRows, []);
  const counts = { Income: 0, Transfers: 0, "Card Payments": 0, "Card Rewards": 0 };
  for (let i = 0; i < rawRows.length; i++) {
    if (Object.hasOwn(counts, rawRows[i].lc)) {
      counts[rawRows[i].lc]++;
      assert.equal(realPrepared[i].spend, false, `D real row not live spend: ${rawRows[i].d} ${rawRows[i].n}`);
      assert.equal(isSpend(realPrepared[i].row), false, `D real row not display spend: ${rawRows[i].d} ${rawRows[i].n}`);
      assert.equal(realPrepared[i].isIncome, rawRows[i].lc === "Income", `D real row income classification: ${rawRows[i].d} ${rawRows[i].n}`);
    }
  }
  assert.deepEqual(counts, { Income: 88, Transfers: 87, "Card Payments": 84, "Card Rewards": 0 },
    "demo excluded-category row counts (no Card Rewards rows in the demo ledger)");
  console.log(`D. Card Rewards: EXCLUDED_SPEND mirrors the pipeline; fixture verified; demo ledger has 0 Card Rewards rows and ${counts.Income + counts.Transfers + counts["Card Payments"]} Income/Transfers/Card Payments rows, none of them spend at either layer`);
}

// ---------- E. Allowance rollover ledger ----------
// The demo data/allowance_ledger.json is an empty fixture: no people,
// no funded amounts, no entries. Pin that shape, and pin that the
// Budgets page only renders its rollover section when the ledger
// actually carries people — so on demo data the section stays hidden.
{
  const ledger = J("data/allowance_ledger.json");
  assert.deepEqual(ledger, { as_of: "2026-10-22", allowances: [], entries: [] }, "demo allowance ledger is the empty fixture");
  assert.equal(ledger.people, undefined, "E demo ledger has no people");
  assert.equal(ledger.totals, undefined, "E demo ledger has no totals");
  assert.equal(ledger.funded_per_month, undefined, "E demo ledger has no funded amounts");
  const pageSrc = readFileSync("app/(main)/budgets/page.js", "utf8");
  assert.ok(pageSrc.includes('data("allowance_ledger.json")'), "E Budgets page loads allowance_ledger.json");
  assert.ok(pageSrc.includes("ledgerPeople.length > 0"), "E Budgets page renders the rollover section only when the ledger has people");
  assert.ok(pageSrc.includes("current_balance"), "E rollover section headlines current_balance when it renders");
  assert.ok(pageSrc.includes("PERSON_COLORS"), "E Budgets page uses canonical person colors");
  console.log("E. allowance rollover: demo ledger is empty (no people, no entries); the Budgets page section is guarded on ledger people and stays hidden");
}

console.log("live-aggregates checks: ALL PASS");
