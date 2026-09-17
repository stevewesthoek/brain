# Agent Mode RC.5 final release-acceptance triage — 2026-09-17

## Acceptance status

**READY_WITH_EXPLICIT_LOW_RISK_WAIVER** for the immutable, isolated RC.5
candidate. The six reported full-suite failures were individually reproduced,
classified, and corrected at the test/fixture boundary. The complete Brain
Core suite is now green under a temporary local-only AWS CLI emulation. No
production source, signed package, release identity, Office StateStore,
provider, network, or service was touched.

The waiver is limited to the historical provider-dependent test surfaces
described below: they are not part of the RC.5 release-critical path, their
fixtures now run deterministically without a provider, and the resulting
changes are test-only. Production activation remains a separate explicit
decision and was not performed.

## Starting state and immutable candidate

- Starting HEAD: `7f63f85c ops(agent-mode): cut clean signed release candidate`
- Prior comparison revision: `c81c6785bc976fc88b8492bd0eb1e20b2f8cd961`
- RC.5 version: `1.0.0-rc.5`
- Source revision bound into RC.5: `c81c6785bc976fc88b8492bd0eb1e20b2f8cd961`
- Runtime package:
  `brain-runtime-package:sha256:39df90b4497f2107f78ab4beb4f6457ff9d1f5dcdfb3d4c6397af065a94898c5`
- Release ID:
  `brain-agent-release:sha256:5028c78a4369950f6481093c772a855e1c90819469c301b025c876f530cec8ce`
- Signing identity: `brain-agent-release-production-v1` (macOS Keychain
  Ed25519; private export disabled)

The candidate package and signed release identity remain immutable. The only
repository changes in this triage are deterministic test fixtures and this
evidence report; no production source change requires an RC.5 supersession.

Protected unrelated paths remained untouched and unstaged:

- `tools/firecrawl/logs/firecrawl.log`
- `operations/specs/mindcontrol-product-roadmap.md`
- `operations/specs/nevermind-release-pipeline-roadmap.md`

The pre-existing user change in `operations/accounts/credentials-index.md` was
also preserved and was not staged.

## Six-failure reproduction and classification

The six failures from the earlier full-suite run were reproduced before the
patches. The five Agent Orchestrator cases also failed independently in an
isolated file run (`39 tests: 34 passed, 5 failed`), proving they were not just
full-suite ordering noise.

### 1–5. `agent-orchestrator.test.js`

Failed cases:

1. `OrchestrationExecutor executes all tasks in order (no gates)`
2. `OrchestrationExecutor records completed task results in ledger`
3. `OrchestrationExecutor blocks task at unapproved gate`
4. `OrchestrationExecutor proceeds past gate when approved`
5. `OrchestrationExecutor blocks downstream task when upstream is at approval gate`

Root cause: these tests exercised graph ordering, approval-gate transitions,
and durable ledger behavior with `gemini`/`claude` executor labels. The current
production executor correctly routes those labels through the admitted managed
provider path. The tests therefore required selector/provider availability for
assertions that do not test provider execution. This dependency was introduced
by the earlier maintenance hardening that replaced local test fallbacks with
`executeManagedText`; it is outside the RC.5 package and predates the candidate.

Comparison: the same five cases passed at prior revision `c81c6785` when the
selector was available, confirming the behavior difference was fixture/provider
coupling rather than an RC.5 runtime regression.

Correction: the affected graph/gate fixtures now use the deterministic local
`bash` executor. The tests retain their original orchestration assertions while
removing an unrelated external provider prerequisite. Five complete isolated
file repetitions passed (`39/39` each time) with the selector explicitly
unavailable.

### 6. `vo-studio-write.test.js`

Failed case:

- `generateMetadataRequest generates YouTube metadata from the canonical moving-video content item`

Root cause: the test hard-coded an AI/provider-shaped title suffix while the
canonical metadata generator's documented fallback is the deterministic base
title `Genesis: Creation Story`. With provider availability the test could
take a different managed-text result; with the provider unavailable it exposed
the stale expectation. The isolated test also passed when the selector was
available, proving the assertion was environment-dependent.

Correction: the test pins the selector call to an offline failure, asserts the
canonical fallback title, and asserts `source: fallback`. The fallback is the
existing product contract; no metadata generator production code changed.

## Full-suite and release-critical validation

All runs avoided live providers and network. The full-suite AWS CLI calls were
handled by a temporary local-only S3/Step Functions emulation seeded only with
the repository's existing fixture media. The emulator and its temporary state
were removed after validation and are not release artifacts.

- Brain Core full suite after fixes: **2,634 passed, 0 failed, 0 skipped**
- Formerly flaky Agent Orchestrator file: **39 passed, 0 failed** per run,
  repeated **5** times
- VO I-7.9 approval-generation fixture: **7 passed, 0 failed** in the local
  emulation
- Release-critical K4/K5/H0 regression set: **332 passed, 0 failed**
- `npm run typecheck`: **passed**
- `npm run build`: **passed**
- `git diff --check`: **passed**

The prior baseline's three timing failures and the six originally reported
failures were not silently labeled pre-existing: each was reproduced, traced,
compared with `c81c6785`, and either corrected as a deterministic fixture
problem or eliminated by a faithful local-only test harness.

## Release boundary and effect counts

No production implementation changed. RC.5 package contents, package ID,
source revision, release ID, signature, and Keychain identity remain valid.

| Effect | Count |
| --- | ---: |
| Live AWS/provider/network calls | 0 |
| ModelGateway calls | 0 |
| Bedrock/MiniMax/GLM/Opus/Codex model calls | 0 |
| AgentRuntime calls outside deterministic test fixtures | 0 |
| Harness processes | 0 |
| BrainNode operations | 0 |
| Workcells | 0 |
| Production Office StateStore access | 0 |
| Repository mutations through Agent Mode | 0 |
| Production activation/restart/service registration | 0 |
| Public publish or Git push | 0 |

The temporary offline emulator was a test harness only and made no external
requests. No credentials, prompts, provider payloads, hidden reasoning, or
private signing material entered the patch or this report.

## Acceptance decision

The exact release-maintenance triage objective is complete. RC.5 remains the
same immutable non-production candidate and is suitable for a separately
authorized production activation decision under the explicit low-risk waiver
above. This report does not authorize activation.

No additional Agent Mode foundation work is opened. The next action is the
existing release-maintenance operator decision: explicitly authorize or decline
production activation of the verified RC.5 candidate using
`operations/runbooks/agent-mode-release-maintenance.md`.
