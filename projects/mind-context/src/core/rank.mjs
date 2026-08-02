function normalizeQuery(query) {
  return String(query ?? '').trim().toLowerCase();
}

function countHits(text, queryTerms) {
  const haystack = String(text ?? '').toLowerCase();
  return queryTerms.reduce((count, term) => count + (term && haystack.includes(term) ? 1 : 0), 0);
}

function getStatusBonus(status) {
  switch (String(status ?? '').toLowerCase()) {
    case 'current':
    case 'active':
    case 'latest':
      return 20;
    case 'draft':
      return -5;
    case 'archived':
      return -20;
    default:
      return 0;
  }
}

function getFreshnessBonus(freshness) {
  switch (String(freshness ?? '').toLowerCase()) {
    case 'fresh':
      return 10;
    case 'mixed':
      return 5;
    case 'stale':
      return 0;
    default:
      return -5;
  }
}

function getAuthorityBonus(authority) {
  switch (String(authority ?? '').toLowerCase()) {
    case 'canonical':
      return 15;
    case 'supporting':
      return 8;
    case 'conflicting':
      return 0;
    case 'untrusted':
      return -20;
    default:
      return -10;
  }
}

export function rankSources({query, sources = []} = {}) {
  const normalizedQuery = normalizeQuery(query);
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  return [...sources].map((source) => {
    const title = String(source.title ?? '');
    const headings = Array.isArray(source.headings) ? source.headings.map((heading) => heading.text ?? heading) : [];
    const content = String(source.content ?? '');
    const frontmatter = source.frontmatter ?? {};
    const components = {
      titleExact: normalizedQuery && title.trim().toLowerCase() === normalizedQuery ? 100 : 0,
      titleTerms: countHits(title, queryTerms) * 20,
      headingTerms: countHits(headings.join(' '), queryTerms) * 12,
      linkTerms: countHits((source.links ?? []).join(' '), queryTerms) * 10,
      canonicalPathClass: String(source.pathClass ?? '').toLowerCase() === 'canonical' ? 30 : 0,
      status: getStatusBonus(frontmatter.status),
      freshness: getFreshnessBonus(source.freshness),
      authority: getAuthorityBonus(source.authority),
      contentTerms: countHits(content, queryTerms) * 4,
    };
    const score = Object.values(components).reduce((sum, value) => sum + value, 0);
    return {source, score, components};
  }).sort((a, b) => b.score - a.score || a.source.path.localeCompare(b.source.path) || a.source.sourceId.localeCompare(b.source.sourceId));
}
