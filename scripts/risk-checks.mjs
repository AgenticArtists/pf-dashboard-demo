import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Risk page, demo data: the synthetic risk.json for the Carter demo
// portfolio (investable $159,200). The current mix weights are the
// portfolio.json allocation; the target mix is 45/20/25/10.
const risk = JSON.parse(readFileSync("data/risk.json", "utf8"));
const portfolio = JSON.parse(readFileSync("data/portfolio.json", "utf8"));
for (const key of ["as_of", "window", "methods", "coverage", "holdings", "class_risk", "backtest"]) {
  assert.ok(Object.hasOwn(risk, key), `risk.json has required top-level key ${key}`);
}
assert.equal(risk.as_of, "2026-10-22", "risk as-of is the demo snapshot date");
assert.deepEqual(risk.window, ["2021-11-01", "2026-10-22"], "risk window is the five demo years");
assert.equal(portfolio.total_investable, 159200, "demo investable total is $159,200");

// Coverage of the risk calculation itself.
assert.equal(risk.coverage.risk_universe_pct, 100, "risk universe covers all mapped dollars");
assert.equal(risk.coverage.priced_pct, 100, "all dollars priced directly");
assert.equal(risk.coverage.proxied_pct, 0, "no proxied dollars");
assert.deepEqual(risk.coverage.excluded, [], "no holdings excluded from the risk calculation");

const contributors = risk.holdings.top_contributors;
assert.equal(contributors.length, 1, "demo has a single top contributor");
assert.ok(contributors.reduce((sum, row) => sum + row.risk_pct, 0) <= 100.5, "top contributor risk sums to no more than 100.5%");
for (const row of contributors) assert.ok(row.risk_pct >= 0 && row.risk_pct <= 100, `${row.symbol} risk contribution is within [0, 100]`);
assert.equal(contributors[0].symbol, "CARTERX", "top contributor is the broad market index");
assert.equal(contributors[0].weight_pct, 30.78, "top contributor weight matches the US equity weight");
assert.equal(contributors[0].risk_pct, 33.5, "top contributor risk share");

// Current and target mixes agree across risk.json and portfolio.json.
for (const mix of ["current", "target"]) {
  const sum = risk.class_risk[mix].reduce((total, row) => total + row.risk_pct, 0);
  assert.ok(Math.abs(sum - 100) <= 1, `${mix} class risk sums to 100% ± 1`);
  const weightSum = risk.class_risk[mix].reduce((total, row) => total + row.weight_pct, 0);
  assert.ok(Math.abs(weightSum - 100) <= 0.1, `${mix} class weights sum to 100% ± 0.1`);
}
for (const [assetClass, expected] of [["us_equity", 45], ["intl_equity", 20], ["bonds", 25], ["cash", 10]]) {
  const row = risk.class_risk.target.find((item) => item.class === assetClass);
  assert.ok(row, `target class risk includes ${assetClass}`);
  assert.ok(Math.abs(row.weight_pct - expected) <= 0.1, `${assetClass} target weight is ${expected}% ± 0.1`);
  assert.equal(portfolio.target.classes_pct[assetClass], expected, `${assetClass} target weight matches portfolio.json`);
  assert.equal(risk.backtest.target.weights_pct[assetClass], expected, `${assetClass} target weight matches the backtest target`);
}
for (const [assetClass, expected] of [["us_equity", 30.78], ["intl_equity", 16.33], ["bonds", 18.84], ["cash", 34.05]]) {
  const row = risk.class_risk.current.find((item) => item.class === assetClass);
  assert.ok(row, `current class risk includes ${assetClass}`);
  assert.ok(Math.abs(row.weight_pct - expected) <= 0.1, `${assetClass} current weight is ${expected}% ± 0.1`);
  assert.equal(portfolio.allocation.pct[assetClass], expected, `${assetClass} current weight matches portfolio.json allocation`);
  assert.equal(risk.backtest.current.weights_pct[assetClass], expected, `${assetClass} current weight matches the backtest current mix`);
  assert.equal(risk.holdings.class_risk_pct[assetClass], row.risk_pct, `${assetClass} holdings class risk mirrors the current mix risk`);
}
assert.equal(risk.coverage.cash_pct, 34.05, "risk coverage cash share is the current cash weight");

// Headline risk statistics.
assert.equal(risk.holdings.ann_vol_pct, 10.4, "current-mix volatility");
assert.equal(risk.holdings.ann_vol_pct, risk.backtest.current.ann_vol_pct, "volatility matches the backtest current mix");
assert.equal(risk.holdings.sharpe, 0.72, "current-mix Sharpe");
assert.equal(risk.holdings.sharpe, risk.backtest.current.sharpe, "Sharpe matches the backtest current mix");
assert.equal(risk.holdings.max_drawdown.pct, -12.3, "max drawdown is -12.3%");
assert.equal(risk.holdings.max_drawdown.peak_month, "2025-12-01", "drawdown peak month");
assert.equal(risk.holdings.max_drawdown.trough_month, "2026-03-01", "drawdown trough month");
assert.equal(risk.holdings.worst_month.pct, -4.1, "worst month is -4.1%");
assert.equal(risk.holdings.worst_month.month, risk.holdings.max_drawdown.trough_month, "worst month is the drawdown trough month");
assert.equal(risk.backtest.current.final_value, 138400, "backtest current-mix final value");
assert.equal(risk.backtest.target.final_value, 141200, "backtest target-mix final value");

const drawdowns = risk.holdings.drawdown_series;
assert.equal(drawdowns.length, 60, "drawdown series covers 60 months");
assert.ok(drawdowns.length >= 48, "drawdown series has at least 48 points");
for (const point of drawdowns) assert.ok(point.dd <= 0.05, `${point.m} drawdown is no greater than 0.05%`);
for (const point of drawdowns) assert.ok(point.dd <= 0, `${point.m} drawdown is never positive`);
const minDrawdown = Math.min(...drawdowns.map((point) => point.dd));
assert.ok(Math.abs(minDrawdown - risk.holdings.max_drawdown.pct) <= 0.1, "drawdown series minimum matches max drawdown ± 0.1");
assert.equal(drawdowns.at(-1).dd, -2, "drawdown series ends recovered to -2%");

const growth = risk.backtest.growth;
assert.equal(growth.length, 60, "backtest growth covers 60 months");
assert.ok(growth.length >= 48, "backtest growth has at least 48 points");
assert.equal(growth[0].current, 100000, "backtest starts the current mix at $100,000");
assert.equal(growth[0].target, 100000, "backtest starts the target mix at $100,000");
const lastGrowth = growth.at(-1);
assert.ok(Math.abs(lastGrowth.current - risk.backtest.current.final_value) <= 1, "last current growth point matches final value ± $1");
assert.ok(Math.abs(lastGrowth.target - risk.backtest.target.final_value) <= 1, "last target growth point matches final value ± $1");

const page = readFileSync("app/(main)/investments/page.js", "utf8");
assert.ok(page.includes('data("risk.json")'), "investments page loads risk.json");
assert.ok(page.includes("Risk — the last five years at today's weights"), "investments page contains the risk card title");
assert.ok(page.includes("Backtest — current mix vs the"), "investments page contains the backtest card title");
assert.ok(page.includes("How to read this:"), "risk card carries the dynamic explainer copy");
assert.ok(page.includes("What this shows:"), "backtest card carries the dynamic explainer copy");
assert.ok(page.includes("ExplainerText"), "explainer copy renders through the click-to-define component");

console.log("risk checks passed");
