# IKHP Identity & Access production-readiness audit — 2026-09-07

## Decision

**Audit classification: `COMPLETE_WITH_INTENTIONAL_DEFERRED_CAPABILITIES`**

The Identity & Access production metadata plane is activated for the two
admitted OpenAI accounts, dedicated CLI runtimes, bounded application
surfaces, corrected multi-host topology, Keychain adapter contract, and
read-only health loop. The classification is not a claim that every
application session is currently healthy or that Brain can renew provider
credentials. Those capabilities remain explicitly deferred at their owning
application/provider or human boundary.

## Baseline and evidence boundary

The audit started from `main` at `97b85ded`, which was equal to `origin/main`
and clean. Current live checks were read-only. No login, logout, OAuth refresh,
auth-file read, Keychain value read, browser-storage read, route write, WebGPT
change, credential migration, or provider mutation was performed.

The audited repositories are:

- Brain: `/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01`
- WebGPT application: `/Users/Office/Repos/vendors/codex-chatgpt-web`

The WebGPT repository remained clean at its existing revision and was not
edited.

## Canonical admitted entities

| Entity | Admitted state |
| --- | --- |
| Accounts | `account:openai.01` preferred/primary; `account:openai.02` non-preferred/secondary |
| CLI profiles | `runtime_profile:openai.01.cli`; `runtime_profile:openai.02.cli` |
| Desktop profile | `runtime_profile:openai.02.desktop`, operator-attested candidate |
| Office runtimes | `runtime_instance:office.openai.01.cli` and `runtime_instance:office.openai.02.cli` |
| MacBook runtime | `runtime_instance:macbook.openai.02.desktop`, application-owned candidate |
| Sessions | five: MacBook desktop, shared default, WebGPT production, `codex_apps`, Stitch |
| Network paths | two transport-only MacBook → Office paths: Tailscale and Thunderbolt |
| Execution connections | two SSH connections from the MacBook runtime to `host:office` / `workspace:brain`; target runtime unset |
| Credential records | zero; no secret material or false Brain ownership was introduced |
| Secret-store adapters | `secret-store:macos-keychain`, metadata/bounded-consume only, mutation disabled |

Both dedicated CLI roots were verified with the supported profile-local
app-server observer using `account/read` with `refreshToken:false`. Each
returned authenticated status, `doctor: OK`, file-mode configuration,
owner-only root/config/auth-file metadata, no active profile process, and no
target-root mutation. The observer returned no stable non-personal provider
principal identifier, so the canonical account/profile mapping remains
operator-attested rather than provider-verified. No reauthentication was
needed or performed.

## Custody matrix

| Surface/resource | Owner | Scope | Health/evidence | Mutation authority |
| --- | --- | --- | --- | --- |
| Dedicated Codex CLI OAuth/session for accounts 01 and 02 | Codex application/provider | runtime-instance-local, host-local | authenticated and isolated; principal mapping operator-attested | Codex/application only |
| MacBook Codex Desktop session | Codex Desktop application/provider | runtime-instance-local, host-local | operator-attested; provider identity not inspected | application only |
| Shared `~/.codex` | native Codex application | global, operating-system-user | account/storage/effective backend unknown | observe-only; no Brain repair |
| WebGPT browser/session/route/tunnel | WebGPT application | surface-local | config/service/proxy/tunnel healthy; browser/connector acceptance deferred | WebGPT owner-only |
| `codex_apps` MCP OAuth | MCP/application/provider | surface-local | provider-revoked, prior `401 token_revoked` | MCP/provider human reauth |
| Stitch MCP OAuth/startup state | MCP/application/provider | surface-local | startup/provider availability unknown after timeout | MCP/provider owner |
| SSH identity for MacBook → Office | host/application/network boundary | connection-local | SSH aliases and paths observed; separate from OpenAI auth | host/SSH owner |
| Tailscale identity/API reference | Tailscale/application/provider | host/connection-local | path probe healthy; credential value not inspected | Tailscale owner |
| Existing infrastructure credential references | Brain metadata with provider/app/host material owners | provider/service/host-local | seven IKHP references catalogued; per-provider migration not yet proven | deferred, per resource |
| Brain-managed Keychain candidates | Brain, only after explicit enrollment | service/account-local | no real credential enrolled | disabled until approved human bootstrap |

The detailed non-secret inventory is in
`operations/reports/credential-custody-inventory-2026-09-07.md`. The seven
IKHP references remain in
`operations/infrastructure/catalog/access-references.v1.json`; they were not
duplicated into this catalog and no environment file was read.

## Shared/default containment

