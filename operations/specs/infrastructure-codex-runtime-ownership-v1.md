# Codex runtime ownership and isolation contract v1

## Status

Implementation and live-validation tranche, 2026-09-05. This contract does not
perform live login, migrate the current session, or repair MCP OAuth. It
records the supported production WebGPT direct-route compatibility boundary
validated during the v5.0.3 recovery and upgrade. It replaces the unsafe pilot
admission assumption that every Codex-related process must be stopped before
an isolated profile can be inspected.

The governing loop is:

```text
observe → orient → decide within authority → act only when authorized → verify → learn
```

Every mutable resource has one authoritative writer. Runtime state ownership
and configuration ownership are deliberately separate.

## Topology and ownership

| Domain | Physical namespace | Authentication/session owner | Config owner | Brain authority |
| --- | --- | --- | --- | --- |
| Shared/default native Codex | `~/.codex` | Codex application/provider | legacy/current integrations may write | read-only observation; no normal mutation |
| Shared/default WebGPT-integrated Codex consumer | shared Codex surface plus WebGPT production home | Codex native session and WebGPT browser session remain separate | WebGPT owns only its managed route/journal fragment; Codex owns the remaining consumer config | observe, verify, drift detection, supported recovery coordination |
| Native account runtime instances | one dedicated `CODEX_HOME` profile root per admitted CLI binding | Codex application (`auth.json`, sessions, logs, SQLite, sockets, locks) | Brain profile-config materializer | account/surface intent, admission, health, lease metadata |
| Native account application instances | application-owned namespace per admitted surface binding | Codex application/provider | application | surface capability and health evidence |
| WebGPT production | WebGPT application home, browser partition, bridge/tunnel | WebGPT application/browser session | WebGPT application for its own home | route intent, dependency metadata, health, recovery policy |
| WebGPT DEV | separate WebGPT DEV home, browser partition and sandbox `CODEX_HOME` | WebGPT DEV application/browser session | WebGPT DEV application | observation and governance only |
| Optional WebGPT Codex consumer | dedicated consumer profile, if later admitted | WebGPT route relationship; not native Codex OAuth | Brain materializer for its consumer profile | separate route/profile health |
| Brain-managed secrets | macOS Keychain adapter and opaque references | Brain secret-store boundary | Brain credential-health lifecycle | verify/alert policy; no Codex OAuth custody |

Account identities and surface bindings are stable semantic records. Account
switching never renumbers them and never copies application authentication
state. A current/default session may remain user-attested, but it is not
evidence that another runtime profile is authenticated.

## Profile configuration contract

Brain stores non-secret configuration intent in the Identity & Access profile
record and materializes one physical `<profile CODEX_HOME>/config.toml`.
`tools/runtime-profile-manager/runtime-profile-configuration.mjs` records a
sidecar ownership document next to that file. The sidecar is metadata only and
contains no authentication material.

For a native profile:

```text
Brain intent + route binding
        ↓
Codex adapter compiler
        ↓
<profile-root>/config.toml       writer: brain:runtime-profile-config-materializer
<profile-root>/config.toml.brain-ownership.json
```

Codex reads the configuration and owns the application runtime state. An
existing config without the Brain ownership sidecar is a conflict, not an
invitation to overwrite it. A config writer conflict is fail-closed. The
materializer is create-only for an owned artifact in this tranche; updates
require a later explicit policy for versioning and rollback.

The compiler excludes `auth.json`, OAuth tokens, cookies, Keychain items,
sessions, logs, databases, sockets and locks. The native adapter permits only
the deterministic `file` credential-storage mode for the candidate proof;
`keyring` and `auto` remain unproven profile boundaries.

Configuration mutation is governed by the shared ownership planner in
`tools/lib/configuration-ownership.mjs`, rather than by a physical-file
ownership assumption. Each planned resource carries an identity, current and
desired owner, opaque source revision, journal state, requested action, and
authority reference. `unknown`, `conflict`, ownership transfer, inconsistent
application journal state, and revision drift are non-executable outcomes.
Brain-owned profile artifacts are validated, written through an owner-only
same-directory temporary file, atomically published, and verified. The
ownership sidecar records the resulting opaque revision so a later drift is
detected instead of silently overwritten.

The legacy managed-root adapter applies the same boundary before staging any
output. It refuses the real shared/default root and refuses a root whose
WebGPT integration journal is present. In synthetic regression fixtures it
preserves route and model selection, realtime/WebRTC routing, hook trust state,
desktop/application state, and unknown third-party sections. This preservation
is a compatibility safety net, not permission for Brain to claim those
resources. WebGPT route/journal recovery remains an adapter-owned operation.

## Process and resource safety

Normal profile operations inspect only the selected root's exact known
resources and Brain lease metadata. The Codex adapter uses exact-path `lsof`
probes where available; it does not infer ownership from process names or a
global `ps` snapshot. An active unrelated ChatGPT, Codex, WebGPT, Computer Use,
or SSH process is not a conflict unless it owns the exact target root or lease.
Another selected profile is likewise independent unless it targets the same
namespace.

An active process for the exact target profile blocks login, materialization and
launch where mutation or a second target runtime would be unsafe. Unknown,
conflicted and stale target ownership fail closed. Stale recovery can remove
only the Brain-owned profile lease after recorded-PID liveness is proven dead.
It never deletes native locks, sockets, session files or databases.

Shared-root maintenance is a separate exceptional operation. It requires an
operator handoff, supported shutdown, repeated stable observation, exact
resource ownership checks, supported read-only app-server/thread observations
where available, no live owner, an explicit maintenance lease, mutation, and
post-verification. A stability window reduces TOCTOU risk but is not itself a
lease. The legacy `codex-stop-and-repair.sh` and managed-root script are not
called by profile enrollment, account switching or credential health.

