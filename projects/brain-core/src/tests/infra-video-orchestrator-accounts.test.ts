import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';
import {
  getInfraVOAccounts,
  getInfraVOAuthStatus,
  _injectKeychainReaderForTesting,
  _injectPoolForTesting,
} from '../adapters/infra-video-orchestrator-accounts.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePool(rows: Record<string, unknown>[]): pg.Pool {
  return {
    connect: async () => ({
      query: async () => ({ rows, rowCount: rows.length }),
      release: () => undefined,
    }),
    on: () => undefined,
  } as unknown as pg.Pool;
}

function makeFailingPool(): pg.Pool {
  return {
    connect: async () => {
      throw new Error('Connection refused');
    },
    on: () => undefined,
  } as unknown as pg.Pool;
}

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createRequest(input: { method?: string; url?: string; remoteAddress?: string }): IncomingMessage {
  const request: IncomingMessage = {
    socket: {
      remoteAddress: input.remoteAddress ?? '127.0.0.1',
    },
  };

  if (input.method !== undefined) request.method = input.method;
  if (input.url !== undefined) request.url = input.url;
  return request;
}

async function exercise(input: { method?: string; url?: string; remoteAddress?: string }): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

function makeUpdatePool(rows: Record<string, unknown>[]): pg.Pool {
  return {
    connect: async () => ({
      query: async (_sql: string, params?: unknown[]) => {
        const handle = params?.[1];
        const authMethod = params?.[0];
        const row = rows.find((entry) => entry.account_handle === handle);
        return {
          rows: row ? [{ ...row, auth_method: authMethod }] : [],
          rowCount: row ? 1 : 0,
        };
      },
      release: () => undefined,
    }),
    on: () => undefined,
  } as unknown as pg.Pool;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('getInfraVOAccounts returns ok response with accounts array', async () => {
  const fakeRows = [
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      account_handle: '@test_youtube',
      platform: 'youtube',
      account_status: 'active',
      auth_method: 'oauth2',
    },
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      account_handle: '@test_tiktok',
      platform: 'tiktok',
      account_status: 'active',
      auth_method: 'manual',
    },
  ];

  _injectPoolForTesting(makePool(fakeRows));
  const result = await getInfraVOAccounts();
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.accounts), 'accounts must be an array');
  assert.equal(result.accounts.length, 2);
  assert.equal(result.totalCount, 2);
  assert.equal(result.accounts[0]?.accountHandle, '@test_youtube');
  assert.equal(result.accounts[1]?.platform, 'tiktok');
});

test('getInfraVOAccounts returns byPlatform counts correctly', async () => {
  const fakeRows = [
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      account_handle: '@yt_account_1',
      platform: 'youtube',
      account_status: 'active',
      auth_method: 'oauth2',
    },
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      account_handle: '@yt_account_2',
      platform: 'youtube',
      account_status: 'inactive',
      auth_method: 'oauth2',
    },
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000003',
      account_handle: '@tt_account_1',
      platform: 'tiktok',
      account_status: 'active',
      auth_method: 'manual',
    },
  ];

  _injectPoolForTesting(makePool(fakeRows));
  const result = await getInfraVOAccounts();
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.equal(result.byPlatform['youtube'], 2, 'byPlatform youtube must be 2');
  assert.equal(result.byPlatform['tiktok'], 1, 'byPlatform tiktok must be 1');
  assert.equal(result.totalCount, 3);
});

test('getInfraVOAccounts returns error gracefully when DB unreachable', async () => {
  _injectPoolForTesting(makeFailingPool());
  const result = await getInfraVOAccounts();
  _injectPoolForTesting(null);

  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string', 'error must be a string');
  assert.ok(result.error.length > 0, 'error must be non-empty');
  assert.ok(Array.isArray(result.accounts), 'accounts must still be an array on error');
  assert.equal(result.accounts.length, 0);
  assert.equal(result.totalCount, 0);
});

