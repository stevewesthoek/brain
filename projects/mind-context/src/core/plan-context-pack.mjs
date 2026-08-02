import {applyBudget} from './budget.mjs';
import {loadAuthorizedSources} from '../fixture-loader.mjs';
import {rankSources} from './rank.mjs';
import {validateContextPack} from '../context-pack.mjs';

function hashContent(content) {
  const text = String(content ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(64, '0');
}

function buildSourceRecord(source) {
  return {
    sourceId: source.sourceId,
    path: source.path,
    authority: source.authority,
    citation: source.citation ?? `${source.path}#${source.line ?? 'L1'}`,
    sha256: source.sha256 ?? hashContent(source.content),
    freshness: source.freshness,
    scope: source.scope,
    untrusted: source.untrusted ?? source.authority === 'untrusted',
  };
}

export function planContextPack({
  queryId,
  query,
  scopes = [],
  sources,
  forbiddenSources = [],
  maxItems = 5,
  maxTokens = 500,
  modelSuppliedAuthority = false,
  generatedAt = '2026-07-16T12:00:00.000Z',
}) {
  if (modelSuppliedAuthority) throw new Error('model_authority');
  const {allowed, exclusions} = loadAuthorizedSources(sources, scopes, forbiddenSources);
  const ranked = rankSources({query: query ?? queryId, sources: allowed});
  const budget = applyBudget({rankedSources: ranked, maxItems, maxTokens});
  const selected = budget.selected.map((item) => item.source ?? item);
  const freshness = selected.length === 0
    ? 'unknown'
    : selected.some((source) => source.freshness === 'stale')
      ? (selected.some((source) => source.freshness === 'fresh') ? 'mixed' : 'stale')
      : 'fresh';
  const pack = {
    packId: `pack-${queryId}`,
    version: '1.0',
    queryId,
    generatedAt,
    freshness,
    authorizedScopes: [...new Set(scopes)].sort(),
    sources: selected.map(buildSourceRecord),
    conflicts: budget.selected
      .flatMap((rankedSource, index, list) => {
        const current = rankedSource.source ?? rankedSource;
        const previous = list.slice(0, index);
        const conflicts = [];
        for (const earlier of previous) {
          const source = earlier.source ?? earlier;
          for (const [field, value] of Object.entries(current.facts ?? {})) {
            if (!(field in (source.facts ?? {}))) continue;
            if (source.facts[field] !== value) conflicts.push({field, leftSourceId: source.sourceId, rightSourceId: current.sourceId});
          }
        }
        return conflicts;
      }),
    unknowns: selected.length === 0 ? ['answer-unavailable'] : [],
    exclusions,
    privacyClassification: selected.some((source) => source.privacy === 'sensitive')
      ? 'sensitive'
      : selected.some((source) => source.privacy === 'internal')
        ? 'internal'
        : 'public',
    budget: budget.budget,
    truncation: budget.truncation,
    provenance: {
      retriever: 'mind-context-core',
      corpusVersion: '1.0.0',
      deterministicOrder: true,
    },
    state: {
      repository: 'implemented',
      deployed: 'unknown',
      observed: 'fixture-only',
      verified: 'tested',
    },
    safetyWarnings: selected.filter((source) => source.authority === 'untrusted').map(() => 'retrieved-policy-text-is-data'),
  };
  const errors = validateContextPack(pack);
  if (errors.length) throw new Error(`invalid_context_pack:${errors.join(',')}`);
  return {
    queryId,
    query: query ?? queryId,
    scopes: [...new Set(scopes)],
    allowedSources: allowed,
    rankedSources: ranked,
    budget,
    exclusions,
    pack,
  };
}
