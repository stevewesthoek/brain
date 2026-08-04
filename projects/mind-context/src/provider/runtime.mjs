import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {execFileSync} from 'node:child_process';
import {discoverSources} from '../core/discover.mjs';
import {healthAdapter, resolveAdapter, explainAdapter} from '../adapters/index.mjs';
import {normalizeRepoRelativePath} from '../core/policy.mjs';

export const PROVIDER_VERSION = '1.0.0';
export const PROVIDER_BOUNDARY = 'project-scoped-read-only-activation-candidate';
export const PROVIDER_LIMITS = Object.freeze({
  maxRequestBytes: 65_536,
  maxResponseBytes: 524_288,
  maxSourceFiles: 2_000,
  maxSourceBytes: 2 * 1024 * 1024,
  maxCorpusBytes: 64 * 1024 * 1024,
});
export const MANUAL_FALLBACK = Object.freeze({
  mode: 'manual-targeted-read',
  automaticFallback: false,
  instruction: 'Use the canonical Mind startup entrypoints and targeted file reads; do not broaden scope or infer unavailable Gateway results.',
});

export const TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'mind_context_health',
    description: 'Read the fixed-scope Mind Context Gateway provider health and freshness identity.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
  },
  {
    name: 'mind_context_resolve',
    description: 'Resolve a context pack from the provider-fixed Mind root and scopes.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['query'],
      properties: {query: {type: 'string', minLength: 1, maxLength: 1000}, maxItems: {type: 'integer', minimum: 1, maximum: 20}, maxTokens: {type: 'integer', minimum: 1, maximum: 4000}},
    },
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
  },
  {
    name: 'mind_context_explain',
    description: 'Explain fixed-scope Mind Context Gateway ranking, exclusions, provenance, and freshness.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['query'],
      properties: {query: {type: 'string', minLength: 1, maxLength: 1000}, maxItems: {type: 'integer', minimum: 1, maximum: 20}, maxTokens: {type: 'integer', minimum: 1, maximum: 4000}},
    },
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
  },
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000});
}

function parseScopes(value) {
  const scopes = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  if (scopes.length === 0) throw new Error('provider_scopes_missing');
  return [...new Set(scopes.map(normalizeRepoRelativePath))].sort();
}

function requireRevision(value, label) {
  const revision = String(value ?? '');
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error(`${label}_invalid`);
  return revision;
}

function requireOwnedRoot(value) {
  if (!value || !path.isAbsolute(value)) throw new Error('provider_root_must_be_absolute');
  const root = path.resolve(value);
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('provider_root_must_be_real_directory');
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) throw new Error('provider_root_owner_mismatch');
  return root;
}

function readApproval(file, {providerRevision, expectedMindHead, scopes, approvalScope, requireExpiry = false}) {
  if (!file || !path.isAbsolute(file)) throw new Error('activation_approval_file_required');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('activation_approval_file_must_be_owner_only');
  const approval = JSON.parse(fs.readFileSync(file, 'utf8'));
  const approvedAt = Date.parse(approval.approvedAt);
  const expiresAt = approval.expiresAt === undefined ? null : Date.parse(approval.expiresAt);
  const validId = typeof approval.approvalId === 'string' && /^[A-Za-z0-9._:-]{3,128}$/.test(approval.approvalId);
  const approvedScopes = Array.isArray(approval.allowedScopes) ? [...approval.allowedScopes].sort() : [];
  const validExpiry = !requireExpiry || (Number.isFinite(expiresAt) && expiresAt > Date.now() && expiresAt - Date.now() <= 60 * 60 * 1000);
  if (approval.approvedBy !== 'Steve Westhoek' || approval.scope !== approvalScope || approval.providerRevision !== providerRevision || approval.mindCommit !== expectedMindHead || JSON.stringify(approvedScopes) !== JSON.stringify(scopes) || approval.approved !== true || !Number.isFinite(approvedAt) || !validId || !validExpiry) {
    throw new Error('activation_approval_invalid');
  }
  return {approvedBy: approval.approvedBy, approvedAt: approval.approvedAt, expiresAt: approval.expiresAt ?? null, approvalId: approval.approvalId, scope: approvalScope, mindCommit: approval.mindCommit, allowedScopes: approvedScopes};
}

