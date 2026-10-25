import { readFileSync } from "fs";
import path from "path";

// Read/write small JSON files in the pf repo (branch main) via the GitHub
// Contents API. Requires GITHUB_TOKEN (fine-grained PAT, AgenticArtists/pf
// only, Contents read/write) as a Vercel env var. Without it, reads fall back
// to the seed copies under data/ and writes report "not_configured".
const REPO = "AgenticArtists/pf";
const BRANCH = "main";
const API = `https://api.github.com/repos/${REPO}/contents`;

export function tokenConfigured() {
  return Boolean(process.env.GITHUB_TOKEN);
}

export async function readRepoText(filePath, { signal } = {}) {
  if (!tokenConfigured()) return null;
  const res = await fetch(`${API}/${filePath}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.raw+json" },
    ...(signal ? { signal } : {}),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`github read ${filePath}: ${res.status}`);
  return res.text();
}

const readCache = {};
export async function readRepoJsonWithPresence(filePath, { fresh = false } = {}) {
  if (!tokenConfigured()) {
    try {
      return { exists: true, value: JSON.parse(readFileSync(path.join(process.cwd(), "data", path.basename(filePath)), "utf8")) };
    } catch (error) {
      if (error?.code === "ENOENT") return { exists: false, value: undefined };
      throw error;
    }
  }
  const now = Date.now();
  if (!fresh && readCache[filePath] && now - readCache[filePath].at < 20000) {
    const { exists, value } = readCache[filePath];
    return { exists, value };
  }
  const res = await fetch(`${API}/${filePath}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.raw+json" },
  });
  if (res.status === 404) {
    readCache[filePath] = { at: now, exists: false, value: undefined };
    return { exists: false, value: undefined };
  }
  if (!res.ok) throw new Error(`github read ${filePath}: ${res.status}`);
  const value = await res.json();
  readCache[filePath] = { at: now, exists: true, value };
  return { exists: true, value };
}

export async function readRepoJson(filePath, options = {}) {
  const snapshot = await readRepoJsonWithPresence(filePath, options);
  return snapshot.exists ? snapshot.value : null;
}

async function currentSha(filePath) {
  const res = await fetch(`${API}/${filePath}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`github sha ${filePath}: ${res.status}`);
  const body = await res.json();
  return body.sha || null;
}

async function currentJsonSnapshot(filePath) {
  // Sol audit #1: Contents returns the JSON blob and its revision in one response.
  const res = await fetch(`${API}/${filePath}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return { exists: false, value: undefined, sha: null };
  if (!res.ok) throw new Error(`github read ${filePath}: ${res.status}`);
  const body = await res.json();
  if (!body || typeof body.sha !== "string" || !body.sha) {
    throw new Error(`github content or sha missing ${filePath}`);
  }
  let encoded = body.content;
  if (typeof encoded !== "string" || !encoded.trim()) {
    const blobRes = await fetch(`https://api.github.com/repos/${REPO}/git/blobs/${encodeURIComponent(body.sha)}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (!blobRes.ok) throw new Error(`github blob read ${filePath}: ${blobRes.status}`);
    const blob = await blobRes.json();
    if (!blob || blob.encoding !== "base64" || typeof blob.content !== "string" || !blob.content.trim()) {
      throw new Error(`github blob content missing ${filePath}`);
    }
    encoded = blob.content;
  } else if (body.encoding !== "base64") {
    throw new Error(`github content encoding invalid ${filePath}`);
  }
  const content = Buffer.from(encoded.replace(/\s/g, ""), "base64").toString("utf8");
  return { exists: true, value: JSON.parse(content), sha: body.sha };
}

// Shared optimistic mutation loop. The snapshot reader returns content and its
// matching revision together; a conflict reruns the mutation on a new snapshot.
// Exported so the deterministic local battery can exercise the production loop.
export async function mutateJsonWithRetries(mutator, readSnapshot, writeSnapshot, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const snapshot = await readSnapshot();
    const value = mutator(snapshot.value);
    const result = await writeSnapshot(value, snapshot.sha);
    if (result === true) return true;
    if (result !== "conflict") return false;
  }
  return false;
}

export async function writeRepoJson(filePath, value, message) {
  if (!tokenConfigured()) return { ok: false, reason: "not_configured" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await currentSha(filePath);
    const res = await fetch(`${API}/${filePath}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({
        message, branch: BRANCH,
        content: Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8").toString("base64"),
        ...(sha ? { sha } : {}),
      }),
    });
    if (res.ok) { delete readCache[filePath]; return { ok: true }; }
    if (res.status !== 409 && res.status !== 422) return { ok: false, reason: `github ${res.status}` };
    // sha race: someone else wrote first — re-read and retry once.
  }
  return { ok: false, reason: "conflict" };
}

// Like writeRepoJson, but the new content is produced by mutator(currentDoc)
// and the mutation is RE-APPLIED to a fresh read on every attempt — so a
// conflict retry can never overwrite a concurrent writer's changes with a
// stale snapshot (Sol audit F3/#1). The mutator may throw (malformed store,
// caps); the throw aborts the write and propagates to the caller.
export async function writeRepoJsonMutating(filePath, mutator, message) {
  if (!tokenConfigured()) return { ok: false, reason: "not_configured" };
  let failureReason = "conflict";
  const ok = await mutateJsonWithRetries(mutator,
    () => currentJsonSnapshot(filePath),
    async (value, sha) => {
      const res = await fetch(`${API}/${filePath}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({
          message, branch: BRANCH,
          content: Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8").toString("base64"),
          ...(sha ? { sha } : {}),
        }),
      });
      if (res.ok) { delete readCache[filePath]; return true; }
      if (res.status === 409 || res.status === 422) return "conflict";
      failureReason = `github ${res.status}`;
      return false;
    });
  return ok ? { ok: true } : { ok: false, reason: failureReason };
}

// The mutating writer's snapshot reader is exported for deterministic adapter tests.
export { currentJsonSnapshot as readRepoJsonSnapshot };
