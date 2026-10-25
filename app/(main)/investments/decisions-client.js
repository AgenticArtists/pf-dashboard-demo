"use client";

import { useState } from "react";
import { toast } from "../../../lib/client-events";

// Approve/Dismiss for one recommendation or idea. A decision records
// intent only — nothing here places a trade.
export default function DecisionButtons({ itemId, initial, configured }) {
  const [state, setState] = useState(initial || null);
  const [busy, setBusy] = useState(false);

  async function decide(decision) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, decision }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.reason || `http ${res.status}`);
      setState({ decision, editor: j.entry.editor, decided_at: j.entry.decided_at });
      toast(decision === "approved" ? "Approved — recorded as intent; no trade is placed." : "Dismissed.");
    } catch (e) {
      toast(`Could not save the decision (${e.message}).`, "err");
    } finally { setBusy(false); }
  }

  if (!configured) return <span className="fine">Decisions are view-only in this demo</span>;
  return (
    <span className="decision">
      <button type="button" className={`btn sm ${state?.decision === "approved" ? "on-approve" : "ghost"}`} disabled={busy} onClick={() => decide("approved")} aria-pressed={state?.decision === "approved"}>Approve</button>
      <button type="button" className={`btn sm ${state?.decision === "dismissed" ? "on-dismiss" : "quiet"}`} disabled={busy} onClick={() => decide("dismissed")} aria-pressed={state?.decision === "dismissed"}>Dismiss</button>
      {state && <span className="fine">{state.decision} by {state.editor} · {String(state.decided_at).slice(0, 10)}</span>}
    </span>
  );
}
