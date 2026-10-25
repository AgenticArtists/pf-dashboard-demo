import { isSpend } from "./format.js";

// Recurring-charge detection for the Recurring page, shared with
// scripts/recurring-net-checks.mjs. Moved out of the page component
// 2026-10-19 so the netting behaviour is testable.

export const r2 = (x) => Math.round(x * 100) / 100;
const DAY = 86400000;
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const CUT_LIST = ["YOUTUBE", "NUULY", "TRADINGVIEW", "TOPAZ", "GOOGLE ONE"];
export const isCutList = (vendor, name) => { const u = `${vendor} ${name}`.toUpperCase(); return CUT_LIST.some((p) => u.includes(p)); };

function cadenceLabel(days) {
  if (days <= 9) return "Weekly";
  if (days <= 18) return "Every 2 weeks";
  if (days <= 45) return "Monthly";
  if (days <= 120) return "Quarterly";
  if (days <= 250) return "Twice a year";
  return "Annual";
}

// Detect recurring vendors from the ledger itself (2025+2026 rows for cadence
// history; money reported for 2026). A vendor qualifies with >= 3 positive
// charges at a fairly regular interval, or >= 2 charges if the site already
// classifies it under Subscriptions. Fixed obligations that live on the
// Budgets page (loans, rent, childcare, insurance, taxes) are excluded.
//
// Run rates are NET of paired statement credits,
// 2026-10-19): rows the pipeline marked with a program group ("pr", set by
// gen_site_data.py from the refund engine's program pairing — Walmart+,
// Uber One, the digital entertainment credit, ...) group under that label,
// and the typical paired credit is netted from the typical charge at the
// same cadence. The net can go negative when a program credit exceeds the
// charge (it is shown honestly, never floored at zero). Unpaired credits
// and merchant returns are NOT netted; they still appear in `credits`.
export function detectRecurring(txns, dataMax) {
  const byVendor = new Map();
  for (const t of txns) {
    if (!isSpend(t)) continue;
    if (["Loans", "Rent", "Childcare"].includes(t.sc) || ["Insurance", "Taxes"].includes(t.g)) continue;
    const key = t.pr || t.dn || t.v || t.n;
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key).push(t);
  }
  const out = [];
  for (const [vendor, rows] of byVendor) {
    const charges = rows.filter((t) => t.a > 0).sort((a, b) => a.d.localeCompare(b.d));
    const isSubCat = charges.length > 0 && charges[charges.length - 1].c === "Subscriptions";
    const cut = charges.length > 0 && isCutList(vendor, charges[charges.length - 1].n);
    if (charges.length < (isSubCat || cut ? 3 : 4)) continue;
    const times = charges.map((t) => Date.parse(`${t.d}T00:00:00Z`));
    const intervals = times.slice(1).map((x, i) => (x - times[i]) / DAY).filter((d) => d > 0);
    if (intervals.length < 2) continue;
    const med = median(intervals);
    // A subscription or bill cycle is 20-400 days. Shorter medians are
    // shopping/gas/food frequency, not a billing cycle.
    if (med < 20 || med > 400) continue;
    const spread = intervals.filter((d) => Math.abs(d - med) <= Math.max(6, med * 0.4)).length / intervals.length;
    if (spread < 0.6 && charges.length < 5) continue;
    // Amount stability is the subscription signal: most charges land within
    // ±20% of the typical charge. Frequent merchants fail this even when
    // their visit intervals look regular. Cut-list vendors and rows the
    // ledger already classifies as Subscriptions are exempt.
    const medAmt = median(charges.map((t) => t.a));
    const stable = charges.filter((t) => Math.abs(t.a - medAmt) <= medAmt * 0.2).length / charges.length;
    if (stable < 0.6 && !isSubCat && !cut) continue;
    const amounts = charges.map((t) => t.a);
    const typical = median(amounts);
    const vary = Math.max(...amounts) / Math.min(...amounts) > 1.3;
    const last = charges[charges.length - 1];
    // Purchase categories are not billers even when amounts look stable
    // (a Chipotle habit is not a subscription). Cut-list vendors still show.
    if (!isSubCat && !cut && (["Restaurants/Dining", "Groceries", "General Merchandise", "Clothing/Shoes", "Electronics"].includes(last.c) || last.sc === "Gasoline/Fuel/Charging")) continue;
    const ppy = 365.25 / med;
    const active = Date.parse(`${last.d}T00:00:00Z`) + med * 1.6 * DAY >= Date.parse(`${dataMax}T00:00:00Z`);
    const next = new Date(Date.parse(`${last.d}T00:00:00Z`) + med * DAY).toISOString().slice(0, 10);
    // Paired statement credits in this program group (both legs carry the
    // "pr" label and group together above). Only these are netted.
    const pairedCredits = rows.filter((t) => t.a < 0 && t.pr);
    const creditTypical = pairedCredits.length ? median(pairedCredits.map((t) => Math.abs(t.a))) : 0;
    const pairedCreditsYtd = r2(pairedCredits.filter((t) => t.d.startsWith("2026")).reduce((s, t) => s + t.a, 0));
    const ytd = r2(charges.filter((t) => t.d.startsWith("2026")).reduce((s, t) => s + t.a, 0));
    const grossMonthly = r2((typical * ppy) / 12);
    const grossAnnual = r2(typical * ppy);
    out.push({
      vendor, name: last.n, category: last.c, subcategory: last.sc, person: last.p,
      count: charges.length, typical: r2(typical), cadence: cadenceLabel(med),
      monthly: creditTypical ? r2(((typical - creditTypical) * ppy) / 12) : grossMonthly,
      annual: creditTypical ? r2((typical - creditTypical) * ppy) : grossAnnual,
      grossMonthly, grossAnnual, creditTypical: r2(creditTypical),
      lastDate: last.d, next, active, vary,
      ytd, ytdNet: r2(ytd + pairedCreditsYtd),
      credits: r2(rows.filter((t) => t.a < 0).reduce((s, t) => s + t.a, 0)),
      cut: isCutList(vendor, last.n),
    });
  }
  return out.sort((a, b) => (b.active - a.active) || b.monthly - a.monthly);
}
