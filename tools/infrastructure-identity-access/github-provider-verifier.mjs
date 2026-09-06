#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export const GITHUB_API_ORIGIN = 'https://api.github.com';
export const GITHUB_API_VERSION = '2026-03-10';
export const GITHUB_USER_PATH = '/user';
export const GITHUB_MAX_RESPONSE_BYTES = 64 * 1024;
export const GITHUB_REQUEST_TIMEOUT_MS = 5000;
export const GITHUB_OVERALL_TIMEOUT_MS = 8000;
const GITHUB_CREDENTIAL_TYPES = new Set(['fine_grained_pat', 'classic_pat', 'oauth_access_token', 'github_app_user_token', 'other', 'unknown']);
const OAUTH_SCOPE_TYPES = new Set(['classic_pat', 'oauth_access_token']);
const PROXY_ENVIRONMENT_KEYS = Object.freeze(['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']);
const SAFE_SCOPE_RE = /^[^\u0000-\u001f\u007f]{1,256}$/;
const SAFE_LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

function output(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function baseResult(credentialType) {
  return {
    providerId: 'github',
    providerCredentialType: credentialType,
    transportCheck: 'stdin_only',
    refreshAvailable: null,
    expiryMetadataSource: 'unknown',
  };
}

function result(credentialType, resultCode, reasonCode, extra = {}) {
  return { ...baseResult(credentialType), resultCode, reasonCode, ...extra };
}

function readCredentialType(args) {
  if (args.length !== 2 || args[0] !== '--credential-type' || !GITHUB_CREDENTIAL_TYPES.has(args[1])) return null;
  return args[1];
}

function readSecret() {
  const secret = fs.readFileSync(0, 'utf8').replace(/\n$/, '');
  if (secret.length === 0 || secret.length > 4096 || /[\u0000-\u001f\u007f]/.test(secret)) return null;
  if (process.argv.slice(2).some((arg) => arg.includes(secret))) return null;
  return secret;
}

function proxyEnvironmentPresent(environment = process.env) {
  return PROXY_ENVIRONMENT_KEYS.some((key) => typeof environment[key] === 'string' && environment[key].length > 0);
}

function safeHeader(headers, name) {
  const value = headers?.[name.toLowerCase()];
  return typeof value === 'string' && value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';
}

function integerHeader(headers, name) {
  const value = safeHeader(headers, name);
  if (!/^\d{1,12}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function rateLimitSummary(headers) {
  const limit = integerHeader(headers, 'x-ratelimit-limit');
  const remaining = integerHeader(headers, 'x-ratelimit-remaining');
  const reset = integerHeader(headers, 'x-ratelimit-reset');
  const retryAfter = integerHeader(headers, 'retry-after');
  const summary = {};
  if (limit !== null) summary.limit = limit;
  if (remaining !== null) summary.remaining = remaining;
  if (reset !== null && reset >= 0 && reset <= 4102444800) summary.resetAt = new Date(reset * 1000).toISOString();
  if (retryAfter !== null && retryAfter <= 31536000) summary.retryAfterSeconds = retryAfter;
  return Object.keys(summary).length > 0 ? summary : null;
}

function isRateLimited(statusCode, headers) {
  return statusCode === 429 || integerHeader(headers, 'x-ratelimit-remaining') === 0 || integerHeader(headers, 'retry-after') !== null;
}

function parseScopeHeader(headers, credentialType) {
  const raw = safeHeader(headers, 'x-oauth-scopes');
  if (!OAUTH_SCOPE_TYPES.has(credentialType)) return { scopes: [], scopeEvidence: credentialType === 'unknown' ? 'unknown' : 'not_observable' };
  if (raw === '') return { scopes: [], scopeEvidence: 'not_observable' };
  const scopes = raw.split(',').map((scope) => scope.trim()).filter((scope) => SAFE_SCOPE_RE.test(scope));
  return scopes.length === raw.split(',').filter((scope) => scope.trim()).length
    ? { scopes: [...new Set(scopes)], scopeEvidence: 'provider_observed' }
    : { scopes: [], scopeEvidence: 'unknown' };
}

function parseUserBody(body, headers, credentialType) {
  if (!/^application\/json(?:\s*;|$)/i.test(safeHeader(headers, 'content-type'))) {
    return result(credentialType, 'unknown', 'provider_response_unexpected');
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return result(credentialType, 'unknown', 'provider_response_malformed');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Number.isSafeInteger(parsed.id) || parsed.id < 1 || !SAFE_LOGIN_RE.test(parsed.login ?? '')) {
    return result(credentialType, 'unknown', 'provider_response_malformed');
  }
  const { scopes, scopeEvidence } = parseScopeHeader(headers, credentialType);
  return result(credentialType, 'accepted', 'provider_success', {
    principal: String(parsed.id),
    principalLabel: parsed.login,
    scopes,
    scopeEvidence,
    rateLimit: rateLimitSummary(headers),
  });
}

function requestUser({ token, origin = GITHUB_API_ORIGIN, allowTestOrigin = false, requestModule = https, requestTimeoutMs = GITHUB_REQUEST_TIMEOUT_MS, overallTimeoutMs = GITHUB_OVERALL_TIMEOUT_MS }) {
  const url = new URL(`${origin}${GITHUB_USER_PATH}`);
  if (!allowTestOrigin && url.origin !== GITHUB_API_ORIGIN) {
    return Promise.resolve({ kind: 'policy', reasonCode: 'provider_redirect_rejected' });
  }
  if (url.pathname !== GITHUB_USER_PATH || url.search || url.hash) {
    return Promise.resolve({ kind: 'policy', reasonCode: 'provider_redirect_rejected' });
  }
  return new Promise((resolve) => {
    let settled = false;
    let overallTimer;
    let body = '';
    let bodyBytes = 0;
    let responseTooLarge = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (overallTimer) clearTimeout(overallTimer);
      resolve(value);
    };
    const request = requestModule.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'brain-identity-access/1',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      ...(url.protocol === 'https:' ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : {}),
    }, (response) => {
      const headers = Object.fromEntries(Object.entries(response.headers ?? {}).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(',') : String(value ?? '')]));
      const statusCode = Number.isInteger(response.statusCode) ? response.statusCode : 0;
      if (statusCode >= 300 && statusCode < 400) {
        response.resume();
        finish({ kind: 'redirect', statusCode, headers });
        return;
      }
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        bodyBytes += Buffer.byteLength(chunk, 'utf8');
        if (bodyBytes <= GITHUB_MAX_RESPONSE_BYTES) body += chunk;
        else {
          responseTooLarge = true;
          response.destroy();
        }
      });
      response.once('error', () => finish({ kind: responseTooLarge ? 'oversized' : 'response_error' }));
      response.once('end', () => finish({ kind: 'response', statusCode, headers, body: bodyBytes <= GITHUB_MAX_RESPONSE_BYTES ? body : '' }));
    });
    request.setTimeout(requestTimeoutMs, () => {
      request.destroy();
      finish({ kind: 'timeout' });
    });
    request.once('error', (error) => {
      const code = typeof error?.code === 'string' ? error.code : '';
      finish({ kind: code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ? 'tls_error' : 'network_error' });
    });
    request.end();
    overallTimer = setTimeout(() => {
      request.destroy();
      finish({ kind: 'timeout' });
    }, overallTimeoutMs).unref();
  });
}

