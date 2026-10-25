import { isSpend } from "./format";
import { ledgerCat } from "./spend-filter";

// Budget lines are a partition (budgets.json, in file order): each spend row
// is claimed by the first line it matches, so the lines always sum to the
// month's net spend. Match fields are ANDed; "any" is a list of alternatives.
export function matches(t, m) {
  if (!m) return false;
  if (m.any) return m.any.some((sub) => matches(t, sub));
  if (m.category != null && t.c !== m.category) return false;
  if (m.categories != null && !m.categories.includes(t.c)) return false;
  if (m.group != null && t.g !== m.group) return false;
  if (m.subcategories != null && !m.subcategories.includes(t.sc)) return false;
  if (m.exclude_subcategories != null && m.exclude_subcategories.includes(t.sc)) return false;
  if (m.person != null && t.p !== m.person) return false;
  if (m.ic != null && t.ic !== m.ic) return false;
  return true;
}

// The spend line that claims a row (first match in file order), or null.
// "ledger" evaluates the lines on the ledger category, as the pipeline's
// Briefing does (parking under Travel, auto-loan rows under Loans).
export function spendLineId(t, budgets, ledger = false) {
  if (!isSpend(t)) return null;
  const row = ledger ? { ...t, c: ledgerCat(t) } : t;
  return (budgets?.spend_lines || []).find((line) => matches(row, line.match))?.id || null;
}
// Income lines are not a partition: a deposit counts toward every line it matches.
export function incomeLineMatch(t, budgets, id) {
  const line = (budgets?.income_lines || []).find((l) => l.id === id);
  return !!line && t.g === "Income" && matches(t, line.match);
}
