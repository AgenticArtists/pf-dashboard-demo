// Sol audit F8: protect state-changing requests against cross-origin form and
// content-type attacks while allowing clients that omit Origin.
export function checkRequestGuard(req, { json = false, allowNullOrigin = false } = {}) {
  if (json && !/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get("content-type") || "")) {
    return { ok: false, status: 415, reason: "unsupported_media_type" };
  }
  const origin = req.headers.get("origin");
  if (origin == null || origin === "") return { ok: true };
  // Some legitimate browsers/webviews send the literal Origin "null" (opaque
  // origin) on form posts. Only the login route opts into accepting it: a
  // login CSRF still needs the household password, and the credential check
  // plus firewall rate limit remain the real barrier there. State-changing
  // JSON routes keep rejecting it.
  if (origin === "null") {
    return allowNullOrigin ? { ok: true } : { ok: false, status: 403, reason: "bad_origin" };
  }
  const host = req.headers.get("host");
  let parsed;
  try { parsed = new URL(origin); } catch { return { ok: false, status: 403, reason: "bad_origin" }; }
  const requestUrl = new URL(req.url);
  const normalizeHost = (value, protocol) => {
    const lower = value.toLowerCase();
    if (protocol === "https:" && lower.endsWith(":443")) return lower.slice(0, -4);
    if (protocol === "http:" && lower.endsWith(":80")) return lower.slice(0, -3);
    return lower;
  };
  const originHost = normalizeHost(parsed.host, parsed.protocol);
  const requestHost = normalizeHost(host || "", requestUrl.protocol);
  const localHost = (value) => /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(value);
  const sameScheme = parsed.protocol === requestUrl.protocol;
  const localSchemeException = localHost(originHost) && localHost(requestHost) &&
    ["http:", "https:"].includes(parsed.protocol) && ["http:", "https:"].includes(requestUrl.protocol);
  if (!host || originHost !== requestHost || (!sameScheme && !localSchemeException)) {
    return { ok: false, status: 403, reason: "bad_origin" };
  }
  return { ok: true };
}
