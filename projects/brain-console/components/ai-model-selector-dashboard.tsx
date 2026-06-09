'use client';

import { useQuery } from '@tanstack/react-query';
import { BrainCircuit } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import { aiModelSelectorHealthMatrixSchema } from '@/lib/braincore-schemas';
import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

type MatrixModelView = {
  selectable: boolean;
  status: string;
  enabled: boolean;
  last_checked_at?: number | null;
  probe: {
    status: string;
    checked_at?: number | null;
  };
  cost: {
    input_per_1m?: number | null;
    output_per_1m?: number | null;
  };
  capabilities?: string[];
};

function statusFor(model: MatrixModelView): 'fresh' | 'stale' | 'unavailable' {
  if (model.selectable && model.status === 'ok') return 'fresh';
  if (!model.enabled || model.status === 'disabled') return 'stale';
  return 'unavailable';
}

function checkedAt(model: MatrixModelView): string {
  const timestamp = model.probe.checked_at ?? model.last_checked_at;
  if (!timestamp) return 'not checked';
  return timeAgo(new Date(timestamp * 1000).toISOString());
}

function costLabel(model: MatrixModelView): string {
  const input = model.cost.input_per_1m;
  const output = model.cost.output_per_1m;
  if (typeof input !== 'number' || typeof output !== 'number') return 'local/free';
  return `$${input}/$${output}`;
}

export function AiModelSelectorDashboard() {
  const matrix = useQuery({
    queryKey: ['ai-model-selector-health-matrix'],
    queryFn: () => brainCoreRequest('/ai-model-selector/health-matrix', aiModelSelectorHealthMatrixSchema, { timeoutMs: 12_000 }),
    refetchInterval: 30_000,
  });

  const models = matrix.data?.models ?? [];
  const selectable = models.filter((model) => model.selectable).length;
  const unavailable = models.filter((model) => !model.selectable && model.enabled).length;

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">AI Model Selector</div>
          <h1>Model health matrix</h1>
          <p>Brain Core reads the selector health matrix. Apps request routes from the selector and do not probe providers directly.</p>
        </div>
        <div className="row">
          <StatusBadge status={matrix.isError ? 'error' : matrix.data?.status === 'ok' ? 'fresh' : 'stale'} label={matrix.isError ? 'unavailable' : matrix.data?.probe_mode ?? 'checking'} />
          <span className="meta">Refreshes every 30 seconds</span>
        </div>
      </section>

      {matrix.error ? (
        <div className="card">
          <div className="card-title">Health matrix unavailable</div>
          <p>Brain Core could not read `/ai-model-selector/health-matrix`.</p>
        </div>
      ) : null}

      <section className="grid cards">
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Selectable models</div>
              <div className="card-description">Available through selector routing</div>
            </div>
            <BrainCircuit size={18} />
          </div>
          <div className="metric">{selectable}</div>
          <div className="meta">{matrix.data?.selector.model_count ?? 0} configured models</div>
        </article>
        <article className="card">
          <div className="card-title">Providers</div>
          <div className="metric">{matrix.data?.selector.provider_count ?? 0}</div>
          <div className="meta">Selector port {matrix.data?.selector.port ?? 4890}</div>
        </article>
        <article className="card">
          <div className="card-title">Unavailable enabled models</div>
          <div className="metric">{unavailable}</div>
          <div className="meta">Updated {matrix.data ? timeAgo(matrix.data.generated_at) : 'never'}</div>
        </article>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Probe</th>
              <th>Capabilities</th>
              <th>Cost in/out 1M</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={`${model.provider_id}:${model.model_id || model.model_key}`}>
                <td>
                  <div className="card-title">{model.label}</div>
                  <div className="meta">{model.model_id || model.model_key}</div>
                </td>
                <td>
                  <div>{model.provider_id}</div>
                  <div className="meta">{model.provider_type}{model.region ? ` · ${model.region}` : ''}</div>
                </td>
                <td><StatusBadge status={statusFor(model)} label={model.status} /></td>
                <td>
                  <div>{model.probe.status}</div>
                  <div className="meta">{checkedAt(model)}</div>
                </td>
                <td>{(model.capabilities ?? []).slice(0, 3).join(', ') || 'none'}</td>
                <td>{costLabel(model)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
