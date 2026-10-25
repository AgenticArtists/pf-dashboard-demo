// Live money aggregates from transaction rows + override records.
//
// (ported design, 2026-10-19): every aggregate that can be derived from
// the transaction rows is computed here at render, through the SAME override
// merge the Transactions explorer uses (applyRecordsToTxns in
// lib/overrides.js) — no second merge. Before this module, the Cash flow
// page, the home cash-flow card and the Monthly briefing read totals baked
// into web/data at the morning publish, so a retag on the site disagreed
// with those pages until the next day's refresh.
//
// The computations reproduce the daily pipeline's published aggregates
// (build_insights.py in the pf pipeline) from row fields:
// - A row's LEDGER category is its payload `lc` (the pipeline's
//   category_final, emitted by gen_site_data.py), not its display category
//   `c`: gen files auto-loan and parking rows under "Automotive Expenses"
//   for display, and a refund the pipeline moved out of Income keeps
//   display group "Income" while its ledger category is a spend category.
//   When a category override record targets a row, the live row's category
//   governs instead (that is the edit taking effect).
// - Income(month) = Σ −amount over ledger-income rows with amount < 0.
//   Spend(month) = Σ (amount − allocated loan principal) over spend rows
//   (ledger category not in the pipeline's NON_SPEND set {Income, Transfers,
//   Card Payments, Card Rewards}, amount ≠ 0). "Card Rewards" rows — generic
//   cash-back credits the pipeline parks — count as neither income nor spend.
// - Loan principal: the demo's Riverbend Auto Finance loan model. Each
//   qualifying payment carries a fixed stated principal portion
//   (data/loan.json principal_portion), published in data/loan_model.json
//   as principal_per_payment. Qualifying payments: mask and payment name
//   from data/loan_model.json, ledger category "Loans", amount ≥ $10, in
//   2026. Each month's principal is principal_per_payment × the number of
//   qualifying payments that month, capped at that month's total
//   qualifying payments amount, and is spread across that month's
//   qualifying payments pro-rata by amount.
// - deferrals_est and partial are NOT derivable from rows (deferrals are
//   payroll-check counts × static anchors; partial is calendar state), so
//   they are carried from the published monthly_cashflow.json rows and the
//   incl.-retirement savings rate is recomputed from the live income/spend
//   plus the carried deferrals with the pipeline's formula.
// Parity with the published aggregates is pinned by
// scripts/live-aggregates-checks.mjs.
import { applyRecordsToTxns, fingerprint } from "./overrides.js";
import { matches } from "./budget-match.js";

export const r2 = (x) => { const v = Math.round(x * 100) / 100; return v === 0 ? 0 : v; };
export const r1 = (x) => { const v = Math.round(x * 10) / 10; return v === 0 ? 0 : v; };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const NON_SPEND_LEDGER = new Set(["Income", "Transfers", "Card Payments", "Card Rewards"]);

// Fingerprints of rows a category override record targets.
export function categoryOverrideFps(records) {
  const s = new Set();
  for (const r of records || []) if (r.target_type === "transaction" && r.field === "category") s.add(r.target_key);
  return s;
}

// Align payload rows with their live (override-applied) counterparts and
// precompute each row's ledger category + income/spend classification.
export function prepareLiveRows(rawRows, records) {
  const live = applyRecordsToTxns(rawRows, records);
  const catFps = categoryOverrideFps(records);
  return rawRows.map((orig, i) => {
    const row = live[i];
    const hasCat = catFps.has(fingerprint(orig));
    // Ledger category: the category override's outcome when one targets the
    // row, else the payload's lc (falling back to the display category for
    // payloads published before lc existed).
    const lc = hasCat
      ? (row.g === "Automotive Expenses" && row.sc === "Loans" ? "Loans" : row.c)
      : (orig.lc ?? orig.c);
    const isIncome = hasCat ? row.g === "Income" : (orig.lc ? orig.lc === "Income" : orig.g === "Income");
    // Spend keys off the ledger category too: the pipeline's NON_SPEND set
    // includes "Card Rewards" (generic cash-back credits are parked there —
    // neither income nor spend); the display-layer isSpend excludes it via
    // EXCLUDED_SPEND in lib/format.js, which mirrors the same set.
    const spend = !isIncome && !NON_SPEND_LEDGER.has(lc) && row.a !== 0;
    return { orig, row, lc, isIncome, spend };
  });
}

