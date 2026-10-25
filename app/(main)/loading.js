// Instant placeholder while a page's server data loads (shown on every
// sidebar click, then swapped for the real page).
export default function Loading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-subtitle" />
      <div className="cards">
        {[0, 1, 2, 3].map((i) => (
          <div className="card stat" key={i}><div className="sk sk-line short" /><div className="sk sk-value" /><div className="sk sk-line" /></div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="card span-8"><div className="sk sk-line short" /><div className="sk sk-chart" /></div>
        <div className="card span-4"><div className="sk sk-line short" />{[0, 1, 2, 3, 4].map((i) => <div className="sk sk-row" key={i} />)}</div>
      </div>
    </div>
  );
}
