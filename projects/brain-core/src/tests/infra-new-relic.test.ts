import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { PathLike } from 'node:fs';
import test, { mock } from 'node:test';

import { getInfraNewRelicStatus } from '../adapters/infra-new-relic.js';

test('getInfraNewRelicStatus falls back to ~/.config/newrelic/.env when process env is empty', async () => {
  const originalEnv = {
    NEW_RELIC_USER_API_KEY: process.env.NEW_RELIC_USER_API_KEY,
    NEW_RELIC_ACCOUNT_ID: process.env.NEW_RELIC_ACCOUNT_ID,
  };

  process.env.NEW_RELIC_USER_API_KEY = '';
  process.env.NEW_RELIC_ACCOUNT_ID = '';

  const existsSyncMock = mock.method(fs, 'existsSync', (filePath: PathLike) => {
    return String(filePath).includes('.config/newrelic/.env');
  });
  const readFileSyncMock = mock.method(fs, 'readFileSync', (filePath: PathLike) => {
    assert.ok(String(filePath).includes('.config/newrelic/.env'));
    return [
      'NEW_RELIC_ACCOUNT_ID=7019441',
      'NEW_RELIC_USER_API_KEY=nr-user-api-key',
      'NEW_RELIC_REGION=EU',
    ].join('\n');
  });

  const fetchMock = mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>)['API-Key'], 'nr-user-api-key');
    const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
    assert.ok(body.query?.includes('accountId = 7019441'));

    return new Response(
      JSON.stringify({
        data: {
          actor: {
            hosts: { results: { entities: [{ name: 'dokploy', reporting: true, alertSeverity: 'WARNING' }] } },
            synthetics: { results: { entities: [{ name: 'prochat.tools', reporting: true, alertSeverity: 'NOT_ALERTING', monitorId: '123' }] } },
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  try {
    const status = await getInfraNewRelicStatus();
    assert.equal(status.status, 'ok');
    assert.equal(status.hosts.length, 1);
    assert.equal(status.hosts[0]?.name, 'dokploy');
    assert.equal(status.synthetics.length, 1);
    assert.equal(status.synthetics[0]?.monitorId, '123');
  } finally {
    fetchMock.mock.restore();
    readFileSyncMock.mock.restore();
    existsSyncMock.mock.restore();
    process.env.NEW_RELIC_USER_API_KEY = originalEnv.NEW_RELIC_USER_API_KEY;
    process.env.NEW_RELIC_ACCOUNT_ID = originalEnv.NEW_RELIC_ACCOUNT_ID;
  }
});
