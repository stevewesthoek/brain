# Agent Mode K3.7 Operational Baseline Evidence

**Date:** 2026-09-09
**Scope:** Current Brain worktree after K3.6
**Decision:** Baseline understood; no unsafe cleanup performed; K4 remains
not started

## Executive result

The current worktree is intentionally not clean, but every status entry is
classified below. The 20 modified files and 64 untracked files are the
combined K0–K3.5 implementation, fixtures, tests, reports, runbooks, and
K3.6 documentation consolidation. No item was reset, discarded, deleted,
committed, pushed, or deployed.

K3.7 is complete as a classification and baseline gate. The repository is
known enough for K4 planning, but K4 implementation should begin only after
the completed implementation is isolated into a reviewed landing boundary.

## Status counts

Current command:

    git status --short

Result:

    modified=20
    untracked=64

## Classification of all modified files

### Required documentation — 6

- ai/models/README.md — current model-selection and Bedrock/Codex policy.
- ai/policy/routing.md — canonical cross-engine and Agent Mode routing policy.
- docs/product/agent-mode-progress.md — chronological Agent Mode progress and
  current K3.6/K3.7 handoff.
- docs/system/brain-agentic-os-strategy.md — historical strategy with current
  Agent Mode foundation addendum.
- operations/specs/agent-mode-runtime-roadmap.md — authoritative phase roadmap,
  K3.6 audit state, local-AI classification, and K4 boundary.
- projects/brain-core/docs/agent-orchestrator-architecture.md — current
  architecture and provider-policy reference.
### Required source changes — 8

- projects/brain-core/src/adapters/amazon-bedrock-model-gateway.ts —
  Bedrock gateway/provider normalization.
- projects/brain-core/src/adapters/managed-provider-executor.mjs — managed
  provider execution privacy/cleanup boundary.
- projects/brain-core/src/agent-mode/agent-mode-observer.ts — durable observer
  projection, including merge evidence.
- projects/brain-core/src/agent-mode/brain-node.ts — bounded node command and
  receipt perimeter.
- projects/brain-core/src/agent-mode/deepseek-harness-restricted-profile.ts —
  restricted runtime profile.
- projects/brain-core/src/agent-mode/model-gateway.ts — typed Agent Mode
  Bedrock model routes and normalized gateway contract.
- projects/brain-core/src/agent-mode/sqlite-state-store.ts — durable state,
  leases, operations, receipts, and recovery.
- projects/brain-core/src/bin/brain-agent.ts — canonical Brain CLI entrypoint.

### Required tests — 4

- projects/brain-core/src/tests/agent-mode-observer.test.ts — observer safety
  and projection tests.
- projects/brain-core/src/tests/amazon-bedrock-model-gateway.test.ts —
  provider/gateway contract tests.
- projects/brain-core/src/tests/managed-provider-executor.test.mjs — managed
  execution privacy and cleanup tests.
- projects/brain-core/src/tests/sqlite-state-store.test.ts — StateStore
  persistence and idempotency tests.

### Required scripts — 2

- tools/scripts/repos.sh — canonical repository launcher and model selector.
- tools/scripts/sessions.sh — canonical durable session selector and controls.

## Classification of all untracked files

### Required fixtures — 5

- operations/fixtures/agent-mode-n0-1-macbook-node.json
- operations/fixtures/agent-mode-n0-1-marker.txt
- operations/fixtures/agent-mode-n0-2-macbook-node.json
- operations/fixtures/agent-mode-n0-2-marker.txt
- projects/brain-core/fixtures/agent-mode-k2-1-marker.txt

These are disposable/local acceptance fixtures, not production state.

### Required evidence/reports — 19

