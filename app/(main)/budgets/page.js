import { data, money } from "../../../lib/data";
import { money0, fmtDate, PERSON_COLORS } from "../../../lib/format";
import { getOverrides, applyRecordsToTxns } from "../../../lib/overrides";
import { PageHeader, Progress, DrillLink } from "../../../lib/ui";
import { txnHref } from "../../../lib/drill";
import { Icon } from "../../../lib/icons";
import { computeBudget, paceStatus, MONTH_NAMES } from "../../../lib/insights";

export const dynamic = "force-dynamic";

const r2 = (x) => Math.round(x * 100) / 100;
const TONE = { ok: "good", ahead: "warn", over: "bad" };
const STATUS_TEXT = { ok: "On track", ahead: "Ahead of pace", over: "Over budget" };

export default async function Budgets() {
  const budgets = data("budgets.json");
  const records = await getOverrides().catch(() => []);
  const txns = applyRecordsToTxns(data("transactions_2026.json"), records);
  const b = computeBudget(txns, budgets);
  let ledger = null;
  try { ledger = data("allowance_ledger.json"); } catch { ledger = null; }
  const ledgerPeople = ledger && ledger.people ? ["Daniel", "Maya"].filter((p) => ledger.people[p]) : [];
  const effLabel = budgets.effective ? `${MONTH_NAMES[Number(budgets.effective.slice(5)) - 1]} ${budgets.effective.slice(0, 4)}` : "";
  const preview = b.month < (budgets.effective || "");
  const left = r2(b.outBudget - b.outActual);
  const counts = { ok: 0, ahead: 0, over: 0 };
  for (const l of b.spendLines) counts[paceStatus(l.actual, l.budget, b.elapsed)] += 1;

  return (
    <>
      <PageHeader
        title={`${MONTH_NAMES[b.mm - 1]} budget`}
        subtitle={<>{preview ? <>This budget takes effect {effLabel}; {MONTH_NAMES[b.mm - 1]} is shown as a preview against the caps. </> : <>Budget in effect since {effLabel}. </>}Data as of {fmtDate(b.asOf)}: day {b.asOfDay} of {b.daysInMonth}.</>}
        actions={preview ? <span className="badge warn">Preview</span> : null}
      />

      <div className="transaction-layout">
        <div>
          <section className="card flush">
            <div className="budget-table">
              <div className="budget-table-head"><span>Expenses</span><span className="r">Budget</span><span className="r">Actual</span><span className="r">Remaining</span></div>
              {b.spendLines.map((l) => {
                const status = paceStatus(l.actual, l.budget, b.elapsed);
                const remaining = r2(l.budget - l.actual);
                return (
                  <div className="budget-line" key={l.id}>
                    <div className="budget-line-top">
                      <div className="budget-line-name">
                        <span><DrillLink href={txnHref({ mo: b.month, bl: l.id })} title={`See the transactions in ${l.label}`}>{l.label}</DrillLink></span>
                        {l.note && <div className="fine">{l.note}</div>}
                      </div>
                      <span className="r num">{money0(l.budget)}</span>
                      <span className="r num">{money(l.actual)}</span>
                      <span className={`r num ${remaining < 0 ? "negative" : ""}`} style={{ fontWeight: 650 }}>{money(remaining)}</span>
                    </div>
                    <div className="budget-line-bar">
                      <Progress value={l.actual} max={l.budget} tone={TONE[status]} marker={b.elapsed} />
                      <span className={`budget-line-status ${TONE[status]}`}>{l.budget ? `${Math.round((l.actual / l.budget) * 100)}%` : "—"} · {STATUS_TEXT[status]}</span>
                    </div>
                  </div>
                );
              })}
              <div className="budget-table-foot"><span><DrillLink href={txnHref({ mo: b.month, sp: "all" })} title="See this month's spending">Total expenses</DrillLink></span><span className="r num">{money0(b.outBudget)}</span><span className="r num">{money(b.outActual)}</span><span className={`r num ${left < 0 ? "negative" : ""}`}>{money(left)}</span></div>
            </div>
          </section>

          <section className="card flush">
            <div className="budget-table">
              <div className="budget-table-head"><span>Income</span><span className="r">Budget</span><span className="r">Actual</span><span className="r">Remaining</span></div>
              {b.incomeLines.map((l) => (
                <div className="budget-line" key={l.id}>
                  <div className="budget-line-top">
                    <div className="budget-line-name"><span><DrillLink href={txnHref({ mo: b.month, bi: l.id })} title={`See the deposits in ${l.label}`}>{l.label}</DrillLink></span></div>
                    <span className="r num">{money0(l.budget)}</span>
                    <span className="r num">{money(l.actual)}</span>
                    <span className="r num muted">{money(r2(l.budget - l.actual))}</span>
                  </div>
                  <div className="budget-line-bar"><Progress value={l.actual} max={l.budget} tone="good" marker={b.elapsed} /><span className="budget-line-status">{l.budget ? `${Math.round((l.actual / l.budget) * 100)}% received` : "—"}</span></div>
                </div>
              ))}
              <div className="budget-table-foot"><span>Total income</span><span className="r num">{money0(b.inBudget)}</span><span className="r num">{money(b.inActual)}</span><span className="r num">{money(r2(b.inBudget - b.inActual))}</span></div>
            </div>
          </section>
          <p className="note">Every spend dollar lands in exactly one line: fixed lines claim their categories first, and whatever is left falls to each person&apos;s allowance (or the joint line), so the lines always sum to the month&apos;s net spend. The thin tick on each bar marks how much of the month has passed.</p>
          <p className="fine">{budgets.source}</p>

          {ledgerPeople.length > 0 && (
            <section className="card" style={{ marginTop: 16 }}>
              <h2>Allowance rollover</h2>
              <p className="note" style={{ marginTop: 4 }}>Unspent allowance rolls over; overspending carries forward as a negative balance. Funded {money0(ledger.funded_per_month?.Daniel || 600)}/mo each since {MONTH_NAMES[Number(ledger.start_month.slice(5)) - 1]} {ledger.start_month.slice(0, 4)} — the same allowance actuals as the budget lines above, accumulated.</p>
              {ledgerPeople.map((person) => {
                const lp = ledger.people[person];
                const adj = (ledger.opening_adjustments || []).find((a) => a.person === person);
                return (
                  <div key={person} style={{ marginTop: 14 }}>
                    <div className="summary-line" style={{ borderBottom: 0, paddingBottom: 0 }}>
                      <div className="label"><span className="person-dot" style={{ background: PERSON_COLORS[person], marginRight: 6, verticalAlign: 1 }} />{person}&apos;s rollover balance</div>
                      <div className={`value num ${lp.current_balance < 0 ? "neg-val" : ""}`} style={{ fontSize: 24, fontWeight: 750 }}>{money(lp.current_balance)}</div>
                      {adj && <div className="sub fine">Includes the {money(adj.amount)} synthetic opening adjustment.</div>}
                      {lp.opening_adjustment !== 0 && !adj && <div className="sub fine">Includes an opening adjustment of {money(lp.opening_adjustment)}.</div>}
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead><tr><th>Month</th><th className="r">Funded</th><th className="r">Spent</th><th className="r">Net</th><th className="r">Balance</th></tr></thead>
                        <tbody>
                          {lp.months.map((m) => (
                            <tr key={m.month}>
                              <td data-label="Month">{MONTH_NAMES[Number(m.month.slice(5)) - 1]} {m.month.slice(0, 4)}{m.partial ? " (so far)" : ""}</td>
                              <td data-label="Funded" className="r num">{money(m.funded)}</td>
                              <td data-label="Spent" className="r num">{money(m.spent)}</td>
                              <td data-label="Net" className={`r num ${m.net < 0 ? "negative" : ""}`}>{money(m.net)}</td>
                              <td data-label="Balance" className={`r num ${m.balance < 0 ? "negative" : ""}`} style={{ fontWeight: 650 }}>{money(m.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <aside className="summary-rail budget-rail">
          <div className="card">
            <h2>Left to spend</h2>
            <div className={`value num ${left < 0 ? "neg-val" : ""}`} style={{ fontSize: 28, fontWeight: 750, letterSpacing: "-.03em" }}>{money(left)}</div>
            <div className="note" style={{ marginBottom: 12 }}>{money0(b.outActual)} spent of {money0(b.outBudget)}</div>
            <Progress value={b.outActual} max={b.outBudget} tone={TONE[paceStatus(b.outActual, b.outBudget, b.elapsed)]} marker={b.elapsed} />
            <div className="summary-line" style={{ marginTop: 14 }}><div className="label">Money in</div><div className="value num">{money(b.inActual)}</div><div className="sub">of {money0(b.inBudget)} expected</div></div>
            <div className="summary-line"><div className="label">Saved so far</div><div className={`value num ${b.saved < 0 ? "neg-val" : ""}`}>{money(b.saved)}</div><div className="sub">target {money0(budgets.savings_target || 0)}/mo to savings</div></div>
            <div className="summary-line"><div className="label">Month progress</div><div className="value num">{Math.round(b.elapsed * 100)}%</div><div className="sub">{b.asOfDay} of {b.daysInMonth} days</div></div>
            <div className="summary-line">
              <div className="label" style={{ marginBottom: 8 }}>Lines</div>
              <div className="budget-counts">
                <span className="badge good"><Icon name="check" size={12} />{counts.ok} on track</span>
                <span className="badge warn">{counts.ahead} ahead</span>
                <span className="badge bad">{counts.over} over</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
