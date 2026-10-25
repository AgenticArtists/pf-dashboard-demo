// Stroke icons (24px grid, 1.8 stroke, currentColor) for the app shell and
// widgets. Inline SVG keeps them inside the CSP ('self' only) with no icon
// font or external sprite.
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  accounts: <><path d="M3 21h18" /><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10" /><path d="m12 3 9 5H3z" /></>,
  transactions: <><path d="M7 4 3 8l4 4" /><path d="M3 8h14" /><path d="m17 20 4-4-4-4" /><path d="M21 16H7" /></>,
  spending: <><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>,
  income: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  budgets: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  recurring: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  investments: <><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 5-7" /></>,
  cashflow: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  briefing: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></>,
  taxes: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 7h6M9 11h6M9 15h3" /></>,
  benefits: <><path d="M12 21s-8-4.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6.5-8 11-8 11z" /></>,
  enrollment: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 2h6v4H9z" /><path d="m9 14 2 2 4-4" /></>,
  ask: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>,
  records: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>,
  chevronRight: <><path d="m9 18 6-6-6-6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  arrowUp: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
  arrowDown: <><path d="M12 5v14M19 12l-7 7-7-7" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  card: <><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M4 10h16" /></>,
  cash: <><rect x="5.5" y="7.8" width="13" height="8.4" rx="1.8" /><circle cx="12" cy="12" r="1.7" /><path d="M8.3 12h.01M15.7 12h.01" /></>,
  car: <><path d="M7 16h10M7 16a1.5 1.5 0 1 1-3 0v-3l2-5.5h12L20 13v3a1.5 1.5 0 1 1-3 0" /><circle cx="8.4" cy="16" r="1.5" /><circle cx="15.6" cy="16" r="1.5" /></>,
  loan: <><path d="M12 5v14" /><path d="M16.8 8.2H10.2a2.9 2.9 0 0 0 0 5.8h3.6a2.9 2.9 0 1 1 0 5.8H7.2" /></>,
  retirement: <><path d="M12 22V12" /><path d="M12 12C12 7 8 4 3 4c0 5 4 8 9 8z" /><path d="M12 12c0-5 4-8 9-8 0 5-4 8-9 8z" /></>,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  sparkle: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></>,
};

export function Icon({ name, size = 18, className = "", title }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
