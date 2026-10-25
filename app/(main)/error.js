"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "../../lib/icons";

// Friendly failure screen for any page in the app; the shell stays put.
export default function PageError({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="state-screen">
      <span className="state-icon bad"><Icon name="alert" size={22} /></span>
      <h1>Something went wrong loading this page</h1>
      <p className="note">Your data is safe — nothing was changed. This is usually a temporary hiccup reaching the data store.</p>
      <div className="state-actions">
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
        <Link className="btn ghost" href="/">Back to dashboard</Link>
      </div>
      {error?.digest && <p className="fine">Reference {error.digest}</p>}
    </div>
  );
}
