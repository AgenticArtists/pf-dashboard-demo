"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../../lib/icons";
import { SECTIONS } from "../../lib/nav-items";
import { applyTheme, navStart } from "../../lib/client-events";

// ---------------------------------------------------------------------------
// Thin progress bar while a client-side navigation is in flight.
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() || "";
  const [state, setState] = useState("idle"); // idle | loading | done
  const timer = useRef(null);

  useEffect(() => {
    const start = () => { clearTimeout(timer.current); setState("loading"); };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("pf:navstart", start);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("pf:navstart", start); };
  }, []);

  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    timer.current = setTimeout(() => setState("idle"), 350);
    return () => clearTimeout(timer.current);
  }, [pathname, search]);

  return <div className={`nav-progress ${state}`} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// "Synced 2h ago" — data freshness from the pipeline's generated_at, amber
// when a staleness watchdog is firing.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function relative(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
export function SyncStatus({ generated, stale, compact = false }) {
  // Server and first client render agree on a fixed date; the relative
  // time fills in after mount (no hydration mismatch).
  const fixed = generated ? `${MONTHS[Number(generated.slice(5, 7)) - 1]} ${Number(generated.slice(8, 10))}` : "";
  const [rel, setRel] = useState("");
  useEffect(() => {
    if (!generated) return undefined;
    const tick = () => setRel(relative(generated));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [generated]);
  if (!generated) return null;
  const label = `Synced ${rel || fixed}`;
  const title = stale ? `${stale} · data generated ${generated}` : `Data generated ${generated}`;
  return (
    <span className={`sync-pill ${stale ? "stale" : ""} ${compact ? "compact" : ""}`} title={title} role="status">
      <span className="sync-dot" />{compact ? null : (stale ? `${label} · source stale` : label)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toasts: anything can call toast() from lib/client-events.
export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e) => {
      const id = ++n;
      const { text, kind } = e.detail || {};
      setItems((xs) => [...xs.slice(-2), { id, text, kind }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "err" ? 7000 : 3800);
    };
    window.addEventListener("pf:toast", onToast);
    return () => window.removeEventListener("pf:toast", onToast);
  }, []);
  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind === "err" ? "err" : "ok"}`} role={t.kind === "err" ? "alert" : "status"}>
          <Icon name={t.kind === "err" ? "alert" : "check"} size={16} />
          <span>{t.text}</span>
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}><Icon name="close" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⌘K / Ctrl+K command palette: pages, transaction search, theme, sign out.
const PAGES = SECTIONS.flatMap(([section, links]) => links.map(([href, label, icon]) => ({ kind: "page", href, label, icon, hint: section || "Go to" })));

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setQ(""); setActive(0); setOpen((o) => !o); }
    };
    // Reset the query in the same event that opens it, so fast typing right
    // after ⌘K never lands in a stale query.
    const onOpen = () => { setQ(""); setActive(0); setOpen(true); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pf:palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pf:palette", onOpen); };
  }, []);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (s) => !term || s.toLowerCase().includes(term);
    // Matching pages first (typing "budg" + Enter opens Budgets); the
    // transaction search comes right after, so a merchant name still works.
    const out = PAGES.filter((p) => match(p.label) || match(p.href.slice(1)));
    if (term) out.push({ kind: "search", label: `Search transactions for “${q.trim()}”`, icon: "search", hint: "Transactions" });
    const actions = [
      { kind: "theme", value: "light", label: "Switch to light theme", icon: "sun", hint: "Theme" },
      { kind: "theme", value: "dark", label: "Switch to dark theme", icon: "moon", hint: "Theme" },
      { kind: "theme", value: "system", label: "Match system theme", icon: "dashboard", hint: "Theme" },
    ];
    out.push(...actions.filter((a) => match(a.label)));
    return out;
  }, [q]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function run(item) {
    if (!item) return;
    setOpen(false);
    if (item.kind === "page") { navStart(); router.push(item.href); }
    else if (item.kind === "search") { navStart(); router.push(`/transactions?q=${encodeURIComponent(q.trim())}`); }
    else if (item.kind === "theme") applyTheme(item.value);
  }
  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }
  if (!open) return null;
  return (
    <div className="palette-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command menu" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input ref={inputRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search pages, transactions, actions…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-opt-${active}` : undefined} autoComplete="off" spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">No matches</div>}
          {items.map((it, i) => (
            <div key={`${it.kind}-${it.href || it.value || it.label}`} id={`palette-opt-${i}`} data-idx={i} role="option" aria-selected={i === active}
              className={`palette-item ${i === active ? "on" : ""}`} onMouseMove={() => setActive(i)} onClick={() => run(it)}>
              <Icon name={it.icon} size={17} />
              <span className="palette-label">{it.label}</span>
              <span className="palette-hint">{it.hint}</span>
            </div>
          ))}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>⌘</kbd><kbd>K</kbd> to toggle</span></div>
      </div>
    </div>
  );
}

