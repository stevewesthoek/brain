import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {extractHeadings, extractLinks, parseGenericMetadata, normalizeLifecycle, pickTitle} from './frontmatter.mjs';
import {isExcludedPath, normalizeRepoRelativePath, scopeContainsPath} from './policy.mjs';

function isMarkdownPath(repoRelativePath) {
  return /\.md$/i.test(repoRelativePath);
}

function hasBinarySignature(buffer) {
  return buffer.includes(0);
}

function toSourceId(repoRelativePath) {
  return repoRelativePath.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'source';
}

function readMarkdownMetadata(root, repoRelativePath, limits) {
  const absPath = path.join(root, repoRelativePath);
  const bytes = fs.statSync(absPath).size;
  if (limits?.maxSourceBytes && bytes > limits.maxSourceBytes) throw new Error(`source_bytes_cap_exceeded:${repoRelativePath}`);
  const buffer = fs.readFileSync(absPath);
  if (hasBinarySignature(buffer)) return null;
  const markdown = buffer.toString('utf8');
  const {data: frontmatter, body} = parseGenericMetadata(markdown);
  const headings = extractHeadings(body);
  const rawLifecycle = frontmatter.lifecycle ?? frontmatter.status ?? '';
  return {
    sourceId: toSourceId(repoRelativePath),
    path: repoRelativePath,
    title: pickTitle({frontmatter, headings, path: repoRelativePath}),
    headings,
    frontmatter,
    links: extractLinks(body),
    freshness: frontmatter.freshness ?? 'unknown',
    authority: frontmatter.authority ?? 'supporting',
    lifecycle: normalizeLifecycle(rawLifecycle),
    privacy: frontmatter.privacy ?? 'public',
    scope: frontmatter.scope ?? (path.posix.dirname(repoRelativePath) || '.'),
    pathClass: frontmatter.pathClass ?? (repoRelativePath.includes('/canonical/') ? 'canonical' : 'supporting'),
    content: body,
    bytes,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function walk(root, relativeDir, output, limits, totals, forbiddenScopes) {
  const absDir = path.join(root, relativeDir);
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relativePath = normalizeRepoRelativePath(path.posix.join(relativeDir, entry.name).replace(/^\.\//, ''));
    if (isExcludedPath(relativePath)) continue;
    if (forbiddenScopes.some((scope) => scopeContainsPath(scope, relativePath))) continue;
    const absPath = path.join(root, relativePath);
    const stats = fs.lstatSync(absPath);
    if (stats.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(absPath);
      const resolvedTarget = path.resolve(path.dirname(absPath), linkTarget);
      if (!resolvedTarget.startsWith(path.resolve(root))) throw new Error('symlink_escape');
      continue;
    }
    if (entry.isDirectory()) {
      walk(root, relativePath, output, limits, totals, forbiddenScopes);
      continue;
    }
    if (!isMarkdownPath(relativePath)) continue;
    const source = readMarkdownMetadata(root, relativePath, limits);
    if (source) {
      totals.files += 1;
      totals.bytes += source.bytes;
      if (limits?.maxFiles && totals.files > limits.maxFiles) throw new Error(`source_file_cap_exceeded:${totals.files}`);
      if (limits?.maxBytes && totals.bytes > limits.maxBytes) throw new Error(`source_corpus_bytes_cap_exceeded:${totals.bytes}`);
      output.push(source);
    }
  }
}

export function discoverSources({root, scopes = [], forbiddenScopes = [], limits} = {}) {
  if (typeof root !== 'string' || !root || !fs.existsSync(root)) return [];
  const resolvedRoot = path.resolve(root);
  const allowedScopes = (scopes.length > 0 ? scopes : ['.']).map(normalizeRepoRelativePath);
  const normalizedForbiddenScopes = forbiddenScopes.map(normalizeRepoRelativePath);
  const walkScopes = allowedScopes
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .filter((scope, index, all) => !all.slice(0, index).some((parent) => scopeContainsPath(parent, scope)));
  const discovered = [];
  const totals = {files: 0, bytes: 0};
  for (const scope of walkScopes) {
    if (isExcludedPath(scope) || normalizedForbiddenScopes.some((forbidden) => scopeContainsPath(forbidden, scope))) continue;
    const relativeScope = scope === '.' ? '' : scope;
    const absoluteScope = path.join(resolvedRoot, relativeScope);
    if (!fs.existsSync(absoluteScope)) continue;
    const stat = fs.lstatSync(absoluteScope);
    if (stat.isSymbolicLink()) {
      const target = path.resolve(path.dirname(absoluteScope), fs.readlinkSync(absoluteScope));
      if (!target.startsWith(resolvedRoot)) throw new Error('symlink_escape');
      continue;
    }
    if (stat.isDirectory()) walk(resolvedRoot, relativeScope, discovered, limits, totals, normalizedForbiddenScopes);
    else if (isMarkdownPath(relativeScope)) {
      const source = readMarkdownMetadata(resolvedRoot, relativeScope, limits);
      if (source) {
        totals.files += 1;
        totals.bytes += source.bytes;
        if (limits?.maxFiles && totals.files > limits.maxFiles) throw new Error(`source_file_cap_exceeded:${totals.files}`);
        if (limits?.maxBytes && totals.bytes > limits.maxBytes) throw new Error(`source_corpus_bytes_cap_exceeded:${totals.bytes}`);
        discovered.push(source);
      }
    }
  }
  const filtered = discovered.flatMap((source) => {
    const relative = normalizeRepoRelativePath(source.path);
    if (normalizedForbiddenScopes.some((scope) => scopeContainsPath(scope, relative))) return [];
    const authorizedScope = allowedScopes
      .filter((scope) => scope === '.' || scopeContainsPath(scope, relative))
      .sort((a, b) => b.length - a.length)[0];
    return authorizedScope ? [{...source, authorizedScope}] : [];
  });
  return filtered.sort((a, b) => a.path.localeCompare(b.path) || a.sourceId.localeCompare(b.sourceId));
}
