import { PageHeader } from "../../../lib/ui";

export default function AskPage() {
  return (
    <>
      <PageHeader title="Ask" subtitle="Static demo page" />
      <div className="card">
        <h2>Ask is disabled in this demo.</h2>
        <p className="note">This public build makes no external AI calls and does not save questions or instructions.</p>
      </div>
    </>
  );
}
