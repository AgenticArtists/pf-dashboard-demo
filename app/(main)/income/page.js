import { data, money } from "../../../lib/data";
import { Kv, PageHeader, YearToggle, Stat, CardHead } from "../../../lib/ui";
import { BarChart } from "../../../lib/charts-interactive";
import { PERSON_COLORS as COLORS, PERSON_ORDER as ORDER } from "../../../lib/format";
import { getOverrides, applyRecordsToTxns } from "../../../lib/overrides";
import LinkRow from "../../../lib/link-row";
import { incomeSource } from "../../../lib/income-source";

const r2 = (x) => Math.round(x * 100) / 100;
// Live income (2026-10-14): computed from the live-layered transactions
// instead of the baked income file, so site edits (including moving a
// deposit to Transfers) move this page immediately. Definitions mirror the
// pipeline's income dataset exactly — verified to the cent, both years.
const INCOME_CATS = ["Salary", "1099 Income", "Expense Reimbursements", "Benefits Reimbursements", "Gifts", "Credit Card Rewards", "Miscellaneous"];
function computeIncome(txns) {
  const rows = txns.filter((t) => t.g === "Income");
  const total = r2(rows.reduce((s, t) => s - t.a, 0));
  const pct = (v) => (total ? Math.round((1000 * v) / total) / 10 : 0);
  const by_person = ORDER.map((p) => {
    const v = r2(rows.filter((t) => t.p === p).reduce((s, t) => s - t.a, 0));
    return { person: p, total: v, pct: pct(v) };
  });
  const months = new Map();
  for (const t of rows) {
    const m = t.d.slice(0, 7);
    if (!months.has(m)) months.set(m, { Daniel: 0, Maya: 0, Joint: 0 });
    months.get(m)[t.p] += -t.a;
  }
  const monthly = [...months.keys()].sort().map((m) => {
    const v = months.get(m);
    const row = { month: m, total: r2(v.Daniel + v.Maya + v.Joint) };
    for (const p of ORDER) row[p] = r2(v[p]);
    return row;
  });
  const group = (keyFn) => {
    const map = new Map();
    for (const t of rows) {
      const k = keyFn(t);
      if (!map.has(k)) map.set(k, { Daniel: 0, Maya: 0, Joint: 0 });
      map.get(k)[t.p] += -t.a;
    }
    return map;
  };
  const shape = (map, keyName) => [...map.entries()].map(([k, v]) => {
    const tot = r2(v.Daniel + v.Maya + v.Joint);
    const row = { [keyName]: k, total: tot, pct: pct(tot) };
    for (const p of ORDER) row[p] = r2(v[p]);
    return row;
  });
  const catMap = group((t) => t.ic || "Miscellaneous");
  const by_category = [
    ...INCOME_CATS.filter((c) => catMap.has(c)).map((c) => shape(new Map([[c, catMap.get(c)]]), "category")[0]),
    ...shape(new Map([...catMap.entries()].filter(([c]) => !INCOME_CATS.includes(c))), "category").sort((a, b) => b.total - a.total),
  ];
  const by_source = shape(group((t) => incomeSource(t.n)), "source").sort((a, b) => b.total - a.total);
  return { total, count: rows.length, by_person, monthly, by_category, by_source };
}

