import { data } from "./data";

const PERIOD_NOUN = { monthly: "month", quarterly: "quarter", semiannual: "half-year", annual: "year" };

// View model for the Cards page credit-capture section. Every figure comes
// from data/credit_tracker.json (built nightly by the pipeline's
// build_credit_tracker.py from the ledger's statement-credit legs); nothing
// is computed or hardcoded here.
export function buildCreditCapture() {
  let t = {};
  try { t = data("credit_tracker.json") || {}; } catch { t = {}; }
  const credits = (t.credits || []).map((c) => ({
    ...c,
    pct: c.trackable && c.available_ytd > 0
      ? Math.round((c.captured_ytd / c.available_ytd) * 1000) / 10
      : null,
    periodNoun: PERIOD_NOUN[c.period_type] || c.period_type,
    missedPeriods: (c.periods || []).filter((p) => p.state === "ended" && p.remaining > 0),
    expiring: (t.expiring_soon || []).find((e) => e.credit_id === c.id) || null,
  }));
  return {
    asOf: t.as_of || "",
    year: t.year || "",
    credits,
    totals: t.totals || { captured_ytd: 0, available_ytd: 0, missed: 0 },
    expiringSoon: t.expiring_soon || [],
  };
}
