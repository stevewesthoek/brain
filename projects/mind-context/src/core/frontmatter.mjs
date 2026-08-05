function parseScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => item.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'));
  }
  return trimmed.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

const KEY_ALIASES = new Map([
  ['last reviewed', 'last_reviewed'],
  ['last-reviewed', 'last_reviewed'],
  ['lastreviewd', 'last_reviewed'],
  ['review after', 'review_after'],
  ['review-after', 'review_after'],
  ['freshness risk', 'freshness_risk'],
  ['freshness-risk', 'freshness_risk'],
  ['owner role', 'owner_role'],
  ['owner-role', 'owner_role'],
  ['depends on', 'depends_on'],
  ['depends-on', 'depends_on'],
  ['path class', 'path_class'],
  ['path-class', 'path_class'],
  ['pathclass', 'path_class'],
]);

function normalizeKey(raw) {
  const lower = raw.toLowerCase().trim();
  if (KEY_ALIASES.has(lower)) return KEY_ALIASES.get(lower);
  return lower.replace(/[\s-]+/g, '_');
}

function parseKeyValueLines(lines) {
  const data = {};
  for (const line of lines) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = normalizeKey(line.slice(0, index));
    const value = line.slice(index + 1);
    if (!key) continue;
    data[key] = parseScalar(value);
  }
  return data;
}

export function parseFrontmatter(markdown) {
  if (typeof markdown !== 'string' || !markdown.startsWith('---\n')) return {data: {}, body: markdown ?? ''};
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return {data: {}, body: markdown};
  const data = parseKeyValueLines(markdown.slice(4, end).split('\n'));
  return {data, body: markdown.slice(end + 5)};
}

// Parse initial fenced YAML block: ```yaml\n...\n```
export function parseFencedYaml(markdown) {
  if (typeof markdown !== 'string') return {data: {}, body: markdown ?? ''};
  const match = markdown.match(/^```yaml\n([\s\S]*?)\n```\n?/);
  if (!match) return {data: {}, body: markdown};
  const data = parseKeyValueLines(match[1].split('\n'));
  return {data, body: markdown.slice(match[0].length)};
}

// Parse leading bold Markdown metadata: **key:** value lines at the top of the document
export function parseBoldMd(markdown) {
  if (typeof markdown !== 'string') return {data: {}, body: markdown ?? ''};
  const data = {};
  let offset = 0;
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^\*\*([^*:]+):\*\*\s*(.*)/);
    if (!match) break;
    const key = normalizeKey(match[1]);
    const value = match[2].trim();
    if (key) data[key] = parseScalar(value);
    offset += line.length + 1;
  }
  if (Object.keys(data).length === 0) return {data: {}, body: markdown};
  return {data, body: markdown.slice(offset)};
}

function skipPrologue(markdown) {
  const lines = markdown.split('\n');
  let offset = 0;
  const maxPrologueLines = 5;
  for (let i = 0; i < Math.min(lines.length, maxPrologueLines); i++) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line) || line.trim() === '') {
      offset += line.length + 1;
      continue;
    }
    break;
  }
  return offset > 0 ? markdown.slice(offset) : null;
}

// Generic metadata parser: tries YAML frontmatter, then fenced YAML, then bold MD
// Applies at document start, then retries after skipping bounded H1/blank prologue
export function parseGenericMetadata(markdown) {
  if (typeof markdown !== 'string') return {data: {}, body: markdown ?? ''};
  if (markdown.startsWith('---\n')) {
    const result = parseFrontmatter(markdown);
    if (Object.keys(result.data).length > 0) return result;
  }
  if (markdown.startsWith('```yaml\n')) {
    const result = parseFencedYaml(markdown);
    if (Object.keys(result.data).length > 0) return result;
  }
  const boldResult = parseBoldMd(markdown);
  if (Object.keys(boldResult.data).length > 0) return boldResult;
  const afterPrologue = skipPrologue(markdown);
  if (afterPrologue !== null) {
    if (afterPrologue.startsWith('---\n')) {
      const result = parseFrontmatter(afterPrologue);
      if (Object.keys(result.data).length > 0) return {data: result.data, body: result.body};
    }
    if (afterPrologue.startsWith('```yaml\n')) {
      const result = parseFencedYaml(afterPrologue);
      if (Object.keys(result.data).length > 0) return {data: result.data, body: result.body};
    }
    const boldAfter = parseBoldMd(afterPrologue);
    if (Object.keys(boldAfter.data).length > 0) return {data: boldAfter.data, body: boldAfter.body};
  }
  return {data: {}, body: markdown};
}

const CURRENT_LIFECYCLE_PHRASES = new Set([
  'current', 'active', 'latest', 'live',
  'active operational reference',
  'active reference',
  'operational',
]);
const STALE_LIFECYCLE_PHRASES = new Set([
  'stale', 'archived', 'deprecated', 'outdated', 'old', 'superseded',
]);

// Normalize lifecycle/status fields to canonical current|stale|unknown
export function normalizeLifecycle(value) {
  const normalized = String(value ?? '').toLowerCase().trim();
  if (!normalized) return 'unknown';
  if (CURRENT_LIFECYCLE_PHRASES.has(normalized)) return 'current';
  if (STALE_LIFECYCLE_PHRASES.has(normalized)) return 'stale';
  return 'unknown';
}

export function extractHeadings(markdown) {
  const headings = [];
  for (const line of String(markdown ?? '').split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (!match) continue;
    headings.push({level: match[1].length, text: match[2].trim()});
  }
  return headings;
}

export function extractLinks(markdown) {
  const links = [];
  const linkPattern = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of String(markdown ?? '').matchAll(linkPattern)) links.push(match[1]);
  return links;
}

export function pickTitle({frontmatter, headings, path}) {
  if (frontmatter?.title) return String(frontmatter.title);
  const firstHeading = headings.find((heading) => heading.level === 1);
  if (firstHeading) return firstHeading.text;
  const base = String(path ?? '').split('/').pop() ?? 'document';
  return base.replace(/\.md$/i, '');
}
