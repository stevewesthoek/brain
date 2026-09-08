# Agent Mode A0.2 evidence — 2026-09-08

## Result

**A0.2 restricted-proof gate: PASS; upstream base adoption: DENIED.** The
pinned DeepSeek Harness source was inspected and built in an isolated temporary
checkout. A Brain-owned ephemeral overlay over `sdk-minimal` now runs through
the real SDK child-process boundary for a replay-backed read-only turn, denied
shell call, cancellation, and crash-after-effect reconciliation. The shipped
base `sdk-minimal` profile itself remains unsafe: it activates unrestricted
local filesystem access, local subprocess support, a persistent shell, an
editor, and jobs. Brain must not adopt that base profile or treat its
composition as a security boundary.

No live provider, AWS credential, billable inference, host mutation, package
installation in Brain, or production runtime change was performed.

## Pinned source

| Field | Value |
|---|---|
| Repository | `https://github.com/deepseek-ai/deepseek-harness` |
| Commit | `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` |
| Version | `0.1.3-alpha.2` |
| Checkout | temporary isolated directory; not a Brain dependency |

Brain records the pin and admission-side topology contract in
`projects/brain-core/src/agent-mode/deepseek-harness-restricted-profile.ts`.
That module is deliberately not a Harness profile file: upstream composition
is observed and then admitted or refused by Brain policy.

## Evidence collected

### Passed

- A temporary upstream test using the real Harness `Context`, `AgentLoop`,
  `ToolRuntime`, session projection and mocked LLM adapter executed one
  `brain_read` call and rejected an undeclared `shell` call before dispatch.
  Both tests passed.
- The same test proved one session identity was retained across every mocked
  LLM request and that no shell or auxiliary provider was registered in that
  test topology.
- `tools/scripts/agent-mode-a02-harness-proof.mjs` ran the custom restricted
  overlay through the public `DeepSeekHarness` SDK. The result was
  `readOnlyRun=passed`, `deniedShell=passed`, `cancellation=passed`,
  `crashAfterEffect=passed`, `reconciliation=uncertain`,
  `duplicateReceipt=duplicate`, `conflictingReceipt=conflict`, and
  `providerCalls=replay-only`.
- The SDK proof used an explicit complete child environment containing no AWS,
  provider, or CLI credential variables. The overlay disabled all inherited
  shell/filesystem/subprocess/jobs/session-persistence rows and added only one
  replay provider route plus `brain_read`.
- Upstream SDK client, launch, and sdk-minimal bundle tests passed: 57 tests.
  These cover JSON-RPC session ownership, explicit launch configuration,
  bounded initialization/request failures, idempotent close, and SIGTERM /
  SIGKILL teardown behavior against scripted runtimes.
- Brain's admission-side restricted-topology tests pass: 4 tests. They refuse
  non-allowlisted services/tools, same-process execution, inherited parent
  environment, and unknown rows.
- Brain's A0.1 contract fixtures plus the new topology fixtures pass: 12 tests;
  `brain-core` typecheck passes.

### Failed or not yet proven

- The upstream `sdk-minimal` composition contains these forbidden rows:
  `sandbox`, `sandbox-policy`, `subprocess`, `pty`, `terminal-bash`,
  `fs-local`, `persistent-bash`, `jobs`, and `str-replace-editor` (with the
  Windows shell sibling also present conditionally). It also configures
  `danger-full-access`.
- The built-scope subprocess e2e could not run on this host because the
  temporary install lacked the native `fs-ext` artifact
  (`fs_ext.node`). This is an environment/build prerequisite, not evidence of
  runtime safety.
- The proof is still ephemeral and test-only: the profile is an overlay over
  the upstream `sdk-minimal` base, and no permanent Brain-owned Harness
  package/profile has been installed. The base profile remains unsafe if any
  disabling overlay is omitted. This is why the upstream profile is denied,
  while the restricted composition itself passes the A0.2 replay gate.
- The crash-after-effect-before-receipt fixture proves a child runtime can
  terminate after a journaled effect and that restart-side classification is
  `uncertain`; the A0.1 contract remains the authoritative implementation for
  duplicate/conflict semantics. A durable production adapter/effect journal is
  intentionally deferred to K0, where the SQLite StateStore will own it.
- Native `amazon-bedrock` route shape was not invoked, by design. Access and
  billable-use verification remain separate gates.

## Gate decision

Do not adopt `sdk-minimal` for Agent Mode. Keep the reusable Harness loop,
session, tool interception, notification, and bounded process-lifecycle seams
as adapter candidates. The restricted A0.2 composition has passed its offline
replay gate: it has no shell/filesystem/subprocess/jobs/child/schedule surface,
passes a real SDK child-process launch, and binds the effect fixture to the
A0.1 admission, lease, budget, cancellation, and receipt contracts.

The next executable step is A1.1: migrate the generic provider identity to
`amazon-bedrock` while preserving a bounded `claude-bedrock` compatibility
alias. Native Bedrock access and billable inference remain separate gates; no
live provider invocation or Brain package dependency is implied by this proof.
