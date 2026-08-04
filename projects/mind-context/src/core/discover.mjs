import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {extractHeadings, extractLinks, parseFrontmatter, pickTitle} from './frontmatter.mjs';
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

function readMarkdownMetadata(root, repoRelativePath) {
  const absPath = path.join(root, repoRelativePath);
  const buffer = fs.readFileSync(absPath);
  if (hasBinarySignature(buffer)) return null;
  const markdown = buffer.toString('utf8');
  const {data: frontmatter, body} = parseFrontmatter(markdown);
  const headings = extractHeadings(body);
  return {
    sourceId: toSourceId(repoRelativePath),
    path: repoRelativePath,
    title: pickTitle({frontmatter, headings, path: repoRelativePath}),
    headings,
    frontmatter,
    links: extractLinks(body),
    freshness: frontmatter.freshness ?? 'unknown',
    authority: frontmatter.authority ?? 'supporting',
    privacy: frontmatter.privacy ?? 'public',
    scope: frontmatter.scope ?? (path.posix.dirname(repoRelativePath) || '.'),
    pathClass: frontmatter.pathClass ?? (repoRelativePath.includes('/canonical/') ? 'canonical' : 'supporting'),
    content: body,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function walk(root, relativeDir, output) {
  const absDir = path.join(root, relativeDir);
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relativePath = normalizeRepoRelativePath(path.posix.join(relativeDir, entry.name).replace(/^\.\//, ''));
    if (isExcludedPath(relativePath)) continue;
    const absPath = path.join(root, relativePath);
    const stats = fs.lstatSync(absPath);
    if (stats.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(absPath);
      const resolvedTarget = path.resolve(path.dirname(absPath), linkTarget);
      if (!resolvedTarget.startsWith(path.resolve(root))) throw new Error('symlink_escape');
      continue;
    }
    if (entry.isDirectory()) {
      walk(root, relativePath, output);
      continue;
    }
    if (!isMarkdownPath(relativePath)) continue;
    const source = readMarkdownMetadata(root, relativePath);
    if (source) output.push(source);
  }
}

export function discoverSources({root, scopes = [], forbiddenScopes = []} = {}) {
  if (typeof root !== 'string' || !root || !fs.existsSync(root)) return [];
  const resolvedRoot = path.resolve(root);
  const allowedScopes = scopes.length > 0 ? scopes : ['.'];
  const discovered = [];
  walk(resolvedRoot, '', discovered);
  const filtered = discovered.flatMap((source) => {
    const relative = normalizeRepoRelativePath(source.path);
    if (forbiddenScopes.some((scope) => scopeContainsPath(scope, relative))) return [];
    const authorizedScope = allowedScopes
      .filter((scope) => scope === '.' || scopeContainsPath(scope, relative))
      .sort((a, b) => b.length - a.length)[0];
    return authorizedScope ? [{...source, authorizedScope}] : [];
  });
  return filtered.sort((a, b) => a.path.localeCompare(b.path) || a.sourceId.localeCompare(b.sourceId));
}
