import Link from "next/link";
import { Icon } from "./icons";
import { PERSON_COLORS, money } from "./format";

const ACRONYMS = { box1: "Box 1", line1a: "line 1a", agi: "AGI", nec: "NEC", w2: "W-2", ga: "GA", ca: "CA", ytd: "YTD", hsa: "HSA", qbi: "QBI", apr: "APR", ms: "MS", fsa: "FSA", dcfsa: "DCFSA", vin: "VIN", id: "ID", fed: "Federal" };
const MON = { jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec" };

// snake_case data key -> readable label: "remaining_principal_2026_09_17"
// -> "Remaining principal (as of 2026-09-17)", "rate_pct" -> "Rate".
// Keys that are already prose (contain a space) pass through unchanged.
export function label(k) {
  let key = String(k);
  if (/\s/.test(key)) return key;
  let suffix = "";
  key = key.replace(/_(\d{4})_(\d{2})_(\d{2})_to_(\d{4})_(\d{2})_(\d{2})/, (_, a, b2, c, d, e, f) => { suffix = ` (${a}-${b2}-${c} to ${d}-${e}-${f})`; return ""; });
  key = key.replace(/_(\d{4})_(\d{2})_(\d{2})/, (_, a, b2, c) => { suffix = ` (as of ${a}-${b2}-${c})`; return ""; });
  key = key.replace(/_(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)_(\d{1,2})_(\d{4})/i, (_, m, d, y) => { suffix = ` (as of ${MON[m.toLowerCase()]} ${d}, ${y})`; return ""; });
  key = key.replace(/(^|_)pct(?=_|$)/g, "");
  const words = key.split("_").filter(Boolean).map((w) => ACRONYMS[w.toLowerCase()] || w.toLowerCase());
  const text = words.join(" ");
  return (text.charAt(0).toUpperCase() + text.slice(1)) + suffix;
}

// Formats a scalar by what its key says it is: rates get %, counts and
// durations stay plain, every other number is money.
export function fmtValue(key, v) {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
  const k = String(key).toLowerCase();
  if (/pct|percent|(^|[\s_])rate$/.test(k)) return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  if (/months|payments_made|count|days|units|years?$|mask|policy|shares|periods/.test(k)) return v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return money(v);
}

// Renders the scalar (non-object) entries of an object as a definition grid.
// Also accepts a single pair as k/v props.
export function Kv({ obj, keys, k, v, raw = false }) {
  if (k != null) obj = { [k]: v };
  if (!obj || typeof obj !== "object") return null;
  const entries = (keys || Object.keys(obj))
    .filter((key) => obj[key] != null && typeof obj[key] !== "object")
    .map((key) => [key, obj[key]]);
  if (!entries.length) return null;
  return (
    <div className="kv">
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: "contents" }}>
          <span className="k">{k != null || raw ? key : label(key)}</span>
          <span>{fmtValue(key, val)}</span>
        </div>
      ))}
    </div>
  );
}

// Page title row: title + optional subtitle on the left, actions on the right.
export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
      {children}
    </header>
  );
}

// Link-based segmented control (server friendly): options = [[href, label, active]].
export function Segmented({ options, label: aria, className = "" }) {
  return (
    <nav className={`segmented ${className}`} aria-label={aria || "View"}>
      {options.map(([href, text, active]) => (
        <Link key={href} href={href} scroll={false} className={active ? "on" : ""} aria-current={active ? "page" : undefined}>{text}</Link>
      ))}
    </nav>
  );
}

export function YearToggle({ base, year, years = ["2026", "2025"] }) {
  return <Segmented label="Year" options={years.map((y) => [`${base}?y=${y}`, y, y === year])} />;
}

// Card title row with an optional right-aligned link or control.
export function CardHead({ title, href, linkText = "View all", right, sub }) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {right}
      {href && <Link className="card-link" href={href}>{linkText}<Icon name="chevronRight" size={15} /></Link>}
    </div>
  );
}

// Signed change chip. good = which direction is favourable ("up" | "down").
export function Delta({ value, text, good = "up", neutral = false }) {
  if (value == null || Number.isNaN(value)) return null;
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const tone = neutral || dir === "flat" ? "neutral" : dir === good ? "good" : "bad";
  return (
    <span className={`delta ${tone}`}>
      {dir !== "flat" && <Icon name={dir === "up" ? "arrowUp" : "arrowDown"} size={12} />}
      {text}
    </span>
  );
}

// KPI tile. dot = optional colour swatch before the label.
export function Stat({ label: l, value, sub, delta, dot, tone, children }) {
  return (
    <div className="card stat">
      <div className="label">{dot && <span className="swatch" style={{ background: dot }} />}{l}</div>
      <div className={`value ${tone || ""}`}>{value}</div>
      {(sub || delta) && <div className="sub">{delta}{sub}</div>}
      {children}
    </div>
  );
}

export function Progress({ value, max = 1, tone = "accent", marker }) {
  const pct = max ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className={`progress ${tone}`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      {marker != null && <div className="progress-marker" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />}
    </div>
  );
}

export function PersonTag({ person }) {
  return <span className="person-tag"><span className="person-dot" style={{ background: PERSON_COLORS[person] || "#9aa3ad" }} />{person || "—"}</span>;
}

export function Empty({ icon = "info", title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={20} /></span>
      <div><strong>{title}</strong>{children && <div className="note">{children}</div>}</div>
    </div>
  );
}

// Merchant initial avatar with a stable pastel per name.
const AVATAR_TONES = 8;
export function avatarTone(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % AVATAR_TONES;
}
export function Avatar({ name, size }) {
  const n = String(name || "?");
  return <span className={`avatar tone-${avatarTone(n)}`} style={size ? { width: size, height: size } : undefined}>{n.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?"}</span>;
}

// A name that opens the Transactions behind a figure: label plus a chevron.
export function DrillLink({ href, children, title }) {
  return <Link className="row-link-name" href={href} title={title}>{children}<Icon name="chevronRight" size={14} /></Link>;
}
