// Pure formatting/spend helpers — safe to import from client components.
export const money = (n) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const num = (v) => (typeof v === "string" ? parseFloat(v) : v) || 0;
// Whole dollars, for widget rows and chart tooltips where cents are noise.
export const money0 = (n) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  return (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
};
// Axis labels: $950, $12K, $1.2M.
export const moneyShort = (n) => {
  const v = Math.abs(num(n));
  const sign = num(n) < 0 ? "-" : "";
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
  return `${sign}$${Math.round(v)}`;
};
// Display-only cash-flow formatting for signed ledger amounts. The ledger
// stores inflows (income, deposits) as NEGATIVE and outflows as positive;
// readers expect the opposite presentation: money in shows as "+$X" (and is
// styled green via .neg), money out as plain "$X". Never use this for sums
// or magnitudes — it only flips how a stored signed value is PRINTED, so
// every total still ties out from the raw values.
export const moneyFlow = (n) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  return (v < 0 ? "+$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Mirrors the pipeline's categorize.EXCLUDED set (pf-unify categorize.py:
// Transfers, Card Payments, Income, Card Rewards). "Card Rewards" parks
// generic cash-back credits — neither income nor spend; leaving it out here
// made every display-layer total count those rows as negative spend while
// the live aggregates (lib/live-aggregates.js) already excluded them.
export const EXCLUDED_SPEND = new Set(["Income", "Transfers", "Card Payments", "Card Rewards"]);
// Spend is NET since 2026-10-14: negative rows inside a spend category
// (refunds, reimbursement offsets) reduce the category total. Income rows
// are excluded by GROUP: their category is the derived Employment/Irregular
// level since the 2026-10-14 income restructure, never literally "Income".
export const isSpend = (t) => !EXCLUDED_SPEND.has(t.c) && t.g !== "Income";
// Canonical person colors across every visualization (Daniel's call, 2026-10-13):
// Daniel = blue, Maya = pink, Joint = red.
export const PERSON_COLORS = { Daniel: "#1565c0", Maya: "#f15bb5", Joint: "#b71c1c" };
export const PERSON_ORDER = ["Daniel", "Maya", "Joint"];

// Pipeline-written prose sometimes prints amounts without a currency sign
// ("hold 28,063.63 in ..."). Display-only: a comma-grouped amount with cents
// that has no "$" in front gets one. Plain counts, years and percents are
// left alone.
export const moneyText = (s) => String(s ?? "").replace(/(^|[^$\d.,])(\d{1,3}(?:,\d{3})+\.\d{2})(?![\d%])/g, "$1$$$2");

// "2026-10-15" -> "Oct 15" (year added when it isn't the current one).
// Anything that isn't an ISO date passes through unchanged.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return iso ?? "";
  const label = `${MONTHS_SHORT[Number(m[2]) - 1]} ${Number(m[3])}`;
  return Number(m[1]) === new Date().getFullYear() ? label : `${label}, ${m[1]}`;
};
