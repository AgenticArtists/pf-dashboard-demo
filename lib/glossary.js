// Glossary highlighting for the research basis annex. Terms come from regime_brief.json glossary_terms,
// extracted by the pf pipeline (build_regime_brief.py): kind "term"
// matches case-insensitively; kind "business" matches only with its
// exact capitalization, so ordinary words never light up as companies.
// The trailing source citation of a bullet is never matched — it is
// provenance, not prose.

// Curated terms for the Risk and Backtest cards:
// the brief's extracted terms only cover words the brief itself uses,
// but the risk surface has its own fixed vocabulary. These textbook
// terms are always definable — /api/glossary allowlists them alongside
// the brief's terms, and the cards' explainer copy highlights them
// through the same segmentText + dialog path as the annex bullets.
export const CURATED_TERMS = [
  { term: "Sharpe ratio", kind: "term" },
  { term: "Sharpe", kind: "term" },
  { term: "maximum drawdown", kind: "term" },
  { term: "max drawdown", kind: "term" },
  { term: "drawdown", kind: "term" },
  { term: "annualized volatility", kind: "term" },
  { term: "volatility", kind: "term" },
  { term: "risk contribution", kind: "term" },
  { term: "annualized return", kind: "term" },
  { term: "backtest", kind: "term" },
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitCitation(text) {
  let head = String(text ?? "");
  let tail = "";
  const re = /\s*\([^()]*\)\s*$/;
  let m;
  while ((m = re.exec(head))) {
    tail = head.slice(m.index) + tail;
    head = head.slice(0, m.index);
  }
  return [head, tail];
}

// Returns [{text}] for plain runs and [{text, term}] for highlighted
// terms (term = the canonical glossary entry the definition lookup
// uses; text = the surface form as it appears in the bullet).
export function segmentText(text, terms) {
  const source = String(text ?? "");
  const list = (Array.isArray(terms) ? terms : []).filter(
    (t) => t && typeof t.term === "string" && t.term.trim().length >= 3
  );
  if (!list.length || !source) return [{ text: source }];
  const [head, tail] = splitCitation(source);
  const matches = [];
  for (const entry of list) {
    const flags = entry.kind === "business" ? "g" : "gi";
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(entry.term)}(?![A-Za-z0-9])`, flags);
    let m;
    while ((m = re.exec(head))) {
      matches.push({ start: m.index, end: m.index + m[0].length, term: entry.term, surface: m[0] });
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const segments = [];
  let pos = 0;
  for (const match of matches) {
    if (match.start < pos) continue; // overlap: earliest start wins, longest at that start
    if (match.start > pos) segments.push({ text: head.slice(pos, match.start) });
    segments.push({ text: match.surface, term: match.term });
    pos = match.end;
  }
  if (pos < head.length) segments.push({ text: head.slice(pos) });
  if (tail) segments.push({ text: tail });
  return segments;
}
