const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function field(value, source, retrievedAt, { freshness = 'fresh', confidence = 1, uncertainty = [] } = {}) {
  return { value, source, retrieved_at: retrievedAt, freshness, confidence, uncertainty, provenance: { source, retrieved_at: retrievedAt } };
}

function unknownField(source, retrievedAt, reason) {
  return field(null, source, retrievedAt, { freshness: 'unavailable', confidence: 0, uncertainty: [reason] });
}

function emptyMetadata(source, retrievedAt, reason) {
  const names = ['description', 'stars', 'forks', 'watchers', 'last_update', 'last_release', 'recent_activity', 'issue_activity', 'pull_request_activity', 'primary_language', 'ecosystem', 'topics', 'readme_available', 'documentation_signals', 'license'];
  return Object.fromEntries(names.map((name) => [name, unknownField(source, retrievedAt, reason)]));
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'brain-mind-steward-read-only' }, signal: controller.signal });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

function sourceFor(evidence) {
  return `https://api.github.com/repos/${evidence.repository.owner}/${evidence.repository.name}`;
}

function releaseSourceFor(evidence) {
  return `${sourceFor(evidence)}/releases/latest`;
}

function freshnessFor(retrievedAt, now, staleAfterMs) {
  return now.getTime() - new Date(retrievedAt).getTime() > staleAfterMs ? 'stale' : 'fresh';
}

function mapMetadata(body, release, source, releaseSource, retrievedAt, freshness) {
  const confidence = 1;
  const releaseValue = release && typeof release === 'object' ? {
    tag_name: typeof release.tag_name === 'string' ? release.tag_name : null,
    published_at: typeof release.published_at === 'string' ? release.published_at : null,
    html_url: typeof release.html_url === 'string' ? release.html_url : null,
  } : null;
  return {
    description: field(typeof body.description === 'string' ? body.description : null, source, retrievedAt, { freshness, confidence, uncertainty: typeof body.description === 'string' ? [] : ['repository did not supply a description'] }),
    stars: field(typeof body.stargazers_count === 'number' ? body.stargazers_count : null, source, retrievedAt, { freshness, confidence }),
    forks: field(typeof body.forks_count === 'number' ? body.forks_count : null, source, retrievedAt, { freshness, confidence }),
    watchers: field(typeof body.subscribers_count === 'number' ? body.subscribers_count : (typeof body.watchers_count === 'number' ? body.watchers_count : null), source, retrievedAt, { freshness, confidence, uncertainty: body.subscribers_count === undefined ? ['watcher count may represent repository watchers rather than subscribers'] : [] }),
    last_update: field(typeof body.updated_at === 'string' ? body.updated_at : null, source, retrievedAt, { freshness, confidence }),
    last_release: field(releaseValue, releaseSource, retrievedAt, { freshness, confidence, uncertainty: releaseValue ? [] : ['latest release unavailable or repository has no release'] }),
    recent_activity: field(typeof body.pushed_at === 'string' ? [`last_push:${body.pushed_at}`] : [], source, retrievedAt, { freshness, confidence, uncertainty: body.pushed_at ? [] : ['push activity unavailable'] }),
    issue_activity: field(typeof body.open_issues_count === 'number' ? [`open_issues:${body.open_issues_count}`] : [], source, retrievedAt, { freshness, confidence, uncertainty: body.open_issues_count === undefined ? ['issue activity unavailable'] : [] }),
    pull_request_activity: unknownField(source, retrievedAt, 'pull request activity requires a separate bounded endpoint and is not fetched by this adapter'),
    primary_language: field(typeof body.language === 'string' ? body.language : null, source, retrievedAt, { freshness, confidence, uncertainty: body.language ? [] : ['primary language unavailable'] }),
    ecosystem: field(typeof body.language === 'string' ? [body.language] : [], source, retrievedAt, { freshness, confidence, uncertainty: body.language ? ['ecosystem is approximated from the repository language; no dependency installation occurred'] : ['ecosystem unavailable'] }),
    topics: field(Array.isArray(body.topics) ? body.topics.filter((topic) => typeof topic === 'string') : [], source, retrievedAt, { freshness, confidence }),
    readme_available: unknownField(source, retrievedAt, 'README availability requires a separate bounded content request and was not fetched'),
    documentation_signals: unknownField(source, retrievedAt, 'documentation signals require bounded content inspection and were not fetched'),
    license: field(body.license && typeof body.license === 'object' ? { key: body.license.key ?? null, name: body.license.name ?? null, spdx_id: body.license.spdx_id ?? null } : null, source, retrievedAt, { freshness, confidence, uncertainty: body.license ? [] : ['license unavailable'] }),
  };
}

