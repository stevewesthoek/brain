'use client';

import { CheckCircle2, FilePlus2, Wand2, Youtube } from 'lucide-react';

interface PipelineStep {
  key: string;
  label: string;
  help: string;
  done: boolean;
  active: boolean;
}

interface AwsVideoPipelineFlowProps {
  guideSteps: PipelineStep[];
  recommendedStepKey: string | null;
  anyPendingTimeout: boolean;
  canApprove: boolean;
  canGenerate: boolean;
  canApproveReview: boolean;
  isApprovePending: boolean;
  isGeneratePending: boolean;
  isApproveReviewPending: boolean;
  onCreateDraft: () => void;
  onApprove: () => void;
  onGenerate: () => void;
  onApproveReview: () => void;
  onPublishStep: () => void;
}

export function AwsVideoPipelineFlow({
  guideSteps,
  recommendedStepKey,
  anyPendingTimeout,
  canApprove,
  canGenerate,
  canApproveReview,
  isApprovePending,
  isGeneratePending,
  isApproveReviewPending,
  onCreateDraft,
  onApprove,
  onGenerate,
  onApproveReview,
  onPublishStep,
}: AwsVideoPipelineFlowProps) {
  return (
    <article className="card">
      <div className="card-title">Pipeline flow</div>
      <div className="pipeline-flow">
        {guideSteps.map((step, index) => (
          <div className="pipeline-step" key={step.key}>
            <div className="pipeline-index">{index + 1}</div>
            <div className="min-w-0">
              <strong>{step.label}</strong>
              <span>{step.done ? 'complete' : step.active ? 'active' : 'waiting'}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="pipeline-actions">
        <button className={recommendedStepKey === 'draft' ? 'button next-action' : 'button secondary'} onClick={onCreateDraft}><FilePlus2 size={16} /> Create draft</button>
        <button className={recommendedStepKey === 'approve' ? 'button next-action' : 'button'} disabled={!canApprove || isApprovePending || anyPendingTimeout} onClick={onApprove}><CheckCircle2 size={16} /> Approve script</button>
        <button className={recommendedStepKey === 'generate' ? 'button next-action' : 'button'} disabled={!canGenerate || isGeneratePending || anyPendingTimeout} onClick={onGenerate}><Wand2 size={16} /> Generate</button>
        <button className={recommendedStepKey === 'review' ? 'button next-action' : 'button'} disabled={!canApproveReview || isApproveReviewPending || anyPendingTimeout} onClick={onApproveReview}><CheckCircle2 size={16} /> Approve review</button>
        <button className={recommendedStepKey === 'dry-run' || recommendedStepKey === 'publish' || recommendedStepKey === 'download' ? 'button next-action' : 'button secondary'} onClick={onPublishStep}><Youtube size={16} /> Publish step</button>
      </div>
    </article>
  );
}