export const dynamic = "force-dynamic";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Income({ searchParams }) {
  const sp = await searchParams;
  const year = sp?.y === "2025" ? "2025" : "2026";
  const records = await getOverrides().catch(() => []);
  const inc = computeIncome(applyRecordsToTxns(data(`transactions_${year}.json`), records));
  // Drill-downs: the Transactions explorer with the same rows this page sums.
  const txnLink = (extra) => `/transactions?${new URLSearchParams({ ...(year === "2025" ? { y: year } : {}), g: "Income", ...extra })}`;

  return (
    <>
      <PageHeader title="Income" subtitle="Deposits as they hit the accounts: take-home pay, not gross salary." actions={<YearToggle base="/income" year={year} />} />

      <div className="cards income-kpis">
        <Stat label="Total income" value={money(inc.total)} sub={`${year} household deposits · ${inc.count} deposits`} />
        {inc.by_person.map((bp) => <Stat key={bp.person} label={bp.person} dot={COLORS[bp.person]} value={money(bp.total)} sub={`${bp.pct}% of household income`} />)}
      </div>

      <div className="card">
        <CardHead title="Monthly income by person" sub="Hover or tap a month for each person's share, then select it to see those deposits" />
        <BarChart
          stacked showTotals height={260} ariaLabel="Monthly income stacked by person"
          groups={inc.monthly.map((m) => ({
            label: MON[parseInt(m.month.slice(5), 10) - 1], title: `${MON[parseInt(m.month.slice(5), 10) - 1]} ${m.month.slice(0, 4)}`,
            bars: ORDER.map((p) => ({ key: p, value: m[p], color: COLORS[p] })),
            note: `Total ${money(m.total)}`,
            href: txnLink({ mo: m.month }),
          }))}
        />
        <div className="legend">{ORDER.map((p) => <span className="legend-item" key={p}><span className="legend-swatch" style={{ background: COLORS[p] }} />{p}</span>)}</div>
        <div className="splitbar" style={{ marginTop: 18 }} title="Share of household income">
          {inc.by_person.filter((bp) => bp.total > 0).map((bp) => <span key={bp.person} style={{ width: `${bp.pct}%`, background: COLORS[bp.person] }} />)}
        </div>
        <p className="note">Income is counted as deposits when they hit the accounts — take-home pay, not gross salary. Retirement, HSA, and DCFSA contributions come out before the deposit, so they never appear here.</p>
        {year === "2025" && (
          <p className="note">2025 is a synthetic comparison year generated from the same fictional payroll model; no real account coverage or household statement is represented.</p>
        )}
      </div>

      <div className="card">
        <h2>By category</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Category</th><th className="r">Daniel</th><th className="r">Maya</th><th className="r">Joint</th><th className="r">Total</th><th className="r">Share</th></tr></thead>
          <tbody>
            {(inc.by_category || []).map((c) => (
              <LinkRow key={c.category} href={txnLink({ ic: c.category })} name={c.category} title={`See ${c.category} deposits`}
                sub={c.total > 0 && (
                    <div className="splitbar" style={{ height: 5, marginTop: 6, maxWidth: 220, gap: 1 }} title={`Daniel ${money(c.Daniel)} · Maya ${money(c.Maya)} · Joint ${money(c.Joint)}`}>
                      {ORDER.map((p) => (
                        <span key={p} style={{ width: `${(c[p] / c.total) * 100}%`, background: COLORS[p] }} />
                      ))}
                    </div>
                  )}>
                <td className="r">{c.Daniel ? money(c.Daniel) : "—"}</td>
                <td className="r">{c.Maya ? money(c.Maya) : "—"}</td>
                <td className="r">{c.Joint ? money(c.Joint) : "—"}</td>
                <td className="r">{money(c.total)}</td>
                <td className="r">{c.pct}%</td>
              </LinkRow>
            ))}
            <LinkRow className="total" href={txnLink({})} name="Total" title="See every deposit"><td className="r">{money(inc.by_person.find((b) => b.person === "Daniel").total)}</td><td className="r">{money(inc.by_person.find((b) => b.person === "Maya").total)}</td><td className="r">{money(inc.by_person.find((b) => b.person === "Joint").total)}</td><td className="r">{money(inc.total)}</td><td className="r">100%</td></LinkRow>
          </tbody>
        </table></div>
        <p className="note">Salary is the synthetic payroll stream for Daniel and Maya. Other income categories are included only when the generated ledger supplies them; unlabeled deposits stay in Miscellaneous.</p>
      </div>

      <div className="card">
        <h2>By source</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Source</th><th className="r">Daniel</th><th className="r">Maya</th><th className="r">Joint</th><th className="r">Total</th><th className="r">Share</th></tr></thead>
          <tbody>
            {inc.by_source.map((s) => (
              <LinkRow key={s.source} href={txnLink({ src: s.source })} name={s.source} title={`See ${s.source} deposits`}>
                <td className="r">{s.Daniel ? money(s.Daniel) : "—"}</td>
                <td className="r">{s.Maya ? money(s.Maya) : "—"}</td>
                <td className="r">{s.Joint ? money(s.Joint) : "—"}</td>
                <td className="r">{money(s.total)}</td>
                <td className="r">{s.pct}%</td>
              </LinkRow>
            ))}
            <LinkRow className="total" href={txnLink({})} name="Total" title="See every deposit"><td className="r">{money(inc.by_person.find((b) => b.person === "Daniel").total)}</td><td className="r">{money(inc.by_person.find((b) => b.person === "Maya").total)}</td><td className="r">{money(inc.by_person.find((b) => b.person === "Joint").total)}</td><td className="r">{money(inc.total)}</td><td className="r">100%</td></LinkRow>
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2>How to read this</h2>
        <Kv obj={{
          "Synthetic payroll → Daniel and Maya": "Payroll is tagged to the earner no matter which fictional account receives it.",
          "Joint income": "Money that is not one person's pay: benefits payments, bank bonuses, check deposits, and similar household inflows.",
          "Not shown": "Growth inside retirement and HSA accounts (contributions and market gains) is not a deposit and does not appear as income here.",
        }} raw />
      </div>
    </>
  );
}
