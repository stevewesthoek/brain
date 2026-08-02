import {scopeContainsPath} from '../core/policy.mjs';

export function calculateCaseMetrics({testCase, pack, elapsedMs}) {
  const selectedIds = pack.sources.map((source) => source.sourceId);
  const expected = new Set(testCase.expectedSources ?? []);
  const forbidden = new Set(testCase.forbiddenSources ?? []);
  const truePositives = selectedIds.filter((sourceId) => expected.has(sourceId)).length;
  const precision = selectedIds.length === 0 ? 1 : truePositives / selectedIds.length;
  const recall = expected.size === 0 ? 1 : truePositives / expected.size;
  const forbiddenViolations = selectedIds.filter((sourceId) => forbidden.has(sourceId)).length;
  const outOfScopeViolations = (pack.sources ?? []).filter((source) => {
    const allowed = (testCase.allowedScopes ?? []).some((scope) => scopeContainsPath(scope, source.path));
    const denied = (testCase.forbiddenScopes ?? []).some((scope) => scopeContainsPath(scope, source.path));
    return !allowed || denied;
  }).length;
  const privacyViolations = Number(pack.privacyClassification !== testCase.privacyClassification);
  const authorityMatch = Number((pack.sources[0]?.authority ?? 'unknown') === testCase.authorityClass);
  const freshnessMatch = Number(pack.freshness === (testCase.freshnessRequirement === 'stale-allowed' ? pack.freshness : testCase.freshnessRequirement || pack.freshness));
  const citationCompleteness = selectedIds.length === 0 ? 1 : Number((pack.sources ?? []).every((source) => Boolean(source.citation)));
  const conflictPreservation = Number((pack.conflicts ?? []).length);
  const unknownPreservation = Number((pack.unknowns ?? []).length);
  const budgetCompliance = Number((pack.budget?.usedItems ?? 0) <= (pack.budget?.maxItems ?? 0) && (pack.budget?.usedTokens ?? 0) <= (pack.budget?.maxTokens ?? 0));
  return {
    caseId: testCase.caseId,
    precision,
    recall,
    forbiddenViolations,
    outOfScopeViolations,
    privacyViolations,
    authorityMatch,
    freshnessMatch,
    citationCompleteness,
    conflictPreservation,
    unknownPreservation,
    budgetCompliance,
    tokenEstimate: pack.budget.usedTokens,
    latencyMs: elapsedMs,
    selectedSourceIds: selectedIds,
    expectedSourceIds: [...expected],
  };
}

export function summarizeMetrics(results) {
  const total = results.length || 1;
  const sum = (key) => results.reduce((acc, item) => acc + Number(item[key] ?? 0), 0);
  return {
    cases: results.length,
    precision: Number((sum('precision') / total).toFixed(4)),
    recall: Number((sum('recall') / total).toFixed(4)),
    forbiddenViolations: sum('forbiddenViolations'),
    outOfScopeViolations: sum('outOfScopeViolations'),
    privacyViolations: sum('privacyViolations'),
    authorityMatch: Number((sum('authorityMatch') / total).toFixed(4)),
    freshnessMatch: Number((sum('freshnessMatch') / total).toFixed(4)),
    citationCompleteness: Number((sum('citationCompleteness') / total).toFixed(4)),
    conflictPreservation: sum('conflictPreservation'),
    unknownPreservation: sum('unknownPreservation'),
    budgetCompliance: Number((sum('budgetCompliance') / total).toFixed(4)),
    tokenEstimate: sum('tokenEstimate'),
    latencyMs: Number(sum('latencyMs').toFixed(3)),
  };
}
