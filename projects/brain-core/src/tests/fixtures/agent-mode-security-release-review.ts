/** Test-only H0-C security review contract. It is evidence metadata, not runtime authority. */

export const AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA = 'agent-mode.security-release-review.v1' as const;

export const H0_LIVE_ACCEPTANCE_CLASSIFICATIONS = [
  'SAFE_LOCAL_LIVE',
  'SAFE_SUPPORTED_LIVE',
  'EXTERNAL_SENSITIVE',
  'ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE',
  'UNSUPPORTED',
] as const;
export type H0LiveAcceptanceClassification = typeof H0_LIVE_ACCEPTANCE_CLASSIFICATIONS[number];

export const H0_SECURITY_REVIEW_STATUSES = ['pass', 'pass_with_nonblocking_notes', 'fail', 'blocked', 'not_run'] as const;
export type H0SecurityReviewStatus = typeof H0_SECURITY_REVIEW_STATUSES[number];

export const H0_SECURITY_FINDING_SEVERITIES = ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'NOTE'] as const;
export type H0SecurityFindingSeverity = typeof H0_SECURITY_FINDING_SEVERITIES[number];

export type H0LiveAcceptanceEntry = {
  readonly faultClass: string;
  readonly classification: H0LiveAcceptanceClassification;
  readonly liveStatus: 'live_pass' | 'blocked' | 'not_run' | 'failed';
  readonly evidenceRefs: readonly string[];
  readonly blocker: string | null;
};

export type H0SecurityReviewFinding = {
  readonly findingId: string;
  readonly severity: H0SecurityFindingSeverity;
  readonly status: 'closed' | 'accepted' | 'open';
  readonly evidenceRefs: readonly string[];
};

export type H0SecurityReleaseReviewV1 = {
  readonly schemaVersion: typeof AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA;
  readonly reviewId: string;
  readonly buildRevision: string;
  readonly status: H0SecurityReviewStatus;
  readonly findings: readonly H0SecurityReviewFinding[];
  readonly reviewedSurfaces: readonly string[];
};

export const H0_LIVE_ACCEPTANCE_MATRIX: readonly H0LiveAcceptanceEntry[] = [
  { faultClass: 'provider_outage', classification: 'EXTERNAL_SENSITIVE', liveStatus: 'blocked', evidenceRefs: ['h0b:provider-fixture'], blocker: 'Requires separately authorized provider outage and recovery against a real provider boundary.' },
  { faultClass: 'host_loss_reconnect', classification: 'EXTERNAL_SENSITIVE', liveStatus: 'blocked', evidenceRefs: ['h0b:node-fixture'], blocker: 'No second production node or remote host may be exercised by this local-only audit.' },
  { faultClass: 'process_crash_restart', classification: 'ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE', liveStatus: 'live_pass', evidenceRefs: ['h0b:process-restart'], blocker: null },
  { faultClass: 'stale_lease', classification: 'ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE', liveStatus: 'live_pass', evidenceRefs: ['h0b:stale-fence'], blocker: null },
  { faultClass: 'duplicate_delivery', classification: 'ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE', liveStatus: 'live_pass', evidenceRefs: ['h0b:duplicate-delivery'], blocker: null },
  { faultClass: 'stuck_agent', classification: 'ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE', liveStatus: 'live_pass', evidenceRefs: ['h0b:stuck-child-ttl'], blocker: null },
  { faultClass: 'sandbox_denial', classification: 'UNSUPPORTED', liveStatus: 'not_run', evidenceRefs: ['h0b:sandbox-fixture'], blocker: 'The installed restricted-runtime topology is not exercised as a live sandbox in this audit.' },
  { faultClass: 'tool_denial', classification: 'UNSUPPORTED', liveStatus: 'not_run', evidenceRefs: ['h0b:tool-fixture'], blocker: 'No live tool endpoint is authorized; the deterministic capability fixture remains the safe evidence.' },
  { faultClass: 'security', classification: 'SAFE_LOCAL_LIVE', liveStatus: 'live_pass', evidenceRefs: ['h0c:local-auth-boundary', 'h0c:security-review'], blocker: null },
  { faultClass: 'auditability', classification: 'ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE', liveStatus: 'live_pass', evidenceRefs: ['h0b:durable-reconstruction'], blocker: null },
];

export const H0_SECURITY_REVIEW_SURFACES = [
  'browser-console', 'console-server', 'core-api', 'service-auth', 'operator-session',
  'control-review', 'state-store', 'lease-fence', 'budget-spawn', 'runtime-harness',
  'node-transport', 'jarvis-voice', 'd0-relocation', 'h0-fault-surfaces',
] as const;

