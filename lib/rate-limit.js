// Daily per-user caps for the paid model routes (/api/ask, /api/explain,
// /api/glossary). In-memory counters are per serverless instance and reset
// on every cold start, so when an Upstash Redis REST endpoint is configured
// (Vercel's Upstash integration sets KV_REST_API_URL/KV_REST_API_TOKEN or
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) the count is shared across
// instances. If the shared store is unset or unreachable, the in-memory
// counter still bounds this instance.
const memory = new Map();
let memoryDay = "";

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

function takeMemorySlot(key, cap, day) {
  if (memoryDay !== day) { memory.clear(); memoryDay = day; }
  const count = memory.get(key) || 0;
  if (count >= cap) return false;
  memory.set(key, count + 1);
  return true;
}

async function incrementShared({ url, token }, key) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, "172800"]]),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const out = await res.json().catch(() => null);
    const count = out?.[0]?.result;
    return Number.isSafeInteger(count) ? count : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Consume one of `user`'s `cap` daily slots for `scope` (UTC day). Returns
// false once the cap is reached. Call it immediately before every upstream
// attempt so retries count too.
export async function takeDailySlot(scope, user, cap) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `pf:rate:${scope}:${user}:${day}`;
  const redis = redisConfig();
  if (redis) {
    const count = await incrementShared(redis, key);
    if (count !== null) return count <= cap;
  }
  return takeMemorySlot(key, cap, day);
}
