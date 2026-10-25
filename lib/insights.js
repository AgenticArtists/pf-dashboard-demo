import { data, num } from "./data";
import { matches } from "./budget-match";
import { isSpend } from "./format";

const r2 = (x) => Math.round(x * 100) / 100;
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_IDX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// monthly_cashflow.json in calendar order, with display labels.
export function cashflowSeries() {
  return [...data("monthly_cashflow.json")]
    .map((r) => {
      const [mon, yy] = String(r.period).split("-");
      return { ...r, income: num(r.income), expenses: num(r.expenses), net: num(r.net), transfers: num(r.transfers), year: 2000 + Number(yy), month: MONTH_IDX[mon], short: `${mon} ${yy}`, long: `${MONTH_NAMES[MONTH_IDX[mon]]} 20${yy}` };
    })
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

// Monarch-style account types, inferred from institution + name.
const TYPES = {
  cash: { label: "Cash", icon: "cash", tone: "cash", order: 1 },
  invest: { label: "Investments", icon: "investments", tone: "invest", order: 2 },
  retire: { label: "Retirement", icon: "retirement", tone: "retire", order: 3 },
  vehicle: { label: "Vehicles", icon: "car", tone: "asset", order: 4 },
  other: { label: "Other assets", icon: "box", tone: "asset", order: 5 },
  card: { label: "Credit cards", icon: "card", tone: "card", order: 6 },
  loan: { label: "Loans", icon: "loan", tone: "loan", order: 7 },
};
export function accountType(a) {
  const name = `${a.institution} ${a.name}`;
  if (a.kind === "liability") return /loan/i.test(name) ? "loan" : "card";
  if (/vehicle/i.test(name)) return "vehicle";
  if (/electronics|furniture|equipment|reformer/i.test(a.name)) return "other";
  if (/401\(k\)|403\(b\)|\bira\b|roth|cash balance plan|retirement/i.test(name)) return "retire";
  if (/checking|savings|banking|\baaa\b|money market|closed/i.test(a.name) && !/summit|hsa/i.test(name)) return "cash";
  return "invest";
}
export const accountTypeInfo = (t) => TYPES[t];

export function groupedAccounts(accounts) {
  // Display value: an asset carrying a linked loan displays at its
  // equity — market value minus the loan — so group totals match the rows.
  const dispVal = (a) => (a.loan_balance != null ? num(a.equity) : num(a.dashboard_value));
  const groups = new Map();
  for (const a of accounts) {
    const t = accountType(a);
    if (!groups.has(t)) groups.set(t, { type: t, ...TYPES[t], accounts: [], total: 0, liability: a.kind === "liability" });
    const g = groups.get(t);
    g.accounts.push(a);
    g.total += dispVal(a);
  }
  for (const g of groups.values()) g.accounts.sort((x, y) => dispVal(y) - dispVal(x));
  return [...groups.values()].sort((x, y) => x.order - y.order);
}

export function computeBudget(txns, budgets) {
  const month = txns.reduce((mx, t) => (t.d.slice(0, 7) > mx ? t.d.slice(0, 7) : mx), "");
  const asOf = txns.reduce((mx, t) => (t.d > mx ? t.d : mx), "");
  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const asOfDay = Number(asOf.slice(8, 10)) || daysInMonth;
  const elapsed = Math.min(asOfDay / daysInMonth, 1);
  const inMonth = (t) => t.d.startsWith(month);

  const incomeRows = txns.filter((t) => t.g === "Income" && inMonth(t));
  const incomeLines = (budgets.income_lines || []).map((line) => ({
    ...line,
    actual: r2(incomeRows.filter((t) => matches(t, line.match)).reduce((s, t) => s - t.a, 0)),
  }));
  const spendRows = txns.filter((t) => isSpend(t) && inMonth(t));
  const claimed = new Set();
  const spendLines = (budgets.spend_lines || []).map((line) => {
    let actual = 0;
    spendRows.forEach((t, i) => {
      if (claimed.has(i) || !matches(t, line.match)) return;
      claimed.add(i);
      actual += t.a;
    });
    return { ...line, actual: r2(actual) };
  });
  const inActual = r2(incomeLines.reduce((s, l) => s + l.actual, 0));
  const inBudget = (budgets.income_lines || []).reduce((s, l) => s + l.budget, 0);
  const outActual = r2(spendLines.reduce((s, l) => s + l.actual, 0));
  const outBudget = (budgets.spend_lines || []).reduce((s, l) => s + l.budget, 0);
  return { month, asOf, yy, mm, daysInMonth, asOfDay, elapsed, incomeLines, spendLines, inActual, inBudget, outActual, outBudget, saved: r2(inActual - outActual) };
}

// Pace status for a spend line: ratio of budget used vs share of month gone.
export function paceStatus(actual, budget, elapsed) {
  if (!budget) return actual > 0 ? "over" : "ok";
  const ratio = actual / budget;
  if (ratio > 1) return "over";
  if (ratio > elapsed + 0.05) return "ahead";
  return "ok";
}

// Cumulative daily spend for the latest month and the month before it.
export function monthToDateSpend(txns) {
  const spend = txns.filter(isSpend);
  const latest = spend.reduce((mx, t) => (t.d > mx ? t.d : mx), "");
  if (!latest) return null;
  const [y, m] = latest.slice(0, 7).split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const cur = latest.slice(0, 7);
  const days = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
  const cumulative = (key, upto) => {
    const daily = new Array(upto).fill(0);
    for (const t of spend) if (t.d.startsWith(key)) { const d = Number(t.d.slice(8, 10)); if (d <= upto) daily[d - 1] += t.a; }
    let run = 0;
    return daily.map((v) => (run = r2(run + v)));
  };
  const today = Number(latest.slice(8, 10));
  const current = cumulative(cur, today);
  const previous = cumulative(prev, days(prev));
  const sameDayPrev = previous[Math.min(today, previous.length) - 1] || 0;
  return {
    current, previous, today, latest,
    curLabel: MONTH_NAMES[m - 1], prevLabel: MONTH_NAMES[(m + 10) % 12],
    total: current[current.length - 1] || 0, sameDayPrev, prevTotal: previous[previous.length - 1] || 0,
    daysInMonth: days(cur), monthShort: MONTH_NAMES[m - 1].slice(0, 3),
  };
}
