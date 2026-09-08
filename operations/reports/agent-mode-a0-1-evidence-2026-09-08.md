# Agent Mode A0.1 evidence — 2026-09-08

## Result

Implemented the offline attempt-admission contract and adversarial fixtures
specified by the principal review. No live model, AWS, runtime, host, credential,
database or network operation is performed by this slice.

## Evidence

- Contract: `projects/brain-core/src/agent-mode/agent-mode-contracts.ts`
- Tests: `projects/brain-core/src/tests/agent-mode-contracts.test.ts`
- Specification: `operations/specs/agent-mode-contracts-v1.md`
- Fixed model portfolio remains MiniMax M2.5 → GLM-5 → Claude Opus 4.6.
- Fixtures cover one Jarvis/worker attempt, model override denial, unknown Codex
  quota, ungranted tools and indirect shell/child/schedule effects, expired
  grants, stale/expired fences, budget exhaustion, duplicate/conflicting receipts,
  uncertain outcomes, cancellation acknowledgement and two installation-shaped
  references without personal paths.

## Gate status

**A0.1 offline gate: PASS.** The focused test and typecheck commands passed on
2026-09-08. This does not prove real runtime sandbox confinement; that is A0.2
and remains a hard prerequisite for adopting a runtime.

## Next task

A0.2 — prove the pinned DeepSeek Harness restricted runtime composition against
this contract, including built-in/indirect tool denial, auxiliary-call denial,
exclusive attempt correlation, process-tree cancellation and crash-after-effect
reconciliation. Do not install or run a live provider as part of that proof.
