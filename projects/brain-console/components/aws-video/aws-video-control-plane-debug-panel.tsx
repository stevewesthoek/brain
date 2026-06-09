function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

function shortJobId(jobId: string | undefined): string {
  if (!jobId) return 'No job selected';
  return jobId.length > 48 ? `${jobId.slice(0, 30)}…${jobId.slice(-12)}` : jobId;
}

interface AwsVideoControlPlaneDebugPanelProps {
  rawControlPlaneOk: boolean;
  jobId: string | null | undefined;
  fetchUrl: string | null;
  timeoutMs: number;
  queryStatus: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  cpPhase: string;
  selectedApprovalStatus: string;
  reviewStatus: string;
  approveReviewEnabled: boolean;
  generateEnabled: boolean;
  finalVideoKey: string | null;
  thumbnailKey: string | null;
  controlPlaneDataMissing: boolean;
}

export function AwsVideoControlPlaneDebugPanel({
  rawControlPlaneOk,
  jobId,
  fetchUrl,
  timeoutMs,
  queryStatus,
  isLoading,
  isError,
  error,
  cpPhase,
  selectedApprovalStatus,
  reviewStatus,
  approveReviewEnabled,
  generateEnabled,
  finalVideoKey,
  thumbnailKey,
  controlPlaneDataMissing,
}: AwsVideoControlPlaneDebugPanelProps) {
  return (
    <article className="card" style={{ marginTop: '1rem' }}>
      <details open>
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Debug: control-plane state</summary>
        <div className="aws-facts" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          <div><span>raw control-plane ok</span><strong>{rawControlPlaneOk ? 'yes' : 'no'}</strong></div>
          <div><span>selected job id used by query</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{jobId ?? 'none'}</strong></div>
          <div><span>actual fetch URL</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{fetchUrl ?? 'n/a'}</strong></div>
          <div><span>timeout ms</span><strong>{timeoutMs}</strong></div>
          <div><span>control-plane query status</span><strong>{queryStatus}</strong></div>
          <div><span>isLoading</span><strong>{String(isLoading)}</strong></div>
          <div><span>isError</span><strong>{String(isError)}</strong></div>
          {error ? <div><span>error</span><strong style={{ color: 'var(--badge-error-text)' }}>{errorMessage(error)}</strong></div> : null}
          <div><span>cpPhase</span><strong>{cpPhase}</strong></div>
          <div><span>selectedApprovalStatus</span><strong>{selectedApprovalStatus}</strong></div>
          <div><span>reviewStatus</span><strong>{reviewStatus}</strong></div>
          <div><span>approve_review.enabled</span><strong>{String(approveReviewEnabled)}</strong></div>
          <div><span>generate.enabled</span><strong>{String(generateEnabled)}</strong></div>
          <div><span>finalVideoKey</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{finalVideoKey ?? 'missing'}</strong></div>
          <div><span>thumbnailKey</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{thumbnailKey ?? 'missing'}</strong></div>
          {controlPlaneDataMissing ? (
            <div style={{ gridColumn: '1 / -1', padding: '0.5rem', backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-border)', borderRadius: '3px', marginTop: '0.5rem' }}>
              <strong style={{ color: 'var(--badge-error-text)' }}>⚠️ Control-plane state is missing for selected job</strong>
              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--badge-error-text)' }}>
                Job ID: {shortJobId(jobId ?? undefined)}
                {error ? <div>Query error: {errorMessage(error)}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}
