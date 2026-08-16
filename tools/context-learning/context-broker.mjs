import crypto from 'node:crypto';

export const BROKER_SCHEMA_VERSION = '1.0.0';
export const BROKER_OPERATIONS = Object.freeze([
  'health',
  'bootstrap',
  'resolve',
  'explain',
  'align',
  'capabilities_list',
  'capabilities_inspect',
  'decisions_status',
  'learn_status'
]);

const ROLE_PRIORITY = Object.freeze({ human_authority: 0, machine_capability: 1, supplemental: 2 });
const FRESHNESS_ORDER = Object.freeze({ fresh: 0, review_due: 1, unknown: 2, stale: 3, contradicted: 4, superseded: 5 });
const CAPABILITY_KINDS = new Set(['skill', 'orchestrator', 'runbook', 'named_cli', 'validator', 'mcp_server', 'mcp_tool', 'local_app', 'future']);

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text ?? '').length / 4));
}

function nowIso(now) {
  return (now instanceof Date ? now : new Date(now ?? Date.now())).toISOString();
}

function clampString(value, maxLength) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function compactRevision(value) {
  return clampString(value || 'unknown', 160);
}

function normalizeHealth(value) {
  return ['healthy', 'degraded', 'unavailable', 'disabled'].includes(value) ? value : 'unavailable';
}

function normalizeFreshness(value) {
  return ['fresh', 'review_due', 'stale', 'superseded', 'contradicted', 'unknown'].includes(value) ? value : 'unknown';
}

function normalizeContextRole(value) {
  return Object.hasOwn(ROLE_PRIORITY, value) ? value : 'supplemental';
}

function sortedContextProviders(providers = []) {
  return [...providers].sort((a, b) => {
    const roleDelta = ROLE_PRIORITY[normalizeContextRole(a.contextRole)] - ROLE_PRIORITY[normalizeContextRole(b.contextRole)];
    if (roleDelta !== 0) return roleDelta;
    return String(a.providerId).localeCompare(String(b.providerId));
  });
}

function providerSnapshot(provider) {
  return {
    schemaVersion: BROKER_SCHEMA_VERSION,
    providerId: String(provider.providerId),
    providerKind: String(provider.providerKind ?? 'context'),
    contextRole: normalizeContextRole(provider.contextRole),
    sourceRevision: compactRevision(provider.sourceRevision),
    health: normalizeHealth(provider.health),
    freshness: normalizeFreshness(provider.freshness),
    summary: clampString(provider.summary ?? `${provider.providerId} context provider`, 500),
    authoritative: provider.authoritative === true
  };
}

function retrievalSnapshot(provider) {
  return {
    schemaVersion: BROKER_SCHEMA_VERSION,
    providerId: String(provider.providerId),
    providerKind: 'retrieval_accelerator',
    mode: ['structural', 'semantic', 'hybrid'].includes(provider.mode) ? provider.mode : 'hybrid',
    sourceRevision: compactRevision(provider.sourceRevision),
    health: normalizeHealth(provider.health),
    freshness: normalizeFreshness(provider.freshness),
    authoritative: false,
    optional: true
  };
}

function validateQuery(query) {
  const normalized = String(query ?? '').trim();
  if (!normalized || normalized.length > 1000) throw new Error('invalid_query');
  return normalized;
}

function validateResolveBudget(maxItems = 8, maxTokens = 1200) {
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 20) throw new Error('invalid_max_items');
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4000) throw new Error('invalid_max_tokens');
  return { maxItems, maxTokens };
}

function normalizeContextItem(provider, raw, index) {
  const summary = clampString(raw?.summary ?? raw?.text ?? raw?.title ?? '', 2000);
  const citation = clampString(raw?.citation ?? raw?.path ?? `${provider.providerId}#${index + 1}`, 1000);
  if (!summary) throw new Error(`provider_item_summary_missing:${provider.providerId}`);
  if (!citation) throw new Error(`provider_item_citation_missing:${provider.providerId}`);
  const itemId = String(raw?.itemId ?? raw?.sourceId ?? `${provider.providerId}:${index + 1}`);
  const authority = String(raw?.authority ?? (provider.authoritative ? 'canonical' : 'supporting'));
  const freshness = normalizeFreshness(raw?.freshness ?? provider.freshness);
  const tokenEstimate = Number.isInteger(raw?.tokenEstimate)
    ? Math.max(1, raw.tokenEstimate)
    : estimateTokens(`${summary} ${citation} ${authority} ${freshness}`);
  return {
    providerId: String(provider.providerId),
    contextRole: normalizeContextRole(provider.contextRole),
    itemId,
    summary,
    citation,
    authority,
    freshness,
    tokenEstimate
  };
}

