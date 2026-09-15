# Agent Mode D0-A Portable Core Configuration Evidence — 2026-09-15

## Decision

D0-A is **COMPLETE** and D0 remains **IN PROGRESS**. The portable lean-core
configuration contract is implemented and validated without deployment,
installer, VPS, Tailscale, Postgres/DynamoDB, AgentCore, or H0 work.

Starting HEAD was `d701d8f4 test(agent-mode): close Jarvis voice gateway gate`.
V0 was verified complete before this slice; K0–K5 and U0 remain complete. The
protected unrelated worktree paths were preserved and were not staged.

## Lean Brain Core definition

The lean deployment is the Brain Core API, SQLite StateStore reference backend,
Brain Console/Core URL boundary, durable Agent Mode state and control surfaces,
BrainNode/NodeTransport protocol seam where locally configured, scheduler,
service/operator authentication boundary, and provider/resource interfaces.
It does not require personal Mind, Office/MacBook paths, Bible Studies,
FluidVoice, Video Orchestrator, private Codex/Claude state, n8n, Tailscale,
personal repositories, or optional provider credentials to construct its
baseline configuration.

Core configuration, personal integration configuration, secrets, and
runtime-generated state are distinct categories. The loader contains no secret
values and no runtime ledger state.

## Configuration inventory and classification

| Surface | Current source/default | Classification |
| --- | --- | --- |
| Core bind | `security/localhost.ts`; `127.0.0.1:4877` | CORE_REQUIRED |
| SQLite StateStore | `sqlite-state-store.ts`; `~/.local/brain/agent-mode/agent-mode.db` | CORE_REQUIRED / RUNTIME_GENERATED data |
| Core profile | `agent-mode/portable-runtime-config.ts`; `brain-runtime-config-v1` | CORE_REQUIRED |
| Brain Console URL | Console `NEXT_PUBLIC_BRAIN_CORE_URL`, server `BRAIN_CORE_URL`, default `http://localhost:4877` | CORE_REQUIRED boundary |
| BrainNode config | `brain-node-runner.ts`; `~/.local/brain/node/node.json` | CORE_OPTIONAL local capability |
| runtime/temp roots | portable config; `~/.local/brain/runtime` and `~/.local/brain/tmp` | CORE_OPTIONAL / RUNTIME_GENERATED |
| service/operator auth | `brain-service-auth.ts`, Console session server; server environment secrets | SECRET, external |
| model/provider/resource registry | K4 registries and injected references | CORE_REQUIRED interface; configured providers optional |
| scheduler | Agent Mode scheduler and StateStore | CORE_OPTIONAL control surface |
| personal Mind/media/video adapters | adapter-specific environment/config paths | PERSONAL_INTEGRATION / LEGACY / NON-D0 |
| tests and dev launchers | fixture roots and local launch scripts | TEST/DEV fixture; not lean runtime |

The inventory did not move unrelated legacy storage merely to make names
consistent.

## Personal-path audit

The deployable Agent Mode path had no required Office/MacBook absolute path after
the D0-A seam changes. Existing `brain-node-runner.ts` already used a home-
relative default and now derives it from the portable config. Existing personal
or specialist occurrences were classified as follows:

- **A — lean-core blocker:** Core host/port, Agent Mode SQLite default, and
  BrainNode default path. These are now HOME/config derived.
- **B — optional personal integration:** Mind maintenance, Video Orchestrator,
  local-app, AI selector, and personal media/provider defaults. They remain
  outside the lean Agent Mode startup path and are selected only by their own
  optional adapters/configuration.
- **C — historical documentation/evidence:** repository paths in runbooks,
  handoffs, architecture notes, and prior evidence. They were not rewritten.
- **D — test/live-acceptance fixture:** explicit paths in tests and dev launchers;
  they remain fixture-only and were not promoted into defaults.
- **E — unrelated product/tooling:** specialist Video Orchestrator, Mind, and
  other product paths not required to boot Core. No D0-A changes were made.

No SSH, Tailscale, AWS, provider, BrainNode remote, or personal integration
probe was added.

## Portable contract and precedence

`projects/brain-core/src/agent-mode/portable-runtime-config.ts` defines the
strict `brain-runtime-config-v1` contract with profile class (`core`, `personal`,
or `test`), deployment mode, state root/SQLite reference, Core bind/port,
Console Core URL/port, BrainNode/runtime/temp roots, optional capability
availability, and bounded provider/resource references.

Precedence is deterministic and field-aware:

```text
safe built-in defaults
  → portable JSON profile
  → host-local JSON profile
  → known environment overrides/compatibility variables
```

Profiles are JSON only, strict, versioned, and loaded as data. Unknown keys,
unsupported versions, invalid ports/URLs, unsafe path traversal, `.git`/device
paths, unsupported StateStore kinds, and malformed references fail closed. There
is no `eval`, shell sourcing, shell expansion, dynamic config import, or secret
logging. Profile paths may be provided by `BRAIN_RUNTIME_PROFILE_PATH` and
`BRAIN_RUNTIME_HOST_PROFILE_PATH`; the class may be selected with
`BRAIN_RUNTIME_PROFILE`.

