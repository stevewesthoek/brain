# Codex account and runtime-profile enrollment

This runbook describes the account-agnostic, candidate-only enrollment path
for Codex and related runtime surfaces. It supports one or many accounts for a
provider without assigning meaning to the account that happens to be active.

The hierarchy is:

~~~text
provider
  → account identity
    → account policy
      → surface binding
        → runtime instance / namespace
~~~

An account identity is an opaque Brain reference. A surface binding says which
application surface represents that account. A runtime profile is a concrete
namespace for that binding, such as a dedicated CLI CODEX_HOME. A current
session never changes the preferred-account policy.

This tranche is repository-only and synthetic-tested. It does not perform
OAuth, login, logout, token refresh, token copying, Keychain reads, browser
storage reads, route writes, shared-root repair, or canonical-catalog
mutation. Official login remains a later human handoff after the architecture
and candidate evidence have been reviewed.

## Surface boundaries

The allocator is surface-aware but does not pretend that every surface has the
same isolation guarantees:

| Surface | Runtime namespace | Current posture |
| --- | --- | --- |
| codex-cli | dedicated CODEX_HOME | file-mode candidate proof only |
| codex-ide | application instance | capability evidence required |
| codex-app-server | process | observation surface; no refresh |
| codex-desktop | application instance | separate, unproven binding |
| codex-webgpt | browser/application profile | separate from native Codex |
| codex-mcp | application/browser authorization | separate MCP session |

Codex WebGPT production and development are not native Codex profiles. They
remain separately upgradeable application surfaces with their own state,
bridge, browser, route, and health evidence. This runbook does not change the
WebGPT project or its production configuration.

## Read-only preparation

From the Brain repository:

~~~bash
cd /Users/Office/Repos/stevewesthoek/brain

npm run runtime:profiles -- capabilities
npm run validate:infrastructure-identity-access
~~~

The capability command is evidence-only. unknown means “not proven”; it is not
converted to supported. The canonical catalog remains the source of truth and
is intentionally not populated by the preparation command.

To prepare a candidate from a private, stable provider reference, use an
opaque reference rather than an email address, token, cookie, or JWT:

~~~bash
npm run runtime:profiles -- prepare-account \
  --catalog operations/infrastructure/catalog/identity-access.v1.json \
  --surface codex-cli \
  --provider openai \
  --identity-ref 'opaque-ref://openai/operator-selected-01'
~~~

The result is a machine-readable proposal containing a deterministic account
ID, surface binding, and (where applicable) runtime profile. It reports
catalogMutation.performed=false, officialLogin.managerExecutes=false, and
redaction.secretsExcluded=true. The proposal must be reviewed and admitted by
a later controlled workflow; this command does not write it anywhere.

When the App Server observer has privately matched an observed account to a
known catalog account, the safe canonical ID can be supplied instead:

~~~bash
npm run runtime:profiles -- prepare-account \
  --catalog operations/infrastructure/catalog/identity-access.v1.json \
  --surface codex-app-server \
  --provider openai \
  --matched-account-id 'account:openai.primary.01'
~~~

The observer may use an email only inside a private matcher. The matcher may
return an opaque account ID and match method, never the email. If no stable
identity can be established, the result stays an unresolved candidate and
requires human confirmation.

## Dynamic CLI pilot commands

The candidate fixture is synthetic and contains a small collection for tests;
the command itself has no fixed account count. Select any N CLI profiles by
repeating --profile or by passing a comma-separated --profiles value:

~~~bash
PILOT_CATALOG="operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json"
PILOT_ROOT="${HOME}/.brain/codex-runtime-profiles"

npm run codex:cli-pilot -- plan \
  --catalog "$PILOT_CATALOG" \
  --profiles-root "$PILOT_ROOT" \
  --profiles \
    runtime_profile:openai.personal.01.cli,runtime_profile:openai.personal.02.cli \
  --output "/tmp/codex-cli-pilot-plan.json"
~~~

For a larger catalog, repeat --profile once per selected profile. Use
--all-admitted only when every enrolled CLI profile should be selected. The
plan checks exact selected roots and records the account mapping without
requiring global Codex, ChatGPT, WebGPT, Computer Use, SSH, or MCP shutdown.

The plan must return CODEX_CLI_PILOT=OK. It is metadata-only and does not
create roots, inspect auth contents, or probe global processes.

The profile manager can then create empty owner-only roots and materialize
non-secret configuration, one selected runtime profile at a time:

~~~bash
npm run runtime:profiles -- create \
  --catalog "$PILOT_CATALOG" --profiles-root "$PILOT_ROOT" \
  --profile runtime_profile:openai.personal.01.cli --execute --confirm

npm run runtime:profiles -- materialize-config \
  --catalog "$PILOT_CATALOG" --profiles-root "$PILOT_ROOT" \
  --profile runtime_profile:openai.personal.01.cli --execute --confirm
~~~

Repeat those commands for every selected profile. Creation writes only an
empty owner-only directory. Configuration writes only the profile-local
non-secret config.toml and ownership sidecar. Neither operation writes
auth.json, reads auth contents, or touches $HOME/.codex.

## Human authentication boundary

If a later Goal explicitly authorizes the real pilot, login prints a human
handoff for one selected profile:

~~~bash
npm run runtime:profiles -- login \
  --catalog "$PILOT_CATALOG" --profiles-root "$PILOT_ROOT" \
  --profile runtime_profile:openai.personal.01.cli
~~~

The operator performs the official provider login in the correct account and
visually confirms the provider identity. Brain never performs the login, copies
auth state between roots, performs a global logout, or treats a login status
signal as account attribution. The profile remains a candidate until the
identity and isolation evidence are explicitly attested or provider-verified.

