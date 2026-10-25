"use client";
import { useMemo, useRef, useState } from "react";
import { moneyText } from "../../../lib/format";
import { segmentText } from "../../../lib/glossary";

// Per-section rendering for the Research basis annex. A reading-level
// slider (Daniel, 2026-10-18) replaces the old "Explain simply"
// toggle: Maya drags to the depth she wants — "Why it matters"
// (one sentence), "Like I'm 5", "Plain English", or the original
// text. Generated levels come from /api/explain, which only rewrites
// bullets the pipeline published and checks every figure against the
// source; Plain English uses the pipeline's own simple versions when
// they exist. In every version glossary terms are highlighted (light
// blue, italic); clicking one fetches a beginner definition from
// /api/glossary into a dialog. Definitions and rewrites are cached
// per page life.
const definitionCache = new Map();
const rewriteCache = new Map();
const LEVEL_LABELS = { 1: "Why it matters", 2: "Like I'm 12", 3: "Plain English", 4: "Original" };

function GlossaryLine({ text, terms, onDefine }) {
  const segments = useMemo(() => segmentText(moneyText(text), terms), [text, terms]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.term ? (
          <button
            key={i}
            type="button"
            className="gloss-term"
            aria-haspopup="dialog"
            onClick={() => onDefine(seg.term, text)}
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

export default function RegimeBullets({ points, simplePoints, terms, meta }) {
  const [level, setLevel] = useState(4);
  const [generated, setGenerated] = useState({});
  const [rewriting, setRewriting] = useState(false);
  const [defState, setDefState] = useState(null); // {term, status, text}
  const dialogRef = useRef(null);
  const hasSimple = Array.isArray(simplePoints) && simplePoints.length > 0 && simplePoints.length === points.length;

  async function chooseLevel(next) {
    setLevel(next);
    if (next === 4) return;
    const needed = points.filter((bullet, i) => {
      if (next === 3 && hasSimple) return false;
      return !rewriteCache.has(`${next}|${bullet}`) && generated[`${next}|${bullet}`] === undefined;
    });
    if (!needed.length) return;
    setRewriting(true);
    await Promise.all(needed.map(async (bullet) => {
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bullet, level: next }),
        });
        const payload = await res.json().catch(() => null);
        if (res.ok && payload?.ok && typeof payload.text === "string") {
          rewriteCache.set(`${next}|${bullet}`, payload.text);
          setGenerated((prev) => ({ ...prev, [`${next}|${bullet}`]: payload.text }));
        } else {
          setGenerated((prev) => ({ ...prev, [`${next}|${bullet}`]: null }));
        }
      } catch {
        setGenerated((prev) => ({ ...prev, [`${next}|${bullet}`]: null }));
      }
    }));
    setRewriting(false);
  }

  const shown = points.map((bullet, i) => {
    if (level === 4) return bullet;
    if (level === 3 && hasSimple) return simplePoints[i];
    const gen = generated[`${level}|${bullet}`] ?? rewriteCache.get(`${level}|${bullet}`);
    return typeof gen === "string" ? gen : bullet;
  });

  async function openDefinition(term, context) {
    const dialog = dialogRef.current;
    const cached = definitionCache.get(term.toLowerCase());
    setDefState({ term, status: cached ? "ready" : "loading", text: cached || "" });
    if (dialog && !dialog.open) dialog.showModal();
    if (cached) return;
    try {
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, context }),
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
      <div className="explain-box">
        <div className="explain-head">
          <span className="note">Reading level</span>
          <strong>{LEVEL_LABELS[level]}{rewriting ? " · rewriting…" : ""}</strong>
        </div>
        <input
          type="range"
          min="1"
          max="4"
          step="1"
          value={level}
          aria-label="Reading level"
          onChange={(e) => chooseLevel(Number(e.target.value))}
        />
        <div className="explain-ticks" aria-hidden="true">
          <span>Why it matters</span><span>Like I&apos;m 12</span><span>Plain English</span><span>Original</span>
        </div>
      </div>
      <ul className="insights">
        {shown.map((bullet, i) => {
          const m = Array.isArray(meta) ? meta[i] : null;
          return (
            <li key={i} className={m?.contested ? "contested" : undefined}>
              <GlossaryLine text={bullet} terms={terms} onDefine={openDefinition} />
              {m && (m.contested || m.basis === "forecast" || m.basis === "opinion") && (
                <span className="bullet-flags">
                  {m.contested && <span className="badge warn">Contested — sources disagree</span>}
                  {m.basis === "forecast" && <span className="badge info">Forecast-based</span>}
                  {m.basis === "opinion" && <span className="badge">Opinion-based</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
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
