import Link from "next/link";
import { PageHeader } from "../../../lib/ui";

export const dynamic = "force-dynamic";

const GUIDES = [
  { href: "/guides/which-card", title: "Which card do I use?", summary: "A fictional routing guide for joint household purchases, personal purchases, and the two demo cards." },
  { href: "/guides/where-we-buy-things", title: "Where we buy things", summary: "Synthetic Carter-household shopping rules for staples, fresh food, subscriptions, and one-off purchases." },
  { href: "/guides/urgent-care", title: "Urgent care front door", summary: "A generic fictional care-routing example: nurse line, virtual visit, primary care, urgent care, or emergency care." },
];

export default function Guides() {
  return (
    <>
      <PageHeader title="Quick Reference Guides" subtitle="Fictional household rules included to demonstrate the guide layout." />
      {GUIDES.map((g) => (
        <div className="card" key={g.href}>
          <h2><Link href={g.href}>{g.title}</Link></h2>
          <p className="note">{g.summary}</p>
        </div>
      ))}
    </>
  );
}
