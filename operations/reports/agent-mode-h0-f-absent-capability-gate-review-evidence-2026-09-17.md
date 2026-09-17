# Agent Mode H0-F Absent-Capability Security Gate Review Evidence

Date: 2026-09-17
Scope: `sandbox_denial` and `tool_denial` classification only
Starting HEAD: `3f7a6845 test(agent-mode): document restricted denial topology blocker`

## Decision

H0-F is **COMPLETE**. H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**.

| Fault class | Decision | Classification | Rationale |
|---|---|---|---|
| `sandbox_denial` | **B — STRUCTURAL_ABSENCE_SUFFICIENT** | `STRUCTURAL_ABSENCE` | The production restricted composition has no sandbox API, filesystem service, or shell runtime reachable by an admitted worker. The exact pinned SDK's upstream/test-surface capability is recorded but is not injected into Brain production. |
| `tool_denial` | **B — STRUCTURAL_ABSENCE_SUFFICIENT** | `STRUCTURAL_ABSENCE` | The exact pinned SDK has a tool registry and stable `UNKNOWN_TOOL` path, but Brain production injects no tool registry and passes an empty runtime tool allowlist. There is no production tool request boundary to exercise. |

Neither class is recorded as `live_pass`. No class qualified for
`CAPABILITY_EXISTS_AND_CURRENT_AUDIT_WAS_INCOMPLETE` or
`BLOCKED_PENDING_ARCHITECTURAL_DECISION`. Structural acceptance is explicit
and conditional: future production capability, Harness pin, or composition
changes invalidate this evidence.

## Authority and scope

H0-F changed only the test-only hardening gate taxonomy/evaluation and its
bounded structural evidence fixture. It added no production runtime route,
denial injection, tool registration, sandbox API, provider path, network path,
Console control, or external-resource access. The prior H0-C, H0-D, and H0-E
reports were not rewritten.

The gate now distinguishes:

- `RUNTIME_DENIAL`: an existing production boundary rejects a request at runtime;
- `STRUCTURAL_ABSENCE`: the capability is not present or reachable in the
  audited production composition;
- `POLICY_DENIAL`: an existing authority boundary rejects an otherwise present
  capability; and
- `NOT_APPLICABLE`: the fault class is outside the current surface.

`acceptanceRequirement` is the current gate authority and can be `fixture`,
`wall_clock`, `live`, or `structural`. The historical
`liveAcceptanceRequired` flag remains unchanged so the H0-C review matrix and
its evidence remain reconstructible. For H0-F, the two absent-capability rows
require `structural_pass`; fixture evidence or `live_pass` alone is not
sufficient.

## Exact pinned SDK audit

The reviewed Harness root is:

`/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`

Pin: commit `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, version
`0.1.3-alpha.2`. The root, SDK client, and tools package manifests were
verified at that path and carry the same version.

The exact built SDK source was inspected, not generic documentation:

| SDK surface | Finding | Acceptance implication |
|---|---|---|
| Built-in tools | `packages/core/tools/lib/index.js` contains the PTC `run_code` transport and tool registry implementation. | Capability exists upstream, but not in Brain's injected production composition. |
| Reserved tool names | `run_code` is reserved and cannot be registered/shadowed; unknown names use `UNKNOWN_TOOL` and a bounded “unknown tool” error. | A test-only registry denial is not a production denial when no registry is injected. |
| PTC / `run_code` | Present in the pinned tools package. | Recorded as upstream/test-surface capability, not production authority. |
| Code runtime | Present through the PTC implementation. | No Brain production code-runtime injection is present. |
| Terminal/filesystem/subprocess | Present in upstream package/service vocabulary and disabled by Brain's restricted patch/profile. | Structural absence/unreachability in the production composition. |
| Auxiliary brokers | No auxiliary provider/capability broker is injected by Brain's restricted adapter. | No reachable external-effect edge. |
| Auto-registration/plugin discovery | The SDK client resolves one same-version package launch and passes an explicit ordered patch list; Brain supplies one generated fixture patch. No Brain production `readdir`, glob, or plugin-discovery path widens this list. | Caller cannot add a capability through implicit discovery. |
| Environment enablement | The SDK accepts launch environment options; Brain supplies a complete explicit child environment with restricted `PATH`, temporary `HOME`/`TMPDIR`, locale, bridge identity, and no provider credentials. | Unsafe inherited environment is not production authority. |

The SDK's generic client subprocess is a documented SDK transport seam. It is
not a Brain capability grant: Brain validates the pinned root/version and
observed topology before launching its existing restricted adapter.

## Attack-graph review

The required paths were traced as bounded graph evidence:

### Tool denial

```text
model output → Harness SDK → tool registry → Brain adapter/capability broker → external effect
   present          test-only       test-only              absent                  unreachable
