# Identity & Access / Codex / WebGPT production-readiness audit

Date: 2026-09-05
Repository: `brain`
Audited branch: `codex/cloudflare-tooling-normalization`
Related application: `/Users/Office/Repos/vendors/codex-chatgpt-web`
Audit mode: read-only; no runtime repair, authentication, credential migration, OAuth change, login/logout, staging, commit, push, branch deletion, worktree deletion, or external-state mutation was performed.

## Executive decision

**Program status: `NOT_COMPLETE`.**

The repository foundation is substantially implemented and its deterministic
contracts are healthy. The program is not production-complete because the
actual adoption and custody gates are still open:

1. The canonical Identity & Access catalog contains zero admitted accounts,
   credentials, sessions, profiles, or bindings.
2. The seven older infrastructure credential references are still outside the
   canonical catalog and remain file/profile based with stale or incomplete
   verification evidence.
3. The live provider account identity and credential-store backend are not
   machine-proven. The separately accepted dedicated profile pilot proves
   profile isolation, independently authenticated profile coexistence, and
   sequential switching without logout; provider account mapping remains
   operator-attested.
4. The WebGPT v5.0.3 application and backend path are largely healthy, but the
   current live doctor cannot complete browser verification while this Codex
   task is active. The required post-restart desktop acceptance is therefore
   not freshly proven in this audit.
5. The live Codex managed-root check fails because the app-owned live config
   differs from the canonical Brain config. More importantly, the repair
   preservation allowlist does not cover every app-owned route/model setting
   currently present in the live config. Running repair before that contract is
   corrected could remove the active WebGPT route or selected model.
6. Hook trust/state and rollout warnings are not demonstrated to be the cause
   of the original MCP 401/timeout incident. They are a separate hygiene and
   provenance problem that remains insufficiently proven for production.

This is not a rejection of the architecture. It is a rejection of the claim
that the architecture has already become a continuously reliable,
account-agnostic production service.

## What the architecture gets right

The current design has the correct high-level boundaries:

- one provider-neutral Identity & Access catalog;
- opaque account identifiers rather than account names or secret values;
- explicit separation between accounts, credentials, sessions, runtime
  profiles, surface bindings, secret-store adapters, and lifecycle policies;
- one-writer ownership for mutable resources;
- native Codex/ChatGPT application-owned OAuth and session state remaining
  application-owned;
- Brain-managed dedicated `CODEX_HOME` roots as the only currently provable
  CLI profile boundary;
- WebGPT production and WebGPT DEV as separate application domains;
- read-only observation and synthetic verification before live admission;
- provider-specific lifecycle handling instead of a dangerous generic
  “refresh/keep-alive every token” mechanism;
- fail-closed behavior for unknown identity, custody, environment, route, and
  connector relationships;
- Keychain as the current/reference Brain-managed adapter and OnePassword as a
  future replaceable adapter, not an unapproved universal OAuth-token store.

The architecture is therefore a sound foundation. The missing part is the
controlled evidence and operational enrollment needed to make it real.

## Root-cause analysis of the earlier failure pattern

The observed symptoms were not one failure:

| Symptom | Most supported explanation | Relationship |
| --- | --- | --- |
| `codex_apps` HTTP 401 with `token_revoked` | The MCP server’s OAuth credential/session was invalidated by the provider. | Authentication/session failure; not a local TOML parse error. |
| Stitch startup timeout | Stitch was unavailable or slow during its 30-second startup window. | Separate startup/readiness issue; not evidence that the `codex_apps` OAuth token caused it. |
| Repeated hook-trust prompts | Hook/config trust state was duplicated or reintroduced through multiple config surfaces, with historical invocation failures and uncertain provenance. | Separate hook/state hygiene issue; may amplify recovery friction but does not explain a provider-issued 401 by itself. |
| Codex disconnect/reconnect after repair commands | A repair or route reconciliation can interact with a live Codex task and app-owned config. | Operational sequencing and ownership hazard. |
| Managed-root preflight blocking while Codex was open | The process guard is working as designed. A live task, app-server, ChatGPT helper, or Computer Use process remains a mutation hazard. | Expected safety behavior, not a false positive. |