export const openPalette = () => window.dispatchEvent(new Event("pf:palette"));

// ---------------------------------------------------------------------------
// Phones show wide tables as stacked cards (see .table-scroll in
// globals.css); each cell needs its column's name as a label. Copy the
// header text onto the cells once the page renders — markup stays as is.
export function TableLabels() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() || "";
  useEffect(() => {
    const label = () => {
      document.querySelectorAll("main .table-scroll table").forEach((table) => {
        const head = table.tHead?.rows?.[0];
        if (!head) return;
        const names = [];
        for (const th of head.cells) for (let k = 0; k < (th.colSpan || 1); k++) names.push(th.textContent.trim());
        for (const body of table.tBodies) for (const row of body.rows) {
          let col = 0;
          for (const cell of row.cells) {
            if (!cell.hasAttribute("data-label") && names[col]) cell.setAttribute("data-label", names[col]);
            col += cell.colSpan || 1;
          }
        }
      });
    };
    label();
    const main = document.querySelector("main");
    if (!main) return undefined;
    let raf = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(label); });
    mo.observe(main, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, [pathname, search]);
  return null;
}

// ---------------------------------------------------------------------------
// Every titled card (a .card opening with a CardHead, an h2/h3, an account
// group head or a budget table head) collapses
// to its heading: click or Enter/Space on the title. Done with attributes
// only — no nodes are inserted into React-rendered markup — and remembered
// per page in this browser.
const SKIP_CARDS = ".stat, .txn-toolbar, .transaction-list-card";
export function CardCollapse() {
  const pathname = usePathname();
  useEffect(() => {
    const key = `pf-collapsed:${pathname}`;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* storage blocked: start expanded */ }
    const save = () => {
      try { localStorage.setItem(key, JSON.stringify([...document.querySelectorAll("main .card[data-collapsed]")].map((c) => c.getAttribute("data-card-id")))); } catch { /* not remembered */ }
    };
    const enhance = () => {
      document.querySelectorAll("main .card:not([data-card-id])").forEach((card) => {
        if (card.matches(SKIP_CARDS) || card.closest(".imsg, .drawer")) return;
        const first = card.firstElementChild;
        let head = null;
        let title = null;
        if (first?.classList.contains("card-head")) { head = first; title = first.querySelector("h2, h3"); }
        else if (first && /^H[23]$/.test(first.tagName)) { head = first; title = first; }
        else if (first?.classList.contains("acct-section-head")) { head = first; title = first; }
        else if (first?.classList.contains("budget-table")) { head = first; title = first.querySelector(".budget-table-head > span:first-child"); }
        const id = title?.textContent.trim().slice(0, 80);
        if (!id || (card.children.length < 2 && head !== first?.closest(".budget-table"))) return;
        card.setAttribute("data-card-id", id);
        head.setAttribute("data-card-head", "");
        title.setAttribute("data-card-title", "");
        title.setAttribute("role", "button");
        title.setAttribute("tabindex", "0");
        const collapsed = saved.includes(id);
        if (collapsed) card.setAttribute("data-collapsed", "");
        title.setAttribute("aria-expanded", String(!collapsed));
      });
    };
    const toggle = (title) => {
      const card = title.closest(".card");
      if (!card) return;
      const collapse = !card.hasAttribute("data-collapsed");
      if (collapse) card.setAttribute("data-collapsed", ""); else card.removeAttribute("data-collapsed");
      title.setAttribute("aria-expanded", String(!collapse));
      save();
    };
    const onClick = (e) => {
      const title = e.target.closest?.("[data-card-title]");
      if (title && !e.target.closest("a, button, input, select, label")) toggle(title);
    };
    const onKey = (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[data-card-title]")) { e.preventDefault(); toggle(e.target); }
    };
    enhance();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    const main = document.querySelector("main");
    let raf = 0;
    const mo = main ? new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(enhance); }) : null;
    mo?.observe(main, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      mo?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [pathname]);
  return null;
}
