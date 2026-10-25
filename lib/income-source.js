// Income source from the bank text of a deposit. Shared by the Income
// page's "By source" table and the Transactions source filter, so a
// drill-down lists exactly the deposits the table sums.
export function incomeSource(name) {
  const u = (name || "").toUpperCase();
  if (u.includes("NORTHSTAR SYSTEMS")) return "Northstar Systems salary";
  if (u.includes("BRIGHTLINE STUDIO")) return "Brightline Studio salary";
  if (u.includes("BENEFIT")) return "Synthetic benefits payments";
  if (u.includes("REMOTE ONLINE DEPOSIT")) return "Synthetic check deposits";
  if (u.includes("REWARDS")) return "Synthetic bank rewards";
  return "Other income";
}
