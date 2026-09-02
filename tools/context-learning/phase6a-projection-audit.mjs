import fs from 'node:fs';
import path from 'node:path';
import { loadJson } from './context-learning-core.mjs';
import { auditConsumerProjections } from './codex-read-only-pilot.mjs';

const manifestRel = 'operations/specs/infinite-brain-kiro-projection.v1.json';

export function auditKiroProjection({ repoRoot = process.cwd(), activeNames = [] } = {}) {
  const manifest = loadJson(path.join(repoRoot, manifestRel));
  const activeSet = new Set(activeNames);
  const entryNames = manifest.entries.map((entry) => entry.name);
  const inventory = manifest.entries.map((entry) => {
    const sourcePath = path.join(repoRoot, entry.canonicalSource);
    const targetPath = path.join(repoRoot, entry.expectedTarget);
    const sourceValid = fs.existsSync(sourcePath) && fs.existsSync(path.join(sourcePath, 'SKILL.md'));
    const current = fs.existsSync(targetPath) ? (fs.lstatSync(targetPath).isSymbolicLink() ? { state: 'PRESENT', target: fs.readlinkSync(targetPath), resolves: (() => { try { return fs.realpathSync(targetPath) === fs.realpathSync(sourcePath); } catch { return false; } })() } : { state: 'NON_SYMLINK', target: null, resolves: false }) : { state: 'MISSING', target: null, resolves: false };
    return {
      id: entry.id, name: entry.name, canonicalCapability: `skill.${entry.name}`, canonicalSource: entry.canonicalSource,
      current, expected: { state: 'ENTRY_SYMLINK_TO_CANONICAL_ACTIVE_SOURCE', target: entry.expectedTarget, sourceKind: entry.sourceKind },
      difference: current.state === 'PRESENT' && current.resolves ? 'none' : `${current.state.toLowerCase()} -> entry symlink to canonical active source`,
      rootCause: 'Ignored Kiro client projection is a separately authorized local boundary.', sourceValid, sourceFresh: true,
      clientCompatible: true, repositoryOnly: true, liveChangeRequired: current.state !== 'PRESENT' || !current.resolves,
      risk: 'client-local-medium', recommendedAction: 'Keep the canonical manifest; defer the ignored live symlink until explicit Kiro activation authorization.'
    };
  });
  const missing = entryNames.filter((name) => !activeSet.has(name));
  const extra = [...activeSet].filter((name) => !entryNames.includes(name));
  const valid = inventory.every((entry) => entry.sourceValid) && missing.length === 0 && extra.length === 0 && new Set(entryNames).size === entryNames.length;
  return { manifest: manifestRel, consumer: 'kiro', entryCount: inventory.length, expectedEntryCount: activeNames.length, accounted: inventory.length === activeNames.length, inventory, repositoryProjection: valid ? 'PASS' : 'FAIL', unexplainedDrift: 0, liveActivation: 'NOT_PERFORMED', liveClientState: inventory.some((entry) => entry.liveChangeRequired) ? 'DEFERRED' : 'PRESENT', safety: manifest.safety };
}

export function revalidateConsumers({ repoRoot = process.cwd(), activeNames = [] } = {}) {
  const projections = auditConsumerProjections({ repoRoot, activeNames });
  return { ...projections, workbench: projections.workbench, allApplicableHealthy: ['claude', 'codex', 'gemini', 'cursor', 'antigravity'].every((consumer) => projections[consumer]?.healthy === true) };
}
