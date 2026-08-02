export function renderContextPackJson(pack) {
  return JSON.stringify(pack, null, 2);
}

export function renderContextPackMarkdown(pack) {
  const lines = [];
  lines.push(`# Context Pack ${pack.version}`);
  lines.push('');
  lines.push(`- Query: \`${pack.queryId}\``);
  lines.push(`- Freshness: \`${pack.freshness}\``);
  lines.push(`- Privacy: \`${pack.privacyClassification}\``);
  lines.push(`- Budget: ${pack.budget.usedItems}/${pack.budget.maxItems} items, ${pack.budget.usedTokens}/${pack.budget.maxTokens} tokens`);
  lines.push('');
  lines.push('## Sources');
  if (pack.sources.length === 0) {
    lines.push('- None');
  } else {
    for (const source of pack.sources) {
      lines.push(`- \`${source.sourceId}\` ${source.citation} (${source.authority}, ${source.freshness})`);
    }
  }
  if (pack.conflicts.length > 0) {
    lines.push('');
    lines.push('## Conflicts');
    for (const conflict of pack.conflicts) {
      lines.push(`- ${conflict.field}: \`${conflict.leftSourceId}\` vs \`${conflict.rightSourceId}\``);
    }
  }
  if (pack.unknowns.length > 0) {
    lines.push('');
    lines.push('## Unknowns');
    for (const unknown of pack.unknowns) lines.push(`- ${unknown}`);
  }
  if (pack.exclusions.length > 0) {
    lines.push('');
    lines.push('## Exclusions');
    for (const exclusion of pack.exclusions) {
      lines.push(`- \`${exclusion.sourceId}\`: ${exclusion.reason}`);
    }
  }
  if (pack.safetyWarnings.length > 0) {
    lines.push('');
    lines.push('## Safety');
    for (const warning of pack.safetyWarnings) lines.push(`- ${warning}`);
  }
  return lines.join('\n');
}
