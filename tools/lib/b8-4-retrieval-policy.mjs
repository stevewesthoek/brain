import fs from 'node:fs';

export function loadRetrievalPolicy(filePath) {
  const policy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (policy.task !== 'B8.4') throw new Error('invalid B8.4 retrieval policy');
  if (policy.principles?.structuralMemoryRole !== 'navigation-only') throw new Error('structural memory must remain navigation-only');
  if (policy.principles?.exactSourceRole !== 'authority') throw new Error('exact source must remain authority');
  return policy;
}

export function classifyIntent(intent, policy) {
  for (const [className, definition] of Object.entries(policy.intentClasses)) {
    if (definition.intents.includes(intent)) return className;
  }
  return 'unknown';
}

export function structuralMemoryUsable(freshness) {
  return freshness === 'fresh';
}

export function buildRetrievalPlan({ intent, freshness = 'unknown', policy }) {
  const intentClass = classifyIntent(intent, policy);
  if (intentClass === 'structuralNavigation') {
    if (structuralMemoryUsable(freshness)) {
      return {
        intentClass,
        steps: ['cbm-structural-memory', 'exact-source-read'],
        fallbackUsed: false,
        authority: 'exact-source',
      };
    }
    return {
      intentClass,
      steps: ['bounded-exact-source-search', 'exact-source-read'],
      fallbackUsed: true,
      authority: 'exact-source',
      fallbackReason: freshness === 'unavailable' ? 'provider-unavailable' : freshness === 'stale' ? 'provider-stale' : 'freshness-unknown',
    };
  }
  if (intentClass === 'knownSource' || intentClass === 'canonicalAuthority') {
    return { intentClass, steps: ['exact-source-read'], fallbackUsed: false, authority: 'exact-source' };
  }
  if (intentClass === 'generatedProjection') {
    return { intentClass, steps: ['projection-for-navigation', 'exact-source-read'], fallbackUsed: false, authority: 'exact-source' };
  }
  return { intentClass: 'unknown', steps: ['bounded-exact-source-search', 'exact-source-read'], fallbackUsed: true, authority: 'exact-source', fallbackReason: 'unclassified-intent' };
}

export function authorityRequirements(action, policy) {
  const map = {
    edit: policy.authorityGates.beforeRepositoryEdit,
    'security-policy-decision': policy.authorityGates.beforeSecurityOrPolicyDecision,
    'provider-runtime-claim': policy.authorityGates.beforeProviderOrRuntimeClaim,
    'final-factual-claim': policy.authorityGates.beforeFinalFactualClaim,
  };
  return map[action] ?? ['exact-source-read-supporting-source'];
}

export function evidenceCanAuthorize({ evidenceKind, action = 'edit', exactSourceVerified = false, policy }) {
  if (exactSourceVerified) return true;
  if (evidenceKind === 'cbm-structural-memory' && policy.authorityGates.graphOutputCanAuthorizeWrite === false) return false;
  if ((evidenceKind === 'graphify' || evidenceKind === 'generated-projection') && policy.authorityGates.generatedProjectionCanReplaceSourceVerification === false) return false;
  return action === 'navigation';
}

export function validatePolicyInvariants(policy) {
  const errors = [];
  if (policy.principles.structuralMemoryRole !== 'navigation-only') errors.push('structural-memory-role');
  if (policy.principles.exactSourceRole !== 'authority') errors.push('exact-source-role');
  if (policy.authorityGates.graphOutputCanAuthorizeWrite !== false) errors.push('graph-write-authority');
  if (policy.authorityGates.structuralMemoryCanOverrideRoadmap !== false) errors.push('roadmap-authority');
  if (policy.authorityGates.generatedProjectionCanReplaceSourceVerification !== false) errors.push('projection-authority');
  if (policy.freshnessFallback.stale !== 'skip-cbm-authority-and-use-bounded-exact-source') errors.push('stale-fallback');
  if (policy.freshnessFallback.unavailable !== 'use-bounded-exact-source') errors.push('unavailable-fallback');
  if (policy.broadExploration.blindWholeRepositoryScan !== false) errors.push('blind-scan');
  return errors;
}
