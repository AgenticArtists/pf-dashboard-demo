import { data } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { PageHeader, CardHead } from "../../../lib/ui";
import { Icon } from "../../../lib/icons";

export const dynamic = "force-dynamic";

const VERDICT_CLASS = { ACT: "good", NOTE: "", DECIDE: "warn", SKIP: "bad" };

export default function EnrollmentPrep() {
  const e = data("enrollment.json");
  const a = e.analysis || {};
  const sections = Array.isArray(a.sections) ? a.sections : [];

  return (
    <>
      <PageHeader
        title={`Open enrollment prep · ${e.plan_year}`}
        subtitle={<>Fictional open-enrollment comparison for plan year {e.plan_year}. This page is prep only — no election is submitted from the demo. Analysis run {fmtDate(e.as_of)} against synthetic healthcare, childcare, and payroll inputs.</>}
      />

      <div className="cards enroll-kpis">
        <div className="card">
          <div className="label">Recommended elections total</div>
          <div className="value">Synthetic comparison</div>
          <div className="sub">Use the fictional rows below to compare the demo household&apos;s plan choices.</div>
        </div>
        <div className="card">
          <div className="label">Contribution focus</div>
          <div className="value">HSA + dependent care</div>
          <div className="sub">The fictional recommendation separates household coverage from savings elections.</div>
        </div>
        <div className="card">
          <div className="label">Single most important action</div>
          <div className="value">Review the fictional inputs</div>
          <div className="sub">The Carter household should verify the synthetic assumptions before treating this page as advice.</div>
        </div>
      </div>

      <div className="card">
        <h2>What&apos;s changing in {e.plan_year} — and what applies to you</h2>
        <table>
          <tbody>
            {(e.mailer || []).map((m, i) => (
              <tr key={i}>
                <td>
                  <strong>{m.title}</strong>
                  <div className="sub">{m.text}</div>
                </td>
                <td className="r" style={{ whiteSpace: "nowrap" }}><span className={`badge ${VERDICT_CLASS[m.verdict] ?? ""}`}>{m.verdict}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Change at this enrollment</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Change</th><th>Current</th><th>Recommended</th><th className="r">Annual effect</th></tr></thead>
          <tbody>
            {(e.change || []).map((c, i) => (
              <tr key={i}>
                <td><strong>{c.title}</strong><div className="sub">{c.note}</div></td>
                <td>{c.current}</td>
                <td>{c.recommended}</td>
                <td className="r">{c.delta}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2>Keep as-is</h2>
        <table>
          <tbody>
            {(e.keep || []).map((k, i) => (
              <tr key={i}><td><strong>{k.item}</strong><div className="sub">{k.why}</div></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {e.hdhp_explainer && (
        <div className="card">
          <h2>{e.hdhp_explainer.title}</h2>
          {(e.hdhp_explainer.paras || []).map((p, i) => <p key={i}>{p}</p>)}
          {Array.isArray(e.hdhp_explainer.bullets) && (
            <ul>
              {e.hdhp_explainer.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2>Open enrollment analysis</h2>
        <div className="callout good" style={{ marginBottom: 6 }}><span className="callout-icon"><Icon name="sparkle" size={16} /></span><div className="callout-body"><strong>Bottom line</strong>{a.bottom_line}</div></div>

        {sections.map((s, i) => (
          <div key={i}>
            <h3>{s.h}</h3>
            {(s.paras || []).map((p, j) => <p key={j}>{p}</p>)}
            {(s.items || []).map((it, j) => (
              <p key={j}><strong>{it.h3}</strong> — {it.text}</p>
            ))}
            {Array.isArray(s.bullets) && (
              <ul>
                {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            )}
          </div>
        ))}

        <h3>Numbers summary</h3>
        <div className="table-scroll"><table>
          <thead><tr><th>Item</th><th className="r">Current annual</th><th className="r">Recommended annual</th><th className="r">Difference</th></tr></thead>
          <tbody>
            {(a.table || []).map((r, i) => (
              <tr key={i}><td>{r[0]}</td><td className="r">{r[1]}</td><td className="r">{r[2]}</td><td className="r">{r[3]}</td></tr>
            ))}
            {a.table_total && (
              <tr className="total"><td>{a.table_total[0]}</td><td className="r">{a.table_total[1]}</td><td className="r">{a.table_total[2]}</td><td className="r">{a.table_total[3]}</td></tr>
            )}
          </tbody>
        </table></div>
        <p className="note">{a.table_note}</p>
      </div>

      {e.baby_scenario && (
        <div className="card">
          <h2>{e.baby_scenario.title}</h2>
          {(e.baby_scenario.paras || []).map((p, i) => <p key={i}>{p}</p>)}
          {(e.baby_scenario.items || []).map((it, j) => (
            <p key={j}><strong>{it.h3}</strong> — {it.text}</p>
          ))}
          {Array.isArray(e.baby_scenario.bullets) && (
            <ul>
              {e.baby_scenario.bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          )}
          {e.baby_scenario.total && <div className="callout good"><span className="callout-icon"><Icon name="sparkle" size={16} /></span><div className="callout-body"><strong>Package total</strong>{e.baby_scenario.total}</div></div>}
        </div>
      )}

      <div className="card">
        <h2>Verify in the portal before submitting</h2>
        <div className="checklist">
          {(e.verify || []).map((v, i) => <div key={i} className="checklist-item"><span className="check-box"><Icon name="check" size={12} /></span><span>{v}</span></div>)}
        </div>
        <p className="note">Updated for the fictional Carter household demo. No real plan, employer, election, or document is represented.</p>
      </div>
    </>
  );
}
