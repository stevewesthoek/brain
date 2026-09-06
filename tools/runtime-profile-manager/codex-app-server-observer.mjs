import { spawn } from 'node:child_process';

import { assertPrivateMatcherResultSafe, redactPrivateMatcherResult } from './private-identity-matcher.mjs';

export const CODEX_APP_SERVER_OBSERVER_ID = 'observer:codex-app-server-account';
export const CODEX_APP_SERVER_OBSERVER_VERSION = '1.0.0';

const ALLOWED_ACCOUNT_TYPES = new Set(['apiKey', 'chatgpt', 'chatgptAuthTokens', 'amazonBedrock']);

function safeProviderPrincipalRef(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\s@]/.test(value)
    ? value
    : null;
}

function normalizeAccount(account) {
  if (!account || typeof account !== 'object' || Array.isArray(account)) return null;
  const type = typeof account.type === 'string' && ALLOWED_ACCOUNT_TYPES.has(account.type) ? account.type : null;
  const planType = typeof account.planType === 'string' && account.planType.length <= 64 ? account.planType : null;
  const emailPresent = typeof account.email === 'string' && account.email.length > 0;
  return {
    type,
    planType,
    emailPresent,
    // Email is intentionally not returned or persisted. It is only used as a
    // private observation signal unless a future approved matcher needs it.
    email: null,
    providerPrincipalRef: safeProviderPrincipalRef(account.subject ?? account.id),
  };
}

export function redactCodexAccountRead({ response, expectedPrincipal = null, identityMatcher = null, providerId = 'openai' } = {}) {
  const result = response?.result && typeof response.result === 'object' ? response.result : null;
  const account = normalizeAccount(result?.account);
  const rawEmail = typeof result?.account?.email === 'string' ? result.account.email : null;
  const requiresOpenaiAuth = result?.requiresOpenaiAuth === true;
  const authMode = account?.type ?? null;
  const authenticated = account !== null && authMode !== null;
  let identityMatch = { state: 'unknown', accountId: null, matchedBy: null, rawIdentityReturned: false, rawIdentityPersisted: false };
  if (typeof identityMatcher === 'function' && account) {
    try {
      const matcherResult = identityMatcher({
        observedProviderId: providerId,
        email: rawEmail,
        providerPrincipalRef: result?.account?.subject ?? result?.account?.id ?? null,
        accountType: account.type,
      });
      if (assertPrivateMatcherResultSafe(matcherResult).length === 0) identityMatch = redactPrivateMatcherResult(matcherResult);
    } catch {
      identityMatch = { state: 'unknown', accountId: null, matchedBy: null, rawIdentityReturned: false, rawIdentityPersisted: false };
    }
  }
  const status = authenticated ? 'authenticated' : requiresOpenaiAuth ? 'not_authenticated' : 'not_applicable';
  let expectedPrincipalMatch = 'unknown';
  if (expectedPrincipal?.matchStrategy === 'provider_asserted_id' && account?.providerPrincipalRef) {
    expectedPrincipalMatch = expectedPrincipal.principalRef === account.providerPrincipalRef ? 'verified' : 'mismatched';
  }
  return {
    state: account || result ? 'confirmed' : 'unknown',
    status,
    source: CODEX_APP_SERVER_OBSERVER_ID,
    observerVersion: CODEX_APP_SERVER_OBSERVER_VERSION,
    authMode,
    requiresOpenaiAuth,
    accountType: account?.type ?? null,
    planType: account?.planType ?? null,
    emailPresent: account?.emailPresent ?? false,
    canonicalAccountId: identityMatch.accountId,
    identityMatch: identityMatch.state,
    identityMatchMethod: identityMatch.matchedBy,
    observedPrincipalRef: account?.providerPrincipalRef ?? null,
    expectedPrincipalMatch,
    refreshTokenRequested: false,
    rawResponseRead: true,
    secretsExcluded: true,
    limitation: account?.emailPresent && !account?.providerPrincipalRef
      ? 'provider_exposes_email_without_stable_non_personal_principal_id'
      : null,
  };
}

function parseLine(line) {
  try {
    const value = JSON.parse(line);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function observeCodexAppServerAccount({
  root,
  executable = 'codex',
  spawnProcess = spawn,
  timeoutMs = 10_000,
  cwd,
  expectedPrincipal,
  identityMatcher,
  providerId = 'openai',
  clientInfo = { name: 'brain-account-observer', title: 'Brain Account Observer', version: '1.0.0' },
} = {}) {
  if (!root) return Promise.resolve({ state: 'unknown', status: 'error', reason: 'runtime_root_required', secretsExcluded: true });
  return new Promise((resolve) => {
    let settled = false;
    let buffer = '';
    let initialized = false;
    let timeout;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    let child;
    try {
      child = spawnProcess(executable, ['app-server', '--listen', 'stdio://'], {
        cwd,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME ?? process.cwd(),
          CODEX_HOME: root,
        },
        stdio: ['pipe', 'pipe', 'ignore'],
        shell: false,
      });
    } catch (error) {
      finish({ state: 'unknown', status: 'unavailable', reason: error?.code ?? 'app_server_spawn_failed', secretsExcluded: true });
      return;
    }
    timeout = setTimeout(() => {
      if (typeof child.kill === 'function') child.kill('SIGTERM');
      finish({ state: 'unknown', status: 'timeout', reason: 'app_server_observation_timeout', secretsExcluded: true });
    }, timeoutMs);
    child.stdout?.setEncoding?.('utf8');
    child.stdout?.on?.('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = parseLine(line);
        if (!message) continue;
        if (message.id === 1 && !initialized) {
          initialized = true;
          try {
            child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
            child.stdin.write(`${JSON.stringify({ method: 'account/read', id: 2, params: { refreshToken: false } })}\n`);
          } catch (error) {
            finish({ state: 'unknown', status: 'unavailable', reason: error?.code ?? 'app_server_write_failed', secretsExcluded: true });
          }
        } else if (message.id === 2) {
          finish(redactCodexAccountRead({ response: message, expectedPrincipal, identityMatcher, providerId }));
          child.stdin.end();
        }
      }
    });
    child.on?.('error', (error) => finish({ state: 'unknown', status: 'unavailable', reason: error?.code ?? 'app_server_error', secretsExcluded: true }));
    child.on?.('close', (code) => {
      if (!settled) finish({ state: 'unknown', status: 'error', reason: code === 0 ? 'account_read_missing' : 'app_server_exit', secretsExcluded: true });
    });
    try {
      child.stdin.write(`${JSON.stringify({ method: 'initialize', id: 1, params: { clientInfo } })}\n`);
    } catch (error) {
      finish({ state: 'unknown', status: 'unavailable', reason: error?.code ?? 'app_server_write_failed', secretsExcluded: true });
    }
  });
}
