import { PageHeader } from "../../../lib/ui";

export const dynamic = "force-dynamic";

export default function About() {
  return (
    <>
      <PageHeader title="Sources & methods" subtitle="How the public demo's fictional numbers are assembled." />
      <div className="card prose">
        <p>This public dashboard is a read-only demonstration for Daniel and Maya Carter, a fictional household renting in Austin, Texas, with one young child. Every name, employer, merchant, account, amount, and date is synthetic.</p>
        <h2>Where the numbers come from</h2>
        <p>The generator builds the account snapshot, transaction ledger, payroll deposits, budgets, investment positions, and narrative records from one compact household model. It uses a fixed seed, so the same source produces the same files on every run.</p>
        <p>Pages compute their totals from the generated ledger where possible. Account balances, payroll totals, category totals, and investment values are written from the same model and are checked for reconciliation.</p>
        <h2>How spending is sorted</h2>
        <p>Each synthetic transaction has a category, ledger group, subcategory, person tag, account mask, and essential/discretionary marker. Joint means a shared household cost; Daniel and Maya identify personal ownership. Transfers and card payments are kept out of spending totals.</p>
        <h2>Read-only behavior</h2>
        <p>There is no login requirement, no external data refresh, no AI call, no bank connection, no trade execution, and no write path in the public demo. Mutation endpoints return a disabled response, while the visible pages explain the fictional data directly.</p>
        <h2>Privacy and freshness</h2>
        <p>The files in this repository are generated demo fixtures, not exports or documents from a real household. The date shown in the shell is the fixed synthetic snapshot date, not a live account timestamp.</p>
      </div>
    </>
  );
}
