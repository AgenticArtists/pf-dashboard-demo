import { data, money } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { getOverrides, applyRecordsToTxns } from "../../../lib/overrides";
import { PageHeader, Stat, CardHead, Avatar, PersonTag, DrillLink } from "../../../lib/ui";
import { txnHref } from "../../../lib/drill";
import { detectRecurring, isCutList, r2 } from "../../../lib/recurring";

export const dynamic = "force-dynamic";

export default async function Subscriptions() {
  const records = await getOverrides().catch(() => []);
  const tx26 = applyRecordsToTxns(data("transactions_2026.json"), records);
  const tx25 = applyRecordsToTxns(data("transactions_2025.json"), records);
  const all = [...tx26, ...tx25];
  const dataMax = all.reduce((mx, t) => (t.d > mx ? t.d : mx), "");
  const detected = detectRecurring(all, dataMax);
  const subs = detected.filter((r) => r.category === "Subscriptions" || r.cut);
  const bills = detected.filter((r) => !(r.category === "Subscriptions" || r.cut));

  // Digital-card subscriptions bill a card the ledger never sees.
  // (2026-10-18): they belong in the main table as ordinary rows, not
  // split into their own panel — mapped into the detected-row shape
  // here (no charge history exists, so ytd/typical can be null and the
  // row renders dashes).
  const rec = data("records.json");
  const appleSubs = (rec.apple && rec.apple.subscriptions_as_of_2026_10_13) || {};
  const renewing = appleSubs.renewing || [];
  const expiring = appleSubs.expiring_cancelled || [];
  const MONTH_IDX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const appleNext = (renews) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(renews || "")) return renews.slice(0, 10);
    const m = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(renews || "");
    if (!m || MONTH_IDX[m[1]] === undefined) return "";
    const base = Date.UTC(2026, 9, 13); // the printout date
    let d = Date.UTC(2026, MONTH_IDX[m[1]], Number(m[2]));
    if (d < base) d = Date.UTC(2027, MONTH_IDX[m[1]], Number(m[2]));
    return new Date(d).toISOString().slice(0, 10);
  };
  const appleRows = [
    ...renewing.map((s) => ({
      vendor: s.name, name: s.name, category: "Subscriptions", subcategory: "Digital card", person: s.owner,
      count: 0, typical: s.price ?? null, cadence: s.cadence === "yearly" ? "Annual" : "Monthly",
      monthly: r2(s.cadence === "yearly" ? (s.price || 0) / 12 : (s.price || 0)),
      annual: r2(s.cadence === "yearly" ? (s.price || 0) : (s.price || 0) * 12),
      grossMonthly: r2(s.cadence === "yearly" ? (s.price || 0) / 12 : (s.price || 0)), creditTypical: 0,
      lastDate: "", next: appleNext(s.renews), active: true, vary: false, ytd: null, ytdNet: null, credits: 0,
      cut: isCutList(s.name, s.name), apple: true,
    })),
    ...expiring.map((s) => ({
      vendor: s.name, name: s.name, category: "Subscriptions", subcategory: "Digital card", person: s.owner,
      count: 0, typical: null, cadence: "", monthly: 0, annual: 0, grossMonthly: 0, creditTypical: 0,
      lastDate: "", next: (s.expires || "").slice(0, 10), active: false, vary: false, ytd: null, ytdNet: null, credits: 0,
      cut: isCutList(s.name, s.name), apple: true, cancelled: true,
    })),
  ];
  const allSubs = [...subs, ...appleRows].sort((a, b) => (b.active - a.active) || b.monthly - a.monthly);
  const activeSubs = allSubs.filter((r) => r.active);
  const monthlyTotal = r2(activeSubs.reduce((s, r) => s + r.monthly, 0));
  const cutMonthly = r2(activeSubs.filter((r) => r.cut).reduce((s, r) => s + r.monthly, 0));
  const billsMonthly = r2(bills.filter((r) => r.active).reduce((s, r) => s + r.monthly, 0));

  const Row = (r) => (
    <tr key={r.vendor} className={r.active ? "" : "dim"}>
      <td>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar name={r.vendor} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {r.ytd == null ? <strong>{r.vendor}</strong> : <strong><DrillLink href={txnHref({ sp: `v:${r.vendor}`, ch: true })} title={`See ${r.vendor} charges in 2026`}>{r.vendor}</DrillLink></strong>}
              {r.cut && <span className="badge over">Cut list</span>}
              {r.cancelled && <span className="badge">Cancelled / expiring</span>}
              {!r.active && !r.cancelled && <span className="badge">Possibly ended</span>}
              {r.vary && <span className="badge">Amounts vary</span>}
            </div>
            <div className="sub">{r.category} · {r.subcategory}{r.creditTypical ? ` · paired statement credit −${money(r.creditTypical)}/cycle, netted in the run rate` : ""}{r.credits ? ` · credits/refunds ${money(r.credits)} in the data` : ""}</div>
          </div>
        </div>
      </td>
      <td className="hide-sm"><PersonTag person={r.person} /></td>
      <td className="r">{r.typical == null ? "—" : <>{money(r.typical)}<div className="sub">{r.cadence}</div></>}</td>
      <td className="r hide-sm nowrap">{r.lastDate ? fmtDate(r.lastDate) : "—"}</td>
      <td className="r nowrap">{r.active ? fmtDate(r.next) : r.cancelled && r.next ? `to ${fmtDate(r.next)}` : "—"}</td>
      <td className="r hide-sm">{r.ytd == null ? "—" : <>{money(r.ytd)}{r.creditTypical ? <div className="sub">net {money(r.ytdNet)}</div> : null}</>}</td>
      <td className="r"><strong>{money(r.monthly)}</strong><div className="sub">{money(r.annual)}/yr</div>{r.creditTypical ? <div className="sub">gross {money(r.grossMonthly)}/mo</div> : null}</td>
    </tr>
  );
  const Table = ({ rows }) => (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Vendor</th><th className="hide-sm">Person</th><th className="r">Typical charge</th><th className="r hide-sm">Last charge</th><th className="r">Next expected</th><th className="r hide-sm">2026 charges</th><th className="r">Run-rate /mo</th></tr></thead>
        <tbody>{rows.map(Row)}</tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader title="Recurring" subtitle={`Subscriptions and regular charges detected from the synthetic ledger (2025–2026), plus digital-card subscriptions from the generated fixture, as of ${fmtDate(dataMax)}. Run-rates use the typical charge, net of paired statement credits. Loans, rent, childcare, insurance, and taxes live on the Budgets page instead.`} />

      <div className="cards">
        <Stat label="Subscriptions run-rate" value={`${money(monthlyTotal)}/mo`} sub={`${money(r2(monthlyTotal * 12))} a year, active only, net of paired credits`} />
        <Stat label="On your cut list" value={`${money(cutMonthly)}/mo`} tone={cutMonthly > 0 ? "neg-val" : ""} sub={`${money(r2(cutMonthly * 12))} a year if cancelled`} />
        <Stat label="Active subscriptions" value={activeSubs.length} sub={`${allSubs.length - activeSubs.length} possibly ended or cancelled`} />
        <Stat label="Other recurring run-rate" value={`${money(billsMonthly)}/mo`} sub="utilities & memberships, active only" />
      </div>

      <div className="card">
        <CardHead title="Subscriptions & services" sub={`${allSubs.length} in the table`} />
        <Table rows={allSubs} />
        {appleRows.length > 0 && <p className="note">Rows marked “Digital card” come from the generated subscription fixture and have no charge history in the main ledger.</p>}
      </div>

      <div className="card">
        <CardHead title="Other recurring charges" sub="Utilities, memberships, and other regular charges that are not subscriptions — shown for completeness; most are not cut candidates." />
        <Table rows={bills} />
      </div>
    </>
  );
}