// Demo loan model: a fixed stated principal portion per qualifying
// Riverbend payment, as published in data/loan_model.json. Returns
// { principalByMonth, allocByKey } where allocByKey maps
// `${date}|${mask}|${name}` to the principal dollars netted out of that
// row's spend amount (dict semantics: last wins).
export function loanPrincipal(prepared, loanModel) {
  const principalByMonth = new Map();
  const allocByKey = new Map();
  if (!loanModel || !loanModel.principal_per_payment) return { principalByMonth, allocByKey };
  const payments = new Map();
  const counts = new Map();
  const qualifying = [];
  const targetName = String(loanModel.payment_name || "").toLowerCase();
  for (const p of prepared) {
    const t = p.row;
    if (t.m === loanModel.payment_mask && p.lc === "Loans" && targetName && (t.n || "").toLowerCase().includes(targetName) && t.a >= 10 && t.d.startsWith("2026-")) {
      const mo = t.d.slice(0, 7);
      payments.set(mo, (payments.get(mo) || 0) + t.a);
      counts.set(mo, (counts.get(mo) || 0) + 1);
      qualifying.push(p);
    }
  }
  if (!qualifying.length) return { principalByMonth, allocByKey };
  for (const [mo, total] of payments) {
    principalByMonth.set(mo, r2(Math.min(loanModel.principal_per_payment * (counts.get(mo) || 0), total)));
  }
  for (const p of qualifying) {
    const mo = p.row.d.slice(0, 7);
    const principal = principalByMonth.get(mo);
    if (principal == null) continue;
    allocByKey.set(`${p.row.d}|${p.row.m}|${p.row.n}`, (principal * p.row.a) / (payments.get(mo) || 1));
  }
  return { principalByMonth, allocByKey };
}

const allocOf = (allocByKey, t) => allocByKey.get(`${t.d}|${t.m}|${t.n}`) || 0;

// Monthly income/spend/net + loan principal + last-year figures, one entry
// per month present in the published cash-flow rows (the published rows also
// carry the per-month deferrals_est / partial this module cannot derive).
export function liveMonthly(prepared, loan, publishedMonthly) {
  const byMonth = new Map();
  const ensure = (mo) => {
    if (!byMonth.has(mo)) byMonth.set(mo, { month: mo, income: 0, spend: 0, loan_principal: 0 });
    return byMonth.get(mo);
  };
  for (const p of prepared) {
    const mo = p.row.d.slice(0, 7);
    if (p.isIncome && p.row.a < 0) ensure(mo).income += -p.row.a;
    else if (p.spend) ensure(mo).spend += p.row.a - allocOf(loan.allocByKey, p.row);
  }
  for (const [mo, principal] of loan.principalByMonth) if (byMonth.has(mo)) byMonth.get(mo).loan_principal = principal;
  const published = new Map((publishedMonthly || []).map((r) => [r.month, r]));
  const out = [];
  for (const mo of [...published.keys()].sort()) {
    const live = byMonth.get(mo) || { income: 0, spend: 0, loan_principal: 0 };
    const pub = published.get(mo);
    const income = r2(live.income);
    const spend = r2(live.spend);
    const net = r2(income - spend);
    const lyMo = `${Number(mo.slice(0, 4)) - 1}${mo.slice(4)}`;
    const ly = byMonth.get(lyMo);
    out.push({
      month: mo,
      income,
      spend,
      net,
      loan_principal: live.loan_principal || 0,
      savings_rate: income ? r1((100 * net) / income) : null,
      savings_rate_incl_retirement: pub.deferrals_est != null && income ? r1((100 * (net + pub.deferrals_est)) / (income + pub.deferrals_est)) : pub.savings_rate_incl_retirement,
      deferrals_est: pub.deferrals_est,
      partial: !!pub.partial,
      income_ly: ly ? r2(ly.income) : null,
      spend_ly: ly ? r2(ly.spend) : null,
    });
  }
  return out;
}

