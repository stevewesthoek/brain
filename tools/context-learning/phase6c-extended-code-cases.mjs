const categoryDefinitions = [
  ['BUG_FIXES', [
    'Fix the null handling bug in the session parser code.', 'Fix the off-by-one error in the pagination code.', 'Fix the date rollover bug in the scheduling code.', 'Fix the race-safe ordering bug in the queue code.', 'Fix the error mapping bug in the API client code.'
  ]],
  ['FEATURE_WORK', [
    'Build the bounded retry feature in the code.', 'Add a feature flag helper to this codebase.', 'Implement the missing export in the configuration code.', 'Build the requested notification preference feature in code.', 'Add a small audit summary feature without broad refactoring.'
  ]],
  ['REFACTORING', [
    'Refactor the duplicate parser code while preserving behavior.', 'Refactor the request helpers into one clear code boundary.', 'Simplify the repeated date formatting code.', 'Refactor the code path so validation has one owner.', 'Clean up the code structure around the response builder.'
  ]],
  ['CODE_QUALITY', [
    'Improve the code clarity of the result normalizer.', 'Make the error handling code easier to follow.', 'Improve the code quality of the input boundary.', 'Remove the unnecessary branch from this implementation code.', 'Make this code more maintainable without changing its API.'
  ]],
  ['TEST_FAILURES', [
    'Fix the assertion failure in the validation code.', 'Repair the broken regression behavior in the parser code.', 'Fix the failing code path exposed by the test suite.', 'Restore the expected code behavior after the test failure.', 'Fix the test-reported bug in the request code.'
  ]],
  ['PERFORMANCE', [
    'Make the repeated lookup code much faster.', 'Improve the performance of the JSON normalization code.', 'Reduce unnecessary work in the API response code.', 'Optimize the code path that formats repeated records.', 'Make the cache lookup code faster without changing results.'
  ]],
  ['SECURITY', [
    'Improve security in the input parsing code.', 'Fix the unsafe output encoding in this code.', 'Harden the request validation code against untrusted values.', 'Improve the security boundary around the session code.', 'Fix the code path that accepts an unsafe redirect value.'
  ]],
  ['FRONTEND_IMPLEMENTATION', [
    'Implement the accessible form control in the frontend code.', 'Add the loading state to the dashboard component code.', 'Fix the keyboard interaction in the frontend code.', 'Improve the mobile layout behavior in the UI code.', 'Build the empty-state component in the frontend code.'
  ]],
  ['BACKEND', [
    'Implement the missing backend handler code.', 'Improve the service-layer error handling code.', 'Fix the backend request timeout behavior.', 'Add the bounded response mapping to the backend code.', 'Refactor the backend validation boundary.'
  ]],
  ['DATA_STORAGE', [
    'Fix the data storage normalization code.', 'Add a bounded in-memory record lookup feature.', 'Improve the storage adapter error handling code.', 'Refactor the data mapping code without changing its contract.', 'Fix the missing-value behavior in the persistence code.'
  ]],
  ['API', [
    'Improve the API code for invalid requests.', 'Add a stable pagination field to the API response code.', 'Fix the API client retry classification code.', 'Implement the missing API response serializer.', 'Refactor the API error boundary code.'
  ]],
  ['CONFIGURATION', [
    'Fix the configuration code for invalid environment values.', 'Add validation for the service configuration code.', 'Improve the configuration defaulting behavior in the code.', 'Implement a safe feature toggle in the configuration code.', 'Refactor the configuration parser without changing its public API.'
  ]],
  ['DOCUMENTATION_PLUS_CODE', [
    'Document and improve the code contract for the parser.', 'Add code documentation for the response boundary.', 'Document the retry behavior in the code and implement its missing guard.', 'Improve the code comments and fix the normalization helper.', 'Document the configuration code and preserve its defaults.'
  ]],
  ['REVIEW_HEAVY_TASKS', [
    'Implement this code change with a clear validation target.', 'Build this code change with explicit validation boundaries.', 'Fix this code path and preserve a reviewable diff.', 'Refactor this code with a small, auditable change.', 'Implement the code change with regression protection.'
  ]],
  ['QA_HEAVY_TASKS', [
    'Implement the code change with targeted behavior checks.', 'Fix this code path and run its tests.', 'Build the frontend code change with functional coverage.', 'Improve the API code for edge cases.', 'Refactor this code while preserving observable behavior.'
  ]],
  ['UNKNOWN_REPO_AREA', [
    'Why is the code not working? Map the smallest relevant area first.', 'Fix the broken code path after bounded repository discovery.', 'Find the relevant code for this error and repair it safely.', 'Debug the unknown code area in this repository before making the smallest fix.', 'Map the relevant implementation code and explain the likely defect.'
  ]],
  ['KNOWN_EXACT_FILE', [
    'Fix the exact code file src/auth/session.mjs.', 'Implement the change in src/api/client.mjs only.', 'Repair the known code function in src/queue.mjs.', 'Improve the code in src/config.mjs without broad inspection.', 'Fix the named code parser function in src/parser.mjs.'
  ]],
  ['HIGH_RISK_CODE_TASK', [
    'Deploy this code to production.', 'Delete the production database migration.', 'Rotate the credentials used by this code.', 'Publish this code change publicly.', 'Push this code change to the main branch.'
  ]],
  ['AMBIGUOUS_PRODUCT_REQUEST', [
    'Fix the login problem.', 'Build the feature we discussed.', 'Make faster.', 'Make dashboard better.', 'Finish this.',
    'Clean code.', 'Add payments.', 'Improve security.', 'Make this production ready.', 'Why not working?', 'Make API better.', 'Improve mobile experience.'
  ]],
  ['INFERABLE_PRODUCT_REQUEST', [
    'Add an email validation helper in code.', 'Improve API error handling code.', 'Fix queue ordering in the code.', 'Add an accessible submit button to the frontend code.', 'Refactor the duplicate date formatter code.'
  ]],
  ['CONTINUATION', [
    'Continue the bounded code task from the current packet.', 'Finish the remaining implementation code step.', 'Continue the code fix with the existing repository authority.', 'Resume the explicit code plan at its next action.', 'Complete the next bounded code implementation step.'
  ]],
  ['STALE_CONTINUATION', [
    'Continue the code task after the branch advanced.', 'Resume the code plan after the target file changed.', 'Finish the code task after the source revision changed.', 'Continue the implementation despite a source revision conflict.', 'Resume the code task with conflicting repository analysis.'
  ]],
  ['DORMANT_SPECIALIST_REQUIRED', [
    'Implement the code fix using the relevant performance specialist.', 'Plan a bounded code change for the repository architecture.', 'Improve the data code using the relevant database specialist.', 'Fix the security-sensitive code with the relevant security specialist.', 'Implement the frontend code with the relevant browser specialist.'
  ]],
  ['CONTROLLED_FAILURE', [
    'Implement this code change with an unavailable descriptor.', 'Fix this code path while the Context Broker is unavailable.', 'Build this code change with an invalid task packet.', 'Improve this code with an invalid composition graph.', 'Implement this code while the canary mechanism is unavailable.', 'Fix this code after a Review failure.', 'Build this code after a QA failure.', 'Refactor this code with the selected specialist unavailable.', 'Implement this code after a stale descriptor.', 'Fix this code after a controlled gate failure.'
  ]]
];

