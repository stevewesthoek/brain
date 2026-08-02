import {normalizeRepoRelativePath, scopeContainsPath} from './core/policy.mjs';

export function normalizeFixturePath(input) {
  return normalizeRepoRelativePath(input);
}

export function loadAuthorizedSources(sources, scopes = [], forbidden = []) {
  const allowed = [];
  const exclusions = [];
  for (const source of sources ?? []) {
    const path = normalizeFixturePath(source.path);
    if (source.symlinkTarget) {
      const target = normalizeFixturePath(source.symlinkTarget);
      const parent = path.split('/').slice(0, -1).join('/');
      if (parent && !target.startsWith(`${parent}/`) && target !== parent) throw new Error('symlink_escape');
    }
    if (forbidden.includes(source.sourceId) || !scopes.some((scope) => scopeContainsPath(scope, path))) {
      exclusions.push({sourceId: source.sourceId, reason: 'forbidden-or-out-of-scope'});
      continue;
    }
    allowed.push({...source, path});
  }
  return {allowed, exclusions};
}