export function loadProviderConfig(env = process.env) {
  const root = requireOwnedRoot(env.MIND_CONTEXT_ROOT);
  const scopes = parseScopes(env.MIND_CONTEXT_ALLOWED_SCOPES);
  const providerRevision = requireRevision(env.MIND_CONTEXT_PROVIDER_REVISION, 'provider_revision');
  const expectedMindHead = requireRevision(env.MIND_CONTEXT_EXPECTED_HEAD, 'expected_mind_head');
  const preparationMode = env.MIND_CONTEXT_PREPARATION_MODE === '1';
  const admittedTools = String(env.MIND_CONTEXT_ALLOWED_TOOLS ?? '').split(',').map((item) => item.trim()).filter(Boolean).sort();
  const expectedTools = TOOL_DEFINITIONS.map((tool) => tool.name).sort();
  if (JSON.stringify(admittedTools) !== JSON.stringify(expectedTools)) throw new Error('provider_tool_allowlist_mismatch');
  if (String(env.MIND_CONTEXT_ALLOWED_SUBOPERATIONS ?? '') !== '') throw new Error('provider_suboperations_forbidden');
  const approval = preparationMode
    ? readApproval(env.MIND_CONTEXT_PREPARATION_APPROVAL_FILE, {providerRevision, expectedMindHead, scopes, approvalScope: 'mind-context-preparation', requireExpiry: true})
    : readApproval(env.MIND_CONTEXT_ACTIVATION_APPROVAL_FILE, {providerRevision, expectedMindHead, scopes, approvalScope: 'mind-context-read-only'});
  return Object.freeze({
    root,
    scopes,
    providerRevision,
    expectedMindHead,
    preparationMode,
    approval,
    admittedTools,
    activationState: preparationMode ? 'preparation-only' : 'active-local-approved',
  });
}

function sourceInventory(config) {
  const sources = discoverSources({root: config.root, scopes: config.scopes, limits: {
    maxFiles: PROVIDER_LIMITS.maxSourceFiles,
    maxSourceBytes: PROVIDER_LIMITS.maxSourceBytes,
    maxBytes: PROVIDER_LIMITS.maxCorpusBytes,
  }});
  const records = sources.map((source) => ({path: source.path, sha256: source.sha256})).sort((a, b) => a.path.localeCompare(b.path));
  return {sourceCount: records.length, sourceBytes: sources.reduce((sum, source) => sum + source.bytes, 0), corpusSha256: sha256(records.map((item) => `${item.path}\0${item.sha256}`).join('\n'))};
}

function sourceState(config) {
  const sourceHead = git(config.root, ['rev-parse', 'HEAD']).trim();
  const dirty = git(config.root, ['status', '--porcelain', '--untracked-files=all', '--', ...config.scopes]).split('\n').filter(Boolean);
  return {sourceHead, expectedMindHead: config.expectedMindHead, headMatchesExpected: sourceHead === config.expectedMindHead, workingChangesInScope: dirty.length, workingChangePaths: dirty.map((line) => line.slice(3)), worktreeMatchesCommit: dirty.length === 0};
}

export function providerHealth(config) {
  const core = healthAdapter();
  const source = sourceState(config);
  const inventory = source.worktreeMatchesCommit ? sourceInventory(config) : {sourceCount: null, sourceBytes: null, corpusSha256: null};
  return {
    service: 'mind-context',
    providerVersion: PROVIDER_VERSION,
    providerRevision: config.providerRevision,
    boundary: PROVIDER_BOUNDARY,
    activationState: config.activationState,
    approval: config.approval,
    healthy: core.coreAvailable && source.headMatchesExpected && source.worktreeMatchesCommit,
    coreAvailable: core.coreAvailable,
    readOnly: true,
    fixtureOnly: false,
    transport: 'stdio',
    projectScoped: true,
    networkAccess: false,
    authentication: {mode: 'local-os-user', credentialRequired: false, credentialInspection: false, relayAllowed: false},
    secretsHandling: {committedSecrets: false, rawSecretInput: false, secretPathExclusion: true},
    source: {...source, ...inventory, indexingMode: 'read-through-no-persistent-index', indexedAt: new Date().toISOString()},
    scope: {root: config.root, allowedScopes: config.scopes, callerCanOverrideRoot: false, callerCanOverrideScopes: false, excludedPathClasses: ['.obsidian', 'archive', 'history', 'runtime', 'generated', 'node_modules', 'secret-marked paths']},
    tools: config.admittedTools.map((name) => ({name, risk: 'read'})),
    mutationPathExposed: false,
    fallback: MANUAL_FALLBACK,
  };
}

function validateReadArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('invalid_tool_arguments');
  const allowed = new Set(['query', 'maxItems', 'maxTokens']);
  for (const key of Object.keys(args)) if (!allowed.has(key)) throw new Error(`forbidden_tool_argument:${key}`);
  const query = String(args.query ?? '').trim();
  if (!query || query.length > 1000) throw new Error('invalid_query');
  const result = {query};
  for (const key of ['maxItems', 'maxTokens']) {
    if (args[key] === undefined) continue;
    const value = Number(args[key]);
    const maximum = key === 'maxItems' ? 20 : 4000;
    if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`invalid_${key}`);
    result[key] = value;
  }
  return result;
}

function decoratePack(payload, config, health) {
  const pack = payload.pack ?? payload;
  const indexedAt = new Date().toISOString();
  pack.generatedAt = indexedAt;
  pack.provenance = {
    ...pack.provenance,
    provider: 'mind-context',
    providerVersion: PROVIDER_VERSION,
    providerRevision: config.providerRevision,
    sourceHead: health.source.sourceHead,
    corpusSha256: health.source.corpusSha256,
    indexingMode: health.source.indexingMode,
    indexedAt,
  };
  pack.state = {
    repository: 'implemented',
    deployed: config.preparationMode ? 'not-installed' : 'active-local',
    observed: 'live-readback',
    verified: health.healthy ? 'runtime-verified' : 'blocked',
  };
  if (payload.pack) {
    payload.fixtureOnly = false;
    payload.readOnly = true;
    payload.providerBoundary = PROVIDER_BOUNDARY;
    payload.pack = pack;
    return payload;
  }
  return pack;
}

export function providerResolve(config, rawArgs) {
  const args = validateReadArgs(rawArgs);
  const health = providerHealth(config);
  if (!health.coreAvailable) throw new Error('core_unavailable');
  if (!health.source.headMatchesExpected) throw new Error('source_revision_mismatch');
  if (!health.source.worktreeMatchesCommit) throw new Error('source_worktree_not_clean');
  return decoratePack(resolveAdapter({...args, root: config.root, scopes: config.scopes, format: 'json', discoveryLimits: {maxFiles: PROVIDER_LIMITS.maxSourceFiles, maxSourceBytes: PROVIDER_LIMITS.maxSourceBytes, maxBytes: PROVIDER_LIMITS.maxCorpusBytes}}), config, health);
}

export function providerExplain(config, rawArgs) {
  const args = validateReadArgs(rawArgs);
  const health = providerHealth(config);
  if (!health.coreAvailable) throw new Error('core_unavailable');
  if (!health.source.headMatchesExpected) throw new Error('source_revision_mismatch');
  if (!health.source.worktreeMatchesCommit) throw new Error('source_worktree_not_clean');
  return decoratePack(explainAdapter({...args, root: config.root, scopes: config.scopes, format: 'json', discoveryLimits: {maxFiles: PROVIDER_LIMITS.maxSourceFiles, maxSourceBytes: PROVIDER_LIMITS.maxSourceBytes, maxBytes: PROVIDER_LIMITS.maxCorpusBytes}}), config, health);
}

export function callProviderTool(config, name, args = {}) {
  if (!config.admittedTools.includes(name)) throw new Error('tool_not_admitted');
  if (name === 'mind_context_health') {
    if (Object.keys(args ?? {}).length > 0) throw new Error('health_arguments_forbidden');
    return providerHealth(config);
  }
  if (name === 'mind_context_resolve') return providerResolve(config, args);
  if (name === 'mind_context_explain') return providerExplain(config, args);
  throw new Error('tool_not_found');
}