function normalizeResponse(response, credentialType) {
  const safeType = GITHUB_CREDENTIAL_TYPES.has(credentialType) ? credentialType : 'unknown';
  if (response.kind === 'response') {
    const rateLimit = rateLimitSummary(response.headers);
    if (isRateLimited(response.statusCode, response.headers)) {
      return result(safeType, 'provider_unavailable', 'provider_rate_limited', { rateLimit });
    }
    if (response.statusCode === 200) return parseUserBody(response.body, response.headers, safeType);
    if (response.statusCode === 401) return result(safeType, 'rejected', 'provider_authentication_failed', { rateLimit });
    if (response.statusCode === 403) {
      if (safeHeader(response.headers, 'x-github-sso') !== '') return result(safeType, 'reauthentication_required', 'provider_policy_required', { rateLimit });
      return result(safeType, 'unknown', 'provider_forbidden', { rateLimit });
    }
    if (response.statusCode >= 500 && response.statusCode <= 599) return result(safeType, 'provider_unavailable', 'provider_network_failed', { rateLimit });
    return result(safeType, 'unknown', 'provider_response_unexpected', { rateLimit });
  }
  if (response.kind === 'oversized') return result(safeType, 'unknown', 'provider_response_oversized');
  if (response.kind === 'redirect') return result(safeType, 'unknown', 'provider_redirect_rejected');
  if (response.kind === 'timeout') return result(safeType, 'provider_unavailable', 'provider_timeout');
  if (response.kind === 'tls_error') return result(safeType, 'provider_unavailable', 'provider_tls_failed');
  if (response.kind === 'policy') {
    return result(safeType, response.reasonCode === 'provider_proxy_blocked' ? 'provider_unavailable' : 'unknown', response.reasonCode);
  }
  return result(safeType, 'provider_unavailable', 'provider_network_failed');
}

export async function verifyGitHubCredential({ token, credentialType = 'unknown', request } = {}) {
  const safeType = GITHUB_CREDENTIAL_TYPES.has(credentialType) ? credentialType : 'unknown';
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096 || /[\u0000-\u001f\u007f]/.test(token)) {
    return result(safeType, 'rejected', 'provider_input_invalid');
  }
  if (process.argv.slice(2).some((arg) => arg.includes(token))) return result(safeType, 'unknown', 'provider_input_invalid');
  const requestFunction = request ?? ((value) => proxyEnvironmentPresent()
    ? Promise.resolve({ kind: 'policy', reasonCode: 'provider_proxy_blocked' })
    : requestUser({ token: value }));
  if (typeof requestFunction !== 'function') return result(safeType, 'provider_unavailable', 'provider_network_failed');
  try {
    return normalizeResponse(await requestFunction(token), safeType);
  } catch {
    return result(safeType, 'provider_unavailable', 'provider_network_failed');
  }
}

export function requestGitHubUserForTestOnly({ token, origin, requestTimeoutMs = GITHUB_REQUEST_TIMEOUT_MS, overallTimeoutMs = GITHUB_OVERALL_TIMEOUT_MS }) {
  return requestUser({ token, origin, allowTestOrigin: true, requestModule: origin?.startsWith('https:') ? https : http, requestTimeoutMs, overallTimeoutMs });
}

async function main() {
  const credentialType = readCredentialType(process.argv.slice(2));
  if (!credentialType) {
    output(result('unknown', 'unknown', 'provider_credential_type_unknown'));
    return;
  }
  let token;
  try {
    token = readSecret();
  } catch {
    output(result(credentialType, 'rejected', 'provider_input_invalid'));
    return;
  }
  if (!token) {
    output(result(credentialType, 'rejected', 'provider_input_invalid'));
    return;
  }
  if (proxyEnvironmentPresent()) {
    output(result(credentialType, 'provider_unavailable', 'provider_proxy_blocked'));
    return;
  }
  output(await verifyGitHubCredential({ token, credentialType }));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
