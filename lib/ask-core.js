// The public demo does not run an assistant. These exports remain as inert
// compatibility helpers for code that may import the former Ask module.
export const SYSTEM_PROMPT = "Ask is disabled in this public synthetic-data demo.";
export const TRIAGE_PROMPT = SYSTEM_PROMPT;
export const ADVISOR_SYSTEM_PROMPT = SYSTEM_PROMPT;

const stringify = (value) => value == null ? "" : JSON.stringify(value, null, 2);

export function buildAskContext(dataFn = () => null) {
  const names = ["meta.json", "accounts.json", "budgets.json", "income_2026.json", "portfolio.json"];
  return names.map((name) => {
    try { return `${name}\n${stringify(dataFn(name))}`; } catch { return ""; }
  }).filter(Boolean).join("\n\n");
}

export function buildAdvisorContext(dataFn = () => null) {
  return buildAskContext(dataFn);
}

export function buildThreadHistory(instructions, questions) {
  return [...(Array.isArray(instructions) ? instructions : []), ...(Array.isArray(questions) ? questions : [])]
    .filter((entry) => typeof entry?.text === "string")
    .slice(-8)
    .map((entry) => ({ role: "user", content: entry.text.slice(0, 2000) }));
}

export function resolveKind(parsedKind, forceKind) {
  if (forceKind === "question") return "question";
  if (forceKind === "instruction") return "update";
  return ["question", "update", "ambiguous"].includes(parsedKind) ? parsedKind : "ambiguous";
}

export function parseAskReply(text) {
  if (typeof text !== "string") return null;
  try {
    const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    return value && ["question", "update", "ambiguous"].includes(value.kind) && typeof value.reply === "string"
      ? { kind: value.kind, reply: value.reply }
      : null;
  } catch { return null; }
}

export function parseTriageReply(text) {
  const parsed = parseAskReply(text);
  return parsed ? { ...parsed, lane: "simple" } : null;
}
