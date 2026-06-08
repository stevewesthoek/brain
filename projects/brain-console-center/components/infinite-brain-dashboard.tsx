'use client';

import { useEffect, useState } from 'react';

import { brainCoreRequest } from '../lib/braincore-client';
import { infiniteBrainStatusSchema, type InfiniteBrainStatus } from '../lib/braincore-schemas';

export function InfiniteBrainDashboard() {
  const [status, setStatus] = useState<InfiniteBrainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const data = await brainCoreRequest('/infinite-brain/status', infiniteBrainStatusSchema);
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Infinite Brain Runtime</h2>
        <p className="text-sm text-slate-500 mt-2">Loading...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <h2 className="text-lg font-semibold text-red-900">Infinite Brain Runtime</h2>
        <p className="text-sm text-red-600 mt-2">{error || 'Failed to load status'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Infinite Brain Runtime</h2>
        <p className="text-xs text-slate-500 mt-1">
          Updated: {new Date(status.timestamp).toLocaleTimeString()}
        </p>

        {/* Safety Flags */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${!status.safety.writesToMind ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-slate-700">Writes to Mind: {status.safety.writesToMind ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${!status.safety.continuousRuntime ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-slate-700">Continuous: {status.safety.continuousRuntime ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${!status.safety.modelFallbackHardcoded ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-slate-700">Model Fallback: {status.safety.modelFallbackHardcoded ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${status.safety.iosSyncCoordination ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-slate-700">iOS Sync: {status.safety.iosSyncCoordination ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {/* Mind Write Readiness */}
        <div className="mt-4 p-2 bg-yellow-50 rounded border border-yellow-200">
          <p className="text-xs font-semibold text-yellow-900">Mind Write Readiness</p>
          <p className="text-xs text-yellow-700 mt-1">Status: {status.readiness.mindWriteReady ? '✓ Ready' : '✗ Blocked'}</p>
          <p className="text-xs text-yellow-700">{status.readiness.reason}</p>
        </div>
      </div>

      {/* Atomizer Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Atomizer Analysis</h3>
        {status.runtime.atomizer.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Files analyzed: <strong>{status.runtime.atomizer.filesAnalyzed}</strong></p>
            <p>Keep atomic: <strong>{status.runtime.atomizer.keepAtomic}</strong></p>
            <p>Split candidates: <strong>{status.runtime.atomizer.considerSplit}</strong></p>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.atomizer.timestamp ? new Date(status.runtime.atomizer.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.atomizer.reason}</p>
        )}
      </div>

      {/* Classifier Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Entity Classification</h3>
        {status.runtime.classifier.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Total files: <strong>{status.runtime.classifier.totalFiles}</strong></p>
            <p>With existing type: <strong>{status.runtime.classifier.withExistingType}</strong></p>
            <p>Inferred: <strong>{status.runtime.classifier.inferred}</strong></p>
            <p>Needs atomization: <strong>{status.runtime.classifier.needsAtomization}</strong></p>
            <p>Avg confidence: <strong>{((status.runtime.classifier.avgConfidence || 0) * 100).toFixed(1)}%</strong></p>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.classifier.timestamp ? new Date(status.runtime.classifier.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.classifier.reason}</p>
        )}
      </div>

      {/* Edge Inference Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Edge Inference</h3>
        {status.runtime.edges.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Total entities: <strong>{status.runtime.edges.totalEntities}</strong></p>
            <p>Total inferred edges: <strong>{status.runtime.edges.totalInferredEdges}</strong></p>
            <p>High-confidence edges: <strong>{status.runtime.edges.highConfidenceEdges}</strong></p>
            <p>Review candidates: <strong>{status.runtime.edges.candidates}</strong></p>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.edges.timestamp ? new Date(status.runtime.edges.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.edges.reason}</p>
        )}
      </div>
    </div>
  );
}
