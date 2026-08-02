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

export function parseFrontmatter(markdown) {
  if (typeof markdown !== 'string' || !markdown.startsWith('---\n')) return {data: {}, body: markdown ?? ''};
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return {data: {}, body: markdown};
  const raw = markdown.slice(4, end).split('\n');
  const data = {};
  for (const line of raw) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (!key) continue;
    data[key] = parseScalar(value);
  }
  return {data, body: markdown.slice(end + 5)};
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
