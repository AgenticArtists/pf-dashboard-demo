// Sidebar sections — also the page list in the command palette.
export const SECTIONS = [
  [null, [
    ["/", "Dashboard", "dashboard"],
    ["/accounts", "Accounts", "accounts"],
    ["/cards", "Cards", "card"],
    ["/transactions", "Transactions", "transactions"],
    ["/cash-flow", "Cash flow", "cashflow"],
    ["/spending", "Spending", "spending"],
    ["/income", "Income", "income"],
    ["/budgets", "Budgets", "budgets"],
    ["/subscriptions", "Recurring", "recurring"],
    ["/savings", "Savings cuts", "cash"],
    ["/investments", "Investments", "investments"],
  ]],
  ["Planning", [
    ["/scenarios", "Scenarios", "sparkle"],
    ["/briefing", "Monthly briefing", "briefing"],
    ["/tax", "Taxes", "taxes"],
    ["/benefits", "Benefits", "benefits"],
    ["/healthcare", "Healthcare", "benefits"],
    ["/enrollment", "Open enrollment", "enrollment"],
    ["/decisions", "Decisions & theses", "briefing"],
    ["/deadlines", "Deadlines", "calendar"],
  ]],
  ["Household", [
    ["/ask", "Ask a Question", "ask"],
    ["/records", "Records", "records"],
    ["/about", "Sources & methods", "info"],
  ]],
  ["Quick Reference Guides", [
    ["/guides", "All guides", "info"],
    ["/guides/which-card", "Which card do I use?", "card"],
    ["/guides/where-we-buy-things", "Where we buy things", "cash"],
    ["/guides/urgent-care", "Urgent care front door", "alert"],
  ]],
];

// Compact sidebar destinations. SECTIONS remains the complete command-palette page list.
export const NAV = [
  ["/", "Dashboard", "dashboard", ["/"]],
  ["/transactions", "Money", "transactions", ["/transactions", "/spending", "/income", "/cash-flow"]],
  ["/budgets", "Budgets", "budgets", ["/budgets", "/savings"]],
  ["/subscriptions", "Recurring", "recurring", ["/subscriptions"]],
  ["/accounts", "Accounts", "accounts", ["/accounts", "/cards"]],
  ["/investments", "Investments", "investments", ["/investments"]],
  ["/scenarios", "Plan", "sparkle", ["/scenarios", "/briefing", "/tax", "/benefits", "/healthcare", "/enrollment", "/decisions"]],
  ["/records", "Records", "records", ["/records", "/deadlines"]],
  ["/guides", "Guides", "info", ["/guides"]],
];

const moneyTabs = [["/transactions", "Transactions"], ["/spending", "Spending"], ["/income", "Income"], ["/cash-flow", "Cash flow"]];
const budgetTabs = [["/budgets", "Plan"], ["/savings", "Savings cuts"]];
const accountTabs = [["/accounts", "Balances"], ["/cards", "Cards"]];
const planTabs = [["/scenarios", "Scenarios"], ["/briefing", "Monthly briefing"], ["/tax", "Taxes"], ["/benefits", "Benefits"], ["/healthcare", "Healthcare"], ["/enrollment", "Open enrollment", { seasonal: true }], ["/decisions", "Decisions"]];
const recordsTabs = [["/records", "Records"], ["/deadlines", "Deadlines"]];
const guidesTabs = [["/guides", "All guides"], ["/guides/which-card", "Which card do I use?"], ["/guides/where-we-buy-things", "Where we buy things"], ["/guides/urgent-care", "Urgent care front door"]];

export const TABS = {
  "/transactions": moneyTabs,
  "/spending": moneyTabs,
  "/income": moneyTabs,
  "/cash-flow": moneyTabs,
  "/budgets": budgetTabs,
  "/savings": budgetTabs,
  "/accounts": accountTabs,
  "/cards": accountTabs,
  "/scenarios": planTabs,
  "/briefing": planTabs,
  "/tax": planTabs,
  "/benefits": planTabs,
  "/healthcare": planTabs,
  "/enrollment": planTabs,
  "/records": recordsTabs,
  "/deadlines": recordsTabs,
  "/guides": guidesTabs,
  "/guides/which-card": guidesTabs,
  "/guides/where-we-buy-things": guidesTabs,
  "/guides/urgent-care": guidesTabs,
};
