import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const AS_OF = "2026-10-22";
const PEOPLE = ["Daniel", "Maya", "Joint"];
const cents = (n) => Math.round(n * 100) / 100;

// A tiny deterministic PRNG keeps the demo varied without ever depending on
// the clock, process id, or an external service.
let seed = 0xcafefa;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const jitter = (amount, spread = 0.06) => cents(amount * (1 + (random() * 2 - 1) * spread));
const iso = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const months = [];
for (let year = 2025; year <= 2026; year += 1) {
  const last = year === 2026 ? 10 : 12;
  for (let month = 1; month <= last; month += 1) months.push(`${year}-${String(month).padStart(2, "0")}`);
}
const inRange = (date) => date <= AS_OF;

const accounts = [
  { id: "joint-checking", kind: "asset", institution: "Cedar Bank", name: "Joint Checking", mask: "4102", owner: "Joint", opening: 9500 },
  { id: "daniel-checking", kind: "asset", institution: "Cedar Bank", name: "Daniel Checking", mask: "7734", owner: "Daniel", opening: 1800 },
  { id: "maya-checking", kind: "asset", institution: "Bluebonnet Credit Union", name: "Maya Checking", mask: "2946", owner: "Maya", opening: 2200 },
  { id: "savings", kind: "asset", institution: "Cedar Bank", name: "Rainy Day Savings", mask: "8251", owner: "Joint", opening: 18000 },
  { id: "brokerage", kind: "asset", institution: "Summit Investments", name: "Joint Brokerage", mask: "", owner: "Joint", opening: 28000 },
  { id: "daniel-401k", kind: "asset", institution: "Northstar Benefits", name: "Daniel 401(k)", mask: "", owner: "Daniel", opening: 65000 },
  { id: "maya-401k", kind: "asset", institution: "Brightline Benefits", name: "Maya 401(k)", mask: "", owner: "Maya", opening: 42000 },
  { id: "ira", kind: "asset", institution: "Summit Investments", name: "Carter Roth IRA", mask: "", owner: "Joint", opening: 18000 },
  { id: "hsa", kind: "asset", institution: "Northstar Benefits", name: "Family HSA", mask: "", owner: "Joint", opening: 6200 },
  { id: "card-a", kind: "liability", institution: "Bluebonnet Credit Union", name: "Bluebonnet Rewards Card", mask: "5183", owner: "Joint", opening: 350 },
  { id: "card-b", kind: "liability", institution: "Cedar Bank", name: "Cedar Cash Card", mask: "7264", owner: "Daniel", opening: 120 },
  { id: "auto-loan", kind: "liability", institution: "Riverbend Auto Finance", name: "Riverbend Auto Loan", mask: "8842", owner: "Joint", opening: 9200 },
];
const byMask = Object.fromEntries(accounts.filter((a) => a.mask).map((a) => [a.mask, a]));
const transactions = { 2025: [], 2026: [] };
const payroll = { 2025: [], 2026: [] };
// Pay-stub texture: the ledger deposit is the stub's NET. Each earner's gross,
// pre-tax deductions and taxes are fixed per check and sum exactly to that
// net (Daniel: 6100.00 - 796.69 - 1103.31 = 4200.00; Maya: 4250.00 - 297.50
// - 652.50 = 3300.00). Daniel's per-pay benefits elections (308.69) are the
// elections listed in benefits.json; the family elections ride his check.
// Federal withholding per check x 24 checks is the tax projection's fed_wh.
const STUB_SPEC = {
  Daniel: { gross: 6100.00, pre_tax_401k: 488.00, pre_tax_benefits: 308.69, fed_tax: 660.27, fica_tax: 443.04 },
  Maya: { gross: 4250.00, pre_tax_401k: 297.50, pre_tax_benefits: 0, fed_tax: 327.37, fica_tax: 325.13 },
};
const add = (date, amount, name, category, subcategory, person, mask, extras = {}) => {
  if (!inRange(date)) return;
  const income = category === "Income";
  const row = {
    d: date, a: cents(amount), n: name, v: extras.vendor || name, dn: extras.displayName || extras.vendor || name,
    c: income ? (extras.incomeCategory || "Employment") : category,
    g: income ? "Income" : (extras.group || (category === "Loans" ? "Automotive Expenses" : "Personal & Family")),
    sc: subcategory, lc: income ? "Income" : (extras.ledgerCategory || category), ic: income ? (extras.incomeCategory || "Salary") : "",
    p: person, m: mask, ct: extras.essential === false ? "Discretionary" : "Essential",
    pr: extras.program || "",
  };
  transactions[Number(date.slice(0, 4))].push(row);
  if (income && /PAYROLL/.test(name)) {
    const spec = STUB_SPEC[person];
    payroll[Number(date.slice(0, 4))].push({
      date, person, amount: cents(-amount), employer: extras.employer,
      gross: spec.gross,
      pre_tax_total: cents(spec.pre_tax_401k + spec.pre_tax_benefits),
      taxes_total: cents(spec.fed_tax + spec.fica_tax),
      fed_tax: spec.fed_tax, fica_tax: spec.fica_tax,
    });
  }
};

