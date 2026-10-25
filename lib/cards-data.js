import { data, money, num } from "./data";

const r2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function cardTransactions(mask, year) {
  return data(`transactions_${year}.json`).filter((row) => row.m === mask && row.c !== "Card Payments");
}

function summarize(rows) {
  const charges = rows.filter((row) => num(row.a) > 0);
  const refunds = rows.filter((row) => num(row.a) < 0);
  return {
    count: charges.length,
    spend: r2(charges.reduce((sum, row) => sum + num(row.a), 0)),
    refunds: r2(Math.abs(refunds.reduce((sum, row) => sum + num(row.a), 0))),
    net: r2(rows.reduce((sum, row) => sum + num(row.a), 0)),
  };
}

export function buildCardsData() {
  const accounts = data("accounts.json");
  const records = data("records.json");
  const masks = new Set(
    [...data("transactions_2025.json"), ...data("transactions_2026.json")]
      .filter((row) => row.c !== "Card Payments" && num(row.a) > 0)
      .map((row) => row.m),
  );
  const cards = accounts
    .filter((account) => account.kind === "liability" && masks.has(account.mask) && !/\bloan\b/i.test(account.name))
    .map((account) => {
      const byYear = {};
      for (const year of ["2025", "2026"]) byYear[year] = summarize(cardTransactions(account.mask, year));
      return {
        name: account.name,
        institution: account.institution,
        mask: account.mask,
        owner: account.owner || "Unknown",
        balance: num(account.dashboard_value),
        source: account.source_of_truth,
        byYear,
      };
    });

  const apple = records.apple || {};
  const appleStatements = Array.isArray(apple.statements) ? apple.statements : [];
  const apple2025 = appleStatements.filter((statement) => statement.year === 2025);
  const apple2026 = appleStatements.filter((statement) => statement.year === 2026);
  const statementSummary = (statements) => ({
    count: statements.reduce((count, statement) => count + num(statement.charge_count), 0),
    spend: r2(statements.reduce((sum, statement) => sum + num(statement.charges), 0)),
    refunds: 0,
    net: r2(statements.reduce((sum, statement) => sum + num(statement.charges), 0)),
  });
  cards.push({
    name: "Carter Digital Card",
    institution: "Cedar Bank",
    mask: "",
    owner: "Joint",
    balance: num(apple.current?.balance_sep_30_2026),
    source: "Synthetic digital-card statements",
    byYear: { 2025: statementSummary(apple2025), 2026: statementSummary(apple2026) },
    due: apple.current?.due,
    minimumPayment: num(apple.current?.minimum_payment),
    statementAsOf: apple.as_of,
  });

  return {
    cards: cards.sort((a, b) => b.balance - a.balance),
    asOf: records.apple?.as_of || "",
    totals: {
      balance: r2(cards.reduce((sum, card) => sum + card.balance, 0)),
      spend2025: r2(cards.reduce((sum, card) => sum + card.byYear[2025].spend, 0)),
      spend2026: r2(cards.reduce((sum, card) => sum + card.byYear[2026].spend, 0)),
    },
  };
}

export { money };
