// Reading levels for the Research basis annex (Daniel, 2026-10-18):
// Maya drags a slider; each stop rewrites a published bullet at a
// different depth. Levels 1-3 are generated live by /api/explain under
// a strict figures guardrail — a rewrite may only use numbers that
// appear in the source bullet (with the bp -> percentage-points
// restatement allowed, the same licence the weekly brief uses).
// Level 4 is the original published text and needs no generation.
export const LEVELS = {
  1: {
    label: "Why it matters",
    instruction:
      "Level: WHY IT MATTERS. Reply with exactly ONE sentence saying why this matters to an ordinary household deciding what to do with its money. Everyday words only. Use a number only if that number is the whole point, and copy it exactly.",
  },
  2: {
    label: "Like I'm 12",
    instruction:
      "Level: LIKE I'M 12. Explain this so a smart 12-year-old could follow it easily: plain everyday words, short clear sentences, and no finance jargon — if a technical word is unavoidable, explain it in plain words right there. Talk to the reader as a capable person who just hasn't met this topic yet: no baby talk, no children's comparisons (no piggy banks, toys, or snacks), nothing patronizing. 2 or 3 short sentences. Leave numbers out unless one number truly matters; if you use one, copy it exactly.",
  },
  3: {
    label: "Plain English",
    instruction:
      "Level: PLAIN ENGLISH. Rewrite this for a smart adult who doesn't follow finance: short sentences, every technical word explained in plain words right where it appears, and every figure kept EXACTLY as written. 2 to 4 sentences.",
  },
  4: { label: "Original", instruction: null },
};

export const EXPLAIN_SYSTEM =
  "You rewrite ONE bullet from a household's money research note at a requested reading level. Use ONLY the facts and figures in the bullet. Never add a fact, a figure, a recommendation, or a new example with numbers in it. Reply with only the rewritten text.";

const FIGURE_RE = /\$?\d[\d,]*(?:\.\d+)?\s*(%|bp|bps|basis points?|percentage points?|x\b|k\b|m\b|bn\b|billion|million)?/gi;

export function extractFigures(text) {
  const out = [];
  for (const match of String(text || "").matchAll(FIGURE_RE)) {
    const raw = match[0];
    const value = parseFloat(raw.replace(/[$,]/g, ""));
    if (!Number.isFinite(value)) continue;
    const unit = (match[1] || "").toLowerCase();
    out.push({ value, isBp: unit.startsWith("bp") || unit.startsWith("basis") });
  }
  return out;
}

// A generated figure is faithful when its value appears among the
// source bullet's figures — counting a source "550bp" as also
// licensing "5.5" (percent / percentage points), never the reverse.
export function figuresFaithful(sourceText, generatedText) {
  const allowed = new Set();
  for (const fig of extractFigures(sourceText)) {
    allowed.add(Math.round(fig.value * 1e6) / 1e6);
    if (fig.isBp) allowed.add(Math.round((fig.value / 100) * 1e6) / 1e6);
  }
  for (const fig of extractFigures(generatedText)) {
    const v = Math.round(fig.value * 1e6) / 1e6;
    if (!allowed.has(v)) return false;
  }
  return true;
}