```

The SDK registry and unknown-tool error are real, but they are not injected by
Brain production. The fixture bridge registers only the LLM adapter, not a
tool. The production runtime passes `toolNames: []` to its topology verifier
and `{ allowedToolNames: [] }`; it has no `tools.register`, tool-call
synthesis, or capability-broker path.

### Sandbox denial

```text
worker/model output → sandbox API → filesystem/shell runtime → external effect
       absent            test-only          test-only             unreachable

restricted profile → denied sandbox rows
                         policy-gated
```

The restricted profile denies `sandbox`, `sandbox-policy`, `subprocess`,
`pty`, terminal, filesystem, persistent shell/editor, jobs, and subagent rows.
The production adapter does not create a sandbox API or filesystem/shell
service to receive a denial request. The test-surface capability is therefore
not relabeled as live production denial evidence.

## Production composition and caller-control audit

The current production restricted composition was checked in
`restricted-harness-agent-runtime.ts` and
`deepseek-harness-restricted-profile.ts`:

- only the generated fixture LLM plugin is injected (`inject: ["llm"]`);
- the allowed runtime tool list is empty;
- unsafe service rows are explicitly disabled/denied;
- exactly one fixture provider route is observed;
- the child is separate-process and uses an explicit complete environment;
- the Harness root is absolute, realpathed, pinned by basename, version
  checked against both manifests, and required client/LLM artifacts are
  present; and
- no production `tools.register`, tool-call, sandbox API, filesystem service,
  auxiliary provider route, implicit plugin discovery, or H0-F fault API is
  present.

The following caller-controlled sources cannot widen the audited topology:

| Input | Result |
|---|---|
| task input / task text | not used to construct the Harness patch, tool list, or service rows |
| agent configuration | no production option for tools, sandbox, profile, provider list, or allowed tools |
| Console / Jarvis | no fault or capability mutation surface |
| model output | no tool registry or sandbox API is injected to interpret it |
| Node command | outside this local restricted composition; cannot alter its validated child topology |
| Harness root | caller path is validated against the pinned commit/version and required artifacts |
| child environment | constructed explicitly by Brain; parent environment is not used as the child environment |

## D0 build/package graph

D0's runtime package is an explicit allowlisted graph of Brain Core, standalone
Brain Console, and configuration-template components. Its manifest and verifier
use bounded file enumeration, exact hashes, no symlinks, no mutable state,
no secrets, and no dynamic plugin discovery. The package graph does not create
a second Harness/tool authority. The separately validated local Harness root
is an existing runtime dependency of the restricted adapter, not a caller-
controlled plugin registry or a package-manifest authority.

Physical inclusion and reachable authority were kept separate: an upstream SDK
file can physically contain tool/sandbox implementation while the production
composition leaves the path absent or unreachable. A future packaging or
loader change that adds dynamic plugin discovery, injects a tool/sandbox row,
or changes the Harness pin invalidates this structural review.

## Full H0 coverage matrix

`NOT_REQUIRED` is explicit in every non-applicable cell. For the two H0-F rows,
the live column records the historical H0-C dimension as superseded by the
current structural requirement; it does not claim live execution.

| Fault class | Fixture requirement/status | Wall-clock requirement/status | Live requirement/status | Structural requirement/status | Security-review status | Overall class status | Blocker |
|---|---|---|---|---|---|---|---|
| `provider_outage` | required / `fixture_pass` | NOT_REQUIRED | required / `blocked` | NOT_REQUIRED | NOT_REQUIRED | BLOCKED | disposable provider packet not authorized/executed |
| `bedrock_budget_exhaustion` | required / `fixture_pass` | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `codex_quota_exhaustion` | required / `fixture_pass` | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `host_loss_reconnect` | required / `fixture_pass` | NOT_REQUIRED | required / `blocked` | NOT_REQUIRED | NOT_REQUIRED | BLOCKED | disposable remote BrainNode packet not authorized/executed |
| `process_crash_restart` | required / `fixture_pass` | NOT_REQUIRED | required / `live_pass` | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `stale_lease` | required / `fixture_pass` | NOT_REQUIRED | required / `live_pass` | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `duplicate_delivery` | required / `fixture_pass` | NOT_REQUIRED | required / `live_pass` | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `stuck_agent` | required / `fixture_pass` | NOT_REQUIRED | required / `live_pass` | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `spawn_limit` | required / `fixture_pass` | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `sandbox_denial` | required / `fixture_pass` | NOT_REQUIRED | historical H0-C flag / NOT_REQUIRED after H0-F classification | required / `structural_pass` | NOT_REQUIRED | PASS | none while production composition remains unchanged |
| `tool_denial` | required / `fixture_pass` | NOT_REQUIRED | historical H0-C flag / NOT_REQUIRED after H0-F classification | required / `structural_pass` | NOT_REQUIRED | PASS | none while production composition remains unchanged |
| `corrupted_state` | required / `fixture_pass` | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `accelerated_soak` | required / `fixture_pass` | global H0 wall-clock gate / `wall_clock_pass` | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | PASS | none |
| `security` | required / `fixture_pass` | NOT_REQUIRED | required / `live_pass` | NOT_REQUIRED | required / `live_pass` | PASS | none |
| `auditability` | required / `fixture_pass` | NOT_REQUIRED | required / `live_pass` | NOT_REQUIRED | required / `live_pass` | PASS | none |

The overall H0 gate remains **INCOMPLETE** only because provider outage and
remote-host loss remain blocked external-sensitive live classes. H0-F does not
mass-convert those classes or change any other H0 requirement.

## Gate tests and validation

New H0-F evidence tests prove:

- the four-value classification taxonomy is closed;
- both structural evidence records are versioned, bounded, and contain
  present/absent/test-only/unreachable/policy-gated graph edges;
- the exact pinned SDK markers are present and Brain production composition is
  closed;
- caller-controlled widening is rejected by the current composition;
- structural acceptance requires `structural_pass`;
- missing structural evidence remains `INCOMPLETE`;
- `live_pass` alone cannot satisfy a structural class; and
- provider live acceptance remains required and blocked.

Focused result: **18/18 passed** across H0-F plus H0-C, H0-E, hardening-gate,
and wall-clock hardening tests. Brain Core typecheck and build passed. The H0-E
report records **2623/2623** for its final full suite. H0-D's committed report
records **3/3** boundary tests and **51/51** combined relevant tests, but did
not record its later terminal full-Core **2620/2620** result; those historical
count differences are preserved rather than rewritten.

## External packets revalidated, not executed

The existing H0-D packets were revalidated only:

- provider: one disposable Bedrock boundary, one harmless request, at most 64
  tokens, declared maximum USD 0, 120 seconds, zero retries, no fallback, no
  production impact;
- remote: one disposable remote BrainNode, read-only `repo.read`, at most two
  commands, one disconnect and one reconnect, 180 seconds, zero repository
  writes, no Office/MacBook interaction.

No packet was executed. No claim is made that an external provider or remote
host is healthy. Authorization and resource setup remain prerequisites.

## Effect counts

| Effect | Count |
|---|---:|
| live provider/model calls | 0 |
| Bedrock/MiniMax/GLM/Opus/Codex calls | 0 |
| remote host / SSH / Tailscale contacts | 0 |
| network requests | 0 |
| BrainNode / Workcell operations | 0 |
| Harness denial children launched by H0-F | 0 |
| production tool or sandbox registrations | 0 |
| repository mutations through Agent Mode | 0 |

## K5/U0 guard and next task

K5 and U0 were not reopened or modified. No BrainNode, Console, provider,
network, credential, or unrelated roadmap surface was touched. Protected dirty
or untracked paths remained untouched and unstaged.

Exact next prerequisite: separately authorize the disposable provider-outage
and remote-BrainNode packets, then run only those bounded H0 live gates. Do not
start automatically. H0 must not be marked complete by H0-F.
