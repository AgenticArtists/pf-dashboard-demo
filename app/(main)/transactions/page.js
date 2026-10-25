import { data } from "../../../lib/data";
import { getOverrides, applyRecordsToTxns, tokenConfigured } from "../../../lib/overrides";
import Explorer from "./explorer";
import { PageHeader, YearToggle } from "../../../lib/ui";

export const dynamic = "force-dynamic";

export default async function Transactions({ searchParams }) {
  const sp = await searchParams;
  // A drill-down month implies its ledger year when no year is given.
  const year = sp?.y === "2025" || (!sp?.y && typeof sp?.mo === "string" && sp.mo.startsWith("2025-")) ? "2025" : "2026";
  const q = typeof sp?.q === "string" ? sp.q.slice(0, 100) : "";
  const open = typeof sp?.open === "string" ? sp.open : "";
  // Drill-down links from other pages (e.g. Income: ?g=Income&mo=2026-05 or
  // ?g=Income&ic=Salary) open the explorer with those filters applied.
  const one = (k) => (typeof sp?.[k] === "string" && sp[k].length <= 160 ? sp[k] : "");
  const initialFilters = { p: one("p"), g: one("g"), c: one("c"), sc: one("sc"), ic: one("ic"), src: one("src"), sp: one("sp"), m: one("m"), ch: one("ch") === "1", bl: one("bl"), bll: one("bll"), bi: one("bi"), pr: Number(one("pr")) > 0 ? Number(one("pr")) : 0, mo: /^\d{4}-\d{2}$/.test(one("mo")) ? one("mo") : "" };
  const filterKey = Object.values(initialFilters).join("|");
  const records = await getOverrides().catch(() => []);
  const txns = applyRecordsToTxns(data(`transactions_${year}.json`), records);
  const allCategories = [...new Set([
    ...data("transactions_2026.json").map((t) => t.c),
    ...data("transactions_2025.json").map((t) => t.c),
  ])].sort();
  const accountList = data("accounts.json").map((a) => ({ mask: a.mask, name: a.name }));

  return (
    <>
      <PageHeader title="Transactions" subtitle={`${txns.length.toLocaleString()} transactions in ${year} across every linked account. Select one to see details or recategorize it.`} actions={<YearToggle base="/transactions" year={year} />} />
      <Explorer
        key={`${year}|${q}|${open}|${filterKey}`}
        initialQuery={q}
        initialOpen={open}
        initialFilters={initialFilters}
        budgets={initialFilters.bl || initialFilters.bll || initialFilters.bi ? data("budgets.json") : null}
        initialTxns={txns}
        allCategories={allCategories}
        accountList={accountList}
        year={year}
        readOnly={year === "2025"}
        configured={tokenConfigured()}
      />
    </>
  );
}
