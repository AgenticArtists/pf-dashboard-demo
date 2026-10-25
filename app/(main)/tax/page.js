import { data, money } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { PageHeader, Empty } from "../../../lib/ui";
import { Icon } from "../../../lib/icons";

export const dynamic = "force-dynamic";

const PRETAX_LABELS = {
  "401(k) Contribution": "401(k) (8%)",
  "Benefits (pre-tax)": "Benefits (pre-tax)",
  "Flex Spending (Dep Care)": "Dependent care FSA",
  "HSA Contribution": "HSA",
  "Medical premium": "Medical premium",
  "MetLife Preferred Dental": "Dental premium",
  "Voluntary Vision Care": "Vision premium",
};

function Bal({ v }) {
  if (v > 0) return <span className="negative">{money(v)} due</span>;
  if (v < 0) return <span className="pos">{money(-v)} refund</span>;
  return <span>{money(0)}</span>;
}

export default function Tax() {
  const t = data("tax_projection.json");
  if (!t || !t.federal) return (<><PageHeader title="2026 tax projection" /><Empty title="No projection yet">It is part of this demo's fixed synthetic dataset.</Empty></>);
  const f = t.federal, b = t.daniel, r = t.maya, inc = t.income, fix = t.w4_fix, gen = t.generated_from;
  const mayaShare = Math.round(100 * (r.box1 + inc.se_1099_fy) / (inc.box1_total + inc.se_1099_fy + inc.other_fy));
  return (
    <>
      <PageHeader
        title="2026 tax projection"
        subtitle={<>Married filing jointly, one child. Anchored to fictional pay stubs (Daniel through {fmtDate(gen.daniel_stub_latest)}, Maya through {fmtDate(gen.maya_stub)}) and synthetic ledger income through {fmtDate(gen.ledger_through)}; recomputed from the demo dataset. This is a projection, not a filing.</>}
        actions={<span className="badge info">Projection</span>}
      />

      <div className="cards">
        <div className="card"><div className="label">Federal balance</div><div className="value"><Bal v={f.balance_due} /></div>
          <div className="sub">total tax {money(f.total_tax)} vs {money(f.withholding)} withheld</div></div>
        <div className="card"><div className="label">Combined</div><div className="value"><Bal v={t.combined_balance_due} /></div>
          <div className="sub">at April 2027 filing, before any fix below · Texas has no state income tax, so federal is the whole projection</div></div>
        <div className="card"><div className="label">Federal effective rate</div><div className="value">{f.effective_rate}%</div>
          <div className="sub">marginal bracket {Math.round(f.marginal_rate * 100)}% · AGI {money(inc.agi)}</div></div>
      </div>

      <div className="card">
        <h2>How the income builds</h2>
        <table>
          <tbody>
            <tr><td>Daniel W-2 wages (Box 1)</td><td className="r">{money(b.box1)}</td></tr>
            <tr><td className="note" style={{ paddingLeft: 18, paddingTop: 0 }}>gross {money(b.gross)} less pre-tax: {Object.entries(b.pretax).map(([k, v]) => `${PRETAX_LABELS[k] || k} ${money(v)}`).join(" · ")}</td><td></td></tr>
            <tr><td>Maya W-2 wages (Box 1)</td><td className="r">{money(r.box1)}</td></tr>
            <tr><td className="note" style={{ paddingLeft: 18, paddingTop: 0 }}>gross {money(r.gross)} less her 401(k) at 7% ({money(r.k401)})</td><td></td></tr>
            <tr><td>Other contract income</td><td className="r">{money(inc.se_1099_fy)}</td></tr>
            <tr><td className="note" style={{ paddingLeft: 18, paddingTop: 0 }}>year-to-date {money(inc.se_1099_ytd)} from the synthetic ledger, paced to a full year</td><td></td></tr>
            <tr><td>Interest, dividends &amp; other</td><td className="r">{money(inc.other_fy)}</td></tr>
            <tr><td>Adjusted gross income</td><td className="r"><strong>{money(inc.agi)}</strong></td></tr>
            <tr><td className="note" style={{ paddingLeft: 18, paddingTop: 0 }}>less the $32,200 standard deduction → taxable income {money(f.taxable)}</td><td></td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Federal detail</h2>
        <table>
          <tbody>
            <tr><td>Tax before credits</td><td className="r">{money(f.tax_before_credits)}</td></tr>
            <tr><td>Child tax credit</td><td className="r">−{money(f.ctc)}</td></tr>
            <tr><td>Income tax</td><td className="r">{money(f.income_tax)}</td></tr>
            <tr><td>Self-employment tax</td><td className="r">{money(f.se_tax)}</td></tr>
            <tr><td><strong>Total federal tax</strong></td><td className="r"><strong>{money(f.total_tax)}</strong></td></tr>
            <tr><td>Withholding — Daniel</td><td className="r">{money(b.fed_wh)}</td></tr>
            <tr><td>Withholding — Maya</td><td className="r">{money(r.fed_wh)}</td></tr>
            <tr><td><strong>Balance</strong></td><td className="r"><strong><Bal v={f.balance_due} /></strong></td></tr>
          </tbody>
        </table>
        <p className="note">
          The demo withholding comparison allocates the fictional tax projection across Daniel and Maya. Maya's income is about {mayaShare}% of the household total.
        </p>
      </div>

      <div className="card" style={{ borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="sparkle" size={17} />Fixing it inside 2026</h2>
        <p>
          Daniel has <strong>{fix.remaining_daniel_checks} paychecks left</strong> this year after today. Adding extra
          withholding on his W-4 (Step 4c) of <strong>{money(fix.extra_per_check_to_zero)} per check</strong> zeroes the
          projected federal balance; <strong>{money(fix.extra_per_check_safe_harbor)} per check</strong> reaches the
          90%-of-tax safe harbor ({money(fix.safe_harbor_target)}) and avoids any underpayment penalty — withholding is
          currently {money(fix.safe_harbor_gap)} short of that line.
        </p>
        <p className="note">
          For 2027, the structural fix is one Step 3 claim in the household, not two: keep the child credit on Daniel's
          W-4 and remove it from Maya's. Her withholding then runs about $83 per paycheck higher, which tracks her share of the tax as it is earned.
        </p>
      </div>

      <div className="card">
        <h2>Assumptions &amp; checks</h2>
        <ul className="insights">
          {t.assumptions.map((a, i) => <li key={i} className="note">{a}</li>)}
        </ul>
        <p className="note">
          Sensitivity: if Maya's reduced schedule ($1,416/period) persists instead of resuming, the federal balance falls to {money(t.sensitivity_reduced_hours.federal_balance)}.
          Engine check: run against the filed 2025 return (AGI {money(t.validation.filed_agi)}), this engine produces{" "}
          {money(t.validation.engine_tax)} vs the filed {money(t.validation.filed_tax)} — a {t.validation.delta_pct}% difference.
        </p>
        <p className="note">Sources: {t.sources.join(" ")}</p>
      </div>
    </>
  );
}
