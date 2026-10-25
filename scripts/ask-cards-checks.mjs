import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { SYSTEM_PROMPT, ADVISOR_SYSTEM_PROMPT, TRIAGE_PROMPT, buildAskContext, buildAdvisorContext } = await import("../lib/ask-core.js");

const readData = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));

// Demo card facts live in the data files, not in any prompt: the demo
// ask-core is inert and builds its context only from five named files.
const accounts = readData("accounts.json");
const bluebonnet = accounts.find((a) => a.id === "card-a");
assert.equal(bluebonnet.name, "Bluebonnet Rewards Card", "demo joint card name");
assert.equal(bluebonnet.mask, "5183", "demo joint card mask");
assert.equal(bluebonnet.institution, "Bluebonnet Credit Union", "demo joint card institution");
assert.equal(bluebonnet.owner, "Joint", "demo joint card owner");
assert.equal(bluebonnet.dashboard_value, 4992.98, "demo joint card balance");
const cedar = accounts.find((a) => a.id === "card-b");
assert.equal(cedar.name, "Cedar Cash Card", "demo personal card name");
assert.equal(cedar.mask, "7264", "demo personal card mask");
assert.equal(cedar.institution, "Cedar Bank", "demo personal card institution");
assert.equal(cedar.owner, "Daniel", "demo personal card owner");
assert.equal(cedar.dashboard_value, 812.12, "demo personal card balance");

// The demo card policy text names the same two fictional cards and roles.
const policy = readData("card_policy.json");
assert.ok(policy.text.startsWith("Demo card policy (fictional):"), "card policy is labelled fictional demo text");
assert.ok(policy.text.includes("the Bluebonnet Rewards Card is the joint card for groceries and streaming"), "policy assigns the joint card to groceries and streaming");
assert.ok(policy.text.includes("the Cedar Cash Card is Daniel's card for fuel and dining"), "policy assigns Daniel's card to fuel and dining");
assert.ok(policy.text.includes("Card payments are made from joint checking on the 27th."), "policy states the payment account and day");
assert.ok(policy.text.includes("No real card program terms are described here."), "policy disclaims real card terms");

// ask-core in the demo: all prompts are the same disabled notice, and the
// context builder requests exactly five data files — card_policy.json is
// not one of them, so no card policy is ever injected into a prompt.
assert.equal(SYSTEM_PROMPT, "Ask is disabled in this public synthetic-data demo.");
assert.equal(ADVISOR_SYSTEM_PROMPT, SYSTEM_PROMPT, "advisor prompt is the same disabled notice");
assert.equal(TRIAGE_PROMPT, SYSTEM_PROMPT, "triage prompt is the same disabled notice");

const requested = [];
const stubData = (name) => {
  requested.push(name);
  if (name === "accounts.json") return accounts;
  return null;
};
const context = buildAskContext(stubData);
assert.deepEqual(requested, ["meta.json", "accounts.json", "budgets.json", "income_2026.json", "portfolio.json"], "context builder reads exactly the five demo files");
assert.ok(!context.includes("card_policy"), "context never mentions the card policy file");
assert.ok(context.includes("Bluebonnet Rewards Card") && context.includes("5183"), "context carries the demo joint card from accounts data");
assert.ok(context.includes("Cedar Cash Card") && context.includes("7264"), "context carries the demo personal card from accounts data");
assert.ok(context.includes("accounts.json"), "context labels the accounts section by filename");

const advisorContext = buildAdvisorContext(stubData);
assert.equal(advisorContext, context, "advisor context is identical to the simple context in the demo");

console.log("ask cards checks: all passed");
