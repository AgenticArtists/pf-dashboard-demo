import { data, money } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { Kv, PageHeader, Stat, CardHead } from "../../../lib/ui";
import { getOverrides, tokenConfigured } from "../../../lib/overrides";
import BenefitToggle from "./toggle";

export const dynamic = "force-dynamic";
const TOGGLEABLE = ["spouse_life_500k", "umbrella_1m", "pai_family"];

export default async function Benefits() {
  const b = data("benefits.json");
  const planned = { ...((data("benefit_plan.json").planned) || {}) };
  const records = await getOverrides().catch(() => []);
  for (const r of records) if (r.target_type === "benefit" && r.field === "planned") planned[r.target_key] = r.value;
  const configured = tokenConfigured();
  const elections = Array.isArray(b.elections) ? b.elections : [];
  const actions = Array.isArray(b.enrollment_actions) ? b.enrollment_actions : [];
  const pay = data("pay_series.json");
  const stubs = Array.isArray(pay.stubs) ? pay.stubs : [];
  const ret = b.retirement || {};
  const hsa = b.hsa || {};

  return (
    <>
      <PageHeader title="Benefits" subtitle={`Daniel's Northstar Systems benefits, retirement and HSA · as of ${fmtDate(b.as_of)}.`} />
      <div className="cards">
        <Stat label="Elections per pay" value={money(b.elections_total_per_pay)} sub={`${b.pay_periods_per_year} pay periods/yr`} />
        <Stat label="Retirement (WealthPortal)" value={money(ret.total_wealth_accumulation)} sub={`as of ${fmtDate(ret.as_of)} · savings rate ${ret.annual_savings_rate_pct}%`} />
        <Stat label="HSA balance" value={money(hsa.total ?? hsa.balance)} sub={`${hsa.fund || ""} · as of ${fmtDate(hsa.as_of)}`} />
        <Stat label="DCFSA" value={money(b.dcfsa?.annual_election ?? b.dcfsa?.annual)} sub="per year" />
      </div>

      <div className="card">
        <h2>2026 elections</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Item</th><th>Group</th><th>Covered</th><th className="r">Per pay</th><th className="r">Annual</th></tr></thead>
          <tbody>
            {elections.map((e, i) => (
              <tr key={i}><td>{e.item}</td><td>{e.group}</td><td>{e.covered}</td><td className="r">{money(e.per_pay)}</td><td className="r">{money(e.annual)}</td></tr>
            ))}
            <tr className="total"><td colSpan={3}>Total</td><td className="r">{money(b.elections_total_per_pay)}</td><td className="r">{money((b.elections_total_per_pay || 0) * (b.pay_periods_per_year || 26))}</td></tr>
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2>Open-enrollment actions</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Action</th><th>Current</th><th className="r">Annual cost</th><th>Status</th></tr></thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td>{a.title || a.name || a.id}</td><td>{a.current || ""}</td><td className="r">{money(a.annual)}</td>
                <td>{TOGGLEABLE.includes(a.id)
                  ? <BenefitToggle id={a.id} initialPlanned={planned[a.id]} configured={configured} />
                  : (planned[a.id] ? <span className="badge planned">Planned</span> : <span className="badge">Not planned</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="note">In this demo the toggles are illustrations only — nothing on this page writes anywhere, and the plan figures are part of the synthetic dataset.</p>
      </div>

      <div className="grid2 section-gap">
        <div className="card">
          <h2>Retirement detail</h2>
          <Kv obj={{ "401(k) balance (portal)": ret.plan_401k?.balance, "Northstar Systems-funded traditional": ret.plan_401k?.northstar_traditional, "Self-funded traditional": ret.plan_401k?.self_traditional, "Roth": ret.plan_401k?.roth, "Cash Balance Plan": ret.cash_balance_plan?.balance, "His contribution": ret.plan_401k ? `${ret.plan_401k.his_contribution_pct}% traditional` : null }} />
          {ret.note && <p className="note">{ret.note}</p>}
        </div>
        <div className="card">
          <h2>HSA (Northstar Benefits)</h2>
          <Kv obj={hsa} keys={["administrator", "as_of", "cash_balance", "invested_balance", "total", "fund", "auto_invest", "annual_target", "portfolio_return_ytd_pct"]} />
          {hsa.receipt_stash && <p className="note">{hsa.receipt_stash}</p>}
        </div>
      </div>

      <div className="card">
        <h2>Pay history (stubs on file)</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Pay date</th><th>Employer</th><th className="r">Gross</th><th className="r">Pre-tax</th><th className="r">Taxes</th><th className="r">Net</th></tr></thead>
          <tbody>
            {stubs.map((s, i) => (
              <tr key={i}><td>{s.pay_date || s.date}</td><td>{s.employer || "—"}</td><td className="r">{money(s.gross)}</td><td className="r">{money(s.pre_tax_total ?? s.pre_tax)}</td><td className="r">{money(s.taxes_total ?? s.taxes)}</td><td className="r">{money(s.net)}</td></tr>
            ))}
          </tbody>
        </table></div>
        {pay.latest_ytd && (<><h3>Latest YTD</h3><Kv obj={pay.latest_ytd} /></>)}
      </div>
    </>
  );
}
