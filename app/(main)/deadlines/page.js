import { data } from "../../../lib/data";
import { fmtDate } from "../../../lib/format";
import { PageHeader, CardHead, Empty } from "../../../lib/ui";
import { groupByBand, CATEGORY_LABELS, daysLabel } from "../../../lib/deadlines";

export const dynamic = "force-dynamic";

export default function Deadlines() {
  let payload = null;
  try { payload = data("deadlines.json"); } catch { payload = null; }
  const list = payload?.deadlines || [];
  if (!list.length) {
    return (
      <>
        <PageHeader title="Deadlines" subtitle="Hard dates from the household's own records." />
        <Empty title="No deadlines on file">The deadline center is part of this demo's fixed synthetic dataset, drawn from its sample lease, insurance, benefits, tax and statement records.</Empty>
      </>
    );
  }
  const ref = payload.generated_for || data("meta.json").as_of;
  const groups = groupByBand(list, ref);

  return (
    <>
      <PageHeader
        title="Deadlines"
        subtitle={<>Hard dates derived from the records on file — lease, insurance policies, benefits, the tax projection and manual statements. Anything inside 30 days also shows on the Monthly briefing&rsquo;s watchdog.</>}
      />
      {groups.map((g) => (
        <div className="card" key={g.key} style={{ marginBottom: 16 }}>
          <CardHead title={g.label} sub={`${g.items.length} deadline${g.items.length === 1 ? "" : "s"}`} />
          <div className="list">
            {g.items.map((e) => (
              <div className="list-row" key={e.id} style={{ alignItems: "flex-start" }}>
                <div className="list-main">
                  <div className="list-title">{e.title}</div>
                  <div className="list-meta">
                    <span>{CATEGORY_LABELS[e.category] || e.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Source: {e.source}</span>
                    {e.structural ? (<><span aria-hidden="true">·</span><span>Standing warning</span></>) : null}
                  </div>
                  <p className="fine" style={{ marginTop: 4 }}>{e.consequence}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="list-amt">{fmtDate(e.date)}</div>
                  <div className={`fine ${e.days_left < 0 ? "negative" : ""}`}>{daysLabel(e.days_left)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
