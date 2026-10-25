"use client";

import { useMemo, useState, Fragment } from "react";
import { money, isSpend, PERSON_COLORS, PERSON_ORDER } from "../../../lib/format";
import { CAT_GROUP } from "../../../lib/taxonomy";
import { Donut } from "../../../lib/charts-interactive";
import { CardHead } from "../../../lib/ui";
import { Icon } from "../../../lib/icons";
import Link from "next/link";
import { spendHref } from "../../../lib/spend-filter";

// Key of a By-category row for its Transactions drill-down (see
// lib/spend-filter.js): the rebuilt Automotive and per-group Loans rows
// carry a group; every other row is a ledger category.
const rowKey = (r) => (r.group && r.name === "Automotive Expenses" ? "auto" : r.group && r.name === "Loans" ? `loans:${r.group}` : `cat:${r.name}`);
function TxnLink({ href, children, title }) {
  return <Link className="row-link-name" href={href} title={title} onClick={(e) => e.stopPropagation()}>{children}<Icon name="chevronRight" size={14} /></Link>;
}

const GROUP_COLORS = ["#f2622e", "#4f7fe0", "#2fa36b", "#d9890a", "#9a6fd0", "#3aa6b9", "#e0607e", "#8c9670", "#b28a6e", "#6d7894"];

