export const DEFAULT_EXCLUDED_DIRS = new Set([
  'archive',
  'build',
  'coverage',
  'dist',
  'generated',
  'history',
  'logs',
  'node_modules',
  'runtime',
  '.git',
  '.obsidian',
]);

export const SECRET_PATH_MARKERS = ['.env', 'secret', 'secrets', 'credentials'];

export function normalizeRepoRelativePath(input) {
  if (typeof input !== 'string' || !input) throw new Error('invalid_path');
  const normalized = input.replace(/\\/g, '/');
  if (normalized !== input) throw new Error('path_escape');
  if (normalized.startsWith('/') || normalized.includes('../') || normalized === '..') {
    throw new Error('path_escape');
  }
  return normalized;
}

export function isExcludedPath(repoRelativePath) {
  const normalized = normalizeRepoRelativePath(repoRelativePath);
  const segments = normalized.split('/');
  if (segments.some((segment) => DEFAULT_EXCLUDED_DIRS.has(segment))) return true;
  if (segments.some((segment) => segment.startsWith('.env'))) return true;
  if (segments.some((segment) => SECRET_PATH_MARKERS.some((marker) => segment.toLowerCase().includes(marker)))) return true;
  return false;
}

export function scopeContainsPath(scope, repoRelativePath) {
  const normalizedPath = normalizeRepoRelativePath(repoRelativePath);
  const normalizedScope = normalizeRepoRelativePath(scope);
  if (normalizedScope === '.') return true;
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
}
