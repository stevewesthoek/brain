# Agent Mode K3.8 Foundation Landing Evidence

**Date:** 2026-09-10
**Branch:** codex/cloudflare-tooling-normalization
**Scope:** Reviewed Git landing boundary for the completed K0–K3.5
foundation before K4
**Decision:** FOUNDATION LANDING COMPLETE; K4 READY TO START

## Pre-landing status

Fresh status reconciliation matched the K3.7 inventory exactly:

    modified=20
    untracked=64

The 20 modified files and 64 untracked files were all classified as required
Agent Mode source, tests, fixtures, scripts, runbooks, evidence, or
documentation. No unknown unrelated file, credential file, unexpected binary,
private StateStore database, or personal runtime state was present.

The only count change from the K3.7 starting description was the required K3.7
report itself becoming part of the 64-file evidence set. No user work was
discarded or reset.

## Security and secret review

The explicit candidate set was scanned before staging for:

- AWS access-key patterns and provider API key assignments;
- private-key/PEM material;
- password, auth-token, and HMAC-secret assignments;
- environment/credential/private-key filenames;
- StateStore database or SQLite files;
- unexpected binary files.

Result: clean. Candidates were text/configuration files and disposable
fixtures only. No secrets or private runtime state were staged.

The bounded Agent Mode safety scan also found no unrestricted shell,
repo.write(main), force/reset/push path, or unsafe model fallback in the
candidate Agent Mode source.

## Validation before landing

Results before commits:

- Brain Core typecheck: passed.
- Brain Core build: passed.
- K3.5-B focused suite: 4 passed, 0 failed.
- Remaining foundation/workcell suite: 163 passed, 0 failed.
- Combined focused foundation total: 167 passed, 0 failed.
- Local text policy validator: valid; Bedrock primary; Codex secondary;
  obsolete local text surfaces absent.
- AI model registry validator: valid; 4 providers and 16 models.
- Script syntax and exact menu checks: passed.
- JSON fixture validation: passed.
- Git diff check: passed after Markdown hard-break normalization.

The broad suite initially hung at the K3.5-B child process. That validation
process was terminated without touching repository state; the same suite was
then run separately and passed 4/4. The remaining 163 tests passed separately.

## Logical commits

### 57a430d1 — feat(agent-mode): land kernel model and node foundation

Committed 23 explicit paths:

- projects/brain-core/src/adapters/amazon-bedrock-model-gateway.ts
- projects/brain-core/src/adapters/managed-provider-executor.mjs
- projects/brain-core/src/agent-mode/agent-mode-observer.ts
- projects/brain-core/src/agent-mode/brain-node-runner.ts
- projects/brain-core/src/agent-mode/brain-node.ts
- projects/brain-core/src/agent-mode/deepseek-harness-restricted-profile.ts
- projects/brain-core/src/agent-mode/model-gateway.ts
- projects/brain-core/src/agent-mode/model-tier-policy.ts
- projects/brain-core/src/agent-mode/node-deduplication-store.ts
- projects/brain-core/src/agent-mode/node-enrollment.ts
- projects/brain-core/src/agent-mode/node-transport.ts
- projects/brain-core/src/agent-mode/runtime-process-identity.ts
- projects/brain-core/src/agent-mode/sqlite-state-store.ts
- projects/brain-core/src/bin/brain-agent.ts
- projects/brain-core/src/tests/agent-mode-controls.test.ts
- projects/brain-core/src/tests/agent-mode-model-tier-policy.test.ts
- projects/brain-core/src/tests/agent-mode-node-transport.test.ts
- projects/brain-core/src/tests/agent-mode-observer.test.ts
- projects/brain-core/src/tests/agent-mode-process-recovery.test.ts
- projects/brain-core/src/tests/amazon-bedrock-model-gateway.test.ts
- projects/brain-core/src/tests/managed-provider-executor.test.mjs
- projects/brain-core/src/tests/sqlite-state-store.test.ts
- tools/scripts/brain-node-runner-wrapper.sh

