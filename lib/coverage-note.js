// Coverage caveat components (P3-21). Split from lib/coverage.js so the
// helpers module stays JSX-free for the node check suites.

// The standard caveat, in the site's note style. Render it adjacent to any
// block that compares the current year against the prior year; `extra`
// appends a surface-specific sentence (e.g. the person note).
export function CoverageNote({ cov, extra }) {
  if (!cov?.caveat) return null;
  return (
    <p className="note">
      <strong>Coverage note:</strong> {cov.caveat}
      {extra ? <> {extra}</> : null}

      {cov.marker_note ? <> {cov.marker_note}</> : null}
    </p>
  );
}

// The † marker for a flagged comparison row. The caveat next to it (via
// CoverageNote) explains what it means.
export function GapMark({ cov }) {
  return <sup title={cov?.marker_note || "Partly a coverage difference — see the coverage note"}>†</sup>;
}
