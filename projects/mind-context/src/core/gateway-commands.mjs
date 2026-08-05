import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverSources} from './discover.mjs';
import {planContextPack} from './plan-context-pack.mjs';
import {renderContextPackJson, renderContextPackMarkdown} from './render.mjs';
import {CONTEXT_PACK_VERSION} from '../context-pack.mjs';

const PACKAGE_VERSION = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

function isCoreAvailable() {
  return process.env.MIND_CONTEXT_CORE_DISABLED !== '1';
}

function assertCoreAvailable() {
  if (!isCoreAvailable()) throw new Error('core_unavailable');
}

function normalizeFormat(value) {
  const format = String(value ?? 'json').toLowerCase();
  if (format !== 'json' && format !== 'markdown') throw new Error('invalid_output_format');
  return format;
}

function normalizePositiveInt(value, fallback) {
  if (value == null) return fallback;
  const number = Number.parseInt(String(value), 10);
  if (!Number.isInteger(number) || number < 1 || number > 4000) throw new Error('invalid_budget');
  return number;
}

function normalizeRoot(root) {
  if (!root) throw new Error('missing_root');
  const resolved = path.resolve(String(root));
  if (!fs.existsSync(resolved)) throw new Error('missing_root');
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('forbidden_root');
  if (resolved.includes(`${path.sep}.git${path.sep}`) || resolved.endsWith(`${path.sep}.git`) || resolved.includes(`${path.sep}node_modules${path.sep}`)) throw new Error('forbidden_root');
  return resolved;
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) throw new Error('missing_scope');
  const normalized = scopes.map((scope) => String(scope).trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error('missing_scope');
  for (const scope of normalized) {
    if (scope.includes('..') || scope.startsWith('/') || scope.includes('\\')) throw new Error('invalid_scope');
  }
  return normalized;
}

const VALID_AUTHORITY_FILTERS = new Set(['any', 'current']);
const VALID_FRESHNESS_FILTERS = new Set(['any', 'fresh']);

function normalizeAuthorityFilter(value) {
  if (value == null || value === '' || value === 'any') return 'any';
  if (value === 'current') return 'current';
  throw new Error('invalid_authority_filter');
}

function normalizeFreshnessFilter(value) {
  if (value == null || value === '' || value === 'any') return 'any';
  if (value === 'fresh') return 'fresh';
  throw new Error('invalid_freshness_filter');
}

function normalizeScopeSubset(scopeSubset, allowedScopes) {
  if (scopeSubset == null || (Array.isArray(scopeSubset) && scopeSubset.length === 0)) return null;
  const subset = Array.isArray(scopeSubset) ? scopeSubset : [String(scopeSubset)];
  for (const s of subset) {
    if (String(s).includes('..') || String(s).startsWith('/') || String(s).includes('\\')) throw new Error('invalid_scope');
    if (!allowedScopes.includes(s)) throw new Error('scope_subset_exceeds_allowed');
  }
  return subset;
}

const CURRENT_AUTHORITY_VALUES = new Set(['canonical']);

function applyAuthorityFilter(sources, authorityFilter) {
  if (authorityFilter === 'any') return sources;
  return sources.filter((source) => CURRENT_AUTHORITY_VALUES.has(String(source.authority ?? '').toLowerCase()));
}

function applyFreshnessFilter(sources, freshnessFilter) {
  if (freshnessFilter === 'any') return sources;
  return sources.filter((source) => {
    const freshness = String(source.freshness ?? '').toLowerCase();
    const lifecycle = String(source.lifecycle ?? '').toLowerCase();
    return freshness === 'fresh' || lifecycle === 'current';
  });
}

