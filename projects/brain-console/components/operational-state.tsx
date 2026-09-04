import { cn } from '@/lib/utils';
import type { OperationalState } from '@/lib/braincore-schemas';

const stateLabels: Record<OperationalState, string> = {
  CURRENT: 'Current',
  STALE: 'Stale',
  DEGRADED: 'Degraded',
  UNAVAILABLE: 'Unavailable',
  ERROR: 'Error',
  BLOCKED: 'Blocked',
  PENDING: 'Pending',
};

const stateClasses: Record<OperationalState, string> = {
  CURRENT: 'success',
  STALE: 'warning',
  DEGRADED: 'warning',
  UNAVAILABLE: 'warning',
  ERROR: 'error',
  BLOCKED: 'error',
  PENDING: 'warning',
};

export function OperationalStateBadge({ state, detail }: { state: OperationalState; detail?: string }) {
  const label = stateLabels[state];
  return (
    <span className={cn('badge', stateClasses[state])} role="status" aria-label={detail ? `${label}: ${detail}` : label}>
      {label}
    </span>
  );
}
export function OperationalStateLabel({ state, detail }: { state: OperationalState; detail?: string }) {
  return (
    <span role="status" aria-label={detail ? `${stateLabels[state]}: ${detail}` : stateLabels[state]}>
      <OperationalStateBadge state={state} detail={detail} />
      {detail ? <span className="sr-only">{detail}</span> : null}
    </span>
  );
}
