# Codex account/session/runtime-profile capability boundary

## Status

This is the 2026-09-07 production-activation closeout for native
Codex/OpenAI authentication and Codex Web GPT. The repository manager remains a
CLI-only, repository-controlled proof surface; it does not copy
authentication state, automate login, or change any live application session.
The canonical catalog now contains the two admitted account/profile bindings,
host-local runtime instances, bounded legacy/application session metadata, and
the read-only Keychain adapter contract. Provider identity for the dedicated
profiles remains operator-attested where the supported observer exposes no
stable non-personal principal identifier.

The conclusion is **partially supported**:

- Brain can model any number of opaque OpenAI accounts, application-owned
  sessions, runtime profiles, expected principals, storage ownership, health,
  lifecycle, and binding evidence.
- Codex CLI has a supported configuration-profile mechanism and a supported
  `CODEX_HOME` state root. File-based cached authentication is therefore
  separable by `CODEX_HOME` for the CLI, subject to the plaintext-token risk.
- Keyring profile isolation is not proven by the supported documentation or
  the safe probes. `auto` cannot be treated as an isolation mode because the
  selected backend is not observable without reading credential state.
- Synthetic exact-root concurrency and unrelated-process independence are now
  covered by the repository tests. Real concurrent authenticated profile
  execution and Desktop profile isolation remain unproven. The manager is
  profile-aware, but it is not a generic credential vault and cannot certify
  unsupported surfaces.

The target ownership topology, WebGPT decision, account/read redaction
contract, and migration boundary are canonicalized in
`operations/specs/infrastructure-codex-runtime-ownership-v1.md`.

## Evidence collected

The live observer used supported status/doctor commands and allowlisted local
metadata. It did not read or print `auth.json`, cookies, browser storage,
Keychain values, process arguments, environment dumps, OAuth material, or
MCP payloads. It did not log in, log out, restart an application, change a
route, or modify the Keychain.

Observed on this workstation:

| Subject | Result | Meaning |
| --- | --- | --- |
| Codex CLI | `0.153.2` | Installed CLI surface is available |
| Native Codex/ChatGPT app | `26.901.31953`; login status `authenticated` | A current session exists; the account is not identified |
| Canonical/user config | `cli_auth_credentials_store` is not explicitly set | Configured storage mode is `unspecified`; effective backend is unknown |
| `auth.json` | Exists, mode `600`; metadata only | File cache exists, but this does not prove it is the active backend |
| `CODEX_HOME` | Not set in the probe environment; default is `~/.codex` | The default state root applies unless the invoking process overrides it |
| Web GPT production | Version `5.0.2`; runtime/bridge/proxy/tunnel healthy | Production remains degraded only for unknown connector attachment |
| Web GPT DEV | Configured `full`/`dev-harness`; launcher not running; MCP not ready | Separate DEV runtime is not currently healthy |

The current check is intentionally:

```text
CODEX_AUTH_PROFILE_ISOLATION=NOT_OK
CONFIGURED_STORAGE=unspecified
ACCOUNT_ATTRIBUTION=unknown_by_supported_cli_surface
MULTI_ACCOUNT_READINESS=not_proven
```

The `NOT_OK` is not a claim that the current authenticated session is broken.
It means Brain cannot honestly certify the requested multi-account isolation
contract from the available evidence.

## Canonical model

The existing `infrastructure-identity-access-v1` catalog remains the one
Identity & Access model. Its entities have been evolved rather than duplicated:

```text
opaque account
  ├─ expected provider principal
  ├─ application-owned session(s)
  ├─ runtime profile(s)
  ├─ opaque credential reference(s)
  ├─ verification policy
  └─ lifecycle/recovery policy

session ── binding evidence ──> account
session ── runtime profile ───> runtime profile
runtime profile ── storage metadata ──> application/runtime-owned state
```

Account IDs are stable Brain references such as
`account:openai.01` and `account:openai.02`. They are not
email addresses and do not embed token hashes, filenames, browser directories,
or provider session identifiers. The numeric suffix is an allocator output,
not a fixed account count or a promise that the account is currently active.

The schema now represents:

- account role/preference metadata separately from live session state;
- an explicit list of current observed application sessions, whose account
  binding can remain user-attested;
- `binding.state`: `provider_verified`, `user_attested`, `declared`, `unknown`,
  `conflicted`, or `not_applicable`;
- `authenticationStorage`: owner, mode, location kind, isolation scope,
  `profileIsolationProven`, health, exposure boundary, and mutation owner;
