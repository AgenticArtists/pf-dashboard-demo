import { data, money } from "../../../lib/data";
import { Kv, PageHeader } from "../../../lib/ui";

export const dynamic = "force-dynamic";

export default function Records() {
  const r = data("records.json");
  const tax = r.tax || {};
  const ffr = tax.filed_federal_return || {};
  const loans = (r.loans && r.loans.loans) || [];
  const ins = r.insurance || {};
  const maya = r.maya || {};
  const daniel = r.daniel || {};
  const comp = daniel.official_comp_statement_fy27 || {};
  const taxHistory = r.tax_history || {};
  const w2s = Array.isArray(taxHistory.daniel_northstar_w2) ? taxHistory.daniel_northstar_w2 : [];
  const programs = r.programs || {};
  const benefitPrograms = Array.isArray(programs.programs) ? programs.programs : [];
  const apple = r.apple || {};
  const lease = r.lease || {};
  const stmts = Array.isArray(apple.statements) ? [...apple.statements].reverse() : [];
  const subs = apple.subscriptions_as_of_2026_10_13 || {};

  return (
    <>
      <PageHeader title="Records" subtitle="Synthetic reference facts for the Carter household demo: tax estimates, loans, insurance, employment, lease, and benefits." />

      <div className="card">
        <h2>Taxes — 2025</h2>
        <Kv obj={tax.household_totals || {}} />
        {ffr.agi != null && (
          <>
            <h3>Filed federal return</h3>
            <Kv obj={ffr} keys={["filing_status", "w2_box1_total_line1a", "taxable_interest", "total_income", "agi", "standard_deduction", "qbi_deduction_8995", "taxable_income", "tax_before_credits", "self_employment_tax", "total_tax", "federal_withheld", "estimated_payments", "amount_owed", "estimated_tax_penalty", "effective_rate_pct_of_agi"]} />
          </>
        )}
      </div>

      {w2s.length > 0 && (
        <div className="card">
          <h2>Tax history — Daniel's synthetic pay records</h2>
          <div className="table-scroll"><table>
            <thead><tr><th>Year</th><th className="r">Box 1 wages</th><th className="r">Federal withheld</th><th className="r">SS wages</th><th className="r">401(k) (box 12 D)</th><th className="r">State tax</th></tr></thead>
            <tbody>
              {w2s.map((w2) => (
                <tr key={w2.year}>
                  <td>{w2.year}</td>
                  <td className="r">{money(w2.box1_wages)}</td>
                  <td className="r">{money(w2.fed_withheld)}</td>
                  <td className="r">{money(w2.ss_wages)}</td>
                  <td className="r">{w2.box12?.D_401k == null ? "—" : money(w2.box12.D_401k)}</td>
                  <td className="r">{Array.isArray(w2.states) ? w2.states.map((state) => `${state.state} ${money(state.tax)}`).join(" · ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {w2s.find((w2) => w2.year === 2022)?.note && <p className="note">{w2s.find((w2) => w2.year === 2022).note}</p>}
          {Array.isArray(taxHistory.flags) && taxHistory.flags.map((flag, i) => <p key={i} className="note">{flag}</p>)}
        </div>
      )}

      <div className="card">
        <h2>Loans</h2>
        {loans.map((l, i) => (
          <div key={i} className="record-block">
            <h3>{l.lender} — {l.purpose || l.type || l.collateral || ""}</h3>
            <Kv obj={l} keys={Object.keys(l).filter((k) => !["lender", "type", "note"].includes(k))} />
            {l.note && <p className="note">{l.note}</p>}
          </div>
        ))}
      </div>

      <div className="grid2 section-gap">
        <div className="card">
          <h2>Insurance — synthetic auto policy</h2>
          <Kv obj={ins.auto || {}} />
        </div>
        <div className="card">
          <h2>Insurance — renters</h2>
          <Kv obj={ins.renters || {}} />
        </div>
      </div>

      <div className="card">
          <h2>Maya — Brightline Studio</h2>
        <Kv obj={maya} keys={["current_status", "hire_date"]} />
        <Kv obj={typeof maya.current_salary === "object" ? maya.current_salary : { "Current salary": maya.current_salary }} />
        {maya.retirement_401k && (
          <>
            <h3>401(k) (ADP)</h3>
            <Kv obj={maya.retirement_401k} keys={Object.keys(maya.retirement_401k).filter((k) => /balance|vested|deferral|roth|performance|fund|provider|employer_match|auto_increase/.test(k))} />
          </>
        )}
      </div>

      {(daniel.employer || comp.base_pay_fy27 != null || daniel.latest_stub || daniel.retirement_401k) && (
        <div className="card">
          <h2>Daniel — Northstar Systems</h2>
          {daniel.employer && <p>{daniel.employer}</p>}
          {Object.keys(comp).length > 0 && (
            <>
              <h3>FY27 compensation statement</h3>
              <Kv obj={{
                "FY26 base pay": comp.base_pay_fy26,
                "FY26 raise": comp.raise?.total,
                "Merit increase": comp.raise?.merit,
                "Market adjustment": comp.raise?.market_adjustment,
                "Raise percent_pct": comp.raise?.pct,
                "FY27 base pay": comp.base_pay_fy27,
                "FY26 AIP awarded": comp.aip_awarded_fy26?.amount,
                "AIP percent_pct": comp.aip_awarded_fy26?.pct_of_base,
                "Additional FY26 awards": comp.additional_awards_fy26,
                "Stated total compensation": comp.stated_total_comp,
              }} />
            </>
          )}
          {daniel.pay_structure && <Kv obj={{ "Current annualized salary": daniel.pay_structure.current_salary_annualized, "Pay frequency": daniel.pay_structure.frequency }} />}
          {daniel.latest_stub && (
            <>
              <h3>Latest pay stub</h3>
              <Kv obj={{ "Pay date": daniel.latest_stub.pay_date, Gross: daniel.latest_stub.gross, "Net pay": daniel.latest_stub.net_pay }} />
            </>
          )}
          {daniel.retirement_401k && (
            <>
              <h3>Retirement</h3>
              <Kv obj={{ "His deferral": daniel.retirement_401k.his_deferral, "Employer funding": daniel.retirement_401k.employer_funding, Beneficiaries: daniel.retirement_401k.beneficiaries }} />
            </>
          )}
          {Array.isArray(daniel.flags) && daniel.flags.map((flag, i) => <p key={i} className="note">{flag}</p>)}
        </div>
      )}

      <div className="card">
        <h2>Lease — Cedar Grove Village</h2>
        <Kv obj={{
          Property: lease.property,
          Landlords: Array.isArray(lease.landlords) ? lease.landlords.join(", ") : lease.landlords,
          Tenants: Array.isArray(lease.tenants) ? lease.tenants.join(", ") : lease.tenants,
          Term: lease.term ? `${lease.term.start} → ${lease.term.amended_end || lease.term.original_end}` : null,
          Rent: lease.rent ? `${money(lease.rent.current)}/mo → ${money(lease.rent.amended)}/mo from ${lease.rent.amended_from}` : null,
          "Security deposit": lease.security_deposit ? money(lease.security_deposit.amount) : null,
          "Notice deadline": lease.notice_deadline_for_current_term,
          "Tenant early termination": lease.tenant_early_termination,
          "Landlord early termination": lease.landlord_early_termination,
          "Insurance requirement": lease.insurance_requirement,
        }} />
      </div>

      <div className="card">
        <h2>Digital card statements</h2>
        <Kv obj={apple.current || {}} />
        <div className="table-scroll" style={{ marginTop: 10 }}><table>
          <thead><tr><th>Month</th><th className="r">Charges</th><th className="r">Payments</th><th className="r">Balance</th></tr></thead>
          <tbody>
            {stmts.slice(0, 21).map((s, i) => (
              <tr key={i}><td>{s.month || s.period || s.statement_month}</td><td className="r">{money(s.charges ?? s.total_charges)}</td><td className="r">{money(s.payments ?? s.total_payments)}</td><td className="r">{money(s.balance ?? s.statement_balance ?? s.ending_balance)}</td></tr>
            ))}
          </tbody>
        </table></div>
        {Array.isArray(subs.renewing) && (
          <>
            <h3>Subscriptions renewing ({subs.renewing.length})</h3>
            <table>
              <thead><tr><th>Service</th><th className="r">Price</th><th>Owner</th><th>Renews</th></tr></thead>
              <tbody>
                {subs.renewing.map((s, i) => (<tr key={i}><td>{s.name}</td><td className="r">{typeof s.price === "number" ? money(s.price) : s.price}</td><td>{s.owner}</td><td>{s.renews}</td></tr>))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {benefitPrograms.length > 0 && (
        <div className="card">
          <h2>Fictional benefit programs</h2>
          {benefitPrograms.map((program, i) => (
            <div key={i} className="record-block">
              <h3>{program.name}</h3>
              <Kv obj={{ Vendor: program.vendor, Contact: program.contact }} />
              {program.terms && <p>{program.terms}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
