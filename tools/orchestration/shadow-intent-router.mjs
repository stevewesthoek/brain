import { createCapabilityCatalog } from './capability-catalog.mjs';

export const ROUTE_FAMILIES = Object.freeze(['code', 'design', 'web', 'research', 'bible-research', 'memory', 'review', 'qa', 'handoff', 'careful', 'video', 'mixed']);
const HIGH_RISK_PATTERNS = Object.freeze([
  ['production', 'production'], ['prod', 'production'], ['delete', 'destructive'], ['destroy', 'destructive'], ['drop database', 'database'], ['database', 'database'],
  ['credential', 'credentials'], ['secret', 'credentials'], ['token', 'credentials'], ['payment', 'financial'], ['billing', 'financial'], ['financial', 'financial'],
  ['deploy', 'deployment'], ['publish', 'public publishing'], ['send', 'external write'], ['submit', 'external write'], ['provision', 'infrastructure'],
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function tokenize(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
}

function containsAny(text, values) {
  return values.some((value) => {
    if (value.includes(' ')) return text.includes(value);
    return new RegExp(`\\b${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(text);
  });
}

function sourceId(catalog, sourceName) {
  const exact = catalog.descriptors.find((descriptor) => descriptor.capabilityId === `skill.${sourceName}`);
  if (exact) return exact.capabilityId;
  return catalog.descriptors.find((descriptor) => descriptor.kind === 'skill' && descriptor.sourceRef.endsWith(`/${sourceName}/SKILL.md`))?.capabilityId ?? null;
}

function descriptorById(catalog, id) {
  return catalog.descriptors.find((descriptor) => descriptor.capabilityId === id) ?? null;
}

function normalizeRisk(text) {
  const hits = HIGH_RISK_PATTERNS.filter(([term]) => text.includes(term));
  const indicators = unique(hits.map(([, indicator]) => indicator));
  const riskClass = indicators.length >= 2 || containsAny(text, ['production', 'prod', 'delete', 'destroy', 'drop database']) ? 'critical' : indicators.length ? 'high' : 'low';
  return { riskClass, indicators, confirmationClass: riskClass === 'critical' || riskClass === 'high' ? 'user' : 'none' };
}

function inferDomains(text) {
  const domains = [];
  if (containsAny(text, ['code', 'bug', 'feature', 'repository', 'repo', 'app', 'api', 'backend', 'frontend', 'refactor', 'debug', 'database', 'migration', 'sql', 'auth', 'login'])) domains.push('code');
  if (containsAny(text, ['design', 'visual', 'page', 'website', 'landing', 'dashboard', 'ui', 'brand', 'beautiful', 'premium', 'layout'])) domains.push('design');
  if (containsAny(text, ['browser', 'scrape', 'crawl', 'url', 'website', 'form', 'login', 'web'])) domains.push('web');
  if (containsAny(text, ['research', 'investigate', 'compare', 'verify', 'evidence', 'market', 'company', 'current', 'source'])) domains.push('research');
  if (containsAny(text, ['bible', 'scripture', 'passage', 'romans', 'torah', 'covenant', 'yeshua', 'theology'])) domains.push('bible');
  if (containsAny(text, ['remember', 'recall', 'memory', 'decide', 'save this'])) domains.push('memory');
  if (containsAny(text, ['review', 'critique', 'audit', 'diff', 'preflight'])) domains.push('quality');
  if (containsAny(text, ['test', 'qa', 'regression', 'acceptance', 'works'])) domains.push('testing');
  if (containsAny(text, ['handoff', 'resume', 'tomorrow', 'pause', 'another agent'])) domains.push('continuity');
  if (containsAny(text, ['video', 'episode', 'script', 'voiceover', 'thumbnail', 'youtube', 'render'])) domains.push('video');
  if (containsAny(text, ['production', 'deploy', 'delete', 'destroy', 'credential', 'database', 'payment', 'publish'])) domains.push('risk');
  return unique(domains);
}

function inferArtifact(text) {
  if (containsAny(text, ['thumbnail', 'video', 'episode', 'voiceover', 'render'])) return 'media_package';
  if (containsAny(text, ['website', 'landing page', 'dashboard', 'page', 'ui', 'design'])) return 'visual_or_web_artifact';
  if (containsAny(text, ['report', 'brief', 'comparison', 'research', 'evidence', 'sources'])) return 'evidence_brief';
  if (containsAny(text, ['feature', 'app', 'api', 'code', 'bug', 'fix', 'refactor'])) return 'repository_change';
  if (containsAny(text, ['remember', 'recall', 'decision'])) return 'memory_or_decision_note';
  if (containsAny(text, ['handoff', 'resume', 'continue'])) return 'continuity_packet';
  return null;
}

function inferScope(text) {
  const scopes = [];
  if (containsAny(text, ['this repo', 'repository', 'repo', 'codebase', 'project'])) scopes.push('current_repository');
  if (containsAny(text, ['this page', 'website', 'landing page', 'dashboard', 'ui'])) scopes.push('current_or_target_interface');
  if (containsAny(text, ['production', 'prod', 'live'])) scopes.push('production');
  if (containsAny(text, ['company', 'market', 'industry'])) scopes.push('external_subject');
  if (containsAny(text, ['tomorrow', 'later', 'another agent'])) scopes.push('future_session');
  return unique(scopes);
}

function inferConstraints(text) {
  const constraints = [];
  if (containsAny(text, ['without', 'only', 'just', 'no external', 'do not'])) constraints.push('explicit_user_constraint_present');
  if (containsAny(text, ['quick', 'small', 'tiny', 'simple'])) constraints.push('bounded_effort');
  if (containsAny(text, ['premium', 'beautiful', 'polished', 'high quality'])) constraints.push('quality_bar_high');
  if (containsAny(text, ['current', 'latest', 'today', 'now'])) constraints.push('freshness_required');
  return constraints;
}

function inferUnknowns(text, domains, artifact) {
  const unknowns = [];
  if (text.length < 18 || /^(do|make|build|research|review|fix|remember)\s+(this|it|that)[.!?]?$/.test(text)) unknowns.push('subject_or_target');
  if (domains.includes('research') && !domains.includes('bible') && !containsAny(text, ['what', 'why', 'how', 'compare', 'market', 'company', 'source', 'sources', 'current'])) unknowns.push('research_question');
  if (domains.includes('memory') && /remember\s+(this|it|that)[.!?]?$/.test(text)) unknowns.push('memory_payload');
  if (!artifact && domains.length === 0) unknowns.push('desired_result');
  return unique(unknowns);
}

export function normalizeRequest(input) {
  const rawIntent = String(input ?? '').trim();
  const text = rawIntent.toLowerCase().replace(/\s+/g, ' ');
  const domains = inferDomains(text);
  const risk = normalizeRisk(text);
  const intentVerb = tokenize(text).find((token) => ['build', 'make', 'create', 'fix', 'debug', 'design', 'research', 'compare', 'verify', 'remember', 'recall', 'review', 'test', 'handoff', 'resume', 'deploy', 'delete', 'publish', 'write'].includes(token)) ?? null;
  const desiredArtifact = inferArtifact(text);
  const scope = inferScope(text);
  const constraints = inferConstraints(text);
  const unknowns = inferUnknowns(text, domains, desiredArtifact);
  const contextRequirements = unique(['brain-policy', ...(domains.includes('code') ? ['repository', 'exact-source'] : []), ...(domains.includes('design') ? ['visual-brief'] : []), ...(domains.includes('research') || domains.includes('bible') ? ['evidence', 'citations'] : []), ...(domains.includes('memory') ? ['mind-read-only', 'memory-authority'] : []), ...(risk.indicators.length ? ['risk', 'confirmation', 'rollback'] : [])]);
  const outputExpectations = unique([desiredArtifact, ...(containsAny(text, ['cite', 'citation', 'sources']) ? ['citations'] : []), ...(containsAny(text, ['explain', 'why']) ? ['explanation'] : []), ...(containsAny(text, ['test', 'verify', 'works']) ? ['verification_evidence'] : [])]);
  return {
    rawIntent,
    normalizedText: text,
    intent: intentVerb ?? 'unspecified',
    goal: rawIntent,
    domains,
    desiredArtifact,
    scope,
    constraints,
    unknowns,
    riskIndicators: risk.indicators,
    riskClass: risk.riskClass,
    confirmationClass: risk.confirmationClass,
    contextRequirements,
    outputExpectations,
  };
}

function routeFamily(normalized) {
  const text = normalized.normalizedText;
  if (normalized.domains.includes('design') && (normalized.domains.includes('code') || meaningfulChange(text)) && containsAny(text, ['review', 'test', 'qa', 'verify'])) return 'mixed';
  if (normalized.domains.includes('web') && containsAny(text, ['open', 'submit', 'form', 'browser', 'scrape', 'crawl'])) return 'web';
  if (containsAny(text, ['handoff', 'continue tomorrow', 'continue this tomorrow', 'pause this', 'resume', 'another agent', 'pick this up'])) return 'handoff';
  if (containsAny(text, ['remember', 'recall', 'what did we decide', 'save this'])) return 'memory';
  if (containsAny(text, ['review', 'critique', 'audit', 'preflight', 'diff'])) return 'review';
  if (/^(test|run|perform|check)\b/.test(text) || containsAny(text, ['test this', 'run qa', 'qa this', 'does it work', 'make sure it works', 'regression', 'acceptance test'])) return 'qa';
  if (normalized.domains.includes('bible')) return 'research';
  if (normalized.domains.includes('video')) return 'video';
  if (containsAny(text, ['open the website', 'browse', 'scrape', 'crawl', 'fill the form', 'submit the form', 'browser automation'])) return 'web';
  if (normalized.domains.includes('research')) return 'research';
  if (normalized.domains.includes('design') && !containsAny(text, ['backend', 'api', 'database', 'auth', 'refactor code'])) return 'design';
  if (normalized.domains.includes('code')) return 'code';
  if (normalized.riskIndicators.length && !normalized.desiredArtifact) return 'careful';
  return null;
}

function meaningfulChange(text) {
  return containsAny(text, ['build', 'create', 'implement', 'add', 'feature', 'fix', 'refactor', 'change', 'make', 'redesign', 'ship', 'launch']);
}

function selectSpecialists(family, normalized, catalog) {
  const text = normalized.normalizedText;
  const names = [];
  if (family === 'mixed') {
    names.push('web-design', 'code');
    if (containsAny(text, ['component', 'tokens', 'design system'])) names.push('design-system');
  }
  if (family === 'code') {
    if (containsAny(text, ['fix', 'debug', 'broken', 'why'])) names.push('investigate');
    if (containsAny(text, ['architecture', 'plan', 'blast radius'])) names.push('plan-eng-review');
    if (containsAny(text, ['ship', 'commit', 'pull request', 'merge'])) names.push('ship');
  }
  if (family === 'design') {
    if (containsAny(text, ['website', 'landing', 'page', 'saas', 'dashboard', 'funnel'])) names.push('web-design');
    if (containsAny(text, ['component', 'tokens', 'design system'])) names.push('design-system');
    if (containsAny(text, ['visual review', 'polish', 'brand'])) names.push('design-review');
  }
  if (family === 'research') {
    if (normalized.domains.includes('bible')) {
      names.push('bible-research');
      if (containsAny(text, ['translation', 'manuscript', 'lexicon', 'sources', 'citation'])) names.push('scripture-sources');
    } else if (containsAny(text, ['market', 'company', 'current', 'latest', 'web', 'online', 'url'])) names.push('web');
    if (containsAny(text, ['bulk', 'many sites', 'scale', 'scrape'])) names.push('apify');
    else if (containsAny(text, ['scrape', 'crawl', 'web'])) names.push('firecrawl');
  }
  if (family === 'web') {
    if (containsAny(text, ['scrape', 'crawl', 'research', 'url'])) names.push('firecrawl');
    if (containsAny(text, ['browser', 'click', 'form', 'site test'])) names.push('playwright');
    if (containsAny(text, ['bulk', 'many'])) names.push('apify');
  }
  if (family === 'video') {
    if (containsAny(text, ['thumbnail', 'visual', 'brand'])) names.push('design');
    if (containsAny(text, ['render', 'edit', 'audio'])) names.push('ffmpeg');
    if (containsAny(text, ['source', 'reference', 'youtube'])) names.push('media-acquisition');
  }
  return unique(names.map((name) => sourceId(catalog, name)).filter(Boolean));
}

function gateRefs(family, normalized, text) {
  const gates = [];
  if (family === 'mixed') {
    gates.push({ ref: 'gate.design-review', reason: 'The design portion needs a visual/design quality check.' }, { ref: 'gate.visual-qa', reason: 'The interface output needs visual verification.' }, { ref: 'gate.review', reason: 'The implementation portion needs adversarial review.' }, { ref: 'gate.qa', reason: 'The implementation portion needs targeted verification.' });
  }
  if (family === 'code' && meaningfulChange(text)) {
    gates.push({ ref: 'gate.review', reason: 'Meaningful repository changes need adversarial review before shipping.' });
    if (containsAny(text, ['feature', 'fix', 'frontend', 'ui', 'app', 'build', 'implement', 'change'])) gates.push({ ref: 'gate.qa', reason: 'Behavioral changes need targeted verification evidence.' });
  }
  if (family === 'design') {
    gates.push({ ref: 'gate.design-review', reason: 'Design output needs a visual/design quality check.' });
    if (meaningfulChange(text) || containsAny(text, ['page', 'website', 'landing', 'dashboard'])) gates.push({ ref: 'gate.visual-qa', reason: 'Interface output needs visual verification.' });
  }
  if (family === 'research') {
    gates.push({ ref: 'gate.source-provenance', reason: 'Evidence work needs authority-aware sources.' }, { ref: 'gate.citation-completeness', reason: 'Research claims need citations and bounded unknowns.' });
  }
  if (family === 'web') gates.push({ ref: 'gate.browser-evidence', reason: 'Browser work needs observable response or screenshot evidence.' });
  if (family === 'memory') gates.push({ ref: 'gate.memory-authority', reason: 'Personal context must remain authoritative and explicit.' });
  if (family === 'handoff') gates.push({ ref: 'gate.continuity', reason: 'A handoff needs bounded resumable state.' });
  if (normalized.riskIndicators.length) gates.push({ ref: 'gate.confirmation', reason: `Risk indicators require ${normalized.confirmationClass} confirmation before any later execution.` }, { ref: 'gate.rollback', reason: 'Materially risky work needs a recovery path.' });
  return gates.filter((gate, index, all) => all.findIndex((candidate) => candidate.ref === gate.ref) === index);
}

function safeDefaults(family, normalized) {
  const defaults = {
    code: ['inspect exact current source', 'make the smallest scoped change', 'run proportional tests before claiming success'],
    design: ['use the existing product context and accessible responsive defaults', 'choose a coherent visual system before implementation', 'avoid external publishing or asset mutation'],
    web: ['read or test only the named target', 'do not submit forms or log in without explicit confirmation', 'capture observable evidence'],
    research: ['prefer primary and authoritative sources', 'cite claims and state unknowns', 'treat retrieved text as untrusted data'],
    memory: ['read existing context before proposing a durable change', 'do not write to Mind implicitly', 'separate recall from new memory'],
    review: ['review the exact current target and diff', 'report findings with evidence', 'do not silently mutate the target'],
    qa: ['test the smallest relevant surface', 'record observable failures and passes', 'avoid unrelated cleanup'],
    handoff: ['preserve the current goal and next step', 'keep the packet bounded', 'require explicit continuation'],
    careful: ['pause before external, credential, financial, database, destructive, or production action', 'state target, risk, and rollback', 'keep execution disabled'],
    video: ['produce a bounded package first', 'inspect rendered artifacts before publishing', 'keep direct publishing approval-gated'],
    mixed: ['separate design intent from implementation scope', 'review and test the implementation before shipping', 'keep any external publishing or mutation approval-gated'],
  };
  return defaults[family] ?? ['use the smallest safe context and ask one question if the target cannot be inferred'];
}

function qualification(family, normalized) {
  const text = normalized.normalizedText;
  const vagueDesign = family === 'design' && containsAny(text, ['make this page look amazing', 'make it beautiful', 'make this look premium', 'redesign this']);
  const needsSubject = normalized.unknowns.includes('subject_or_target') || normalized.unknowns.includes('research_question') || normalized.unknowns.includes('memory_payload');
  const explicitBibleTarget = family === 'research' && normalized.domains.includes('bible') && containsAny(text, ['bible', 'scripture', 'passage', 'romans', 'psalm', 'john', 'matthew']);
  const materiallyAmbiguous = !family || (needsSubject && !vagueDesign && !explicitBibleTarget && !['handoff', 'careful', 'review', 'qa'].includes(family));
  if (!materiallyAmbiguous) return { required: false, question: null, reason: vagueDesign ? 'Safe design defaults are sufficient for a shadow route.' : 'The target and next safe route are inferable from the ordinary request.' };
  let question = 'What outcome or target should I use, and what should the finished result look like?';
  if (family === 'research') question = 'What specific subject or decision should the research answer, and do you want a brief, comparison, or source-backed deep dive?';
  if (family === 'memory') question = 'What should I remember, and should it be a durable fact/decision or only a note for this task?';
  if (!family) question = 'What result are you aiming for, and is this primarily code, design, research, or something else?';
  return { required: true, question, reason: 'One bundled question resolves a material target, scope, or output ambiguity.', count: 1 };
}

function compositionGraph(family, normalized, specialists, gates, catalog) {
  const primary = sourceId(catalog, family === 'bible-research' || family === 'mixed' ? 'design' : family);
  const nodes = [];
  if (primary) nodes.push({ id: primary, role: 'primary', dependsOn: [] });
  for (const specialist of specialists) nodes.push({ id: specialist, role: 'specialist', dependsOn: primary ? [primary] : [] });
  const designImplementation = (family === 'design' || family === 'mixed') && meaningfulChange(normalized.normalizedText);
  if (designImplementation) {
    const code = sourceId(catalog, 'code');
    if (code && !nodes.some((node) => node.id === code)) nodes.push({ id: code, role: 'downstream', dependsOn: primary ? [primary] : [] });
  }
  for (const gate of gates) nodes.push({ id: gate.ref, role: gate.ref.includes('confirmation') || gate.ref.includes('rollback') ? 'safety_gate' : 'quality_gate', dependsOn: nodes.filter((node) => ['primary', 'specialist', 'downstream'].includes(node.role)).map((node) => node.id).slice(-3) });
  return nodes.slice(0, 8);
}

function rejectedAlternatives(family, normalized) {
  const alternatives = [];
  const reasons = {
    code: 'No stronger code signal than the selected route.', design: 'No stronger visual or product signal than the selected route.', web: 'No explicit browser, scrape, or web interaction is required.', research: 'No evidence-gathering question is present.', video: 'No media-production signal is present.', memory: 'No personal-context or recall signal is present.', review: 'Review is a proportional gate, not the primary task.', qa: 'QA is a proportional gate, not the primary task.', handoff: 'No continuity request is present.', careful: 'Risk handling is a gate unless the request has no other substantive domain.',
  };
  for (const candidate of ROUTE_FAMILIES) if (candidate !== family && candidate !== 'mixed') alternatives.push({ routeFamily: candidate, reason: reasons[candidate] ?? 'Lower deterministic signal.' });
  return alternatives.slice(0, 5);
}

function collectContextScopes(family, normalized, specialists, gates, catalog) {
  const ids = [sourceId(catalog, family === 'mixed' ? 'design' : family), ...specialists, ...gates.map((gate) => gate.ref)].filter(Boolean);
  const scopes = new Set(normalized.contextRequirements);
  for (const id of ids) for (const scope of descriptorById(catalog, id)?.requiredContextScopes ?? []) scopes.add(scope);
  return [...scopes].sort();
}

function contextForecast({ listResult, specialists, gates, family, normalized, catalog }) {
  const selected = [sourceId(catalog, family === 'mixed' ? 'design' : family), ...specialists, ...gates.map((gate) => gate.ref)].filter(Boolean).map((id) => descriptorById(catalog, id)).filter(Boolean);
  const descriptorTokens = Math.max(1, Math.ceil(listResult.descriptors.reduce((sum, descriptor) => sum + JSON.stringify(descriptor).length, 0) / 4));
  const selectedInstructionTokens = selected.reduce((sum, descriptor) => sum + descriptor.contextCost.instruction, 0);
  const evidenceBudgetTokens = family === 'research' ? 1600 : family === 'code' || family === 'design' ? 1000 : 400;
  return {
    phase: selected.length && (normalized.unknowns.length === 0 || family === 'careful') ? 'descriptor_list_then_selected_inspect' : 'descriptor_list_then_one_question',
    budget: { descriptor: descriptorTokens, instruction: selectedInstructionTokens, evidence: evidenceBudgetTokens, max: descriptorTokens + selectedInstructionTokens + evidenceBudgetTokens },
    descriptorsScanned: listResult.telemetry.candidatesScanned,
    selectedInspectCount: 0,
    fullSkillBodiesLoadedDuringList: listResult.telemetry.fullBodyReadsDuringList,
    method: 'forecast_from_descriptor_costs_and_source_sizes; exact evidence cost deferred until execution',
  };
}

function sourceRevisions(catalog, ids) {
  return Object.fromEntries(unique(ids).sort().map((id) => [id, descriptorById(catalog, id)?.sourceRevision ?? null]));
}

export function routeShadowRequest(input, { catalog = createCapabilityCatalog(), generatedAt = '2026-09-01T00:00:00Z' } = {}) {
  const normalized = normalizeRequest(input);
  let family = routeFamily(normalized);
  if (!family && normalized.riskIndicators.length) family = 'careful';
  const listResult = catalog.list({ query: normalized.rawIntent, maxItems: 24 });
  const primaryId = family ? sourceId(catalog, family === 'mixed' ? 'design' : family) : null;
  const specialists = family ? selectSpecialists(family, normalized, catalog) : [];
  const gates = family ? gateRefs(family, normalized, normalized.normalizedText) : [];
  const gateIds = gates.map((gate) => gate.ref);
  const candidateDescriptorIds = unique([primaryId, ...specialists, ...gateIds, ...listResult.descriptors.slice(0, 8).map((descriptor) => descriptor.capabilityId)]).filter(Boolean).slice(0, 16);
  const qualificationResult = qualification(family, normalized);
  const contextScopes = collectContextScopes(family, normalized, specialists, gates, catalog);
  const graph = compositionGraph(family, normalized, specialists, gates, catalog);
  const routeRisk = normalized.riskClass === 'low' ? (['web', 'memory', 'video', 'code', 'design', 'mixed'].includes(family) ? 'medium' : 'low') : normalized.riskClass;
  const confirmationClass = normalized.confirmationClass !== 'none' ? normalized.confirmationClass : family === 'memory' ? 'user' : routeRisk === 'medium' && family === 'web' ? 'policy' : 'none';
  const allRevisions = sourceRevisions(catalog, candidateDescriptorIds);
  const warningIds = candidateDescriptorIds.map((id) => descriptorById(catalog, id)).filter((descriptor) => descriptor && (descriptor.health !== 'healthy' || descriptor.freshness !== 'fresh'));
  const explanation = {
    primary: family ? `Selected ${family} from deterministic intent/domain signals in the ordinary request.` : 'No route family cleared the deterministic signal threshold.',
    specialists: specialists.length ? `Added ${specialists.join(', ')} because their triggers match the normalized goal.` : 'No specialist was needed before a target is clarified.',
    rejectedAlternatives: rejectedAlternatives(family, normalized),
    qualification: qualificationResult.required ? qualificationResult.reason : qualificationResult.reason,
    context: 'Descriptor metadata is sufficient for this shadow decision; exact instructions and evidence are deferred to selected inspection.',
    gates: gates.map((gate) => `${gate.ref}: ${gate.reason}`),
    risk: normalized.riskIndicators.length ? `Risk indicators ${normalized.riskIndicators.join(', ')} require ${confirmationClass} confirmation; execution remains disabled.` : 'No high-risk indicator was detected in the ordinary request.',
    revisions: 'Source revisions are attached to candidate descriptors for later exact-source inspection.',
    health: warningIds.length ? warningIds.map((descriptor) => `${descriptor.capabilityId}: ${descriptor.health}/${descriptor.freshness}`).join('; ') : 'Selected descriptors are healthy and fresh in the repository projection.',
  };
  return {
    schemaVersion: '2.0.0', operation: 'shadow_route', generatedAt, executionExposed: false, providerCalls: 0, externalMutations: 0,
    normalizedRequest: normalized, primaryRouteFamily: family, primaryDescriptorId: primaryId, candidateDescriptorIds, rejectedAlternatives: rejectedAlternatives(family, normalized), selectedSpecialistDescriptorIds: specialists,
    selectedContextScopes: contextScopes, contextForecast: contextForecast({ listResult, specialists, gates, family, normalized, catalog }), qualification: qualificationResult,
    safeDefaults: safeDefaults(family, normalized), proposedCompositionGraph: graph, predictedQualitySafetyGates: gates, riskClass: routeRisk, confirmationClass,
    status: confirmationClass === 'user' || confirmationClass === 'admin' ? 'needs_confirmation_before_any_execution' : 'shadow_only', unsafeExecutionReady: false,
    sourceRevisions: allRevisions, healthWarnings: warningIds.map((descriptor) => ({ capabilityId: descriptor.capabilityId, health: descriptor.health, freshness: descriptor.freshness })), explanation,
    catalogTelemetry: { ...listResult.telemetry, listOperationFullBodyReads: 0 },
  };
}

export function createShadowRouter(options = {}) {
  const catalog = options.catalog ?? createCapabilityCatalog(options);
  return { catalog, normalize: normalizeRequest, route: (input, routeOptions = {}) => routeShadowRequest(input, { ...routeOptions, catalog }) };
}