- profile lifecycle/recovery references and explicit concurrency support,
  maximum profile count, quiescence requirement, and process ownership;
- nullable account references for genuinely unresolved session/profile
  attribution;
- explicit `surfaceBindings` between provider accounts and application
  surfaces, so one account can have multiple surface-specific bindings while
  each surface can retain its own isolation and capability evidence;
- candidate-level account/profile relationships through the existing pure
  observation/admission machinery.

The canonical catalog contains the two real operator-admitted OpenAI accounts,
three runtime profiles, three host-local runtime instances, and five bounded
application session records. It contains no raw or Brain-custodied credential
material: native Codex OAuth, WebGPT session state, MCP OAuth, and the shared
default state remain application-owned. The alternate fixture continues to
demonstrate multiple same-provider accounts and credential references without
any production credential material. The CLI candidate fixture remains a test
collection, not a production account registry.

The allocator supports N accounts. Preferred-account policy is explicit and
provider-scoped; active session state never changes it. A new account gets the
next unused monotonic identifier, including after an account is retired, and
does not reuse another account's surface binding or runtime namespace.

## What the Codex controls mean

`--profile name` is a named configuration layer. It is **not** by itself an
authentication profile. The official configuration reference places the layer
at `$CODEX_HOME/name.config.toml`, while authentication storage is separately
controlled by `cli_auth_credentials_store`.

`CODEX_HOME` is an adapter mechanism, not Brain's canonical identity model. A
Codex runtime adapter may use one separate state root per runtime profile, but
must not assume that a profile layer, a path, or a successful login is proof of
account identity.

The disposable experiment created independent empty roots for `file`,
`keyring`, and `auto`, then ran only `codex login status` with no credential.
Each root remained unauthenticated, produced only local temporary state, and
created no `auth.json`. The roots were removed after the probe. This proves
that the CLI honors the supplied state root for this read-only state path; it
does not prove that two real authenticated accounts can coexist in every
backend or application surface.

## Storage-mode findings

| Mode | Supported fact | Isolation conclusion | Security/recovery consequence |
| --- | --- | --- | --- |
| `file` | Cached credentials are in `auth.json` under `CODEX_HOME` | CLI authentication separation by distinct roots is documented; real multi-account operation was not exercised in this tranche | Plaintext access tokens require file permissions, local backup discipline, and human-controlled recovery. Never commit/copy the file. |
| `keyring` | Cached credentials are in the OS credential store | Per-`CODEX_HOME` or per-profile namespacing is **unknown/not proven**; an OS-user-global item must not be assumed isolated | Stronger OS protection, but no safe account-selection guarantee. Do not inspect or rewrite Codex Keychain entries to answer this. |
| `auto` | Uses the OS store when available and otherwise falls back to `auth.json` | Selected backend and profile isolation are unknown without credential-store evidence | Convenient fallback, but not a deterministic multi-account boundary. |

No silent switch to file mode is authorized. The decision is a real security
trade-off: OS Keychain protection versus a currently more provable CLI
per-root authentication boundary. The correct next step is to verify whether
the installed runtime offers both properties through a supported mechanism,
not to sacrifice one invisibly.

OpenAI's current authentication documentation also says that active ChatGPT
sessions refresh tokens during use and that CLI and IDE extension login caches
are shared. Brain therefore does not run a generic refresh loop or synthetic
keepalive. A provider-rejected session must follow the owning application's
reauthentication path.

## Surface capability matrix

Each capability is evaluated independently; `many` is not a substitute for
profile, identity, or concurrency evidence.

| Capability | CLI | IDE extension | ChatGPT/Codex Desktop | Brain state |
| --- | --- | --- | --- | --- |
| Named configuration profiles | Supported via `--profile` | Not established by this tranche | Not established by this tranche | Supported as adapter capability only |
| `CODEX_HOME` state root | Supported | Official environment-variable docs list it for the IDE extension | Not proven as a Desktop account boundary | Supported for CLI/IDE adapter state |
| File-mode auth per separate root | Documented for CLI | Not independently proven beyond shared cache semantics | Not proven | Partially supported; no real login test |
| Keyring auth per separate root | Storage supported; namespace unknown | Namespace unknown | Namespace unknown | Unknown/not proven |
| `auto` selected backend | Not observable from current safe metadata | Unknown | Unknown | Unknown |
| Multiple defined profiles | Configuration layers supported | Unknown | Unknown | Supported model, runtime-specific |
| Multiple authenticated profiles | Not proven | Not proven | Not proven | Unknown |
| Concurrent authenticated profiles | Not proven; process/profile ownership is not safely observable | Not proven | Not proven | Unknown |
| Stable active account identity from status | `codex login status` returns method/status, not a stable account ID | Profile UI may show identity, but no machine adapter is admitted | Profile UI shows active account, but no non-secret adapter is admitted | Unknown; user attestation remains possible |
| Application-owned session custody | Yes | Shared cached login relationship | Yes | Supported concept; application owns material |

