import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    assert.equal(result.hosts[2]?.state, 'HEALTHY');
    assert.equal(result.hosts[2]?.backup.state, 'HEALTHY');
    assert.equal(result.hosts[2]?.backup.status, 'SUCCESS');
    assert.equal(result.hosts[2]?.backup.runId, '20260830T043005Z');
    assert.equal(result.hosts[2]?.backup.remoteVerification, 'PARTIAL');
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

test('generated Phase 3X receipt takes precedence over tracked fallback', async () => {
  const originalKey = process.env.NEW_RELIC_USER_API_KEY;
  const originalAccount = process.env.NEW_RELIC_ACCOUNT_ID;
  const root = path.join(os.homedir(), `.canonical-infrastructure-telemetry-${process.pid}-${Date.now()}`);
  fs.mkdirSync(root, { recursive: true });
  const currentSample = Date.parse('2026-08-30T11:40:00.000Z');
  fs.mkdirSync(path.join(root, 'runtime/local/infrastructure'), { recursive: true });
  fs.mkdirSync(path.join(root, 'operations/infrastructure/health'), { recursive: true });
  fs.writeFileSync(path.join(root, 'runtime/local/infrastructure/backup-runtime-state.json'), JSON.stringify({ states: [{ backupJobId: 'backup_job:supabase-recovery', state: 'HEALTHY', status: 'SUCCESS', reason: 'generated receipt', runId: 'generated-run', localValidation: 'PASS', remoteVerification: 'PARTIAL', tempResourcesCleaned: true, productionLogicalDumpUsed: false, productionTouched: false }] }));
  fs.writeFileSync(path.join(root, 'operations/infrastructure/health/backup-runtime-state.v1.json'), JSON.stringify({ states: [{ backupJobId: 'backup_job:supabase-recovery', state: 'FAILED', status: 'FAILED', reason: 'retired fallback' }] }));
  process.env.NEW_RELIC_USER_API_KEY = 'test-key';
  process.env.NEW_RELIC_ACCOUNT_ID = '7019441';
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    data: { actor: { hosts: { results: { entities: [{ guid: 'supabase-guid', name: 'supabase', reporting: true, alertSeverity: 'NOT_ALERTING' }] } }, account: {
      hostSamples: { results: [{ facet: 'supabase', 'latest.timestamp': currentSample, 'latest.cpuPercent': 12, 'latest.memoryUsedPercent': 40 }] },
      storageSamples: { results: [{ facet: ['supabase', '/'], 'latest.timestamp': currentSample, 'latest.diskUsedPercent': 40 }] },
      networkSamples: { results: [] }, processSamples: { results: [] }, containerSamples: { results: [] }, containerStateSamples: { results: [] }, historicalHostSamples: { results: [] },
    } } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  try {
    const result = await getCanonicalInfrastructureTelemetry({ root, now: new Date('2026-08-30T11:41:00.000Z'), forceRefresh: true });
    const supabase = result.hosts.find((host) => host.name === 'vm-supabase');
    assert.equal(supabase?.backup.state, 'HEALTHY');
    assert.equal(supabase?.backup.status, 'SUCCESS');
    assert.equal(supabase?.backup.runId, 'generated-run');
  } finally {
    fetchMock.mock.restore();
    fs.rmSync(root, { recursive: true, force: true });
    if (originalKey === undefined) delete process.env.NEW_RELIC_USER_API_KEY;
    else process.env.NEW_RELIC_USER_API_KEY = originalKey;
    if (originalAccount === undefined) delete process.env.NEW_RELIC_ACCOUNT_ID;
    else process.env.NEW_RELIC_ACCOUNT_ID = originalAccount;
  }
});

test('malformed generated Phase 3X receipt fails closed instead of using fallback', async () => {
  const originalKey = process.env.NEW_RELIC_USER_API_KEY;
  const originalAccount = process.env.NEW_RELIC_ACCOUNT_ID;
  const root = path.join(os.homedir(), `.canonical-infrastructure-telemetry-malformed-${process.pid}-${Date.now()}`);
  fs.mkdirSync(root, { recursive: true });
  const currentSample = Date.parse('2026-08-30T11:40:00.000Z');
  fs.mkdirSync(path.join(root, 'runtime/local/infrastructure'), { recursive: true });
  fs.mkdirSync(path.join(root, 'operations/infrastructure/health'), { recursive: true });
  fs.writeFileSync(path.join(root, 'runtime/local/infrastructure/backup-runtime-state.json'), '{');
  fs.writeFileSync(path.join(root, 'operations/infrastructure/health/backup-runtime-state.v1.json'), JSON.stringify({ states: [{ backupJobId: 'backup_job:supabase-recovery', state: 'HEALTHY', status: 'SUCCESS', reason: 'fallback must not win' }] }));
  process.env.NEW_RELIC_USER_API_KEY = 'test-key';
  process.env.NEW_RELIC_ACCOUNT_ID = '7019441';
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    data: { actor: { hosts: { results: { entities: [{ guid: 'supabase-guid', name: 'supabase', reporting: true, alertSeverity: 'NOT_ALERTING' }] } }, account: {
      hostSamples: { results: [{ facet: 'supabase', 'latest.timestamp': currentSample, 'latest.cpuPercent': 12, 'latest.memoryUsedPercent': 40 }] },
      storageSamples: { results: [{ facet: ['supabase', '/'], 'latest.timestamp': currentSample, 'latest.diskUsedPercent': 40 }] },
      networkSamples: { results: [] }, processSamples: { results: [] }, containerSamples: { results: [] }, containerStateSamples: { results: [] }, historicalHostSamples: { results: [] },
    } } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  try {
    const result = await getCanonicalInfrastructureTelemetry({ root, now: new Date('2026-08-30T11:41:00.000Z'), forceRefresh: true });
    const supabase = result.hosts.find((host) => host.name === 'vm-supabase');
    assert.equal(supabase?.backup.state, 'UNKNOWN');
    assert.match(supabase?.backup.reason ?? '', /malformed/);
  } finally {
    fetchMock.mock.restore();
    fs.rmSync(root, { recursive: true, force: true });
    if (originalKey === undefined) delete process.env.NEW_RELIC_USER_API_KEY;
    else process.env.NEW_RELIC_USER_API_KEY = originalKey;
    if (originalAccount === undefined) delete process.env.NEW_RELIC_ACCOUNT_ID;
    else process.env.NEW_RELIC_ACCOUNT_ID = originalAccount;
  }
});
