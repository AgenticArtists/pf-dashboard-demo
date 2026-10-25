"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../../lib/icons";
import { NAV, TABS } from "../../lib/nav-items";
import { applyTheme } from "../../lib/client-events";
import { NavProgress, SyncStatus, Toaster, CommandPalette, TableLabels, CardCollapse, openPalette } from "./shell-extras";

function ThemeToggle() {
  const [theme, setTheme] = useState("system");
  useEffect(() => {
    try { setTheme(localStorage.getItem("pf-theme") || "system"); } catch { /* storage blocked: follow system */ }
    const onTheme = (e) => setTheme(e.detail || "system");
    window.addEventListener("pf:theme", onTheme);
    return () => window.removeEventListener("pf:theme", onTheme);
  }, []);
  const choose = (next) => { setTheme(next); applyTheme(next); };
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      <button type="button" className={theme === "light" ? "on" : ""} onClick={() => choose("light")} title="Light" aria-pressed={theme === "light"}><Icon name="sun" size={14} /></button>
      <button type="button" className={theme === "system" ? "on" : ""} onClick={() => choose("system")} title="Match system" aria-pressed={theme === "system"}><Icon name="dashboard" size={13} /></button>
      <button type="button" className={theme === "dark" ? "on" : ""} onClick={() => choose("dark")} title="Dark" aria-pressed={theme === "dark"}><Icon name="moon" size={14} /></button>
    </div>
  );
}

export default function AppShell({ user, userColor, generated, stale, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showEnrollmentTab, setShowEnrollmentTab] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();
    setShowEnrollmentTab((month === 9 && day >= 1) || (month === 10 && day <= 15));
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const navIsActive = (matchRoutes) => matchRoutes.some((route) => route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`));
  const exactTabs = TABS[pathname];
  const prefixTabRoute = Object.keys(TABS).filter((route) => pathname.startsWith(`${route}/`)).sort((a, b) => b.length - a.length)[0];
  const sectionTabs = exactTabs || (prefixTabRoute ? TABS[prefixTabRoute] : null);
  const isAskPage = pathname === "/ask" || pathname.startsWith("/ask/");
  const brand = <Link className="brand" href="/"><img className="brand-mark" src="/brand/logos/logo-mark.svg" alt="AgenticArtists" /><span>Household Finance Demo</span></Link>;

  return (
    <>
      <Suspense fallback={null}><NavProgress /><TableLabels /></Suspense>
      <CardCollapse />
      <CommandPalette />
      <Toaster />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          {brand}
          <button type="button" className="icon-btn sidebar-close" style={{ display: "none" }} onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <button type="button" className="search-trigger" onClick={openPalette} aria-keyshortcuts="Meta+K Control+K">
          <Icon name="search" size={16} /><span>Search</span><kbd>⌘K</kbd>
        </button>
        <nav className="sidebar-nav">
          {NAV.map(([href, label, icon, matchRoutes]) => (
            <Link key={href} href={href} className={navIsActive(matchRoutes) ? "active" : ""} aria-current={navIsActive(matchRoutes) ? "page" : undefined}>
              <Icon name={icon} />{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="user-card">
            <span className="user-avatar" style={{ background: userColor }}>{(user || "?").slice(0, 1)}</span>
            <div className="user-meta"><strong>{user || "Signed in"}</strong><span>Household member</span></div>
          </div>
          <div className="sidebar-foot">
            {generated ? <SyncStatus generated={generated} stale={stale} /> : <span>Demo dashboard</span>}
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="app-shell">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Icon name="menu" size={20} /></button>
          {brand}
          <span className="spacer" />
          {generated && <SyncStatus generated={generated} stale={stale} compact />}
          <button type="button" className="icon-btn" onClick={openPalette} aria-label="Search"><Icon name="search" size={19} /></button>
          <span className="user-avatar" style={{ background: userColor, width: 30, height: 30, fontSize: 12 }} title={user}>{(user || "?").slice(0, 1)}</span>
        </header>
        <main>
          {sectionTabs && <nav className="section-tabs" aria-label="Section navigation" role="tablist">
            {sectionTabs.filter(([href, , meta]) => !meta?.seasonal || showEnrollmentTab).map(([href, label]) => (
              <Link key={href} href={href} className={pathname === href ? "on" : ""} aria-current={pathname === href ? "page" : undefined} role="tab">
                {label}
              </Link>
            ))}
          </nav>}
          {children}
        </main>
        <footer>Fictional household demo. Synthetic data refreshed by the local generator{generated ? ` · generated ${generated}` : ""}. <Link href="/about">Sources &amp; methods</Link></footer>
      </div>
      {!isAskPage && <Link className="ask-fab" href="/ask"><Icon name="ask" size={18} />Ask a Question</Link>}
    </>
  );
}
