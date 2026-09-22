import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildJarvisReadOnlyContext } from '../agent-mode/jarvis-read-only-context.js';

test('bounded read-only context contains safe repository metadata and excludes sensitive entries', () => {
  const root = mkdtempSync('/tmp/brain-jarvis-context-');
  mkdirSync(path.join(root, '.git'));
  mkdirSync(path.join(root, 'src'));
  mkdirSync(path.join(root, '.aws'));
  writeFileSync(path.join(root, 'README.md'), '# Example\nA bounded repository.');
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'example', scripts: { test: 'node test.js' }, dependencies: { zod: '^1.0.0' } }));
  writeFileSync(path.join(root, '.env'), 'must not appear');
  const result = buildJarvisReadOnlyContext([{
    schemaVersion: 'agent-mode.jarvis-context.v1',
    contextId: 'context:example',
    contextKey: 'context-key:example',
    rootGoalId: 'root:example',
    kind: 'repository',
    canonicalPath: realpathSync(root),
    repositoryRef: 'example/repo',
    requestedAccess: 'read',
    admittedAccess: 'read',
    recursive: true,
    origin: 'repos-client',
    admissionStatus: 'admitted',
    admissionRef: 'context-admission:example',
    createdAt: '2026-09-22T00:00:00.000Z',
  }]);
  assert.match(result ?? '', /repositoryRef: example\/repo/);
  assert.match(result ?? '', /gitBranch: /);
  assert.match(result ?? '', /README\.md/);
  assert.match(result ?? '', /example/);
  assert.doesNotMatch(result ?? '', /must not appear|\.aws/);
});
