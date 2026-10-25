import { data, money } from "../../../lib/data";
import { money0 } from "../../../lib/format";
import { TrendChart, BarChart } from "../../../lib/charts-interactive";
import { PageHeader, CardHead, Segmented, Stat } from "../../../lib/ui";
import LinkRow from "../../../lib/link-row";
import { txnHref } from "../../../lib/drill";
import { Icon } from "../../../lib/icons";
import { getOverrides } from "../../../lib/overrides";
import { liveCashflowSeries } from "../../../lib/live-aggregates";
import { loadCoverage } from "../../../lib/coverage";
import { CoverageNote } from "../../../lib/coverage-note";

export const dynamic = "force-dynamic";

const INCOME_COLOR = "#2fa36b";
const EXPENSE_COLOR = "#ef6461";
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const signed0 = (v) => `${v >= 0 ? "+" : "-"}${money0(Math.abs(v))}`;

export default async function CashFlow({ searchParams }) {
  const sp = await searchParams;
  const range = ["2026", "2025", "all"].includes(sp?.y) ? sp.y : "2026";
  // Totals are computed live from the transaction rows + site overrides
  // (lib/live-aggregates.js), so a retag moves this page immediately — the
  // published monthly_cashflow.json now only carries deferrals/partial.
  const records = await getOverrides().catch(() => []);
  const cov = loadCoverage();
  const all = liveCashflowSeries([...data("transactions_2025.json"), ...data("transactions_2026.json")], records, data("loan_model.json"), data("monthly_cashflow.json"));
  const rows = range === "all" ? all : all.filter((r) => String(r.year) === range);
  const outlook = data("cash_outlook.json");
  const principalOf = (r) => r.loan_principal;
  const hasPrincipal = rows.some((r) => principalOf(r) != null);
  const totalPrincipal = rows.reduce((s, r) => s + (principalOf(r) || 0), 0);

  const income = rows.reduce((s, r) => s + r.income, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0);
  const net = income - expenses;
  const rate = income ? (net / income) * 100 : 0;
  const avgExpense = rows.length ? expenses / rows.length : 0;

  const ym = (r) => `${r.year}-${String(r.month + 1).padStart(2, "0")}`;
  const groups = rows.map((r) => ({
    href: txnHref({ mo: ym(r), pr: principalOf(r) }),
    label: range === "all" ? r.short.replace(" ", " '") : r.short.split(" ")[0], title: r.long,
    bars: [{ key: "Income", value: r.income, color: INCOME_COLOR }, { key: "Expenses", value: r.expenses, color: EXPENSE_COLOR }],
    note: `Net ${signed0(r.income - r.expenses)}${r.income ? ` · saved ${Math.round(((r.income - r.expenses) / r.income) * 100)}%` : ""}`,
  }));

  const proj = outlook.daily_projection || [];
  const low = outlook.low_point || {};
  const items = outlook.items || [];

  return (
    <>
      <PageHeader
        title="Cash flow"
        subtitle="Money in and money out from the dashboard ledger — the same numbers as the Monthly briefing — plus the next 30 days of expected bills and paychecks."
        actions={<Segmented label="Range" options={[["/cash-flow?y=2026", "2026", range === "2026"], ["/cash-flow?y=2025", "2025", range === "2025"], ["/cash-flow?y=all", "All months", range === "all"]]} />}
      />

      <div className="cards">
        <Stat label="Income" value={money0(income)} sub={`${rows.length} month${rows.length === 1 ? "" : "s"}`} dot={INCOME_COLOR} />
        <Stat label="Expenses" value={money0(expenses)} sub={`avg ${money0(avgExpense)} / month`} dot={EXPENSE_COLOR} />
        <Stat label="Net" value={signed0(net)} tone={net >= 0 ? "pos" : "neg-val"} sub="income minus expenses" />
        <Stat label="Savings rate" value={`${rate.toFixed(1)}%`} tone={rate < 0 ? "neg-val" : ""} sub="of take-home pay kept · after payroll savings" />
        {rows.length > 0 && rows.every((r) => r.deferrals_est != null) && (
          <Stat label="Saved incl. retirement" value={`${(((net + rows.reduce((s, r) => s + r.deferrals_est, 0)) / (income + rows.reduce((s, r) => s + r.deferrals_est, 0))) * 100).toFixed(1)}%`} sub="of gross pay · incl. 401(k)/HSA + employer (est.)" />
        )}
      </div>

      <section className="card">
        <CardHead title="Income vs expenses" sub="Hover or tap a month for its net and savings rate; select it to see that month's transactions" />
        <BarChart groups={groups} height={280} ariaLabel="Monthly income and expenses" />
        <div className="legend">
          <span className="legend-item"><span className="legend-swatch" style={{ background: INCOME_COLOR }} />Income</span>
          <span className="legend-item"><span className="legend-swatch" style={{ background: EXPENSE_COLOR }} />Expenses</span>
        </div>
      </section>

      <div className="grid2">
        <section className="card">
          <CardHead title="30-day cash forecast" sub={`From ${money0(outlook.cash_now)} today across ${(outlook.cash_accounts_included || []).length} cash accounts`} />
          <TrendChart
            series={[{ label: "Projected cash", color: "#4f7fe0", points: proj.map((p) => p.projected_balance) }]}
            labels={proj.map((p) => shortDate(p.date))}
            height={200} zero ariaLabel="Projected cash balance"
          />
          <div className="callout warn" style={{ marginTop: 12 }}>
            <span className="callout-icon"><Icon name="alert" size={16} /></span>
            <div className="callout-body"><strong>Low point {money0(low.amount ?? low.balance)} on {low.date ? shortDate(low.date) : "—"}</strong>Projected {money0(outlook.projected_cash_day30)} at day 30 after {money0(outlook.committed_outflows?.total)} of scheduled outflows and {money0(outlook.card_bills_due?.total)} of card bills.</div>
          </div>
        </section>

        <section className="card">
          <CardHead title="Scheduled" sub={`${items.length} expected items through ${outlook.window?.end ? shortDate(outlook.window.end) : "the window"}`} />
          <div className="list" style={{ maxHeight: 400, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
            {items.map((it, i) => (
              <div className="list-row" key={`${it.date}-${i}`}>
                <span className={`type-icon ${it.kind === "expected_income" ? "cash" : it.kind === "card_bill" ? "card" : ""}`}><Icon name={it.kind === "expected_income" ? "income" : it.kind === "card_bill" ? "card" : "calendar"} size={16} /></span>
                <div className="list-main">
                  <div className="list-title">{it.label.replace(/^Card bill — /, "")}</div>
                  <div className="list-meta"><span>{shortDate(it.date)}</span><span aria-hidden="true">·</span><span>{it.kind === "expected_income" ? "Expected income" : it.kind === "card_bill" ? "Card payment" : "Committed outflow"}</span></div>
                </div>
                <div className={`list-amt ${it.kind === "expected_income" ? "pos" : ""}`}>{it.kind === "expected_income" ? "+" : ""}{money(it.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <CardHead title="By month" />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Month</th><th className="r">Income</th><th className="r">Expenses</th><th className="r">Net</th>{hasPrincipal && <th className="r hide-sm">Principal (equity)</th>}<th className="r hide-sm">Savings rate</th><th className="r hide-sm">Incl. retirement</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <LinkRow key={`${r.year}-${r.month}`} href={txnHref({ mo: ym(r), pr: principalOf(r) })} name={r.long} title={`See ${r.long} transactions`}>
                  <td className="r">{money(r.income)}</td>
                  <td className="r">{money(r.expenses)}</td>
                  <td className={`r ${r.income - r.expenses >= 0 ? "pos" : "negative"}`}>{r.income - r.expenses >= 0 ? "+" : "-"}{money(Math.abs(r.income - r.expenses))}</td>
                  {hasPrincipal && <td className="r hide-sm muted">{principalOf(r) != null ? money(principalOf(r)) : "—"}</td>}
                  <td className="r hide-sm">{r.partial ? "—" : r.income ? `${(((r.income - r.expenses) / r.income) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="r hide-sm">{r.partial ? "—" : r.savings_rate_incl_retirement != null ? `${Number(r.savings_rate_incl_retirement).toFixed(1)}%` : "—"}</td>
                </LinkRow>
              ))}
              <tr className="total"><td>Total</td><td className="r">{money(income)}</td><td className="r">{money(expenses)}</td><td className="r">{net >= 0 ? "+" : "-"}{money(Math.abs(net))}</td>{hasPrincipal && <td className="r hide-sm">{money(totalPrincipal)}</td>}<td className="r hide-sm">{rate.toFixed(1)}%</td><td className="r hide-sm">{rows.length > 0 && rows.every((r) => r.deferrals_est != null) ? `${(((net + rows.reduce((s, r) => s + r.deferrals_est, 0)) / (income + rows.reduce((s, r) => s + r.deferrals_est, 0))) * 100).toFixed(1)}%` : "—"}</td></tr>
            </tbody>
          </table>
        </div>
        {range !== "2026" ? <CoverageNote cov={cov} /> : null}
        <p className="note">Monthly totals come from the synthetic transaction ledger — the same data as the Monthly briefing and the Transactions page. The current month is partial. “Incl. retirement” adds estimated payroll saving to both the amount saved and the income it is measured against. “Principal (equity)” is the portion of the fictional auto-loan payment that reduces the liability rather than household spending.</p>
      </section>
    </>
  );
}
