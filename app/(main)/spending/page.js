import { data, money, num } from "../../../lib/data";
import { PERSON_COLORS, isSpend } from "../../../lib/format";
import { getOverrides, applyRecordsToTxns } from "../../../lib/overrides";
import SpendingExplorer from "./explorer";
import PersonReport from "./report";
import { PageHeader, YearToggle, Stat, CardHead, Progress } from "../../../lib/ui";
import LinkRow from "../../../lib/link-row";
import { ledgerCat, spendHref, vendorName } from "../../../lib/spend-filter";
import { loadCoverage, isAffected, personFlagged } from "../../../lib/coverage";
import { CoverageNote } from "../../../lib/coverage-note";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const medianOf = (xs) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return 0; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctChange = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

// Per-person spending report, computed live from the same live-layered
// transactions as the rest of the page (prior-year comparisons use the
// other year's file, cut off at the same month-day so periods align).
function buildReports(txnsY, txnsO, year, cov) {
  const spendY = txnsY.filter(isSpend);
  const maxDate = spendY.reduce((mx, t) => (t.d > mx ? t.d : mx), "");
  const maxMonth = Number(maxDate.slice(5, 7));
  const isCurrentYear = year === "2026";
  const household = spendY.reduce((s, t) => s + t.a, 0);
  const cutoffMD = maxDate.slice(5);
  const reports = {};
  for (const person of ["Daniel", "Maya", "Joint"]) {
    const rows = spendY.filter((t) => t.p === person);
    const total = rows.reduce((s, t) => s + t.a, 0);
    const charges = rows.filter((t) => t.a > 0).map((t) => t.a);
    const monthly = [];
    for (let m = 1; m <= (isCurrentYear ? maxMonth : 12); m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const tot = rows.filter((t) => t.d.startsWith(key)).reduce((s, t) => s + t.a, 0);
      monthly.push({ m: MONTH_NAMES[m - 1], total: r2(tot), partial: isCurrentYear && m === maxMonth });
    }
    const full = monthly.filter((x) => !x.partial);
    const monthlyAvg = full.length ? full.reduce((s, x) => s + x.total, 0) / full.length : 0;
    monthly.forEach((x, i) => {
      x.mom = i === 0 ? null : pctChange(x.total, monthly[i - 1].total);
      x.vsAvg = monthlyAvg ? ((x.total - monthlyAvg) / monthlyAvg) * 100 : 0;
    });
    const catTotals = new Map(), venTotals = new Map();
    for (const t of rows) {
      catTotals.set(t.c, (catTotals.get(t.c) || 0) + t.a);
      const vk = vendorName(t);
      const ve = venTotals.get(vk) || { total: 0, count: 0 };
      ve.total += t.a; ve.count += 1; venTotals.set(vk, ve);
    }
    const topCats = [...catTotals.entries()].map(([name, tot]) => ({ name, total: r2(tot), share: total ? (tot / total) * 100 : 0 })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
    const topVendors = [...venTotals.entries()].map(([name, v]) => ({ name, total: r2(v.total), count: v.count })).filter((v) => v.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
    const biggest = [...rows].filter((t) => t.a > 0).sort((a, b) => b.a - a.a).slice(0, 3).map((t) => ({ d: t.d, n: t.n, a: r2(t.a), c: t.c, key: `${t.d}|${t.m}|${t.a}|${t.n}` }));
    const priorRows = year === "2025" ? [] : txnsO.filter((t) => isSpend(t) && t.p === person && t.d.slice(5) <= cutoffMD);
    const priorTotal = priorRows.reduce((s, t) => s + t.a, 0);
    const yoyPct = year === "2025" ? null : pctChange(total, priorTotal);
    let moverUp = null, moverDown = null;
    if (year !== "2025") {
      const priorCats = new Map();
      for (const t of priorRows) priorCats.set(t.c, (priorCats.get(t.c) || 0) + t.a);
      for (const name of new Set([...catTotals.keys(), ...priorCats.keys()])) {
        const d = (catTotals.get(name) || 0) - (priorCats.get(name) || 0);
        if (d >= 50 && (!moverUp || d > moverUp.delta)) moverUp = { name, delta: r2(d) };
        if (d <= -50 && (!moverDown || d < moverDown.delta)) moverDown = { name, delta: r2(d) };
      }
    }
    let trend = null;
    if (full.length >= 6) {
      const lastQ = full.slice(-3).reduce((s, x) => s + x.total, 0);
      const priorQ = full.slice(-6, -3).reduce((s, x) => s + x.total, 0);
      trend = { pct: pctChange(lastQ, priorQ), lastQ: r2(lastQ), priorQ: r2(priorQ), label: `${full[full.length - 3].m}–${full[full.length - 1].m}`, priorLabel: `${full[full.length - 6].m}–${full[full.length - 4].m}` };
    }
    const bigMonth = full.length ? full.reduce((a, b) => (b.total > a.total ? b : a)) : null;
    const lightMonth = full.length ? full.reduce((a, b) => (b.total < a.total ? b : a)) : null;
    const insights = [];
    if (topCats[0]) insights.push(`${topCats[0].name} is the biggest category at ${money(topCats[0].total)} — ${topCats[0].share.toFixed(1)}% of ${person === "Joint" ? "joint" : `${person}'s`} spending.`);
    if (topVendors[0]) insights.push(`Top vendor: ${topVendors[0].name} at ${money(topVendors[0].total)} across ${topVendors[0].count} charges.`);
    if (bigMonth && lightMonth && bigMonth.m !== lightMonth.m) insights.push(`Biggest month: ${bigMonth.m} at ${money(bigMonth.total)}. Lightest full month: ${lightMonth.m} at ${money(lightMonth.total)}.`);
    if (trend) insights.push(`Spending ${trend.pct >= 0 ? "rose" : "fell"} ${Math.abs(trend.pct).toFixed(1)}% in ${trend.label} vs ${trend.priorLabel} (${money(trend.lastQ)} vs ${money(trend.priorQ)}).`);
    if (yoyPct != null) insights.push(`Total is ${yoyPct >= 0 ? "up" : "down"} ${Math.abs(yoyPct).toFixed(1)}% vs the same stretch of ${Number(year) - 1} (${money(total)} vs ${money(r2(priorTotal))}).`);
    if (moverUp) insights.push(`Biggest category increase vs last year: ${moverUp.name}${isAffected(cov, moverUp.name) ? " †" : ""}, up ${money(moverUp.delta)}.`);
    if (moverDown) insights.push(`Biggest category decrease vs last year: ${moverDown.name}${isAffected(cov, moverDown.name) ? " †" : ""}, down ${money(Math.abs(moverDown.delta))}.`);
    if (biggest[0]) insights.push(`Largest single purchase: ${biggest[0].n}, ${money(biggest[0].a)} on ${biggest[0].d}.`);
    reports[person] = {
      total: r2(total), share: household ? (total / household) * 100 : 0,
      count: rows.length, medianTxn: r2(medianOf(charges)), monthlyAvg: r2(monthlyAvg),
      fullMonths: full.length, monthly, topCats, topVendors, biggest,
      priorTotal: r2(priorTotal), yoyPct: yoyPct == null ? null : Math.round(yoyPct * 10) / 10, insights,
      gapFlagged: year === "2025" ? false : personFlagged(cov, person),
    };
  }
  return reports;
}

export const dynamic = "force-dynamic";

const r2 = (x) => Math.round(x * 100) / 100;
// Live aggregates (2026-10-14): the category totals are computed from the
// live-layered transactions instead of the baked categories file, so site
// edits move this page immediately. The aggregate key is the LEDGER
// category (lib/spend-filter.js), which reproduces the pipeline summary to
// the cent when no live edits intervene.

export default async function Spending({ searchParams }) {
  const sp = await searchParams;
  const year = sp?.y === "2025" ? "2025" : "2026";
  const records = await getOverrides().catch(() => []);
  const txns = applyRecordsToTxns(data(`transactions_${year}.json`), records);
  const catMap = new Map();
  const personTotals = { Joint: 0, Maya: 0, Daniel: 0 };
  for (const t of txns) {
    if (!isSpend(t)) continue;
    const key = ledgerCat(t);
    if (!catMap.has(key)) catMap.set(key, { name: key, spend: 0, rows: 0, ps: { Daniel: 0, Maya: 0, Joint: 0 } });
    const c = catMap.get(key);
    c.spend += t.a; c.rows += 1;
    if (c.ps[t.p] != null) c.ps[t.p] += t.a;
    if (personTotals[t.p] != null) personTotals[t.p] += t.a;
  }
  const cats = [...catMap.values()]
    .map((c) => ({ name: c.name, spend: r2(c.spend), rows: c.rows, ps: { Daniel: r2(c.ps.Daniel), Maya: r2(c.ps.Maya), Joint: r2(c.ps.Joint) } }))
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const total = cats.reduce((s, r) => s + r.spend, 0);
  const attr = { totals: { Joint: r2(personTotals.Joint), Maya: r2(personTotals.Maya), Daniel: r2(personTotals.Daniel) } };
  // Essential/Discretionary computes LIVE from the edited transactions:
  // each row carries its E/D type ("ct") from the pipeline split, so edits
  // update this card instantly instead of waiting for the next publish.
  const essLive = { Essential: 0, Discretionary: 0 };
  for (const t of txns) {
    if (!isSpend(t)) continue;
    if (t.ct === "Essential") essLive.Essential += t.a;
    else if (t.ct === "Discretionary") essLive.Discretionary += t.a;
  }
  const ess = { essential: r2(essLive.Essential), discretionary: r2(essLive.Discretionary) };
  // Budget pace: the monthly budget per category is a stored table, but the
  // current month's actuals and pace are computed LIVE from the edited
  // transactions (same formulas as build_cash_budget.py).
  const paceRaw = year === "2026" ? data("budget_pace.json") : null;
  let pace = null;
  if (paceRaw) {
    const MON = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const mm = /budget_pace_([a-z]{3})(\d{4})/.exec(paceRaw.file || "");
    const pMonth = mm ? `${mm[2]}-${MON[mm[1]]}` : txns.reduce((s, t) => (t.d.slice(0, 7) > s ? t.d.slice(0, 7) : s), "");
    const [py, pm] = pMonth.split("-").map(Number);
    const daysInMonth = new Date(py, pm, 0).getDate();
    let maxDay = 1;
    const actByCat = new Map();
    for (const t of txns) {
      if (t.d.slice(0, 7) !== pMonth) continue;
      maxDay = Math.max(maxDay, Number(t.d.slice(8, 10)));
      if (isSpend(t)) actByCat.set(t.c, (actByCat.get(t.c) || 0) + t.a);
    }
    const rows = paceRaw.rows.map((r) => {
      const budget = num(r.budget_month);
      const actual = r2(actByCat.get(r.category) || 0);
      const expected = r2(budget * (maxDay / daysInMonth));
      const ratio = expected > 0 ? actual / expected : null;
      const status = budget <= 0 ? "no_budget" : ratio == null ? "on_track" : ratio >= 1.25 ? "over_pace" : ratio < 0.75 ? "under" : "on_track";
      return { category: r.category, budget_month: budget, actual_oct: actual, expected_by_now: expected, pace_ratio: ratio == null ? "" : ratio.toFixed(2), status, over_by: r2(actual - expected) };
    }).sort((a, b) => b.over_by - a.over_by);
    pace = { rows, month: pMonth, monthLabel: new Date(py, pm - 1, 1).toLocaleString("en-US", { month: "long" }) };
  }
  const otherTxns = applyRecordsToTxns(data(`transactions_${year === "2026" ? "2025" : "2026"}.json`), records);
  const cov = loadCoverage();
  const reports = buildReports(txns, otherTxns, year, cov);

  return (
    <>
      <PageHeader
        title="Spending"
        subtitle={year === "2025" ? "2025 is the earlier synthetic comparison year." : "Net spending by person and category, computed live from the synthetic transaction ledger (refunds reduce their category)."}
        actions={<YearToggle base="/spending" year={year} />}
      />

      {year !== "2025" ? <CoverageNote cov={cov} extra={cov?.person_note || null} /> : null}

      <div className="cards">
        <Stat label={`Total spend ${year}`} value={money(total)} sub={`${cats.reduce((s, r) => s + r.rows, 0).toLocaleString()} transactions`} />
        {(attr.totals ? Object.entries(attr.totals) : []).map(([p, v]) => (
          <Stat key={p} label={p} dot={PERSON_COLORS[p] || "#888"} value={money(v)} sub={`${total ? ((v / total) * 100).toFixed(1) : 0}% of spend`} />
        ))}
        <Stat label="Essential" value={money(ess.essential)} sub={`Discretionary ${money(ess.discretionary)}`} />
      </div>

      <PersonReport key={year} reports={reports} year={year} />

      <SpendingExplorer key={year} cats={cats} txns={txns} year={year} />

      {pace && (
        <div className="card">
          <CardHead title={`${pace.monthLabel} budget pace`} sub="Actual so far vs the trailing monthly budget, prorated to today · select a row for its transactions" />
          <div className="table-scroll">
            <table>
              <thead><tr><th>Category</th><th className="r">Monthly budget</th><th className="r">{pace.monthLabel} so far</th><th style={{ width: "26%" }} className="hide-sm">Used</th><th className="r">Pace</th><th>Status</th></tr></thead>
              <tbody>
                {pace.rows.map((r, i) => (
                  <LinkRow key={i} href={spendHref(year, `c:${r.category}`, { mo: pace.month })} name={r.category} title={`See ${r.category} transactions in ${pace.monthLabel}`}>
                    <td className="r">{money(r.budget_month)}</td><td className="r">{money(r.actual_oct)}</td>
                    <td className="hide-sm" style={{ verticalAlign: "middle" }}><Progress value={r.actual_oct} max={r.budget_month || 1} tone={r.status === "over_pace" ? "bad" : "good"} /></td>
                    <td className="r">{num(r.pace_ratio).toFixed(2)}×</td>
                    <td>{r.status === "over_pace" ? <span className="badge over">Over pace</span> : <span className="badge good">On pace</span>}</td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