const MAX_ID_LENGTH = 128;
const MAX_EVIDENCE_REFS = 64;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$/u;

function safeRef(value: unknown): value is string {
  return typeof value === 'string' && SAFE_REF.test(value) && !/(secret|credential|prompt|payload|token|password)/iu.test(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

/** Validate review metadata with a closed shape and bounded, non-sensitive evidence references. */
export function validateSecurityReleaseReview(value: unknown): H0SecurityReleaseReviewV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('security review must be an object');
  const review = value as Record<string, unknown>;
  if (!exactKeys(review, ['schemaVersion', 'reviewId', 'buildRevision', 'status', 'findings', 'reviewedSurfaces'])) throw new Error('security review fields are not closed');
  if (review.schemaVersion !== AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA || !safeRef(review.reviewId) || !safeRef(review.buildRevision)) throw new Error('security review identity is invalid');
  if (!H0_SECURITY_REVIEW_STATUSES.includes(review.status as H0SecurityReviewStatus)) throw new Error('security review status is invalid');
  if (!Array.isArray(review.reviewedSurfaces) || review.reviewedSurfaces.length !== H0_SECURITY_REVIEW_SURFACES.length || new Set(review.reviewedSurfaces).size !== review.reviewedSurfaces.length || review.reviewedSurfaces.some((surface) => !H0_SECURITY_REVIEW_SURFACES.includes(surface as never))) throw new Error('security review surface coverage is invalid');
  if (!Array.isArray(review.findings) || review.findings.length > 64) throw new Error('security review findings are unbounded');
  for (const rawFinding of review.findings) {
    if (!rawFinding || typeof rawFinding !== 'object' || Array.isArray(rawFinding)) throw new Error('security review finding is invalid');
    const finding = rawFinding as Record<string, unknown>;
    if (!exactKeys(finding, ['findingId', 'severity', 'status', 'evidenceRefs']) || !safeRef(finding.findingId) || !H0_SECURITY_FINDING_SEVERITIES.includes(finding.severity as H0SecurityFindingSeverity) || !['closed', 'accepted', 'open'].includes(String(finding.status)) || !Array.isArray(finding.evidenceRefs) || finding.evidenceRefs.length > MAX_EVIDENCE_REFS || finding.evidenceRefs.some((ref) => !safeRef(ref))) throw new Error('security review finding is invalid');
  }
  return value as H0SecurityReleaseReviewV1;
}

export type H0SecurityReviewGate = {
  readonly schemaVersion: typeof AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA;
  readonly status: 'PASS' | 'PASS_WITH_NONBLOCKING_NOTES' | 'FAIL' | 'BLOCKED';
  readonly reasons: readonly string[];
};

export function evaluateSecurityReleaseReview(review: H0SecurityReleaseReviewV1): H0SecurityReviewGate {
  try { validateSecurityReleaseReview(review); } catch { return { schemaVersion: AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA, status: 'FAIL', reasons: ['invalid_review'] }; }
  const reasons: string[] = [];
  for (const finding of review.findings) {
    if (finding.status === 'open') reasons.push(`open_finding:${finding.findingId}`);
    if (finding.status !== 'closed' && (finding.severity === 'BLOCKER' || finding.severity === 'HIGH')) reasons.push(`unresolved_${finding.severity.toLowerCase()}:${finding.findingId}`);
  }
  if (review.status === 'blocked' || review.status === 'not_run') reasons.push('review_not_complete');
  if (reasons.some((reason) => reason.startsWith('unresolved_') || reason === 'review_not_complete')) return { schemaVersion: AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA, status: review.status === 'blocked' || review.status === 'not_run' ? 'BLOCKED' : 'FAIL', reasons: reasons.sort() };
  if (reasons.length || review.status === 'pass_with_nonblocking_notes') return { schemaVersion: AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA, status: 'PASS_WITH_NONBLOCKING_NOTES', reasons: reasons.sort() };
  return { schemaVersion: AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA, status: 'PASS', reasons: [] };
}

export function createH0SecurityReview(buildRevision: string): H0SecurityReleaseReviewV1 {
  return validateSecurityReleaseReview({
    schemaVersion: AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA,
    reviewId: 'h0c:security-release-review',
    buildRevision,
    status: 'pass',
    findings: [
      { findingId: 'h0c:external-live-boundaries', severity: 'NOTE', status: 'accepted', evidenceRefs: ['h0c:external-boundaries'] },
    ],
    reviewedSurfaces: [...H0_SECURITY_REVIEW_SURFACES],
  });
}
