import { PageHeader, Stat } from "../../../../lib/ui";

export const dynamic = "force-dynamic";

export default function UrgentCareGuide() {
  return (
    <>
      <PageHeader title="Urgent care front door" subtitle="A generic fictional example of routing a minor illness through the least costly appropriate care setting." />
      <div className="cards">
        <Stat label="Nurse line" value="First question" sub="Use the fictional plan's nurse line when the right door is unclear." />
        <Stat label="Virtual visit" value="Minor illness" sub="A synthetic example for routine advice and simple prescriptions." />
        <Stat label="Primary care" value="Tests and follow-up" sub="Use a regular clinician when an exam or test is needed." />
        <Stat label="Emergency care" value="Immediate danger" sub="Call emergency services for severe or life-threatening symptoms." />
      </div>
      <div className="card">
        <h2>Start here</h2>
        <div className="table-scroll"><table><thead><tr><th>Situation</th><th>First move</th></tr></thead><tbody>
          <tr><td>Mild cold, rash, or routine question</td><td><strong>Virtual visit or nurse line</strong></td></tr>
          <tr><td>Needs an exam, test, or follow-up</td><td><strong>Primary care</strong></td></tr>
          <tr><td>Severe symptoms or immediate danger</td><td><strong>Emergency care</strong></td></tr>
          <tr><td>Not sure which row applies</td><td><strong>Nurse line</strong></td></tr>
        </tbody></table></div>
      </div>
      <div className="card">
        <h2>Demo disclaimer</h2>
        <p className="note">This page contains fictional guidance only. It is not medical advice, does not name real providers, and does not represent a real insurance plan or claim.</p>
      </div>
    </>
  );
}
