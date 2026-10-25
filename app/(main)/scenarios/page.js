import { data, money } from "../../../lib/data";
import { PageHeader, Stat, CardHead, Empty } from "../../../lib/ui";

export const dynamic = "force-dynamic";

const pct = (v) => `${Number(v).toFixed(1)}%`;
const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;
const yearLabel = (y, asOf) => `Year ${y} (${Number(String(asOf).slice(0, 4)) + y})`;

export default function Scenarios() {
  const aff = data("affordability.json");
  const scn = data("scenarios.json");
  if (!aff || !scn) {
    return (<><PageHeader title="Scenarios" /><Empty title="No scenario build yet">It is part of this demo's fixed synthetic dataset.</Empty></>);
  }
  const p = aff.params;
  const sf = aff.start_fund;
  const cs = scn.combined_summary;
  const child = scn.second_child;
  const y5 = aff.years[aff.years.length - 1];
  const grid = (yr) => Object.fromEntries(yr.scenarios.map((s) => [`${s.rate_pct}|${s.down_payment_pct}`, s]));
  const y5g = grid(y5);
  const arrivalYear = (child.fund_trajectory.find((r) => r.monthly_delta !== 0) || {}).year || 2;
  const oneTime = (child.fund_trajectory.find((r) => r.one_time_outflow) || {}).one_time_outflow || 0;
  const childLow = child.fund_trajectory.reduce((lo, r) => (r.fund < lo.fund ? r : lo), child.fund_trajectory[0]);
  const paceOf = (y) => (aff.pace_path.find((r) => r.year === y) || {}).average_monthly_savings ?? aff.monthly_savings_budget_pace;

  return (
    <>
      <PageHeader
        title="Scenarios"
        subtitle={<>What-if math computed from the synthetic budget, accounts, and tax anchors. Every assumption is printed on this page; changing the generator inputs changes the next deterministic build. As of {aff.as_of}.</>}
      />

      <div className="cards">
        <Stat label="Savings pace" value={`${money(paceOf(1))}/mo → ${money(paceOf(5))}/mo`} sub={`year 1 to year 5, as fictional income and expenses change · trailing synthetic pace ${signed(aff.trailing_actual_monthly_net)}/mo`} />
        <Stat label="House fund today" value={money(sf.with_dp)} sub={`with the down-payment portfolio · ${money(sf.without_dp)} without it`} />
        <Stat label="Healthy price, year 5" value={money(cs.healthy_price_year5_baseline_20pct)} sub={`20% down, with the down-payment portfolio · ≈${money(y5g[`${p.mortgage_rate_pct}|20`].healthy_price_today_with_dp)} in today's dollars`} />
        <Stat label="With a second child" value={money(cs.healthy_price_year5_child_20pct)} sub="year-5 healthy price — the fund survives, the house doesn't" />
      </div>

      <div className="card">
        <CardHead title="Scenario 1 — Buying a house" sub="“Healthily afford” = total monthly housing cost at or below 28% of gross pay, and the cash-to-close covered by the house fund (after estimated capital gains tax on the sale)." />
        <p className="note">
          <strong>Assumptions:</strong> mortgage {p.mortgage_rate_pct.toFixed(2)}% 30-year fixed ({p.mortgage_rate_note}); second rate scenario {p.rate_scenarios_pct[1].toFixed(2)}%. Property tax {pct(p.property_tax_pct_of_price)} of price per year, insurance {pct(p.insurance_pct_of_price)}, HOA {money(p.hoa_monthly)}/mo, closing costs {pct(p.closing_costs_pct)}; PMI at {pct(p.pmi_pct_of_loan_per_year)} of the loan per year whenever the down payment is under 20%. Gross income {money(aff.gross_income_annual)} today.
        </p>
        <p className="note">
          <strong>How the savings pace is built:</strong> from the synthetic budget itself — income grows at {pct(p.income_growth_pct)}/yr, spending at {pct(p.expense_growth_pct)}/yr, so monthly saving widens from {money(paceOf(1))} to {money(paceOf(5))}. Childcare is in the budget at its fictional full-cost level through {p.childcare_stepdown.last_full_month}, then drops to {money(p.childcare_stepdown.aftercare_monthly)}/mo of aftercare. The fund is invested at a {pct(p.invested_return_pct)} long-run return estimate; gains are taxed at an estimated {pct(p.cap_gains_tax_pct)} when sold, and the prices below use the after-tax usable fund.
        </p>
        <p className="note">
          <strong>Starting fund:</strong> synthetic bank accounts {money(sf.liquid_total)} + demo money-market reserve {money(sf.summit_joint_money_market)} = {money(sf.liquid_plus_money_market)} — all of it sits under the {money(sf.emergency_fence)} emergency fence, so excess liquid is {money(sf.start_excess_liquid)}. The fictional down-payment portfolio ({money(sf.dp_portfolio)}) is counted only in the scenario that includes it.
        </p>
        <div className="table-scroll"><table>
          <thead><tr><th></th><th className="r">Usable fund (with DP portfolio)</th><th className="r">Usable fund (without)</th><th className="r">Healthy price · 20% down</th><th className="r">Healthy price · 10% down</th></tr></thead>
          <tbody>
            {aff.years.map((yr) => {
              const g = grid(yr);
              const headline = g[`${p.mortgage_rate_pct}|20`] || yr.scenarios[0];
              const ten = g[`${p.mortgage_rate_pct}|10`] || yr.scenarios[0];
              return (
                <tr key={yr.year}>
                  <td>{yearLabel(yr.year, aff.as_of)}</td>
                  <td className="r">{money(yr.usable_fund_with_dp)}</td>
                  <td className="r">{money(yr.usable_fund_without_dp)}</td>
                  <td className="r">{money(headline.healthy_price_with_dp)}</td>
                  <td className="r">{money(ten.healthy_price_with_dp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <p className="note">
          Year-5 grid at {p.mortgage_rate_pct.toFixed(2)}% (with the DP portfolio / without it, nominal · today&apos;s dollars): 20% down {money(y5g[`${p.mortgage_rate_pct}|20`].healthy_price_with_dp)} · {money(y5g[`${p.mortgage_rate_pct}|20`].healthy_price_today_with_dp)} / {money(y5g[`${p.mortgage_rate_pct}|20`].healthy_price_without_dp)} · {money(y5g[`${p.mortgage_rate_pct}|20`].healthy_price_today_without_dp)}; 10% down {money(y5g[`${p.mortgage_rate_pct}|10`].healthy_price_with_dp)} · {money(y5g[`${p.mortgage_rate_pct}|10`].healthy_price_today_with_dp)} / {money(y5g[`${p.mortgage_rate_pct}|10`].healthy_price_without_dp)} · {money(y5g[`${p.mortgage_rate_pct}|10`].healthy_price_today_without_dp)}.
          At 20% down the cash still binds; at 10% down the payment rule (PMI included) binds instead. Today&apos;s-dollars figures deflate at {pct(p.home_price_inflation_pct)}/yr of assumed home-price inflation.
        </p>
        {(aff.notes || []).map((n, i) => <p className="note" key={i}>{n}</p>)}
      </div>

      <div className="card">
        <CardHead title="Scenario 2 — A second child" sub={`Modeled as arriving in ${yearLabel(arrivalYear, aff.as_of).toLowerCase()} of the horizon. Costs are fictional estimates anchored to the demo budget.`} />
        <div className="table-scroll"><table>
          <thead><tr><th>Monthly change</th><th className="r">Amount</th></tr></thead>
          <tbody>
            <tr><td>Childcare (Little Oak, sibling discount)</td><td className="r">{signed(child.monthly_delta.childcare)}</td></tr>
            <tr><td>Health insurance (family plan increase)</td><td className="r">{signed(child.monthly_delta.insurance)}</td></tr>
            <tr><td>Groceries &amp; household</td><td className="r">{signed(child.monthly_delta.groceries)}</td></tr>
            <tr><td>Healthcare</td><td className="r">{signed(child.monthly_delta.healthcare)}</td></tr>
            <tr><td>DCFSA extra pre-tax saving</td><td className="r">{signed(child.monthly_delta.dcfsa_tax_saving)}</td></tr>
            <tr><td><strong>Total</strong></td><td className="r"><strong>{signed(child.monthly_delta.total)}/mo</strong></td></tr>
          </tbody>
        </table></div>
        <p className="note">
          While both childcare bills overlap, the monthly contribution runs negative (about {signed(child.fund_trajectory[1]?.monthly_contribution ?? 0)} in {yearLabel(2, aff.as_of).toLowerCase()}, {signed(child.fund_trajectory[2]?.monthly_contribution ?? 0)} in {yearLabel(3, aff.as_of).toLowerCase()}); the fictional childcare step-down brings it back to roughly break-even, then positive. A one-time {money(oneTime)} arrival cost lands in the arrival year. Under the synthetic baseline, the fund absorbs the deficit years instead of emptying — it bottoms at {money(childLow.fund)} in {yearLabel(childLow.year, aff.as_of).toLowerCase()}.
        </p>
        <div className="table-scroll"><table>
          <thead><tr><th></th><th className="r">Monthly contribution</th><th className="r">House fund — with child</th><th className="r">House fund — baseline</th></tr></thead>
          <tbody>
            {child.fund_trajectory.map((row, i) => (
              <tr key={row.year}>
                <td>{yearLabel(row.year, aff.as_of)}{row.child_age != null ? ` · child age ${row.child_age}` : ""}</td>
                <td className="r">{signed(row.monthly_contribution)}</td>
                <td className="r">{money(row.fund)}</td>
                <td className="r">{money(scn.baseline.years[i]?.fund_with_dp ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {(scn.notes || []).map((n, i) => <p className="note" key={i}>{n}</p>)}
      </div>

      <div className="card">
        <CardHead title="Combined — what the two scenarios do to each other" sub="Same fund, same five years." />
        <div className="table-scroll"><table>
          <thead><tr><th></th><th className="r">Baseline</th><th className="r">With a second child</th></tr></thead>
          <tbody>
            <tr><td>Usable house fund at year 5</td><td className="r">{money(cs.usable_fund_year5_baseline)}</td><td className="r">{money(cs.usable_fund_year5_with_child)}</td></tr>
            <tr><td>Healthy price at year 5 (20% down)</td><td className="r">{money(cs.healthy_price_year5_baseline_20pct)}</td><td className="r">{money(cs.healthy_price_year5_child_20pct)}</td></tr>
            <tr><td>Fund low point</td><td className="r">—</td><td className="r">{money(childLow.fund)} in {yearLabel(childLow.year, aff.as_of).toLowerCase()} (not exhausted)</td></tr>
          </tbody>
        </table></div>
        <p className="note">{child.house_delay?.note}</p>
        <p className="note">
          Read plainly: with the v2 baseline — invested returns, raises outpacing expenses, and Leo&apos;s childcare step-down — a second child in {yearLabel(arrivalYear, aff.as_of).toLowerCase()} no longer empties the fund, but it still takes the house off the table inside five years: the fund ends at {money(cs.usable_fund_year5_with_child)} instead of {money(cs.usable_fund_year5_baseline)}. Making both work means changing an input, not a rounding error: cheaper childcare, more income, a later arrival, a later house, or some of each. Those inputs live in the scenario parameters — adjust them in chat and this page recomputes.
        </p>
      </div>
    </>
  );
}