The official authentication documentation says the ChatGPT desktop app, CLI,
and IDE extension support ChatGPT and API-key sign-in, while the CLI and IDE
extension share cached login details. That shared cache means a normal logout
from either CLI or IDE can require login again; it is not a many-account vault.
The Desktop application session is modeled separately because the CLI profile
mechanism has not been proven to control its application/browser state.

## Codex Web GPT

Codex Web GPT production and DEV are separate application-owned surfaces.
Production owns its embedded browser/session, route, bridge, and tunnel. DEV
has a separate development browser/user-data boundary, state root, Codex
sandbox, connector, and tunnel according to the upstream development
architecture. DEV may be logged into the same or a different ChatGPT account;
that identity is not inferred locally.

The production connector attachment is a relationship-evidence gap. It must
remain `unknown`/degraded at the connector relationship while local production
runtime health can remain healthy. It is not evidence of a revoked OpenAI
credential and must not be merged into the native CLI account result.

## Identity attribution and human confirmation

The safe order is:

1. Use a supported provider/application principal surface if one returns a
   stable non-secret identifier.
2. If the surface returns only `authenticated`, keep the account reference
   unresolved.
3. Allow the user to attest that a session/profile represents an opaque Brain
   account. Record `USER-PROPOSED`, a source reference, timestamp, expiry, and
   later re-verification requirement.
4. Admit a binding as provider-verified only after provider evidence proves the
   expected principal. A user assertion never changes its provenance class.

The new binding candidate goes through the existing
`discover → observation → candidate → pure admission plan` path. User-attested
or declared account/profile links remain candidates for account-sensitive
operations; conflicting links are rejected. No guessed “currently logged-in”
account is written to the canonical catalog.

## Health and recovery semantics

Existing I&A health vocabulary is reused. The relevant flow is:

```text
application-owned session
  → provider rejected/revoked evidence
  → account/profile binding (or unresolved identity)
  → existing incident/attention projection
  → guided human reauthentication
  → fresh principal and capability verification
```

Application-managed automatic refresh during active use is distinct from
interactive reauthentication. Brain may observe and notify; it does not read
tokens, refresh generic OAuth, keep sessions alive artificially, or replace
provider/application state.

macOS Keychain remains the current/reference Brain-managed secret-store
adapter for Brain-owned credentials. OnePassword is a future replaceable
adapter only; it is not the active Codex authentication architecture and must
not become a second copy of application-owned sessions.

## Definition of done

1. **Which native session exists?** A native Codex/ChatGPT runtime is observed
   and `codex login status` is `authenticated`; the exact UI session instance
   is not uniquely attributable from the safe process metadata.
2. **Who owns its material?** The Codex/ChatGPT application and its supported
   CLI/IDE runtime storage own it, not Brain.
3. **Which Brain account?** None is currently determinable; the active account
   remains unresolved.
4. **Attribution provenance?** `OBSERVED-VERIFIED` for authentication status
   only; no account binding. A future human link is `USER-PROPOSED`.
5. **Which runtime profile?** The adapter records an opaque current native
   runtime profile, but no account binding is claimed.
6. **Which storage mode?** Configured mode is unspecified; effective mode is
   unknown. `auth.json` presence does not prove file mode is active.
7. **Is auth profile-isolated?** Unknown overall; file mode is the only
   documented CLI-per-root boundary, while keyring/auto are unproven.
8. **Does `CODEX_HOME` isolate config/runtime state?** Yes for the CLI state
   path tested with disposable roots; named config layers also live under it.
9. **Does file mode isolate authentication?** Documented for CLI because the
   file is under `CODEX_HOME`; real authenticated coexistence is not proven.
10. **Does keyring mode isolate authentication?** Unknown/not proven.
11. **Can multiple authenticated profiles coexist?** Unknown/not proven.
12. **Can they run concurrently?** Unknown/not proven.
13. **Which surfaces support the boundaries?** CLI configuration/state roots
   are supported; IDE shares cached login and needs separate proof; Desktop
   profile isolation is not established.
