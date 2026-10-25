// Deadline center helpers (P2-15). deadlines.json is built by the pipeline
// (scripts/build_deadlines.py) from the record files — lease, insurance,
// benefits and tax projection — so every date on the Deadlines
// page traces to a record, never to a hardcoded calendar. The file's own
// days_left is relative to the pipeline run date; the site recomputes it
// against the reference date the page is showing (meta.as_of on the
// Dashboard, the file's generated_for on the Deadlines page) so the strip
// and the page always agree with the rest of the dashboard's as-of.

export const BANDS = [
  ["overdue", "Overdue"],
  ["within_30", "Next 30 days"],
  ["within_90", "Next 90 days"],
  ["later", "Later"],
];

export const CATEGORY_LABELS = {
  lease: "Lease",
  insurance: "Insurance",
  benefits: "Benefits",
  tax: "Taxes",
  records: "Records",
};

const DAY_MS = 86400000;

export function daysLeft(entry, refDate) {
  const d = new Date(`${entry.date}T12:00:00`);
  const r = new Date(`${refDate}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(r.getTime())) return null;
  return Math.round((d - r) / DAY_MS);
}

export function bandFor(days) {
  if (days == null) return "later";
  if (days < 0) return "overdue";
  if (days <= 30) return "within_30";
  if (days <= 90) return "within_90";
  return "later";
}

export function withFresh(entry, refDate) {
  const dl = daysLeft(entry, refDate);
  return { ...entry, days_left: dl, urgency: bandFor(dl) };
}

const byDate = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id));

// All deadlines grouped by urgency band, in band order, dates ascending
// inside each band. Empty bands are dropped.
export function groupByBand(list, refDate) {
  const fresh = (list || []).map((e) => withFresh(e, refDate));
  return BANDS
    .map(([key, label]) => ({ key, label, items: fresh.filter((e) => e.urgency === key).sort(byDate) }))
    .filter((g) => g.items.length);
}

// The Dashboard strip: the soonest `limit` deadlines that are overdue or
// land within `withinDays` of the reference date.
export function nextDeadlines(list, refDate, { withinDays = 180, limit = 3 } = {}) {
  return (list || [])
    .map((e) => withFresh(e, refDate))
    .filter((e) => e.days_left != null && (e.days_left < 0 || e.days_left <= withinDays))
    .sort(byDate)
    .slice(0, limit);
}

export function daysLabel(days) {
  if (days == null) return "";
  if (days < 0) return days === -1 ? "1 day overdue" : `${-days} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `${days} days left`;
}
