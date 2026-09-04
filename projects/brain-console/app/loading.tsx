export default function Loading() {
  return (
    <section className="route-loading" aria-live="polite" aria-label="Loading Brain Console page">
      <div className="route-loading-heading">
        <span className="skeleton skeleton-eyebrow" />
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-copy" />
      </div>
      <div className="route-loading-grid">
        <span className="skeleton skeleton-panel" />
        <span className="skeleton skeleton-panel" />
        <span className="skeleton skeleton-panel" />
      </div>
    </section>
  );
}
