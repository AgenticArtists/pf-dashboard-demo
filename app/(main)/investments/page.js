import { data, money } from "../../../lib/data";
import { moneyText, fmtDate } from "../../../lib/format";
import { getInvestmentDecisions, tokenConfigured } from "../../../lib/overrides";
import DecisionButtons from "./decisions-client";
import RegimeBullets from "./regime-bullets";
import ExplainerText from "./explainer-text";
import PlanToggle from "./plan-toggle";
import { PageHeader, Stat, CardHead, Progress, Empty } from "../../../lib/ui";
import { Icon } from "../../../lib/icons";
import { TrendChart } from "../../../lib/charts-interactive";

export const dynamic = "force-dynamic";

const pct = (v) => `${Number(v).toFixed(1)}%`;
const signedPts = (v) => `${v > 0 ? "+" : ""}${Number(v).toFixed(1)} pts`;
const deltaTxt = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;
const monthYear = (iso) => new Date(`${String(iso).slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function Investments() {
  const p = data("portfolio.json");
  if (!p || !p.total_investable) {
    return (<><PageHeader title="Investments" /><Empty title="No portfolio build yet">It is part of this demo's fixed synthetic dataset.</Empty></>);
  }
  const decisions = await getInvestmentDecisions().catch(() => []);
  let risk = null;
  try { risk = data("risk.json"); } catch (_) { /* Risk analysis is optional until the pipeline publishes one. */ }
  if (!risk || !Object.keys(risk).length) risk = null;
  const configured = tokenConfigured();
  const decById = {};
  for (const d of decisions) decById[d.item_id] = d;
  const a = p.allocation;
  const opt = p.optimizer || {};
  // Single decision list (2026-10-18 fold-in): the analyst ideas rule on the
  // plan's actionable lines; any actionable line no idea covers is rendered
  // as a plain plan card in the same list, with its existing plan:<class> key.
  const planByClass = Object.fromEntries((p.summit_plan || []).map((r) => [r.class, r]));
  const planOrder = Object.fromEntries((p.summit_plan || []).map((r, i) => [r.class, i]));
  const linkedIdeas = (p.ideas || []).filter((i) => i.plan_class && planByClass[i.plan_class])
    .sort((x, y) => planOrder[x.plan_class] - planOrder[y.plan_class]);
  const otherIdeas = (p.ideas || []).filter((i) => !(i.plan_class && planByClass[i.plan_class]));
  const coveredClasses = new Set(linkedIdeas.map((i) => i.plan_class));
  const uncoveredPlan = (p.summit_plan || []).filter((r) => (r.action === "buy" || r.action === "trim") && Math.abs(r.delta || 0) > 0 && !coveredClasses.has(r.class));
  const STANCE_BADGE = { endorse: "good", modify: "warn", oppose: "bad" };
  const actionWord = (r) => (r.action === "buy" ? "Buy" : r.action === "trim" ? "Trim" : "Hold");

  return (
    <>
      <PageHeader
        title="Investments"
        subtitle={<>Whole-portfolio view across every account; Summit Investments is the action account. {p.positions_as_of}.</>}
        actions={<span className="badge">Recommend-only</span>}
      />

      <div className="cards">
        <Stat label="Investable assets" value={money(p.total_investable)} sub="all investment accounts, incl. retirement and the down-payment portfolio" />
        <Stat label="Mapped coverage" value={pct(p.coverage_pct)} sub={`${money(p.mapped_total)} mapped · ${money(p.unmapped_total)} balance-only`} />
        <Stat label="US equity (mapped)" value={pct(a.pct.us_equity)} sub={`of the whole portfolio it is between ${pct(p.us_equity_bounds_pct[0])} and ${pct(p.us_equity_bounds_pct[1])} until the unmapped funds are known`} />
        <Stat label="International (mapped)" value={pct(a.pct.intl_equity)} sub={`target ${pct(p.target.classes_pct.intl_equity)}`} />
      </div>

      <div className="card">
        <CardHead title="Allocation vs target" sub="Percentages are computed on the mapped portion only — balances whose funds are not on file are counted in the total and listed as unmapped, never guessed." />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Asset class</th><th className="hide-sm" style={{ width: "30%" }}>Current vs target</th><th className="r">Current $</th><th className="r">Current</th><th className="r">Target</th><th className="r">Drift</th></tr></thead>
            <tbody>
              {p.drift.map((d) => (
                <tr key={d.class}>
                  <td><strong>{d.label}</strong></td>
                  <td className="hide-sm" style={{ verticalAlign: "middle" }}><Progress value={d.current_pct} max={100} tone={d.flag ? "warn" : "neutral"} marker={d.target_pct / 100} /></td>
                  <td className="r">{money(a.dollars[d.class])}</td>
                  <td className="r">{pct(d.current_pct)}</td>
                  <td className="r muted">{pct(d.target_pct)}</td>
                  <td className="r">{d.flag ? <span className="badge warn"><Icon name="alert" size={12} />{signedPts(d.drift_pts)}</span> : <span className="muted">{signedPts(d.drift_pts)}</span>}</td>
                </tr>
              ))}
              <tr><td>Other / unclassified</td><td className="hide-sm"></td><td className="r">{money(a.dollars.other)}</td><td className="r">{pct(a.pct.other)}</td><td className="r muted">—</td><td className="r muted">—</td></tr>
            </tbody>
          </table>
        </div>
        {p.reserves && (
          <div className="note" style={{ marginTop: 8 }}>
            <strong>Household reserves: {money(p.reserves.total)}</strong> — {money(p.reserves.bank_cash)} in bank checking and savings plus {money(p.reserves.money_market_swvxx)} in the demo money-market reserve, measured against the {money(p.reserves.floor_low)}–{money(p.reserves.floor_high)} emergency floor. {p.reserves.meets_floor ? "The floor is met." : <>Currently <strong>short of the floor by {money(p.reserves.floor_low - p.reserves.total)}</strong>.</>} This is the spendable-reserve measure; the cash row above is an asset class and counts different dollars — it excludes bank cash and includes earmarked cash such as the HSA.
          </div>
        )}
        <details className="disclosure" style={{ marginTop: 8, borderTop: "1px solid var(--border-soft)" }}>
          <summary><span>Why these targets <span className="fine">· {p.target.status}</span></span><Icon name="chevronDown" size={16} /></summary>
          <div className="note">{moneyText(p.target.rationale)}</div>
        </details>
      </div>

      {risk?.holdings && risk?.class_risk && risk?.backtest && (
        <>
          <div className="card">
            <CardHead
              title="Risk — the last five years at today's weights"
              sub={`${monthYear(risk.window[0])} – ${monthYear(risk.window[1])} · ${pct(risk.coverage.risk_universe_pct)} of mapped dollars inside the calculation (${pct(risk.coverage.priced_pct)} priced directly, ${pct(risk.coverage.proxied_pct)} by documented proxy, ${pct(risk.coverage.cash_pct)} cash)`}
            />
            <div className="cards">
              <Stat label="Annualized volatility" value={pct(risk.holdings.ann_vol_pct)} />
              <Stat label="Max drawdown" value={pct(risk.holdings.max_drawdown.pct)} sub={`${monthYear(risk.holdings.max_drawdown.peak_month)} → ${monthYear(risk.holdings.max_drawdown.trough_month)}`} />
              <Stat label="Sharpe" value={Number(risk.holdings.sharpe).toFixed(2)} sub={risk.holdings.sharpe < 0 ? "Below cash — the ride went unpaid" : risk.holdings.sharpe < 0.5 ? "Thin band (0 to 0.5)" : risk.holdings.sharpe < 1 ? "Decent band (0.5 to 1)" : "Excellent band (above 1)"} />
              <Stat label="Worst month" value={pct(risk.holdings.worst_month.pct)} sub={monthYear(risk.holdings.worst_month.month)} />
            </div>
            {(() => {
              const top = risk.holdings.top_contributors?.[0];
              const dd = risk.holdings.max_drawdown;
              const ddDollars = p.total_investable ? Math.round((Math.abs(dd.pct) / 100) * p.total_investable) : null;
              const sharpe = Number(risk.holdings.sharpe);
              const band = sharpe < 0 ? "below zero — the ride wasn't paid for at all" : sharpe < 0.5 ? "at the top of the thin band, just under the decent line" : sharpe < 1 ? "inside the decent band" : "inside the excellent band";
              const cls = Object.fromEntries((risk.class_risk.current || []).map((r) => [r.class, r]));
              const eqW = (cls.us_equity?.weight_pct ?? 0) + (cls.intl_equity?.weight_pct ?? 0);
              const eqR = (cls.us_equity?.risk_pct ?? 0) + (cls.intl_equity?.risk_pct ?? 0);
              const bcW = (cls.bonds?.weight_pct ?? 0) + (cls.cash?.weight_pct ?? 0);
              const bcR = (cls.bonds?.risk_pct ?? 0) + (cls.cash?.risk_pct ?? 0);
              const whyTop = top && top.risk_pct > top.weight_pct + 5
                ? ` Why it outweighs its dollars: risk is not dealt out evenly per dollar. Stocks are ${pct(eqW)} of the money but ${pct(eqR)} of the swings, while bonds and cash are ${pct(bcW)} of the money and only ${pct(bcR)} of the swings. ${top.name} is about 90% stocks — a 2055 target-date fund holds equities heavily this far from retirement — and it rises and falls together with the other stock holdings rather than offsetting them, so its swings stack instead of cancelling. A 1:1 share would only happen if every dollar swung alike, and the bond and cash dollars barely swing at all.`
                : "";
              return (
                <p className="explainer">
                  <ExplainerText text={`How to read this: a volatility of ${pct(risk.holdings.ann_vol_pct)} means a typical year swung roughly that far around its average. The max drawdown of ${pct(dd.pct)} (${monthYear(dd.peak_month)} → ${monthYear(dd.trough_month)}) is the worst peak-to-trough slide in the window${ddDollars ? ` — replayed on today's ${money(p.total_investable)} invested, about a ${money(ddDollars)} paper fall before the recovery` : ""}. A Sharpe of ${sharpe.toFixed(2)} means the portfolio earned roughly that much return above cash for each unit of swing — higher is more pay for the bumps. The usual scale: below 0, the swings didn't even beat cash; 0 to 0.5 is thin pay; 0.5 to 1.0 is a decent trade; above 1.0 is excellent and rarely lasts. At ${sharpe.toFixed(2)} this mix sits ${band}.${top ? ` One holding dominates: ${top.name} (${top.symbol}) is ${pct(top.weight_pct)} of the dollars, but its risk contribution is ${pct(top.risk_pct)} of the total, so the portfolio's ride is mostly that fund's ride.${whyTop}` : ""} The red line is the drawdown path: each point is how far below the previous peak the portfolio sat that month.`} />
                </p>
              );
            })()}
            <TrendChart
              series={[{ label: "Drawdown", color: "#b71c1c", points: risk.holdings.drawdown_series.map((p) => p.dd) }]}
              labels={risk.holdings.drawdown_series.map((p) => monthYear(p.m))}
              format="pct1" area={false} zero ariaLabel="Portfolio drawdown over the risk window"
            />
            <h3>Where the risk comes from</h3>
            <div className="table-scroll"><table>
              <thead><tr><th>Holding</th><th className="r">% of dollars</th><th className="r">% of total risk</th></tr></thead>
              <tbody>{risk.holdings.top_contributors.map((r) => (
                <tr key={r.symbol}>
                  <td><strong>{r.name}</strong><div className="note">{r.symbol}</div></td>
                  <td className="r">{pct(r.weight_pct)}</td>
                  <td className="r">{pct(r.risk_pct)}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="note">
              {[...risk.class_risk.current, ...(Number(risk.holdings.class_risk_pct.other) > 0.5 ? [{ class: "other", risk_pct: risk.holdings.class_risk_pct.other }] : [])]
                .map((row) => `${a.labels[row.class] || row.class}: ${row.weight_pct == null ? "—" : pct(row.weight_pct)} of dollars / ${pct(row.risk_pct ?? risk.holdings.class_risk_pct[row.class])} of risk`)
                .join(" · ")}
            </p>
            <p className="note">
              {risk.methods}{risk.coverage.excluded?.length ? ` ${risk.coverage.excluded.map((r) => `${r.symbol} (${pct(r.weight_pct)} of dollars) is excluded — ${r.reason}.`).join(" ")}` : ""}
            </p>
          </div>

          <div className="card">
            <CardHead
              title={`Backtest — current mix vs the ${["us_equity", "intl_equity", "bonds", "cash"].map((c) => risk.backtest.target.weights_pct[c]).join("/")} target`}
              sub="Historical growth of $100,000 with monthly-rebalanced fixed class weights."
            />
            <div className="table-scroll"><table>
              <thead><tr><th>Mix</th><th className="r">Ann. return</th><th className="r">Ann. volatility</th><th className="r">Sharpe</th><th className="r">Max drawdown</th><th className="r">$100k grew to</th></tr></thead>
              <tbody>{["current", "target"].map((key) => {
                const mix = risk.backtest[key];
                const label = key === "current" ? "Current mix" : "Target mix";
                const weights = ["us_equity", "intl_equity", "bonds", "cash"].map((c) => `${a.labels[c] || c} ${pct(mix.weights_pct[c])}`).join(" · ");
                return <tr key={key}>
                  <td><strong>{label}</strong><div className="note">{weights}</div></td>
                  <td className="r">{pct(mix.ann_return_pct)}</td>
                  <td className="r">{pct(mix.ann_vol_pct)}</td>
                  <td className="r">{Number(mix.sharpe).toFixed(2)}</td>
                  <td className="r">{pct(mix.max_drawdown.pct)}</td>
                  <td className="r">{money(mix.final_value)}</td>
                </tr>;
              })}</tbody>
            </table></div>
            {(() => {
              const cur = risk.backtest.current;
              const tgt = risk.backtest.target;
              const gap = Math.round(cur.final_value - tgt.final_value);
              const ahead = gap >= 0
                ? `the current mix finished ${money(Math.abs(gap))} ahead`
                : `the target mix finished ${money(Math.abs(gap))} ahead`;
              const ride = tgt.ann_vol_pct < cur.ann_vol_pct
                ? `The target's trade is a calmer ride for its pile: volatility of ${pct(tgt.ann_vol_pct)} instead of ${pct(cur.ann_vol_pct)}, and a max drawdown of ${pct(tgt.max_drawdown.pct)} instead of ${pct(cur.max_drawdown.pct)}.`
                : `In this window the target did not even calm the ride: volatility of ${pct(tgt.ann_vol_pct)} against ${pct(cur.ann_vol_pct)}, and a max drawdown of ${pct(tgt.max_drawdown.pct)} against ${pct(cur.max_drawdown.pct)}.`;
              return (
                <p className="explainer">
                  <ExplainerText text={`What this shows: a backtest replays the last five years at fixed weights. $100,000 in the current mix would have ended at ${money(cur.final_value)}; in the target mix, ${money(tgt.final_value)} — ${ahead}. ${ride} Neither figure is a forecast: it is the same five years run through two different mixes.`} />
                </p>
              );
            })()}
            <TrendChart
              series={[
                { label: "Current mix", color: "#1565c0", points: risk.backtest.growth.map((p) => p.current) },
                { label: "Target mix", color: "#2e7d32", points: risk.backtest.growth.map((p) => p.target) },
              ]}
              labels={risk.backtest.growth.map((p) => monthYear(p.m))}
              format="money0" ariaLabel="Backtest growth of current and target mixes"
            />
            <p className="note">Monthly-rebalanced fixed weights on {Object.values(risk.backtest.proxies).join(" / ")} proxies. {risk.methods}</p>
          </div>
        </>
      )}

      {(() => {
        let brief = null;
        try { brief = data("regime_brief.json"); } catch (_) { /* Brief is optional until the pipeline publishes one. */ }
        const sections = brief?.sections || {};
        const headings = { regime_now: "Regime now", target_implications: "Target implications", watch_items: "Watch items", disagreements: "Disagreements" };
        const populated = Object.entries(headings).filter(([key]) => Array.isArray(sections[key]) && sections[key].length);
        if (!brief?.as_of || !populated.length) return null;
        return (
          <div className="card">
            <CardHead title="Research basis" sub={`As of ${fmtDate(brief.as_of)} · from ${(brief.sources || []).length} curated sources`} />
            {populated.map(([key, title], idx) => (
              <details className="disclosure" key={key} open={idx === 0}>
                <summary><span>{title} <span className="fine">· {sections[key].length} points</span></span><Icon name="chevronDown" size={16} /></summary>
                <RegimeBullets points={sections[key]} simplePoints={(brief.simple_sections || {})[key]} terms={brief.glossary_terms || []} meta={(brief.bullet_meta || {})[key]} />
              </details>
            ))}
          </div>
        );
      })()}

      {(p.flags || []).length > 0 && (
        <div className="card">
          <h2>Concentration &amp; data flags</h2>
          {p.flags.map((f, i) => (
            <div className="callout warn" key={i}><span className="callout-icon"><Icon name="alert" size={16} /></span><div className="callout-body"><strong>{moneyText(f.title)}</strong><span className="note">{moneyText(f.detail)}</span></div></div>
          ))}
        </div>
      )}

      <div className="card">
        <CardHead title="Summit Investments joint — rebalance plan" sub="The math the recommendations below are built on: current vs. target for the Summit Investments joint account, with the tax of each move. Decisions live in Recommendations only." right={<PlanToggle />} />
        <div className="plan-list">
          {p.summit_plan.map((r) => {
            const act = r.action === "buy" ? "buy" : r.action === "trim" ? "trim" : "hold";
            const [fundName, fundNote] = String(r.vehicle_name || "").split(/ \((.*)\)$/);
            return (
              <details className={`plan-item ${act}`} key={r.class} open={act !== "hold"}>
                <summary className="plan-sum">
                  <span className={`badge ${act === "buy" ? "good" : act === "trim" ? "bad" : ""}`}>{act === "buy" ? "Buy" : act === "trim" ? "Trim" : "Hold"}</span>
                  <span className="plan-sum-main">
                    <strong>{r.label}</strong>
                    <span className="plan-sum-sub">{r.vehicle} · {fundName}</span>
                  </span>
                  <span className={`plan-sum-delta ${act}`}>{r.delta === 0 ? "No change" : deltaTxt(r.delta)}</span>
                  <Icon name="chevronDown" size={16} />
                </summary>
                <div className="plan-body">
                  <div className="plan-stats">
                    <div><span>Current</span><strong>{money(r.current)}</strong></div>
                    <div><span>Target</span><strong>{money(r.target)}</strong></div>
                    <div><span>Change</span><strong className={act === "buy" ? "pos" : ""}>{r.delta === 0 ? "—" : deltaTxt(r.delta)}</strong></div>
                    {r.est_shares ? <div><span>Shares</span><strong>≈{r.est_shares} @ {money(r.price)}</strong></div> : null}
                  </div>
                  <p className="plan-fund"><strong>{r.vehicle}</strong> — {fundName}{fundNote ? <span className="muted"> · {fundNote}</span> : null}</p>
                  {r.note && <section className="plan-sec"><h4>Why</h4><p>{r.note}</p></section>}
                  {r.tax?.kind === "sale" && (
                    <section className="plan-sec">
                      <h4>Tax of this move</h4>
                      <dl className="plan-kv">
                        <dt>Sold</dt><dd>{money(r.tax.proceeds)} <span className="muted">({r.tax.positions_sold.map((x) => `${x.symbol} ${money(x.proceeds)}`).join(" · ")})</span></dd>
                        <dt>{r.tax.est_gain_loss >= 0 ? "Gain realized" : "Loss realized"}</dt><dd>≈{money(Math.abs(r.tax.est_gain_loss))}</dd>
                        <dt>Estimated tax</dt><dd><strong>{money(r.tax.est_tax_long_term)}</strong> if long-term · <strong>{money(r.tax.est_tax_short_term)}</strong> if short-term</dd>
                        {r.tax.wash_sale_note && <><dt>Wash sales</dt><dd>{r.tax.wash_sale_note}</dd></>}
                      </dl>
                      {r.tax.method && <p className="plan-fine">{r.tax.method}</p>}
                    </section>
                  )}
                  {r.tax?.kind === "none" && <section className="plan-sec"><h4>Tax of this move</h4><p>{r.tax.note}</p></section>}
                  {r.sol_tax_commentary && <section className="plan-sec plan-quote"><h4>Sol 6.1 on the tax</h4><p>{r.sol_tax_commentary}</p></section>}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="card">
        <CardHead title="Model views — PyPortfolioOpt" sub="Shown for comparison; not the plan" />
        {opt.error && <p className="note">Optimiser unavailable this run: {opt.error}</p>}
        {opt.hrp && (
          <>
            <div className="table-scroll"><table>
              <thead><tr><th>Asset class</th><th className="r">Current (Summit Investments invested)</th><th className="r">Target policy</th><th className="r">HRP</th><th className="r">Max-Sharpe</th></tr></thead>
              <tbody>
                {["us_equity", "intl_equity", "bonds"].map((c) => (
                  <tr key={c}>
                    <td>{a.labels[c]}</td>
                    <td className="r">{pct(100 * (p.summit_plan.find((r) => r.class === c)?.current || 0) / Math.max(1, (p.summit_plan.reduce((s, r) => s + (r.class === "cash" ? 0 : r.current), 0))))}</td>
                    <td className="r">{pct(p.target.classes_pct[c] / (1 - p.target.classes_pct.cash / 100))}</td>
                    <td className="r">{opt.hrp.weights_by_class[c] ? pct(100 * opt.hrp.weights_by_class[c]) : "0.0%"}</td>
                    <td className="r">{opt.max_sharpe.weights_by_class[c] ? pct(100 * opt.max_sharpe.weights_by_class[c]) : "0.0%"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="note">
              {opt.engine}. Proxies {Object.values(opt.proxies || {}).join(" / ")}, prices {opt.price_window?.[0]} → {opt.price_window?.[1]}.
              HRP (no return forecast): vol {pct(100 * opt.hrp.volatility)}, return {pct(100 * opt.hrp.expected_return)}.
              Max-Sharpe (forecast-driven): vol {pct(100 * opt.max_sharpe.volatility)}, return {pct(100 * opt.max_sharpe.expected_return)}.
              Unconstrained HRP loads bonds and unconstrained max-Sharpe loads US equity — both are shown as views; the plan above follows the target policy.
            </p>
          </>
        )}
      </div>

      {((p.ideas || []).length > 0 || uncoveredPlan.length > 0) && (
        <div className="card">
          <CardHead title={`Recommendations — analyst ${fmtDate(p.ideas_as_of)}`} sub="The one decision list. The analyst layer weighs the rebalance plan above and rules on each actionable line — endorse, modify, or oppose; the Manager's verdict on a plan line is the recommendation for it. Approving records intent only; nothing here places a trade." />
          {[...linkedIdeas, ...otherIdeas].map((idea) => {
            const planLine = idea.plan_class ? planByClass[idea.plan_class] : null;
            return (
            <div key={idea.id} className="idea">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 15 }}>{idea.title}</strong>{idea.tickers.map((tk) => <span className="badge info" key={tk}>{tk}</span>)}<span className="fine">horizon: {idea.horizon}</span></div>
              {planLine && (
                <p className="note" style={{ marginTop: 4 }}>
                  <span className={`badge ${STANCE_BADGE[idea.stance] || ""}`}>{idea.stance === "endorse" ? "Endorses the plan" : idea.stance === "modify" ? "Modifies the plan" : idea.stance === "oppose" ? "Opposes the plan" : "On the plan"}</span>{" "}
                  Plan line: {actionWord(planLine)} {planLine.label} ({planLine.vehicle}) · current {money(planLine.current)} → target {money(planLine.target)} · Δ {deltaTxt(planLine.delta)}
                  {planLine.tax?.kind === "sale" ? <> · est. tax {money(planLine.tax.est_tax_long_term)} LT / {money(planLine.tax.est_tax_short_term)} ST</> : null}
                </p>
              )}
              <p className="note">{moneyText(idea.analyst_notes)}</p>
              <div className="idea-grid">
                <div><strong>Bull</strong>{moneyText(idea.bull)}</div>
                <div><strong>Bear</strong>{moneyText(idea.bear)}</div>
                <div><strong>Risk</strong>{moneyText(idea.risk)}</div>
                <div><strong>Manager</strong>{moneyText(idea.manager_verdict)}</div>
              </div>
              <DecisionButtons itemId={`idea:${idea.id}`} initial={decById[`idea:${idea.id}`]} configured={configured} />
            </div>
            );
          })}
          {uncoveredPlan.map((r) => (
            <div key={`uncovered-${r.class}`} className="idea">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 15 }}>{actionWord(r)} {r.label} — from the plan</strong><span className="badge info">{r.vehicle}</span></div>
              <p className="note">
                The analyst has not weighed in on this line yet (last analyst run {fmtDate(p.ideas_as_of)}). This is the plan&apos;s computed action: {actionWord(r).toLowerCase()} {money(Math.abs(r.delta))} of {r.vehicle} — current {money(r.current)} → target {money(r.target)}.
                {r.tax?.kind === "sale" ? <> Selling realizes ≈{money(Math.abs(r.tax.est_gain_loss))} of gains — est. tax {money(r.tax.est_tax_long_term)} if long-term, {money(r.tax.est_tax_short_term)} if short-term.</> : null}
              </p>
              <DecisionButtons itemId={`plan:${r.class}`} initial={decById[`plan:${r.class}`]} configured={configured} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Accounts &amp; positions</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Account</th><th>Owner</th><th className="r">Value</th><th>Status</th></tr></thead>
          <tbody>
            {p.accounts.map((acc) => (
              <tr key={acc.account}>
                <td>{acc.account}
                  <div className="note">{acc.positions.map((pos) => `${pos.symbol} ${money(pos.value)}`).join(" · ")}</div>
                </td>
                <td>{acc.owner}</td>
                <td className="r">{money(acc.value)}</td>
                <td>{acc.mapped ? (acc.actionable === "yes" ? <span className="badge accent">Actionable</span> : <span className="badge good">Mapped</span>) : <span className="badge warn">Funds not on file</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {p.unmapped.length > 0 && (
          <p className="note">
            To complete the whole-portfolio picture, the fund names are needed for: {p.unmapped.map((u) => `${u.account} (${money(u.value)})`).join(", ")}.
            One statement or portal screenshot per account is enough to complete the map.
          </p>
        )}
      </div>
    </>
  );
}