test('getInfraVOAccounts handles empty accounts table', async () => {
  _injectPoolForTesting(makePool([]));
  const result = await getInfraVOAccounts();
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.accounts), 'accounts must be an array');
  assert.equal(result.accounts.length, 0);
  assert.equal(result.totalCount, 0);
  assert.deepEqual(result.byPlatform, {}, 'byPlatform must be empty for empty table');
});

test('getInfraVOAuthStatus returns OAuth readiness without token material', async () => {
  const expiresAt = '2026-05-22T12:00:00.000Z';
  _injectPoolForTesting(makePool([
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      account_handle: '@test_youtube',
      platform: 'youtube',
      account_status: 'active',
      auth_method: 'oauth2',
    },
    {
      account_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      account_handle: '@test_tiktok',
      platform: 'tiktok',
      account_status: 'active',
      auth_method: 'manual',
    },
  ]));
  _injectKeychainReaderForTesting(async (handle) => ({
    hasToken: handle === '@test_youtube',
    expiresAtIso: handle === '@test_youtube' ? expiresAt : null,
  }));

  const result = await getInfraVOAuthStatus();

  _injectKeychainReaderForTesting(null);
  _injectPoolForTesting(null);

  assert.equal(result.ok, true);
  assert.equal(result.accounts[0]?.oauthReady, true);
  assert.equal(result.accounts[0]?.tokenExpiry, expiresAt);
  assert.equal(result.accounts[1]?.oauthReady, false);
  assert.equal(JSON.stringify(result).includes('access_token'), false);
  assert.equal(JSON.stringify(result).includes('refresh_token'), false);
});

test('POST /infra/video-orchestrator/accounts/:handle/auth-method contains valid mutation requests', async () => {
  _injectPoolForTesting(makeUpdatePool([]));

  const response = await exercise({
    method: 'POST',
    url: '/infra/video-orchestrator/accounts/%40says-the-bible/auth-method?auth_method=oauth2',
  });
  const body = JSON.parse(response.body) as {
    ok: boolean;
    code?: string;
    safety?: { requestBodyRead: boolean; approvalBypassAllowed: boolean };
  };

  _injectPoolForTesting(null);

  assert.equal(response.statusCode, 503);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'mutable_capability_contained');
  assert.equal(body.safety?.requestBodyRead, false);
  assert.equal(body.safety?.approvalBypassAllowed, false);
});

test('POST /infra/video-orchestrator/accounts/:handle/auth-method contains invalid auth-method requests', async () => {
  _injectPoolForTesting(makeUpdatePool([]));

  const response = await exercise({
    method: 'POST',
    url: '/infra/video-orchestrator/accounts/%40says-the-bible/auth-method?auth_method=password',
  });
  const body = JSON.parse(response.body) as {
    ok: boolean;
    code?: string;
    safety?: { requestBodyRead: boolean; approvalBypassAllowed: boolean };
  };

  _injectPoolForTesting(null);

  assert.equal(response.statusCode, 503);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'mutable_capability_contained');
  assert.equal(body.safety?.requestBodyRead, false);
  assert.equal(body.safety?.approvalBypassAllowed, false);
});

test('POST /infra/video-orchestrator/accounts/:handle/auth-method contains unknown-handle requests', async () => {
  _injectPoolForTesting(makeUpdatePool([]));

  const response = await exercise({
    method: 'POST',
    url: '/infra/video-orchestrator/accounts/%40unknown/auth-method?auth_method=oauth2',
  });
  const body = JSON.parse(response.body) as {
    ok: boolean;
    code?: string;
    safety?: { requestBodyRead: boolean; approvalBypassAllowed: boolean };
  };

  _injectPoolForTesting(null);

  assert.equal(response.statusCode, 503);
  assert.equal(body.ok, false);
  assert.equal(body.code, 'mutable_capability_contained');
  assert.equal(body.safety?.requestBodyRead, false);
  assert.equal(body.safety?.approvalBypassAllowed, false);
});
