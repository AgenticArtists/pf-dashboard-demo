import { data } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { PageHeader, Empty } from "../../../lib/ui";

export const dynamic = "force-dynamic";

// Decisions & theses (Option B Phase 3, 2026-10-22): the feedback
// loop for the research pipeline. Allocation targets live here as
// thesis records — statement, the claims that support and challenge
// them, and the conditions under which they would be revised — and
// every material decision is journaled BEFORE its outcome is known,
// linked to the claim ids that motivated it, with the condition
// that would prove it wrong. Source forecast scores arrive from the
// quarterly resolution pass.

function ClaimList({ items }) {
  if (!Array.isArray(items) || !items.length) return <p className="note">None linked yet.</p>;
  return (
    <ul className="insights">
      {items.map((c, i) => (
        <li key={i}>{c.text} <span className="fine">({c.source}, {c.date || "undated"})</span></li>
      ))}
    </ul>
  );
}

export default function Decisions() {
  let theses = null, journal = null, scores = null;
  try { theses = data("theses.json"); } catch (_) { /* optional until seeded */ }
  try { journal = data("decisions.json"); } catch (_) { /* optional until seeded */ }
  try { scores = data("source_scores.json"); } catch (_) { /* arrives with the first quarterly resolution */ }
  const thesisList = theses?.theses || [];
  const decisionList = journal?.decisions || [];
  const scoreList = scores?.sources || [];
  if (!thesisList.length && !decisionList.length) {
    return (<><PageHeader title="Decisions & theses" /><Empty title="Nothing recorded yet">Theses and the decision journal are seeded from the research pipeline build.</Empty></>);
  }
  return (
    <>
      <PageHeader
        title="Decisions & theses"
        subtitle={<>The accountability layer for the research pipeline: what the targets rest on, what would change them, and a pre-committed record of each decision — written before outcomes are known, scored after.</>}
      />

      {thesisList.length > 0 && (
        <div className="card">
          <h2>Allocation theses</h2>
          {thesisList.map((t) => (
            <details className="disclosure" key={t.id}>
              <summary><span>{t.title} <span className="fine">· updated {fmtDate(t.updated)}</span></span></summary>
              <p>{t.statement}</p>
              <div className="label">Supporting evidence</div>
              <ClaimList items={t.supporting} />
              <div className="label">Challenging evidence</div>
              <ClaimList items={t.challenging} />
              <div className="label">Revision conditions</div>
              <p className="note">{t.revision_conditions}</p>
            </details>
          ))}
        </div>
      )}

      {decisionList.length > 0 && (
        <div className="card">
          <h2>Decision journal</h2>
          {decisionList.map((d, i) => (
            <div className="checklist-item" key={i} style={{ display: "block" }}>
              <div>
                <strong>{d.title}</strong>{" "}
                <span className="fine">{fmtDate(d.date)}</span>{" "}
                {d.status === "resolved"
                  ? <span className="badge good">Resolved</span>
                  : <span className="badge info">Open</span>}
              </div>
              <p style={{ margin: "4px 0" }}>{d.decision}</p>
              {d.rationale && <p className="note" style={{ margin: "2px 0" }}>Why: {d.rationale}</p>}
              {d.falsification && <p className="note" style={{ margin: "2px 0" }}>What would prove it wrong: {d.falsification}</p>}
              {d.outcome && <p className="note" style={{ margin: "2px 0" }}>Outcome: {d.outcome}</p>}
            </div>
          ))}
        </div>
      )}

      {scoreList.length > 0 && (
        <div className="card">
          <h2>Source track record</h2>
          <p className="note">Forecasts extracted from each source, resolved quarterly. Brier score: lower is better calibrated (0.25 = coin flip). Weights move slowly — a source needs ~30 scored forecasts before its weight means much.</p>
          <table>
            <thead><tr><th>Source</th><th>Forecasts scored</th><th>Brier</th><th>Weight</th></tr></thead>
            <tbody>
              {scoreList.map((s, i) => (
                <tr key={i}><td>{s.source}</td><td>{s.forecasts_scored}</td><td>{s.brier ?? "—"}</td><td>{s.weight ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