// Rows in the exact post-map shape of insights.cashflowSeries(), computed
// live. `publishedMonthly` is data/monthly_cashflow.json (deferrals/partial
// carrier); `loanModel` is data/loan_model.json.
export function liveCashflowSeries(rawRows, records, loanModel, publishedMonthly) {
  const prepared = prepareLiveRows(rawRows, records);
  const loan = loanPrincipal(prepared, loanModel);
  return liveMonthly(prepared, loan, publishedMonthly).map((m) => {
    const [y, mm] = m.month.split("-").map(Number);
    return {
      period: `${MONTH_SHORT[mm - 1]}-${String(y).slice(2)}`,
      month: m.month,
      income: m.income,
      expenses: m.spend,
      net: m.net,
      savings_rate: m.savings_rate,
      savings_rate_incl_retirement: m.savings_rate_incl_retirement,
      deferrals_est: m.deferrals_est,
      partial: m.partial,
      loan_principal: m.loan_principal,
      transfers: 0,
      year: y,
      month: mm - 1,
      short: `${MONTH_SHORT[mm - 1]} ${String(y).slice(2)}`,
      long: `${MONTH_NAMES[mm - 1]} ${y}`,
    };
  }).sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

// The briefing object with every derivable field computed live: month
// income/spend/net/rates/LY figures, loan principal, and the budget-line
// partition. Movers, net worth and the header date stay published (they are
// not transaction-row aggregates: movers are a ranked prose exhibit and net
// worth comes from account balances).
export function liveBriefing(rawRows, records, loanModel, publishedBriefing, budgets) {
  const prepared = prepareLiveRows(rawRows, records);
  const loan = loanPrincipal(prepared, loanModel);
  const monthly = liveMonthly(prepared, loan, (publishedBriefing.months || []).map((m) => ({
    month: m.month, deferrals_est: m.deferrals_est, partial: m.partial,
    savings_rate_incl_retirement: m.savings_rate_incl_retirement,
  })));
  const liveByMonth = new Map(monthly.map((m) => [m.month, m]));
  // Budget partition: the pipeline evaluates each line's match on the
  // LEDGER category; first matching line in file order claims the row's
  // principal-adjusted spend amount.
  const linesByMonth = new Map();
  if (budgets && Array.isArray(budgets.spend_lines)) {
    for (const p of prepared) {
      if (!p.spend) continue;
      const mo = p.row.d.slice(0, 7);
      if (!linesByMonth.has(mo)) linesByMonth.set(mo, new Map(budgets.spend_lines.map((l) => [l.id, 0])));
      const sums = linesByMonth.get(mo);
      const matchRow = { ...p.row, c: p.lc };
      for (const line of budgets.spend_lines) {
        if (matches(matchRow, line.match)) { sums.set(line.id, sums.get(line.id) + (p.row.a - allocOf(loan.allocByKey, p.row))); break; }
      }
    }
  }
  const months = (publishedBriefing.months || []).map((pm) => {
    const live = liveByMonth.get(pm.month);
    if (!live) return pm;
    const sums = linesByMonth.get(pm.month);
    const budget = sums && budgets
      ? budgets.spend_lines.map((l) => { const amount = l.budget ?? l.monthly; const actual = r2(sums.get(l.id) || 0); return { id: l.id, label: l.label, budget: amount, actual, delta: r2(actual - amount) }; })
      : pm.budget;
    return {
      ...pm,
      income: live.income,
      spend: live.spend,
      net: live.net,
      loan_principal: live.loan_principal,
      savings_rate: live.savings_rate,
      savings_rate_incl_retirement: live.savings_rate_incl_retirement,
      income_ly: live.income_ly,
      spend_ly: live.spend_ly,
      partial: live.partial,
      budget,
      budget_total: budgets ? budgets.spend_lines.reduce((s, l) => s + (l.budget ?? l.monthly), 0) : pm.budget_total,
    };
  });
  return { ...publishedBriefing, months };
}