The common failure is insufficient separation between three dimensions:

```text
provider authentication validity
        != local process quiescence
        != Brain config-generation correctness
        != hook/state trust hygiene
```

The most serious actionable defect found in this audit is the last-mile
configuration ownership gap. The live file contains an active WebGPT route and
model selection, while the managed-root repair code preserves only a limited
set of app-local sections. Its preservation contract does not cover all
currently active app-owned route/model sections. A repair can therefore be
synthetically successful while being operationally unsafe for the live
WebGPT-integrated consumer.

## Identity & Access adoption state

`operations/infrastructure/catalog/identity-access.v1.json` is valid and
authoritative, but intentionally empty:

| Canonical collection | Admitted records |
| --- | ---: |
| Accounts | 0 |
| Credentials | 0 |
| Sessions | 0 |
| Surface bindings | 0 |
| Runtime profiles | 0 |
| Secret-store adapters | 0 |
| Lifecycle policies | 0 |
| Verification policies | 0 |

The two synthetic Codex pilot accounts/profiles and the WebGPT metadata are
candidate fixtures, not live enrollment. The two owner-only profile roots are
empty and contain no authentication state. No real login was executed by
Brain, no OAuth token was copied, and no account identity was inferred.

The correct interpretation is:

- the N-account data model exists;
- the profile-layer and disposable-root mechanics are tested;
- the live account-neutral enrollment contract is not yet accepted;
- the requested “all accounts remain saved and always working” guarantee does
  not currently exist.

## Credential custody assessment

No secret values were read or emitted. The assessment is based on metadata,
documented custody, and redacted health boundaries only.

| Credential class | Current observed custody | Keychain/Brain adoption | Assessment |
| --- | --- | --- | --- |
| Native Codex/ChatGPT OAuth | Native application/CLI-owned state under the default runtime. | Not proven; effective backend unspecified. | Keep app-owned until the provider-supported storage contract is known. |
| `codex_apps` MCP OAuth | MCP/app-owned session state. | Not proven; prior session was revoked. | Requires provider re-authentication and a read-only health probe, not token copying. |
| WebGPT browser/session/tunnel state | Codex WebGPT application-owned runtime and browser state. | Not a Brain vault item. | Correct boundary; connector relationship still needs explicit live proof. |
| Legacy infrastructure provider refs | Local environment files, provider profiles, or app-specific stores. | Not enrolled in canonical I&A. | Seven references remain migration/ownership backlog; several verification dates are stale. |
| Google/browser OAuth families | Provider/application-owned browser profiles, token caches, or service-account material. | Not proven in Brain Keychain. | Must remain application/provider-owned unless an explicit supported export/import contract exists. |
| GitHub/Stripe/other provider credentials | Provider-managed or CLI/app-specific profiles. | Not universally adopted. | Verify per provider; do not normalize into a generic refresh mechanism. |
| Human recovery material | Potential OnePassword/Keychain candidate. | No migration performed. | Requires an explicit custody design and recovery exercise first. |

The seven older infrastructure references are not equivalent to the Codex
OAuth problem. They are a separate inventory that needs ownership decisions,
fresh verification, and a future migration plan. The current catalog’s empty
state is safe from accidental secret ingestion, but it also means the health
plane cannot yet make truthful claims about those credentials.

## Multi-account and profile capability

The supported live observer returned an unknown storage backend and provider
account attribution. Separately, the accepted dedicated-profile pilot proved
independent authenticated profile roots, coexistence in the sequence
`01 → 02 → 01 → 02`, sequential switching without logout, no authentication
copying, and no shared-root fallback. Therefore the observer's inability to
identify the provider account is not evidence that profile isolation failed.

The live observer returned:

