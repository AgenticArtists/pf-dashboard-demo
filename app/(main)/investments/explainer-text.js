"use client";
import { useMemo, useRef, useState } from "react";
import { segmentText, CURATED_TERMS } from "../../../lib/glossary";

// Click-to-define explainer prose for the Risk and Backtest cards
// The same blue italic terms and definition
// dialog as the Research basis annex (regime-bullets.js), but the
// copy is the page's own dynamically built explainer text and the
// terms are the curated risk set from lib/glossary.js. Definitions
// come from /api/glossary with no context — the endpoint allowlists
// the curated terms alongside the brief's, and caches per term.
const definitionCache = new Map();

export default function ExplainerText({ text, terms = CURATED_TERMS }) {
  const [defState, setDefState] = useState(null); // {term, status, text}
  const dialogRef = useRef(null);
  const segments = useMemo(() => segmentText(text, terms), [text, terms]);

  async function openDefinition(term) {
    const dialog = dialogRef.current;
    const cached = definitionCache.get(term.toLowerCase());
    setDefState({ term, status: cached ? "ready" : "loading", text: cached || "" });
    if (dialog && !dialog.open) dialog.showModal();
    if (cached) return;
    try {
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
      });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.ok && typeof payload.definition === "string") {
        definitionCache.set(term.toLowerCase(), payload.definition);
        setDefState({ term, status: "ready", text: payload.definition });
      } else {
        setDefState({ term, status: "error", text: "" });
      }
    } catch {
      setDefState({ term, status: "error", text: "" });
    }
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <button
            key={i}
            type="button"
            className="gloss-term"
            aria-haspopup="dialog"
            onClick={() => openDefinition(seg.term)}
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
      <dialog
        ref={dialogRef}
        className="gloss-dialog"
        aria-label={defState ? `Definition: ${defState.term}` : "Definition"}
        onClick={(e) => { if (e.target === dialogRef.current) closeDialog(); }}
        onClose={() => setDefState(null)}
      >
        {defState && (
          <>
            <div className="gloss-head">
              <strong>{defState.term}</strong>
              <button type="button" className="mini-btn" onClick={closeDialog}>Close</button>
            </div>
            {defState.status === "loading" && <p className="note">Defining…</p>}
            {defState.status === "error" && <p className="note">Couldn’t fetch a definition just now — try again in a moment.</p>}
            {defState.status === "ready" && <p className="gloss-body">{defState.text}</p>}
          </>
        )}
      </dialog>
    </>
  );
}
