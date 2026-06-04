import { BRAIN_CORE_URL } from '@/lib/braincore-client';

export default function SettingsPage() {
  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Console configuration</h1>
          <p>Brain Console Center is intentionally thin. Operational state and actions belong to Brain Core.</p>
        </div>
      </section>

      <section className="grid cards">
        <article className="card">
          <div className="card-title">Brain Core URL</div>
          <div className="metric" style={{ fontSize: 22 }}>{BRAIN_CORE_URL}</div>
          <p>Override with <code>NEXT_PUBLIC_BRAIN_CORE_URL</code> when running the console.</p>
        </article>
        <article className="card">
          <div className="card-title">Dashboard port</div>
          <div className="metric">4881</div>
          <p>Brain Console Web remains separate on its legacy port while migration proceeds.</p>
        </article>
        <article className="card">
          <div className="card-title">Safety boundary</div>
          <p>The browser never executes shell commands, never reads local files directly, and never exposes YouTube publishing controls in Phase 1.</p>
        </article>
      </section>

      <section className="card">
        <div className="card-title">Legacy dashboard policy</div>
        <p>ProBot dashboard, Brain Console Obsidian, and Brain Console Web are legacy references only. New dashboard work belongs in Brain Console Center and must consume Brain Core API surfaces.</p>
      </section>
    </div>
  );
}
