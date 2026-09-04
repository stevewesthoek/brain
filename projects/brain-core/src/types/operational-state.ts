export const OPERATIONAL_STATE_CONTRACT = 'brain-console-operational-state-v1' as const;

export const OPERATIONAL_STATES = [
  'CURRENT',
  'STALE',
  'DEGRADED',
  'UNAVAILABLE',
  'ERROR',
  'BLOCKED',
  'PENDING',
] as const;

export type OperationalState = typeof OPERATIONAL_STATES[number];

export const OPERATIONAL_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type OperationalSeverity = typeof OPERATIONAL_SEVERITIES[number];

export function isOperationalState(value: unknown): value is OperationalState {
  return typeof value === 'string' && (OPERATIONAL_STATES as readonly string[]).includes(value);
}
export function operationalSeverityForState(state: OperationalState): OperationalSeverity {
  switch (state) {
    case 'ERROR':
    case 'BLOCKED':
      return 'critical';
    case 'STALE':
    case 'DEGRADED':
    case 'PENDING':
    case 'UNAVAILABLE':
      return 'warning';
    case 'CURRENT':
      return 'info';
  }
}
