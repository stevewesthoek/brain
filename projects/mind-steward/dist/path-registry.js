import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');
const RESOLVER = path.join(BRAIN_ROOT, 'tools', 'mind-canonical-path-registry.mjs');
function invokeResolver(command, argument) {
    return execFileSync(process.execPath, [RESOLVER, command, ...(argument === undefined ? [] : [argument])], {
        cwd: BRAIN_ROOT,
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '' },
    }).trim();
}
export function loadMindPathRegistry() {
    const parsed = JSON.parse(invokeResolver('export'));
    if (typeof parsed.registryVersion !== 'string' || !Array.isArray(parsed.entries))
        throw new Error('invalid_canonical_path_registry');
    return { registryVersion: parsed.registryVersion, entries: parsed.entries };
}
export function resolveCanonicalMindPath(pathId) {
    const result = invokeResolver('resolve', pathId).match(/^path=(.+)$/m)?.[1];
    if (!result)
        throw new Error('canonical_path_not_found');
    return result;
}
export function describeMindPath(token) {
    const parsed = JSON.parse(invokeResolver('describe', token));
    return parsed.entry ?? null;
}
export function isRegisteredCompatibilityRead(token) {
    const entry = describeMindPath(token);
    return Boolean(entry && !entry.activeDefaultAllowed && ['compatibility-read', 'historical-read', 'scoped-authoritative-read'].includes(entry.readPolicy));
}
export function isCanonicalActivePath(token) {
    return describeMindPath(token)?.activeDefaultAllowed === true;
}
export function joinMindPath(rootPath, leaf) {
    return `${rootPath.replace(/\/+$/, '')}/${leaf.replace(/^\/+/, '')}`;
}