The compatibility variables `BRAIN_AGENT_MODE_STATE_DIR`, `BRAIN_CORE_HOST`, and
`BRAIN_CORE_PORT` remain supported. A legacy Agent Mode state directory retains
its existing `agent-mode.db` placement. `BRAIN_CORE_URL` and
`NEXT_PUBLIC_BRAIN_CORE_URL` remain Console configuration rather than being
silently merged into Core authority.

`brain-agent config validate` loads and prints only the normalized non-secret
contract and optional capability classifications. It performs no provider,
network, scheduler, runtime, or StateStore write operation.

## Host-neutral and backend-neutral results

Portable defaults are derived from `HOME` under `~/.local/brain`; no default
contains `/Users/Office`, `/Users/Steve`, a checkout path, username, or personal
repository. Changing HOME, installation/profile location, Core port, or optional
capability availability changes only configuration/path resolution. The contract
contains no Agent, Task, Run, Attempt, K4, K5, Jarvis, review, or voice identity
fields, so domain identity and orchestration semantics are unchanged.

SQLite remains the reference implementation selected by `stateStore.kind`; the
portable contract does not expose SQLite tables or columns to Agent Mode domain
contracts, Console schemas, Jarvis contracts, or BrainNode protocol. Future
StateStore backends remain an explicit later slice. BrainNode and NodeTransport
protocols were not redesigned or bypassed.

Voice remains optional: absent MLX Whisper is `unavailable`, browser speech is a
client capability, and Core can boot without either. Bedrock, local node,
Workcell, and other provider/resource capabilities are configuration-derived
availability, not live health; missing optional credentials do not trigger
startup probes or necessarily fail lean-core construction.

## Startup and secret policy

| Condition | Lean-core result |
| --- | --- |
| invalid profile/schema/unknown key | startup/config validation fails closed |
| invalid Core bind/port/required SQLite path | fails closed |
| unsupported StateStore kind | fails closed |
| missing mandatory service auth in an authenticated deployment | existing auth boundary remains unavailable/fails closed |
| missing Bedrock/provider credential | optional capability unavailable |
| missing MLX/SpeechSynthesis | voice unavailable; Core remains valid |
| missing Mind/Bible Studies/FluidVoice/Tailscale/Workcell tooling | personal/optional capability unavailable |

Secrets remain external: service/operator secrets, AWS credentials, SSH keys,
Tailscale keys, and provider API keys are not profile fields. The validation
output contains no secret values, environment dump, credential path, private
key, session token, or browser filesystem authority.

## Deterministic validation evidence

`projects/brain-core/src/tests/agent-mode-portable-runtime-config.test.ts`
proves:

- versioned portable defaults and optional personal integrations;
- built-in → portable → host-local → environment precedence;
- legacy state-directory compatibility;
- unknown-key/version/path/port/URL failure-closed behavior;
- equivalent semantics under two temporary HOME values;
- fake-install-root profile loading without repository-cwd dependence;
- personal-profile absence and secret redaction;
- zero fetch/provider probe during configuration loading;
- no domain identity or execution authority in configuration.

The Core startup/state/node seams compile against the loader. Core focused
configuration tests pass **9/9**. Brain Core typecheck and build pass. The
existing K0–K5, StateStore, NodeTransport, service-auth, and V0 regression
coverage remained green in the full Core run: **2,582/2,582 passed**. Brain
Console source was not touched in D0-A, so its frontend build was not rerun.

## Side-effect and compatibility audit

Config loading is synchronous data validation only. Expected external effects
are all zero: network, AWS, Bedrock, Codex, Tailscale, SSH, BrainNode remote
execution, provider probes, Harness, Workcells, model calls, deployments,
scheduler jobs, Agent/Task creation, runtime launches, and StateStore writes.
The current Office deployment remains compatible through existing environment
variables and CLI behavior; no flag-day migration or personal deployment rewrite
was performed.

## Remaining D0 matrix

| Roadmap item | D0-A disposition |
| --- | --- |
| portable configuration profiles | FOUNDATION COMPLETE |
| installer/bootstrap | READY FOR NEXT SLICE |
| macOS BrainNode packaging | NOT STARTED |
| Linux BrainNode packaging | NOT STARTED |
| VPS/Tailscale deployment | DEFERRED / OPTIONAL |
| Postgres/DynamoDB StateStore backends | DEFERRED / OPTIONAL |
| AgentCore adapters | DEFERRED / OPTIONAL |
| migration/export/import | NOT STARTED |
| extension/plugin SDK | NOT STARTED |

D0 packaging/deployment work may proceed before H0, but this slice makes no
claim of broad unattended or distributed release readiness. H0 remains the
later soak/security/release gate.

## Status

- **D0-A COMPLETE**
- **D0 IN PROGRESS**
- Exact next bounded task: **D0-B — Reproducible Lean-Core Bootstrap and
  Dry-Run Installer**
- D0-B, deployment, packaging, H0, and infrastructure changes were not started.