export async function enrichGitHubRepositoryEvidence(evidence, { fetchImpl = globalThis.fetch, now = new Date(), retrievedAt = now.toISOString(), timeoutMs = DEFAULT_TIMEOUT_MS, staleAfterMs = DEFAULT_STALE_AFTER_MS } = {}) {
  if (!evidence?.repository?.owner || !evidence.repository.name) throw new Error('github_repository_identity_required');
  const source = sourceFor(evidence);
  const releaseSource = releaseSourceFor(evidence);
  if (typeof fetchImpl !== 'function') {
    return { ...evidence, metadata_status: 'unavailable', metadata: emptyMetadata(source, retrievedAt, 'metadata fetch is unavailable in this environment'), metadata_retrieved_at: retrievedAt, freshness: 'unavailable', uncertainty: [...(evidence.uncertainty ?? []), 'metadata fetch is unavailable in this environment'] };
  }
  try {
    const repositoryResult = await fetchJson(source, fetchImpl, timeoutMs);
    if (!repositoryResult.response.ok || !repositoryResult.body || typeof repositoryResult.body !== 'object') {
      const reason = repositoryResult.response.status === 403 || repositoryResult.response.status === 429 ? 'GitHub metadata rate limited' : repositoryResult.response.status === 404 ? 'repository unavailable, private, or deleted' : `GitHub metadata unavailable (HTTP ${repositoryResult.response.status})`;
      return { ...evidence, metadata_status: 'unavailable', metadata: emptyMetadata(source, retrievedAt, reason), metadata_retrieved_at: retrievedAt, freshness: 'unavailable', uncertainty: [...(evidence.uncertainty ?? []), reason] };
    }
    let release = null;
    try {
      const releaseResult = await fetchJson(releaseSource, fetchImpl, timeoutMs);
      if (releaseResult.response.ok) release = releaseResult.body;
    } catch { release = null; }
    const freshness = freshnessFor(retrievedAt, now, staleAfterMs);
    const priorUncertainty = evidence.uncertainty ?? [];
    const identityOnlyUncertainty = priorUncertainty.filter((entry) => entry === 'remote repository metadata was not fetched by this report-only adapter');
    const currentUncertainty = priorUncertainty.filter((entry) => !identityOnlyUncertainty.includes(entry));
    return { ...evidence, metadata_status: 'available', metadata: mapMetadata(repositoryResult.body, release, source, releaseSource, retrievedAt, freshness), metadata_retrieved_at: retrievedAt, freshness, uncertainty: [...currentUncertainty, ...(freshness === 'stale' ? ['metadata is older than the configured freshness window'] : [])], provenance: { ...evidence.provenance, prior_uncertainty: identityOnlyUncertainty }, safety: { ...evidence.safety, read_only: true, automatic_adoption: false, repository_execution: false, dependency_installation: false } };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'GitHub metadata request timed out' : 'GitHub metadata request failed';
    return { ...evidence, metadata_status: 'unavailable', metadata: emptyMetadata(source, retrievedAt, reason), metadata_retrieved_at: retrievedAt, freshness: 'unavailable', uncertainty: [...(evidence.uncertainty ?? []), reason] };
  }
}
