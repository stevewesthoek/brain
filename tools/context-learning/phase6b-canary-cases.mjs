const safeCodePrompts = [
  'Analyze the repository architecture.',
  'Map the code architecture and identify independent risk areas.',
  'Analyze the implementation of the login handler code in this repository without changing it.',
  'Map the API code path in this repository.',
  'Plan a read-only code change for the task parser in this repository.',
  'Analyze the context broker implementation in this repo.',
  'Plan a read-only code change for the profile resolver in this repository.',
  'Explain the routing code and its current boundaries.',
  'Inspect the exact source for the evidence handler without changing it.',
  'Plan a read-only code change for the graph validator in this repository.',
  'Analyze the login flow implementation in this repository.',
  'Map the CLI entry code and its dependencies.',
  'Explain how the repository selects its current profile.',
  'Inspect the code path for task packet validation.',
  'Plan a read-only code change for the data adapter in this repository.',
  'Analyze the current continuation implementation.',
  'Map the repository test boundaries for the code path.',
  'Explain the current source-resolution logic without changing it.',
  'Inspect the codebase for unrelated specialist loading.',
  'Plan a read-only code change for the activation state machine.'
];

export const burnInCases = Object.freeze(safeCodePrompts.slice(0, 5).map((prompt, index) => ({ id: `burn-in-${index + 1}`, category: 'normal', prompt, routeClass: prompt.startsWith('Plan') ? 'read-only-plan' : 'read-only-analysis' })));

export const cohortCases = Object.freeze([
  ...safeCodePrompts.map((prompt, index) => ({ id: `cohort-normal-${index + 1}`, category: 'normal', prompt, routeClass: prompt.startsWith('Plan') ? 'read-only-plan' : 'read-only-analysis' })),
  ...[
    'Analyze this code.', 'Explain this function without changing it.', 'Plan a read-only code change.', 'Map the architecture in this repository.', 'Inspect the current code path.', 'Analyze the current implementation only.', 'Plan a bounded code review without changing files.', 'Explain the repository boundary.', 'Inspect the selected code source.', 'Plan a read-only analysis of the API.'
  ].map((prompt, index) => ({ id: `cohort-edge-${index + 1}`, category: 'vague-edge', prompt, routeClass: 'read-only-analysis' })),
  ...safeCodePrompts.slice(0, 5).map((prompt, index) => ({ id: `cohort-stale-${index + 1}`, category: 'stale-conflict-continuation', prompt, routeClass: 'read-only-analysis', currentState: index === 0 ? { repositoryRevision: 'old-revision' } : index === 1 ? { worktreeClean: false } : index === 2 ? { contextFresh: false } : index === 3 ? { contextConflict: true } : { descriptorFresh: false } })),
  ...['Deploy this.', 'Delete production data.', 'Rotate credentials.', 'Publish this code.', 'Push this change.'].map((prompt, index) => ({ id: `cohort-high-risk-${index + 1}`, category: 'high-risk', prompt, routeClass: 'high-risk' })),
  ...['catalog_unavailable', 'broker_unavailable', 'invalid_graph', 'capability_unavailable', 'descriptor_stale'].map((failureMode, index) => ({ id: `cohort-fallback-${index + 1}`, category: 'controlled-fallback', prompt: safeCodePrompts[index], routeClass: 'read-only-analysis', failureMode }))
]);

export default cohortCases;
