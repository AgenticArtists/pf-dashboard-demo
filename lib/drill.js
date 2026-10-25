// Links into the Transactions explorer with filters applied. The year comes
// from the month when one is given (a 2025 month lives in the 2025 ledger).
export function txnHref(params = {}) {
  const { y, ...rest } = params;
  const year = y || (rest.mo ? rest.mo.slice(0, 4) : "2026");
  const q = Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null && v !== "" && v !== false).map(([k, v]) => [k, v === true ? "1" : String(v)]));
  return `/transactions?${new URLSearchParams({ ...(year === "2025" ? { y: "2025" } : {}), ...q })}`;
}
// Opens one transaction's drawer (same key the watchdog deep links use).
export const txnOpenHref = (t) => txnHref({ y: t.d.slice(0, 4), open: `${t.d}|${t.m}|${t.a}|${t.n}` });
