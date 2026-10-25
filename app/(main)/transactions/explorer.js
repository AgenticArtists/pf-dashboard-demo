"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "../../../lib/client-events";
import { money, moneyFlow, isSpend, fmtDate } from "../../../lib/format";
import { Avatar, PersonTag } from "../../../lib/ui";
import { Icon } from "../../../lib/icons";
import { incomeSource } from "../../../lib/income-source";
import { matchSpend, spendLabel, positiveCats } from "../../../lib/spend-filter";
import { spendLineId, incomeLineMatch } from "../../../lib/budget-match";
import { TAXONOMY, SUB_HOME, CAT_GROUP, BUDGET_CATS, INCOME_CAT } from "../../../lib/taxonomy";

const INCOME_SUBS = (TAXONOMY.find(([g]) => g === "Income") || [null, []])[1];
const VALID_SUB_VALUES = new Set(TAXONOMY.flatMap(([g, subs]) => subs.map((s) => `${g}||${s}`)));
const PERSONS = ["Joint", "Maya", "Daniel"];
const fp = (t) => `${t.d}|${t.m}|${String(t.a)}|${t.n}`;
const PAGE = 100;
// Category pill dot: a stable colour per spending group.
const GROUP_DOTS = ["#f2622e", "#4f7fe0", "#2fa36b", "#d9890a", "#9a6fd0", "#3aa6b9", "#e0607e", "#8c9670", "#b28a6e"];
const groupDot = (name) => {
  if (name === "Income") return "#2fa36b";
  if (name === "Transfers" || name === "Card Payments") return "#9a958d";
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUP_DOTS[hash % GROUP_DOTS.length];
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] || ym; // name only — the year is chosen by the page's year toggle
const longDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function Facet({ title, values, selected, onToggle, onClear, counts, labelFn }) {
  return (
    <div className="facet">
      <h3>{title}{selected.size > 0 && <button type="button" onClick={onClear}>Clear</button>}</h3>
      <div className="opts">
        {values.map((v) => (
          <label key={v}>
            <input type="checkbox" checked={selected.has(v)} onChange={() => onToggle(v)} />
            <span>{labelFn ? labelFn(v) : v}</span>
            {counts && <span className="cnt">{counts.get(v) || 0}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

function Chips({ query, setQuery, filters, clearAll }) {
  const chips = [];
  if (query.trim()) chips.push({ key: "query", label: `Search: ${query}`, remove: () => setQuery("") });
  for (const { key, label, values, setFn, display } of filters) {
    for (const value of values) chips.push({ key: `${key}-${value}`, label: `${label}: ${display ? display(value) : value}`, remove: () => setFn((prev) => { const next = new Set(prev); next.delete(value); return next; }) });
  }
  if (!chips.length) return null;
  return <div className="chips" aria-label="Active filters">
    {chips.map((chip) => <span className="chip" key={chip.key}>{chip.label}<button type="button" onClick={chip.remove} aria-label={`Remove ${chip.label}`}>×</button></span>)}
    {chips.length >= 2 && <button type="button" className="chip clear" onClick={clearAll}>Clear all</button>}
  </div>;
}

// Income category exactly as the Income page groups it (no income
// subcategory counts as Miscellaneous there).
const incomeCat = (t) => (t.g === "Income" ? t.ic || "Miscellaneous" : "");
const seed = (v) => new Set(v ? [v] : []);

export default function Explorer({ initialTxns, allCategories, accountList, year, readOnly, configured, initialQuery = "", initialOpen = "", initialFilters = {}, budgets = null }) {
  const [txns, setTxns] = useState(initialTxns);
  const [persons, setPersons] = useState(() => seed(initialFilters.p));
  const [accountsSel, setAccountsSel] = useState(() => seed(initialFilters.m));
  const [groupsSel, setGroupsSel] = useState(() => seed(initialFilters.g));
  const [catsSel, setCatsSel] = useState(() => seed(initialFilters.c));
  const [subsSel, setSubsSel] = useState(() => seed(initialFilters.sc));
  const [incSel, setIncSel] = useState(() => seed(initialFilters.ic));
  const [srcSel, setSrcSel] = useState(() => seed(initialFilters.src));
  const [spendSel, setSpendSel] = useState(() => seed(initialFilters.sp));
  // Card "charges": positive rows that are not card payments (Cards, Recurring).
  const [chargesSel, setChargesSel] = useState(() => seed(initialFilters.ch ? "Charges only" : ""));
  // Budget line drill-down: spend lines claim rows first-match (bl), income
  // lines match independently (bi).
  const budgetKey = initialFilters.bl ? `bl:${initialFilters.bl}` : initialFilters.bll ? `lb:${initialFilters.bll}` : initialFilters.bi ? `bi:${initialFilters.bi}` : "";
  const [budgetSel, setBudgetSel] = useState(() => seed(budgets ? budgetKey : ""));
  // Loan principal the linking page leaves out of spending (Cash flow, Briefing).
  const principal = initialFilters.pr || 0;
  const budgetLabel = (k) => [...(budgets?.spend_lines || []), ...(budgets?.income_lines || [])].find((l) => l.id === k.slice(3))?.label || k.slice(3);
  const [monthsSel, setMonthsSel] = useState(() => seed(initialFilters.mo));
  const [query, setQuery] = useState(initialQuery);
  const [sortKey, setSortKey] = useState("d");
  const [sortDir, setSortDir] = useState("desc");
  const [show, setShow] = useState(PAGE);
  const [saveMsg, setSaveMsgState] = useState(null);
  // Saving… shows inline in the drawer; the outcome arrives as a toast.
  const setSaveMsg = (m) => {
    setSaveMsgState(m && m.kind === "pending" ? m : null);
    if (m && m.kind !== "pending") toast(m.text, m.kind);
  };
  const [editingKey, setEditingKey] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (!editingKey) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setEditingKey(null); };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingKey]);
  // Deep link from a watchdog finding (/transactions?open=date|mask|amount|name):
  // open that transaction's drawer directly so it can be routed.
  useEffect(() => {
    const raw = initialOpen;
    if (!raw) return;
    const [d, m, a, ...rest] = raw.split("|");
    const n = rest.join("|");
    const t = txns.find((x) => x.d === d && x.m === m && Number(x.a) === Number(a) && x.n === n);
    if (t) setEditingKey(fp(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positive = useMemo(() => (spendSel.has("total") ? positiveCats(txns) : null), [txns, spendSel]);
  const accName = useMemo(() => {
    const m = {};
    for (const a of accountList) m[a.mask] = `${a.name} …${a.mask}`;
    return m;
  }, [accountList]);

  // Cross-filtering (Daniel, 2026-10-14): each facet's options and counts
  // are computed from the rows passing every OTHER facet (plus the search
  // query), so selecting a value shrinks the other facets to what actually
  // co-occurs. A facet's own selected values always stay listed so they can
  // be unchecked.
  const passesExcept = (t, except) => {
    const q = query.trim().toLowerCase();
    return (
      (except === "persons" || persons.size === 0 || persons.has(t.p)) &&
      (except === "accounts" || accountsSel.size === 0 || accountsSel.has(t.m)) &&
      (except === "groups" || groupsSel.size === 0 || groupsSel.has(t.g || t.c)) &&
      (except === "categories" || catsSel.size === 0 || catsSel.has(t.c)) &&
      (except === "subcategories" || subsSel.size === 0 || subsSel.has(t.sc || "")) &&
      (except === "months" || monthsSel.size === 0 || monthsSel.has(t.d.slice(0, 7))) &&
      (incSel.size === 0 || incSel.has(incomeCat(t))) &&
      (srcSel.size === 0 || (t.g === "Income" && srcSel.has(incomeSource(t.n)))) &&
      (spendSel.size === 0 || [...spendSel].some((k) => matchSpend(t, k, positive))) &&
      (chargesSel.size === 0 || (t.a > 0 && t.c !== "Card Payments")) &&
      (budgetSel.size === 0 || [...budgetSel].some((k) => (k.startsWith("bl:") ? spendLineId(t, budgets) === k.slice(3) : k.startsWith("lb:") ? spendLineId(t, budgets, true) === k.slice(3) : incomeLineMatch(t, budgets, k.slice(3))))) &&
      (!q || (t.dn || t.n).toLowerCase().includes(q))
    );
  };

  const facetValues = useMemo(() => {
    const build = (key, fn, selected, { desc = false, skipEmpty = false } = {}) => {
      const counts = new Map();
      for (const t of txns) {
        if (!passesExcept(t, key)) continue;
        const k = fn(t);
        if (skipEmpty && !k) continue;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      const values = [...new Set([...counts.keys(), ...selected])].filter((v) => !skipEmpty || v).sort();
      if (desc) values.reverse();
      return { values, counts };
    };
    return {
      persons: build("persons", (t) => t.p, persons),
      accounts: build("accounts", (t) => t.m, accountsSel),
      groups: build("groups", (t) => t.g || t.c, groupsSel),
      categories: build("categories", (t) => t.c, catsSel),
      subcategories: build("subcategories", (t) => t.sc || "", subsSel, { skipEmpty: true }),
      months: build("months", (t) => t.d.slice(0, 7), monthsSel, { desc: true }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns, persons, accountsSel, groupsSel, catsSel, subsSel, incSel, srcSel, spendSel, chargesSel, budgetSel, positive, monthsSel, query]);

  const filtered = useMemo(
    () => txns.filter((t) => passesExcept(t, null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns, persons, accountsSel, groupsSel, catsSel, subsSel, incSel, srcSel, spendSel, chargesSel, budgetSel, positive, monthsSel, query]
  );
  const filteredSpend = useMemo(() => filtered.filter(isSpend).reduce((s, t) => s + t.a, 0), [filtered]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = {
      d: (x, y) => x.d.localeCompare(y.d),
      n: (x, y) => x.n.localeCompare(y.n),
      m: (x, y) => (accName[x.m] || x.m).localeCompare(accName[y.m] || y.m) || x.d.localeCompare(y.d),
      c: (x, y) => x.c.localeCompare(y.c) || x.d.localeCompare(y.d),
      ic: (x, y) => (x.ic || "").localeCompare(y.ic || "") || x.d.localeCompare(y.d),
      p: (x, y) => x.p.localeCompare(y.p) || x.d.localeCompare(y.d),
      a: (x, y) => x.a - y.a,
    }[sortKey] || (() => 0);
    return [...filtered].sort((x, y) => dir * cmp(x, y));
  }, [filtered, sortKey, sortDir, accName]);

  function onSort(key) {
    if (key === sortKey) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortKey(key); setSortDir(key === "a" || key === "d" ? "desc" : "asc"); }
    setShow(PAGE);
  }

  const toggle = (setFn) => (v) => { setFn((prev) => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; }); setShow(PAGE); };

  async function postOverride(key, field, value) {
    const res = await fetch("/api/overrides", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "transaction", target_key: key, field, value }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.reason || `http ${res.status}`);
  }

  async function edit(t, field, value) {
    const key = fp(t);
    const prev = txns;
    setTxns((rows) => rows.map((r) => (fp(r) === key ? { ...r, [field === "person" ? "p" : field === "subcategory" ? "ic" : "c"]: value, edited: true } : r)));
    setSaveMsg({ kind: "pending", key, text: "Saving…" });
    try {
      await postOverride(key, field, value);
      setSaveMsg({ kind: "ok", key, text: `Saved — ${field} set to ${value}. It's live across the dashboard now, and becomes part of the permanent data at the next morning refresh.` });
    } catch (e) {
      setTxns(prev);
      setSaveMsg({ kind: "err", key, text: `Could not save (${e.message}). The change was undone.` });
    }
  }

  // Expense/income subcategory edit: the picked (group, subcategory) also
  // carries its home budget category — when that differs from the row's
  // current category, a paired category override keeps the two in sync.
  async function editSubcategory(t, encoded) {
    const [group, sub] = encoded.split("||");
    const home = SUB_HOME[`${group}|${sub}`];
    const key = fp(t);
    const prev = txns;
    setTxns((rows) => rows.map((r) => (fp(r) === key
      ? { ...r, g: group, sc: sub, ...(t.g === "Income" ? { ic: sub, c: INCOME_CAT[sub] || r.c } : {}), ...(t.g !== "Income" && home && home !== t.c ? { c: home } : {}), edited: true }
      : r)));
    setSaveMsg({ kind: "pending", key, text: "Saving…" });
    try {
      await postOverride(key, "subcategory", sub);
      if (t.g !== "Income" && home && home !== t.c) await postOverride(key, "category", home);
      setSaveMsg({ kind: "ok", key, text: `Saved — subcategory set to ${sub}. It's live across the dashboard now, and becomes part of the permanent data at the next morning refresh.` });
    } catch (e) {
      setTxns(prev);
      setSaveMsg({ kind: "err", key, text: `Could not save (${e.message}). The change was undone.` });
    }
  }

  async function editCategory(t, cat) {
    const key = fp(t);
    const prev = txns;
    let g = CAT_GROUP[cat] || t.g || cat;
    let sc = t.sc;
    if (cat === "Transfers" || cat === "Card Payments") {
      g = cat;
      sc = "";
    } else if (cat === "Income") {
      g = "Income";
      sc = INCOME_SUBS.includes(t.sc) ? t.sc : "Miscellaneous";
    } else if (cat === "Loans") {
      g = t.g === "Educational Expenses" ? "Educational Expenses" : "Automotive Expenses";
      sc = "Loans";
    } else {
      const cands = TAXONOMY.flatMap(([gg, subs]) => subs.filter((s) => SUB_HOME[`${gg}|${s}`] === cat).map((s) => [gg, s]));
      const pick = cands.find(([, s]) => s === cat) || cands.find(([gg]) => gg === t.g) || cands[0];
      if (pick) { g = pick[0]; sc = pick[1]; }
    }
    setTxns((rows) => rows.map((r) => (fp(r) === key
      ? { ...r, c: cat, g, sc, ...(cat === "Income" ? { ic: sc } : {}), edited: true }
      : r)));
    setSaveMsg({ kind: "pending", key, text: "Saving…" });
    try {
      await postOverride(key, "category", cat);
      if (sc && sc !== t.sc) await postOverride(key, "subcategory", sc);
      setSaveMsg({ kind: "ok", key, text: `Saved — category set to ${cat}. It's live across the dashboard now, and becomes part of the permanent data at the next morning refresh.` });
    } catch (e) {
      setTxns(prev);
      setSaveMsg({ kind: "err", key, text: `Could not save (${e.message}). The change was undone.` });
    }
  }

  const editable = !readOnly && configured;
  const spendingRows = filtered.filter(isSpend);
  const largestExpense = spendingRows.reduce((largest, t) => (!largest || t.a > largest.a ? t : largest), null);
  const averageSpend = spendingRows.length ? filteredSpend / spendingRows.length : 0;
  const filteredIncome = filtered.filter((t) => t.g === "Income").reduce((s, t) => s - t.a, 0);
  const editing = editingKey ? txns.find((t) => fp(t) === editingKey) : null;
  // The subcategory picker only offers subcategories whose home budget
  // category is the transaction's currently selected category (the same
  // SUB_HOME mapping editCategory uses to pick a default). Income rows get
  // the Income group only. The current value is always rendered (guard
  // optgroup below) even when it belongs to another category, so the select
  // never misrepresents the row's saved state.
  const subOptions = !editing ? [] : editing.g === "Income"
    ? [["Income", INCOME_SUBS]]
    : TAXONOMY.map(([g, subs]) => [g, subs.filter((s) => SUB_HOME[`${g}|${s}`] === editing.c)]).filter(([, subs]) => subs.length > 0);
  const currentSubListed = !!editing && subOptions.some(([g, subs]) => g === (editing.g || editing.c) && subs.includes(editing.sc));
  const visible = sorted.slice(0, show);
  const activeFilters = persons.size + accountsSel.size + groupsSel.size + catsSel.size + subsSel.size + incSel.size + srcSel.size + spendSel.size + chargesSel.size + budgetSel.size + monthsSel.size;
  const renderTransaction = (t, i) => {
    const name = t.dn || t.n || "Unnamed";
    const group = t.g || t.c || "Uncategorized";
    return <button type="button" key={`${fp(t)}-${i}`} className={`transaction-row ${t.edited ? "edited" : ""}`} onClick={() => setEditingKey(fp(t))}>
      <Avatar name={name} />
      <div className="transaction-main">
        <div className="transaction-name" title={name}><span className="transaction-name-text">{name}</span>{t.edited && <span className="edited-tag">Edited</span>}</div>
        <div className="transaction-sub"><span title={accName[t.m] || ""}>{accName[t.m] || `…${t.m}`}</span><span aria-hidden="true">·</span><PersonTag person={t.p} />{sortKey !== "d" && <><span aria-hidden="true">·</span><span>{fmtDate(t.d)}</span></>}</div>
      </div>
      <div className="transaction-cat"><span className="pill" title={`${t.c || "Uncategorized"} · ${group}${t.sc ? ` · ${t.sc}` : ""}`}><span className="swatch" style={{ background: groupDot(group) }} />{t.c || "Uncategorized"}</span></div>
      <div className={`transaction-amount ${t.a < 0 ? "neg" : ""}`}>{moneyFlow(t.a)}</div>
      <span className="transaction-chevron" aria-hidden="true"><Icon name="chevronRight" size={16} /></span>
    </button>;
  };
  const transactionList = [];
  let previousDate = null;
  visible.forEach((t, i) => {
    if (sortKey === "d" && t.d !== previousDate) {
      const dayRows = visible.filter((row) => row.d === t.d);
      const dayNet = dayRows.reduce((sum, row) => sum + row.a, 0);
      transactionList.push(<div className="date-group" key={`date-${t.d}`}><div className="date-heading"><span>{longDate(t.d)}</span><span className="date-total">{moneyFlow(dayNet)}</span></div>{dayRows.map((row, rowIndex) => renderTransaction(row, `${i}-${rowIndex}`))}</div>);
      previousDate = t.d;
    } else if (sortKey !== "d") transactionList.push(renderTransaction(t, i));
  });
  // Export exactly what's on screen: the filtered rows in the current sort.
  // Amount uses the usual bank-file sign (money in +, money out −).
  function exportCsv() {
    const esc = (v) => { const t = String(v ?? ""); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const header = ["Date", "Merchant", "Bank description", "Category", "Group", "Subcategory", "Person", "Account", "Amount"];
    const lines = [header, ...sorted.map((t) => [t.d, t.dn || t.n, t.n, t.c, t.g || "", t.sc || "", t.p, accName[t.m] || t.m, (-Number(t.a)).toFixed(2)])]
      .map((r) => r.map(esc).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${year}${sorted.length < txns.length ? "-filtered" : ""}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${sorted.length.toLocaleString()} transaction${sorted.length === 1 ? "" : "s"} to CSV.`);
  }
  const clearAll = () => { setQuery(""); setPersons(new Set()); setAccountsSel(new Set()); setGroupsSel(new Set()); setCatsSel(new Set()); setSubsSel(new Set()); setIncSel(new Set()); setSrcSel(new Set()); setSpendSel(new Set()); setChargesSel(new Set()); setBudgetSel(new Set()); setMonthsSel(new Set()); setShow(PAGE); };

  return (
    <>
      <div className="card txn-toolbar">
        <div className="searchrow">
          <label className="searchbox"><Icon name="search" size={17} /><input type="search" placeholder="Search merchants…" aria-label="Search merchants" value={query} onChange={(e) => { setQuery(e.target.value); setShow(PAGE); }} /></label>
          <button type="button" className={`btn ghost filter-toggle`} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}><Icon name="filter" size={16} />Filters{activeFilters > 0 && <span className="count">{activeFilters}</span>}</button>
          <button type="button" className="btn ghost filter-toggle" onClick={exportCsv} disabled={sorted.length === 0} title="Download the rows shown as a CSV file"><Icon name="download" size={16} />Export</button>
          <div className="sortrow"><select value={sortKey} onChange={(e) => { if (e.target.value !== sortKey) onSort(e.target.value); }} aria-label="Sort transactions"><option value="d">Date</option><option value="a">Amount</option><option value="n">Name</option><option value="c">Category</option></select><button type="button" className="sort-direction" onClick={() => onSort(sortKey)} aria-label={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`} title={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}><Icon name={sortDir === "asc" ? "arrowUp" : "arrowDown"} size={16} /></button></div>
        </div>
        {filtersOpen && <div className="facets">
          <Facet title="Person" values={facetValues.persons.values} counts={facetValues.persons.counts} selected={persons} onToggle={toggle(setPersons)} onClear={() => setPersons(new Set())} />
          <Facet title="Account" values={facetValues.accounts.values} counts={facetValues.accounts.counts} selected={accountsSel} onToggle={toggle(setAccountsSel)} onClear={() => setAccountsSel(new Set())} labelFn={(m) => accName[m] || `…${m}`} />
          <Facet title="Group" values={facetValues.groups.values} counts={facetValues.groups.counts} selected={groupsSel} onToggle={toggle(setGroupsSel)} onClear={() => setGroupsSel(new Set())} />
          <Facet title="Category" values={facetValues.categories.values} counts={facetValues.categories.counts} selected={catsSel} onToggle={toggle(setCatsSel)} onClear={() => setCatsSel(new Set())} />
          {facetValues.subcategories.values.length > 0 && <Facet title="Subcategory" values={facetValues.subcategories.values} counts={facetValues.subcategories.counts} selected={subsSel} onToggle={toggle(setSubsSel)} onClear={() => setSubsSel(new Set())} />}
          <Facet title="Month" values={facetValues.months.values} counts={facetValues.months.counts} selected={monthsSel} onToggle={toggle(setMonthsSel)} onClear={() => setMonthsSel(new Set())} labelFn={monthName} />
        </div>}
        <Chips query={query} setQuery={setQuery} filters={[{ key: "person", label: "Person", values: persons, setFn: setPersons }, { key: "account", label: "Account", values: accountsSel, setFn: setAccountsSel, display: (m) => accName[m] || `…${m}` }, { key: "group", label: "Group", values: groupsSel, setFn: setGroupsSel }, { key: "category", label: "Category", values: catsSel, setFn: setCatsSel }, { key: "subcategory", label: "Subcategory", values: subsSel, setFn: setSubsSel }, { key: "income", label: "Income category", values: incSel, setFn: setIncSel }, { key: "source", label: "Income source", values: srcSel, setFn: setSrcSel }, { key: "spend", label: "Spending", values: spendSel, setFn: setSpendSel, display: spendLabel }, { key: "charges", label: "Type", values: chargesSel, setFn: setChargesSel }, { key: "budget", label: "Budget line", values: budgetSel, setFn: setBudgetSel, display: budgetLabel }, { key: "month", label: "Month", values: monthsSel, setFn: setMonthsSel, display: monthName }]} clearAll={clearAll} />
        {!configured && !readOnly && <div className="notice"><Icon name="info" size={16} /><span>Editing on the website switches on once the site&apos;s GitHub token is added by Daniel (Vercel env var GITHUB_TOKEN). Until then this page is view-only.</span></div>}
        {principal > 0 && <div className="notice"><Icon name="info" size={16} /><span>The page you came from counts {money(principal)} of this month&apos;s Riverbend auto-loan payment as principal (equity), not spending. The payment is listed here in full, so Spending here is {money(principal)} higher.</span></div>}
        {readOnly && <div className="notice"><Icon name="info" size={16} /><span>2025 is read-only (the override system is keyed to the current-year ledger).</span></div>}
      </div>
      <div className="mobile-totals" aria-label="Filtered total"><span>{filtered.length.toLocaleString()} of {txns.length.toLocaleString()} transactions</span><span>Spend <strong>{money(filteredSpend)}</strong></span></div>
      <div className="transaction-layout">
        <section className="card transaction-list-card" aria-label="Transactions">
          {filtered.length === 0 ? <div style={{ padding: 22 }}><div className="empty"><span className="empty-icon"><Icon name="search" size={20} /></span><div><strong>No transactions match</strong><div className="note">Try a different search or <button type="button" className="mini-btn" onClick={clearAll}>clear all filters</button></div></div></div></div> : <div className="transaction-list">{transactionList}</div>}
          {filtered.length > show && <div className="pager transaction-pager"><button className="btn ghost" type="button" onClick={() => setShow(show + PAGE)}>Show more ({(filtered.length - show).toLocaleString()} remaining)</button></div>}
        </section>
        <aside className="summary-rail"><div className="card"><h2>Summary</h2>
          <div className="summary-line"><div className="label">Transactions</div><div className="value num">{filtered.length.toLocaleString()} <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>of {txns.length.toLocaleString()}</span></div></div>
          <div className="summary-line"><div className="label">Spending</div><div className="value num">{money(filteredSpend)}</div>{principal > 0 && budgetSel.size + spendSel.size + monthsSel.size > 0 && <div className="sub">{money(filteredSpend - principal)} excluding {money(principal)} of loan principal</div>}</div>
          <div className="summary-line"><div className="label">Income</div><div className="value num pos">{money(filteredIncome)}</div></div>
          <div className="summary-line"><div className="label">Largest expense</div><div className="value num">{largestExpense ? money(largestExpense.a) : "—"}</div><div className="sub">{(largestExpense?.dn || largestExpense?.n) || "No expenses in this set"}</div></div>
          <div className="summary-line"><div className="label">Average spend</div><div className="value num">{money(averageSpend)}</div><div className="sub">Across {spendingRows.length.toLocaleString()} spending transactions</div></div>
        </div></aside>
      </div>
      {editing && <div className="drawer-backdrop" onClick={() => setEditingKey(null)}><aside className="drawer transaction-drawer" role="dialog" aria-modal="true" aria-label="Edit transaction" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div className="drawer-title"><Avatar name={editing.dn || editing.n || "Unnamed"} size={44} /><div style={{ minWidth: 0 }}><h2>{editing.dn || editing.n || "Unnamed"}</h2>{editing.edited && <span className="edited-tag" style={{ marginLeft: 0 }}>Edited</span>}</div></div><button type="button" className="icon-btn" onClick={() => setEditingKey(null)} aria-label="Close"><Icon name="close" /></button></div>
        <div className="drawer-amount"><div className={`value ${editing.a < 0 ? "neg" : ""}`}>{moneyFlow(editing.a)}</div><div className="date">{longDate(editing.d)}</div></div>
        <div className="drawer-facts"><div className="kv">
          <span className="k">Account</span><span>{accName[editing.m] || `…${editing.m}`}</span>
          <span className="k">Group</span><span>{editing.g || editing.c || "—"}</span>
          {editing.n && editing.dn && editing.dn !== editing.n && <><span className="k">Bank text</span><span style={{ overflowWrap: "anywhere" }}>{editing.n}</span></>}
          {editing.desc && <><span className="k">Details</span><span>{editing.desc}</span></>}
        </div></div>
        <div className="drawer-form">
        <label>Category{editable && editing.g === "Income" ? <select value="__income" onChange={(e) => { if (e.target.value === "Transfers") editCategory(editing, "Transfers"); }} title="Income category is derived from the subcategory — or move this deposit to Transfers"><option value="__income">{editing.c}</option><option value="Transfers">Transfers</option></select> : editable ? <select value={editing.c} onChange={(e) => editCategory(editing, e.target.value)} title="Budget category">{(BUDGET_CATS.includes(editing.c) ? BUDGET_CATS : [editing.c, ...BUDGET_CATS]).map((c) => <option key={c} value={c}>{c}</option>)}</select> : <span className="field-note">{editing.c} · {editing.g || editing.c}</span>}</label>
        <label>Subcategory{editable && editing.sc ? <select value={`${editing.g || editing.c}||${editing.sc}`} onChange={(e) => editSubcategory(editing, e.target.value)}>{!currentSubListed && <optgroup label={editing.g || editing.c}><option value={`${editing.g || editing.c}||${editing.sc}`}>{editing.sc}</option></optgroup>}{subOptions.map(([g, subs]) => <optgroup key={g} label={g}>{subs.map((s) => <option key={s} value={`${g}||${s}`}>{s}</option>)}</optgroup>)}</select> : <span className="field-note">{editing.sc || "—"}</span>}</label>
        <label>Person{editable ? <select value={editing.p} onChange={(e) => edit(editing, "person", e.target.value)}>{PERSONS.map((p) => <option key={p} value={p}>{p}</option>)}</select> : <span className="field-note"><PersonTag person={editing.p} /></span>}</label>
        <div className="savebar">{saveMsg && saveMsg.key === editingKey && <span className={saveMsg.kind === "err" ? "err-text" : saveMsg.kind === "ok" ? "ok-text" : ""}>{saveMsg.text}</span>}</div>
      </div></aside></div>}
    </>
  );
}
