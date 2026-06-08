'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

import { brainCoreRequest, postBrainCoreAction } from '../lib/braincore-client';
import { infiniteBrainProposalsResponseSchema, infiniteBrainProposalApprovalDecisionResponseSchema, infiniteBrainApplicationPlanGenerateResponseSchema, infiniteBrainApplicationPlanSummaryResponseSchema, infiniteBrainExecutionReadinessFullReportSchema, infiniteBrainExecutorDryRunGenerateResponseSchema, infiniteBrainExecutorDryRunSummaryResponseSchema, type InfiniteBrainProposal, type InfiniteBrainProposalApprovalDecisionResponse, type InfiniteBrainExecutionReadinessCheck } from '../lib/braincore-schemas';

interface ApplicationPlanPreview {
  ok: boolean;
  plan?: {
    planId: string;
    generatedAt: string;
    status: string;
    totalApprovedProposals: number;
    totalPlannedSteps: number;
    stepCount: number;
  };
  safety?: {
    writesToMind: boolean;
    appliesProposals: boolean;
    executionBlocked: boolean;
    previewOnly: boolean;
  };
}

type ProposalWithDecision = InfiniteBrainProposal & {
  approvalDecision?: 'approved' | 'rejected' | 'needs-review';
  approvalDecidedAt?: string;
};

