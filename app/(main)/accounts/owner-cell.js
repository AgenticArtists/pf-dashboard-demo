"use client";

import { useState } from "react";
import { toast } from "../../../lib/client-events";
import { PERSON_COLORS } from "../../../lib/format";

const OWNERS = ["Joint", "Maya", "Daniel", "Leo"];

export default function OwnerCell({ targetKey, initialOwner, configured }) {
  const [owner, setOwner] = useState(initialOwner || "");
  const [state, setState] = useState("");
  async function change(v) {
    const prev = owner;
    setOwner(v);
    setState("saving…");
    try {
      const res = await fetch("/api/overrides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "account", target_key: targetKey, field: "owner", value: v }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.reason || `http ${res.status}`);
      setState("");
      toast(`Owner set to ${v}.`);
    } catch (e) {
      setOwner(prev);
      setState("");
      toast(`Could not save the owner (${e.message}). Nothing changed.`, "err");
    }
  }
  const dot = <span className="person-dot" style={{ background: PERSON_COLORS[owner] || "#9a958d" }} />;
  if (!configured) return <span className="person-tag">{initialOwner ? dot : null}{initialOwner || "Unassigned"}</span>;
  return (
    <span className="owner-select">
      {dot}
      <select value={owner} onChange={(e) => change(e.target.value)} aria-label="Account owner">
        <option value="" disabled>Unassigned</option>
        {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {state && <span className={`fine ${state.startsWith("failed") ? "negative" : ""}`}>{state}</span>}
    </span>
  );
}
