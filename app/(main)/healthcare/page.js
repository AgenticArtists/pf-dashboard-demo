import { data, money } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { PageHeader, Stat } from "../../../lib/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  hsa_paid: "badge planned",
  card_paid: "badge",
  unmatched: "badge warn",
  no_patient_cost: "badge",
};

export default function Healthcare() {
  const h = data("healthcare.json");
  const cov = h.coverage || {};
  const totals = h.totals_by_year || {};
  const years = Object.keys(totals).sort().reverse();
  const ytd = years[0];
  const t = totals[ytd] || {};
  const un = h.unreimbursed || { total: 0, by_year: {} };
  const claims = Array.isArray(h.claims) ? h.claims : [];
  const unmatchedClaims = claims.filter((c) => c.status === "unmatched");
  const uc = h.unmatched_charges || { count: 0, dollars: 0, rows: [] };

  return (
    <>
      <PageHeader title="Healthcare & claims" subtitle={`Synthetic plan statements matched to payments · claim service dates ${fmtDate(cov.claim_service_start)} – ${fmtDate(cov.claim_service_end)}.`} />

      <div className="cards">
        <Stat label={`Billed (${ytd})`} value={money(t.billed)} sub={`${t.eobs_validated || 0} validated EOBs`} />
        <Stat label={`Allowed (${ytd})`} value={money(t.allowed)} sub={`after ${money(t.discounts)} in plan discounts`} />
        <Stat label={`Plan paid (${ytd})`} value={money(t.plan_paid)} sub="Synthetic plan share" />
        <Stat label={`Patient responsibility (${ytd})`} value={money(t.responsibility_eob)} sub="what the EOBs say you pay" />
      </div>

      <div className="card">
        <h2>Unreimbursed HSA-eligible spend</h2>
        <p><strong>{money(un.total)}</strong> of patient responsibility was paid from tracked cards and bank accounts with no HSA distribution matched to it ({money(un.by_year?.[ytd])} in {ytd}).</p>
        <p className="note">{un.definition}</p>
        <p className="note">Separately, {money(h.hsa_direct_spend)} of healthcare spend went straight on the HSA card at the point of service, and claims the plan paid in full or that cost nothing are excluded from both figures.</p>
      </div>

      <div className="card">
        <h2>Coverage</h2>
        <p className="note">Claim-level detail is parsed from {cov.eobs_claim_parsed} of {cov.eob_documents} synthetic statement documents on file; the other {cov.eobs_summary_only} have summaries only. {cov.summaries_validated} of {cov.summaries_total} summaries passed the arithmetic check and feed the totals; unvalidated ones are excluded. {cov.note} Separate benefit categories may not generate a statement in the same fixture.</p>
      </div>

      <div className="card">
        <h2>By year</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Year</th><th className="r">Billed</th><th className="r">Allowed</th><th className="r">Plan paid</th><th className="r">Responsibility (EOB)</th><th className="r">Claims</th><th className="r">Paid by card</th><th className="r">Paid from HSA</th><th className="r">No payment found</th></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}><td>{y}</td><td className="r">{money(totals[y].billed)}</td><td className="r">{money(totals[y].allowed)}</td><td className="r">{money(totals[y].plan_paid)}</td><td className="r">{money(totals[y].responsibility_eob)}</td><td className="r">{totals[y].claims}</td><td className="r">{money(totals[y].card_paid)}</td><td className="r">{money(totals[y].hsa_paid)}</td><td className="r">{totals[y].unmatched_claims} · {money(totals[y].unmatched_dollars)}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2>Claims</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Service date</th><th>Patient</th><th>Provider</th><th>Type</th><th className="r">You pay</th><th>Status</th><th>Paid via</th></tr></thead>
          <tbody>
            {claims.map((c, i) => (
              <tr key={i}><td>{fmtDate(c.date)}</td><td>{c.patient}</td><td>{c.provider}</td><td>{c.service_type}</td><td className="r">{money(c.responsibility)}</td><td><span className={STATUS_TONE[c.status] || "badge"}>{c.status_label}</span></td><td>{c.payment_label ? `${c.payment_label} · ${fmtDate(c.payment_date)}` : ""}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="grid2 section-gap">
        <div className="card">
          <h2>EOBs with no payment found ({h.unmatched_claims?.count ?? unmatchedClaims.length} · {money(h.unmatched_claims?.dollars)})</h2>
          <div className="table-scroll"><table>
            <thead><tr><th>Service date</th><th>Provider</th><th className="r">You pay</th></tr></thead>
            <tbody>
              {unmatchedClaims.map((c, i) => (
                <tr key={i}><td>{fmtDate(c.date)}</td><td>{c.provider}</td><td className="r">{money(c.responsibility)}</td></tr>
              ))}
            </tbody>
          </table></div>
          <p className="note">The matcher searched HSA distributions and every ledger account for the exact patient-responsibility amount. No hit can mean the charge was paid another way, is still unpaid, or the amount was billed differently.</p>
        </div>
        <div className="card">
          <h2>Charges with no EOB ({uc.count} · {money(uc.dollars)})</h2>
          <div className="table-scroll"><table>
            <thead><tr><th>Date</th><th>Charge</th><th>Type</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {(uc.rows || []).map((r, i) => (
                <tr key={i}><td>{fmtDate(r.date)}</td><td>{r.vendor || r.name}</td><td>{r.subcategory}</td><td className="r">{money(r.amount)}</td></tr>
              ))}
            </tbody>
          </table></div>
          <p className="note">Healthcare charges on tracked accounts inside the coverage window that no parsed claim payment points at{h.recent_charges?.count ? `; ${h.recent_charges.count} later charge${h.recent_charges.count === 1 ? "" : "s"} (${money(h.recent_charges.dollars)}) are too recent to expect an EOB and are not listed` : ""}. An unmatched charge can mean a missing claim or a billing error — or spend that was never claimable, a claim inside one of the summary-only EOBs, or the second half of a split payment.</p>
        </div>
      </div>
    </>
  );
}
