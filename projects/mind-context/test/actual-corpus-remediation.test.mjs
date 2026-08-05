import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {parseGenericMetadata, normalizeLifecycle, parseBoldMd, parseFencedYaml} from '../src/core/index.mjs';
import {validateReadArgs} from '../src/provider/runtime.mjs';
import {resolveContextCommand} from '../src/core/gateway-commands.mjs';

// --- Defect 1: H1 + blank prologue before metadata ---

test('parseGenericMetadata: H1 then fenced YAML is parsed', () => {
  const md = '# Current Context — Mind\n\n```yaml\nstatus: current\nlast_reviewed: 2026-08-04\nreview_after: 2026-08-16\nfreshness_risk: medium\nowner: Steve Westhoek\n```\n\n## Body content\n';
  const result = parseGenericMetadata(md);
  assert.equal(result.data.status, 'current');
  assert.equal(result.data.last_reviewed, '2026-08-04');
  assert.equal(result.data.owner, 'Steve Westhoek');
});

test('parseGenericMetadata: H1 then bold MD is parsed', () => {
  const md = '# Post-Closeout Operational Assurance — 2026-08-04\n\n**Status:** active operational reference\n**Version:** 1.0\n**Last reviewed:** 2026-08-04\n**Owner role:** Steve Westhoek (human authority and decision owner)\n\nBody text here.\n';
  const result = parseGenericMetadata(md);
  assert.equal(result.data.status, 'active operational reference');
  assert.equal(result.data.version, 1);
  assert.equal(result.data.last_reviewed, '2026-08-04');
  assert.equal(result.data.owner_role, 'Steve Westhoek (human authority and decision owner)');
});

test('parseGenericMetadata: standard frontmatter still works', () => {
  const md = '---\ntitle: Test\nstatus: current\n---\n\nBody\n';
  const result = parseGenericMetadata(md);
  assert.equal(result.data.title, 'Test');
  assert.equal(result.data.status, 'current');
});

test('parseGenericMetadata: H1 + frontmatter after blank', () => {
  const md = '# Title\n\n---\nstatus: active\nauthority: canonical\n---\n\nContent\n';
  const result = parseGenericMetadata(md);
  assert.equal(result.data.status, 'active');
  assert.equal(result.data.authority, 'canonical');
});

test('parseGenericMetadata: no metadata returns empty data', () => {
  const md = '# Mind Cleanup Final Handoff — 2026-06-07\n\nThis handoff summarizes...\n';
  const result = parseGenericMetadata(md);
  assert.deepEqual(result.data, {});
});

test('parseGenericMetadata: prologue limited to 5 lines', () => {
  const md = '# Title\n\n\n\n\n\n```yaml\nstatus: current\n```\n';
  const result = parseGenericMetadata(md);
  // 6 lines before the yaml block: H1 + 5 blanks — only 5 prologue lines scanned
  assert.deepEqual(result.data, {});
});

// --- Defect 2: Bold keys normalized case-insensitively ---

test('parseBoldMd: keys are normalized to snake_case', () => {
  const md = '**Last reviewed:** 2026-08-04\n**Owner role:** Steve\n**Freshness Risk:** low\n\nBody\n';
  const result = parseBoldMd(md);
  assert.equal(result.data.last_reviewed, '2026-08-04');
  assert.equal(result.data.owner_role, 'Steve');
  assert.equal(result.data.freshness_risk, 'low');
});

test('parseFencedYaml: keys are normalized', () => {
  const md = '```yaml\nLast Reviewed: 2026-08-04\nReview After: 2026-09-01\n```\n\nBody\n';
  const result = parseFencedYaml(md);
  assert.equal(result.data.last_reviewed, '2026-08-04');
  assert.equal(result.data.review_after, '2026-09-01');
});

// --- Defect 3: Lifecycle normalization ---

test('normalizeLifecycle: active operational reference → current', () => {
  assert.equal(normalizeLifecycle('active operational reference'), 'current');
});

test('normalizeLifecycle: active reference → current', () => {
  assert.equal(normalizeLifecycle('active reference'), 'current');
});

test('normalizeLifecycle: operational → current', () => {
  assert.equal(normalizeLifecycle('operational'), 'current');
});

test('normalizeLifecycle: superseded → stale', () => {
  assert.equal(normalizeLifecycle('superseded'), 'stale');
});

test('normalizeLifecycle: ACTIVE OPERATIONAL REFERENCE (case-insensitive) → current', () => {
  assert.equal(normalizeLifecycle('ACTIVE OPERATIONAL REFERENCE'), 'current');
});

