export const MIND_ROUTER_CONTRACT_FILES = [
    'router/current.md',
    'router/map.md',
    'router/rules.md',
    'router/taxonomy.md',
    'router/maintenance.md',
    'router/mind-steward.md',
];
export const MIND_REQUIRED_PATHS = [
    'HOME.md',
    'TODAY.md',
    'README.md',
    'AGENTS.md',
    'router/',
    'capture/inbox/',
    'capture/daily/',
    'capture/failed/',
    'live/',
    'wiki/',
    'sources/',
    'archive/',
];
export const MIND_LIVE_FILES = [
    'live/dashboard.md',
    'live/tasks.md',
    'live/projects.md',
    'live/workflows.md',
    'live/decisions.md',
];
export const MIND_REQUIRED_INDEX_FILES = [
    'capture/inbox/README.md',
    'capture/daily/README.md',
    'capture/failed/README.md',
    'wiki/index.md',
    'sources/index.md',
    'archive/index.md',
];
export const MIND_LEGACY_READ_ONLY_PATHS = [
    '01-inbox/',
    '02-strategy/',
    '03-projects/',
    '04-tasks/',
    '05-areas/',
    '06-resources/',
    '07-templates/',
    '08-archive/',
];
export const MIND_ANTI_CLUTTER_LIMITS = {
    'router/current.md': { maxLines: 150 },
    'TODAY.md': { maxLines: 200 },
    'live/tasks.md': { maxLines: 300 },
    'live/projects.md': { maxLines: 250 },
    'wiki/*.md': { maxLines: 500 },
    'capture/inbox/': { maxAgeDays: 7 },
    'capture/failed/': { maxAgeDays: 3 },
};