## Collection acceptance and incremental enrollment

After each selected profile has independently passed its bounded check, run
collection acceptance and attest every selected profile:

~~~bash
npm run codex:cli-pilot -- acceptance \
  --catalog "$PILOT_CATALOG" \
  --profiles-root "$PILOT_ROOT" \
  --profiles runtime_profile:openai.personal.01.cli,runtime_profile:openai.personal.02.cli \
  --attest-profile runtime_profile:openai.personal.01.cli \
  --attest-profile runtime_profile:openai.personal.02.cli \
  --output "operations/reports/codex-cli-pilot-acceptance.json"
~~~

The acceptance algorithm is O(N) for a collection. When adding one new
profile, use --new-account-profile to make the intended sequence explicit:

~~~text
verify existing collection → verify new profile → recheck existing collection
~~~

That is O(N), not pairwise O(N²), and prevents an added account from silently
changing the identity or isolation result of existing profiles. Every selected
profile must have its own attestation; one current session cannot stand in for
another profile.

The acceptance report must return CODEX_CLI_PILOT=OK and prove distinct roots,
profile-scoped operation, profile isolation, forbidden shared-root mutation,
no auth copying, no route mutation, and complete profile attestation. It
remains evidence for later admission; it does not mutate the canonical
catalog.

## Controlled canonical admission

Only a successful `finalize` report can be admitted, and admission is a
separate explicit operation. First produce a read-only plan:

~~~bash
npm run codex:admit-profiles -- \
  --candidate-catalog "$PILOT_CATALOG" \
  --acceptance operations/reports/codex-cli-pilot-finalize.json \
  --catalog operations/infrastructure/catalog/identity-access.v1.json
~~~

The plan must return `READY`. It validates both catalogs and the final report,
checks every selected profile's authenticated/read-only evidence, rejects
conflicts, and derives only the selected account → surface binding → runtime
profile closure. It does not admit the legacy shared-root session, candidate
accounts that were not selected, or any credential records. Credential and
Keychain admission remains a separate Phase 3 workflow.

After reviewing the redacted plan, publish it with the explicit confirmation
gate:

~~~bash
npm run codex:admit-profiles -- \
  --candidate-catalog "$PILOT_CATALOG" \
  --acceptance operations/reports/codex-cli-pilot-finalize.json \
  --catalog operations/infrastructure/catalog/identity-access.v1.json \
  --execute --confirm
~~~

Publication is an owner-only, same-directory atomic replacement with an
owner-only backup under `~/.brain/backups/identity-access-admission/`. The
catalog remains `mutationEnabled=false`: this is metadata admission, not
permission for Brain to read, copy, refresh, or rotate application credentials.
The admission deliberately records concurrent-profile support as `unknown`
unless a future evidence workflow proves it; successful sequential isolation
must not be inflated into a concurrency claim.

## Launch proof

Only a later separately authorized pilot may execute the final launch proof.
Each launch and launch-check is keyed by one runtime profile and consumes the
successful collection acceptance report. Finalization accepts repeated
--launch-check PATH arguments and requires one successful report per selected
profile. There is no fixed pair of launch arguments and no concurrent launch
assumption.

~~~bash
npm run codex:cli-pilot -- launch \
  --catalog "$PILOT_CATALOG" --profiles-root "$PILOT_ROOT" \
  --profile runtime_profile:openai.personal.01.cli \
  --acceptance operations/reports/codex-cli-pilot-acceptance.json \
  --execute --confirm

npm run codex:cli-pilot -- launch-check \
  --catalog "$PILOT_CATALOG" --profiles-root "$PILOT_ROOT" \
  --profile runtime_profile:openai.personal.01.cli \
  --acceptance operations/reports/codex-cli-pilot-acceptance.json \
  --output operations/reports/codex-cli-pilot-launch-01.json
~~~

Repeat launch and launch-check only for profiles that the operator is
authorized to test. A successful final report still does not prove keyring
isolation, IDE shared-cache isolation, Desktop isolation, WebGPT identity, MCP
OAuth health, or concurrent authenticated execution.

## Stop conditions and recovery

Stop on NOT_OK, an unexpected target-root owner, a stale or active target
lease, an account-binding conflict, an unknown provider identity, or any
request to read or copy raw credentials. Do not solve a profile failure by
terminating unrelated processes, deleting native locks/databases, editing
SQLite, changing the shared config, or weakening permissions.

Only the exact manager-owned stale lease may be cleared through the
profile-scoped clear-stale --execute --confirm path after the recorded PID is
proven dead. That command never kills a process. The shared/default root and
WebGPT application homes require separate maintenance contracts.

Account observation is isolated from target runtime state. Codex app-server
starts in an ephemeral shadow root because startup initializes local SQLite/WAL
files. If a target file-mode `auth.json` exists, it is exposed only as an
application-consumed symlink; on macOS, `/usr/bin/sandbox-exec` denies writes
to the target root. The observer reports `targetRootMutation=false` and cleans
the shadow root after the bounded `account/read` request. It does not make the
shared/default root writable or turn authenticated status into account
attribution without private matching or human attestation.

## Related contracts

- operations/specs/infrastructure-identity-access-v1.schema.json
- operations/specs/infrastructure-codex-account-profile-capability.md
- operations/specs/infrastructure-codex-runtime-ownership-v1.md
- operations/specs/infinite-brain-credential-vault-strategy.md
- operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json
- tools/infrastructure-catalog/account-runtime-architecture.mjs
- tools/runtime-profile-manager.mjs
- tools/codex-cli-pilot.mjs