### f8a0cd75 — feat(agent-mode): land safe workcell coding lifecycle

Committed 23 explicit paths covering Workcells, leases, writes, validation,
coding worker, review, commit, merge, and their tests:

- projects/brain-core/fixtures/agent-mode-k2-1-marker.txt
- projects/brain-core/src/agent-mode/k3-5-concurrency.ts
- projects/brain-core/src/agent-mode/live-agent-mode-slice.ts
- projects/brain-core/src/agent-mode/live-workcell-coding-worker.ts
- projects/brain-core/src/agent-mode/workcell-file-mutation.ts
- projects/brain-core/src/agent-mode/workcell-promotion.ts
- projects/brain-core/src/agent-mode/workcell-validation.ts
- projects/brain-core/src/agent-mode/workcell-writer.ts
- projects/brain-core/src/agent-mode/workcell.ts
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
- tools/scripts/agent-mode-k3-4-live-acceptance.mjs
- tools/scripts/agent-mode-k3-5-live-acceptance.mjs

### ecf6a4cf — test(agent-mode): land fixtures and acceptance harnesses

Committed 9 explicit paths:

- operations/fixtures/agent-mode-n0-1-macbook-node.json
- operations/fixtures/agent-mode-n0-1-marker.txt
- operations/fixtures/agent-mode-n0-2-macbook-node.json
- operations/fixtures/agent-mode-n0-2-marker.txt
- tools/scripts/agent-mode-k1-3-runtime-surfaces.test.sh
- tools/scripts/agent-mode-k21-harness-bootstrap.mjs
- tools/scripts/agent-mode-k21-harness-bridge-plugin.mjs
- tools/scripts/agent-mode-n0-1-live-proof.ts
- tools/scripts/agent-mode-n0-2-live-parity.ts

### 350aaea9 — docs(agent-mode): land evidence and readiness baseline

Committed 29 explicit paths covering routing docs, architecture, selectors,
runbooks, roadmap/progress, and all prior K1–K3.7 evidence:

- ai/models/README.md
- ai/policy/routing.md
- docs/product/agent-mode-progress.md
- docs/system/brain-agentic-os-strategy.md
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
- operations/runbooks/agent-mode-node-transport.md
- operations/runbooks/agent-mode-runtime-surfaces.md
- operations/specs/agent-mode-runtime-roadmap.md
- projects/brain-core/docs/agent-orchestrator-architecture.md
- tools/scripts/repos.sh
- tools/scripts/sessions.sh

### 22520454 — docs(agent-mode): close K3.8 landing gate

Committed 2 explicit paths:

- operations/specs/agent-mode-runtime-roadmap.md
- docs/product/agent-mode-progress.md

## Post-landing state

Immediately after the five foundation/doc landing commits:

    git status --short
    modified=0
    untracked=0

No expected implementation file disappeared. The completed foundation is
reproducible from Git history and no required Agent Mode implementation
remains accidentally untracked.

The evidence receipt itself was committed as 807511a3 and did not change the
foundation or reintroduce dirty state.

## Rollback and recovery

Rollback is recoverable with reviewed inverse commits in reverse order:

    22520454
    350aaea9
    ecf6a4cf
    f8a0cd75
    57a430d1

Do not use reset, force operations, or broad cleanup. Before any rollback,
inspect the target commit and confirm the requested scope. The four commits
were created locally only; no push or deployment occurred.

## K4 readiness decision

**FOUNDATION LANDING COMPLETE. K4 READY TO START.**

The completed K0–K3.5 foundation is fully represented in reviewed logical
commits, validation passes, security review passes, and the worktree is clean.
K4 remains a separate authorized phase and was not implemented by this goal.

Exact next task:

    K4.0 — deterministic event/scheduler foundation and no-op heartbeat

Do not start K4.0 automatically. K4.0 requires its own scoped design,
approval, fixture gate, and review.

## Blockers

None for the K3.8 landing boundary. K4 is intentionally deferred until
separate authorization.