function aggregateFreshness(items) {
  if (items.length === 0) return 'unknown';
  return items.reduce((worst, item) => {
    const current = normalizeFreshness(item.freshness);
    return FRESHNESS_ORDER[current] > FRESHNESS_ORDER[worst] ? current : worst;
  }, 'fresh');
}

function normalizeCapability(provider, raw) {
  const capabilityKind = CAPABILITY_KINDS.has(raw?.capabilityKind) ? raw.capabilityKind : 'future';
  return {
    schemaVersion: BROKER_SCHEMA_VERSION,
    providerId: String(provider.providerId),
    providerKind: String(provider.providerKind ?? 'capability_catalog'),
    capabilityId: String(raw?.capabilityId ?? ''),
    capabilityKind,
    summary: clampString(raw?.summary ?? '', 500),
    sourceRevision: compactRevision(raw?.sourceRevision ?? provider.sourceRevision),
    inputSchemaRef: raw?.inputSchemaRef ? String(raw.inputSchemaRef) : null,
    outputSchemaRef: raw?.outputSchemaRef ? String(raw.outputSchemaRef) : null,
    requiredContextScopes: [...new Set((raw?.requiredContextScopes ?? []).map(String))],
    riskClass: ['read-only', 'low', 'medium', 'high', 'critical'].includes(raw?.riskClass) ? raw.riskClass : 'read-only',
    confirmationClass: ['none', 'policy', 'user', 'admin'].includes(raw?.confirmationClass) ? raw.confirmationClass : 'policy',
    transportRef: clampString(raw?.transportRef ?? 'provider-defined', 500),
    health: normalizeHealth(raw?.health ?? provider.health),
    freshness: normalizeFreshness(raw?.freshness ?? provider.freshness),
    instructionsRef: raw?.instructionsRef ? String(raw.instructionsRef) : null
  };
}

function isProviderUsable(provider) {
  return normalizeHealth(provider.health) === 'healthy' && normalizeFreshness(provider.freshness) === 'fresh';
}

function providerFallback(provider, reason) {
  return {
    providerId: String(provider.providerId),
    reason,
    health: normalizeHealth(provider.health),
    freshness: normalizeFreshness(provider.freshness)
  };
}

function makePackId(query, items, generatedAt) {
  const identity = `${query}|${generatedAt}|${items.map((item) => `${item.providerId}:${item.itemId}`).join('|')}`;
  return `clr-pack-${sha256(identity).slice(0, 24)}`;
}

function alignmentSignal(evidence) {
  if (evidence.length === 0) return 'insufficient_context';
  const freshConflicts = evidence.filter((item) => item.relation === 'conflicts' && item.freshness === 'fresh');
  if (freshConflicts.some((item) => item.strength >= 0.8)) return 'conflicting';
  if (freshConflicts.length > 0) return 'potentially_conflicting';
  if (evidence.some((item) => item.relation === 'stale' || item.freshness === 'stale' || item.freshness === 'review_due')) return 'strategy_stale';
  if (evidence.some((item) => item.relation === 'aligns')) return 'aligned';
  return 'insufficient_context';
}

function normalizeAlignmentEvidence(provider, raw) {
  const relation = ['aligns', 'conflicts', 'stale', 'uncertain'].includes(raw?.relation) ? raw.relation : 'uncertain';
  const strength = Number.isFinite(raw?.strength) ? Math.min(1, Math.max(0, raw.strength)) : 0.5;
  return {
    providerId: String(provider.providerId),
    relation,
    strength,
    citation: clampString(raw?.citation ?? `${provider.providerId}#alignment`, 1000),
    freshness: normalizeFreshness(raw?.freshness ?? provider.freshness),
    summary: clampString(raw?.summary ?? 'Alignment evidence is incomplete.', 1000)
  };
}