export default function SpendingExplorer({ cats, txns, year }) {
  const [selected, setSelected] = useState(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());

  function toggleCollapse(group) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(group)) n.delete(group); else n.add(group);
      return n;
    });
  }
  const max = cats.length ? cats[0].spend : 1;
  const total = cats.reduce((s, r) => s + r.spend, 0);

  const bounds = useMemo(() => {
    const ds = txns.map((t) => t.d).sort();
    return { min: ds[0] || `${year}-01-01`, max: ds[ds.length - 1] || `${year}-12-31` };
  }, [txns, year]);
  const [start, setStart] = useState(bounds.min);
  const [end, setEnd] = useState(bounds.max);

  function toggleCat(name) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
    setDismissed(false);
  }

  function selectAll() {
    setSelected(new Set(displayCats.map((r) => r.name)));
    setDismissed(false);
  }

  function toggleGroup(names) {
    const allIn = names.every((n) => selected.has(n));
    setSelected((prev) => {
      const n = new Set(prev);
      if (allIn) names.forEach((x) => n.delete(x)); else names.forEach((x) => n.add(x));
      return n;
    });
    setDismissed(false);
  }

  function preset(kind) {
    if (kind === "all") { setStart(bounds.min); setEnd(bounds.max); }
    if (kind === "ytd") { setStart(`${year}-01-01`); setEnd(bounds.max); }
    if (kind === "30" || kind === "90") {
      const days = kind === "30" ? 30 : 90;
      const e = new Date(`${bounds.max}T12:00:00`);
      e.setDate(e.getDate() - (days - 1));
      setStart(e.toISOString().slice(0, 10));
      setEnd(bounds.max);
    }
  }

  const merchants = useMemo(() => {
    if (selected.size === 0) return [];
    const byName = new Map();
    for (const t of txns) {
      if (!isSpend(t) || !selected.has(t.c) || t.d < start || t.d > end) continue;
      const vname = t.dn || t.v || t.n; // display name (rename layer) wins over the normalized vendor
      let m = byName.get(vname);
      if (!m) { m = { name: vname, count: 0, total: 0, Daniel: 0, Maya: 0, Joint: 0 }; byName.set(vname, m); }
      m.count += 1;
      m.total += t.a;
      if (m[t.p] !== undefined) m[t.p] += t.a;
    }
    return [...byName.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [txns, selected, start, end]);

  // The Automotive Expenses and Loans rows are rebuilt from the
  // transactions: auto-loan rows carry budget category "Automotive
  // Expenses" (Daniel, 2026-10-14), so the summary's combined "Loans" row
  // must drop its auto part (now inside Automotive Expenses) and keep only
  // the remaining Loans rows, grouped by their group (Educational).
  const displayCats = useMemo(() => {
    if (!cats.some((r) => r.name === "Loans") && !cats.some((r) => r.name === "Automotive Expenses")) return cats;
    const agg = (pred) => {
      const o = { spend: 0, rows: 0, ps: {} };
      for (const t of txns) {
        if (!pred(t) || !isSpend(t)) continue;
        o.spend += t.a;
        o.rows += 1;
        o.ps[t.p] = (o.ps[t.p] || 0) + t.a;
      }
      o.spend = Math.round(o.spend * 100) / 100;
      return o;
    };
    const auto = agg((t) => t.c === "Automotive Expenses");
    const loansByGroup = {};
    for (const t of txns) {
      if (t.c !== "Loans" || !isSpend(t)) continue;
      const g = t.g || "Home Expenses";
      if (!loansByGroup[g]) loansByGroup[g] = { name: "Loans", group: g, spend: 0, rows: 0, ps: {} };
      const r = loansByGroup[g];
      r.spend += t.a;
      r.rows += 1;
      r.ps[t.p] = (r.ps[t.p] || 0) + t.a;
    }
    const loans = Object.values(loansByGroup);
    for (const r of loans) r.spend = Math.round(r.spend * 100) / 100;
    return [
      ...cats.filter((r) => r.name !== "Loans" && r.name !== "Automotive Expenses"),
      ...(auto.rows ? [{ name: "Automotive Expenses", group: "Automotive Expenses", ...auto }] : []),
      ...loans,
    ];
  }, [cats, txns]);

  const groupedCats = useMemo(() => {
    const byGroup = new Map();
    for (const r of displayCats) {
      const g = r.group || CAT_GROUP[r.name] || r.name;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(r);
    }
    return [...byGroup.entries()]
      .map(([group, rows]) => {
        const ps = {};
        for (const r of rows) for (const p of PERSON_ORDER) ps[p] = (ps[p] || 0) + (r.ps[p] || 0);
        return { group, rows, ps, spend: rows.reduce((s, r) => s + r.spend, 0), rowsCount: rows.reduce((s, r) => s + r.rows, 0) };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [displayCats]);
  const gmax = groupedCats.length ? groupedCats[0].spend : 1;

  const open = selected.size > 0 && !dismissed;
  const selSpend = cats.filter((r) => selected.has(r.name)).reduce((s, r) => s + r.spend, 0);
  const donutTotal = groupedCats.reduce((sum, group) => sum + group.spend, 0);
  const donutSegments = groupedCats.map((group, i) => ({ label: group.group, value: group.spend, color: GROUP_COLORS[i % GROUP_COLORS.length], href: spendHref(year, `group:${group.group}`) }));

  return (
    <>
      <div className="card">
        <CardHead title="Spending by group" sub={`${year} · hover a slice for its share; select a slice or row to see its transactions`} />
        <div className="donut-card">
          <Donut segments={donutSegments} size={220} centerLabel="Total spend" />
          <div className="donut-legend">{donutSegments.map((segment) => <Link className="donut-legend-row" key={segment.label} href={segment.href} title={`See ${segment.label} transactions`}><span className="dot" style={{ background: segment.color }} /><span>{segment.label}</span><span className="amt">{money(segment.value)}</span><span className="pct">{donutTotal ? ((segment.value / donutTotal) * 100).toFixed(1) : "0.0"}%</span></Link>)}</div>
        </div>
      </div>
      <div className="card">
        <CardHead title="By category" sub="Bar length is size vs the largest category; the stack shows whose spending it is. Select a name to see its transactions, or tick categories to see their top merchants." right={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="mini-btn" onClick={selectAll}>Select all</button>
            {selected.size > 0 && <button type="button" className="mini-btn" onClick={() => { setSelected(new Set()); setDismissed(false); }}>Clear ({selected.size})</button>}
          </div>
        } />
        <div className="legend" style={{ marginTop: -4, marginBottom: 10 }}>
          {PERSON_ORDER.map((p) => <span className="legend-item" key={p}><span className="legend-swatch" style={{ background: PERSON_COLORS[p] }} />{p}</span>)}
        </div>
        <table className="cat-table">
          <thead><tr><th style={{ width: 26 }}></th><th>Category</th><th className="sharecol" style={{ width: "22%" }}>Share</th><th className="r hide-sm">Rows</th><th className="r">Spend</th></tr></thead>
          <tbody>
            {groupedCats.map(({ group, rows: grows, spend: gspend, rowsCount, ps: gps }) => (
              <Fragment key={group}>
                <tr className="grouprow"><td><input type="checkbox" checked={grows.every((r) => selected.has(r.name))} onChange={() => toggleGroup(grows.map((r) => r.name))} title={`Select all in ${group}`} /></td><td><button type="button" className={`collapse-btn ${collapsed.has(group) ? "closed" : ""}`} onClick={() => toggleCollapse(group)} aria-expanded={!collapsed.has(group)} title={collapsed.has(group) ? `Show categories in ${group}` : `Hide categories in ${group}`}><Icon name="chevronDown" size={14} /></button><TxnLink href={spendHref(year, `group:${group}`)} title={`See ${group} transactions`}><strong>{group}</strong></TxnLink></td><td className="sharecol">
                  <div className="bar" title={PERSON_ORDER.map((p) => `${p}: ${money(gps[p] || 0)}`).join(" · ")}>
                    <div style={{ width: `${(gspend / gmax) * 100}%`, display: "flex" }}>
                      {PERSON_ORDER.map((p) => (
                        <div key={p} style={{ width: gspend ? `${((gps[p] || 0) / gspend) * 100}%` : "0%", background: PERSON_COLORS[p] }} />
                      ))}
                    </div>
                  </div>
                </td><td className="r hide-sm">{rowsCount}</td><td className="r"><strong>{money(gspend)}</strong></td></tr>
                {!collapsed.has(group) && grows.map((r) => (
              <tr key={r.name} className={selected.has(r.name) ? "selrow" : ""} onClick={() => toggleCat(r.name)} style={{ cursor: "pointer" }}>
                <td><input type="checkbox" checked={selected.has(r.name)} onChange={() => toggleCat(r.name)} onClick={(e) => e.stopPropagation()} /></td>
                <td style={{ paddingLeft: 26 }}><TxnLink href={spendHref(year, rowKey(r))} title={`See ${r.name} transactions`}>{r.name}</TxnLink></td>
                <td className="sharecol">
                  <div className="bar" title={PERSON_ORDER.map((p) => `${p}: ${money(r.ps[p] || 0)}`).join(" · ")}>
                    <div style={{ width: `${(r.spend / max) * 100}%`, display: "flex" }}>
                      {PERSON_ORDER.map((p) => (
                        <div key={p} style={{ width: r.spend ? `${((r.ps[p] || 0) / r.spend) * 100}%` : "0%", background: PERSON_COLORS[p] }} />
                      ))}
                    </div>
                  </div>
                </td>
                <td className="r hide-sm">{r.rows}</td>
                <td className="r">{money(r.spend)}</td>
              </tr>
                ))}
              </Fragment>
            ))}
            <tr className="total"><td></td><td><TxnLink href={spendHref(year, "total")} title="See every transaction in the total">Total</TxnLink></td><td></td><td className="r hide-sm">{cats.reduce((s, r) => s + r.rows, 0).toLocaleString()}</td><td className="r">{money(total)}</td></tr>
          </tbody>
        </table>
      </div>

      {open && (
        <aside className="drawer" aria-label="Top merchants">
          <div className="drawer-head">
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Top merchants</h2>
              <div className="note">{[...selected].join(", ")} · {money(selSpend)} this year</div>
            </div>
            <button type="button" className="icon-btn drawer-close" onClick={() => setDismissed(true)} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="drawer-dates">
            <label>From <input type="date" value={start} min={bounds.min} max={bounds.max} onChange={(e) => setStart(e.target.value)} /></label>
            <label>To <input type="date" value={end} min={bounds.min} max={bounds.max} onChange={(e) => setEnd(e.target.value)} /></label>
            <span className="presetrow">
              <button type="button" onClick={() => preset("all")}>All</button>
              <button type="button" onClick={() => preset("ytd")}>YTD</button>
              <button type="button" onClick={() => preset("90")}>Last 90d</button>
              <button type="button" onClick={() => preset("30")}>Last 30d</button>
            </span>
          </div>
          {merchants.length === 0 ? (
            <p className="note" style={{ padding: "0 14px" }}>No charges in the selected categories for this date range.</p>
          ) : (
            <table>
              <thead><tr><th>Merchant / vendor</th><th className="r">Charges</th><th className="r">Total spend</th><th style={{ width: "34%" }}>Breakout B / R / J</th></tr></thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="r">{m.count}</td>
                    <td className="r">{money(m.total)}</td>
                    <td>
                      <div className="bar" style={{ minWidth: 70 }}>
                        <div style={{ width: "100%", display: "flex" }}>
                          {PERSON_ORDER.map((p) => (
                            <div key={p} style={{ width: `${(m[p] / m.total) * 100}%`, background: PERSON_COLORS[p] }} />
                          ))}
                        </div>
                      </div>
                      <div className="note" style={{ marginTop: 3 }}>
                        {PERSON_ORDER.map((p) => (
                          <span key={p} style={{ marginRight: 8 }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: PERSON_COLORS[p], marginRight: 3 }} />
                            {p[0]} {Math.round((m[p] / m.total) * 100)}%
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="note" style={{ padding: "0 14px 12px" }}>Top 10 by total spend across the selected categories in the chosen date range. Charges = number of transactions.</p>
        </aside>
      )}
    </>
  );
}
