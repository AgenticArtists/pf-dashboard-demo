import { PageHeader, Stat } from "../../../../lib/ui";

export const dynamic = "force-dynamic";

export default function WhereWeBuyGuide() {
  return (
    <>
      <PageHeader title="Where we buy things" subtitle="A fictional shopping guide using the Carter household's synthetic merchants and categories." />
      <div className="cards">
        <Stat label="Harvest Moon Market" value="Weekly" sub="Fresh food and ordinary grocery runs." />
        <Stat label="Cedar Supply Co." value="Monthly" sub="Planned household and cleaning staples." />
        <Stat label="Harbor Outlet" value="List only" sub="One-off household items, never unplanned staples." />
      </div>
      <div className="card">
        <h2>Routing table</h2>
        <div className="table-scroll"><table><thead><tr><th>What</th><th>Buy at</th><th>Demo rule</th></tr></thead><tbody>
          <tr><td>Fresh produce and dairy</td><td><strong>Harvest Moon Market</strong></td><td>Weekly, planned list.</td></tr>
          <tr><td>Cleaning supplies and paper goods</td><td><strong>Cedar Supply Co.</strong></td><td>Buy only when the household list calls for it.</td></tr>
          <tr><td>Child supplies and small gifts</td><td><strong>Harbor Outlet</strong></td><td>One item at a time, with a budget category.</td></tr>
          <tr><td>Prescription and health items</td><td><strong>Juniper Pharmacy</strong></td><td>Use the healthcare budget line.</td></tr>
        </tbody></table></div>
      </div>
      <div className="card">
        <h2>The synthetic shopping rule</h2>
        <p className="note">Make the list before leaving home, assign the purchase to a category, and wait for the next planned run when an item is not urgent. The merchants and amounts shown in this public demo are fictional.</p>
      </div>
    </>
  );
}