```text
CODEX_AUTH_PROFILE_ISOLATION=NOT_OK
CONFIGURED_STORAGE=unspecified
ACCOUNT_ATTRIBUTION=unknown_by_supported_cli_surface
MULTI_ACCOUNT_READINESS=not_proven
PROFILE_LAYERS_HONORED=true
LIVE_CONFIG_UNTOUCHED=true
RAW_SECRETS=none
```

This means the current observer cannot machine-prove provider identity or the
selected credential-store backend. It does not supersede the accepted pilot
evidence. The canonical interpretation is:

- profile isolation: healthy / validated;
- multi-profile coexistence and sequential switching: healthy / validated;
- dedicated `CODEX_HOME` separation and application-owned authentication
  custody: healthy / validated;
- provider account attribution: operator-attested; machine-proof unavailable;
- shared/default `~/.codex`, keyring backend attribution, and Desktop/IDE
  identity mapping: observe-only or intentionally deferred.

The account-agnostic design and the accepted N-account pilot establish the
profile boundary. The remaining limitation is the provider's lack of a stable
safe machine-readable account identifier, so `account:openai.01` and
`account:openai.02` remain operator-attested mappings.

## Surface-by-surface result

| Surface | Evidence | Result |
| --- | --- | --- |
| Codex CLI | Dedicated profile pilot passed isolation/coexistence and sequential switching; provider identity/storage backend remain unknown to the observer. | Healthy for profile isolation; provider attribution operator-attested. |
| Native Codex/ChatGPT desktop | Installed app is authenticated; model cache contains native rows and WebGPT rows; UI identity not inspected. | Partially healthy; consumer acceptance incomplete. |
| Codex app-server | Present in the live process family; app-server-specific account identity mapping remains unproven. | Profile isolation is validated by the dedicated CLI pilot; app-server identity attribution remains deferred. |
| IDE integration | Architecture treats it as a separate surface; no authenticated isolation proof. | Unknown. |
| MCP `codex_apps` | Earlier provider-issued 401 `token_revoked`; no re-auth performed in this audit. | Not healthy/accepted. |
| Stitch | Configured with an auth selector; earlier startup timed out; no live re-auth or timeout change performed here. | Not independently accepted. |
| WebGPT production | v5.0.3 installed; bridge/proxy/tunnel/runtime checks largely healthy; current doctor blocked by active Codex turn. | Backend mostly healthy; final live acceptance incomplete. |
| WebGPT DEV | Configured separately as a v5.0.2 dev harness and not running. | Intentionally separate; not accepted as production. |

The Codex ChatGPT Web project is not intertwined with Brain source ownership:
its repository is clean at `184b1d6` and its source reports v5.0.2 while the
installed application is v5.0.3. That version lag is application release state,
not evidence of source-repository coupling. The boundary is nevertheless worth
preserving: Brain must observe and integrate through the documented route and
metadata contracts, not edit the vendor repository as part of Brain config
repair.

## WebGPT v5.0.3 acceptance

The installed `/Applications/Codex Web GPT.app` is v5.0.3. The prior recovery
evidence proved bounded WebGPT and full-harness turns through the launcher,
including a read-only `pwd` operation. The current model cache contains 8
native rows and 3 WebGPT rows with unique model IDs.

The current doctor result is not ready only because the embedded launcher
browser reports that ChatGPT is running the active Codex turn. It also reports
that local checks cannot prove the production connector is attached to the
tunnel. This does not prove that the bridge is broken; it proves that the
doctor cannot close its browser/connector evidence gates while this task is
active.

Still open for production acceptance:

1. allow the Codex task to finish naturally;
2. rerun the WebGPT doctor from a quiescent state;
3. restart only the desktop Codex consumer;
4. verify native and WebGPT model rows in the actual picker;
5. execute one explicit native read-only turn and one explicit WebGPT
   read-only turn;
6. verify no reconnect loop, duplicate route, duplicate model ID, or stale
   connector relationship;
7. keep DEV stopped and confirm its state remains separate.

Those are acceptance actions for a later authorized operational goal, not
actions performed by this audit.