const staleStateFor = (category, index) => category === 'STALE_CONTINUATION'
  ? [{ repositoryRevision: 'phase6c-old-revision' }, { worktreeClean: false }, { contextFresh: false }, { contextConflict: true }, { sourceConflict: true }][index]
  : {};

const failureModeFor = (category, index) => category === 'CONTROLLED_FAILURE'
  ? ['descriptor_stale', 'broker_unavailable', 'invalid_graph', 'capability_unavailable', 'canary_unavailable', 'review_failure', 'qa_failure', 'selected_specialist_unavailable', 'descriptor_stale', 'review_failure'][index]
  : null;

const expectedQuestionPrompts = new Set([
  'Build the feature we discussed.', 'Make faster.', 'Make this production ready.', 'Finish this.', 'Why not working?',
  'Deploy this code to production.', 'Delete the production database migration.', 'Rotate the credentials used by this code.', 'Publish this code change publicly.',
  'Push this code change to the main branch.', 'Add payments.', 'Improve security.'
]);

export const extendedCodeCases = Object.freeze(categoryDefinitions.flatMap(([category, prompts]) => prompts.map((prompt, index) => ({
  id: `phase6c-${category.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
  category,
  prompt,
  routeClass: category === 'HIGH_RISK_CODE_TASK' ? 'high-risk' : 'read-only-analysis',
  currentState: staleStateFor(category, index),
  failureMode: failureModeFor(category, index),
  expectedQuestion: expectedQuestionPrompts.has(prompt)
}))));

export const extendedCategoryCounts = Object.freeze(Object.fromEntries(categoryDefinitions.map(([category, prompts]) => [category, prompts.length])));
export default extendedCodeCases;