test('normalizeLifecycle: existing mappings still work', () => {
  assert.equal(normalizeLifecycle('current'), 'current');
  assert.equal(normalizeLifecycle('active'), 'current');
  assert.equal(normalizeLifecycle('latest'), 'current');
  assert.equal(normalizeLifecycle('live'), 'current');
  assert.equal(normalizeLifecycle('stale'), 'stale');
  assert.equal(normalizeLifecycle('archived'), 'stale');
  assert.equal(normalizeLifecycle('deprecated'), 'stale');
  assert.equal(normalizeLifecycle('outdated'), 'stale');
  assert.equal(normalizeLifecycle('old'), 'stale');
  assert.equal(normalizeLifecycle(''), 'unknown');
  assert.equal(normalizeLifecycle(null), 'unknown');
  assert.equal(normalizeLifecycle('draft'), 'unknown');
});

// --- Defect 4: Authority derivation ---

test('authority derivation: lifecycle=current without explicit authority → canonical', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-auth-'));
  fs.mkdirSync(path.join(root, 'system'));
  fs.writeFileSync(path.join(root, 'system', 'doc.md'), '# Title\n\n```yaml\nstatus: current\n```\n\nBody\n');
  const result = resolveContextCommand({
    query: 'test', root, scopes: ['system'], format: 'json', maxItems: 5, maxTokens: 500,
  });
  const source = result.pack.sources.find(s => s.path === 'system/doc.md');
  assert.ok(source, 'source must be found');
  assert.equal(source.authority, 'canonical');
  fs.rmSync(root, {recursive: true});
});

test('authority derivation: no metadata → supporting', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-auth-'));
  fs.mkdirSync(path.join(root, 'system'));
  fs.writeFileSync(path.join(root, 'system', 'report.md'), '# Old Report\n\nJust text.\n');
  const result = resolveContextCommand({
    query: 'report', root, scopes: ['system'], format: 'json', maxItems: 5, maxTokens: 500,
  });
  const source = result.pack.sources.find(s => s.path === 'system/report.md');
  assert.ok(source, 'source must be found');
  assert.equal(source.authority, 'supporting');
  fs.rmSync(root, {recursive: true});
});

test('authority derivation: explicit authority overrides lifecycle derivation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-auth-'));
  fs.mkdirSync(path.join(root, 'test'));
  fs.writeFileSync(path.join(root, 'test', 'doc.md'), '---\nstatus: current\nauthority: untrusted\n---\n\nBody\n');
  const result = resolveContextCommand({
    query: 'doc', root, scopes: ['test'], format: 'json', maxItems: 5, maxTokens: 500,
  });
  const source = result.pack.sources.find(s => s.path === 'test/doc.md');
  assert.ok(source, 'source must be found');
  assert.equal(source.authority, 'untrusted');
  fs.rmSync(root, {recursive: true});
});

// --- Defect 5+6: scopeSubset strict validation ---

test('scopeSubset: empty array is rejected by runtime', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: []}), /invalid_scope_subset/);
});

test('scopeSubset: string value is rejected by runtime', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: 'system'}), /invalid_scope_subset/);
});

test('scopeSubset: duplicate values rejected by runtime', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: ['system', 'system']}), /invalid_scope_subset/);
});

test('scopeSubset: more than 9 items rejected by runtime', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: ['a','b','c','d','e','f','g','h','i','j']}), /invalid_scope_subset/);
});

test('scopeSubset: null is accepted (no subset restriction)', () => {
  const result = validateReadArgs({query: 'test'});
  assert.equal(result.scopeSubset, undefined);
});

test('scopeSubset: traversal rejected', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: ['..', 'system']}), /invalid_scope_subset/);
});

test('scopeSubset: path prefix rejected', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: ['/etc/passwd']}), /invalid_scope_subset/);
});

test('scopeSubset: backslash rejected', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: ['sys\\tem']}), /invalid_scope_subset/);
});

test('scopeSubset: valid single scope accepted', () => {
  const result = validateReadArgs({query: 'test', scopeSubset: ['system']});
  assert.deepEqual(result.scopeSubset, ['system']);
});

test('scopeSubset: valid multiple scopes accepted', () => {
  const result = validateReadArgs({query: 'test', scopeSubset: ['system', 'tasks']});
  assert.deepEqual(result.scopeSubset, ['system', 'tasks']);
});

test('scopeSubset: non-string item rejected', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: [123]}), /invalid_scope_subset/);
});

test('scopeSubset: empty string item rejected', () => {
  assert.throws(() => validateReadArgs({query: 'test', scopeSubset: ['']}), /invalid_scope_subset/);
});

test('scopeSubset: empty array rejected by gateway normalizeScopeSubset', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-scope-'));
  fs.mkdirSync(path.join(root, 'system'));
  fs.writeFileSync(path.join(root, 'system', 'doc.md'), '# Doc\n\nBody\n');
  assert.throws(() => resolveContextCommand({
    query: 'test', root, scopes: ['system'], scopeSubset: [], format: 'json', maxItems: 5, maxTokens: 500,
  }), /invalid_scope_subset/);
  fs.rmSync(root, {recursive: true});
});

