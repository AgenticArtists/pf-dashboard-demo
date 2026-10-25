"use client";

import { useState } from "react";
import { fmtDate } from "../../../lib/format";
import Link from "next/link";
import { toast } from "../../../lib/client-events";
import { Icon } from "../../../lib/icons";

// Watchdog findings with Acknowledge: an acknowledged finding is hidden from
// the alert list for both of us (stored as a watchdog/acknowledged override,
// with the editor's name), and can be restored from the "acknowledged" list.
export default function WatchdogPanel({ findings, initialAcked, configured }) {
  const [acked, setAcked] = useState(() => new Set(initialAcked));
  const [busy, setBusy] = useState(null);
  const [showAcked, setShowAcked] = useState(false);

  async function setAck(id, value) {
    const prev = acked;
    const next = new Set(prev);
    if (value) next.add(id); else next.delete(id);
    setAcked(next);
    setBusy(id);
    try {
      const res = await fetch("/api/overrides", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "watchdog", target_key: id, field: "acknowledged", value }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.reason || `http ${res.status}`);
      toast(value ? "Acknowledged — hidden from the alerts for both of you." : "Restored to the alerts.");
    } catch (e) {
      setAcked(prev);
      toast(`Could not save (${e.message}). Nothing changed.`, "err");
    } finally {
      setBusy(null);
    }
  }

  const open = findings.filter((f) => !acked.has(f.id));
  const done = findings.filter((f) => acked.has(f.id));
  const disabledTitle = configured ? undefined : "Acknowledging switches on once the site's GitHub token is added";

  return (
    <>
      {open.length === 0 ? (
        <div className="callout good"><span className="callout-icon"><Icon name="check" size={16} /></span><div className="callout-body"><strong>All clear</strong>{findings.length ? "Every alert has been acknowledged." : "No unusual charges, duplicates, price increases, or hot categories in the latest data."}</div></div>
      ) : open.map((f) => (
        <div className={`callout ${f.severity === "alert" ? "alert" : "warn"}`} key={f.id}>
          <span className="callout-icon"><Icon name="alert" size={16} /></span>
          <div className="callout-body" style={{ flex: 1 }}><strong>{f.txn ? <Link href={`/transactions?open=${encodeURIComponent(`${f.txn.d}|${f.txn.m}|${f.txn.a}|${f.txn.n}`)}`} style={{ color: "inherit", textDecoration: "underline" }} title="Open this transaction">{f.title}</Link> : f.title}</strong>{f.detail} <span className="fine">· first flagged {fmtDate(f.first_seen)}</span></div>
          <button type="button" className="btn ghost sm" style={{ alignSelf: "center" }} disabled={!configured || busy === f.id} title={disabledTitle} onClick={() => setAck(f.id, true)}>
            <Icon name="check" size={14} />Acknowledge
          </button>
        </div>
      ))}
      {done.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="mini-btn" onClick={() => setShowAcked((s) => !s)} aria-expanded={showAcked}>
            {showAcked ? "Hide" : "Show"} {done.length} acknowledged
          </button>
          {showAcked && done.map((f) => (
            <div className="callout" key={f.id} style={{ marginTop: 8, opacity: 0.75 }}>
              <span className="callout-icon"><Icon name="check" size={16} /></span>
              <div className="callout-body" style={{ flex: 1 }}><strong>{f.title}</strong>{f.detail}</div>
              <button type="button" className="btn quiet sm" style={{ alignSelf: "center" }} disabled={!configured || busy === f.id} title={disabledTitle} onClick={() => setAck(f.id, false)}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
