const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_README_BYTES = 64 * 1024;
import { buildGitHubArchitectureEvidence } from './mind-steward-github-repository-architecture.mjs';

function field(value, source, retrievedAt, { freshness = 'fresh', confidence = 1, uncertainty = [] } = {}) {
  return { value, source, retrieved_at: retrievedAt, freshness, confidence, uncertainty, provenance: { source, retrieved_at: retrievedAt } };
}

function unknownField(source, retrievedAt, reason) {
  return field(null, source, retrievedAt, { freshness: 'unavailable', confidence: 0, uncertainty: [reason] });
}

function sourceFor(evidence) {
  return `https://api.github.com/repos/${evidence.repository.owner}/${evidence.repository.name}/readme`;
}

function freshnessFor(retrievedAt, now, staleAfterMs) {
  return now.getTime() - new Date(retrievedAt).getTime() > staleAfterMs ? 'stale' : 'fresh';
}

function normalizeLine(line) {
  return line.replace(/^\s*[-*+]\s+/, '').replace(/^#+\s*/, '').replace(/[`*_]/g, '').trim();
}

function sectionText(markdown, headings) {
  const lines = markdown.split(/\r?\n/);
  const wanted = new Set(headings.map((heading) => heading.toLowerCase()));
  const collected = [];
  let active = false;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1]?.trim().toLowerCase();
    if (heading) active = wanted.has(heading);
    else if (active && line.trim()) collected.push(normalizeLine(line));
    if (heading && !wanted.has(heading) && collected.length > 0) break;
  }
  return collected.slice(0, 12);
}

function firstParagraph(markdown) {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const paragraph = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('![') || line.startsWith('```')) continue;
    if (paragraph.length && /^[-*+]\s/.test(line)) break;
    paragraph.push(normalizeLine(line));
    if (paragraph.join(' ').length >= 500) break;
  }
  return paragraph.join(' ').slice(0, 500) || null;
}

function extractSignals(markdown) {
  const capabilities = sectionText(markdown, ['features', 'capabilities', 'what it does', 'key features']);
  const targetUsers = sectionText(markdown, ['who is it for', 'target users', 'users', 'audience']);
  const integrations = sectionText(markdown, ['integrations', 'integration', 'connectors', 'supported platforms']);
  const examples = sectionText(markdown, ['examples', 'use cases', 'usage', 'getting started']);
  const limitations = sectionText(markdown, ['limitations', 'known limitations', 'caveats', 'not supported']);
  const technologyMentions = [...new Set((markdown.match(/`[^`\n]{2,80}`/g) ?? []).map((value) => value.slice(1, -1)).filter((value) => !value.includes(' ')).slice(0, 20))];
  return { stated_purpose: firstParagraph(markdown), main_capabilities: capabilities, target_users: targetUsers, supported_technologies: technologyMentions, integration_points: integrations, examples_use_cases: examples, limitations, documentation_length: markdown.length };
}

function emptyEvidence(source, retrievedAt, reason) {
  const names = ['stated_purpose', 'main_capabilities', 'target_users', 'supported_technologies', 'integration_points', 'examples_use_cases', 'limitations', 'documentation_length'];
  return Object.fromEntries(names.map((name) => [name, unknownField(source, retrievedAt, reason)]));
}

function mapSignals(signals, source, retrievedAt, freshness) {
  return Object.fromEntries(Object.entries(signals).map(([name, value]) => [name, field(value, source, retrievedAt, { freshness, confidence: value === null || (Array.isArray(value) && value.length === 0) ? 0 : 0.85, uncertainty: value === null || (Array.isArray(value) && value.length === 0) ? ['README did not provide this signal'] : [] })]));
}

async function fetchReadme(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'brain-mind-steward-read-only' }, signal: controller.signal });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return { response, body };
  } finally { clearTimeout(timer); }
}

export async function enrichGitHubRepositoryDocumentation(evidence, { fetchImpl = globalThis.fetch, now = new Date(), retrievedAt = now.toISOString(), timeoutMs = DEFAULT_TIMEOUT_MS, staleAfterMs = DEFAULT_STALE_AFTER_MS, includeArchitecture = false } = {}) {
  if (!evidence?.repository?.owner || !evidence.repository.name) throw new Error('github_repository_identity_required');
  const source = sourceFor(evidence);
  if (typeof fetchImpl !== 'function') return { ...evidence, documentation_status: 'unavailable', documentation_evidence: emptyEvidence(source, retrievedAt, 'documentation fetch is unavailable in this environment'), documentation_retrieved_at: retrievedAt, documentation_freshness: 'unavailable', uncertainty: [...(evidence.uncertainty ?? []), 'documentation fetch is unavailable in this environment'] };
  try {
    const result = await fetchReadme(source, fetchImpl, timeoutMs);
    if (!result.response.ok || !result.body || typeof result.body.content !== 'string') {
      const reason = result.response.status === 403 || result.response.status === 429 ? 'GitHub documentation metadata rate limited' : result.response.status === 404 ? 'README unavailable, private, or repository has no README' : `GitHub documentation unavailable (HTTP ${result.response.status})`;
      return { ...evidence, documentation_status: 'unavailable', documentation_evidence: emptyEvidence(source, retrievedAt, reason), documentation_retrieved_at: retrievedAt, documentation_freshness: 'unavailable', uncertainty: [...(evidence.uncertainty ?? []), reason] };
    }
    const markdown = Buffer.from(result.body.content, 'base64').toString('utf8');
    const bounded = Buffer.byteLength(markdown, 'utf8') > MAX_README_BYTES ? Buffer.from(markdown, 'utf8').subarray(0, MAX_README_BYTES).toString('utf8') : markdown;
    const freshness = freshnessFor(retrievedAt, now, staleAfterMs);
    const truncation = bounded.length < markdown.length ? ['README was truncated to the bounded documentation limit'] : [];
    const documentation = { ...evidence, documentation_status: 'available', documentation_evidence: mapSignals(extractSignals(bounded), source, retrievedAt, freshness), documentation_retrieved_at: retrievedAt, documentation_freshness: freshness, documentation_provenance: { source, retrieved_at: retrievedAt, readme_url: result.body.html_url ?? null, truncated: bounded.length < markdown.length }, uncertainty: [...(evidence.uncertainty ?? []), ...truncation, ...(freshness === 'stale' ? ['documentation is older than the configured freshness window'] : [])], safety: { ...evidence.safety, read_only: true, automatic_adoption: false, repository_execution: false, dependency_installation: false } };
    return includeArchitecture ? { ...documentation, architecture_status: 'available', architecture_evidence: buildGitHubArchitectureEvidence({ markdown: bounded, source, retrievedAt, freshness, truncated: bounded.length < markdown.length }) } : documentation;
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'GitHub documentation request timed out' : 'GitHub documentation request failed';
    return { ...evidence, documentation_status: 'unavailable', documentation_evidence: emptyEvidence(source, retrievedAt, reason), documentation_retrieved_at: retrievedAt, documentation_freshness: 'unavailable', uncertainty: [...(evidence.uncertainty ?? []), reason] };
  }
}
