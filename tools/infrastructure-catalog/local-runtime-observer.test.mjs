import assert from 'node:assert/strict';
import test from 'node:test';

import { discoverLocalRuntime, parseListeningSockets, parseProcessList } from './local-runtime-observer.mjs';

test('process parser emits identity metadata without arguments or environment', () => {
  const processes = parseProcessList(' 11 1 /usr/local/bin/alpha-client S\n 12 11 beta-runner R\n');
  assert.deepEqual(processes, [
    { pid: 11, parentPid: 1, commandIdentity: 'alpha-client', state: 'S' },
    { pid: 12, parentPid: 11, commandIdentity: 'beta-runner', state: 'R' },
  ]);
});

test('listener parser emits loopback endpoint metadata only', () => {
  const listeners = parseListeningSockets('p11\ncalpha-client\nPTCP\nn127.0.0.1:18001\nn0.0.0.0:18002\n');
  assert.deepEqual(listeners, [
    { ownerProcessId: 11, commandIdentity: 'alpha-client', protocol: 'tcp', hostClass: 'loopback', port: 18001, reachability: 'listening' },
    { ownerProcessId: 11, commandIdentity: 'alpha-client', protocol: 'tcp', hostClass: 'unknown', port: 18002, reachability: 'listening' },
  ]);
});

test('local runtime observer is read-only and keeps owner/environment unknown', () => {
  const result = discoverLocalRuntime({
    now: '2026-09-05T00:00:00Z',
    run: (command) => command === '/bin/ps'
      ? { ok: true, stdout: ' 21 1 /usr/local/bin/gamma-runner S\n' }
      : { ok: true, stdout: 'p21\ngamma-runner\nPTCP\nn127.0.0.1:19001\n' },
  });
  assert.equal(result.processCount, 1);
  assert.equal(result.listenerCount, 1);
  assert.equal(result.observations[0].ownershipEvidence.state, 'unknown');
  assert.equal(result.observations[0].environment.state, 'unknown');
  assert.equal(result.observations[0].redaction.secretsExcluded, true);
});
