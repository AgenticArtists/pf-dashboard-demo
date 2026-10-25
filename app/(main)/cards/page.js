import { buildCardsData, money } from "../../../lib/cards-data";
import { buildCreditCapture } from "../../../lib/credit-capture";
import { fmtDate } from "../../../lib/format";
import { PageHeader, Stat, CardHead, Avatar, PersonTag, DrillLink } from "../../../lib/ui";
import { txnHref } from "../../../lib/drill";

export const dynamic = "force-dynamic";

export default function Cards() {
  const { cards, totals, asOf } = buildCardsData();
  const capture = buildCreditCapture();
  const maxBalance = Math.max(1, ...cards.map((card) => card.balance));
  return (
    <>
      <PageHeader title="Cards" subtitle={`Household card balances and charges from the synthetic ledger and digital-card statements${asOf ? ` · statements through ${fmtDate(asOf)}` : ""}.`} />
      <div className="cards">
        <Stat label="Card balances" value={money(totals.balance)} sub={`Across ${cards.length} cards`} />
        <Stat label="Charges in 2026" value={money(totals.spend2026)} sub="Year to date" />
        <Stat label="Charges in 2025" value={money(totals.spend2025)} sub="Full year" />
      </div>
      <div className="card flush">
        <div className="card-head" style={{ padding: "18px 22px 0" }}><h2>Cards by current balance</h2></div>
        <div className="table-scroll" style={{ padding: "0 22px 8px" }}>
          <table>
            <thead><tr><th>Card</th><th className="hide-sm">Owner</th><th className="r">Balance</th><th className="r">2026 charges</th><th className="r hide-sm">2025 charges</th></tr></thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.mask || card.name}>
                  <td>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar name={card.institution} />
                      <div style={{ minWidth: 0 }}>
                        <strong>{card.mask ? <DrillLink href={txnHref({ m: card.mask, ch: true })} title={`See ${card.name} charges in 2026`}>{card.name}</DrillLink> : card.name}</strong>
                        <div className="sub">{card.institution}{card.mask ? ` ···· ${card.mask}` : ""}{card.due ? ` · due ${card.due}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hide-sm" style={{ verticalAlign: "middle" }}><PersonTag person={card.owner} /></td>
                  <td className="r"><strong>{money(card.balance)}</strong><div className="bar" style={{ marginTop: 6, marginLeft: "auto", maxWidth: 120, height: 5 }}><div style={{ width: `${(card.balance / maxBalance) * 100}%`, background: "var(--accent)" }} /></div></td>
                  <td className="r">{card.mask ? <DrillLink href={txnHref({ m: card.mask, ch: true })} title="See these charges">{money(card.byYear[2026].spend)}</DrillLink> : money(card.byYear[2026].spend)}<div className="sub">{card.byYear[2026].count} charges</div></td>
                  <td className="r hide-sm">{card.mask ? <DrillLink href={txnHref({ y: "2025", m: card.mask, ch: true })} title="See these charges">{money(card.byYear[2025].spend)}</DrillLink> : money(card.byYear[2025].spend)}<div className="sub">{card.byYear[2025].count} charges</div></td>
                </tr>
              ))}
              <tr className="total"><td>Total</td><td className="hide-sm"></td><td className="r">{money(totals.balance)}</td><td className="r">{money(totals.spend2026)}</td><td className="r hide-sm">{money(totals.spend2025)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card flush">
        <div className="card-head" style={{ padding: "18px 22px 0" }}>
          <h2>Credit capture {capture.year}</h2>
          <div className="sub">Statement credits actually captured, computed from the ledger{capture.asOf ? ` through ${fmtDate(capture.asOf)}` : ""} · {money(capture.totals.captured_ytd)} captured of {money(capture.totals.available_ytd)} offered so far · {money(capture.totals.missed)} missed in periods that already ended</div>
        </div>
        <div className="table-scroll" style={{ padding: "0 22px 8px" }}>
          <table>
            <thead><tr><th>Credit</th><th className="r">Captured</th><th className="r hide-sm">Remaining now</th><th className="r">Missed</th></tr></thead>
            <tbody>
              {capture.credits.map((credit) => (
                <tr key={credit.id}>
                  <td>
                    <strong>{credit.name}</strong>
                    <div className="sub">{credit.card} · {money(credit.amount_per_period)} per {credit.periodNoun} · {money(credit.annual_total)}/yr{credit.status === "ended" && credit.ends ? ` · ended ${fmtDate(credit.ends)}` : ""}</div>
                    {credit.missedPeriods.length > 0 && (
                      <div className="sub">Missed: {credit.missedPeriods.map((p) => `${p.label} ${money(p.remaining)}`).join(" · ")}</div>
                    )}
                    {credit.expiring && (
                      <div className="sub">{credit.expiring.period} ends {fmtDate(credit.expiring.ends)} — {money(credit.expiring.remaining)} still open</div>
                    )}
                    {!credit.trackable && <div className="sub">{credit.note}</div>}
                  </td>
                  <td className="r">
                    {credit.trackable ? (
                      <>
                        <strong>{money(credit.captured_ytd)}</strong> <span className="sub">of {money(credit.available_ytd)}</span>
                        <div className="bar" style={{ marginTop: 6, marginLeft: "auto", maxWidth: 120, height: 5 }}><div style={{ width: `${credit.pct ?? 0}%`, background: "var(--accent)" }} /></div>
                      </>
                    ) : (
                      <span className="sub">not in ledger</span>
                    )}
                  </td>
                  <td className="r hide-sm">{credit.remaining_current != null ? money(credit.remaining_current) : "—"}</td>
                  <td className="r">{credit.missed ? money(credit.missed) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <CardHead title="How to read this" />
        <p className="note" style={{ marginTop: 0 }}>Balances come from the synthetic account snapshot. Card charges exclude payment transfers. Digital-card activity comes from the generated statement fixture and is not part of the transaction ledger. Credit capture is computed from the ledger's statement-credit legs.</p>
      </div>
    </>
  );
}