## Supported account observation

The Codex adapter can start an app-server inside the selected profile root and
perform the supported sequence `initialize` → `initialized` →
`account/read` with `{ refreshToken: false }`. It returns only allowlisted
metadata: authentication state/type, plan type, whether an email was present,
reauthentication-required state, and an honest account-binding limitation.

The observer never reads `auth.json`, parses JWTs, requests refresh, returns an
email address, invents a provider principal, or includes raw responses. An
email-present result without a stable non-personal provider identifier cannot
replace `user_attested` with `provider_verified`; that limitation is recorded.
The app-server endpoint is an observation source, not a login/logout or token
renewal mechanism.

Reference: [Codex App Server](https://developers.openai.com/codex/app-server/).
The `CODEX_HOME` boundary is documented by [Codex environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables).

## WebGPT v5.0.3 live findings

The exact source under `/Users/Office/Repos/vendors/codex-chatgpt-web`, the
installed production bundle, and the official v5.0.3 updater were reviewed.
Production WebGPT was then repaired through its supported setup path and
updated through its official checksum-verifying updater. The live result was:

- Installed application: `/Applications/Codex Web GPT.app`, v5.0.3.
- Production home: `/Users/Office/.codex-chatgpt-web`; DEV remains a separate
  v5.0.2 home and runtime.
- The integration journal is active and internally equal to its recovery
  journal; it records `/Users/Office/.codex/config.toml` and the loopback
  Responses route.
- The supported repair reconciled the route after the v5.0.2 journal/actual
  config drift. The production bridge is healthy on loopback, in Full mode,
  and accepting turns.
- The launcher-owned tunnel reports healthy and ready, and the WebGPT MCP
  verifier reports the `Codex Native2` connector available. No tunnel key,
  browser storage, cookie, OAuth, or API-key value was read or copied.
- An ephemeral Codex CLI consumer selected `chatgpt-web/light` and completed
  a bounded harmless turn with the expected sentinel response. This proves
  the repaired route, browser/session path, and bridge can execute a WebGPT
  turn after the upgrade.
- The running desktop Codex consumer has not been restarted during this live
  Goal. Its on-disk native model cache therefore still shows only the native
  rows; the final desktop model-picker refresh remains a consumer-lifecycle
  step, not evidence of a broken WebGPT route. The explicit `chatgpt-web/`
  turn above is the stronger route-level proof until that restart is safely
  performed outside active work.

The exact current upstream architecture does not establish a stable
first-class external-router/provider mode. Therefore direct WebGPT integration
targeting the shared/default Codex surface is the supported compatibility
architecture when the owner wants WebGPT models in that surface. It is not a
Brain-native account profile and does not grant WebGPT ownership of any
dedicated native account profile root.

For the shared/default WebGPT-integrated consumer, ownership is deliberately
split by resource:

- WebGPT is the sole normal writer of its managed route fragment, integration
  journal, browser/session, bridge, tunnel, and launcher state.
- Codex remains the owner of its native authentication/session state and the
  rest of the shared Codex configuration.
- Brain observes, verifies, detects drift, coordinates supported recovery, and
  records evidence. Brain is not a normal writer of this WebGPT route.
- Dynamic Brain-managed native profiles remain separate `CODEX_HOME` roots;
  WebGPT repair/update must never target them or copy their authentication.

An external route-provider contract remains a future migration candidate only
if upstream publishes and supports one. Brain must not invent that mode or
patch/fork WebGPT to create it. WebGPT bridge/browser/tunnel failures remain
separate health incidents; native direct OpenAI profiles must remain usable
when that route is down.

## Health and incident semantics

Health is causal and separate: native auth, profile runtime, native route,
WebGPT bridge, browser session, tunnel, MCP server auth, Stitch startup, hook
trust, provider reachability and network are different observations. A
`Reconnecting...` UI is a symptom; diagnosis proceeds through active
thread/writer state, selected profile/runtime, selected route, local bridge,
app-server, MCP, provider and authentication evidence. Config reconstruction is
last and only follows proven drift.

The prior pilot reports are evidence of observed behavior and hypotheses, not
proof that one specific process-kill action caused a writer failure. The
repository now records shared-root multi-writer and lifecycle coupling as the
design risk; causality remains unclaimed without before/after evidence.

## Migration plan (later, explicitly authorized)

1. Freeze the current shared/default root as a normal Brain mutation target;
   keep it intact and record a redacted baseline.
2. Create empty owner-only native roots for the selected account collection
   under a non-Git, non-synchronized Brain profile parent.
3. Materialize and verify each profile's non-secret config and ownership
   sidecar; do not copy `auth.json`.
4. Have the operator complete official login separately in each root and run
   the bounded account/status observer. Keep application OAuth ownership local.
5. Prove collection persistence and exact-root independence while unrelated
   surfaces remain running; update canonical admission evidence only after
   review.
6. Keep WebGPT production and DEV as independent application domains. If a
   WebGPT consumer is needed, provision its own route/profile and test failure
   isolation before enabling it.
7. Only in a later maintenance Goal, outside the active Codex runtime, decide
   whether to migrate the legacy default-root writer topology. Each such step
   needs a reversible backup, explicit handoff and post-verification.

Rollback for steps 2–6 is to stop using the new profile/route, preserve its
application-owned state for operator review, and continue with the untouched
legacy root. No rollback step deletes native runtime artifacts or logs out an
unrelated account.