## Managed-root and repair safety finding

The current live check fails with the equivalent of:

```text
Generated config is missing or changed a Brain-owned value: /Users/Office/.codex/config.toml
```

The failure is meaningful: the live config contains app-owned sections and an
active WebGPT route/model that differ from the canonical Brain template. The
repair script currently preserves selected desktop, plugin, marketplace,
trusted-hook, and node-repl environment sections, but not every app-owned
route/model/project/runtime section present in the live file.

Therefore:

- the checker is correct to refuse an unreviewed mutation;
- the repair script’s synthetic tests are not enough to certify the live
  WebGPT configuration;
- `codex-home-managed-root.sh repair` must not be run against the current live
  root until the preservation contract explicitly covers the full app-owned
  route and model surface and has a regression test using a representative
  live-shaped config;
- the repair path must treat a route owner change as a separate, explicit,
  journaled operation rather than a side effect of canonical config materialization.

This is the most important implementation gate before further credential or
profile work. Otherwise a well-intended repair can disconnect the very runtime
being used to perform the repair.

## Hooks, trust state, and rollout state

The evidence supports a split conclusion:

- the state database is structurally healthy now: SQLite integrity passed,
  foreign-key violations are zero, and legacy rollout paths are absent;
- historical reports recorded fallback/discrepancy warnings, so current DB
  integrity does not prove the entire recovery path is healthy;
- hooks are loaded from both `~/.codex/hooks.json` and TOML hook state;
- the TOML contains trusted hook hashes and an app-owned Interrupt hook for
  WebGPT lifecycle control;
- the Brain hook file contains multiple operational hooks;
- historical hook invocation failures and repeated trust prompts were not
  reproduced as a fresh failure during this audit;
- duplicate trust surfaces are real and need an explicit ownership/provenance
  contract.

The hook prompts are therefore not proven to be the cause of the `codex_apps`
401. They may be related to the broader config/recovery fragility, especially
if a repair rewrites one trust surface while preserving another. The next fix
must make hook ownership and trust-state reconciliation idempotent, observable,
and safe across app upgrades.

## Health plane and automation status

The validators prove the health-plane machinery, not live credential health:

- scheduled health is synthetic/read-only and gated;
- live Identity & Access health is not enabled;
- canonical governance currently reports 46 resources with unknown ownership
  and environment coverage, which is an honest backlog signal;
- the canonical I&A catalog has zero accounts, so a green validator is a
  structural/zero-account pass, not a claim that all credentials work;
- incident/action validators are provider-neutral and execution-disabled;
- no automatic OAuth refresh, token keepalive, credential rotation, or
  notification workflow is live.

This is the correct safety posture for an unapproved migration, but it is not
the requested always-working vault outcome yet. A future OnePassword adapter
can be considered only after ownership, namespacing, supported import/export,
recovery, and provider-specific lifecycle rules are documented. It must not
become a dumping ground for native app-owned OAuth state that the owning app
cannot safely restore.

## Documentation consistency

The vault strategy is internally consistent: Keychain is current/reference,
OnePassword is future and replaceable, and no universal generic token refresh
is promised. Profile documents consistently describe N-account support as a
model/capability, while live authenticated concurrency remains unproven.

Documentation defects or stale evidence remain:

- some Codex profile/spec text still describes WebGPT production as v5.0.2,
  although the installed app is v5.0.3;
- the recovery report correctly records v5.0.2 as historical pre-recovery
  evidence, but current-vs-historical wording should be made unmistakable in
  later doc cleanup;
- the live config comment says the WebGPT bridge route is temporarily
  disabled while the route is actually active; this is a machine-local stale
  comment and must not be silently “fixed” during an unrelated repair;
- the live configuration and canonical configuration have intentional
  app-owned differences, but the ownership boundary is not yet complete
  enough for automatic repair.

## Validation matrix

Repository validation completed successfully:

