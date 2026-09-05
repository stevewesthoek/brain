'use client';

import { useEffect } from 'react';

export function RouteError({ error, reset, scope }: { error: Error & { digest?: string }; reset: () => void; scope: string }) {
  useEffect(() => {
    console.error(`[Brain Console] ${scope} route failed`, error);
  }, [error, scope]);

  return (
    <section className="route-error" role="alert" aria-labelledby="route-error-title">
      <div className="eyebrow">Recovery available</div>
      <h1 id="route-error-title">This {scope} view is unavailable</h1>
      <p>The rest of Brain Console remains available. Retry this view or use the primary navigation to continue.</p>
      <div className="row route-error-actions">
        <button type="button" className="button" onClick={() => reset()}>Retry view</button>
        <a className="button secondary" href="/command-center">Open Command Center</a>
      </div>
    </section>
  );
}
