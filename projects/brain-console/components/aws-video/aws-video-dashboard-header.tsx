import { RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';

export interface DashboardGuideStep {
  key: string;
  label: string;
  help: string;
  action: string;
  done: boolean;
  active: boolean;
}

interface AwsVideoDashboardHeaderProps {
  jobsIsError: boolean;
  statusIsError: boolean;
  onRefresh: () => void;
  runtimeMode: string;
  counts: { total: number; pending: number; active: number; published: number };
  selectedUploaded: boolean;
  selectedJobStatus: string | null | undefined;
  guideSteps: DashboardGuideStep[];
  recommendedStepKey: string | null;
}

export function AwsVideoDashboardHeader({
  jobsIsError,
  statusIsError,
  onRefresh,
  runtimeMode,
  counts,
  selectedUploaded,
  selectedJobStatus,
  guideSteps,
  recommendedStepKey,
}: AwsVideoDashboardHeaderProps) {
  const nextStep = (recommendedStepKey ? guideSteps.find((s) => s.key === recommendedStepKey) : undefined)
    ?? guideSteps.find((s) => !s.done);

  return (
    <>
      <section className="aws-hero">
        <div className="min-w-0">
          <div className="eyebrow">AWS Video Pipeline</div>
          <h1>Video operations</h1>
          <p>Brain Console is the active dashboard. Follow the pipeline left to right: draft, approve, generate, review, dry-run, then private YouTube upload.</p>
        </div>
        <div className="aws-hero-actions">
          <StatusBadge
            status={jobsIsError ? 'error' : statusIsError ? 'warning' : 'fresh'}
            label={jobsIsError ? 'partial error' : statusIsError ? 'status stale' : 'online'}
          />
          <button className="button secondary" onClick={onRefresh}><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="aws-metrics">
        <div><span>Runtime mode</span><strong>{runtimeMode}</strong></div>
        <div><span>Jobs</span><strong>{counts.total}</strong></div>
        <div><span>Pending</span><strong>{counts.pending}</strong></div>
        <div><span>Active</span><strong>{counts.active}</strong></div>
        <div><span>Published</span><strong>{counts.published}</strong></div>
        <div><span>Selected</span><strong>{selectedUploaded ? 'uploaded' : selectedJobStatus?.replaceAll('_', ' ') ?? 'none'}</strong></div>
      </section>

      <section className="pipeline-guide" aria-label="AWS Video pipeline guide">
        <div className="pipeline-next">
          <span>Next action</span>
          <strong>{nextStep ? nextStep.label : 'Complete'}</strong>
          <p>{nextStep ? `${nextStep.help} Press "${nextStep.action}".` : 'This job has completed the visible pipeline.'}</p>
        </div>
        <div className="pipeline-steps">
          {guideSteps.map((step, index) => (
            <div key={step.label} className={step.done ? 'done' : step.key === recommendedStepKey ? 'recommended' : step.active ? 'active' : ''}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <p>{step.help}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
