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

      {/* Relationship Audit Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Relationship Audit (IB9)</h3>
        {status.runtime.relationshipAudit.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Total edges: <strong>{status.runtime.relationshipAudit.totalEdges}</strong></p>
            <p className={`font-semibold ${status.runtime.relationshipAudit.healthScore >= 80 ? 'text-green-700' : status.runtime.relationshipAudit.healthScore >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
              Health score: <strong>{status.runtime.relationshipAudit.healthScore.toFixed(1)}%</strong>
            </p>
            <p>Duplicate edges: <strong>{status.runtime.relationshipAudit.duplicateEdges}</strong></p>
            <p>Orphan references: <strong>{status.runtime.relationshipAudit.orphanReferences}</strong></p>
            <p>Suspicious patterns: <strong>{status.runtime.relationshipAudit.suspiciousPatterns}</strong></p>
            <p>Recommendations: <strong>{status.runtime.relationshipAudit.recommendationsCount}</strong></p>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.relationshipAudit.timestamp ? new Date(status.runtime.relationshipAudit.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.relationshipAudit.reason}</p>
        )}
      </div>

      {/* Insight Generation Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Insight Generation (IB10)</h3>
        {status.runtime.insights.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Insights: <strong>{status.runtime.insights.insightCount}</strong></p>
            <p>Hypotheses: <strong>{status.runtime.insights.hypothesisCount}</strong></p>
            <p>Recommendations: <strong>{status.runtime.insights.recommendationCount}</strong></p>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.insights.timestamp ? new Date(status.runtime.insights.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.insights.reason}</p>
        )}
      </div>

      {/* Proposal Generation Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Proposal Generation (IB11)</h3>
        {status.runtime.proposals.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Total proposals: <strong>{status.runtime.proposals.totalProposals}</strong></p>
            <p className="font-semibold text-blue-700">
              High priority: <strong>{status.runtime.proposals.highPriorityProposals}</strong>
            </p>
            <p>Medium priority: <strong>{status.runtime.proposals.mediumPriorityProposals}</strong></p>
            <p>Low priority: <strong>{status.runtime.proposals.lowPriorityProposals}</strong></p>
            <p className="text-xs mt-2">Categories:</p>
            <div className="text-xs text-slate-600 ml-2 space-y-0.5">
              {Object.entries(status.runtime.proposals.byCategory).map(([category, count]) => (
                <p key={category}>{category}: {count}</p>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${status.runtime.proposals.reportOnly ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>Report-only: {status.runtime.proposals.reportOnly ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${!status.runtime.proposals.writesToMind ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>Writes to Mind: {status.runtime.proposals.writesToMind ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.proposals.timestamp ? new Date(status.runtime.proposals.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.proposals.reason}</p>
        )}
      </div>

      {/* Proposal Approvals */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Proposal Approvals (Decision Records)</h3>
        <div className="mt-2 text-sm text-slate-700 space-y-1">
          <p>Total decisions: <strong>{status.runtime.proposalApprovals.totalDecisions}</strong></p>
          <p>Approved: <strong className="text-green-700">{status.runtime.proposalApprovals.approved}</strong></p>
          <p>Rejected: <strong className="text-red-700">{status.runtime.proposalApprovals.rejected}</strong></p>
          <p>Needs review: <strong className="text-yellow-700">{status.runtime.proposalApprovals.needsReview}</strong></p>
          <p>Applied: <strong>{status.runtime.proposalApprovals.applied}</strong></p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${status.runtime.proposalApprovals.executionBlocked ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>Execution blocked: {status.runtime.proposalApprovals.executionBlocked ? 'Yes' : 'No'}</span>
            </div>
          </div>
          {status.runtime.proposalApprovals.latestDecisionAt && (
            <p className="text-xs text-slate-500 mt-2">
              Latest decision: {new Date(status.runtime.proposalApprovals.latestDecisionAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Pipeline Report */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Report-Only Pipeline</h3>
        {status.runtime.pipeline.available ? (
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <p>Status: <strong className={status.runtime.pipeline.status === 'complete' ? 'text-green-700' : 'text-yellow-700'}>{status.runtime.pipeline.status}</strong></p>
            <p>Steps: <strong>{status.runtime.pipeline.stepCount}</strong> (Failed: <strong>{status.runtime.pipeline.failedStepCount}</strong>)</p>
            <p>Duration: <strong>{status.runtime.pipeline.durationMs}ms</strong></p>
            <p>Last completed: <strong>{status.runtime.pipeline.lastCompletedStep}</strong></p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${status.runtime.pipeline.reportOnly ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>Report-only: {status.runtime.pipeline.reportOnly ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${!status.runtime.pipeline.writesToMind ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>Writes to Mind: {status.runtime.pipeline.writesToMind ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${!status.runtime.pipeline.continuousRuntime ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>Continuous: {status.runtime.pipeline.continuousRuntime ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {status.runtime.pipeline.timestamp ? new Date(status.runtime.pipeline.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-2">{status.runtime.pipeline.reason}</p>
        )}
      </div>
    </div>
  );
}
