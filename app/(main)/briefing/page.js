import Link from "next/link";
import { fmtDate } from "../../../lib/format";
import { data, money } from "../../../lib/data";
import { PageHeader, Segmented, Stat, CardHead, Progress, Empty, DrillLink } from "../../../lib/ui";
import { txnHref } from "../../../lib/drill";
import { Icon } from "../../../lib/icons";
import { getOverrides, tokenConfigured } from "../../../lib/overrides";
import { liveBriefing } from "../../../lib/live-aggregates";
import { loadCoverage, isAffected } from "../../../lib/coverage";
import { CoverageNote, GapMark } from "../../../lib/coverage-note";
import WatchdogPanel from "./watchdog";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const mlabel = (m) => `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mshort = (m) => `${MONTH_NAMES[Number(m.slice(5)) - 1].slice(0, 3)} ${m.slice(2, 4)}`;
const signed = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + money(Math.abs(x)).replace("-", "");

export default async function Briefing({ searchParams }) {
  const sp = await searchParams;
  const records = await getOverrides().catch(() => []);
  // Month totals and budget lines are computed live from the transaction
  // rows + site overrides (lib/live-aggregates.js); the published briefing
  // still supplies the movers, net worth and deferral estimates.
  const briefing = liveBriefing([...data("transactions_2025.json"), ...data("transactions_2026.json")], records, data("loan_model.json"), data("briefing.json"), data("budgets.json"));
  const watchdog = data("watchdog.json");
  let digest = null;
  try { digest = data("digest.json"); } catch { digest = null; }
  const cov = loadCoverage();
  const months = briefing.months || [];
  if (!months.length) return (<><PageHeader title="Monthly briefing" /><Empty title="No briefing data yet">It is part of this demo's fixed synthetic dataset.</Empty></>);
  const completed = months.filter((e) => !e.partial);
  const fallback = (completed.length ? completed[completed.length - 1] : months[months.length - 1]).month;
  const sel = months.some((e) => e.month === sp?.m) ? sp.m : fallback;
  const e = months.find((x) => x.month === sel);
  const lyLabel = mlabel(`${Number(sel.slice(0, 4)) - 1}${sel.slice(4)}`);
  const findings = watchdog.findings || [];
  // An acknowledgement covers the occurrence that was showing. Recurring
  // findings keep a fixed id (e.g. staleness|ms_export), so if one clears and
  // fires again later — first_seen after the acknowledgement — it shows again.
  const ackAt = new Map();
  for (const r of records) if (r.target_type === "watchdog" && r.field === "acknowledged") ackAt.set(r.target_key, r.value === true ? String(r.edited_at || "") : null);
  const acked = findings.filter((f) => ackAt.get(f.id) && ackAt.get(f.id).slice(0, 10) >= String(f.first_seen || "")).map((f) => f.id);
  const trend = months.slice(-12).reverse();

  const tone = (v) => (v > 0 ? "negative" : v < 0 ? "pos" : "");
  const budgetActual = e.budget ? e.budget.reduce((s, l) => s + l.actual, 0) : 0;

  return (
    <>
      <PageHeader
        title={`${mlabel(sel)} briefing`}
        subtitle={<>Computed live from the transaction ledger, including site edits. Data as of {fmtDate(briefing.generated_for)}.{e.partial ? " This month is still in progress." : ""}</>}
      >
        <div style={{ flexBasis: "100%", minWidth: 0 }}>
          <Segmented label="Month" className="scroll" options={months.slice(-10).map((x) => [`/briefing?m=${x.month}`, mshort(x.month), x.month === sel])} />
        </div>
      </PageHeader>

      {digest && digest.headline ? (
        <div className="card">
          <CardHead title="This week" sub={`Digest for the week of ${fmtDate(digest.week.start)} – ${fmtDate(digest.week.end)}, from the weekly digest run`} />
          <p style={{ margin: "0 0 8px", fontWeight: 650 }}>{digest.headline}</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(digest.lines || []).map((line, i) => (
              <li key={i} style={{ margin: "3px 0" }}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <CardHead title="Watchdog" sub="Unusual charges, duplicates, price increases and hot categories" />
        <WatchdogPanel findings={findings} initialAcked={acked} configured={tokenConfigured()} />
      </div>

      <div className="cards">
        <Stat label="Income" value={money(e.income)} sub={e.income_ly != null ? `${money(e.income_ly)} in ${lyLabel}` : "no prior-year data"} />
        <Stat label="Spend" value={money(e.spend)} sub={e.spend_ly != null ? `${money(e.spend_ly)} in ${lyLabel} (${signed(e.spend - e.spend_ly)})` : "no prior-year data"} />
        <Stat label="Net" value={signed(e.net)} tone={e.net < 0 ? "neg-val" : "pos"} sub="income minus spend" />
        <Stat label="Savings rate" value={e.partial ? "—" : e.savings_rate != null ? `${e.savings_rate}%` : "—"} tone={!e.partial && e.savings_rate < 0 ? "neg-val" : ""} sub={e.partial ? "month in progress · rates land at month end" : "of take-home pay kept · after payroll savings"} />
        {e.savings_rate_incl_retirement != null && (
          <Stat label="Saved incl. retirement" value={e.partial ? "—" : `${e.savings_rate_incl_retirement}%`} tone={!e.partial && e.savings_rate_incl_retirement < 0 ? "neg-val" : ""} sub={e.partial ? "month in progress · rates land at month end" : "of gross pay · incl. 401(k)/HSA + employer (est.)"} />
        )}
        {e.net_worth ? (
          <Stat label="Net worth" value={money(e.net_worth.end)} sub={`${signed(e.net_worth.change)} across ${e.net_worth.days} monthly snapshots (monthly history begins Nov 1, 2025)`} />
        ) : null}
      </div>

      {(e.income_ly != null || e.spend_ly != null) ? <CoverageNote cov={cov} /> : null}

      {e.movers && e.movers.length ? (
        <div className="card">
          <CardHead title={`What changed vs ${lyLabel}`} sub="Largest category moves of $150 or more, with the charges behind each" />
          <div className="table-scroll">
            <table>
              <thead><tr><th>Category</th><th className="r">{mshort(sel)}</th><th className="r">{lyLabel}</th><th className="r">Change</th></tr></thead>
              <tbody>
                {e.movers.map((mv) => (
                  <tr key={mv.category}>
                    <td><strong><DrillLink href={txnHref({ mo: sel, sp: `lc:${mv.category}`, pr: mv.category === "Loans" ? e.loan_principal : null })} title={`See ${mv.category} transactions`}>{mv.category}</DrillLink></strong>{isAffected(cov, mv.category) ? <GapMark cov={cov} /> : null}
                      {mv.top && mv.top.length ? <div className="sub">{mv.top.map((t) => `${t.name} ${money(t.amount)} (${t.date.slice(5)})`).join(" · ")}</div> : null}
                    </td>
                    <td className="r">{money(mv.this)}</td>
                    <td className="r muted">{money(mv.ly)}</td>
                    <td className={`r ${tone(mv.delta)}`} style={{ fontWeight: 650 }}>{signed(mv.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {e.budget && e.budget.length ? (
        <div className="card">
          <CardHead title="Against the household budget" sub="The household budget takes effect November 2026; earlier months are measured against it as a yardstick." />
          <div className="table-scroll">
            <table>
              <thead><tr><th>Line</th><th className="hide-sm" style={{ width: "24%" }}>Used</th><th className="r">Actual</th><th className="r">Budget</th><th className="r">Over / under</th></tr></thead>
              <tbody>
                {e.budget.map((l) => (
                  <tr key={l.id}>
                    <td><DrillLink href={txnHref({ mo: sel, bl: l.id, pr: l.id === "loans" ? e.loan_principal : null })} title={`See the transactions in ${l.label}`}>{l.label}</DrillLink></td>
                    <td className="hide-sm" style={{ verticalAlign: "middle" }}><Progress value={l.actual} max={l.budget || 1} tone={l.delta > 0 ? "bad" : "good"} /></td>
                    <td className="r">{money(l.actual)}</td>
                    <td className="r muted">{money(l.budget)}</td>
                    <td className={`r ${tone(l.delta)}`}>{signed(l.delta)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td><DrillLink href={txnHref({ mo: sel, sp: "all", pr: e.loan_principal })} title="See this month's spending">Total</DrillLink></td><td className="hide-sm"></td>
                  <td className="r">{money(budgetActual)}</td>
                  <td className="r">{money(e.budget_total)}</td>
                  <td className={`r ${tone(budgetActual - e.budget_total)}`}>{signed(budgetActual - e.budget_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">Lines are a partition — every spend dollar lands in exactly one line, in the order shown on the Budgets page.</p>
        </div>
      ) : null}

      <div className="card">
        <CardHead title="Savings trend" sub="Last 12 months" />
        <p className="note" style={{ margin: "0 0 10px" }}>
          How to read this: <strong>Net</strong> is the month&rsquo;s deposited paychecks minus the month&rsquo;s spending, and the
          take-home rate is that net as a share of the paychecks. It leaves out the $1,250 a month that goes straight
          from paychecks into the 401(k)s and the HSA before the money ever reaches the bank — the <strong>Incl. retirement</strong>
          {" "}rate adds that saving back, and it is the better measure of whether the household lived within its means. A negative take-home month is not debt by itself: the difference came out of savings built up in earlier years. This household's pace is unusually even — rent and childcare dominate, and the take-home rate held close to 60% through the summer of 2026.
        </p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Month</th><th className="r">Income</th><th className="r">Spend</th><th className="r">Net</th><th className="r">Take-home rate</th><th className="r">Incl. retirement</th></tr></thead>
            <tbody>
              {trend.map((x) => (
                <tr key={x.month} className={x.month === sel ? "selrow" : ""}>
                  <td><Link href={`/briefing?m=${x.month}`}>{mlabel(x.month)}</Link>{x.partial ? <span className="fine"> · so far</span> : ""}</td>
                  <td className="r"><DrillLink href={txnHref({ mo: x.month, g: "Income" })} title="See this month's income">{money(x.income)}</DrillLink></td>
                  <td className="r"><DrillLink href={txnHref({ mo: x.month, sp: "all", pr: x.loan_principal })} title="See this month's spending">{money(x.spend)}</DrillLink></td>
                  <td className={`r ${x.net < 0 ? "negative" : "pos"}`}>{signed(x.net)}</td>
                  <td className="r">{x.partial ? "—" : x.savings_rate != null ? `${x.savings_rate}%` : "—"}</td>
                  <td className="r">{x.partial ? "—" : x.savings_rate_incl_retirement != null ? `${x.savings_rate_incl_retirement}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
