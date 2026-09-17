# Agent Mode H0-E Restricted Harness Live-Denial Evidence — 2026-09-17

## Decision

**H0-E: COMPLETE AS TOPOLOGY AUDIT. H0: IN PROGRESS; release gate
INCOMPLETE.**

Starting HEAD was `0becd4dc test(agent-mode): define remaining H0 live
boundaries`. H0-A and H0-B are complete, H0-C is complete as a security
audit, and H0-D is complete as a boundary audit. H0-E addresses only
`sandbox_denial` and `tool_denial`; provider outage and remote-host loss were
not executed.

The protected credential index, Firecrawl log, and unrelated roadmap paths were
not read, changed, staged, or cleaned. No provider, remote host, SSH/Tailscale,
credential, Office state, or network resource was contacted. `liveAcceptanceRequired`
flags were not changed.

## H0-A/B/C/D verification and historical count discipline

- H0-A: deterministic hardening harness foundation complete.
- H0-B: isolated six-hour wall-clock soak complete.
- H0-C: security review complete; no BLOCKER or HIGH finding; H0 incomplete.
- H0-D: pinned-Harness/external-boundary audit complete; H0 incomplete.
- H0-D recorded H0-D contract `3/3`, combined relevant tests `51/51`,
  typecheck/build/diff-check PASS. Its terminal output also reported a full
  Core run of 2620/2620, but that aggregate was not written into the committed
  H0-D report. This H0-E report preserves that historical discrepancy and does
  not rewrite H0-D evidence.

## Pinned SDK capability audit

The configured Harness is:

```text
repository: https://github.com/deepseek-ai/deepseek-harness
commit: c389f96bf3a9b6807cb71ed6bdad5849be0df6d8
version: 0.1.3-alpha.2
```

The exact pinned SDK source was inspected, not inferred from generic
documentation:

- `ToolRuntime.register(definition)` is the registration boundary.
- `resolveExecution()` returns no executable definition when a name is not
  registered or is collapsed by presentation policy.
- `ToolNotFoundError` normalizes the stable code `UNKNOWN_TOOL`.
- The tool body is invoked only after successful resolution; an unknown name
  therefore has zero tool-body executions.
- Native tool-call results are scheduled through the SDK's tool runtime, while
  PTC mode allows only its reserved `run_code` transport directly.
- The SDK contains experimental code-runtime packages, but those are not
  imported by Brain's restricted production composition.

Brain's current production restricted adapter writes a test fixture patch with
`inject: ["llm"]`, uses provider `brain-k42-d2-fixture`, disables the upstream
sandbox/subprocess/terminal/filesystem rows, and registers no tool. Its
topology verifier sees an empty tool list with an empty allowed-tool set. The
production source contains no H0-E helper, denial injection flag, tool-call
override, or sandbox registration.

## Selected topology and outcome

No live-denial topology was selected. The preferred synthetic fixture-model
route is not reachable because the production child has no tool or sandbox
surface. Registering `brain.h0.denied.noop`, exposing a filesystem/shell
operation, or adding a runtime option to emit tool calls would widen or alter
the production authority boundary and would violate H0-E.

| Gate | Classification | Status | Deterministic reason |
|---|---|---|---|
| `tool_denial` | `UNSUPPORTED` | `not_run` | `RESTRICTED_COMPOSITION_HAS_NO_TOOL_SURFACE` |
| `sandbox_denial` | `UNSUPPORTED` | `not_run` | `RESTRICTED_COMPOSITION_HAS_NO_SANDBOX_SURFACE` |

This is stronger than an untested assumption: the H0-E test reads the exact
pinned SDK and current Brain production sources, asserts the SDK's stable
unknown-tool semantics, asserts Brain's LLM-only fixture composition, and
asserts no production authority widening. It does not call a mock exception
and label that result live.

## Production import and authority boundary

The H0-E helper and tests live under `src/tests/fixtures` and `src/tests`.
The production `src/agent-mode` import surface contains no H0-E helper import.
No production source file changed in this slice. Core build output contains
only the normal compiled test artifacts; no production entry point imports the
H0-E fixture.

Existing restricted-runtime source remains responsible for the live local
fixture boundary: pinned SDK import, separate child launch, explicit `PATH`,
temporary child `HOME`/`TMPDIR`, bounded bridge protocol, process identity
verification, and deterministic reaping. H0-E itself launches **0** denial
children because no valid denial target exists.

## Environment and provider isolation

No H0-E denial child was launched, so H0-E records no child environment
values. Existing D2 current-build evidence remains the authoritative proof of:

- parent sentinel absent;
- AWS/provider credential environment absent;
- temporary child `HOME` and `TMPDIR`;
- explicit minimal `PATH` and locale;
- no arbitrary parent environment inheritance;
- pinned process command and run/attempt identity;
- clean child reaping.

The fixture bridge is Brain-owned, credential-free, deterministic, bounded, and
network-free. H0-E made zero provider calls, zero AWS/Bedrock calls, zero
network calls, zero BrainNode calls, zero Workcell operations, and zero
repository mutations.

## Denial/repeat/restart semantics

Because the production composition has no reachable denial operation, live
denial, repeat-denial, and denial-after-reopen are **not_run**, not passed.
The existing SDK semantics prove that a reachable unknown tool would produce
`UNKNOWN_TOOL` before a tool body, but H0-E does not claim a child-level live
request occurred. Existing D2 crash/restart/reconciliation tests continue to
prove no blind runtime replay and clean process lifecycle for the supported
fixture path.

## External packet revalidation

The H0-D packets remain unchanged and were not executed.

Provider outage packet: one harmless disposable Bedrock request, maximum 64
tokens, maximum USD 0 cost, maximum 120 seconds, zero retries, no fallback,
durable failure/recovery/teardown evidence, and no production account,
credential, route, repository, or Office state.

Remote-host packet: one disposable remote BrainNode, one harmless `repo.read`,
one controlled disconnect, at most one reconnect, maximum two commands,
maximum 180 seconds, zero repository writes, no personal MacBook/Office node,
and durable reconnect/dedup/cleanup evidence.

## H0 gate matrix

The matrix is unchanged before and after H0-E:

| Fault class | Classification | Status | H0-E decision |
|---|---|---|---|
| provider_outage | EXTERNAL_SENSITIVE | blocked | Not executed; authorization required. |
| host_loss_reconnect | EXTERNAL_SENSITIVE | blocked | Not executed; disposable remote node required. |
| sandbox_denial | UNSUPPORTED | not_run | No supported production denial surface. |
| tool_denial | UNSUPPORTED | not_run | No supported production tool surface. |

The H0 gate still requires `live_pass` for every live-required class. H0-E
therefore does not close H0.

## Validation

The focused H0-E run passed:

- H0-E topology/import-boundary contract: **3/3**;
- H0-D boundary contract, H0-C review contract, restricted profile, and D2
  restricted runtime tests: **26/26**;
- Brain Core full suite: **2623/2623**;
- Core typecheck: PASS;
- Core build: PASS;
- `git diff --check`: PASS.

No Console source changed, so Console validation was not rerun; existing H0-C
read-boundary evidence remains applicable.

## Conclusion

H0-E is **COMPLETE AS TOPOLOGY AUDIT**. H0 remains **IN PROGRESS** with the
four-gate matrix above. Exact next prerequisite:

> Security-approved support for a harmless restricted-runtime denial topology,
> or formal review of the live-required classification for capabilities absent
> from Brain's production composition, plus separate authorization for the
> existing H0-D disposable provider and remote-BrainNode packets.

Do not start automatically.