14. **How is Web GPT represented?** As separate application-owned production
   and DEV sessions/profiles with separate environment/isolation references;
   identity is unresolved without supported evidence.
15. **What is observable versus attested?** Runtime/version/status/storage-key
   metadata is observable; account identity can be user-attested; stable
   account/profile identity and keyring isolation remain unknown.
16. **Can switching avoid OAuth copying?** Yes as a manager invariant. The
   repository now contains a CLI-only profile manager that selects an opaque
   profile, resolves a deterministic dedicated `CODEX_HOME`, and prepares a
   child-only launch/login boundary. It never copies authentication state,
   logs out another profile, mutates the parent environment, or writes routes.
   Real multi-account authentication and provider-principal verification remain
   unproven until the separately gated pilot.

## CLI-only runtime-profile manager

The manager is an adapter over the existing Identity & Access catalog, not a
new account or OAuth registry:

```text
tools/runtime-profile-manager.mjs
  → runtime-profile-manager-core.mjs (provider-neutral policy)
  → codex-cli-adapter.mjs (Codex mechanics)
  → existing runtimeProfiles/accounts/sessions records
```

Exact interface:

```text
runtime:profiles list [--catalog PATH] [--profiles-root PATH]
runtime:profiles prepare-account --surface ID [--provider ID]
runtime:profiles capabilities [--catalog PATH]
runtime:profiles create --profile ID [--execute --confirm]
runtime:profiles materialize-config --profile ID [--execute --confirm]
runtime:profiles doctor --profile ID [--no-login-probe]
runtime:profiles login --profile ID
runtime:profiles launch --profile ID [--bootstrap] [--execute --confirm]
runtime:profiles clear-stale --profile ID [--execute --confirm]
```

The command is also directly invocable as
`node tools/runtime-profile-manager.mjs`. `create` provisions only an empty
owner-only directory. `login` is always a human handoff. `launch` uses a
child-process environment containing the selected root and a non-secret
profile marker; it has no global process-kill path and no parent-environment
mutation. A launch before isolation and identity evidence is explicitly
`bootstrap_only`; normal account use stays blocked until the profile binding
is provider-verified or human-attested and isolation is proven.

The manager reads only metadata and bounded status results. It never reads
authentication-file contents, Keychain values, cookies, browser storage, or
process arguments/environment dumps. A small profile-scoped process lease is
operational lifecycle evidence, not an identity registry; it contains only a
profile ID, PID, start time, and manager reference. MCP authorization sessions
are returned as separate session metadata and are never treated as native CLI
authentication.

If a manager lease becomes stale after a crash, `clear-stale` can remove that
exact lease only after confirming that its recorded process is no longer alive;
it never terminates a process and cannot clear an active lease.

`materialize-config` is the explicit profile-local configuration operation. It
creates only the Brain-owned non-secret `config.toml` and ownership sidecar;
an existing unowned config is a conflict. The manager never materializes
profile config into the shared/default `~/.codex` root.

The Codex adapter currently permits only explicit `file` storage for the
deterministic pilot. It rejects `keyring` and `auto` because their
profile-specific namespacing is not proven. It checks owner-only runtime-root
permissions, auth-file metadata if present, parent writability, Git separation,
and known cloud-sync path exposure. Disk encryption and provider account
identity remain explicit unknowns rather than optimistic OK states. Route
ownership is preserved by forbidding route writes; Web GPT remains an
application-owned separate surface.

## Current pilot gate

The manager implementation is complete as repository-only, synthetic-tested
proof. A later, separately authorized operator-assisted multi-account CLI
pilot may use any selected collection of opaque candidate records, create one
empty root per selected runtime profile, have the user perform normal login
separately in each root, confirm each account in the provider UI, and run
bounded read-only status/capability checks. It must first materialize each
profile config. It does not require global Codex/ChatGPT quiescence and does
not touch the shared/default root. It must not copy auth state, perform global
logout/login, change routes, or include Desktop/WebGPT.
Keyring, `auto`, IDE shared-cache behavior, Desktop, and WebGPT remain
separate gates.

No scheduler should treat a global `Codex authenticated` signal as
account-health proof until that binding exists.

## Sources

- [OpenAI Codex authentication](https://learn.chatgpt.com/docs/auth)
- [OpenAI Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [OpenAI Codex advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
