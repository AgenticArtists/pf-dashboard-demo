import { TAXONOMY, CAT_GROUP, INCOME_CAT, SUB_HOME, BUDGET_CATS } from "./taxonomy.js";

// The public demo has no writable or remote-backed state.
export const tokenConfigured = () => false;

export const OVERRIDES_PATH = "web/overrides.json";
export const INSTRUCTIONS_PATH = "web/instructions.json";
export const QUESTIONS_PATH = "web/questions.json";
export const INVESTMENT_DECISIONS_PATH = "web/investment_decisions.json";

export const fingerprint = (t) => `${t.d}|${t.m}|${String(t.a)}|${t.n}`;

// Read paths stay tolerant (a display glitch beats a crash). WRITE paths use
// this strict shape check instead: a stored document that exists but is
// malformed must abort the write loudly, never be silently reset to empty
// (Sol audit F6).
function strictList(doc, key) {
  if (doc === undefined) return [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || !Array.isArray(doc[key])) throw new Error("malformed_store");
  return doc[key];
}

export async function getOverrides() {
  return [];
}

export async function upsertOverride() { return { ok: false, reason: "disabled in demo" }; }

export async function getInstructions() {
  return [];
}

export async function addInstruction() { return { ok: false, reason: "disabled in demo" }; }

// Questions (Daniel, 2026-10-15): Ask a Question also answers questions about the
// money, not just change requests — Maya has no direct access, so the Q&A
// lives here. A worker polls web/questions.json, computes each answer from
// the dashboard data, and writes it back (status "answered" + "answer").
export async function getQuestions() {
  return [];
}

// Per-user thread privacy (Daniel, 2026-10-17): Ask a Question history is
// restricted to its author — each login sees only its own questions and
// instructions: in the API responses, in the page's initial data, and in
// the live endpoint's model history. Entries without an author are
// visible to no one (fail closed). Filtering happens at the read
// boundary; the store itself stays whole for the answering worker.
export function entriesForUser(entries, user) {
  if (!Array.isArray(entries) || !user) return [];
  return entries.filter((e) => e && e.author === user);
}

export async function addQuestion() { return { ok: false, reason: "disabled in demo" }; }

// Investment decisions (Daniel, 2026-10-16): the /investments page's
// Approve/Dismiss buttons. A decision records INTENT only — it never
// places a trade; Summit Investments execution stays a separate, explicit step.
export async function getInvestmentDecisions() {
  return [];
}

export async function upsertInvestmentDecision() { return { ok: false, reason: "disabled in demo" }; }

const SUB_GROUPS = (() => {
  const m = new Map();
  for (const [g, subs] of TAXONOMY) for (const s of subs) {
    if (!m.has(s)) m.set(s, []);
    m.get(s).push(g);
  }
  return m;
})();

// Display name (Daniel, 2026-10-15): rent paid by Zelle displays as
// "Zelle Rent Payment" while staying under Home Expenses / Rent. The
// ledger name (n) is untouched — it keys the override fingerprints.
function withDisplayName(row) {
  if (row.n === "Transfer to Zelle" && row.c === "Home Expenses" && row.sc === "Rent" && !row.dn) return { ...row, dn: "Zelle Rent Payment" };
  return row;
}

export function applyRecordsToTxns(txns, records) {
  const byKey = new Map();
  // Sol audit F6: malformed persisted values must never leak through display rendering.
  for (const r of records) if (r && r.target_type === "transaction" && typeof r.value === "string") byKey.set(`${r.target_key}|${r.field}`, r);
  return txns.map((t) => {
    const fp = fingerprint(t);
    const p = byKey.get(`${fp}|person`);
    const c = byKey.get(`${fp}|category`);
    const s = byKey.get(`${fp}|subcategory`);
    const nm = byKey.get(`${fp}|name`);
    if (!p && !c && !s) { const base = withDisplayName(t); return nm ? { ...base, dn: nm.value, v: nm.value } : base; }
    const out = { ...t, ...(p ? { p: p.value } : {}), ...(c ? { c: c.value } : {}), edited: true };
    // A category change re-resolves the row's group even when the row has no
    // subcategory override (Daniel, 2026-10-14: a Hobbies category override
    // on a Home Expenses row left the row grouped under Home Expenses).
    if (c && c.value !== "Loans" && c.value !== "Income") out.g = CAT_GROUP[c.value] || out.g;
    // Flipping a row back to Income (e.g. undoing a Transfers move) restores
    // the Income group and the derived category handling below.
    if (c && c.value === "Income") out.g = "Income";
    // Legacy category records that name a SUBcategory (written when the
    // category dropdown briefly offered subcategory names, e.g. "Betting",
    // "Crypto", "Education") mean that subcategory under its home budget
    // category. Resolve via SUB_HOME, ignoring name-repeat homes (a home
    // equal to the subcategory name itself); only when unambiguous.
    let catAsSub = null;
    if (c && !BUDGET_CATS.includes(c.value)) {
      const homes = new Set();
      for (const [k, home] of Object.entries(SUB_HOME)) {
        if (k.split("|")[1] === c.value && home !== c.value) homes.add(home);
      }
      if (homes.size === 1) catAsSub = { sub: c.value, home: [...homes][0] };
    }
    if (catAsSub) {
      out.c = catAsSub.home;
      out.g = CAT_GROUP[catAsSub.home] || out.g;
    }
    if (s) {
      out.sc = s.value;
      if (t.g === "Income" || (c && c.value === "Income")) {
        out.ic = s.value;
        // Income category is derived from the subcategory (Employment /
        // Irregular) — keep it in sync when the subcategory changes.
        if (INCOME_CAT[s.value]) out.c = INCOME_CAT[s.value];
      }
      const groups = SUB_GROUPS.get(s.value) || [];
      // A subcategory label never moves a row across the income/spend
      // boundary on its own (e.g. a statement credit labelled
      // "Credit Card Rewards" stays in its spend category, netting against
      // the charge it refunds — only a category override reclassifies).
      if (groups.length && !groups.includes(out.g) && (out.g === "Income") === (groups[0] === "Income")) out.g = groups[0];
    }
    // Moving a row to Transfers / Card Payments clears any subcategory (and
    // stale income subcategory) — those categories have no subcategory level.
    if (c && (c.value === "Transfers" || c.value === "Card Payments")) {
      out.sc = "";
      out.ic = "";
    }
    // A subcategory named by a legacy category record (above) becomes the
    // row's subcategory when the row has no subcategory record of its own.
    if (catAsSub && !s) out.sc = catAsSub.sub;
    if (c && c.value === "Income" && t.g === "Income") {
      out.c = INCOME_CAT[out.sc || t.sc] || out.c;
    }
    // An explicit field=name record (a manual rename) wins over the
    // derived display names.
    if (nm) { out.dn = nm.value; out.v = nm.value; }
    return withDisplayName(out);
  });
}

