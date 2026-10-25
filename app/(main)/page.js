import { cookies } from "next/headers";
import { data, money, num } from "../../lib/data";
import { PERSON_COLORS, money0, moneyFlow, fmtDate } from "../../lib/format";
import { TrendChart, BarChart } from "../../lib/charts-interactive";
import Link from "next/link";
import { PageHeader, CardHead, Delta, Progress, Avatar, DrillLink } from "../../lib/ui";
import { txnHref, txnOpenHref } from "../../lib/drill";
import { Icon } from "../../lib/icons";
import { getOverrides, applyRecordsToTxns } from "../../lib/overrides";
import { groupedAccounts, computeBudget, paceStatus, monthToDateSpend, MONTH_NAMES } from "../../lib/insights";
import { liveCashflowSeries } from "../../lib/live-aggregates";
import { nextDeadlines, daysLabel, CATEGORY_LABELS } from "../../lib/deadlines";

export const dynamic = "force-dynamic";

const INCOME_COLOR = "#2fa36b";
const EXPENSE_COLOR = "#ef6461";
const SPEND_COLOR = "#f2622e";
const PREV_COLOR = "#a8a29a";
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const pctTxt = (v) => `${Math.abs(v).toFixed(1)}%`;

export default async function Dashboard() {
  const meta = data("meta.json");
  const outlook = data("cash_outlook.json");
  const history = data("net_worth_history.json");
  const balAttr = data("balance_attribution.json");
  const accounts = data("accounts.json");
  const portfolio = data("portfolio.json");
  const records = await getOverrides().catch(() => []);
  const txns = applyRecordsToTxns(data("transactions_2026.json"), records);

  let user = "";
  try {
    const u = ((await cookies()).get("pf_session")?.value || "").split(".")[0];
    if (u === "daniel" || u === "maya") user = u[0].toUpperCase() + u.slice(1);
  } catch { user = ""; }

  // Net worth
  const first = history[0];
  const worthDelta = first ? num(meta.net_worth) - num(first.net_worth) : 0;
  const worthPct = first && num(first.net_worth) ? (worthDelta / Math.abs(num(first.net_worth))) * 100 : 0;

  // Month-to-date spending vs last month
  const mtd = monthToDateSpend(txns);
  const mtdDiff = mtd ? mtd.total - mtd.sameDayPrev : 0;

  // Cash flow (all months on file) + 2026 year to date
  // Live from the transaction rows + site overrides (lib/live-aggregates.js),
  // so the card below moves the moment a transaction is retagged.
  const flow = liveCashflowSeries([...data("transactions_2025.json"), ...data("transactions_2026.json")], records, data("loan_model.json"), data("monthly_cashflow.json"));
  const flowYear = flow.filter((r) => r.year === 2026);
  const ytdIncome = flowYear.reduce((s, r) => s + r.income, 0);
  const ytdExpense = flowYear.reduce((s, r) => s + r.expenses, 0);
  const ytdNet = ytdIncome - ytdExpense;
  const savingsRate = ytdIncome ? (ytdNet / ytdIncome) * 100 : 0;
  // Loan principal is left out of Expenses; drill-downs say so on arrival.
  const principalByMonth = Object.fromEntries(flow.map((r) => [`${r.year}-${String(r.month + 1).padStart(2, "0")}`, r.loan_principal]));
  const flowGroups = flow.slice(-12).map((r) => ({
    label: r.short.split(" ")[0], title: r.long, href: txnHref({ mo: `${r.year}-${String(r.month + 1).padStart(2, "0")}`, pr: principalByMonth[`${r.year}-${String(r.month + 1).padStart(2, "0")}`] }),
    bars: [{ key: "Income", value: r.income, color: INCOME_COLOR }, { key: "Expenses", value: r.expenses, color: EXPENSE_COLOR }],
    note: `Net ${r.income - r.expenses >= 0 ? "+" : "-"}${money0(Math.abs(r.income - r.expenses))}${r.income ? ` · saved ${Math.round(((r.income - r.expenses) / r.income) * 100)}%` : ""}`,
  }));

  // Budget
  const budgets = data("budgets.json");
  const budget = computeBudget(txns, budgets);

  // Next deadlines strip (deadline center): soonest 3 that are overdue or
  // land within 200 days of the dashboard's as-of date.
  let deadlinesPayload = null;
  try { deadlinesPayload = data("deadlines.json"); } catch { deadlinesPayload = null; }
  const upcomingDeadlines = deadlinesPayload ? nextDeadlines(deadlinesPayload.deadlines || [], meta.as_of, { withinDays: 200 }) : [];
  const watchLines = [...budget.spendLines]
    .filter((l) => l.budget > 0)
    .sort((a, b) => b.actual / b.budget - a.actual / a.budget)
    .slice(0, 5);

  // Recent + upcoming
  const recent = [...txns].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 7);
  const upcoming = (outlook.items || []).slice(0, 7);

  // Accounts
  const groups = groupedAccounts(accounts);
  const assetGroups = groups.filter((g) => !g.liability);
  const liabGroups = groups.filter((g) => g.liability);

  // People
  const people = Object.keys(balAttr.net || {}).sort((a, b) => num(balAttr.net[b]) - num(balAttr.net[a]));
  const netTotal = people.reduce((s, p) => s + Math.max(0, num(balAttr.net[p])), 0);

  return (
    <>
      <PageHeader
        title={user ? `Welcome back, ${user}` : "Dashboard"}
        subtitle={`Here's where the household stands as of ${new Date(`${meta.as_of}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`}
      />

      {upcomingDeadlines.length > 0 && (
        <div className="dash-grid">
          <section className="card span-12">
            <CardHead title="Upcoming deadlines" href="/deadlines" linkText="All deadlines" sub="Hard dates from the lease, policies, benefits and tax records" />
            <div className="list">
              {upcomingDeadlines.map((e) => (
                <Link className="list-row list-link" href="/deadlines" key={e.id}>
                  <span className="type-icon"><Icon name="calendar" size={16} /></span>
                  <div className="list-main">
                    <div className="list-title">{e.title}</div>
                    <div className="list-meta"><span>{fmtDate(e.date)}</span><span aria-hidden="true">·</span><span>{CATEGORY_LABELS[e.category] || e.category}</span></div>
                  </div>
                  <div className={`list-amt ${e.days_left < 0 ? "negative" : ""}`}>{daysLabel(e.days_left)}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="dash-grid">
        <section className="card span-8">
          <CardHead title="Net worth" href="/accounts" linkText="Accounts" />
          <div className="hero-value">
            <span className="big">{money(meta.net_worth)}</span>
            {first && <Delta value={worthDelta} text={`${money0(Math.abs(worthDelta))} (${pctTxt(worthPct)})`} />}
          </div>
          <div className="hero-meta">{first ? `Change since ${shortDate(first.date)}, when monthly history began` : `As of ${fmtDate(meta.as_of)}`}</div>
          <TrendChart
            series={[{ label: "Net worth", color: "#4f7fe0", points: history.map((r) => num(r.net_worth)) }]}
            labels={history.map((r) => shortDate(r.date))}
            height={190} ariaLabel="Net worth history" format="money"
          />
          <div className="mini-stats">
            <div className="mini-stat"><div className="k">Assets</div><div className="v">{money0(meta.assets)}</div></div>
            <div className="mini-stat"><div className="k">Liabilities</div><div className="v">{money0(meta.liabilities)}</div></div>
            <div className="mini-stat"><div className="k">Cash on hand</div><div className="v">{money0(outlook.cash_now)}</div></div>
            <div className="mini-stat"><div className="k">Investable</div><div className="v">{money0(portfolio?.total_investable)}</div></div>
          </div>
        </section>

        <section className="card span-4">
          <CardHead title="Spending" href="/spending" linkText="Details" sub={mtd ? `${mtd.curLabel} so far` : null} />
          {mtd ? (
            <>
              <div className="hero-value">
                <Link className="big drill-figure" href={txnHref({ mo: mtd.latest.slice(0, 7), sp: "all" })} title={`See ${mtd.curLabel} spending`}>{money0(mtd.total)}</Link>
              </div>
              <div className="hero-meta" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Delta value={mtdDiff} good="down" text={money0(Math.abs(mtdDiff))} />
                <span>{mtdDiff <= 0 ? "less" : "more"} than this point in {mtd.prevLabel}</span>
              </div>
              <TrendChart
                series={[
                  { label: mtd.prevLabel, color: PREV_COLOR, points: mtd.previous, dashed: true },
                  { label: mtd.curLabel, color: SPEND_COLOR, points: mtd.current },
                ]}
                labels={mtd.previous.map((_, i) => `Day ${i + 1}`)}
                height={170} zero ariaLabel="Cumulative spending this month vs last month"
              />
              <div className="legend">
                <span className="legend-item"><span className="legend-swatch line" style={{ background: SPEND_COLOR }} />{mtd.curLabel}</span>
                <span className="legend-item" style={{ color: PREV_COLOR }}><span className="legend-swatch dashed" />{mtd.prevLabel} · {money0(mtd.prevTotal)}</span>
              </div>
            </>
          ) : <p className="note">No spending recorded yet this month.</p>}
        </section>
      </div>

      <div className="dash-grid">
        <section className="card span-8">
          <CardHead title="Cash flow" href="/cash-flow" linkText="Cash flow" sub="Income and expenses by month · dashboard ledger" />
          <BarChart groups={flowGroups} height={230} ariaLabel="Monthly income and expenses" highlightLast />
          <div className="legend">
            <span className="legend-item"><span className="legend-swatch" style={{ background: INCOME_COLOR }} />Income</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: EXPENSE_COLOR }} />Expenses</span>
          </div>
          <div className="mini-stats">
            <div className="mini-stat"><div className="k">Income 2026</div><div className="v">{money0(ytdIncome)}</div></div>
            <div className="mini-stat"><div className="k">Expenses 2026</div><div className="v">{money0(ytdExpense)}</div></div>
            <div className="mini-stat"><div className="k">Net</div><div className={`v ${ytdNet >= 0 ? "pos" : "negative"}`}>{ytdNet >= 0 ? "+" : "-"}{money0(Math.abs(ytdNet))}</div></div>
            <div className="mini-stat"><div className="k">Savings rate (take-home)</div><div className="v">{savingsRate.toFixed(1)}%</div></div>
          </div>
        </section>

        <section className="card span-4">
          <CardHead title="Budget" href="/budgets" linkText="Budgets" sub={`${MONTH_NAMES[budget.mm - 1]} · ${Math.round(budget.elapsed * 100)}% of the month gone`} />
          <div className="budget-row" style={{ paddingTop: 0 }}>
            <div className="budget-row-top"><span className="name"><DrillLink href={txnHref({ mo: budget.month, sp: "all" })} title="See this month's spending">Total spending</DrillLink></span><span className="amt"><strong>{money0(budget.outActual)}</strong> of {money0(budget.outBudget)}</span></div>
            <Progress value={budget.outActual} max={budget.outBudget} tone={paceStatus(budget.outActual, budget.outBudget, budget.elapsed) === "ok" ? "good" : paceStatus(budget.outActual, budget.outBudget, budget.elapsed) === "over" ? "bad" : "warn"} marker={budget.elapsed} />
          </div>
          {watchLines.map((l) => {
            const status = paceStatus(l.actual, l.budget, budget.elapsed);
            const left = l.budget - l.actual;
            return (
              <div className="budget-row" key={l.id}>
                <div className="budget-row-top"><span className="name"><DrillLink href={txnHref({ mo: budget.month, bl: l.id })} title={`See the transactions in ${l.label}`}>{l.label}</DrillLink></span><span className="amt">{left >= 0 ? <>{money0(left)} left</> : <span className="negative">{money0(-left)} over</span>}</span></div>
                <Progress value={l.actual} max={l.budget} tone={status === "ok" ? "good" : status === "over" ? "bad" : "warn"} marker={budget.elapsed} />
              </div>
            );
          })}
        </section>
      </div>

      <div className="dash-grid">
        <section className="card span-6">
          <CardHead title="Recent transactions" href="/transactions" />
          <div className="list">
            {recent.map((t, i) => (
              <Link className="list-row list-link" href={txnOpenHref(t)} key={`${t.d}-${t.n}-${i}`}>
                <Avatar name={t.dn || t.n} />
                <div className="list-main">
                  <div className="list-title">{t.dn || t.n}</div>
                  <div className="list-meta"><span>{t.c || "Uncategorized"}</span><span aria-hidden="true">·</span><span>{shortDate(t.d)}</span></div>
                </div>
                <div className={`list-amt ${t.a < 0 ? "pos" : ""}`}>{moneyFlow(t.a)}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="card span-6">
          <CardHead title="Coming up" href="/cash-flow" linkText="30-day outlook" sub={`Next ${outlook.window?.days || 30} days of bills, card payments and paychecks`} />
          <div className="callout" style={{ marginBottom: 6 }}>
            <span className="callout-icon"><Icon name="cash" size={16} /></span>
            <div className="callout-body">
              <strong>{money0(outlook.cash_now)} in cash today</strong>
              Lowest point {money0(outlook.low_point?.amount ?? outlook.low_point?.balance)} on {outlook.low_point?.date ? shortDate(outlook.low_point.date) : "—"}; about {money0(outlook.projected_cash_day30)} at day 30.
            </div>
          </div>
          <div className="list">
            {upcoming.map((it, i) => (
              <div className="list-row" key={`${it.date}-${it.label}-${i}`}>
                <span className={`type-icon ${it.kind === "expected_income" ? "cash" : it.kind === "card_bill" ? "card" : ""}`}><Icon name={it.kind === "expected_income" ? "income" : it.kind === "card_bill" ? "card" : "calendar"} size={16} /></span>
                <div className="list-main">
                  <div className="list-title">{it.label.replace(/^Card bill — /, "")}</div>
                  <div className="list-meta"><span>{shortDate(it.date)}</span><span aria-hidden="true">·</span><span>{it.kind === "expected_income" ? "Expected income" : it.kind === "card_bill" ? "Card payment" : "Scheduled"}</span></div>
                </div>
                <div className={`list-amt ${it.kind === "expected_income" ? "pos" : ""}`}>{it.kind === "expected_income" ? "+" : ""}{money(it.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="card span-4">
          <CardHead title="Accounts" href="/accounts" />
          {[...assetGroups, ...liabGroups].map((g) => (
            <div className="acct-group" key={g.type}>
              <div className="acct-group-head">
                <span className="lhs"><span className={`type-icon ${g.tone}`}><Icon name={g.icon} size={16} /></span><span>{g.label}<div className="fine">{g.accounts.length} account{g.accounts.length === 1 ? "" : "s"}</div></span></span>
                <span className="num">{g.liability ? "-" : ""}{money0(g.total)}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="card span-4">
          <CardHead title="Net worth by person" href="/accounts" linkText="Breakdown" />
          <div className="splitbar" style={{ margin: "4px 0 12px" }}>
            {people.filter((p) => num(balAttr.net[p]) > 0).map((p) => <span key={p} title={`${p}: ${money(balAttr.net[p])}`} style={{ width: `${(num(balAttr.net[p]) / netTotal) * 100}%`, background: PERSON_COLORS[p] || "#9a958d" }} />)}
          </div>
          <div className="list">
            {people.map((p) => (
              <div className="list-row" key={p}>
                <span className="swatch" style={{ background: PERSON_COLORS[p] || "#9a958d", width: 10, height: 10, borderRadius: 3 }} />
                <div className="list-main"><div className="list-title">{p}</div><div className="list-meta"><span>{money0(balAttr.assets?.[p])} assets · {money0(balAttr.liabilities?.[p])} debt</span></div></div>
                <div className="list-amt">{money0(balAttr.net[p])}<span className="sub-amt">{netTotal ? Math.round((Math.max(0, num(balAttr.net[p])) / netTotal) * 100) : 0}%</span></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card span-4">
          <CardHead title="Investments" href="/investments" sub={portfolio?.total_investable ? `${money0(portfolio.total_investable)} investable` : null} />
          {(portfolio?.drift || []).map((d) => (
            <div className="budget-row" key={d.class}>
              <div className="budget-row-top">
                <span className="name">{d.label}</span>
                <span className="amt"><strong>{d.current_pct.toFixed(1)}%</strong> · target {d.target_pct.toFixed(0)}%</span>
              </div>
              <Progress value={d.current_pct} max={100} tone={d.flag ? "warn" : "neutral"} marker={d.target_pct / 100} />
            </div>
          ))}
          <p className="fine" style={{ marginTop: 10 }}>Bar = current share of mapped holdings; tick = target. Amber = outside the review band.</p>
        </section>
      </div>
    </>
  );
}