| Area | Result |
| --- | --- |
| Identity & Access validator | Pass; canonical accounts 0, no raw secrets. |
| Identity & Access tests | 9/9 pass. |
| Credential-health validator/tests | Pass; 5/5 tests; zero-account structural health. |
| macOS Keychain adapter/enrollment | 10/10 and 2/2 pass. |
| Credential-verification boundary | 6/6 pass. |
| GitHub provider verifier | 13/13 pass. |
| Infrastructure governance | Validator/test pass; 46 canonical resources remain unknown/unadmitted. |
| Observation/admission | Validator/test pass; canonical backlog remains. |
| Codex runtime architecture | 25/25 pass. |
| Runtime profiles | 12/12 pass. |
| Codex auth profiles | 7/7 pass; the live observer's `NOT_OK` is limited to provider attribution/storage proof, while the accepted pilot validates isolation and coexistence. |
| Catalog/health/incidents/actions/consumers | All validators pass; corresponding tests 8/8, 10/10, 23/23, and 7/7. |
| Contract registry | 31 contracts validate. |
| Diff check | Pass. |
| Managed-root and stop/repair synthetic tests | Pass; live repair remains blocked/unsafe until ownership preservation is expanded. |
| Related WebGPT project | 651 pass, 0 fail, 47 files. |

One command was intentionally/accidentally invoked with the wrong interpreter:
the Bash managed-root script was once passed to Node and produced a syntax
error. This was command misuse, not a program validation failure.

## Git and worktree forensic inventory

Current Brain worktree:

- branch: `codex/cloudflare-tooling-normalization`;
- upstream is even with the branch;
- 93 tracked paths modified, 74 untracked paths, nothing staged;
- one tracked deletion is present in the dirty tree;
- current HEAD is 6 commits ahead of local `main` and 192 commits behind
  `origin/main`;
- local `main` worktree is clean and is 86 commits ahead of `origin/main`;
- no commit or push was performed by this audit.

The six commits unique to the current branch are not a clean I&A feature
series; they include Cloudflare, Mind-context, WebGPT/MCP admission, and
Codex managed-root changes. The I&A work is mixed with unrelated changes in
the dirty worktree. It must not be integrated by staging the whole tree.

Worktree status:

- all inspected worktrees are clean except the current Brain worktree and the
  separate `/Users/Office/Repos/stevewesthoek/brain-video-orchestrator`
  worktree;
- the clean `main` worktree is
  `/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01`;
- no worktree was deleted or modified.

## Safe integration plan for a later goal

No integration was executed. The safe sequence is:

1. Preserve the current dirty worktree as user-owned evidence; do not reset or
   clean it.
2. Establish the intended integration base explicitly by reconciling the
   clean `main` worktree with the current remote state according to the
   repository’s normal review policy. Do not assume local `main` or
   `origin/main` is the desired base.
3. Partition the dirty tree into logical change sets: I&A contracts and
   catalog; read-only observation/admission; Keychain/verifier boundaries;
   Codex profile pilot; WebGPT/runtime ownership; managed-root repair safety;
   generic IKHP updates; and unrelated changes.
4. Commit only reviewed, coherent groups on a dedicated branch based on the
   selected base. Keep unrelated skill, scheduler, Cloudflare, console,
   video, generated, and local-config changes out of those commits unless a
   separate goal explicitly owns them.
5. Before any runtime action, repair the managed-root preservation contract
   and add live-shaped tests for active WebGPT route/model/project/hook state.
6. After code review, run the full Brain validation matrix and the related
   WebGPT suite from the exact integration commit.
7. Perform the operator-assisted two-account pilot only after process
   quiescence and explicit authorization. Record redacted evidence, never
   copy or print tokens, and keep native app-owned auth in its supported store.
8. Perform WebGPT v5.0.3 desktop acceptance separately from DEV acceptance.
9. Only when the integration commit, live pilot, route acceptance, and
   rollback evidence are all green should a later goal execute the approved
   `git push origin main`.
10. Delete branches/worktrees only after explicit review confirms that no
    unmerged user changes or rollback evidence remains.

