import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { getCanonicalInfrastructureTelemetry } from '../adapters/canonical-infrastructure-telemetry.js';

test('canonical telemetry keeps exactly three hosts and does not map historical dokploy', async () => {
  const originalKey = process.env.NEW_RELIC_USER_API_KEY;
  const originalAccount = process.env.NEW_RELIC_ACCOUNT_ID;
  process.env.NEW_RELIC_USER_API_KEY = 'test-key';
  process.env.NEW_RELIC_ACCOUNT_ID = '7019441';
  const now = new Date('2026-08-26T23:00:00.000Z');
  const currentSample = Date.parse('2026-08-26T22:59:00.000Z');
  const fetchMock = mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
    assert.match(body.query ?? '', /hostSamples/);
    assert.match(body.query ?? '', /networkSamples/);
    assert.doesNotMatch(body.query ?? '', /test-key/);
    return new Response(JSON.stringify({
      data: {
        actor: {
          hosts: { results: { entities: [
            { guid: 'supabase-guid', name: 'supabase', reporting: true, alertSeverity: 'NOT_ALERTING' },
            { guid: 'historical-dokploy-guid', name: 'dokploy', reporting: true, alertSeverity: 'NOT_ALERTING' },
          ] } },
          account: {
            hostSamples: { results: [{ facet: 'supabase', 'latest.timestamp': currentSample, 'latest.cpuPercent': 12, 'latest.loadAverageOneMinute': 0.2, 'latest.memoryUsedBytes': 400, 'latest.memoryTotalBytes': 1000, 'latest.memoryUsedPercent': 40, 'latest.swapUsedBytes': 10, 'latest.swapTotalBytes': 100, 'latest.uptime': 1000, 'latest.agentVersion': '1.69.0' }] },
            storageSamples: { results: [{ facet: ['supabase', '/'], 'latest.timestamp': currentSample, 'latest.diskUsedBytes': 40, 'latest.diskTotalBytes': 100, 'latest.diskFreeBytes': 60, 'latest.diskUsedPercent': 40, 'latest.inodeUsedPercent': null }] },
            networkSamples: { results: [{ facet: ['supabase', 'eth0'], 'latest.timestamp': currentSample, 'latest.receiveBytesPerSecond': 12, 'latest.transmitBytesPerSecond': 8, 'latest.receiveErrorsPerSecond': 0, 'latest.transmitErrorsPerSecond': 0 }] },
            processSamples: { results: [{ facet: 'supabase', 'uniqueCount.processId': 25 }] },
            containerSamples: { results: [{ facet: 'supabase', 'latest.timestamp': currentSample, 'uniqueCount.containerId': 15, 'latest.restartCount': 0, 'latest.state': 'running' }] },
          },
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  try {
    const result = await getCanonicalInfrastructureTelemetry({ now, forceRefresh: true });
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.hosts.map((host) => host.name), ['dokploy-aws', 'cloudpanel-aws', 'vm-supabase']);
    assert.equal(result.hosts[0]?.state, 'UNKNOWN');
    assert.equal(result.hosts[1]?.state, 'UNKNOWN');
    assert.equal(result.hosts[2]?.state, 'CRITICAL');
    assert.equal(result.hosts[2]?.entity.guid, 'supabase-guid');
    assert.equal(result.hosts[2]?.entity.continuityAlias, 'supabase');
    assert.equal(result.hosts[2]?.metrics.storage[0]?.mountPoint, '/');
    assert.equal(result.hosts[2]?.runtime.runningContainers, 15);
    assert.equal(result.staleEntities[0]?.name, 'dokploy');
  } finally {
    fetchMock.mock.restore();
    if (originalKey === undefined) delete process.env.NEW_RELIC_USER_API_KEY;
    else process.env.NEW_RELIC_USER_API_KEY = originalKey;
    if (originalAccount === undefined) delete process.env.NEW_RELIC_ACCOUNT_ID;
    else process.env.NEW_RELIC_ACCOUNT_ID = originalAccount;
  }
});
