'use client';

import { useEffect, useState } from 'react';

import { brainCoreRequest } from '@/lib/braincore-client';
import { brainCoreProjectionEnvelopeSchema, type BrainCoreProjectionEnvelope } from '@/lib/braincore-schemas';

const PROJECTIONS = [
  ['health', 'System health'], ['topology', 'Topology'], ['services', 'Services'], ['contracts', 'Contracts'],
  ['ingestion', 'Ingestion'], ['review', 'Review'], ['intelligence', 'Intelligence'], ['calibration', 'Calibration'],
  ['learning', 'Learning'], ['evolution', 'Evolution'], ['promotion', 'Promotion'], ['transactions', 'Transactions'], ['receipts', 'Receipts'],
] as const;

type ProjectionState = { loading: boolean; data?: BrainCoreProjectionEnvelope; error?: string };

const REVIEW_STATES = ['new', 'reviewing', 'accepted', 'rejected', 'deferred', 'archived'] as const;

function reviewCounts(data: BrainCoreProjectionEnvelope | undefined): Record<string, number> | null {
  if (!data || data.projection !== 'infinite-brain-review') return null;
  const projectionData = (data as BrainCoreProjectionEnvelope & { data?: { artifact?: unknown } }).data;
  const artifact = projectionData?.artifact;
  if (!artifact || typeof artifact !== 'object') return null;
  const counts = (artifact as { counts?: unknown }).counts;
  if (!counts || typeof counts !== 'object') return null;
  return Object.fromEntries(REVIEW_STATES.map((state) => [state, typeof (counts as Record<string, unknown>)[state] === 'number' ? (counts as Record<string, number>)[state] : 0]));
}

export function InfiniteBrainProjectionOverview() {
  const [states, setStates] = useState<Record<string, ProjectionState>>({});

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setStates(Object.fromEntries(PROJECTIONS.map(([key]) => [key, { loading: true }])));
      const results = await Promise.all(PROJECTIONS.map(async ([key]) => {
        try {
          const data = await brainCoreRequest(`/projections/${key}`, brainCoreProjectionEnvelopeSchema, { timeoutMs: 5000 });
          return [key, { loading: false, data }] as const;
        } catch (error) {
          return [key, { loading: false, error: error instanceof Error ? error.message : 'Projection unavailable' }] as const;
        }
      }));
      if (!disposed) setStates(Object.fromEntries(results));
    };
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => { disposed = true; clearInterval(interval); };
  }, []);

  return (
    <section className="p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Infinite Brain Projections</h2>
          <p className="text-xs text-slate-500 mt-1">Read-only operational views from Brain Core. Console adds no authority.</p>
        </div>
        <span className="text-xs text-slate-500">Refresh: 30s</span>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PROJECTIONS.map(([key, label]) => {
          const state = states[key];
          const status = state?.loading ? 'loading' : state?.data ? state.data.freshness : 'unavailable';
          const counts = key === 'review' ? reviewCounts(state?.data) : null;
          return (
            <div key={key} className="rounded border border-slate-200 bg-white p-3" data-testid={`projection-${key}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <span className={`text-xs ${state?.data ? 'text-green-700' : state?.loading ? 'text-slate-500' : 'text-red-700'}`}>{status}</span>
              </div>
              {counts ? (
                <div className="mt-2 text-xs text-slate-600" aria-label="Human review queue summary">
                  <p><strong>{(counts.new ?? 0) + (counts.reviewing ?? 0) + (counts.deferred ?? 0)}</strong> need attention</p>
                  <p className="text-slate-500">{counts.accepted ?? 0} accepted · {counts.rejected ?? 0} rejected · {counts.archived ?? 0} archived</p>
                  <p className="mt-1 text-slate-500">Decisions remain human-gated.</p>
                </div>
              ) : state?.data ? <p className="mt-1 text-xs text-slate-500">{state.data.authorityOwner} · {state.data.provenance.sourceReferences.length} source{state.data.provenance.sourceReferences.length === 1 ? '' : 's'}</p> : state?.error ? <p className="mt-1 text-xs text-red-600">Unavailable; retrying with Brain Core.</p> : <p className="mt-1 text-xs text-slate-500">Loading projection…</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