- operations/reports/agent-mode-k1-2-evidence-2026-09-09.md
- operations/reports/agent-mode-k1-3-runtime-surfaces-evidence-2026-09-09.md
- operations/reports/agent-mode-k2-1-live-slice-evidence-2026-09-09.md
- operations/reports/agent-mode-k2-1-r1-auto-and-live-unblock-2026-09-09.md
- operations/reports/agent-mode-k2-2-operator-controls-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-0-workcell-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-1-writer-lease-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-2-workcell-write-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-3-validation-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-4-first-coding-worker-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-5-a-concurrency-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-5-b-review-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-5-c-commit-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-5-concurrency-review-merge-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-5-d-merge-evidence-2026-09-09.md
- operations/reports/agent-mode-k3-6-foundation-audit.md
- operations/reports/agent-mode-k3-7-operational-baseline-evidence.md
- operations/reports/agent-mode-n0-1-remote-node-evidence-2026-09-09.md
- operations/reports/agent-mode-n0-2-multi-node-evidence-2026-09-09.md

Each report is phase evidence for a completed or audited bounded gate.

### Required runbooks — 2

- operations/runbooks/agent-mode-node-transport.md — portable node transport
  operation and recovery procedure.
- operations/runbooks/agent-mode-runtime-surfaces.md — current CLI, model,
  Workcell, approval, and observer runtime boundaries.

### Required Agent Mode source — 14

- projects/brain-core/src/agent-mode/brain-node-runner.ts
- projects/brain-core/src/agent-mode/k3-5-concurrency.ts
- projects/brain-core/src/agent-mode/live-agent-mode-slice.ts
- projects/brain-core/src/agent-mode/live-workcell-coding-worker.ts
- projects/brain-core/src/agent-mode/model-tier-policy.ts
- projects/brain-core/src/agent-mode/node-deduplication-store.ts
- projects/brain-core/src/agent-mode/node-enrollment.ts
- projects/brain-core/src/agent-mode/node-transport.ts
- projects/brain-core/src/agent-mode/runtime-process-identity.ts
- projects/brain-core/src/agent-mode/workcell-file-mutation.ts
- projects/brain-core/src/agent-mode/workcell-promotion.ts
- projects/brain-core/src/agent-mode/workcell-validation.ts
- projects/brain-core/src/agent-mode/workcell-writer.ts
- projects/brain-core/src/agent-mode/workcell.ts

These are the K0–K3 implementation seams; none is a K4 implementation.

### Required tests — 16

- projects/brain-core/src/tests/agent-mode-controls.test.ts
- projects/brain-core/src/tests/agent-mode-model-tier-policy.test.ts
- projects/brain-core/src/tests/agent-mode-node-transport.test.ts
- projects/brain-core/src/tests/agent-mode-process-recovery.test.ts
- projects/brain-core/src/tests/k3-5-a-concurrency.test.ts
- projects/brain-core/src/tests/k3-5-b-review.test.ts
- projects/brain-core/src/tests/k3-5-c-commit.test.ts
- projects/brain-core/src/tests/k3-5-concurrency-review-merge.test.ts
- projects/brain-core/src/tests/k3-5-d-merge.test.ts
- projects/brain-core/src/tests/live-agent-mode-slice.test.ts
- projects/brain-core/src/tests/runtime-process-identity.test.ts
- projects/brain-core/src/tests/workcell-coding-worker.test.ts
- projects/brain-core/src/tests/workcell-file-mutation.test.ts
- projects/brain-core/src/tests/workcell-validation.test.ts
- projects/brain-core/src/tests/workcell-writer.test.ts
- projects/brain-core/src/tests/workcell.test.ts

These cover operator controls, node transport, recovery, model policy,
Workcells, bounded writes, validation, coding worker behavior, review,
commit, and merge gates.

### Required operational scripts — 8

- tools/scripts/agent-mode-k1-3-runtime-surfaces.test.sh — selector/runtime
  surface regression check.
- tools/scripts/agent-mode-k21-harness-bootstrap.mjs — K2.1 fixture bootstrap.
- tools/scripts/agent-mode-k21-harness-bridge-plugin.mjs — K2.1 fixture bridge.
- tools/scripts/agent-mode-k3-4-live-acceptance.mjs — bounded K3.4 acceptance.
- tools/scripts/agent-mode-k3-5-live-acceptance.mjs — bounded K3.5 acceptance.
- tools/scripts/agent-mode-n0-1-live-proof.ts — N0.1 node proof.
- tools/scripts/agent-mode-n0-2-live-parity.ts — N0.2 parity proof.
- tools/scripts/brain-node-runner-wrapper.sh — fixed node-runner wrapper.

