"use client";

import { useState } from "react";
import { toast } from "../../../lib/client-events";

export default function BenefitToggle({ id, initialPlanned, configured }) {
  const [planned, setPlanned] = useState(Boolean(initialPlanned));
  const [state, setState] = useState("");
  async function flip() {
    const next = !planned;
    const prev = planned;
    setPlanned(next);
    setState("saving…");
    try {
      const res = await fetch("/api/overrides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "benefit", target_key: id, field: "planned", value: next }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.reason || `http ${res.status}`);
      setState("");
      toast(next ? "Marked as planned." : "Marked as not planned.");
    } catch (e) {
      setPlanned(prev);
      setState("");
      toast(`Could not save (${e.message}). Nothing changed.`, "err");
    }
  }
  return (
    <span>
      <button type="button" className={`badge ${planned ? "planned" : ""}`} disabled={!configured} onClick={flip} style={{ cursor: configured ? "pointer" : "default" }} aria-pressed={planned}>
        {planned ? "✓ Planned" : "Not planned"}
      </button>{" "}
      {state && <span className={`fine ${state.startsWith("failed") ? "negative" : ""}`}>{state}</span>}
    </span>
  );
}
