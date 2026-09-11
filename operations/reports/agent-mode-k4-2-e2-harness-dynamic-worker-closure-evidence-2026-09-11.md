# Agent Mode K4.2-E2 Restricted-Harness Scheduler-to-Worker Closure Evidence

Date: 2026-09-11

## Decision

**K4.2-E2: COMPLETE.** The deterministic acceptance path composes the existing
E1 scheduler orchestrator with the existing D1 dispatcher and the actual D2
`RestrictedHarnessAgentRuntime`. K4.2 closure conditions 1–23 all pass, so
**K4.2: COMPLETE**. **K4: IN PROGRESS**; the exact next task is
**K4.3-A — One Bounded Live MiniMax Dynamic-Worker Acceptance**. That task is
not started automatically by this slice.

## Accepted chain and counts

The positive fixture is one durable `repository.commit.observed` scheduler
event with the static E2 action rule enabled only inside the test. The chain is:

```text
scheduler claim/fence
→ static action intent
→ spawn-policy admission
→ atomic child reservation
→ durable Task/Run/Attempt assignment
→ D1 fenced runtime dispatch/outbox
→ D2 Restricted Harness child
→ receipt verification and settlement
→ scheduler completion and observer reconstruction
```

The positive run proves:

- children: **1**;
- Task/Run/Attempt: **1 / 1 / 1**;
- D1 `runtime.dispatch` outbox entries: **1**;
- Restricted Harness launches: **1**;
- Restricted Harness reaps: **1**;
- replacement workers: **0**;
- ModelGateway/Bedrock/live model calls: **0**;
- BrainNode effects: **0**;
- Workcells: **0**;
- repository writes: **0**;
- external network: **0**.

The E2 rule is closed, finite, read-only, root-bound, disabled by default,
restricted-Harness-only, and has zero requested executable capabilities. It is
separate from `AgentSpawnPolicy`; permission to create a child is not an
instruction to spawn. The E1 Mock rule remains unchanged.

## Runtime, pin, environment, and topology

The actual process-backed runtime is pinned to DeepSeek Harness version
`0.1.3-alpha.2`, commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, with runtime/profile binding
`runtime:deepseek-harness:<commit>` and `brain-agent-mode-restricted`.
The D2 fixed launch, injected manifests, explicit sanitized environment,
isolated child directories, Unix-socket fixture bridge, process identity
verification, and graceful-then-terminate-and-reap ladder remain authoritative.
Scheduler payload metadata cannot select the executable, argv, runtime, policy,
role, repository, task, or environment. Parent sentinel data is absent from
the child, and the fixture response is not leaked into observer output.

## Reliability and authority matrix

- Ten event redeliveries and concurrent scheduler claimers converge on one
  child, one assignment, one D1 dispatch, and one Harness process.
- Crashes after child creation, after assignment, before process effect, and
  after worker settlement resume the same durable lifecycle after reopen.
- A possible Harness execution returns `UNCERTAIN`; durable identity-bound
  evidence reconciles it to success without relaunch. When evidence is absent,
  the result remains uncertain and no relaunch occurs.
- Cancellation before dispatch, cancellation while the Harness is running,
  kill-switch changes between phases, child TTL/deadline expiry, and root
  deadline all prevent unsafe launch or stop and reap the exact running child.
  Cancellation is acknowledged only after reaping.
- Root active-concurrency, monotonic total-creation, aggregate budget, and
  bounded step limits remain enforced. Recursive spawning cannot create a
  grandchild. Malicious scheduler metadata remains inert.
- Bounded batches process at most the requested finite count; a quiet pass is
  `NO_ACTION` with zero work.
- The observer reconstructs action rule, causation, child, assignment,
  runtime/profile, process identity, reaped state, and settlement after close
  and reopen, without prompts, hidden reasoning, raw payloads, credentials, or
  unbounded diagnostics.

## K4.2 closure audit

All closure conditions pass:

1. action intent is separate from spawn permission;
2. unconfigured events do not spawn;
3. root binding is authoritative;
4. child identity creation is atomic;
5. active concurrency cannot race past limits;
6. total creation count is monotonic;
7. aggregate root budget is not oversubscribed;
8. child assignment is idempotent;
9. runtime dispatch is fenced;
10. restricted Harness topology is enforced;
11. the child environment is sanitized;
12. cancellation reaches a running Harness;
13. the exact runtime process is reaped;
14. uncertain effects are never blindly replayed;
15. scheduler redelivery cannot duplicate worker/process execution;
16. recursive spawn remains bounded/prevented;
17. deadline, TTL, and kill switches remain effective between phases;
18. restart reconstructs every tested phase;
19. observer reconstructs causation/resource state;
20. quiet heartbeat remains zero-work;
21. deterministic acceptance requires no model/provider call;
22. no BrainNode or Workcell effect occurs;
23. the full K4.2 regression is green.

The audit combines the existing A/B/C/D1/D2 evidence with E1 and this E2
acceptance. Validation is **16/16** focused E2 tests, **355/355** Agent Mode
tests, and **2483/2483** package-wide `brain-core` tests. The package run also
completed typecheck and build successfully.

## Scope and landing

This slice adds no model-authored rules, live model route, replacement worker,
grandchild, daemon, LaunchAgent, AWS/SSH/Tailscale change, Brain Console or
Mind change, media change, deploy, or push. The unrelated
`tools/firecrawl/logs/firecrawl.log` change was not touched or staged.
