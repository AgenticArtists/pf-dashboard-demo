import { data, money } from "../../../lib/data";
import { PERSON_COLORS, fmtDate } from "../../../lib/format";
import { PageHeader, Stat, CardHead, PersonTag, Empty } from "../../../lib/ui";

export const dynamic = "force-dynamic";

// Savings cuts register — fully data-driven from data/savings_cuts.json,
// maintained from the finance strategy chat as cuts are confirmed. Confirmed
// figures are forward run rates verified against the ledger. Suggestions are
// estimates from the 2026-10-18 cut analysis and are NEVER merged into the
// confirmed totals.
const r2 = (x) => Math.round(x * 100) / 100;
const OWNERS = ["Joint", "Maya", "Daniel"];
const sum = (rows, f) => r2(rows.reduce((s, r) => s + (f(r) || 0), 0));
const range = (lo, hi) => (lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`);

export default function SavingsCuts() {
  const t = data("savings_cuts.json");
  const cuts = (t.cuts || []).filter((c) => c.status === "active");
  const ended = (t.cuts || []).filter((c) => c.status !== "active");
  const sugs = t.suggestions || [];
  const prog = t.in_progress || [];
  const monthly = sum(cuts, (c) => c.monthly_saved);
  const annual = sum(cuts, (c) => c.annual_saved);
  const byOwnerMo = Object.fromEntries(OWNERS.map((o) => [o, sum(cuts.filter((c) => c.owner === o), (c) => c.monthly_saved)]));
  const byOwnerYr = Object.fromEntries(OWNERS.map((o) => [o, sum(cuts.filter((c) => c.owner === o), (c) => c.annual_saved)]));
  const sugLo = sum(sugs, (s) => s.monthly_low);
  const sugHi = sum(sugs, (s) => s.monthly_high);

  return (
    <>
      <PageHeader title="Savings cuts" subtitle="Spending cuts we have confirmed, tracked as they are made — plus what is under way and what has been suggested but not yet decided. Confirmed figures are forward run rates verified against the ledger; in-progress and suggested figures are estimates and are never counted in the totals above them." />

      <div className="cards">
        <Stat label="Confirmed savings" value={`${money(monthly)}/mo`} sub={`${money(annual)} a year`} />
        {OWNERS.map((o) => (
          <Stat key={o} label={`${o} cuts`} dot={PERSON_COLORS[o]} value={`${money(byOwnerMo[o])}/mo`} sub={`${money(byOwnerYr[o])} a year`} />
        ))}
      </div>

      <div className="card">
        <CardHead title="Confirmed cuts" sub={`${cuts.length} active`} />
        {cuts.length === 0 ? (
          <Empty title="No confirmed cuts yet">Confirmed cuts land here as they are made.</Empty>
        ) : (
          <table>
            <thead><tr><th>Cut</th><th>Whose</th><th className="hide-sm">Confirmed</th><th className="r">Saves</th></tr></thead>
            <tbody>
              {cuts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{c.item}</strong>
                      <span className="badge">{c.kind}</span>
                    </div>
                    <div className="sub">{c.note}</div>
                  </td>
                  <td><PersonTag person={c.owner} /></td>
                  <td className="hide-sm">{fmtDate(c.confirmed_on)}</td>
                  <td className="r">{money(c.monthly_saved)}/mo<div className="sub">{money(c.annual_saved)}/yr</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ended.length > 0 && <p className="note">{ended.length} earlier cut{ended.length === 1 ? " has" : "s have"} ended and no longer count toward the totals.</p>}
      </div>

      {prog.length > 0 && (
        <div className="card">
          <CardHead title="In progress" sub="Under way — expected savings are estimates and are not in the confirmed totals. An item moves up into the confirmed register once its saving takes effect." />
          {prog.map((p) => (
            <div key={p.id} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{p.item}</strong>
                <span className="badge">{p.kind}</span>
                <PersonTag person={p.owner} />
                <span style={{ marginLeft: "auto" }}><strong>≈{money(p.expected_monthly)}/mo</strong> <span className="sub">expected · {money(p.expected_annual)}/yr</span></span>
              </div>
              {p.note && <div className="sub" style={{ marginTop: 4 }}>{p.note}</div>}
              <details style={{ marginTop: 8 }}>
                <summary className="sub" style={{ cursor: "pointer" }}>
                  Steps: {p.steps.filter((s) => s.state === "done").length} of {p.steps.length} done
                  {p.steps.find((s) => s.state === "next") && <> · next: <strong>{p.steps.find((s) => s.state === "next").label}</strong></>}
                </summary>
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {p.steps.map((s, i) => (
                      <tr key={i} className={s.state === "done" ? "" : "dim"}>
                        <td style={{ width: 28 }}>{s.state === "done" ? "✓" : s.state === "next" ? "→" : "·"}</td>
                        <td className="hide-sm" style={{ width: 170 }}>{s.when}</td>
                        <td><strong>{s.label}</strong><div className="sub">{s.detail}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          ))}
        </div>
      )}

      {sugs.length > 0 && (
        <div className="card">
          <CardHead title="Suggested — not yet confirmed" sub="From the October 2026 spending review. Ranges are estimates; none of this is in the totals at the top." />
          <table>
            <thead><tr><th>Suggestion</th><th>Whose</th><th className="r">Estimated saving</th></tr></thead>
            <tbody>
              {sugs.map((s) => (
                <tr key={s.id} className="dim">
                  <td>
                    <strong>{s.item}</strong>
                    <div className="sub">{s.note}</div>
                  </td>
                  <td><PersonTag person={s.owner} /></td>
                  <td className="r">{range(s.monthly_low, s.monthly_high)}/mo<div className="sub">{range(r2(s.monthly_low * 12), r2(s.monthly_high * 12))}/yr</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Identified but unconfirmed: {range(sugLo, sugHi)}/mo ({range(r2(sugLo * 12), r2(sugHi * 12))}/yr). When a suggestion is confirmed, it moves up into the confirmed register at its real run rate.</p>
        </div>
      )}
    </>
  );
}