for (const period of months) {
  const [year, month] = period.split("-").map(Number);
  const date = (day) => iso(year, month, day);
  for (const [day, person, amount, employer, mask] of [[5, "Daniel", -4200, "Northstar Systems", "7734"], [20, "Daniel", -4200, "Northstar Systems", "7734"], [5, "Maya", -3300, "Brightline Studio", "2946"], [20, "Maya", -3300, "Brightline Studio", "2946"]]) {
    if (inRange(date(day))) add(date(day), amount, `${employer} PAYROLL`, "Income", "Salary", person, mask, { incomeCategory: "Salary", employer });
  }
  const recurring = [
    [1, 2800, "Cedar Grove Rent", "Home Expenses", "Rent", "Joint", "4102", { essential: true }],
    [3, jitter(1250), "Little Oak Learning Center", "Child/Dependent Expenses", "Childcare", "Joint", "4102", { essential: true }],
    [7, jitter(214), "Austin Electric Cooperative", "Home Expenses", "Utilities", "Joint", "4102", { essential: true }],
    [11, jitter(118), "BrightCell Mobile", "Home Expenses", "Telephone Services", "Joint", "4102", { essential: true }],
    [16, jitter(186), "Bluebonnet Auto Cover", "Insurance", "Insurance", "Joint", "4102", { essential: true }],
    [18, 24.99, "Streamleaf", "Subscriptions", "Streaming", "Maya", "5183", { essential: false, program: "streamleaf" }],
    [22, 18.99, "Cloudnest", "Subscriptions", "Online Services", "Daniel", "7264", { essential: false, program: "cloudnest" }],
    [25, jitter(510), "Riverbend Auto Loan Payment", "Loans", "Loans", "Joint", "4102", { group: "Automotive Expenses", ledgerCategory: "Loans", essential: true }],
  ];
  for (const [day, amount, name, category, sub, person, mask, extras] of recurring) add(date(day), amount, name, category, sub, person, mask, extras);
  // The checking-ledger payment and the liability-ledger principal row keep
  // the synthetic auto-loan balance tied to its transaction history.
  add(date(25), -300, "Riverbend Auto Loan Principal", "Transfers", "", "Joint", "8842", { group: "Transfers", ledgerCategory: "Transfers", essential: true });
  // Household transfers fund the joint spending account from each paycheck
  // account. They are excluded from income and spending aggregates.
  add(date(2), -6500, "Transfer from personal accounts", "Transfers", "", "Joint", "4102", { group: "Transfers", ledgerCategory: "Transfers" });
  add(date(2), 3800, "Transfer to joint checking", "Transfers", "", "Daniel", "7734", { group: "Transfers", ledgerCategory: "Transfers" });
  add(date(2), 2700, "Transfer to joint checking", "Transfers", "", "Maya", "2946", { group: "Transfers", ledgerCategory: "Transfers" });
  for (const [day, amount, name, category, sub, person, mask, extras] of [
    [9, jitter(235), "Harvest Moon Market", "Groceries", "Groceries", "Joint", "5183", { essential: true }],
    [23, jitter(245), "Harvest Moon Market", "Groceries", "Groceries", "Joint", "5183", { essential: true }],
    [12, jitter(92), "Juniper Table", "Restaurants/Dining", "Restaurants", "Maya", "7264", { essential: false }],
    [26, jitter(76), "Juniper Table", "Restaurants/Dining", "Restaurants", "Daniel", "7264", { essential: false }],
    [14, jitter(72), "Hill Country Fuel", "Automotive Expenses", "Gasoline/Fuel/Charging", "Daniel", "7264", { essential: true }],
    [28, jitter(68), "Hill Country Fuel", "Automotive Expenses", "Gasoline/Fuel/Charging", "Daniel", "7264", { essential: true }],
    [15, jitter(54), "Clover Pharmacy", "Healthcare/Medical", "Pharmacy", "Maya", "5183", { essential: true, group: "Healthcare" }],
    [6, jitter(48), "Paper Kite Books", "Child/Dependent Expenses", "Books/Toys/Gifts", "Joint", "5183", { essential: false }],
  ]) add(date(day), amount, name, category, sub, person, mask, extras);
  // Card payments are paired in the checking and card ledgers so card
  // liabilities reconcile without affecting spending totals.
  for (const [mask, amount, name] of [["5183", 400, "Bluebonnet card payment"], ["7264", 300, "Cedar card payment"]]) {
    add(date(27), amount, name, "Card Payments", "", "Joint", "4102", { group: "Card Payments", ledgerCategory: "Card Payments", essential: true });
    add(date(27), -amount, name, "Card Payments", "", "Joint", mask, { group: "Card Payments", ledgerCategory: "Card Payments", essential: true });
  }
}

for (const year of [2025, 2026]) transactions[year].sort((a, b) => a.d.localeCompare(b.d) || a.n.localeCompare(b.n));

const balances = Object.fromEntries(accounts.map((a) => [a.id, a.opening]));
for (const year of [2025, 2026]) for (const t of transactions[year]) {
  const account = Object.values(byMask).find((a) => a.mask === t.m);
  if (!account) continue;
  balances[account.id] = cents(balances[account.id] + (account.kind === "asset" ? -t.a : t.a));
}
for (const a of accounts) {
  a.dashboard_value = cents(Math.max(0, balances[a.id]));
  a.source_of_truth = "demo_snapshot";
  a.last_verified = AS_OF;
  if (a.id === "auto-loan") a.collateral = "Fictional compact SUV";
}

const assets = accounts.filter((a) => a.kind === "asset").reduce((s, a) => s + a.dashboard_value, 0);
const liabilities = accounts.filter((a) => a.kind === "liability").reduce((s, a) => s + a.dashboard_value, 0);
const netWorth = cents(assets - liabilities);
const investmentAccounts = accounts.filter((a) => ["brokerage", "daniel-401k", "maya-401k", "ira", "hsa"].includes(a.id));
const investable = cents(investmentAccounts.reduce((s, a) => s + a.dashboard_value, 0));
const balanceAttribution = { assets: {}, liabilities: {}, net: {} };
for (const person of PEOPLE) {
  balanceAttribution.assets[person] = cents(accounts.filter((a) => a.kind === "asset" && a.owner === person).reduce((s, a) => s + a.dashboard_value, 0));
  balanceAttribution.liabilities[person] = cents(accounts.filter((a) => a.kind === "liability" && a.owner === person).reduce((s, a) => s + a.dashboard_value, 0));
  balanceAttribution.net[person] = cents(balanceAttribution.assets[person] - balanceAttribution.liabilities[person]);
}