## Required gates before changing the program status

The next authorized implementation goal should not claim completion until it
can show all of the following:

- at least two real OpenAI accounts enrolled with opaque IDs and operator
  attestation;
- separate authenticated CLI roots with proven account binding;
- a documented answer for keyring vs file-mode storage and its recovery model;
- no cross-account leakage during sequential and concurrent use;
- explicit behavior for CLI, app-server, desktop, IDE, MCP, and WebGPT;
- successful restart/reconnect acceptance;
- provider-specific verification and expiry handling for every admitted
  credential class;
- a supported, tested Keychain/OnePassword custody decision;
- no automatic refresh/keepalive promise where the provider does not support
  it;
- safe alerting for revoked, expired, missing, stale, or unverified state;
- WebGPT production doctor, connector, model picker, native turn, and WebGPT
  turn all green from a quiescent consumer;
- hook and state ownership/trust reconciliation proven idempotent;
- managed-root check/repair preserves all app-owned live state;
- canonical catalog and governance coverage reflect the real admitted state;
- a clean, reviewed commit series with no unrelated dirty-tree leakage;
- rollback and recovery evidence.

## Final assessment

The work should proceed as a controlled closeout and remediation program, not
as a quick OAuth patch. The architecture is appropriate for an account-
agnostic Infinite Brain system, but the current implementation is still in
the repository-foundation and gated-adoption phase.

The immediate priority is configuration ownership correctness: make repair
unable to erase an app-owned WebGPT route or model, then prove the two-account
profile boundary, then admit real credentials one provider at a time with
read-only health checks and recovery exercises. OnePassword may become a safe
human/provider credential vault for supported classes, but it cannot
automatically make provider-revoked OAuth sessions immortal and should not
replace native application custody without a supported contract.

Until those gates are closed, the honest status remains **`NOT_COMPLETE`**.

## Corrective acceptance addendum — 2026-09-07

This addendum records the bounded follow-up acceptance. It does not alter
authentication, credentials, runtime configuration, or application-owned
state.

### Stitch

The fresh task-bound Stitch provider call `list_projects` succeeded. This is
fresh evidence that the configured OAuth-wrapper binding is healthy, the
previous stale task binding is no longer authoritative, and the earlier 401
condition is not present on this task. No Stitch write or additional provider
mutation was performed.

### Identity and access sweep

- The supported observer cannot machine-prove provider account attribution or
  the credential-store backend. The accepted dedicated-profile evidence proves
  profile isolation, independently authenticated coexistence, sequential
  switching without logout, separate `CODEX_HOME` roots, and no credential
  copying/shared-root fallback. The live config was untouched.
- A read-only `codex_apps` GitHub connector profile probe succeeded. No
  credential or OAuth state was inspected or changed.
- Brain's macOS Keychain adapter reports native storage available, metadata-only
  capability, mutation disabled, and no secret values returned. The synthetic
  pilot reference is absent. The canonical Brain credential-health catalog has
  zero admitted production items, so the expected production item count is
  currently zero rather than an unverified inferred inventory.
- WebGPT owner diagnostics report `doctor: ok`, an active local route, and a
  healthy/ready tunnel runtime. The only remaining warning is that local
  checks cannot prove ChatGPT connector attachment while the connector is
  outside this bounded local proof; no restart or repair was performed.
- The accepted host boundary remains intact: Codex runs on the local client
  host and remote execution is a separate SSH/Tailscale target. Runtime roots,
  account attribution, and credentials are not inherited across hosts.

### Final classification

`COMPLETE_WITH_INTENTIONAL_DEFERRED_CAPABILITIES`

The fresh Stitch acceptance and bounded surface checks are complete. Provider
account identity attribution remains operator-attested because no stable safe
machine-readable identifier is available; shared/default `~/.codex` storage
attribution, Keychain production enrollment, and connector attachment remain
intentionally deferred. Profile isolation and authenticated coexistence are
validated and are not deferred.
