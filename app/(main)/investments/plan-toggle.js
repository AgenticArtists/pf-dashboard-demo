"use client";

import { useEffect, useRef, useState } from "react";

// "Collapse all" / "Expand all" for the rebalance plan's lines. The lines are
// native <details>, so this only flips their open state; the label follows
// whatever the reader last did by hand.
export default function PlanToggle() {
  const ref = useRef(null);
  const [anyOpen, setAnyOpen] = useState(true);
  const items = () => [...(ref.current?.closest(".card")?.querySelectorAll("details.plan-item") || [])];
  useEffect(() => {
    const card = ref.current?.closest(".card");
    if (!card) return undefined;
    const sync = () => setAnyOpen(items().some((d) => d.open));
    sync();
    card.addEventListener("toggle", sync, true);
    return () => card.removeEventListener("toggle", sync, true);
  }, []);
  return (
    <button ref={ref} type="button" className="mini-btn" onClick={() => { const next = !anyOpen; items().forEach((d) => { d.open = next; }); setAnyOpen(next); }}>
      {anyOpen ? "Collapse all" : "Expand all"}
    </button>
  );
}