test('scopeSubset: unknown scope rejected by gateway', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-scope-'));
  fs.mkdirSync(path.join(root, 'system'));
  fs.writeFileSync(path.join(root, 'system', 'doc.md'), '# Doc\n\nBody\n');
  assert.throws(() => resolveContextCommand({
    query: 'test', root, scopes: ['system'], scopeSubset: ['unknown_scope'], format: 'json', maxItems: 5, maxTokens: 500,
  }), /scope_subset_exceeds_allowed/);
  fs.rmSync(root, {recursive: true});
});

// --- CTX-CON-006 with realistic metadata shapes ---

test('CTX-CON-006 realistic: H1+fenced-yaml current and H1+bold-md current pass filters; no-metadata docs excluded', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-con006-'));
  fs.mkdirSync(path.join(root, 'system'));
  fs.mkdirSync(path.join(root, 'system', 'reports'));
  // Required: H1 + fenced YAML (like 00-current-context.md)
  fs.writeFileSync(path.join(root, 'system', 'current-context.md'),
    '# Current Context\n\n```yaml\nstatus: current\nlast_reviewed: 2026-08-04\n```\n\n## Operating direction\n\nContent here.\n');
  // Required: H1 + bold MD (like post-closeout-operational-assurance)
  fs.writeFileSync(path.join(root, 'system', 'reports', 'operational-assurance.md'),
    '# Post-Closeout Operational Assurance\n\n**Status:** active operational reference\n**Version:** 1.0\n**Last reviewed:** 2026-08-04\n\nThis report covers assurance gaps.\n');
  // Forbidden: no metadata (like June cleanup reports)
  fs.writeFileSync(path.join(root, 'system', 'reports', 'june-cleanup.md'),
    '# Mind Cleanup Final Handoff — 2026-06-07\n\nThis handoff summarizes completed cleanup.\n');
  // Forbidden: stale metadata
  fs.writeFileSync(path.join(root, 'system', 'reports', 'old-inventory.md'),
    '# Inventory\n\n```yaml\nstatus: archived\n```\n\nOld data.\n');

  const result = resolveContextCommand({
    query: 'operational assurance current context',
    root,
    scopes: ['system'],
    scopeSubset: ['system'],
    authorityFilter: 'current',
    freshnessFilter: 'fresh',
    format: 'json',
    maxItems: 10,
    maxTokens: 500,
  });
  const sourcePaths = result.pack.sources.map(s => s.path);
  assert.ok(sourcePaths.includes('system/current-context.md'), 'current-context must be present');
  assert.ok(sourcePaths.includes('system/reports/operational-assurance.md'), 'operational-assurance must be present');
  assert.ok(!sourcePaths.includes('system/reports/june-cleanup.md'), 'june-cleanup must be absent');
  assert.ok(!sourcePaths.includes('system/reports/old-inventory.md'), 'old-inventory must be absent');
  for (const source of result.pack.sources) {
    assert.equal(source.authority, 'canonical', `${source.path} must be canonical`);
  }
  fs.rmSync(root, {recursive: true});
});

// --- Actual corpus adapter check (read-only, Mind SHA a21f9ed5) ---

test('actual-corpus: system scope with current+fresh filters returns canonical sources from Mind', async () => {
  const mindRoot = '/Users/Office/Repos/stevewesthoek/mind';
  if (!fs.existsSync(mindRoot)) return; // skip if Mind not available
  const {resolveAdapter} = await import('../src/adapters/index.mjs');
  const result = resolveAdapter({
    query: 'current context operational assurance',
    root: mindRoot,
    scopes: ['system'],
    scopeSubset: ['system'],
    authorityFilter: 'current',
    freshnessFilter: 'fresh',
    format: 'json',
    maxItems: 20,
    maxTokens: 500,
  });
  const sourcePaths = result.sources.map(s => s.path);
  // Required: both canonical current documents must appear
  assert.ok(sourcePaths.includes('system/agent-context/00-current-context.md'),
    '00-current-context.md must be in results');
  assert.ok(sourcePaths.includes('system/reports/post-closeout-operational-assurance-2026-08-04.md'),
    'post-closeout-operational-assurance must be in results');
  // Forbidden: June reports (no metadata → supporting/unknown)
  assert.ok(!sourcePaths.includes('system/reports/mind-cleanup-final-handoff-2026-06-07.md'),
    'June cleanup handoff must be absent');
  assert.ok(!sourcePaths.includes('system/reports/mind-cleanup-phase-summary-2026-06-06.md'),
    'June cleanup phase summary must be absent');
  // No non-system results
  for (const source of result.sources) {
    assert.ok(source.path.startsWith('system/'), `${source.path} must be in system scope`);
  }
  // All results must be canonical
  for (const source of result.sources) {
    assert.equal(source.authority, 'canonical', `${source.path} must be canonical`);
  }
  // Real hashes present
  for (const source of result.sources) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/, `${source.path} must have valid SHA-256`);
  }
});