export function createContextBroker({
  contextProviders = [],
  retrievalProviders = [],
  capabilityProviders = [],
  decisionStatusProvider = null,
  learnStatusProvider = null,
  maxPackHistory = 32,
  clock = () => new Date()
} = {}) {
  if (!Number.isInteger(maxPackHistory) || maxPackHistory < 1 || maxPackHistory > 256) throw new Error('invalid_pack_history_limit');

  const contexts = sortedContextProviders(contextProviders);
  const retrievals = [...retrievalProviders];
  const capabilities = [...capabilityProviders];
  const packHistory = new Map();

  function rememberPack(pack, explanation) {
    packHistory.set(pack.packId, { pack, explanation });
    while (packHistory.size > maxPackHistory) {
      const firstKey = packHistory.keys().next().value;
      packHistory.delete(firstKey);
    }
  }

  function decisionsStatus() {
    if (typeof decisionStatusProvider !== 'function') {
      return { schemaVersion: BROKER_SCHEMA_VERSION, operation: 'decisions_status', available: false, pendingCount: null, sourceRevision: null };
    }
    const value = decisionStatusProvider() ?? {};
    return {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'decisions_status',
      available: value.available !== false,
      pendingCount: Number.isInteger(value.pendingCount) ? Math.max(0, value.pendingCount) : 0,
      sourceRevision: value.sourceRevision ? String(value.sourceRevision) : null
    };
  }

  function learnStatus() {
    if (typeof learnStatusProvider !== 'function') {
      return { schemaVersion: BROKER_SCHEMA_VERSION, operation: 'learn_status', available: false, state: 'unavailable', sourceRevision: null };
    }
    const value = learnStatusProvider() ?? {};
    return {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'learn_status',
      available: value.available !== false,
      state: clampString(value.state ?? 'report-only', 120),
      sourceRevision: value.sourceRevision ? String(value.sourceRevision) : null
    };
  }

  function health() {
    return {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'health',
      generatedAt: nowIso(clock()),
      readOnly: true,
      executionExposed: false,
      operations: [...BROKER_OPERATIONS],
      contextProviders: contexts.map(providerSnapshot),
      retrievalProviders: retrievals.map(retrievalSnapshot),
      capabilityProviders: capabilities.map((provider) => ({
        providerId: String(provider.providerId),
        providerKind: String(provider.providerKind ?? 'capability_catalog'),
        sourceRevision: compactRevision(provider.sourceRevision),
        health: normalizeHealth(provider.health),
        freshness: normalizeFreshness(provider.freshness)
      }))
    };
  }

  function bootstrap({ maxTokens = 800 } = {}) {
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 800) throw new Error('invalid_bootstrap_budget');
    const generatedAt = nowIso(clock());
    const layers = contexts.map((provider) => {
      const snapshot = providerSnapshot(provider);
      return {
        providerId: snapshot.providerId,
        contextRole: snapshot.contextRole,
        sourceRevision: snapshot.sourceRevision,
        health: snapshot.health,
        freshness: snapshot.freshness,
        summary: clampString(snapshot.summary, 220)
      };
    });
    const instructions = [
      'Orient from human authority before machine capability when the task depends on human meaning.',
      'Retrieve progressively; do not load whole repositories or capability bodies by default.',
      'Surface stale, contradictory, unavailable, or cached context instead of silently treating it as current.',
      'Capability discovery is read-only metadata and never widens execution authority.'
    ];
    const envelope = {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'bootstrap',
      generatedAt,
      layers,
      decisionStatus: decisionsStatus(),
      learnStatus: learnStatus(),
      budget: { maxTokens, usedTokens: 1 },
      instructions
    };
    const usedTokens = estimateTokens(JSON.stringify({ ...envelope, budget: undefined }));
    if (usedTokens > maxTokens) throw new Error('bootstrap_budget_exceeded');
    envelope.budget.usedTokens = usedTokens;
    return envelope;
  }

  function resolve({ query, maxItems = 8, maxTokens = 1200 } = {}) {
    const normalizedQuery = validateQuery(query);
    const budget = validateResolveBudget(maxItems, maxTokens);
    const generatedAt = nowIso(clock());
    const items = [];
    const conflicts = [];
    const unknowns = [];
    const excluded = [];
    const providerFallbacks = [];
    let usedTokens = 0;

    for (const provider of contexts) {
      if (normalizeHealth(provider.health) === 'disabled' || normalizeHealth(provider.health) === 'unavailable') {
        providerFallbacks.push(providerFallback(provider, 'context-provider-unavailable'));
        unknowns.push(`context provider unavailable: ${provider.providerId}`);
        continue;
      }
      if (typeof provider.resolve !== 'function') {
        providerFallbacks.push(providerFallback(provider, 'context-provider-resolve-missing'));
        unknowns.push(`context provider has no resolve function: ${provider.providerId}`);
        continue;
      }

      const remainingItems = budget.maxItems - items.length;
      const remainingTokens = budget.maxTokens - usedTokens;
      if (remainingItems <= 0) {
        excluded.push({ providerId: provider.providerId, itemId: '*', reason: 'item-limit' });
        continue;
      }
      if (remainingTokens <= 0) {
        excluded.push({ providerId: provider.providerId, itemId: '*', reason: 'token-budget' });
        continue;
      }

      let result;
      try {
        result = provider.resolve({ query: normalizedQuery, maxItems: remainingItems, maxTokens: remainingTokens }) ?? {};
      } catch (error) {
        providerFallbacks.push(providerFallback(provider, `context-provider-error:${error instanceof Error ? error.message : String(error)}`));
        unknowns.push(`context provider failed: ${provider.providerId}`);
        continue;
      }

      for (const [index, raw] of (result.items ?? result.sources ?? []).entries()) {
        if (items.length >= budget.maxItems) {
          excluded.push({ providerId: provider.providerId, itemId: String(raw?.itemId ?? raw?.sourceId ?? index + 1), reason: 'item-limit' });
          continue;
        }
        const item = normalizeContextItem(provider, raw, index);
        if (usedTokens + item.tokenEstimate > budget.maxTokens) {
          excluded.push({ providerId: provider.providerId, itemId: item.itemId, reason: 'token-budget' });
          continue;
        }
        items.push(item);
        usedTokens += item.tokenEstimate;
      }
      for (const conflict of result.conflicts ?? []) conflicts.push({ providerId: provider.providerId, ...conflict });
      for (const unknown of result.unknowns ?? []) unknowns.push(String(unknown));
      for (const omission of result.excluded ?? result.exclusions ?? []) excluded.push({ providerId: provider.providerId, ...omission });
    }

    const navigationHints = [];
    for (const provider of retrievals) {
      if (!isProviderUsable(provider)) {
        providerFallbacks.push(providerFallback(provider, 'optional-accelerator-not-fresh-and-healthy'));
        continue;
      }
      if (typeof provider.search !== 'function') {
        providerFallbacks.push(providerFallback(provider, 'optional-accelerator-search-missing'));
        continue;
      }
      try {
        const hints = provider.search({ query: normalizedQuery, maxItems: Math.min(5, budget.maxItems) }) ?? [];
        for (const raw of hints.slice(0, 5)) {
          navigationHints.push({
            providerId: String(provider.providerId),
            mode: retrievalSnapshot(provider).mode,
            summary: clampString(raw?.summary ?? raw?.path ?? '', 500),
            citation: clampString(raw?.citation ?? raw?.path ?? `${provider.providerId}#hint`, 1000),
            freshness: normalizeFreshness(raw?.freshness ?? provider.freshness),
            authority: 'derived',
            nonAuthoritative: true
          });
        }
      } catch (error) {
        providerFallbacks.push(providerFallback(provider, `optional-accelerator-error:${error instanceof Error ? error.message : String(error)}`));
      }
    }

    const packId = makePackId(normalizedQuery, items, generatedAt);
    const pack = {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'resolve',
      packId,
      generatedAt,
      query: normalizedQuery,
      items,
      navigationHints,
      conflicts,
      unknowns: [...new Set(unknowns)],
      excluded,
      providerFallbacks,
      budget: { maxItems: budget.maxItems, maxTokens: budget.maxTokens, usedItems: items.length, usedTokens },
      freshness: aggregateFreshness(items)
    };

    const explanation = {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'explain',
      packId,
      generatedAt,
      included: items.map((item, index) => ({
        order: index + 1,
        providerId: item.providerId,
        itemId: item.itemId,
        contextRole: item.contextRole,
        citation: item.citation,
        freshness: item.freshness,
        reason: `included within ${item.contextRole} priority and token/item budget`
      })),
      excluded,
      providerFallbacks,
      conflicts,
      unknowns: pack.unknowns,
      navigationHints: navigationHints.map((hint) => ({ providerId: hint.providerId, citation: hint.citation, nonAuthoritative: true }))
    };
    rememberPack(pack, explanation);
    return pack;
  }

  function explain({ packId } = {}) {
    const id = String(packId ?? '').trim();
    if (!id) throw new Error('pack_id_required');
    const entry = packHistory.get(id);
    if (!entry) throw new Error('pack_not_found');
    return entry.explanation;
  }

  function align({ query, maxItems = 8 } = {}) {
    const normalizedQuery = validateQuery(query);
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 20) throw new Error('invalid_max_items');
    const evidence = [];
    for (const provider of contexts) {
      if (normalizeContextRole(provider.contextRole) !== 'human_authority') continue;
      if (normalizeHealth(provider.health) === 'disabled' || normalizeHealth(provider.health) === 'unavailable') continue;
      if (typeof provider.align !== 'function') continue;
      const rawEvidence = provider.align({ query: normalizedQuery, maxItems: maxItems - evidence.length }) ?? [];
      for (const raw of rawEvidence) {
        if (evidence.length >= maxItems) break;
        evidence.push(normalizeAlignmentEvidence(provider, raw));
      }
    }
    const signal = alignmentSignal(evidence);
    return {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'align',
      generatedAt: nowIso(clock()),
      signal,
      evidence,
      citations: [...new Set(evidence.map((item) => item.citation))]
    };
  }

  function capabilitiesList({ query = '', capabilityKind = null, maxItems = 20 } = {}) {
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 50) throw new Error('invalid_capability_limit');
    if (capabilityKind !== null && !CAPABILITY_KINDS.has(capabilityKind)) throw new Error('invalid_capability_kind');
    const normalizedQuery = String(query ?? '').trim().toLowerCase();
    const output = [];
    const providerFallbacks = [];
    const seenCapabilityKeys = new Set();

    for (const provider of capabilities) {
      if (!isProviderUsable(provider)) {
        providerFallbacks.push(providerFallback(provider, 'capability-provider-not-fresh-and-healthy'));
        continue;
      }
      if (typeof provider.list !== 'function') {
        providerFallbacks.push(providerFallback(provider, 'capability-provider-list-missing'));
        continue;
      }
      let rawItems;
      try {
        rawItems = provider.list({ query: normalizedQuery, capabilityKind, maxItems }) ?? [];
      } catch (error) {
        providerFallbacks.push(providerFallback(provider, `capability-provider-error:${error instanceof Error ? error.message : String(error)}`));
        continue;
      }
      for (const raw of rawItems) {
        if (output.length >= maxItems) break;
        const descriptor = normalizeCapability(provider, raw);
        if (!descriptor.capabilityId || !descriptor.summary) continue;
        if (capabilityKind && descriptor.capabilityKind !== capabilityKind) continue;
        if (normalizedQuery && !`${descriptor.capabilityId} ${descriptor.summary} ${descriptor.capabilityKind}`.toLowerCase().includes(normalizedQuery)) continue;
        const capabilityKey = `${descriptor.providerId}:${descriptor.capabilityId}`;
        if (seenCapabilityKeys.has(capabilityKey)) {
          providerFallbacks.push({ providerId: descriptor.providerId, capabilityId: descriptor.capabilityId, reason: 'duplicate-capability-id' });
          continue;
        }
        seenCapabilityKeys.add(capabilityKey);
        output.push(descriptor);
      }
      if (output.length >= maxItems) break;
    }

    return {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'capabilities_list',
      generatedAt: nowIso(clock()),
      capabilities: output,
      providerFallbacks,
      truncated: output.length >= maxItems
    };
  }

  function capabilitiesInspect({ providerId, capabilityId, includeInstructions = false, relevance = 'metadata' } = {}) {
    const provider = capabilities.find((candidate) => String(candidate.providerId) === String(providerId));
    if (!provider) throw new Error('capability_provider_not_found');
    if (!isProviderUsable(provider)) throw new Error('capability_provider_not_fresh_and_healthy');
    if (typeof provider.inspect !== 'function') throw new Error('capability_provider_inspect_missing');
    if (includeInstructions && relevance !== 'selected') throw new Error('instructions_require_selected_relevance');

    const raw = provider.inspect({ capabilityId: String(capabilityId ?? ''), includeInstructions, relevance }) ?? null;
    if (!raw) throw new Error('capability_not_found');
    const capability = normalizeCapability(provider, raw);
    if (!capability.capabilityId) throw new Error('capability_not_found');
    return {
      schemaVersion: BROKER_SCHEMA_VERSION,
      operation: 'capabilities_inspect',
      generatedAt: nowIso(clock()),
      capability,
      instructionsIncluded: includeInstructions === true,
      instructions: includeInstructions ? clampString(raw.instructions ?? '', 20000) : null,
      executionExposed: false
    };
  }

  function call(operation, args = {}) {
    switch (operation) {
      case 'health': return health();
      case 'bootstrap': return bootstrap(args);
      case 'resolve': return resolve(args);
      case 'explain': return explain(args);
      case 'align': return align(args);
      case 'capabilities_list': return capabilitiesList(args);
      case 'capabilities_inspect': return capabilitiesInspect(args);
      case 'decisions_status': return decisionsStatus();
      case 'learn_status': return learnStatus();
      default: throw new Error(`unsupported_broker_operation:${operation}`);
    }
  }

  return Object.freeze({
    health,
    bootstrap,
    resolve,
    explain,
    align,
    capabilitiesList,
    capabilitiesInspect,
    decisionsStatus,
    learnStatus,
    call
  });
}
