'use client';

import { useEffect, useState } from 'react';

import { brainCoreRequest, postBrainCoreAction } from '../lib/braincore-client';
import { infiniteBrainProposalsResponseSchema, infiniteBrainProposalApprovalDecisionResponseSchema, type InfiniteBrainProposal, type InfiniteBrainProposalApprovalDecisionResponse } from '../lib/braincore-schemas';

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
        <h3 className="font-semibold text-blue-900">Proposal Review</h3>
        <p className="text-xs text-blue-700 mt-1">Decision-only mode: Records decisions without applying changes.</p>
        <div className="mt-2 text-xs text-blue-700 space-y-0.5">
          <p>✓ Mind unchanged</p>
          <p>✓ Execution blocked</p>
          <p>✓ Applied: false</p>
        </div>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm font-semibold text-green-900">Decision recorded</p>
          <p className="text-xs text-green-700 mt-1">{submitSuccess.message}</p>
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