function collectContext(args) {
  assertCoreAvailable();
  if (args.modelSuppliedAuthority === true) throw new Error('model_authority');
  if (args.mutationLike === true || args.requestCredentials === true || args.externalCall === true || args.toolCall === true) throw new Error('invalid_adapter_request');
  const root = normalizeRoot(args.root);
  const scopes = normalizeScopes(args.scopes);
  const forbiddenScopes = Array.isArray(args.forbiddenScopes) ? args.forbiddenScopes : [];
  for (const scope of forbiddenScopes) {
    if (String(scope).includes('..') || String(scope).startsWith('/') || String(scope).includes('\\')) throw new Error('invalid_scope');
  }
  const scopeSubset = normalizeScopeSubset(args.scopeSubset ?? null, scopes);
  const effectiveScopes = scopeSubset ?? scopes;
  const authorityFilter = normalizeAuthorityFilter(args.authorityFilter);
  const freshnessFilter = normalizeFreshnessFilter(args.freshnessFilter);
  const query = String(args.query ?? '').trim();
  if (!query) throw new Error('missing_query');
  const format = normalizeFormat(args.format);
  const maxItems = normalizePositiveInt(args.maxItems, 5);
  const maxTokens = normalizePositiveInt(args.maxTokens, 500);
  const sources = discoverSources({root, scopes: effectiveScopes, forbiddenScopes, limits: args.discoveryLimits});
  const filteredByAuthority = applyAuthorityFilter(sources, authorityFilter);
  const filteredSources = applyFreshnessFilter(filteredByAuthority, freshnessFilter);
  if (filteredSources.length === 0) throw new Error('insufficient_evidence');
  const plan = planContextPack({
    queryId: args.queryId ?? query,
    query,
    scopes: effectiveScopes,
    sources: filteredSources,
    forbiddenSources: args.forbiddenSources ?? [],
    maxItems,
    maxTokens,
    modelSuppliedAuthority: false,
  });
  return {root, scopes, effectiveScopes, forbiddenScopes, scopeSubset, authorityFilter, freshnessFilter, query, format, maxItems, maxTokens, sources, filteredSources, plan};
}

export function resolveContextCommand(args = {}) {
  const context = collectContext(args);
  const pack = context.plan.pack;
  return {
    command: 'resolve',
    packageVersion: PACKAGE_VERSION,
    schemaVersion: CONTEXT_PACK_VERSION,
    readOnly: true,
    fixtureOnly: true,
    input: {
      query: context.query,
      root: context.root,
      scopes: context.scopes,
      effectiveScopes: context.effectiveScopes,
      forbiddenScopes: context.forbiddenScopes,
      scopeSubset: context.scopeSubset,
      authorityFilter: context.authorityFilter,
      freshnessFilter: context.freshnessFilter,
      maxItems: context.maxItems,
      maxTokens: context.maxTokens,
      format: context.format,
    },
    pack,
  };
}

export function explainContextCommand(args = {}) {
  const context = collectContext(args);
  const ranking = context.plan.rankedSources.slice(0, context.maxItems);
  return {
    command: 'explain',
    packageVersion: PACKAGE_VERSION,
    schemaVersion: CONTEXT_PACK_VERSION,
    readOnly: true,
    fixtureOnly: true,
    input: {
      query: context.query,
      root: context.root,
      scopes: context.scopes,
      effectiveScopes: context.effectiveScopes,
      forbiddenScopes: context.forbiddenScopes,
      scopeSubset: context.scopeSubset,
      authorityFilter: context.authorityFilter,
      freshnessFilter: context.freshnessFilter,
      maxItems: context.maxItems,
      maxTokens: context.maxTokens,
      format: context.format,
    },
    pack: context.plan.pack,
    ranking: ranking.map(({source, score, components}) => ({
      sourceId: source.sourceId,
      path: source.path,
      citation: source.citation ?? `${source.path}#${source.line ?? 'L1'}`,
      authority: source.authority,
      freshness: source.freshness,
      score,
      components,
      untrusted: source.untrusted ?? source.authority === 'untrusted',
    })),
    rankingTotal: context.plan.rankedSources.length,
    rankingReturned: ranking.length,
    rankingTruncated: ranking.length < context.plan.rankedSources.length,
    exclusions: context.plan.exclusions,
    budget: context.plan.budget.budget,
    truncation: context.plan.budget.truncation,
    conflicts: context.plan.pack.conflicts,
    unknowns: context.plan.pack.unknowns,
  };
}

export function healthContextCommand() {
  return {
    command: 'health',
    packageVersion: PACKAGE_VERSION,
    schemaVersion: CONTEXT_PACK_VERSION,
    corpusVersion: '1.0.0',
    coreAvailable: isCoreAvailable(),
    readOnly: true,
    fixtureOnly: true,
    networkAccess: false,
    credentialInspection: false,
    productionPathInspection: false,
  };
}

export function renderContextGatewayOutput(payload, format) {
  if (format === 'markdown') {
    if (typeof payload === 'string') return payload;
    if (payload?.pack) return renderContextPackMarkdown(payload.pack);
    return JSON.stringify(payload, null, 2);
  }
  if (typeof payload === 'string') return payload;
  if (payload?.pack && payload.command === 'resolve') return renderContextPackJson(payload.pack);
  return JSON.stringify(payload, null, 2);
}
