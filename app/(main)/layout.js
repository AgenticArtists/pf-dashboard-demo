import { data } from "../../lib/data";
import AppShell from "./nav";
import { PERSON_COLORS } from "../../lib/format";

export default async function MainLayout({ children }) {
  let gen = "";
  try { gen = data("meta.json").generated_at; } catch { gen = ""; }
  // A firing staleness watchdog can turn the sync pill amber.
  // turns the sync pill amber. With several staleness findings (per-account
  // ledger lag), one account's title would mislead — use a generic label.
  let stale = "";
  try {
    const staleness = (data("watchdog.json").findings || []).filter((f) => f.type === "staleness");
    stale = staleness.length > 1 ? "Ledger data is stale for some accounts" : (staleness[0]?.title || "");
  } catch { stale = ""; }
  return (
    <>
      <AppShell user="Demo" userColor={PERSON_COLORS.Daniel} generated={gen} stale={stale}>
        {children}
      </AppShell>
    </>
  );
}