export function InfiniteBrainProposalReview() {
  const [proposals, setProposals] = useState<ProposalWithDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithDecision | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'needs-review' | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<InfiniteBrainProposalApprovalDecisionResponse | null>(null);

  async function fetchProposals() {
    try {
      const data = await brainCoreRequest('/infinite-brain/proposals', infiniteBrainProposalsResponseSchema);
      const top20 = (data.proposals ?? []).slice(0, 20);
      setProposals(top20);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProposals();
  }, []);

  async function handleSubmitDecision(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedProposal || !decision || !reason.trim()) {
      setSubmitError('Please select a proposal, decision, and provide a reason');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const result = await postBrainCoreAction(
        '/infinite-brain/proposals/approvals',
        infiniteBrainProposalApprovalDecisionResponseSchema,
        {
          proposalId: selectedProposal.proposalId,
          decision,
          decidedBy: 'console-ui',
          reason: reason.trim(),
        }
      );

      setSubmitSuccess(result);
      setDecision('');
      setReason('');
      setSelectedProposal(null);

      // Refetch to update UI if there are approval statuses
      await fetchProposals();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Proposal Review</h3>
        <p className="text-sm text-slate-500 mt-2">Loading proposals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-semibold text-red-900">Proposal Review</h3>
        <p className="text-sm text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Proposal Review</h3>
        <p className="text-sm text-slate-500 mt-2">No proposals available</p>
      </div>
    );
  }

  // Group by priority
  const grouped = proposals.reduce(
    (acc, p) => {
      const key = p.priority as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {} as Record<string, ProposalWithDecision[]>
  );

  const priorityOrder = ['high', 'medium', 'low'];

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900">Proposal Review — Decision-Record-Only</h3>
        <p className="text-xs text-blue-700 mt-1">Your decisions are recorded for later review. Proposals are never applied in this phase.</p>
        <div className="mt-2 text-xs text-blue-700 space-y-0.5">
          <p>✓ Decision recorded only</p>
          <p>✓ Proposal not applied</p>
          <p>✓ Mind unchanged</p>
          <p>✓ Execution remains blocked</p>
        </div>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm font-semibold text-green-900">✓ Decision recorded</p>
          <p className="text-xs text-green-700 mt-1">{submitSuccess.message}</p>
          <p className="text-xs text-green-600 mt-1">Proposal remains blocked. Mind unchanged.</p>
        </div>
      )}

      {/* Error message */}
      {submitError && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-semibold text-red-900">Error</p>
          <p className="text-xs text-red-700 mt-1">{submitError}</p>
        </div>
      )}

      {/* Proposal list grouped by priority */}
      {priorityOrder.map((priority) => {
        const list = grouped[priority];
        if (!list || list.length === 0) return null;

        return (
          <div key={priority} className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700 capitalize">
              {priority} Priority ({list.length})
            </h4>
            <div className="space-y-2">
              {list.map((proposal) => (
                <div
                  key={proposal.proposalId}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedProposal?.proposalId === proposal.proposalId
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => {
                    setSelectedProposal(proposal);
                    setDecision('');
                    setReason('');
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-900">{proposal.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{proposal.summary}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {proposal.category}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          Confidence: {(proposal.confidence * 100).toFixed(0)}%
                        </span>
                        {proposal.writesToMindIfApproved && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            Writes to Mind
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="proposal-select"
                      checked={selectedProposal?.proposalId === proposal.proposalId}
                      onChange={() => {}}
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Decision form */}
      {selectedProposal && (
        <form onSubmit={handleSubmitDecision} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Decision for: {selectedProposal.title}
            </label>
            <div className="space-y-2">
              {(['approved', 'rejected', 'needs-review'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    value={opt}
                    checked={decision === opt}
                    onChange={(e) => setDecision(e.target.value as typeof opt)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 capitalize">
                    {opt === 'needs-review' ? 'Needs Review' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your decision..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={!decision || !reason.trim() || submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Submitting...' : 'Record Decision'}
          </button>
        </form>
      )}
    </div>
  );
}

export function InfiniteBrainApplicationPreview() {
  const [planSummary, setPlanSummary] = useState<{
    totalApprovedProposals: number;
    totalPlannedSteps: number;
    executionBlocked: boolean;
    previewOnly: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  async function fetchPlanSummary() {
    try {
      const data = await brainCoreRequest(
        '/infinite-brain/proposals/application-plan/summary',
        infiniteBrainApplicationPlanSummaryResponseSchema
      );
      setPlanSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlanSummary();
  }, []);

  async function handleGeneratePlan() {
    setGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);

    try {
      const response = await postBrainCoreAction(
        '/infinite-brain/proposals/application-plan/generate',
        infiniteBrainApplicationPlanGenerateResponseSchema,
        {}
      );

      if (response.ok) {
        setGenerationSuccess(true);
        await fetchPlanSummary();
      } else {
        setGenerationError('Failed to generate plan');
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Application Plan Preview</h3>
        <p className="text-sm text-slate-500 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900">Application Plan Preview</h3>
            <p className="text-xs text-purple-700 mt-1">
              Generates preview of approved proposals without applying them
            </p>
            <div className="mt-2 text-xs text-purple-700 space-y-0.5">
              <p>✓ Preview only — no proposals applied</p>
              <p>✓ Execution remains blocked</p>
              <p>✓ Mind unchanged</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {generationError && (
          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{generationError}</p>
          </div>
        )}

        {generationSuccess && (
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700">✓ Plan generated successfully</p>
          </div>
        )}

        {planSummary ? (
          <div className="mt-3 space-y-2">
            <div className="bg-white rounded p-2 border border-slate-200 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-600">Approved Proposals</p>
                  <p className="font-semibold text-slate-900">{planSummary.totalApprovedProposals}</p>
                </div>
                <div>
                  <p className="text-slate-600">Planned Steps</p>
                  <p className="font-semibold text-slate-900">{planSummary.totalPlannedSteps}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm font-semibold hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              {generating ? 'Generating...' : 'Regenerate Plan'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="mt-3 w-full px-3 py-2 bg-purple-600 text-white rounded text-sm font-semibold hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {generating ? 'Generating...' : 'Generate Application Preview'}
          </button>
        )}
      </div>
    </div>
  );
}

function getCheckStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pass':
      return { bg: 'bg-green-100', text: 'text-green-700', label: '✓ Pass' };
    case 'blocked':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: '⊘ Blocked' };
    case 'fail':
      return { bg: 'bg-red-100', text: 'text-red-700', label: '✗ Failed' };
    case 'not-applicable':
      return { bg: 'bg-slate-100', text: 'text-slate-700', label: '– N/A' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
  }
}

const BLOCKER_GUIDANCE: Record<string, string> = {
  'Mind write gate available': 'Requires explicit Mind writer implementation and approval gates.',
  'iOS sync safety available': 'Requires verified iOS/Obsidian sync safety before writes.',
  'Allowlisted writer available': 'Requires Brain-owned allowlisted writer; no shell execution.',
  'Operator approval gate': 'Requires explicit operator approval for execution.',
  'Dry-run validation available': 'Requires a completed dry-run validation before execution.',
};

export function InfiniteBrainExecutionReadiness() {
  const [readinessSummary, setReadinessSummary] = useState<{
    available: boolean;
    generatedAt?: string;
    canExecute?: boolean;
    totalSteps?: number;
    blockedSteps?: number;
    blockerCount?: number;
    executionBlocked?: boolean;
  } | null>(null);
  const [fullReport, setFullReport] = useState<{
    reportId: string;
    generatedAt: string;
    applicationPlanId: string | null;
    status: string;
    canExecute: boolean;
    totalSteps: number;
    executableSteps: number;
    blockedSteps: number;
    blockers: string[];
    checks: InfiniteBrainExecutionReadinessCheck[];
    safety: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  async function fetchReadinessSummary() {
    try {
      const data = await brainCoreRequest(
        '/infinite-brain/proposals/execution-readiness/summary',
        z.object({
          ok: z.literal(true),
          summary: z.union([
            z.object({
              available: z.literal(true),
              generatedAt: z.string(),
              canExecute: z.literal(false),
              totalSteps: z.number(),
              blockedSteps: z.number(),
              blockerCount: z.number(),
              executionBlocked: z.literal(true),
            }),
            z.object({
              available: z.literal(false),
              reason: z.string(),
            }),
          ]),
        })
      );
      setReadinessSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load readiness summary');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFullReport() {
    try {
      const data = await brainCoreRequest(
        '/infinite-brain/proposals/execution-readiness',
        infiniteBrainExecutionReadinessFullReportSchema
      );
      setFullReport(data.report);
    } catch (err) {
      // Silently fail if full report not available yet
    }
  }

  useEffect(() => {
    fetchReadinessSummary();
    fetchFullReport();
  }, []);

  async function handleGenerateReadiness() {
    setGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);

    try {
      const response = await postBrainCoreAction(
        '/infinite-brain/proposals/execution-readiness/generate',
        z.object({
          ok: z.literal(true),
          code: z.string(),
          message: z.string(),
          report: z.object({
            reportId: z.string(),
            generatedAt: z.string(),
            status: z.string(),
            canExecute: z.literal(false),
            totalSteps: z.number(),
            blockedSteps: z.number(),
            blockerCount: z.number(),
          }),
          safety: z.object({
            writesToMind: z.literal(false),
            appliesProposals: z.literal(false),
            canExecute: z.literal(false),
            executionBlocked: z.literal(true),
            previewOnly: z.literal(true),
            continuousRuntime: z.literal(false),
            modelCalls: z.literal(false),
          }),
        }),
        {}
      );

      if (response.ok) {
        setGenerationSuccess(true);
        await fetchReadinessSummary();
        await fetchFullReport();
      } else {
        setGenerationError('Failed to generate readiness report');
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate readiness report');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Execution Readiness</h3>
        <p className="text-sm text-slate-500 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">Execution Readiness</h3>
            <p className="text-xs text-amber-700 mt-1">
              Determines whether execution of approved proposals would be allowed
            </p>
            <div className="mt-2 text-xs text-amber-700 space-y-0.5">
              <p>✓ Execution is blocked</p>
              <p>✓ No proposals are applied</p>
              <p>✓ Mind is unchanged</p>
              <p>✓ Preview and readiness checks only</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {generationError && (
          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{generationError}</p>
          </div>
        )}

        {generationSuccess && (
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700">✓ Readiness report generated successfully</p>
          </div>
        )}

        {readinessSummary && readinessSummary.available ? (
          <div className="mt-3 space-y-3">
            <div className="bg-white rounded p-2 border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-600">Can Execute</p>
                  <p className="font-semibold text-red-600">
                    {readinessSummary.canExecute === false ? 'No' : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Status</p>
                  <p className="font-semibold text-amber-600">
                    {readinessSummary.executionBlocked === true ? 'Blocked' : 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-slate-600">Total Steps</p>
                  <p className="font-semibold text-slate-900">{readinessSummary.totalSteps || 0}</p>
                </div>
                <div>
                  <p className="text-slate-600">Blocked Steps</p>
                  <p className="font-semibold text-red-600">{readinessSummary.blockedSteps || 0}</p>
                </div>
                <div>
                  <p className="text-slate-600">Blockers</p>
                  <p className="font-semibold text-amber-600">{readinessSummary.blockerCount || 0}</p>
                </div>
              </div>
              {readinessSummary.generatedAt && (
                <p className="text-xs text-slate-500">
                  Generated: {new Date(readinessSummary.generatedAt).toLocaleString()}
                </p>
              )}
            </div>

            {fullReport ? (
              <div className="space-y-3">
                {/* Readiness Checks Section */}
                {fullReport.checks && fullReport.checks.length > 0 && (
                  <div className="bg-white rounded p-3 border border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-900 mb-2">Readiness Checks</h4>
                    <div className="space-y-2">
                      {fullReport.checks.map((check) => {
                        const badge = getCheckStatusBadge(check.status);
                        return (
                          <div key={check.checkId} className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900">{check.label}</p>
                                <p className="text-slate-600 mt-1">{check.reason}</p>
                              </div>
                              <span className={`px-2 py-1 rounded font-semibold whitespace-nowrap ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
                      {fullReport.checks.filter(c => c.status === 'pass').length} pass, {fullReport.checks.filter(c => c.status === 'blocked').length} blocked, {fullReport.checks.filter(c => c.status === 'fail').length} failed, {fullReport.checks.filter(c => c.status === 'not-applicable').length} N/A
                    </div>
                  </div>
                )}

                {/* What's Blocking Execution Section */}
                {fullReport.blockers && fullReport.blockers.length > 0 && (
                  <div className="bg-red-50 rounded p-3 border border-red-200">
                    <h4 className="text-xs font-semibold text-red-900 mb-2">What's Blocking Execution</h4>
                    <div className="space-y-2">
                      {fullReport.blockers.map((blocker, idx) => (
                        <div key={idx} className="text-xs">
                          <p className="font-semibold text-red-800">• {blocker}</p>
                          {BLOCKER_GUIDANCE[blocker] && (
                            <p className="text-red-700 ml-4 mt-0.5">{BLOCKER_GUIDANCE[blocker]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Blockers Section */}
                {(!fullReport.blockers || fullReport.blockers.length === 0) && (
                  <div className="bg-slate-50 rounded p-3 border border-slate-200 text-xs">
                    <p className="text-slate-600">
                      No active blockers detected. Execution remains blocked by default in this phase.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded p-3 border border-slate-200 text-xs text-slate-600">
                <p>No detailed readiness report yet. Generate execution readiness to see check details.</p>
              </div>
            )}

            <button
              onClick={handleGenerateReadiness}
              disabled={generating}
              className="w-full px-3 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              {generating ? 'Generating...' : 'Regenerate Readiness Report'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateReadiness}
            disabled={generating}
            className="mt-3 w-full px-3 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {generating ? 'Generating...' : 'Generate Execution Readiness'}
          </button>
        )}
      </div>
    </div>
  );
}

export function InfiniteBrainExecutorDryRun() {
  const [drySummary, setDrySummary] = useState<{
    available: boolean;
    generatedAt?: string;
    status?: string;
    canExecute?: boolean;
    wouldExecuteSteps?: number;
    blockedSteps?: number;
    operationCount?: number;
    blockerCount?: number;
    dryRunOnly?: boolean;
    executionBlocked?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  async function fetchDryRunSummary() {
    try {
      const data = await brainCoreRequest(
        '/infinite-brain/proposals/executor-dry-run/summary',
        infiniteBrainExecutorDryRunSummaryResponseSchema
      );
      setDrySummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dry-run summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDryRunSummary();
  }, []);

  async function handleGenerateDryRun() {
    setGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);

    try {
      const response = await postBrainCoreAction(
        '/infinite-brain/proposals/executor-dry-run/generate',
        infiniteBrainExecutorDryRunGenerateResponseSchema,
        {}
      );

      if (response.ok) {
        setGenerationSuccess(true);
        await fetchDryRunSummary();
      } else {
        setGenerationError('Failed to generate dry-run report');
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate dry-run report');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-slate-900">Executor Dry Run</h3>
        <p className="text-sm text-slate-500 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-violet-900">Executor Dry Run</h3>
            <p className="text-xs text-violet-700 mt-1">
              Describes what would execute if execution were allowed
            </p>
            <div className="mt-2 text-xs text-violet-700 space-y-0.5">
              <p>✓ Dry run only — no proposals applied</p>
              <p>✓ Execution remains blocked</p>
              <p>✓ Mind is unchanged</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {generationError && (
          <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{generationError}</p>
          </div>
        )}

        {generationSuccess && (
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700">✓ Dry-run report generated successfully</p>
          </div>
        )}

        {drySummary && drySummary.available ? (
          <div className="mt-3 space-y-2">
            <div className="bg-white rounded p-2 border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-600">Can Execute</p>
                  <p className="font-semibold text-red-600">
                    {drySummary.canExecute === false ? 'No' : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Dry Run Only</p>
                  <p className="font-semibold text-violet-600">
                    {drySummary.dryRunOnly === true ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-slate-600">Operations</p>
                  <p className="font-semibold text-slate-900">{drySummary.operationCount || 0}</p>
                </div>
                <div>
                  <p className="text-slate-600">Blocked</p>
                  <p className="font-semibold text-red-600">{drySummary.blockedSteps || 0}</p>
                </div>
                <div>
                  <p className="text-slate-600">Blockers</p>
                  <p className="font-semibold text-violet-600">{drySummary.blockerCount || 0}</p>
                </div>
              </div>
              {drySummary.generatedAt && (
                <p className="text-xs text-slate-500">
                  Generated: {new Date(drySummary.generatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={handleGenerateDryRun}
              disabled={generating}
              className="w-full px-3 py-2 bg-violet-600 text-white rounded text-sm font-semibold hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              {generating ? 'Generating...' : 'Regenerate Dry Run'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateDryRun}
            disabled={generating}
            className="mt-3 w-full px-3 py-2 bg-violet-600 text-white rounded text-sm font-semibold hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {generating ? 'Generating...' : 'Generate Executor Dry Run'}
          </button>
        )}
      </div>
    </div>
  );
}
