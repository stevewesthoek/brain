const GITHUB_REPOSITORY_URL = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?(?:[?#].*)?$/i;

function stringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim()) : [];
}

export function parseGitHubRepositoryUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(GITHUB_REPOSITORY_URL);
  if (!match) return null;
  const owner = match[1];
  const name = match[2];
  return {
    canonical_url: `https://github.com/${owner}/${name}`,
    repository_id: `${owner}/${name}`.toLowerCase(),
    owner,
    name,
  };
}

export function extractGitHubRepositoryUrls(text) {
  if (typeof text !== 'string') return [];
  const candidates = text.match(/https?:\/\/github\.com\/[^/\s]+\/[^/\s#?]+(?:\.git)?/gi) ?? [];
  return [...new Set(candidates.map((candidate) => parseGitHubRepositoryUrl(candidate.replace(/[.,;:!?)]\s*$/, ''))?.canonical_url).filter(Boolean))];
}

export function buildGitHubRepositoryEvidence({ url, sourceReference, sourceHash, ingestionId, retrievedAt, metadata = null } = {}) {
  const identity = parseGitHubRepositoryUrl(url);
  if (!identity) throw new Error('invalid_github_repository_url');
  const supplied = metadata && typeof metadata === 'object' ? metadata : {};
  const hasSuppliedMetadata = Object.keys(supplied).length > 0;
  return {
    schema_version: '1.0.0',
    evidence_type: 'github_repository',
    repository: identity,
    source_reference: sourceReference ?? identity.canonical_url,
    source_hash: sourceHash ?? null,
    ingestion_id: ingestionId ?? null,
    retrieved_at: retrievedAt ?? new Date().toISOString(),
    freshness: supplied.freshness ?? 'unknown',
    provenance: {
      source_reference: sourceReference ?? identity.canonical_url,
      source_hash: sourceHash ?? null,
      retrieval: hasSuppliedMetadata ? 'explicit-supplied-metadata' : 'url-identity-only',
    },
    confidence: typeof supplied.confidence === 'number' ? supplied.confidence : 0.5,
    uncertainty: [
      ...(stringList(supplied.uncertainty)),
      ...(hasSuppliedMetadata ? [] : ['remote repository metadata was not fetched by this report-only adapter']),
      'relevance, overlap, maintenance, licensing, and adoption require human review',
    ],
    review_required: true,
    description: typeof supplied.description === 'string' ? supplied.description : null,
    technology_indicators: stringList(supplied.technology_indicators),
    activity_indicators: stringList(supplied.activity_indicators),
    maintenance_signals: stringList(supplied.maintenance_signals),
    licensing: supplied.licensing ?? null,
    documentation_signals: stringList(supplied.documentation_signals),
    dependency_signals: stringList(supplied.dependency_signals),
    advisory_questions: [
      'Is this repository relevant to the current Brain/Mind objective?',
      'Does it overlap with an existing capability?',
      'Is it maintained and appropriately licensed?',
      'What benefits and risks require human review?',
    ],
    safety: {
      read_only: true,
      automatic_clone: false,
      dependency_installation: false,
      repository_execution: false,
      automatic_adoption: false,
      automatic_decision: false,
    },
  };
}

export function assertUniqueGitHubRepositoryIdentities(evidenceItems) {
  const seen = new Set();
  for (const evidence of evidenceItems ?? []) {
    const repositoryId = evidence?.repository?.repository_id;
    if (!repositoryId) continue;
    if (seen.has(repositoryId)) throw new Error(`duplicate_github_repository_identity:${repositoryId}`);
    seen.add(repositoryId);
  }
  return true;
}
