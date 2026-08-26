'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { brainCoreRequest } from '@/lib/braincore-client';
import { infrastructureStatusSchema } from '@/lib/infrastructure-schemas';
import { StatusBadge } from '@/components/status-badge';
import { CanonicalInfrastructureTelemetry } from '@/components/canonical-infrastructure-telemetry';

function tone(value: 'fresh' | 'stale' | 'unknown'): 'fresh' | 'stale' | 'unknown' {
  return value;
}

function runtimeTone(value: 'ok' | 'missing' | 'invalid'): 'fresh' | 'unknown' | 'error' {
  if (value === 'ok') return 'fresh';
  return value === 'missing' ? 'unknown' : 'error';
}

export function InfrastructureDashboard() {
  const status = useQuery({
    queryKey: ['infrastructure-plane-status'],
    queryFn: () => brainCoreRequest('/infra/status', infrastructureStatusSchema, { timeoutMs: 12_000 }),
    refetchInterval: 15_000,
  });

  const resources = useMemo(
    () => [...(status.data?.catalog.resources ?? [])].sort((left, right) => left.resourceId.localeCompare(right.resourceId)),
    [status.data?.catalog.resources],
  );
  const backups = status.data?.backups.backupPolicies ?? [];
  const credentials = status.data?.credentials.credentialReferences ?? [];
  const doctor = status.data?.doctor;

  return (
    <div className="stack">
      <CanonicalInfrastructureTelemetry />
      <section className="page-heading">
        <div>
          <div className="eyebrow">Infrastructure Knowledge & Health Plane</div>
          <h1>Infrastructure</h1>
          <p>Canonical topology, health, incidents, backup state, credential metadata, freshness, provenance, and safety evidence from one read-only IKHP model.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={status.isError ? 'error' : status.isSuccess ? 'fresh' : 'unknown'} label={status.isSuccess ? 'Canonical' : status.isError ? 'Unavailable' : 'Loading'} />
          <span className="meta">Read-only · refreshes every 15 seconds</span>
          <button className="button compact secondary" onClick={() => void status.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {status.isError ? (
        <div className="compact-error">
          <strong>Infrastructure plane failed to load.</strong> Brain Core could not validate `/infra/status`.
        </div>
      ) : null}

      <section className="grid cards">
        <article className="card">
          <div className="card-title">Resources</div>
          <div className="metric">{doctor?.counts.resources ?? '—'}</div>
          <div className="meta">Canonical catalog {doctor?.catalogVersion ?? 'unknown'}</div>
        </article>
        <article className="card">
          <div className="card-title">Relations</div>
          <div className="metric">{doctor?.counts.relations ?? '—'}</div>
          <div className="meta">Shared IDs across API, CLI, MCP, and console</div>
        </article>
        <article className="card">
          <div className="card-title">Active incidents</div>
          <div className="metric">{doctor?.counts.activeIncidents ?? '—'}</div>
          <div className="meta">Runtime: {doctor?.runtime.incidents ?? 'unknown'}</div>
        </article>
        <article className="card">
          <div className="card-title">Safety</div>
          <div className="metric">READ</div>
          <div className="meta">Execution disabled; no actual effects</div>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Runtime state</div>
              <div className="card-description">Missing derived state remains visible as UNKNOWN rather than synthetic health.</div>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead><tr><th>Plane</th><th>Status</th><th>Count</th></tr></thead>
              <tbody>
                <tr><td>Health</td><td>{doctor ? <StatusBadge status={runtimeTone(doctor.runtime.health)} label={doctor.runtime.health} /> : '—'}</td><td className="meta">{doctor?.counts.observations ?? '—'}</td></tr>
                <tr><td>Incidents</td><td>{doctor ? <StatusBadge status={runtimeTone(doctor.runtime.incidents)} label={doctor.runtime.incidents} /> : '—'}</td><td className="meta">{doctor?.counts.activeIncidents ?? '—'}</td></tr>
                <tr><td>Action receipts</td><td>{doctor ? <StatusBadge status={runtimeTone(doctor.runtime.actionReceipts)} label={doctor.runtime.actionReceipts} /> : '—'}</td><td className="meta">{doctor?.counts.actionReceipts ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Freshness & UNKNOWNs</div>
              <div className="card-description">Stale and unresolved evidence remains explicit.</div>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <tbody>
                <tr><td>Fresh resources</td><td className="meta">{doctor?.freshness.fresh ?? '—'}</td></tr>
                <tr><td>Stale resources</td><td className="meta">{doctor?.freshness.stale ?? '—'}</td></tr>
                <tr><td>Unknown freshness</td><td className="meta">{doctor?.freshness.unknown ?? '—'}</td></tr>
                <tr><td>Backup UNKNOWNs</td><td className="meta">{doctor?.counts.unknownBackups ?? '—'}</td></tr>
                <tr><td>Credential expiry UNKNOWNs</td><td className="meta">{doctor?.counts.unknownCredentialExpiry ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Architecture & resource health</div>
            <div className="card-description">Canonical resource IDs, lifecycle, freshness, and provenance.</div>
          </div>
          <span className="meta">{status.data?.topology.relations.length ?? 0} relations</span>
        </div>
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Resource</th><th>Class</th><th>Lifecycle</th><th>Freshness</th><th>Authority</th></tr></thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.resourceId}>
                  <td><div className="card-title">{resource.name}</div><code>{resource.resourceId}</code></td>
                  <td className="meta">{resource.resourceClass}</td>
                  <td className="meta">{resource.lifecycleState}</td>
                  <td><StatusBadge status={tone(resource.freshness)} label={resource.freshness} /></td>
                  <td className="meta">{resource.provenance?.classification ?? 'UNKNOWN'}<br />{resource.provenance?.sourceRef ?? 'no source'}</td>
                </tr>
              ))}
              {resources.length === 0 ? <tr><td colSpan={5}><div className="meta">No canonical resources returned.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="card-header"><div><div className="card-title">Backups / restore state</div><div className="card-description">Canonical policy knowledge, including explicit UNKNOWN fields.</div></div></div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead><tr><th>Policy</th><th>Cadence</th><th>Retention</th></tr></thead>
              <tbody>
                {backups.map((policy, index) => <tr key={policy.policyId ?? `${policy.resourceId ?? 'backup'}-${index}`}><td className="meta">{policy.resourceId ?? policy.backupJobId ?? policy.backupSystemId ?? 'unbound'}</td><td className="meta">{policy.cadence}</td><td className="meta">{policy.retentionRef}</td></tr>)}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div className="card-header"><div><div className="card-title">Credential / OAuth status</div><div className="card-description">Metadata only. Secret-store locations and secret values are excluded.</div></div></div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead><tr><th>Reference</th><th>Provider</th><th>Expiry</th><th>Freshness</th></tr></thead>
              <tbody>
                {credentials.map((credential) => <tr key={credential.credentialRefId}><td><code>{credential.credentialRefId}</code></td><td className="meta">{credential.providerRef ?? 'unknown'}</td><td className="meta">{credential.expiryKnown ? credential.expiresAt ?? 'known/no date' : 'UNKNOWN'}</td><td><StatusBadge status={tone(credential.freshness)} label={credential.freshness} /></td></tr>)}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
