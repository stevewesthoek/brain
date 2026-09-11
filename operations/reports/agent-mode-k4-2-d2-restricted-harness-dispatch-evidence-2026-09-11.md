# Agent Mode K4.2-D2 — Restricted Harness Process Dispatch Evidence

**Date:** 2026-09-11
**Status:** COMPLETE for the bounded K4.2-D2 process-boundary gate

## Scope

This tranche adds `RestrictedHarnessAgentRuntime` behind the existing D1
`AgentRuntime` interface. D1 remains the control plane: fresh authority
recheck, fenced lease, durable `effects`/`dispatch_outbox`, bounded receipt,
verification, settlement, cancellation and uncertainty remain in the SQLite
StateStore.

The runtime uses the configured DeepSeek Harness SDK root only when it is
named by the pinned commit and both the root and SDK client manifests report
version `0.1.3-alpha.2`. The fixed runtime identity is:

- commit: `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`
- runtime: `runtime:deepseek-harness:c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`
- profile: `brain-agent-mode-restricted`
- process: one SDK-owned stdio child per attempt

No live provider inference is used. The child receives a deterministic local
fixture adapter through a pinned Harness patch and communicates with its
Brain parent over one local Unix-domain socket. The fixture returns
`BRAIN_K4_2_D2_HARNESS_PROCESS_PASS`, zero model usage, and zero executable
tools.

## Boundary evidence

- The root path is injected configuration; `/Users/Office` is not present in
  generic runtime code.
- Executable and argv are fixed by the existing Harness SDK. No shell,
  `bash -c`, `sh -c`, `eval`, arbitrary executable, or arbitrary argv input is
  accepted.
- The child environment is an explicit allowlist containing fixed PATH,
  isolated HOME/TMPDIR/cwd, locale, and the local fixture bridge identity.
  Parent environment spreading, credentials, StateStore paths, SSH/Tailscale
  variables, and unrelated provider settings are excluded.
- The restricted topology is checked before `Harness.run`: pinned profile,
  explicit service rows, zero executable tools, one fixture provider route,
  separate-child isolation, and explicit-complete-env.
- SDK initialization has a finite startup deadline. Execution and shutdown
  also have finite deadlines. The SDK's EOF → graceful termination → forced
  termination ladder is used only through its owned child handle.
- PID, normalized command identity, start identity, run binding and runtime
  profile are recorded while live. A mismatched/reused PID fails closed.
- The child never opens or writes Agent Mode SQLite state. Brain records,
  verifies and settles all durable state.

## Lifecycle and recovery evidence

The focused matrix covers:

- one successful real pinned Harness child and one D1 AgentRuntime invocation;
- truthful canonical fixture failure with no retry or replacement child;
- explicit parent sentinel absence probe without persisting its value;
- in-flight cancellation through `AbortSignal`, bounded shutdown and reap;
- missing pin/startup failure as safe pre-effect failure;
- crash after admitted input as `uncertain`, with no blind relaunch;
- bounded result/bridge handling and inert child metadata;
- durable parent-owned result evidence resolving reconciliation without launch;
- missing evidence remaining uncertain;
- observer process state, identity verification, phase, cancellation,
  reconciliation and exit classification without raw environment, argv,
  prompts or secret payloads.

The process evidence is parent-owned and identity-bound to operation, dispatch,
attempt, run, child, runtime and profile. Process disappearance alone does not
resolve an admitted effect.

## Validation

Focused D2:

```text
npx tsx --test src/tests/agent-mode-restricted-harness-runtime.test.ts
12 tests, 12 passed, 0 failed
```

Typecheck:

```text
npm run typecheck
PASS
```

The affected Agent Mode regression matrix passes 316/316. The package-wide
Brain Core command passes 2444/2444. Typecheck, build, and safety scans also
pass.

## Explicit non-goals

D2 does not invoke ModelGateway, Bedrock, MiniMax, GLM, Opus or Codex; execute
BrainNode tools; open Workcells; mutate repositories; use external network;
wire scheduler-to-spawn autonomy; create replacement workers; add a daemon;
modify Mind, AWS, SSH, Tailscale, FluidVoice, MLX Whisper or Video
Orchestrator; or stage the unrelated `tools/firecrawl/logs/firecrawl.log`.

K4.2-D1 and D2 are complete for their bounded gates. K4.2 and K4 remain in
progress. The exact next bounded slice is **K4.2-E1 — Deterministic
Scheduler-to-Spawn Orchestration and End-to-End Dynamic Worker Lifecycle**.
