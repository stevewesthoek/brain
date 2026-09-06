const RAW_IDENTITY_KEYS = new Set(['email', 'access_token', 'refresh_token', 'token', 'password', 'cookie']);

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function safeResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return { state: 'unknown', accountId: null, matchedBy: null };
  return {
    state: ['matched', 'unmatched', 'unknown'].includes(result.state) ? result.state : 'unknown',
    accountId: typeof result.accountId === 'string' ? result.accountId : null,
    matchedBy: typeof result.matchedBy === 'string' ? result.matchedBy : null,
  };
}

/**
 * Build an in-process identity matcher. The resolver is the private authority;
 * the returned function never returns or persists the observed identity value.
 * The resolver may read owner-only local state, but must return only an opaque
 * account ID and a matching strategy.
 */
export function createPrivateIdentityMatcher({ providerId, resolveExpectedIdentity } = {}) {
  if (typeof providerId !== 'string' || !/^[a-z][a-z0-9._-]*$/.test(providerId)) throw new Error('providerId is invalid');
  if (typeof resolveExpectedIdentity !== 'function') throw new Error('resolveExpectedIdentity is required');
  return ({ observedProviderId, email = null, providerPrincipalRef = null, accountType = null } = {}) => {
    if (observedProviderId && observedProviderId !== providerId) return { state: 'unknown', accountId: null, matchedBy: null };
    const expected = resolveExpectedIdentity({ providerId, accountType });
    if (!expected || typeof expected !== 'object') return { state: 'unknown', accountId: null, matchedBy: null };
    const accountId = typeof expected.accountId === 'string' ? expected.accountId : null;
    if (!accountId) return { state: 'unknown', accountId: null, matchedBy: null };
    const expectedPrincipalRef = typeof expected.providerPrincipalRef === 'string' ? expected.providerPrincipalRef : null;
    if (expectedPrincipalRef && providerPrincipalRef && expectedPrincipalRef === providerPrincipalRef) {
      return { state: 'matched', accountId, matchedBy: 'provider_asserted_subject' };
    }
    const expectedEmail = normalizeEmail(expected.email);
    const observedEmail = normalizeEmail(email);
    if (expectedEmail && observedEmail && expectedEmail === observedEmail) {
      return { state: 'matched', accountId, matchedBy: 'private_local_email_match' };
    }
    return { state: expectedEmail || expectedPrincipalRef ? 'unmatched' : 'unknown', accountId: null, matchedBy: null };
  };
}

export function redactPrivateMatcherResult(result) {
  const safe = safeResult(result);
  return {
    state: safe.state,
    accountId: safe.accountId,
    matchedBy: safe.matchedBy,
    rawIdentityReturned: false,
    rawIdentityPersisted: false,
  };
}

export function assertPrivateMatcherResultSafe(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return ['matcher_result_invalid'];
  const errors = [];
  const inspect = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (RAW_IDENTITY_KEYS.has(key.toLowerCase())) errors.push(`matcher_result_contains_raw_field:${path}.${key}`);
      inspect(child, `${path}.${key}`);
    }
  };
  inspect(result, '$');
  if (result.accountId !== null && typeof result.accountId !== 'string') errors.push('matcher_result_account_id_invalid');
  if (result.accountId && !/^account:[a-z0-9][a-z0-9._-]*$/.test(result.accountId)) errors.push('matcher_result_account_id_not_opaque');
  return errors.sort();
}
