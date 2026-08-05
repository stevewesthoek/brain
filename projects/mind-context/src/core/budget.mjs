export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text ?? '').length / 4));
}

// Estimate tokens for a source based on what will be emitted (citation + metadata),
// never counting full file bodies. This keeps budgeting bounded regardless of file size.
export function estimateSourceReferenceTokens(source) {
  if (Number.isInteger(source.tokens)) return source.tokens;
  // Emit: sourceId + path + authority + freshness + citation + sha256 (truncated)
  const ref = [
    String(source.sourceId ?? ''),
    String(source.path ?? ''),
    String(source.authority ?? ''),
    String(source.freshness ?? ''),
    String(source.citation ?? `${source.path ?? ''}#L1`),
    String(source.sha256 ?? '').slice(0, 12),
  ].join(' ');
  return estimateTokens(ref);
}

export function applyBudget({rankedSources = [], maxItems = 5, maxTokens = 500} = {}) {
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 20) throw new Error('invalid_budget');
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4000) throw new Error('invalid_budget');
  const selected = [];
  const omitted = [];
  let usedTokens = 0;
  for (const ranked of rankedSources) {
    const source = ranked.source ?? ranked;
    const tokenEstimate = estimateSourceReferenceTokens(source);
    if (selected.length >= maxItems) {
      omitted.push({sourceId: source.sourceId, reason: 'item-limit'});
      continue;
    }
    if (usedTokens + tokenEstimate > maxTokens) {
      omitted.push({sourceId: source.sourceId, reason: 'token-budget'});
      continue;
    }
    usedTokens += tokenEstimate;
    selected.push({...ranked, source, tokenEstimate});
  }
  return {
    selected,
    omitted,
    budget: {maxItems, maxTokens, usedItems: selected.length, usedTokens},
    truncation: {truncated: omitted.length > 0, reason: omitted.length > 0 ? 'budget' : null},
  };
}
