/*
 * Phase 3 adapter registry. These are deliberately small route declarations,
 * not replacements for the domain SKILL.md sources they reference.
 */

export const ADAPTER_SOURCE = 'tools/orchestration/domain-adapters.mjs';

const MODES = Object.freeze({
  code: ['MAP', 'PLAN', 'FIX', 'BUILD', 'REVIEW', 'SHIP'],
  research: ['QUICK', 'WEB', 'DEEP', 'ACADEMIC', 'COMPARATIVE', 'FACT_CHECK', 'DOMAIN_SPECIALIST'],
  design: ['NEW', 'MIMIC', 'UPGRADE'],
  memory: ['RECALL', 'CAPTURE', 'FACTS', 'REVIEW', 'MAINTENANCE'],
  review: ['REPORT_ONLY', 'FIX_ENABLED'],
  qa: ['QUICK', 'STANDARD', 'EXHAUSTIVE'],
  handoff: ['PAUSE', 'CONTINUE_LATER'],
  careful: ['PREFLIGHT'],
});

const ADAPTERS = Object.freeze({
  code: { adapterId: 'adapter.code', domain: 'code', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.code', modes: MODES.code, defaultMode: 'BUILD' },
  research: { adapterId: 'adapter.research', domain: 'research', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.research', modes: MODES.research, defaultMode: 'QUICK' },
  design: { adapterId: 'adapter.design', domain: 'design', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.design', modes: MODES.design, defaultMode: 'NEW' },
  memory: { adapterId: 'adapter.memory', domain: 'memory', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.memory', modes: MODES.memory, defaultMode: 'RECALL' },
  review: { adapterId: 'adapter.review', domain: 'review', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.review', modes: MODES.review, defaultMode: 'REPORT_ONLY' },
  qa: { adapterId: 'adapter.qa', domain: 'qa', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.qa', modes: MODES.qa, defaultMode: 'STANDARD' },
  handoff: { adapterId: 'adapter.handoff', domain: 'handoff', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.handoff', modes: MODES.handoff, defaultMode: 'CONTINUE_LATER' },
  careful: { adapterId: 'adapter.careful', domain: 'careful', sourceRef: ADAPTER_SOURCE, ownerCapabilityId: 'skill.careful', modes: MODES.careful, defaultMode: 'PREFLIGHT' },
});

export const ADAPTER_ROLE_METADATA = Object.freeze({
  code: 'DOMAIN_OWNER', research: 'DOMAIN_OWNER', design: 'DOMAIN_OWNER',
  memory: 'CONTEXT_SERVICE', review: 'QUALITY_GATE', qa: 'QUALITY_GATE',
  handoff: 'CONTINUITY_SERVICE', careful: 'SAFETY_GATE'
});

export function getDomainAdapter(domain) {
  const adapter = ADAPTERS[domain];
  if (!adapter) return null;
  return { ...adapter, modes: [...adapter.modes], role: ADAPTER_ROLE_METADATA[domain] };
}

export function listDomainAdapters() {
  return Object.keys(ADAPTERS).sort().map(getDomainAdapter);
}

export function selectAdapterMode(domain, normalized, routeFamily = domain) {
  const text = normalized.normalizedText;
  if (domain === 'code') {
    if (routeFamily === 'review' || /\breview\b/.test(text)) return 'REVIEW';
    if (/\b(ship|merge|pull request|deploy|publish)\b/.test(text)) return 'SHIP';
    if (/\b(fix|debug|broken|bug|why is|diagnos)/.test(text)) return 'FIX';
    if (/\b(map|understand|architecture|dependencies)\b/.test(text)) return /\b(map|understand|dependencies)\b/.test(text) ? 'MAP' : 'PLAN';
    if (/\b(plan|design|blast radius)\b/.test(text)) return 'PLAN';
    return 'BUILD';
  }
  if (domain === 'research') {
    if (normalized.domains.includes('bible')) return 'DOMAIN_SPECIALIST';
    if (/\b(fact.?check|verify|true|claim)\b/.test(text)) return 'FACT_CHECK';
    if (/\b(compare|versus| vs\.?|options|market entry|enter this market|should i enter)\b/.test(text)) return 'COMPARATIVE';
    if (/\b(academic|paper|literature|study)\b/.test(text)) return 'ACADEMIC';
    if (/\b(deep|thorough|comprehensive|investigation)\b/.test(text)) return 'DEEP';
    if (/\b(web|online|current|latest|company|market)\b/.test(text)) return 'WEB';
    return 'QUICK';
  }
  if (domain === 'design') {
    if (/\b(mimic|inspired by|screenshot|reference|like)\b/.test(text)) return 'MIMIC';
    if (/\b(redesign|upgrade|existing|outdated|improve)\b/.test(text)) return 'UPGRADE';
    return 'NEW';
  }
  if (domain === 'memory') {
    if (/\b(what did we decide|recall|remind|do you remember)\b/.test(text)) return 'RECALL';
    if (/\b(fact|facts|know about)\b/.test(text)) return 'FACTS';
    if (/\b(update|correct|outdated|delete|remove)\b/.test(text)) return 'MAINTENANCE';
    if (/\b(review|all my memories|overview)\b/.test(text)) return 'REVIEW';
    return 'CAPTURE';
  }
  if (domain === 'review') return /\b(fix|autofix|auto-fix)\b/.test(text) ? 'FIX_ENABLED' : 'REPORT_ONLY';
  if (domain === 'qa') {
    if (/\b(exhaustive|all cases|everything)\b/.test(text)) return 'EXHAUSTIVE';
    if (/\b(fix|broken|regression|mobile|standard)\b/.test(text)) return 'STANDARD';
    return 'QUICK';
  }
  if (domain === 'handoff') return /\b(pause|later|tomorrow)\b/.test(text) ? 'PAUSE' : 'CONTINUE_LATER';
  if (domain === 'careful') return 'PREFLIGHT';
  return getDomainAdapter(domain)?.defaultMode ?? null;
}

export function adapterForRoute(route, normalized) {
  const family = route.primaryRouteFamily ?? 'code';
  // Bible is a research specialization, never a universal top-level adapter.
  const primaryDomain = family === 'mixed' ? 'design' : family === 'bible-research' ? 'research' : family === 'careful' ? 'code' : family;
  const primary = getDomainAdapter(primaryDomain);
  const selected = [{ ...primary, mode: selectAdapterMode(primaryDomain, normalized, family), compositionRole: 'PRIMARY_OWNER' }];
  if (family === 'careful' || normalized.riskIndicators.length > 0) {
    selected.push({ ...getDomainAdapter('careful'), mode: 'PREFLIGHT', compositionRole: 'SAFETY_GATE' });
  }
  if (family === 'mixed') selected.push({ ...getDomainAdapter('code'), mode: selectAdapterMode('code', normalized, family), compositionRole: 'DEPENDENCY' });
  if (family === 'review') selected[0].mode = selectAdapterMode('review', normalized, family);
  if (family === 'qa') selected[0].mode = selectAdapterMode('qa', normalized, family);
  if (family === 'handoff') selected[0].mode = selectAdapterMode('handoff', normalized, family);
  if (family === 'memory') selected[0].mode = selectAdapterMode('memory', normalized, family);
  return { primary, selected, role: ADAPTER_ROLE_METADATA[primaryDomain], specialization: family === 'research' && normalized.domains.includes('bible') ? 'bible-research' : null };
}

export function adapterDescriptorDefinitions() {
  return listDomainAdapters().map((adapter) => ({
    capabilityId: adapter.adapterId,
    kind: 'adapter', role: 'adapter', label: `${adapter.domain} thin domain adapter`, sourceRef: ADAPTER_SOURCE,
    domains: [adapter.domain, 'orchestration'], intents: adapter.modes.map((mode) => mode.toLowerCase()),
    triggers: [adapter.domain, ...adapter.modes.map((mode) => mode.toLowerCase())],
    summary: `Thin ${adapter.domain} packet adapter; selects bounded source capabilities and returns references only.`,
    sideEffects: [], riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: []
  }));
}
