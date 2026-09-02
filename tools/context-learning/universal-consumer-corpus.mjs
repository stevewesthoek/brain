const SEEDS = [
  ['code-fix', 'Fix the login bug in the repository', 'code'],
  ['code-feature', 'Build the feature we discussed with tests', 'code'],
  ['code-plan', 'Plan the code architecture and blast radius for this change', 'code'],
  ['code-review', 'Review the current diff for correctness', 'review'],
  ['code-performance', 'Make the API faster without changing behavior', 'code'],
  ['code-security', 'Fix the authentication security code in the codebase', 'code'],
  ['code-frontend', 'Implement the dashboard code component responsively', 'design'],
  ['code-backend', 'Refactor the backend service and run QA', 'qa'],
  ['research-quick', 'Research the current market options with citations', 'research'],
  ['research-deep', 'Conduct a thorough source-backed investigation of demand', 'research'],
  ['research-compare', 'Compare these companies and explain the evidence', 'research'],
  ['bible-lexical', 'Study the Greek meaning and context of this Bible passage', 'research'],
  ['bible-theology', 'Trace this covenant theme through Scripture with sources', 'research'],
  ['design-new', 'Design a premium landing page for the product', 'design'],
  ['design-mimic', 'Create a design inspired by this screenshot reference', 'design'],
  ['design-upgrade', 'Redesign the existing dashboard and visually QA it', 'mixed'],
  ['web-read', 'Open the website and inspect the page', 'web'],
  ['web-test', 'Use the browser to test the signup form', 'web'],
  ['web-scrape', 'Scrape the named pages and capture observable evidence', 'web'],
  ['memory-recall', 'What did we decide about this project?', 'memory'],
  ['memory-capture', 'Remember that this decision is approved for the project', 'memory'],
  ['memory-review', 'Review all my memories about the strategy', 'review'],
  ['qa-standard', 'Run QA on the feature and report failures', 'qa'],
  ['qa-exhaustive', 'Test everything for regressions', 'qa'],
  ['handoff-pause', 'Pause this and continue tomorrow with the next action', 'handoff'],
  ['handoff-resume', 'Resume this task after checking continuity', 'handoff'],
  ['careful-production', 'Deploy this to production after confirmation and rollback planning', 'careful'],
  ['careful-destructive', 'Delete the production database safely', 'code'],
  ['careful-credentials', 'Rotate the credential and publish the result', 'careful'],
  ['video-plan', 'Plan a narrated video episode', 'video'],
  ['video-script', 'Write the video script and inspect the render', 'video'],
  ['mixed-design-code', 'Build the dashboard and visually QA the interface', 'mixed'],
  ['mixed-research-build', 'Research the market and implement the landing page then test it', 'mixed'],
  ['ambiguous-code', 'Fix the code problem', 'code'],
  ['ambiguous-research', 'Research this', 'research'],
  ['dormant-specialist', 'Fix the code root cause and plan the architecture', 'code'],
  ['continuation-stale', 'Resume the code task from the previous session', 'handoff'],
  ['high-risk-ambiguous', 'Make this production ready', 'careful']
];
const SURFACES = ['plain-text', 'message-field', 'content-field', 'request-field', 'nested-intent', 'session-bound'];

export function buildUniversalConformanceCorpus() {
  return SEEDS.flatMap(([id, prompt, expectedRoute], seedIndex) => SURFACES.map((surface, surfaceIndex) => ({
    scenarioId: `u6d-${String(seedIndex + 1).padStart(2, '0')}-${surface}`,
    semanticId: id,
    category: id,
    prompt,
    expectedRoute,
    surface,
    nativeInput: surface === 'plain-text' ? prompt : surface === 'message-field' ? { message: prompt } : surface === 'content-field' ? { content: prompt } : surface === 'request-field' ? { request: prompt } : surface === 'nested-intent' ? { intent: prompt, metadata: { source: 'fixture' } } : { intent: prompt, session: { id: `session-${seedIndex}`, resumable: true } }
  })));
}

export const UNIVERSAL_CONFORMANCE_SCENARIO_COUNT = buildUniversalConformanceCorpus().length;
