'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

import { brainCoreRequest, postBrainCoreAction } from '../lib/braincore-client';
import { infiniteBrainProposalsResponseSchema, infiniteBrainProposalApprovalDecisionResponseSchema, infiniteBrainApplicationPlanGenerateResponseSchema, infiniteBrainApplicationPlanSummaryResponseSchema, infiniteBrainExecutionReadinessFullReportSchema, infiniteBrainExecutorDryRunGenerateResponseSchema, infiniteBrainExecutorDryRunSummaryResponseSchema, infiniteBrainExecutorDryRunReportSchema, infiniteBrainOperatorApprovalResponseSchema, infiniteBrainOperatorApprovalRecordIntentRequestSchema, infiniteBrainPostWriteVerificationResponseSchema, infiniteBrainPostWriteVerificationGenerateResponseSchema, infiniteBrainWriteManifestResponseSchema, infiniteBrainWriteManifestGenerateResponseSchema, type InfiniteBrainProposal, type InfiniteBrainProposalApprovalDecisionResponse, type InfiniteBrainExecutionReadinessCheck, type InfiniteBrainOperatorApprovalRecord, type InfiniteBrainPostWriteVerificationRecord, type InfiniteBrainWriteManifestRecord } from '../lib/braincore-schemas';

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
  const [operatorApprovalRecord, setOperatorApprovalRecord] = useState<InfiniteBrainOperatorApprovalRecord | null>(null);
  const [operatorApprovalLoading, setOperatorApprovalLoading] = useState(true);
  const [operatorName, setOperatorName] = useState('');
  const [approvalDecision, setApprovalDecision] = useState<'approved' | 'rejected' | 'needs-review' | ''>('');
  const [approvalReason, setApprovalReason] = useState('');
  const [recordingApproval, setRecordingApproval] = useState(false);
  const [approvalRecordError, setApprovalRecordError] = useState<string | null>(null);
  const [approvalRecordSuccess, setApprovalRecordSuccess] = useState<string | null>(null);
  const [postWriteVerificationRecord, setPostWriteVerificationRecord] = useState<InfiniteBrainPostWriteVerificationRecord | null>(null);
  const [postWriteVerificationLoading, setPostWriteVerificationLoading] = useState(true);
  const [generatingPostWriteVerification, setGeneratingPostWriteVerification] = useState(false);
  const [postWriteVerificationError, setPostWriteVerificationError] = useState<string | null>(null);
  const [postWriteVerificationSuccess, setPostWriteVerificationSuccess] = useState<string | null>(null);
  const [writeManifestRecord, setWriteManifestRecord] = useState<InfiniteBrainWriteManifestRecord | null>(null);
  const [writeManifestLoading, setWriteManifestLoading] = useState(true);
  const [generatingWriteManifest, setGeneratingWriteManifest] = useState(false);
  const [writeManifestError, setWriteManifestError] = useState<string | null>(null);
  const [writeManifestSuccess, setWriteManifestSuccess] = useState<string | null>(null);

  async function fetchPostWriteVerification() {
    try {
      const data = await brainCoreRequest('/infinite-brain/post-write-verification', infiniteBrainPostWriteVerificationResponseSchema);
      if (data.ok && data.report) {
        setPostWriteVerificationRecord(data.report);
      }
    } catch {
      // Not found is okay, we'll let the user generate one
    } finally {
      setPostWriteVerificationLoading(false);
    }
  }

  async function fetchWriteManifest() {
    try {
      const data = await brainCoreRequest('/infinite-brain/write-manifest', infiniteBrainWriteManifestResponseSchema);
      if (data.ok && data.manifest) {
        setWriteManifestRecord(data.manifest);
      }
    } catch {
      // Not found is okay, we'll let the user generate one
    } finally {
      setWriteManifestLoading(false);
    }
  }

  async function fetchOperatorApproval() {
    try {
      const data = await brainCoreRequest('/infinite-brain/operator-approval', z.object({
        ok: z.boolean(),
        record: z.unknown().optional(),
      }));
      if (data.ok && data.record) {
        setOperatorApprovalRecord(data.record as InfiniteBrainOperatorApprovalRecord);
      }
    } catch {
      // Not found is okay, we'll let the user record one
    } finally {
      setOperatorApprovalLoading(false);
    }
  }

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
    fetchOperatorApproval();
    fetchPostWriteVerification();
    fetchWriteManifest();
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

  async function handleRecordApprovalIntent(e: React.FormEvent) {
    e.preventDefault();

    if (!operatorName.trim() || !approvalDecision || !approvalReason.trim()) {
      setApprovalRecordError('Please provide operator name, decision, and reason');
      return;
    }

    setRecordingApproval(true);
    setApprovalRecordError(null);
    setApprovalRecordSuccess(null);

    try {
      const result = await postBrainCoreAction(
        '/infinite-brain/operator-approval/record',
        infiniteBrainOperatorApprovalResponseSchema,
        {
          operator: operatorName.trim(),
          decision: approvalDecision,
          reason: approvalReason.trim(),
        } as z.infer<typeof infiniteBrainOperatorApprovalRecordIntentRequestSchema>
      );

      if (result.ok) {
        setOperatorApprovalRecord(result.record);
        setApprovalRecordSuccess('Operator approval intent recorded');
        setOperatorName('');
        setApprovalDecision('');
        setApprovalReason('');
      }
    } catch (err) {
      setApprovalRecordError(err instanceof Error ? err.message : 'Failed to record approval intent');
    } finally {
      setRecordingApproval(false);
    }
  }

  async function handleGeneratePostWriteVerification() {
    setGeneratingPostWriteVerification(true);
    setPostWriteVerificationError(null);
    setPostWriteVerificationSuccess(null);

    try {
      const result = await postBrainCoreAction(
        '/infinite-brain/post-write-verification/generate',
        infiniteBrainPostWriteVerificationGenerateResponseSchema,
        {}
      );

      if (result.ok) {
        setPostWriteVerificationRecord(result.report);
        setPostWriteVerificationSuccess('Post-write verification report generated');
        await fetchPostWriteVerification();
      } else {
        setPostWriteVerificationError('Failed to generate post-write verification');
      }
    } catch (err) {
      setPostWriteVerificationError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingPostWriteVerification(false);
    }
  }

  async function handleGenerateWriteManifest() {
    setGeneratingWriteManifest(true);
    setWriteManifestError(null);
    setWriteManifestSuccess(null);

    try {
      const result = await postBrainCoreAction(
        '/infinite-brain/write-manifest/generate',
        infiniteBrainWriteManifestGenerateResponseSchema,
        {}
      );

      if (result.ok) {
        setWriteManifestRecord(result.manifest);
        setWriteManifestSuccess('Write manifest generated');
        await fetchWriteManifest();
      } else {
        setWriteManifestError('Failed to generate write manifest');
      }
    } catch (err) {
      setWriteManifestError(err instanceof Error ? err.message : 'Failed to generate manifest');
    } finally {
      setGeneratingWriteManifest(false);
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

      {/* Operator Approval Intent Section */}
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
        <div>
          <h3 className="font-semibold text-amber-900">Operator Approval Intent</h3>
          <p className="text-xs text-amber-700 mt-1">
            Record explicit approval intent. Execution remains blocked.
          </p>
          <div className="mt-2 text-xs text-amber-700 space-y-0.5">
            <p>✓ Approval intent recorded only</p>
            <p>✓ Execution remains blocked</p>
            <p>✓ Mind unchanged</p>
            <p>✓ No proposals applied</p>
          </div>
        </div>

        {operatorApprovalRecord && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-xs font-semibold text-green-900">Current Approval Intent:</p>
            <div className="mt-2 space-y-1 text-xs text-green-800">
              <p><strong>Operator:</strong> {operatorApprovalRecord.operator}</p>
              <p><strong>Decision:</strong> <span className="capitalize">{operatorApprovalRecord.decision}</span></p>
              <p><strong>Execution Enabled:</strong> {operatorApprovalRecord.executionEnabled ? 'Yes' : 'No'}</p>
              <p><strong>Can Execute:</strong> {operatorApprovalRecord.canExecute ? 'Yes' : 'No'}</p>
              <p><strong>Applied:</strong> {operatorApprovalRecord.applied ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}

        {approvalRecordError && (
          <div className="p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{approvalRecordError}</p>
          </div>
        )}

        {approvalRecordSuccess && (
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700">{approvalRecordSuccess}</p>
          </div>
        )}

        <form onSubmit={handleRecordApprovalIntent} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Operator Name (required)</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Your name or identifier"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Approval Decision (required)</label>
            <div className="space-y-2">
              {(['approved', 'rejected', 'needs-review'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="approval-decision"
                    value={opt}
                    checked={approvalDecision === opt}
                    onChange={(e) => setApprovalDecision(e.target.value as typeof opt)}
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
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              placeholder="Explain your approval intent..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={!operatorName.trim() || !approvalDecision || !approvalReason.trim() || recordingApproval}
            className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {recordingApproval ? 'Recording...' : 'Record Approval Intent'}
          </button>
        </form>
      </div>

      {/* Post-Write Verification Section */}
      <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200 space-y-3">
        <div>
          <h3 className="font-semibold text-cyan-900">Post-Write Verification</h3>
          <p className="text-xs text-cyan-700 mt-1">
            Read-only framework for verifying expected write results. Report-only status display.
          </p>
          <div className="mt-2 text-xs text-cyan-700 space-y-0.5">
            <p>✓ Report-only status, no writes performed</p>
            <p>✓ Mind unchanged</p>
            <p>✓ No execution controls</p>
            <p>✓ Safety: all verification gates blocked</p>
          </div>
        </div>

        {postWriteVerificationRecord && (
          <div className="p-3 bg-white border border-cyan-200 rounded space-y-2">
            <div>
              <p className="text-xs font-semibold text-cyan-900">Report ID:</p>
              <p className="text-xs text-cyan-800 font-mono">{postWriteVerificationRecord.reportId}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-cyan-700">Status</p>
                <p className="font-semibold text-cyan-900 capitalize">{postWriteVerificationRecord.status}</p>
              </div>
              <div>
                <p className="text-cyan-700">Generated</p>
                <p className="font-semibold text-cyan-900">{new Date(postWriteVerificationRecord.generatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-cyan-700">Verification Available</p>
                <p className="font-semibold text-cyan-900">{postWriteVerificationRecord.verificationAvailable ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-cyan-700">Can Verify Writes</p>
                <p className="font-semibold text-cyan-900">{postWriteVerificationRecord.canVerifyWrites ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-cyan-700">Can Execute</p>
                <p className="font-semibold text-cyan-900">{postWriteVerificationRecord.canExecute ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-cyan-700">Dry-Run Report</p>
                <p className="font-semibold text-cyan-900 font-mono text-xs">{postWriteVerificationRecord.dryRunReportId || 'None'}</p>
              </div>
            </div>

            {postWriteVerificationRecord.blockers.length > 0 && (
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <p className="text-xs font-semibold text-amber-900 mb-1">Blockers ({postWriteVerificationRecord.blockers.length}):</p>
                <ul className="text-xs text-amber-800 space-y-0.5">
                  {postWriteVerificationRecord.blockers.map((blocker, i) => (
                    <li key={i}>• {blocker}</li>
                  ))}
                </ul>
              </div>
            )}

            {postWriteVerificationRecord.checks.length > 0 && (
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="text-xs font-semibold text-slate-900 mb-2">Verification Checks:</p>
                <div className="space-y-1">
                  {postWriteVerificationRecord.checks.map((check) => {
                    const badge = getCheckStatusBadge(check.status);
                    return (
                      <div key={check.checkId} className="flex items-start gap-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-900">{check.label}</p>
                          <p className="text-xs text-slate-600">{check.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-1">Safety Verification:</p>
              <div className="text-xs text-blue-800 space-y-0.5">
                <p>• Writes to Mind: {postWriteVerificationRecord.safety.writesToMind ? 'Yes' : 'No'}</p>
                <p>• Modifies Mind: {postWriteVerificationRecord.safety.modifiesMind ? 'Yes' : 'No'}</p>
                <p>• Deletes Files: {postWriteVerificationRecord.safety.deletesFiles ? 'Yes' : 'No'}</p>
                <p>• Can Execute: {postWriteVerificationRecord.safety.canExecute ? 'Yes' : 'No'}</p>
                <p>• Report Only: {postWriteVerificationRecord.safety.reportOnly ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        )}

        {postWriteVerificationError && (
          <div className="p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{postWriteVerificationError}</p>
          </div>
        )}

        {postWriteVerificationSuccess && (
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700">{postWriteVerificationSuccess}</p>
          </div>
        )}

        <button
          onClick={handleGeneratePostWriteVerification}
          disabled={generatingPostWriteVerification}
          className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold text-sm hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
        >
          {generatingPostWriteVerification ? 'Generating Report...' : 'Generate Post-Write Verification Report'}
        </button>
      </div>

      {/* Write Manifest Section */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
        <div>
          <h3 className="font-semibold text-green-900">Write Manifest</h3>
          <p className="text-xs text-green-700 mt-1">
            Converts executor dry-run into concrete manifest of intended writes. Manifest-only status display.
          </p>
          <div className="mt-2 text-xs text-green-700 space-y-0.5">
            <p>✓ Manifest-only status, no files written</p>
            <p>✓ Mind unchanged</p>
            <p>✓ No write controls</p>
            <p>✓ Safety: all write gates blocked</p>
          </div>
        </div>

        {writeManifestRecord && (
          <div className="p-3 bg-white border border-green-200 rounded space-y-2">
            <div>
              <p className="text-xs font-semibold text-green-900">Manifest ID:</p>
              <p className="text-xs text-green-800 font-mono">{writeManifestRecord.manifestId}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-green-700">Status</p>
                <p className="font-semibold text-green-900 capitalize">{writeManifestRecord.status}</p>
              </div>
              <div>
                <p className="text-green-700">Generated</p>
                <p className="font-semibold text-green-900">{new Date(writeManifestRecord.generatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-green-700">Write Enabled</p>
                <p className="font-semibold text-green-900">{writeManifestRecord.writeEnabled ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-green-700">Can Write to Mind</p>
                <p className="font-semibold text-green-900">{writeManifestRecord.canWriteToMind ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-green-700">Total Operations</p>
                <p className="font-semibold text-green-900">{writeManifestRecord.totalOperations}</p>
              </div>
              <div>
                <p className="text-green-700">Manifest Entries</p>
                <p className="font-semibold text-green-900">{writeManifestRecord.totalManifestEntries}</p>
              </div>
            </div>

            {writeManifestRecord.blockers.length > 0 && (
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <p className="text-xs font-semibold text-amber-900 mb-1">Blockers ({writeManifestRecord.blockers.length}):</p>
                <ul className="text-xs text-amber-800 space-y-0.5">
                  {writeManifestRecord.blockers.map((blocker, i) => (
                    <li key={i}>• {blocker}</li>
                  ))}
                </ul>
              </div>
            )}

            {writeManifestRecord.entries.length > 0 && (
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="text-xs font-semibold text-slate-900 mb-2">Manifest Entries (showing {Math.min(5, writeManifestRecord.entries.length)}):</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {writeManifestRecord.entries.slice(0, 5).map((entry) => (
                    <div key={entry.entryId} className="p-2 bg-white border border-slate-300 rounded text-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.operationType} in {entry.category}</p>
                          <p className="text-slate-600">Proposal: {entry.proposalId}</p>
                          <p className="text-slate-500">Entry: {entry.entryId.substring(0, 12)}...</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                            Write Blocked
                          </span>
                        </div>
                      </div>
                      {entry.targetPathsPreview.length > 0 && (
                        <p className="text-slate-600 mt-1">Targets: {entry.targetPathsPreview.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-1">Safety Status:</p>
              <div className="text-xs text-blue-800 space-y-0.5">
                <p>• Writes to Mind: {writeManifestRecord.safety.writesToMind ? 'Yes' : 'No'}</p>
                <p>• Modifies Mind: {writeManifestRecord.safety.modifiesMind ? 'Yes' : 'No'}</p>
                <p>• Deletes Files: {writeManifestRecord.safety.deletesFiles ? 'Yes' : 'No'}</p>
                <p>• Write Enabled: {writeManifestRecord.safety.writeEnabled ? 'Yes' : 'No'}</p>
                <p>• Manifest Only: {writeManifestRecord.safety.manifestOnly ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        )}

        {writeManifestError && (
          <div className="p-2 bg-red-50 rounded border border-red-200">
            <p className="text-xs text-red-700">{writeManifestError}</p>
          </div>
        )}

        {writeManifestSuccess && (
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700">{writeManifestSuccess}</p>
          </div>
        )}

        <button
          onClick={handleGenerateWriteManifest}
          disabled={generatingWriteManifest}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
        >
          {generatingWriteManifest ? 'Generating Manifest...' : 'Generate Write Manifest'}
        </button>
      </div>
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
  const [fullReport, setFullReport] = useState<z.infer<typeof infiniteBrainExecutorDryRunReportSchema> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [fetchingFullReport, setFetchingFullReport] = useState(false);

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

  async function fetchFullDryRunReport() {
    setFetchingFullReport(true);
    try {
      const data = await brainCoreRequest(
        '/infinite-brain/proposals/executor-dry-run',
        infiniteBrainExecutorDryRunReportSchema
      );
      setFullReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load full dry-run report');
    } finally {
      setFetchingFullReport(false);
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
          <div className="mt-3 space-y-3">
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

            {fullReport && fullReport.report ? (
              <div className="bg-white rounded p-3 border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-900 text-sm">Dry-Run Operations</h4>
                <div className="text-xs text-slate-600 bg-violet-50 rounded p-2 border border-violet-100">
                  <p>✓ These operations would execute if approval were granted</p>
                  <p>✓ Dry run only — no files are changed</p>
                  <p>✓ Mind remains unchanged</p>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {fullReport.report.operations && fullReport.report.operations.length > 0 ? (
                    fullReport.report.operations.slice(0, 10).map((op: any, idx: number) => (
                      <div key={op.operationId || idx} className="bg-slate-50 rounded border border-slate-200 p-2">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <p className="font-semibold text-xs text-slate-900">{op.operationType}</p>
                            <p className="text-xs text-slate-600">{op.category}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded">
                            {op.applied === false ? 'Dry-run' : 'Unknown'}
                          </span>
                        </div>

                        <div className="text-xs space-y-1 text-slate-700">
                          {op.proposalId && (
                            <p><span className="text-slate-600">Proposal:</span> {op.proposalId.slice(0, 8)}</p>
                          )}
                          {op.stepId && (
                            <p><span className="text-slate-600">Step:</span> {op.stepId.slice(0, 12)}</p>
                          )}
                          {op.targetPathsPreview && op.targetPathsPreview.length > 0 && (
                            <div>
                              <p className="text-slate-600">Paths:</p>
                              <ul className="list-disc list-inside text-slate-600">
                                {op.targetPathsPreview.slice(0, 2).map((p: string, i: number) => (
                                  <li key={i} className="truncate">{p}</li>
                                ))}
                                {op.targetPathsPreview.length > 2 && (
                                  <li>+{op.targetPathsPreview.length - 2} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                          <div className="flex gap-2 mt-1">
                            {op.wouldWriteToMind !== false && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Writes to Mind</span>}
                            {op.wouldDeleteFiles !== false && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Deletes</span>}
                            {op.wouldMoveFiles !== false && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Moves</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-600">No operations recorded</p>
                  )}
                </div>

                {fullReport.report.operations && fullReport.report.operations.length > 10 && (
                  <p className="text-xs text-slate-500 text-center">
                    Showing 10 of {fullReport.report.operations.length} operations
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={fetchFullDryRunReport}
                disabled={fetchingFullReport}
                className="w-full px-3 py-2 bg-slate-200 text-slate-700 rounded text-sm font-semibold hover:bg-slate-300 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {fetchingFullReport ? 'Loading...' : 'View Detailed Operations'}
              </button>
            )}

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
