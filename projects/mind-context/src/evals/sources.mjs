import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractHeadings, extractLinks, parseFrontmatter, pickTitle} from '../core/frontmatter.mjs';
import {normalizeRepoRelativePath} from '../core/policy.mjs';

function defaultPackageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function defaultRegistryPath() {
  return path.resolve(defaultPackageRoot(), 'fixtures/evaluation-sources.json');
}

function readMarkdownSource(root, entry) {
  const resolvedPath = path.resolve(root, entry.path);
  if (!fs.existsSync(resolvedPath)) throw new Error(`missing_path:${entry.sourceId}`);
  const markdown = fs.readFileSync(resolvedPath, 'utf8');
  const {data: frontmatter, body} = parseFrontmatter(markdown);
  const headings = extractHeadings(body);
  return {
    sourceId: entry.sourceId,
    path: normalizeRepoRelativePath(entry.path),
    title: pickTitle({frontmatter: {...frontmatter, title: entry.title ?? frontmatter.title}, headings, path: entry.path}),
    headings,
    frontmatter,
    links: extractLinks(body),
    freshness: entry.freshness,
    authority: entry.authority,
    privacy: entry.privacy,
    pathClass: entry.pathClass ?? (entry.scope.includes('/canonical') ? 'canonical' : 'supporting'),
    scope: entry.scope,
    content: body,
  };
}

export function validateEvaluationSources(registry) {
  const errors = [];
  if (registry?.version !== '1.0.0') errors.push('version');
  if (!Array.isArray(registry?.sources) || registry.sources.length === 0) errors.push('sources');
  const ids = new Set();
  for (const [index, source] of (registry?.sources ?? []).entries()) {
    if (ids.has(source.sourceId)) errors.push(`duplicate:${source.sourceId}`);
    ids.add(source.sourceId);
    for (const key of ['sourceId', 'path', 'scope', 'authority', 'freshness', 'privacy']) {
      if (!(key in source)) errors.push(`source:${index}:missing:${key}`);
    }
    if (typeof source.path !== 'string' || source.path.includes('..') || source.path.startsWith('/') || source.path.includes('\\')) errors.push(`source:${index}:path`);
    if (!source.path.endsWith('.md')) errors.push(`source:${index}:markdown`);
  }
  return [...new Set(errors)];
}

export function loadEvaluationSources(registryPath = defaultRegistryPath(), root = defaultPackageRoot()) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const errors = validateEvaluationSources(registry);
  if (errors.length) throw new Error(`invalid_source_registry:${errors.join(',')}`);
  return registry.sources.map((entry) => readMarkdownSource(root, entry));
}
