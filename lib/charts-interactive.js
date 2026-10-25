"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money, money0, moneyShort, num } from "./format";
import { navStart } from "./client-events";

const safe = (v) => (Number.isFinite(num(v)) ? num(v) : 0);
const pct1 = (n) => `${Number(n).toFixed(1)}%`;
const FORMATS = { money, money0, pct1 };
// Touch screens fire pointerleave as soon as the finger lifts; keep a tapped
// tooltip open until the next tap instead.
const leave = (setHover) => (e) => { if (e.pointerType !== "touch") setHover(null); };

// Drill-down on a chart element with an href: a mouse click follows it; on
// touch screens the first tap shows the tooltip and a second tap on the
// same element follows it.
function useDrill(hover, setHover) {
  const router = useRouter();
  const [touch, setTouch] = useState(false);
  const before = useRef(null);
  return {
    touch,
    down(e, i) { before.current = hover; setTouch(e.pointerType === "touch"); setHover(i); },
    go(i, href) {
      if (i == null || !href || (touch && before.current !== i)) return;
      navStart();
      router.push(href);
    },
    hint: (label = "see transactions") => `${touch ? "Tap again" : "Click"} to ${label} →`,
  };
}

// Track the rendered width so the SVG draws at 1:1 and text stays crisp.
function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// "Nice" axis ticks covering [min, max].
function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function Tooltip({ x, width, title, rows, footer, action }) {
  const flip = x > width * 0.62;
  return (
    <div className="chart-tip" style={flip ? { right: Math.max(0, width - x + 12) } : { left: x + 12 }}>
      {title && <div className="chart-tip-title">{title}</div>}
      {rows.map((r) => (
        <div className="chart-tip-row" key={r.label}>
          <span><span className="swatch" style={{ background: r.color }} />{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
      {footer && <div className="chart-tip-foot">{footer}</div>}
      {action && <div className="chart-tip-action">{action}</div>}
    </div>
  );
}

// Line/area chart. series: [{ label, color, points: number[], dashed? }],
// labels: x-axis label per point (shorter series are allowed, e.g. a month
// in progress). zero: include 0 in the y-range. notes: optional tooltip
// footer per index. hrefs: optional drill-down link per index.
export function TrendChart({ series = [], labels = [], height = 220, format = "money0", area = true, zero = false, xTicks = 6, ariaLabel = "Trend chart", notes, hrefs }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const drill = useDrill(hover, setHover);
  const fmt = FORMATS[format] || money0;
  const n = Math.max(labels.length, ...series.map((s) => (s.points || []).length));
  const all = series.flatMap((s) => (s.points || []).map(safe));
  if (n < 2 || !all.length) return <div className="note">Not enough history to chart yet.</div>;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
  const ticks = niceTicks(zero ? lo : lo - pad, hi + pad, 4);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const left = 52, right = 12, top = 12, bottom = 26;
  const plotW = Math.max(10, width - left - right), plotH = height - top - bottom;
  const x = (i) => left + (n === 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v) => top + plotH * (1 - (safe(v) - yMin) / (yMax - yMin || 1));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.min(xTicks, Math.floor(plotW / 64)))));

  function indexAt(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    return Math.max(0, Math.min(n - 1, Math.round(((px - left) / plotW) * (n - 1))));
  }

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className={`ichart ${hrefs ? "linked" : ""}`} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}
        onPointerMove={(e) => setHover(indexAt(e))} onPointerDown={(e) => drill.down(e, indexAt(e))} onPointerLeave={leave(setHover)}
        onClick={(e) => { const i = indexAt(e); drill.go(i, hrefs?.[i]); }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`tg-${s.label}-${i}`.replace(/[^\w-]/g, "")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity=".22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
          <text className="tick" x={left - 8} y={y(t) + 4} textAnchor="end">{format === "pct1" ? pct1(t) : moneyShort(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 || i === n - 1) && (n - 1 - i >= every || i === n - 1) ? (
          <text key={`${l}-${i}`} className="tick" x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{l}</text>
        ) : null)}
        {series.map((s, si) => {
          const pts = (s.points || []).map(safe);
          if (pts.length < 1) return null;
          const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const fill = `${line} L${x(pts.length - 1).toFixed(1)},${(top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(top + plotH).toFixed(1)} Z`;
          return (
            <g key={s.label}>
              {area && !s.dashed && <path d={fill} fill={`url(#${`tg-${s.label}-${si}`.replace(/[^\w-]/g, "")})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5} strokeDasharray={s.dashed ? "5 5" : undefined} strokeLinecap="round" strokeLinejoin="round" opacity={s.dashed ? 0.7 : 1} />
              {hover == null && !s.dashed && <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />}
            </g>
          );
        })}
        {hover != null && (
          <g>
            <line className="guide" x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} />
            {series.map((s) => (s.points || [])[hover] != null && (
              <circle key={s.label} cx={x(hover)} cy={y(s.points[hover])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
            ))}
          </g>
        )}
        <rect x={left} y={top} width={plotW} height={plotH} fill="transparent" />
      </svg>
      {hover != null && (
        <Tooltip x={x(hover)} width={width} title={labels[hover]}
          rows={series.filter((s) => (s.points || [])[hover] != null).map((s) => ({ label: s.label, color: s.color, value: fmt(safe(s.points[hover])) }))}
          footer={notes ? notes[hover] : null}
          action={hrefs?.[hover] ? drill.hint() : null} />
      )}
    </div>
  );
}

// Bar chart. groups: [{ label, bars: [{ key, value, color }] }].
// stacked: bars in a group stack; otherwise they sit side by side.
// group.note -> extra footer line for that group's tooltip.
export function BarChart({ groups = [], height = 240, stacked = false, format = "money0", ariaLabel = "Bar chart", showTotals = false, highlightLast = false, linkLabel = "See transactions" }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const drill = useDrill(hover, setHover);
  const fmt = FORMATS[format] || money0;
  if (!groups.length) return <div className="note">No chart data available.</div>;
  const totals = groups.map((g) => (stacked ? g.bars.reduce((s, b) => s + Math.max(0, safe(b.value)), 0) : Math.max(0, ...g.bars.map((b) => safe(b.value)))));
  const ticks = niceTicks(0, Math.max(1, ...totals), 4);
  const yMax = ticks[ticks.length - 1];
  const left = 52, right = 8, top = showTotals ? 22 : 12, bottom = 26;
  const plotW = Math.max(10, width - left - right), plotH = height - top - bottom;
  const slot = plotW / groups.length;
  const nb = stacked ? 1 : Math.max(1, ...groups.map((g) => g.bars.length));
  const gap = Math.max(2, Math.min(4, slot * 0.04));
  const barW = Math.max(3, Math.min(stacked ? 44 : 18, (slot * 0.68 - gap * (nb - 1)) / nb));
  const y = (v) => top + plotH * (1 - safe(v) / yMax);
  const every = Math.max(1, Math.ceil(groups.length / Math.floor(plotW / 44)));

  function indexAt(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.floor((px - left) / slot);
    return i >= 0 && i < groups.length ? i : null;
  }
  const linked = groups.some((g) => g.href);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className={`ichart ${linked ? "linked" : ""}`} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}
        onPointerMove={(e) => setHover(indexAt(e))} onPointerDown={(e) => drill.down(e, indexAt(e))} onPointerLeave={leave(setHover)}
        onClick={(e) => { const i = indexAt(e); drill.go(i, i != null && groups[i].href); }}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={left - 8} y={y(t) + 4} textAnchor="end">{moneyShort(t)}</text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const cx = left + slot * gi + slot / 2;
          const dim = hover != null && hover !== gi;
          const faded = highlightLast && hover == null && gi !== groups.length - 1;
          let stackY = y(0);
          return (
            <g key={`${g.label}-${gi}`} opacity={dim ? 0.38 : faded ? 0.82 : 1}>
              {hover === gi && <rect className="band" x={left + slot * gi + 1} y={top} width={slot - 2} height={plotH} rx="6" />}
              {g.bars.map((b, bi) => {
                const v = Math.max(0, safe(b.value));
                const h = Math.max(v > 0 ? 1.5 : 0, y(0) - y(v));
                if (stacked) {
                  stackY -= h;
                  const isTop = bi === g.bars.length - 1 || g.bars.slice(bi + 1).every((nb2) => safe(nb2.value) <= 0);
                  return <rect key={b.key} x={cx - barW / 2} y={stackY} width={barW} height={h} fill={b.color} rx={isTop ? 3 : 0} />;
                }
                const bx = cx - (nb * barW + (nb - 1) * gap) / 2 + bi * (barW + gap);
                return <rect key={b.key} x={bx} y={y(0) - h} width={barW} height={h} fill={b.color} rx={Math.min(4, barW / 3)} />;
              })}
              {showTotals && totals[gi] > 0 && <text className="tick strong" x={cx} y={y(totals[gi]) - 7} textAnchor="middle">{moneyShort(totals[gi])}</text>}
              {(gi % every === 0) && <text className="tick" x={cx} y={height - 6} textAnchor="middle">{g.label}</text>}
            </g>
          );
        })}
        <line className="axis" x1={left} x2={width - right} y1={y(0)} y2={y(0)} />
      </svg>
      {hover != null && (
        <Tooltip x={left + slot * hover + slot / 2} width={width} title={groups[hover].title || groups[hover].label}
          rows={groups[hover].bars.map((b) => ({ label: b.key, color: b.color, value: fmt(safe(b.value)) }))}
          footer={groups[hover].note || null}
          action={groups[hover].href ? drill.hint(linkLabel.toLowerCase()) : null} />
      )}
    </div>
  );
}

// Donut with hover: the centre shows the hovered segment (or the total).
// segments[].href: optional drill-down link per slice.
export function Donut({ segments = [], size = 200, centerLabel = "Total", format = "money0" }) {
  const [hover, setHover] = useState(null);
  const drill = useDrill(hover, setHover);
  const fmt = FORMATS[format] || money0;
  const rows = segments.filter((s) => safe(s.value) > 0);
  const total = rows.reduce((sum, s) => sum + safe(s.value), 0);
  if (!rows.length || !total) return <div className="note">No chart data available.</div>;
  let offset = 0;
  const active = hover != null ? rows[hover] : null;
  return (
    <div className="donut-visual" style={{ width: size, height: size }}>
      <svg className="donut" viewBox="0 0 100 100" role="img" aria-label="Breakdown" onPointerLeave={leave(setHover)}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--track)" strokeWidth="13" />
        {rows.map((s, i) => {
          const length = (safe(s.value) / total) * 100;
          const gapLen = rows.length > 1 ? Math.min(0.8, length / 3) : 0;
          const dash = `${Math.max(0.01, length - gapLen)} ${100 - length + gapLen}`;
          const currentOffset = -offset;
          offset += length;
          return (
            <circle key={`${s.label}-${i}`} cx="50" cy="50" r="38" fill="none" stroke={s.color} strokeWidth={hover === i ? 15 : 13}
              pathLength="100" strokeDasharray={dash} strokeDashoffset={currentOffset} transform="rotate(-90 50 50)"
              opacity={hover != null && hover !== i ? 0.35 : 1} style={{ transition: "opacity 120ms, stroke-width 120ms", cursor: "pointer" }}
              onPointerEnter={() => setHover(i)} onPointerDown={(e) => drill.down(e, i)} onClick={() => drill.go(i, s.href)} />
          );
        })}
      </svg>
      <div className="donut-center">
        <strong>{fmt(active ? safe(active.value) : total)}</strong>
        <span>{active ? `${active.label} · ${((safe(active.value) / total) * 100).toFixed(1)}%` : centerLabel}</span>
        {active?.href && <em className="donut-hint">{drill.hint("open")}</em>}
      </div>
    </div>
  );
}
