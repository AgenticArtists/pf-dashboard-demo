import { isSpend } from "./format";
import { CAT_GROUP } from "./taxonomy";

// Drill-down keys for the Spending page, so a link to Transactions lists
// exactly the rows a Spending figure sums. One key per figure:
//   total          the page's Total spend: every spending row in a ledger
//                  category that nets positive (a category whose refunds
//                  outweigh its charges, e.g. a tax refund, is left out)
//   all            every spending row (person report figures)
//   cat:<name>     a By-category row (ledger category, see ledgerCat)
//   auto           the Automotive Expenses row (budget category)
//   loans:<group>  a Loans row, split by its group
//   group:<group>  a By-category group header / donut slice
//   c:<name>       budget category as stored (person report, budget pace)
//   lc:<name>      ledger category (the pipeline's grouping: Briefing movers)
//   v:<name>       vendor as the person report names it
// The Spending page keys its category table on the LEDGER category: loans
// and parking the display layer files under Automotive Expenses belong to
// Loans / Travel there (mirrors the pipeline summary).
export const ledgerCat = (t) => (t.sc === "Loans" && t.g === "Automotive Expenses" ? "Loans" : t.sc === "Parking" && t.g === "Automotive Expenses" ? "Travel" : t.c);
export const vendorName = (t) => t.dn || t.v || t.n;

// The By-category rows a transaction counts toward (parking counts in both
// Travel and Automotive Expenses, as on the page).
function rowKeys(t) {
  const keys = [];
  const lc = ledgerCat(t);
  if (lc !== "Loans" && lc !== "Automotive Expenses") keys.push(`cat:${lc}`);
  if (t.c === "Automotive Expenses") keys.push("auto");
  if (t.c === "Loans") keys.push(`loans:${t.g || "Home Expenses"}`);
  return keys;
}
export function keyGroup(key) {
  if (key === "auto") return "Automotive Expenses";
  if (key.startsWith("loans:")) return key.slice(6);
  const name = key.slice(4);
  return CAT_GROUP[name] || name;
}

// Ledger categories that net positive, for the "total" key.
export function positiveCats(txns) {
  const net = new Map();
  for (const t of txns) if (isSpend(t)) net.set(ledgerCat(t), (net.get(ledgerCat(t)) || 0) + t.a);
  return new Set([...net].filter(([, v]) => Math.round(v * 100) > 0).map(([k]) => k));
}

export function matchSpend(t, key, positive) {
  if (!isSpend(t)) return false;
  if (key === "all") return true;
  if (key === "total") return !!positive && positive.has(ledgerCat(t));
  if (key.startsWith("c:")) return t.c === key.slice(2);
  if (key.startsWith("lc:")) return ledgerCat(t) === key.slice(3);
  if (key.startsWith("v:")) return vendorName(t) === key.slice(2);
  if (key.startsWith("group:")) return rowKeys(t).some((k) => keyGroup(k) === key.slice(6));
  return rowKeys(t).includes(key);
}

export function spendLabel(key) {
  if (key === "all") return "all spending";
  if (key === "total") return "total spend";
  if (key === "auto") return "Automotive Expenses";
  if (key.startsWith("loans:")) return `Loans (${key.slice(6)})`;
  return key.slice(key.indexOf(":") + 1);
}

// /transactions link for a Spending figure.
export function spendHref(year, key, extra = {}) {
  return `/transactions?${new URLSearchParams({ ...(year === "2025" ? { y: year } : {}), ...extra, sp: key })}`;
}
