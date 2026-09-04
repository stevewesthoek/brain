import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const computer = fs.readFileSync(path.join(root, 'components', 'computer-overview.tsx'), 'utf8');
const operations = fs.readFileSync(path.join(root, 'components', 'operations-overview.tsx'), 'utf8');
const cache = fs.readFileSync(path.join(root, 'lib', 'optional-endpoint-cache.ts'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'components', 'shell.tsx'), 'utf8');

test('Computer workspace is backed by bounded current sources and has progressive disclosure', () => {
  assert.match(fs.readFileSync(path.join(root, 'app', 'computer', 'page.tsx'), 'utf8'), /ComputerOverview/);
  assert.match(computer, /\/ops\/system-metrics/);
  assert.match(computer, /\/local-apps\/dashboard/);
  assert.match(computer, /\/runtime\/identity/);
  assert.match(computer, /\/infra\/scheduler/);
  assert.match(computer, /\/infra\/tunnels/);
  assert.match(computer, /href="\/local-apps"/);
  assert.match(computer, /Not instrumented/);
  assert.match(computer, /DEGRADED/);
  assert.match(computer, /isPending/);
  assert.match(computer, /isError/);
});

test('Operations workspace composes scheduler, tunnel, runtime, attention, and Codex telemetry', () => {
  assert.match(fs.readFileSync(path.join(root, 'app', 'operations', 'page.tsx'), 'utf8'), /OperationsOverview/);
  for (const source of ['/infra/scheduler', '/infra/tunnels', '/ops/ai-usage-windows', '/runtime/identity', 'getOperationalSnapshot']) assert.match(operations, new RegExp(source.replaceAll('/', '\\/')));
  assert.match(operations, /Attention/);
  assert.match(operations, /href="\/scheduler"/);
  assert.match(operations, /href="\/tunnels"/);
  assert.match(operations, /isError/);
  assert.match(operations, /PENDING/);
});

test('legacy operational routes remain available as grouped detail routes', () => {
  for (const route of ['/local-apps', '/infrastructure', '/monitoring', '/scheduler', '/tunnels']) assert.match(shell, new RegExp(`href: '${route.replaceAll('/', '\\/')}'`));
});

test('optional missing reports use a time-bounded negative cache', () => {
  assert.match(cache, /DEFAULT_NEGATIVE_CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(cache, /error\.status === 404/);
  assert.match(cache, /optionalEndpointNegativeCache\.has/);
});