### Generated artifacts, temporary files, obsolete local-AI artifacts,
unknown items

No generated artifact, temporary file, obsolete local-AI artifact, or unknown
status item was identified in the current status list. Ignored build output
and local runtime state are not status entries and remain outside this
classification. No deletion is authorized by this report.

## Local AI cleanup decisions

| Candidate | References/consumers | Active? | Decision |
|---|---|---|---|
| Ollama | historical policy/docs and retired local-text migration records; no active selector provider or Agent Mode route | No current managed text consumer proven | Preserve historical references; no deletion without host/dependency inventory |
| Local text LLMs | old strategy/platform docs and archived migration material | Not in current Agent Mode or selector policy | Keep cloud-only; classify old docs as historical and remove only after reference review |
| MLX text inference | MLX Whisper is used by the nightly Bible Studies transcription pipeline | Speech transcription active; general text inference not active | Keep MLX Whisper; do not treat it as a text LLM route |
| oMLX | optional Video Orchestrator text-provider runbook and historical sidecar references | No current Agent Mode consumer | Removal candidate after exact host/dependency check; do not delete now |
| Old Claude-only naming | dedicated Claude docs and historical architecture references | Separate Claude runtime remains valid; stale launcher labels already removed | Preserve valid specialist references; keep Agent Mode provider-neutral |
| claude-bedrock | compatibility aliases, Claude launcher environment, historical docs | Compatibility/dedicated Claude surfaces remain | Do not globally delete; Agent Mode generic identity is amazon-bedrock |

Keep decisions: FluidVoice, local speech/TTS, local voice utilities,
MLX Whisper, faster-whisper, and required media tooling. Cloud-only applies
to general-purpose text LLM inference.

## Script validation

Both menus were executed and printed exactly:

    Auto
    MiniMax M2.5
    GLM-5
    Opus 4.6
    Codex

Shell syntax passed. A stale-label scan for Claude Code, Ollama, LM Studio,
Qwen, and MTPLX passed for both scripts. No stale reference was removed unless
the script path was proven unused.

## Documentation baseline

The roadmap, progress handoff, and architecture docs now state:

- K3.5-D and K3 exit are complete;
- K3.6 foundation audit is complete;
- Bedrock is the Agent Mode default;
- Auto starts MiniMax M2.5;
- Codex is separate/manual;
- local text LLMs are not Agent Mode routes;
- K4 is planned but not implemented;
- K4 prerequisites include a clean reviewed landing boundary and preserved
  security/recovery/observer invariants.

## Validation

Completed checks:

- TypeScript typecheck passed.
- Brain Core build passed.
- Focused Agent Mode/workcell tests passed: 167 passed, 0 failed, including
  model policy, contracts, observer, recovery, and K3.5-D merge coverage.
- Local text policy validation passed.
- AI model registry validation passed.
- repos.sh and sessions.sh menu validation passed.
- shell syntax and stale-label scans passed.
- git diff --check passed.

## K4 readiness checklist

| Prerequisite | Status |
|---|---|
| K0–K3.5 bounded gates complete | PASS |
| Durable state/receipt/recovery authority | PASS |
| Bedrock model routing and bounded escalation | PASS |
| Workcell/review/commit/merge safety boundary | PASS |
| Auto and manual selector semantics | PASS |
| Cloud-only text LLM policy | PASS |
| Local speech/media preservation | PASS |
| Current architecture documentation | PASS |
| Current worktree clean and isolated | CONDITION — 20 modified, 64 untracked |
| MacBook local-media inventory complete | CONDITION — unresolved |
| K4 implementation present | NO — intentionally not started |

## Recommended next action

Do not start K4 from this shared dirty worktree. First isolate the classified
K0–K3.5 implementation and evidence into a reviewed landing boundary. Then
perform the read-only MacBook inventory. Only after both conditions are
resolved should a separately scoped K4 design define event sources, bounded
worker templates, budgets, TTLs, cancellation, recovery, and observer
evidence.