The shared/default `~/.codex` surface is represented independently as
`session:codex-default.shared` with:

- `accountId = null`;
- storage mode, effective backend, and account attribution `unknown`;
- application ownership and observe-only Brain behavior;
- no link to either dedicated account/profile;
- no use as a source for dedicated profile authentication.

The live `check:codex-auth-profiles` result remains `NOT_OK` for this surface
because storage mode and account attribution are unknown. This is an
intentional bounded deferred capability, not contamination of the dedicated
profile health result. It was not made green by inspecting auth or forcing a
login.

## Keychain and health activation

`secret-store:macos-keychain` is registered as the reference Brain-managed
adapter with namespace-bound `keychain-ref://` references, metadata read and
bounded consume only, explicit human bootstrap, and mutation disabled. The
real metadata-only smoke probe of the fixed synthetic reference returned
`credential_missing` without returning secret data. Adapter, native boundary,
enrollment, and verification tests pass.

The read-only credential-health CLI and validator pass with zero credential
evaluations because no Brain-managed credential record is admitted. This is a
safe zero-credential result, not a claim that all provider credentials work.
Session/runtime health and credential health remain separate. Wrong-account,
unknown, revoked, expired, stale, unavailable, and reauthentication-required
states remain first-class. No generic refresh, keepalive, logout switching, or
automatic rotation is active.

## WebGPT and MCP status

The owner-supported WebGPT doctor reported configuration, native Codex route,
service ownership, Responses proxy, tunnel binary/key, tunnel service, and
tunnel runtime healthy. Browser verification was blocked because the active
Codex turn was still running; connector attachment remained unknown. This is a
human/application acceptance boundary and was not bypassed by restarting or
mutating WebGPT. DEV remained stopped and separate.

The prior `codex_apps` provider-revoked incident and Stitch startup timeout
remain explicitly recorded as independent residual incidents. Neither is
collapsed into native Codex account health, and neither triggered token
inspection or reauthentication.

## Mutation authority

The canonical catalog retains `mutationEnabled=false`. This field does not
disable read-only observation; it prevents broad catalog/secret mutation.
Authority is decomposed as follows:

- Brain: non-secret catalog metadata, policy, evidence, leases, redacted
  health state, and recovery proposals;
- Codex/WebGPT/MCP/Tailscale/provider: their own application/provider
  authentication and session material;
- Keychain adapter: protected storage boundary for future approved
  Brain-managed secrets, with mutation disabled in this tranche;
- profile config materializer: owner-only non-secret dedicated profile config;
- provider or human: OAuth reauthentication, credential rotation, and
  recovery where required.

No global mutation switch was enabled.

## Validation matrix

Passing targeted gates:

- Identity & Access schema/catalog validator: pass; 2 accounts, 5 sessions, 3
  profiles, 3 runtime instances, 2 paths, 2 execution connections, 1 adapter,
  0 credential records.
- Account/runtime architecture: 40/40.
- Identity & Access: 10/10.
- Profile admission: 5/5.
- Runtime profiles/instances: 13/13.
- CLI pilot: 6/6.
- Identity handoff: 8/8.
- Infrastructure catalog: 8/8; validator pass with 22 pre-existing stale
  provenance warnings.
- Credential health: 5/5; validator pass.
- Keychain adapter: 10/10; Keychain enrollment tests pass.
- Credential verification boundary: 6/6.
- Infrastructure governance: 7/7.
- Infrastructure observation/admission: 10/10.
- Contract registry and layers: pass.
- Secret-sensitive diff scan and `git diff --check`: pass.

The live shared-default profile check is intentionally `NOT_OK` as described
above. The live WebGPT browser/connector acceptance is intentionally deferred
because the required owner interaction cannot be safely performed inside this
active Codex turn.

## Audit conclusion and next safe boundaries

The requested account-agnostic production metadata and custody foundation is
complete with the following intentional deferrals:

1. provider-stable principal attribution for the two dedicated profiles;
2. shared/default `~/.codex` attribution and backend classification;
3. real Brain-managed Keychain enrollment and replacement-machine recovery
   exercise;
4. WebGPT browser/connector/model-picker acceptance from a quiescent owner
   session;
5. MCP provider reauthentication and Stitch startup remediation;
6. per-provider migration/verification contracts for existing infrastructure
   credentials.

These are not silently converted to healthy. Any next goal involving real
credential enrollment, provider login, WebGPT owner interaction, or MCP
reauthentication must stop at that exact human/provider boundary and preserve
the current application ownership model.

## Git closeout

Final commit and remote synchronization are recorded after the final
validation commit. No force push is permitted.