// Loan principal: the demo loan (Riverbend Auto Finance) carries a stated
// principal portion of $300 per $510 payment (see loan.json/loan_model.json).
// Spend aggregates net that principal out (it is equity, not spending) for
// 2026 months, matching lib/live-aggregates.js loanPrincipal().
const LOAN_PRINCIPAL_PER_PAYMENT = 300;
const monthly = months.map((month) => {
  const rows = [...transactions[2025], ...transactions[2026]].filter((t) => t.d.startsWith(month));
  const income = cents(rows.filter((t) => t.g === "Income").reduce((s, t) => s - t.a, 0));
  const grossExpenses = cents(rows.filter((t) => t.g !== "Income" && !["Transfers", "Card Payments", "Card Rewards"].includes(t.lc)).reduce((s, t) => s + t.a, 0));
  const loanPrincipal = month.startsWith("2026-") ? LOAN_PRINCIPAL_PER_PAYMENT * rows.filter((t) => t.n === "Riverbend Auto Loan Payment" && t.lc === "Loans").length : 0;
  const expenses = cents(grossExpenses - loanPrincipal);
  const partial = month === "2026-10";
  return { month, period: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month.slice(5)) - 1]}-${month.slice(2, 4)}`, income, expenses, spend: expenses, net: cents(income - expenses), transfers: 0, deferrals_est: 1250, savings_rate: income ? cents(((income - expenses) / income) * 100) : 0, savings_rate_incl_retirement: income ? cents(((income - expenses + 1250) / (income + 1250)) * 100) : 0, partial, loan_principal: loanPrincipal };
});

const categories = ["Home Expenses", "Child/Dependent Expenses", "Groceries", "Restaurants/Dining", "Automotive Expenses", "Healthcare/Medical", "Insurance", "Subscriptions", "Loans", "Card Payments"];
const budgets = {
  income_lines: [{ id: "salary", label: "Salary", budget: 15000, match: { group: "Income" } }],
  spend_lines: categories.map((category) => ({ id: category.toLowerCase().replace(/[^a-z]+/g, "-"), label: category, budget: { "Home Expenses": 3250, "Child/Dependent Expenses": 1300, Groceries: 750, "Restaurants/Dining": 350, "Automotive Expenses": 700, "Healthcare/Medical": 180, Insurance: 200, Subscriptions: 100, Loans: 520, "Card Payments": 0 }[category] || 100, match: { category } })),
};

const positions = [
  { symbol: "CARTERX", name: "Carter Broad Market Index", asset_class: "us_equity", value: 49000 },
  { symbol: "CARTERB", name: "Carter Core Bond Index", asset_class: "bonds", value: 30000 },
  { symbol: "CARTERI", name: "Carter International Index", asset_class: "intl_equity", value: 26000 },
  { symbol: "CARTERC", name: "Carter Treasury Reserve", asset_class: "cash", value: 54200 },
];
const portfolio = {
  total_investable: investable, mapped_total: investable, unmapped_total: 0, coverage_pct: 100, positions_as_of: AS_OF,
  allocation: { dollars: { us_equity: 49000, intl_equity: 26000, bonds: 30000, cash: 54200, other: 0 }, pct: { us_equity: 30.78, intl_equity: 16.33, bonds: 18.84, cash: 34.05, other: 0 }, labels: { us_equity: "US equity", intl_equity: "International equity", bonds: "Bonds", cash: "Cash" } },
  target: { status: "Demo target", classes_pct: { us_equity: 45, intl_equity: 20, bonds: 25, cash: 10 }, rationale: "Fictional balanced target for the Carter household demo." },
  us_equity_bounds_pct: [30, 55], ideas_as_of: AS_OF,
  reserves: { total: 31500, bank_cash: 31500, money_market_swvxx: 0, floor_low: 24000, floor_high: 42000, meets_floor: true },
  drift: [
    { class: "us_equity", label: "US equity", current_pct: 30.78, target_pct: 45, drift_pts: -14.22, flag: true },
    { class: "intl_equity", label: "International equity", current_pct: 16.33, target_pct: 20, drift_pts: -3.67, flag: false },
    { class: "bonds", label: "Bonds", current_pct: 18.84, target_pct: 25, drift_pts: -6.16, flag: false },
    { class: "cash", label: "Cash", current_pct: 34.05, target_pct: 10, drift_pts: 24.05, flag: true },
  ],
  summit_plan: [
    { class: "us_equity", label: "US equity", vehicle: "Carter Broad Market Index", vehicle_name: "Carter Broad Market Index (CARTERX)", action: "buy", current: 49000, target: 71640, delta: 22640, weight_pct: 30.78, current_pct: 30.78, target_pct: 45, note: "Largest single drift in the demo portfolio: 14.2 points under target.", tax: { kind: "none", note: "Buys realize no tax." } },
    { class: "intl_equity", label: "International equity", vehicle: "Carter International Index", vehicle_name: "Carter International Index (CARTERI)", action: "buy", current: 26000, target: 31840, delta: 5840, weight_pct: 16.33, current_pct: 16.33, target_pct: 20, note: "Mildly under target; the same contribution stream fills it after US equity.", tax: { kind: "none", note: "Buys realize no tax." } },
    { class: "bonds", label: "Bonds", vehicle: "Carter Core Bond Index", vehicle_name: "Carter Core Bond Index (CARTERB)", action: "hold", current: 30000, target: 39800, delta: 0, weight_pct: 18.84, current_pct: 18.84, target_pct: 25, note: "Hold — the gap to target closes through later contribution stages, not a sale.", tax: { kind: "none", note: "No sale, so no tax." } },
    { class: "cash", label: "Cash", vehicle: "Carter Treasury Reserve", vehicle_name: "Carter Treasury Reserve (CARTERC)", action: "trim", current: 54200, target: 15920, delta: -38280, weight_pct: 34.05, current_pct: 34.05, target_pct: 10, note: "The trim funds the equity buys; the $24,000–$42,000 reserve floor stays intact.", tax: { kind: "none", note: "Treasury reserve sales realize no material gain in this demo." }, sol_tax_commentary: "Synthetic desk view: this trim comes out of a Treasury reserve, so there is no meaningful gain to tax in the demo figures — the move is tax-free for practical purposes." },
  ],
  ideas: [
    { id: "demo-us-equity", plan_class: "us_equity", stance: "modify", title: "Stage the US equity build", tickers: ["CARTERX"], horizon: "2 quarters", analyst_notes: "Synthetic analyst note: the plan's one-step buy is sound on paper; staging it across two quarters of contributions reaches the same target without a sale.", bull: "Drift is the largest measured gap in the demo portfolio; closing it steadily beats trying to time it.", bear: "Staging leaves cash above target longer if markets run first.", risk: "The mix stays equity-light until the second stage lands.", manager_verdict: "Modify: keep the plan's direction, fund it from contributions in two stages." },
    { id: "demo-cash-trim", plan_class: "cash", stance: "endorse", title: "Trim the Treasury reserve to target", tickers: ["CARTERC"], horizon: "this quarter", analyst_notes: "Synthetic analyst note: cash at 34.05% against a 10% target is the portfolio's largest single drift.", bull: "The reserve floor stays funded after the trim in the demo figures.", bear: "A nearer house purchase would want this cash back.", risk: "Moving faster than the plan shrinks the emergency cushion toward the floor.", manager_verdict: "Endorse, sized exactly as the plan computes." },
  ], accounts: investmentAccounts.map((a) => ({ account: a.name, owner: a.owner, value: a.dashboard_value, mapped: true, actionable: "yes", positions: positions.filter((p) => p.value > 0).slice(0, 1).map((p) => ({ symbol: p.symbol, value: cents(a.dashboard_value / 1) })) })), unmapped: [],
  optimizer: { engine: "Demo model views (fictional)", proxies: { us_equity: "CARTERX", intl_equity: "CARTERI", bonds: "CARTERB", cash: "CARTERC" }, price_window: ["2021-10-01", "2026-10-01"], hrp: { weights_by_class: { us_equity: 0.45, intl_equity: 0.2, bonds: 0.25, cash: 0.1 }, volatility: 0.11, expected_return: 0.065 }, max_sharpe: { weights_by_class: { us_equity: 0.62, intl_equity: 0.18, bonds: 0.12, cash: 0.08 }, volatility: 0.135, expected_return: 0.078 } },
  flags: [{ title: "Synthetic demo portfolio", detail: "Every figure on this page is fictional. No trade is placed from this page." }],
};
// Five-year monthly axis for the risk series (the risk card is explicitly a
// five-year view); independent of the 22-month transaction ledger above.
const riskMonths = [];
for (let i = 0; i < 60; i += 1) {
  const d = new Date(Date.UTC(2021, 10 + i, 1));
  riskMonths.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
}
const drawdownSeries = riskMonths.map((m, i) => {
  // Trough (-12.3) lands at index 52 = 2026-03-01, matching max_drawdown below.
  const dd = i <= 52 ? -12.3 * Math.pow(i / 52, 1.2) : -12.3 + 10.3 * ((i - 52) / 7);
  return { m, dd: cents(dd) };
});
const growthSeries = riskMonths.map((m, i) => ({
  m,
  current: Math.round(100000 * Math.pow(1.384, i / 59)),
  target: Math.round(100000 * Math.pow(1.412, i / 59)),
}));
const risk = {
  as_of: AS_OF,
  window: ["2021-11-01", AS_OF], methods: "Synthetic monthly return series for demonstration only.",
  coverage: { risk_universe_pct: 100, priced_pct: 100, proxied_pct: 0, cash_pct: 34.05, excluded: [] },
  holdings: { ann_vol_pct: 10.4, max_drawdown: { pct: -12.3, peak_month: "2025-12-01", trough_month: "2026-03-01" }, sharpe: 0.72, worst_month: { pct: -4.1, month: "2026-03-01" }, drawdown_series: drawdownSeries, top_contributors: [{ name: "Carter Broad Market Index", symbol: "CARTERX", weight_pct: 30.78, risk_pct: 33.5 }], class_risk_pct: { us_equity: 62, intl_equity: 30, bonds: 8, cash: 0 }, },
  class_risk: {
    current: [{ class: "us_equity", weight_pct: 30.78, risk_pct: 62 }, { class: "intl_equity", weight_pct: 16.33, risk_pct: 30 }, { class: "bonds", weight_pct: 18.84, risk_pct: 8 }, { class: "cash", weight_pct: 34.05, risk_pct: 0 }],
    target: [{ class: "us_equity", weight_pct: 45, risk_pct: 58 }, { class: "intl_equity", weight_pct: 20, risk_pct: 27 }, { class: "bonds", weight_pct: 25, risk_pct: 10 }, { class: "cash", weight_pct: 10, risk_pct: 5 }],
  },
  backtest: { target: { weights_pct: { us_equity: 45, intl_equity: 20, bonds: 25, cash: 10 }, ann_return_pct: 7.1, ann_vol_pct: 10.9, sharpe: 0.69, max_drawdown: { pct: -14.0 }, final_value: 141200 }, current: { weights_pct: { us_equity: 30.78, intl_equity: 16.33, bonds: 18.84, cash: 34.05 }, ann_return_pct: 6.7, ann_vol_pct: 10.4, sharpe: 0.72, max_drawdown: { pct: -12.3 }, final_value: 138400 }, growth: growthSeries, proxies: { us_equity: "CARTERX", intl_equity: "CARTERI", bonds: "CARTERB", cash: "CARTERC" } },
};

let filesWritten = 0;
const write = (name, value) => { filesWritten += 1; writeFileSync(path.join(DATA, name), `${JSON.stringify(value, null, 2)}\n`); };
rmSync(DATA, { recursive: true, force: true });
mkdirSync(DATA, { recursive: true });
write("meta.json", { as_of: AS_OF, generated_at: "2026-10-22T12:00:00.000Z", net_worth: netWorth, assets, liabilities, household: "Daniel and Maya Carter", demo: true });
write("accounts.json", accounts.map(({ opening, ...a }) => a));
write("balance_attribution.json", balanceAttribution);
write("transactions_2025.json", transactions[2025]);
write("transactions_2026.json", transactions[2026]);
write("monthly_cashflow.json", monthly);
// Briefing net-worth block: change is growth since the first monthly
// snapshot (2025-11-01, nwHistBack[0] below) and days counts the monthly
// snapshots in net_worth_history.json (12 month-starts + the as-of point).
write("briefing.json", { generated_for: AS_OF, months: monthly.map((m) => ({ ...m, budget: budgets.spend_lines.map((b) => ({ id: b.id, label: b.label, budget: b.budget, actual: 0, delta: -b.budget })), budget_total: budgets.spend_lines.reduce((s, b) => s + b.budget, 0), movers: [], net_worth: { end: netWorth, change: 5371.38, days: 13 } })) });
write("budgets.json", budgets);
write("budget_pace.json", { file: "budget_pace_oct2026.json", rows: budgets.spend_lines.map((r) => ({ category: r.label, budget_month: r.budget })) });
write("allowance_ledger.json", { as_of: AS_OF, allowances: [], entries: [] });
// Cash outlook: a 30-day walk across ALL FOUR cash accounts, starting from
// their combined balance (the same total the Accounts page shows). Every
// figure derives from the one items list — the daily projection, the low
// point, the day-30 balance and the outflow totals cannot disagree.
const outlookItems = [
  { date: "2026-10-25", label: "Riverbend Auto Loan Payment", amount: 510, kind: "committed_outflow" },
  { date: "2026-11-01", label: "Cedar Grove Rent", amount: 2800, kind: "committed_outflow" },
  { date: "2026-11-03", label: "Little Oak Learning Center", amount: 1250, kind: "committed_outflow" },
  { date: "2026-11-05", label: "Northstar Systems paycheck", amount: 4200, kind: "expected_income" },
  { date: "2026-11-05", label: "Brightline Studio paycheck", amount: 3300, kind: "expected_income" },
  { date: "2026-11-07", label: "Austin Electric Cooperative", amount: 214, kind: "committed_outflow" },
  { date: "2026-11-10", label: "Card bill — Bluebonnet Rewards Card", amount: accounts.find((a) => a.id === "card-a").dashboard_value, kind: "card_bill" },
  { date: "2026-11-11", label: "BrightCell Mobile", amount: 118, kind: "committed_outflow" },
  { date: "2026-11-13", label: "Card bill — Cedar Cash Card", amount: accounts.find((a) => a.id === "card-b").dashboard_value, kind: "card_bill" },
  { date: "2026-11-16", label: "Bluebonnet Auto Cover", amount: 186, kind: "committed_outflow" },
  { date: "2026-11-20", label: "Northstar Systems paycheck", amount: 4200, kind: "expected_income" },
  { date: "2026-11-20", label: "Brightline Studio paycheck", amount: 3300, kind: "expected_income" },
];
const cashNow = cents(accounts.filter((a) => a.kind === "asset" && ["joint-checking", "daniel-checking", "maya-checking", "savings"].includes(a.id)).reduce((s, a) => s + a.dashboard_value, 0));
const dailyProjection = [];
{
  let bal = cashNow;
  for (let i = 0; i < 31; i += 1) {
    const d = new Date(Date.UTC(2026, 9, 22 + i)).toISOString().slice(0, 10);
    for (const it of outlookItems) if (it.date === d) bal = cents(bal + (it.kind === "expected_income" ? it.amount : -it.amount));
    dailyProjection.push({ date: d, projected_balance: bal });
  }
}
const lowPoint = dailyProjection.reduce((lo, p) => (p.projected_balance < lo.amount ? { date: p.date, amount: p.projected_balance } : lo), { date: AS_OF, amount: cashNow });
write("cash_outlook.json", { as_of: AS_OF, cash_now: cashNow, projected_cash_day30: dailyProjection[dailyProjection.length - 1].projected_balance, cash_accounts_included: ["4102", "7734", "2946", "8251"], low_point: lowPoint, window: { days: 30, end: "2026-11-21" }, committed_outflows: { total: cents(outlookItems.filter((i) => i.kind === "committed_outflow").reduce((s, i) => s + i.amount, 0)) }, card_bills_due: { total: cents(outlookItems.filter((i) => i.kind === "card_bill").reduce((s, i) => s + i.amount, 0)) }, daily_projection: dailyProjection, items: outlookItems });
const nwHistMonths = ["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"];
const nwHistBack = [5371.38, 4950.12, 4410.55, 3985.9, 3470.25, 3015.6, 2480.44, 1995.3, 1440.75, 920.5, 455.2, 130.75];
write("net_worth_history.json", [...nwHistMonths.map((d, i) => ({ date: d, net_worth: cents(netWorth - nwHistBack[i]) })), { date: AS_OF, net_worth: netWorth }]);
write("portfolio.json", portfolio);
write("risk.json", risk);
write("regime_brief.json", {
  as_of: AS_OF,
  sources: ["Fictional market notes", "Carter demo research digest", "Synthetic rates desk memo"],
  sections: {
    regime_now: [
      "In this synthetic snapshot, cash yields stay near their recent range and broad equity indexes sit close to their highs.",
      "Demo rate expectations lean toward one more cut this year, but the fictional sources disagree on the timing.",
    ],
    target_implications: [
      "The demo target's 25% bond weight is the main shock absorber; the current 18.84% leaves the mix more equity-driven than the plan.",
      "New contributions, not sales, are the cheapest path from 34.05% cash toward the 10% target in this fictional case.",
    ],
    watch_items: [
      "Whether the fictional childcare step-down in 2029 changes the savings pace enough to revisit the cash target.",
      "Demo watch: the auto loan matures before the house window; its $510 payment is the largest single lever in the pace model.",
    ],
    disagreements: [
      "One fictional source expects equity returns to cool from here; another expects earnings growth to carry them — the demo treats both as unproven.",
      "The sources split on whether bond yields fall fast enough to make the 25% bond target pay this year.",
    ],
  },
  simple_sections: {
    regime_now: [
      "In this made-up snapshot, cash still pays a decent yield and stock indexes are near their highs.",
      "The fictional sources expect maybe one more rate cut this year, but they argue about when.",
    ],
    target_implications: [
      "Bonds are the cushion in the demo target. Holding less than the target means bumpier rides.",
      "Adding new savings is the cheapest way to bring the extra cash down to target.",
    ],
    watch_items: [
      "Childcare gets cheaper in 2029 in this fictional plan, which could change how much cash to hold.",
      "The car loan ends before the house purchase window, freeing up its $510 monthly payment.",
    ],
    disagreements: [
      "The made-up sources argue about whether stocks cool off or keep climbing.",
      "They also split on whether bond yields fall fast enough to reward the bond target this year.",
    ],
  },
  bullet_meta: {
    regime_now: [{ basis: "fact" }, { basis: "forecast", contested: true }],
    target_implications: [{ basis: "opinion" }, { basis: "fact" }],
    watch_items: [{ basis: "fact" }, { basis: "opinion" }],
    disagreements: [{ basis: "opinion", contested: true }, { basis: "forecast", contested: true }],
  },
  glossary_terms: [],
});
write("theses.json", {
  generated_for: AS_OF,
  theses: [
    {
      id: "target-mix",
      title: "Hold the 45/20/25/10 target mix",
      updated: "2026-10-15",
      statement: "The Carter household's investable assets stay pointed at 45% US equity, 20% international equity, 25% bonds, and 10% cash until the down-payment window opens.",
      supporting: [
        { text: "Cash is 34.05% of the demo portfolio against a 10% target, earning less than the bond index in this synthetic series.", source: "Fictional market notes", date: "2026-10-10" },
        { text: "In the demo risk model, the target mix finished ahead of the current mix with lower volatility over the backtest window.", source: "Carter demo research digest", date: "2026-10-12" },
      ],
      challenging: [
        { text: "A house purchase inside two years would argue for holding more cash than the target allows.", source: "Carter demo research digest", date: "2026-10-12" },
      ],
      revision_conditions: "Revisit if the house timeline moves inside 18 months, if either earner's job changes, or if reserves fall below the $24,000 floor.",
    },
    {
      id: "reserves-first",
      title: "Fund the reserve floor before new risk",
      updated: "2026-10-08",
      statement: "Bank cash plus the money-market reserve stays between the $24,000 floor and the $42,000 ceiling before any contribution goes to equities.",
      supporting: [
        { text: "Demo reserves stand at $31,500, inside the floor band, with the auto loan as the only liability beyond the cards.", source: "Fictional market notes", date: "2026-10-06" },
      ],
      challenging: [
        { text: "Cash above the ceiling drags on the demo portfolio's return in every backtest year shown.", source: "Synthetic rates desk memo", date: "2026-10-09" },
      ],
      revision_conditions: "Revisit if monthly essentials move by more than 10% for two straight months, or if the childcare step-down arrives early.",
    },
  ],
});
write("decisions.json", {
  decisions: [
    {
      title: "Rebalance with new contributions first",
      date: "2026-10-05",
      status: "open",
      decision: "Direct new savings to US and international equity until the mix is within 5 points of target; sell nothing this quarter.",
      rationale: "The drift is contribution-fixable at the demo savings pace, and selling would realize gains for no benefit.",
      falsification: "If two quarters of contributions cannot close half the US-equity gap, the no-sell rule gets revisited.",
    },
    {
      title: "Stage the cash trim in two moves",
      date: "2026-09-21",
      status: "open",
      decision: "Trim the Treasury reserve halfway to target now and the rest after the January review.",
      rationale: "Keeps reserves above the floor through the enrollment and tax checkpoints.",
      falsification: "If reserves would dip below $24,000 at either stage, the second stage is cancelled.",
    },
    {
      title: "Keep the HSA in the Treasury reserve",
      date: "2026-08-18",
      status: "resolved",
      decision: "Leave the Family HSA invested in the Carter Treasury Reserve rather than moving it into the broad market index.",
      rationale: "Medical spending in the demo year ran close to the HSA balance, so the reserve's stability mattered more than the index's expected return.",
      falsification: "A year of low medical spending with the HSA balance above $10,000 would have argued for investing the excess.",
      outcome: "Kept in the reserve fund; demo medical spending stayed inside the card-paid budget.",
    },
  ],
});
write("source_scores.json", {
  as_of: AS_OF,
  sources: [
    { source: "Fictional market notes", forecasts_scored: 12, brier: 0.21, weight: 0.6 },
    { source: "Synthetic rates desk memo", forecasts_scored: 8, brier: 0.24, weight: 0.4 },
    { source: "Carter demo research digest", forecasts_scored: 3, brier: null, weight: null },
  ],
});
write("card_policy.json", { text: "Demo card policy (fictional): the Bluebonnet Rewards Card is the joint card for groceries and streaming; the Cedar Cash Card is Daniel's card for fuel and dining. Card payments are made from joint checking on the 27th. No real card program terms are described here." });
write("snapshot.json", { as_of: AS_OF, generated_at: "2026-10-22T12:00:00.000Z", dashboard_net_worth: netWorth, net_worth: netWorth, assets, liabilities });
write("commentary.json", { as_of: AS_OF, text: "Synthetic analyst commentary for the demo household: the Carter portfolio's story this quarter is cash. At 34.05% against a 10% target, cash is the largest single drift, and the fictional desk view is that contributions — not sales — should close it. Bond exposure trails the 25% target, so the ride is more equity-driven than the written plan intends. Nothing in this demo commentary describes a real household or a real market view." });
const essentialSplit = (year) => {
  const rows = transactions[year].filter((t) => t.g !== "Income" && !["Transfers", "Card Payments", "Card Rewards"].includes(t.lc));
  return {
    essential: cents(rows.filter((t) => t.ct === "Essential").reduce((s, t) => s + t.a, 0)),
    discretionary: cents(rows.filter((t) => t.ct !== "Essential").reduce((s, t) => s + t.a, 0)),
  };
};
write("essential_2025.json", { year: 2025, as_of: AS_OF, ...essentialSplit(2025) });
write("essential_2026.json", { year: 2026, as_of: AS_OF, ...essentialSplit(2026) });
const autoLoan = accounts.find((a) => a.id === "auto-loan");
write("loan.json", { as_of: AS_OF, lender: "Riverbend Auto Finance", account_mask: "8842", collateral: "Fictional compact SUV", balance: autoLoan.dashboard_value, monthly_payment: 510, principal_portion: 300, rate_pct: 6.9, term_months: 60, opened: "2024-06-15" });
write("card_statements.json", {
  as_of: AS_OF,
  statements: accounts.filter((a) => a.id.startsWith("card-")).map((a, i) => ({
    card: a.name, institution: a.institution, mask: a.mask, owner: a.owner,
    statement_date: i === 0 ? "2026-10-14" : "2026-10-17",
    balance: a.dashboard_value,
    minimum_due: Math.max(25, cents(a.dashboard_value * 0.02)),
    due_date: i === 0 ? "2026-11-10" : "2026-11-13",
  })),
});
write("records.json", { demo: true, lease: { property: "Cedar Grove Apartments", landlords: ["Cedar Grove Property Co."], tenants: ["Daniel Carter", "Maya Carter"], term: { start: "2025-01-01", original_end: "2026-12-31", amended_end: "2027-12-31" }, rent: { current: 2800, amended: 2800, amended_from: "2025-01-01" }, security_deposit: { amount: 2800 }, notice_deadline_for_current_term: "2027-11-01", tenant_early_termination: "See fictional lease summary.", landlord_early_termination: "See fictional lease summary.", insurance_requirement: "Renters coverage required." }, daniel: { employer: "Northstar Systems", current_salary: 146400, pay_structure: { current_salary_annualized: 146400, frequency: "Semi-monthly" }, latest_stub: { pay_date: AS_OF, gross: 6100, net_pay: 4200 }, retirement_401k: { his_deferral: "8%", employer_funding: "4%" } }, maya: { employer: "Brightline Studio", current_salary: 102000, pay_structure: { current_salary_annualized: 102000, frequency: "Semi-monthly" }, latest_stub: { pay_date: AS_OF, gross: 4250, net_pay: 3300 }, retirement_401k: { her_deferral: "7%", employer_funding: "3%" } }, compensation: {}, apple: { as_of: AS_OF, current: { balance: 0, due: "2026-11-15", minimum_payment: 0 }, statements: [], subscriptions_as_of_2026_10_13: { renewing: [], expiring_cancelled: [] } }, benefits_programs: [] });
write("benefits.json", { as_of: AS_OF, elections_total_per_pay: 308.69, pay_periods_per_year: 26, elections: [{ item: "Medical premium", group: "Family", covered: "Daniel, Maya, child", per_pay: 187.43, annual: 4873.18 }, { item: "HSA contribution", group: "Health", covered: "Family", per_pay: 96.15, annual: 2499.9 }, { item: "Dental premium", group: "Family", covered: "Daniel, Maya, child", per_pay: 18.27, annual: 475.02 }, { item: "Vision premium", group: "Family", covered: "Daniel, Maya", per_pay: 6.84, annual: 177.84 }], enrollment_actions: [{ id: "hsa", title: "Increase HSA", current: "$2,499.90", recommended: "$3,153.85", delta: "+$653.95", annual: 3153.85 }], retirement: { total_wealth_accumulation: 124382.55, as_of: AS_OF, annual_savings_rate_pct: 14.6, plan_401k: { balance: 107003, daniel_traditional: 64812.37, maya_traditional: 42190.63, his_contribution_pct: 8 } }, hsa: { total: 6214.83, balance: 6214.83, fund: "Carter Treasury Reserve", as_of: AS_OF, receipt_stash: "Fictional demo HSA records." }, dcfsa: { annual_election: 4750 } });
write("benefit_plan.json", { planned: { hsa: true } });
write("pay_series.json", { stubs: payroll[2026].map((p) => ({ pay_date: p.date, employer: p.employer, gross: p.gross, pre_tax_total: p.pre_tax_total, taxes_total: p.taxes_total, net: p.amount, net_pay: p.amount, person: p.person })) });
write("enrollment.json", { plan_year: 2027, as_of: AS_OF, mailer: [{ title: "Mailer rate vs portal rate", text: "The printed mailer shows the family medical premium at $486.19/pay; the enrollment portal shows $473.55. The portal figure is the one that will be deducted \u2014 the mailer was printed before the October rate correction.", verdict: "NOTE" }, { title: "HSA seed money", text: "Northstar Systems seeds the HSA with $500 in January and another $250 in July if a biometric screening is on file by May 31.", verdict: "NOTE" }], change: [{ title: "HSA contribution", note: "Raise toward the family maximum in two steps so the January budget is not squeezed.", current: "$2,499.90", recommended: "$3,153.85", delta: "+$653.95" }, { title: "Dental plan", note: "The child\u2019s orthodontia consult is not expected until 2027; the DHMO covers the consult at a copay instead of coinsurance.", current: "$475.02", recommended: "$388.70", delta: "-$86.32" }], keep: [{ item: "Family medical plan", why: "The family deductible was met in March, so switching plans mid-stream would restart it; the premium gap to the leaner plan is $13.88/pay, less than one urgent-care visit." }, { item: "Vision plan", why: "At $6.84/pay it pays for itself with one pair of glasses; Maya\u2019s prescription changed in August." }], hdhp_explainer: { title: "Demo plan note", paras: ["This section contains fictional benefits education."], bullets: ["No election is sent from this page."] }, analysis: { bottom_line: "Use the fictional comparison as a UI demonstration only.", sections: [{ h: "What changed", paras: ["Synthetic plan inputs are shown for layout coverage."], items: [], bullets: [] }], table: [], table_total: null, table_note: "Synthetic demo values." }, verify: ["Confirm Maya\u2019s 401(k) deferral carried over \u2014 it reset to 0% during the March payroll migration and was caught in April.", "Check the HSA seed posts in January before assuming the balance covers the spring orthodontia consult.", "Re-check the dental election after the consult quote arrives; the DHMO saving assumes no out-of-network visits."] });
write("healthcare.json", { as_of: AS_OF, total: 860, hsa_direct_spend: 120, coverage: { claim_service_start: "2026-01-01", claim_service_end: AS_OF, eobs_claim_parsed: 3, eob_documents: 3, eobs_summary_only: 0, summaries_validated: 3, summaries_total: 3, note: "Synthetic coverage note." }, totals_by_year: { 2026: { billed: 1200, allowed: 980, discounts: 220, plan_paid: 740, responsibility_eob: 240, eobs_validated: 3, claims: 3, card_paid: 160, hsa_paid: 80, unmatched_claims: 0, unmatched_dollars: 0 } }, unreimbursed: { total: 240, by_year: { 2026: 240 }, definition: "Synthetic patient responsibility without a matched HSA distribution." }, unmatched_claims: { count: 0, dollars: 0 }, unmatched_charges: { count: 0, dollars: 0, rows: [] }, recent_charges: { count: 0, dollars: 0 }, claims: [{ date: "2026-03-14", patient: "Daniel", provider: "Cedar Grove Clinic", service_type: "Primary care", responsibility: 120, status: "card_paid", status_label: "Matched", payment_label: "Bluebonnet card", payment_date: "2026-03-15" }, { date: "2026-06-08", patient: "Maya", provider: "Cedar Grove Clinic", service_type: "Primary care", responsibility: 80, status: "hsa_paid", status_label: "Matched", payment_label: "Family HSA", payment_date: "2026-06-09" }, { date: "2026-09-02", patient: "Child", provider: "Cedar Grove Clinic", service_type: "Pediatric care", responsibility: 40, status: "card_paid", status_label: "Matched", payment_label: "Bluebonnet card", payment_date: "2026-09-03" }] });
write("coverage.json", { as_of: AS_OF, eobs_claim_parsed: 3, eob_documents: 3, eobs_summary_only: 0, summaries_validated: 3, summaries_total: 3, note: "Synthetic coverage note." });
write("tax_projection.json", { generated_from: { daniel_stub_latest: AS_OF, maya_stub: AS_OF, ledger_through: AS_OF }, federal: { balance_due: 6316.69, total_tax: 30020.05, withholding: 23703.36, effective_rate: 13.36, marginal_rate: 0.22, taxable: 192494.86, tax_before_credits: 31772.87, ctc: 2000, income_tax: 29772.87, se_tax: 247.18 }, combined_balance_due: 6316.69, daniel: { box1: 127279.44, gross: 146400, pretax: { "401(k) Contribution": 11712, "Benefits (pre-tax)": 7408.56 }, fed_wh: 15846.48 }, maya: { box1: 94860, gross: 102000, k401: 7140, fed_wh: 7856.88 }, income: { se_1099_fy: 1874.33, se_1099_ytd: 1405.75, other_fy: 681.09, box1_total: 222139.44, agi: 224694.86 }, w4_fix: { remaining_daniel_checks: 5, extra_per_check_to_zero: 1263.34, extra_per_check_safe_harbor: 662.94, safe_harbor_target: 27018.05, safe_harbor_gap: 3314.69 }, assumptions: ["All tax values are fictional demo estimates.", "Texas has no state income tax, so this projection is federal only \u2014 there is no state balance, state withholding, or state fix.", "Wages annualize the current pay stubs (Daniel $6,100 gross per check, Maya $4,250); each stub\u2019s federal withholding x 24 is the withholding shown.", "Daniel\u2019s withholding reflects the W-4 from his June role change; it annualizes about 4% light.", "The 1099 income is Maya\u2019s two-week contract stretch in February; no quarterly estimates were paid on it.", "Interest and dividends are the Cedar Bank and brokerage year-to-date figures, grossed up for December."], sensitivity_reduced_hours: { federal_balance: 4793.86 }, validation: { filed_agi: 158442.19, filed_tax: 19102.44, engine_tax: 19089.31, delta_pct: 0.07 }, sources: ["Synthetic household model"] });
const years = [1, 2, 3, 4, 5];
const scenarioYears = years.map((year) => { const fund = 32000 + year * 9500; const scenarios = [10, 20].map((down_payment_pct) => ({ rate_pct: 6.5, down_payment_pct, healthy_price_with_dp: fund * (down_payment_pct === 20 ? 5 : 4.2), healthy_price_without_dp: fund * 4, healthy_price_today_with_dp: fund * 4.8, healthy_price_today_without_dp: fund * 3.8 })); return { year, usable_fund_with_dp: fund, usable_fund_without_dp: fund - 12000, scenarios }; });
write("affordability.json", { as_of: AS_OF, params: { mortgage_rate_pct: 6.5, mortgage_rate_note: "fictional fixed rate", rate_scenarios_pct: [6.5, 7.25], property_tax_pct_of_price: 1.8, insurance_pct_of_price: 0.5, hoa_monthly: 0, closing_costs_pct: 3, pmi_pct_of_loan_per_year: 0.7, income_growth_pct: 3, expense_growth_pct: 2.5, childcare_stepdown: { last_full_month: "2029-08", aftercare_monthly: 600 }, invested_return_pct: 5, cap_gains_tax_pct: 15, home_price_inflation_pct: 3 }, start_fund: { with_dp: 32000, without_dp: 20000, liquid_total: 31500, summit_joint_money_market: 0, liquid_plus_money_market: 31500, emergency_fence: 24000, start_excess_liquid: 7500, dp_portfolio: 12000 }, gross_income_annual: 248400, monthly_savings_budget_pace: 2500, trailing_actual_monthly_net: 2100, pace_path: years.map((year) => ({ year, average_monthly_savings: 2100 + year * 100 })), years: scenarioYears, notes: ["Synthetic scenario inputs for the demo."] });
write("scenarios.json", { baseline: { years: scenarioYears.map((y) => ({ year: y.year, fund_with_dp: y.usable_fund_with_dp })) }, second_child: { monthly_delta: { childcare: 700, insurance: 180, groceries: 150, healthcare: 75, dcfsa_tax_saving: -200, total: 905 }, fund_trajectory: years.map((year) => ({ year, child_age: year + 1, monthly_delta: year === 1 ? 0 : 905, monthly_contribution: 2100 - year * 100, fund: 30000 + year * 7000, one_time_outflow: year === 2 ? 3500 : 0 })), house_delay: { note: "Synthetic second-child scenario note." } }, combined_summary: { usable_fund_year5_baseline: 79500, usable_fund_year5_with_child: 65000, healthy_price_year5_baseline_20pct: 397500, healthy_price_year5_child_20pct: 325000 }, notes: ["Synthetic scenario output."] });
write("savings_cuts.json", { as_of: AS_OF, cuts: [{ id: "unused-box", item: "Unused demo storage box", owner: "Joint", kind: "Subscription", status: "active", monthly_saved: 12, annual_saved: 144, confirmed_on: "2026-09-10", note: "Fictional confirmed cut." }], suggestions: [{ id: "meal-plan", item: "Plan one additional home dinner", owner: "Joint", monthly_low: 25, monthly_high: 60, note: "Fictional estimate." }], in_progress: [{ id: "gas-switch", item: "Switch natural gas provider \u2014 Lone Star Gas to Bluebonnet Energy", owner: "Joint", kind: "Utility", expected_monthly: 84, expected_annual: 1008, note: "Current plan is a variable rate that drifted to $1.87/therm; the new 12-month fixed rate is $0.94/therm with a $4.95 monthly customer charge and a $125 early-termination fee. Expected saving is the trailing-twelve-month usage at the two rates; it lands in confirmed once the first Bluebonnet bill posts.", steps: [{ state: "done", when: "Oct 6, 2026", label: "Compare fixed-rate offers", detail: "Pulled 12 months of usage from Lone Star Gas bills; Bluebonnet\u2019s 12-month fixed beat the other two offers by about $9/mo." }, { state: "done", when: "Oct 15, 2026", label: "Enroll with Bluebonnet Energy", detail: "Enrolled online under Daniel\u2019s name; no deposit and no credit inquiry beyond the standard check." }, { state: "next", when: "Nov 4, 2026", label: "Switch takes effect at the meter read", detail: "Bluebonnet confirmed the Nov 4 meter read as the handover date; Lone Star Gas sends a final bill for service through Nov 3." }, { state: "todo", when: "Dec 8, 2026", label: "First Bluebonnet bill posts", detail: "Expect a partial first cycle (Nov 4 \u2013 Dec 1). Check the rate line reads $0.94/therm and the customer charge is $4.95." }, { state: "todo", when: "Jan 12, 2027", label: "Verify the saving and move to confirmed", detail: "Compare the first full winter bill against the same month last year, weather-adjusted; if the run rate holds, this moves into the confirmed register." }, { state: "todo", when: "Sep 30, 2027", label: "Shop the renewal before the term ends", detail: "Fixed term ends Nov 3, 2027; start comparing offers a month ahead so it does not roll onto Bluebonnet\u2019s variable rate." }] }] });
write("deadlines.json", { generated_for: AS_OF, deadlines: [{ id: "lease-renewal", title: "Review Cedar Grove lease", date: "2027-11-01", days_left: 375, category: "lease", source: "fictional lease summary", consequence: "Review renewal terms before the notice window." }, { id: "benefits", title: "Review fictional benefits election", date: "2027-04-30", days_left: 190, category: "benefits", source: "demo enrollment summary", consequence: "Confirm the demo selection for the next plan year." }] });
write("digest.json", { headline: "Synthetic demo household stayed within its monthly plan.", week: { start: "2026-10-16", end: AS_OF }, lines: ["Payroll deposits and recurring bills are present.", "No real accounts or people are represented."] });
write("watchdog.json", { findings: [{ id: "demo|review", type: "review", title: "Demo data is synthetic", first_seen: AS_OF, detail: "This is a fictional household dataset." }] });
write("credit_tracker.json", { as_of: AS_OF, year: 2026, credits: [{ id: "streamleaf-credit", name: "Streamleaf monthly credit", card: "Bluebonnet Rewards Card", amount_per_period: 5, period_type: "monthly", annual_total: 60, trackable: true, available_ytd: 50, captured_ytd: 45, remaining_current: 5, missed: 0, periods: [] }], totals: { captured_ytd: 45, available_ytd: 50, missed: 0 }, expiring_soon: [] });
write("loan_model.json", { lender: "Riverbend Auto Finance", account_mask: "8842", payment_mask: "4102", payment_name: "Riverbend Auto Loan Payment", monthly_payment: 510, principal_per_payment: LOAN_PRINCIPAL_PER_PAYMENT, as_of: AS_OF });
write("income_2025.json", { year: 2025, total: cents(payroll[2025].reduce((s, p) => s + p.amount, 0)), payroll_deposits: payroll[2025] });
write("income_2026.json", { year: 2026, total: cents(payroll[2026].reduce((s, p) => s + p.amount, 0)), payroll_deposits: payroll[2026] });
write("attribution_2025.json", { year: 2025, payroll_deposits: payroll[2025], total: cents(payroll[2025].reduce((s, p) => s + p.amount, 0)) });
write("attribution_2026.json", { year: 2026, payroll_deposits: payroll[2026], total: cents(payroll[2026].reduce((s, p) => s + p.amount, 0)) });
const categoryTotals = (year) => Object.fromEntries(categories.map((name) => [name, cents(transactions[year].filter((t) => t.c === name && t.g !== "Income").reduce((s, t) => s + t.a, 0))]));
write("categories.json", { categories: categories.map((name) => ({ name, total_2025: categoryTotals(2025)[name] || 0, total_2026: categoryTotals(2026)[name] || 0 })) });
write("categories_2025.json", { year: 2025, categories: categories.map((name) => ({ name, total: categoryTotals(2025)[name] || 0 })) });
write("categories_2026.json", { year: 2026, categories: categories.map((name) => ({ name, total: categoryTotals(2026)[name] || 0 })) });
write("holdings.json", { as_of: AS_OF, total: investable, holdings: positions });
write("recurring.json", { as_of: AS_OF, items: [] });
write("overrides.json", {});
writeFileSync(path.join(ROOT, "overrides.json"), "{}\n");
writeFileSync(path.join(ROOT, "instructions.json"), "{\n  \"instructions\": []\n}\n");

console.log(`Generated ${months.length} months, ${transactions[2025].length + transactions[2026].length} transactions, and ${filesWritten} JSON files.`);
