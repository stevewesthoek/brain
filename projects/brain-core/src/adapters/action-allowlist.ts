const ALLOWED_PREFIXES = [
  'scheduler-run-',
  'scheduler-run-mind-',
  'skill-profile-',
  'session-resume-',
  'local-app-start-',
  'local-app-stop-',
  'local-app-restart-',
  'post-draft-review-',
] as const;

const ALLOWED_EXACT_KINDS = new Set(['manual-request']);

export function normalizeRequestedKind(kind: string): string {
  return kind.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual-request';
}

export function isAllowlistedRequestedKind(kind: string): boolean {
  if (ALLOWED_EXACT_KINDS.has(kind)) {
    return true;
  }

  return ALLOWED_PREFIXES.some((prefix) => kind.startsWith(prefix)) || kind.startsWith('custom-');
}

export function classifyRequestedKind(kind: string): {
  normalizedKind: string;
  supported: boolean;
  rejectionReason?: string;
} {
  const normalizedKind = normalizeRequestedKind(kind);

  if (isAllowlistedRequestedKind(normalizedKind)) {
    return { normalizedKind, supported: true };
  }

  if (normalizedKind.startsWith('manual-request') || normalizedKind.startsWith('custom-')) {
    return { normalizedKind, supported: true };
  }

  return {
    normalizedKind,
    supported: false,
    rejectionReason: `Unsupported approval request kind: ${normalizedKind}`,
  };
}
