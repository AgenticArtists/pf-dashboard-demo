import { PageHeader, Stat } from "../../../../lib/ui";

export const dynamic = "force-dynamic";

export default function WhichCardGuide() {
  return (
    <>
      <PageHeader title="Which card do I use?" subtitle="A fictional Carter-household routing guide. Joint purchases use the household card; personal purchases use the matching personal card." />
      <div className="cards">
        <Stat label="Bluebonnet Rewards Card" value="Household purchases" sub="Groceries, dining, child expenses, and shared subscriptions." />
        <Stat label="Cedar Cash Card" value="Personal purchases" sub="A personal allowance card for Daniel or Maya's own spending." />
        <Stat label="Joint checking" value="Bills and transfers" sub="Rent, utilities, insurance, loan payments, and card payments." />
      </div>
      <div className="card">
        <h2>Start with one question</h2>
        <p><strong>Is the purchase for the household or for one person?</strong></p>
        <p className="note">Household groceries, shared meals, childcare, healthcare, and home supplies belong on the Bluebonnet Rewards Card. Personal clothing, hobbies, and individual treats belong on the purchaser's personal card. Rent, utilities, and other scheduled bills stay in the joint checking flow.</p>
      </div>
      <div className="card">
        <h2>Demo decision table</h2>
        <div className="table-scroll"><table><thead><tr><th>Purchase</th><th>Route</th><th>Reason</th></tr></thead><tbody>
          <tr><td>Shared groceries</td><td><strong>Bluebonnet Rewards Card</strong></td><td>Household expense.</td></tr>
          <tr><td>Daniel's hobby purchase</td><td><strong>Daniel personal card</strong></td><td>Individual allowance.</td></tr>
          <tr><td>Maya's personal subscription</td><td><strong>Maya personal card</strong></td><td>Individual allowance.</td></tr>
          <tr><td>Rent or loan payment</td><td><strong>Joint checking</strong></td><td>Scheduled household bill.</td></tr>
        </tbody></table></div>
        <p className="note">This page is fictional guidance for the demo and does not describe real card benefits or coverage.</p>
      </div>
    </>
  );
}
