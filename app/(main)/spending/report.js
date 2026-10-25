"use client";

import { useState } from "react";
import { money, PERSON_COLORS, PERSON_ORDER, fmtDate } from "../../../lib/format";
import { TrendChart } from "../../../lib/charts-interactive";
import { CardHead } from "../../../lib/ui";
import LinkRow from "../../../lib/link-row";
import { spendHref } from "../../../lib/spend-filter";

const MONTH_NUM = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

const pct = (x) => `${x > 0 ? "+" : ""}${x.toFixed(1)}%`;

export default function PersonReport({ reports, year }) {
  const [person, setPerson] = useState("Daniel");
  const r = reports[person];
  if (!r) return null;
  const color = PERSON_COLORS[person] || "#0b5cad";
  const monthHref = (m) => spendHref(year, "all", { p: person, mo: `${year}-${MONTH_NUM[m.m]}` });

  return (
    <div className="card">
      <CardHead
        title="Personal spending report"
        sub={`${person === "Joint" ? "Joint household" : person}'s spending in ${year}`}
        right={
          <div className="segmented" role="tablist" aria-label="Person">
            {PERSON_ORDER.map((p) => (
              <button key={p} type="button" role="tab" aria-selected={p === person} className={p === person ? "on" : ""} onClick={() => setPerson(p)}>
                <span className="person-dot" style={{ background: PERSON_COLORS[p], marginRight: 6, verticalAlign: 1 }} />{p}
              </button>
            ))}
          </div>
        }
      />

      <div className="mini-stats" style={{ marginTop: 0, paddingTop: 0, borderTop: 0, marginBottom: 18 }}>
        <div className="mini-stat"><div className="k">Total spend {year}</div><div className="v">{money(r.total)}</div><div className="fine">{r.share.toFixed(1)}% of household spend</div></div>
        <div className="mini-stat"><div className="k">Avg per full month</div><div className="v">{money(r.monthlyAvg)}</div><div className="fine">over {r.fullMonths} full months</div></div>
        <div className="mini-stat"><div className="k">Transactions</div><div className="v">{r.count}</div><div className="fine">median charge {money(r.medianTxn)}</div></div>
        <div className="mini-stat"><div className="k">vs same stretch of {Number(year) - 1}</div><div className={`v ${r.yoyPct == null ? "" : r.yoyPct > 0 ? "negative" : "pos"}`}>{r.yoyPct == null ? "—" : pct(r.yoyPct)}{r.gapFlagged ? <sup title="Partly a coverage difference — see the coverage note at the top of the page">†</sup> : null}</div><div className="fine">{r.yoyPct == null ? "no prior-year data" : `${money(r.total)} vs ${money(r.priorTotal)}`}</div></div>
      </div>

      <div className="grid2" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Monthly spending</h3>
          <TrendChart series={[{ label: person, color, points: r.monthly.map((m) => m.total) }]} labels={r.monthly.map((m) => `${m.m}${m.partial ? " (so far)" : ""}`)} height={200} zero ariaLabel={`${person} monthly spending`} hrefs={r.monthly.map(monthHref)} />
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Month</th><th className="r">Spend</th><th className="r">vs prior month</th><th className="r">vs avg</th></tr></thead>
            <tbody>
              {r.monthly.map((m) => (
                <LinkRow key={m.m} href={monthHref(m)} name={m.partial ? `${m.m} (so far)` : m.m} title={`See ${person}'s ${m.m} spending`}>
                  <td className="r">{money(m.total)}</td>
                  <td className={`r ${m.mom == null ? "" : m.mom > 0 ? "negative" : "pos"}`}>{m.mom == null ? "—" : pct(m.mom)}</td>
                  <td className="r muted">{pct(m.vsAvg)}</td>
                </LinkRow>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>Insights</h3>
          <ul className="insights">
            {r.insights.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <h3>Top categories</h3>
          <table>
            <tbody>
              {r.topCats.map((c) => (
                <LinkRow key={c.name} href={spendHref(year, `c:${c.name}`, { p: person })} name={c.name} title={`See ${person}'s ${c.name} spending`}><td style={{ width: "34%", verticalAlign: "middle" }}><span className="sharebar"><span style={{ width: `${Math.min(100, c.share)}%`, background: color }} /></span></td><td className="r">{money(c.total)} <span className="fine">{c.share.toFixed(1)}%</span></td></LinkRow>
              ))}
            </tbody>
          </table>
          <h3>Top vendors</h3>
          <table>
            <tbody>
              {r.topVendors.map((v) => (
                <LinkRow key={v.name} href={spendHref(year, `v:${v.name}`, { p: person })} name={v.name} title={`See ${person}'s ${v.name} charges`}><td className="r">{money(v.total)} <span className="fine">· {v.count} charge{v.count === 1 ? "" : "s"}</span></td></LinkRow>
              ))}
            </tbody>
          </table>
          <h3>Largest single purchases</h3>
          <table>
            <tbody>
              {r.biggest.map((b, i) => (
                <LinkRow key={i} href={`/transactions?${new URLSearchParams({ ...(year === "2025" ? { y: year } : {}), open: b.key })}`} name={b.n} title="Open this transaction" sub={<div className="sub">{fmtDate(b.d)} · {b.c}</div>}><td className="r">{money(b.a)}</td></LinkRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
