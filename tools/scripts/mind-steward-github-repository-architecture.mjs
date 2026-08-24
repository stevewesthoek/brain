function field(value, source, retrievedAt, { freshness = 'fresh', confidence = 0.8, uncertainty = [] } = {}) {
  return { value, source, retrieved_at: retrievedAt, freshness, confidence, uncertainty, provenance: { source, retrieved_at: retrievedAt } };
}

function unknownField(source, retrievedAt, reason) {
  return field(null, source, retrievedAt, { freshness: 'unavailable', confidence: 0, uncertainty: [reason] });
}

function sectionText(markdown, headings) {
  const wanted = new Set(headings.map((heading) => heading.toLowerCase()));
  const lines = markdown.split(/\r?\n/);
  const collected = [];
  let active = false;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1]?.trim().toLowerCase();
    if (heading) active = wanted.has(heading);
    else if (active && line.trim()) collected.push(line.replace(/^\s*[-*+]\s+/, '').replace(/[`*_]/g, '').trim());
    if (heading && !wanted.has(heading) && collected.length > 0) break;
  }
  return collected.slice(0, 12);
}

export function extractGitHubArchitectureSignals(markdown) {
  return {
    architectural_components: sectionText(markdown, ['architecture', 'components', 'architecture overview', 'services']),
    interfaces_apis: sectionText(markdown, ['api', 'apis', 'interfaces', 'protocols', 'integrations']),
    deployment_model: sectionText(markdown, ['deployment', 'deployments', 'hosting', 'self-hosting', 'installation']),
    supported_environments: sectionText(markdown, ['environments', 'platforms', 'runtime', 'supported platforms']),
    operational_considerations: sectionText(markdown, ['operations', 'operational considerations', 'monitoring', 'limitations', 'caveats']),
  };
}

export function buildGitHubArchitectureEvidence({ markdown, source, retrievedAt, freshness = 'fresh', confidence = 0.8, truncated = false } = {}) {
  if (typeof markdown !== 'string' || !source || !retrievedAt) throw new Error('github_architecture_evidence_inputs_required');
  const signals = extractGitHubArchitectureSignals(markdown);
  const evidence = Object.fromEntries(Object.entries(signals).map(([name, value]) => [name, value.length ? field(value, source, retrievedAt, { freshness, confidence, uncertainty: truncated ? ['architecture source was truncated to the bounded documentation limit'] : [] }) : unknownField(source, retrievedAt, 'architecture signal was not documented in the bounded source')]));
  return { schema_version: '1.0.0', evidence_type: 'github_repository_architecture', source, retrieved_at: retrievedAt, freshness, confidence, uncertainty: [...(truncated ? ['architecture source was truncated'] : []), ...(freshness === 'stale' ? ['architecture evidence is older than the configured freshness window'] : [])], signals: evidence, provenance: { source, retrieved_at: retrievedAt, content_type: 'public README documentation', truncated }, safety: { read_only: true, source_inspection: false, dependency_analysis: false, repository_execution: false, automatic_adoption: false, canonical_writes: false } };
}
