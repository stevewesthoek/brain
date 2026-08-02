import { joinMindPath, loadMindPathRegistry, resolveCanonicalMindPath } from './path-registry.js';
import { MIND_CONTRACT } from '../../../operations/specs/infinite-brain-boundary-contracts.js';
const canonical = (pathId) => resolveCanonicalMindPath(pathId);
export const MIND_ROUTER_CONTRACT_FILES = [
    'AGENTS.md', '00-start-here.md', '00-current-context.md', '00-memory-map.md',
].map((file) => joinMindPath(canonical('agent-context'), file));
export const MIND_CURRENT_SUCCESS_PATH = MIND_CONTRACT.currentSuccessPath;
export const MIND_CURRENT_FAILURE_PATH = MIND_CONTRACT.currentFailurePath;
export const MIND_REVIEW_SURFACES = MIND_CONTRACT.reviewSurfaces;
export const MIND_HISTORICAL_ONLY_PATHS = MIND_CONTRACT.historicalOnlyPaths;
export const MIND_AUTHORITY_LABELS = MIND_CONTRACT.authorityLabels;
export { MIND_CONTRACT };
export const MIND_REQUIRED_PATHS = [
    'inbox-new', 'inbox-failed', 'projects', 'organizations', 'repos', 'people',
    'faith', 'knowledge', 'resources', 'history', 'agent-context', 'kanban-current-authority',
].map(canonical);
export const MIND_LIVE_FILES = [];
export const MIND_REQUIRED_INDEX_FILES = [];
export const MIND_LEGACY_READ_ONLY_PATHS = loadMindPathRegistry().entries
    .filter((entry) => !entry.activeDefaultAllowed && ['compatibility-read', 'historical-read'].includes(entry.readPolicy))
    .flatMap((entry) => entry.literal ? [entry.literal] : []);
export const MIND_ANTI_CLUTTER_LIMITS = {
    [joinMindPath(canonical('agent-context'), '00-current-context.md')]: { maxLines: 150 },
    [canonical('inbox-new')]: { maxAgeDays: 7 },
    [canonical('inbox-failed')]: { maxAgeDays: 3 },
};
