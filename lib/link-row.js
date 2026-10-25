"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { navStart } from "./client-events";

// A table row that opens its drill-down (filtered transactions). The name
// is a real link for keyboard and screen readers; the rest of the row
// forwards clicks to it.
export default function LinkRow({ href, name, title, sub = null, className = "", children }) {
  const router = useRouter();
  return (
    <tr className={`row-link ${className}`} onClick={(e) => {
      if (e.target.closest("a")) return;
      navStart();
      router.push(href);
    }}>
      <td>
        <Link className="row-link-name" href={href} title={title}>{name}<Icon name="chevronRight" size={14} /></Link>
        {sub}
      </td>
      {children}
    </tr>
  );
}
