# Agent Mode H0-D Live-Boundary Readiness Evidence — 2026-09-17

## Decision

**H0-D: COMPLETE AS A BOUNDARY AUDIT. H0: IN PROGRESS; release gate
INCOMPLETE.**

Starting HEAD was `7030268e test(agent-mode): complete security release
review`. H0-A, H0-B, and H0-C were already landed. No history was rewritten,
no external service was contacted, and the protected credential index,
Firecrawl log, and unrelated roadmap paths were not read, changed, staged, or
cleaned.

H0-D does not claim provider or remote-host acceptance. It determines the
current local restricted-runtime boundary and prepares exact disposable
authorization packets for the remaining external-sensitive gates.

## Starting-state reconciliation

- H0-A: complete deterministic hardening harness foundation.
- H0-B: complete isolated six-hour wall-clock soak.
- H0-C: audit complete; no BLOCKER or HIGH finding; H0 release gate remains
  incomplete.
- Current H0 live-required remainder: provider outage, host loss/reconnect,
  sandbox denial, and tool denial.
- No H0-D implementation or live-denial evidence was present before this
  audit.
- K0/K1/K2/K3/K4 were not reopened and `brain-node.ts` was not modified.

The H0-C historical report has a deliberate suite-count discrepancy: its
terminal summary reported a later local Core run of 2617/2617, while the
committed H0-C report records the earlier H0-B baseline of 2613/2613 plus the
H0-C focused counts. This report does not rewrite H0-C history. The H0-D
validation counts below are reported from the current run.

## Pinned Harness availability and local boundary

The exact configured local root is present:

```text
/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8
```

The root manifest and SDK client manifest both report `0.1.3-alpha.2`; the
SDK client and LLM runtime entrypoints are present. Classification:
**SUPPORTED_LOCAL** for the existing deterministic restricted Harness runtime
path. This classification does not mean that a sandbox/tool denial topology is
available.

The production `RestrictedHarnessAgentRuntime` uses the pinned SDK in a real
separate child process. Its current safe path supplies a complete explicit
child environment (`PATH`, child `HOME`, child `TMPDIR`, locale, and bounded
bridge identity), a fixture-only provider route, no tools, a bounded protocol,
and deterministic cleanup/reaping. Existing current-build tests verify the
child command identity, process identity, no inherited parent sentinel, no
auxiliary provider route, and reaping.

The distinction is material:

| Boundary | Classification | Status | Reason |
|---|---|---|---|
| pinned Harness fixture path | SUPPORTED_LOCAL | evidenced by existing live isolated-process tests | Current production adapter and exact pinned child are available. |
| sandbox denial | UNSUPPORTED | not_run | The safe adapter exposes a fixture provider, not a live sandbox-denial injection point. Adding one would change the runtime/topology or require an unapproved effect. |
| tool denial | UNSUPPORTED | not_run | The safe adapter exposes no tools. The existing capability/profile tests are deterministic fixtures, not a live denied-tool child request. |

`verifyRestrictedTopology` remains an admission verifier, not live evidence by
itself. No profile, tool allowlist, or `liveAcceptanceRequired` flag was
weakened to manufacture coverage.

## H0 live-acceptance matrix

| Fault class | Classification | H0-D status | Evidence/decision |
|---|---|---|---|
| provider_outage | EXTERNAL_SENSITIVE | blocked | Requires a separately authorized disposable provider account/profile/resource. Not called. |
| host_loss_reconnect | EXTERNAL_SENSITIVE | blocked | Requires a separately authorized disposable remote BrainNode and real reconnect boundary. Not contacted. |
| sandbox_denial | UNSUPPORTED | not_run | No safe live topology is currently authorized or exposed by the production fixture adapter. |
| tool_denial | UNSUPPORTED | not_run | No live tool endpoint is currently authorized or exposed by the production fixture adapter. |

The H0 gate still requires `live_pass` for every live-required class. H0-D is
therefore complete as the requested boundary-readiness slice, while H0 itself
is not complete.

## Future external authorization packets

### Provider outage

Preferred mechanism: a dedicated disposable provider account/profile/resource
with an explicit failure boundary around the existing Bedrock ModelGateway
transport. The future run must be separately authorized immediately before
execution and must use:

- maximum one harmless request;
- maximum 64 tokens;
- maximum USD 0 cost;
- maximum 120 seconds elapsed;
- zero retries and no fallback route;
- durable failure classification, recovery classification, and rollback /
  teardown evidence;
- no production account, credential, provider route, repository, or Office
  state.

If that mechanism cannot be provisioned without exposing production
credentials or billing risk, the exact safe decision is to keep the class
blocked rather than substitute a local mock and call it live.

### Host loss/reconnect

Preferred mechanism: a dedicated disposable remote BrainNode with real
enrollment, identity verification, NodeTransport, and a disposable test
checkout. The future run must use:

- one harmless `repo.read` operation;
- one controlled disconnect and at most one reconnect;
- maximum two commands and 180 seconds elapsed;
- zero repository writes, zero deploys, zero credentials displayed;
- durable disconnect, reconnect, deduplication, and cleanup evidence;
- no personal MacBook, Office host, production node, SSH/Tailscale identity,
  or production repository.

A same-host child/process loss is **PARTIAL_ONLY**: it can support process
crash/restart evidence, but it cannot prove host or network loss/reconnect.

## Effects and safety counts

H0-D performed no provider or network request and no external resource setup.
The local focused tests used the existing deterministic isolated Harness
fixture only.

| Effect | Count |
|---|---:|
| live provider/model calls | 0 |
| Harness child processes in H0-D readiness test | 0 new live-denial attempts |
| SSH/Tailscale/remote host contacts | 0 |
| BrainNode operations | 0 |
| Workcells/repository mutations | 0 |
| scheduler/budget/task/agent mutations from the audit | 0 |
| network outside previously existing local test execution | 0 |

The existing restricted-runtime regression tests did launch their normal
session-owned local fixture children; they are regression evidence, not H0-D
denial-gate execution. Their children were reaped and no provider call was
made.

## Validation

Brain Core was rebuilt before the focused run. The H0-D contract and relevant
current restricted-runtime/security hardening tests passed:

- H0-D boundary-readiness contract: **3/3**;
- restricted profile, restricted runtime, E2 restricted Harness, H0-C review,
  H0 hardening, and H0-B wall-clock contract tests: **51/51**;
- typecheck: **PASS**;
- build: **PASS**;
- `git diff --check`: run before commit and **PASS**.

The known historical full-suite conditions remain out of scope: H0-C recorded
its earlier 2613/2613 baseline while its terminal summary mentioned 2617/2617;
no H0-D evidence rewrites that report. No H0-D test failed.

## K5 and Console boundary disposition

K5 remains complete and untouched. The Agent Mode Console remains a read-only
observer; this audit adds no Console mutation, provider probe, or browser
authority. Existing Console validation from H0-C remains the applicable local
read-boundary evidence.

## Conclusion and exact next prerequisite

H0-D is **COMPLETE AS A BOUNDARY AUDIT**. The exact next prerequisite is:

> Separately authorize and provision the disposable provider-outage and
> remote-BrainNode packets, and establish a safe supported restricted-runtime
> sandbox/tool denial topology; then run only those bounded H0 live gates.

Do not start that prerequisite automatically. H0 remains **IN PROGRESS** and
the release gate remains **INCOMPLETE** until every live-required class has
truthful `live_pass` evidence.
