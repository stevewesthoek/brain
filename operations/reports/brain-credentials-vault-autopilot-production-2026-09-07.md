# Brain Credentials Vault Autopilot Production Report — 2026-09-07

## Classification

`BRAIN_CREDENTIALS_VAULT_AUTOPILOT_READY_EMPTY`

The accepted vault remains `PRODUCTION_READY_EMPTY`: the live Brain catalog and
macOS Keychain contain zero legitimate Brain-owned production credentials. This
report covers the black-box automation required to operate safely when such
credentials are admitted; it does not manufacture or migrate a real secret.

## Service contract

```text
discover -> classify -> admit -> store -> monitor -> verify -> warn
         -> rotate/recover -> retire
```

The production entrypoint is
`tools/infrastructure-identity-access/credential-health-autopilot.mjs`.
It composes the existing catalog, Keychain adapter, bounded provider verifier,
credential health evaluator, IKHP incident projector, and attention dispatcher.
It writes only redacted metadata under `runtime/local/infrastructure/`.

Automatic:

- approved catalog/contract reference discovery and evidence-backed ownership
  classification;
- Brain-owned metadata candidates, Keychain/item availability, bounded
  provider verification, expiry windows, incident lifecycle, deduplication,
  recovery verification, and notification planning;
- provider-managed rotation only after replacement, consumer, rollback, and
  retirement policy gates pass.

Human-only:

- hidden native entry when safe transfer is impossible;
- provider login/consent, OS unlock/security boundaries, unsupported provider
  regeneration, destructive deletion/revocation, and catalog retirement.

Unknown credentials and application-owned OAuth remain outside the vault.

## Scheduler and activation

The existing canonical typed scheduler admits exactly one credential-sensitive
exception: `credential-health-autopilot`. It is `active`, `report-only`,
`networkAccess=read-only`, `destructive=false`, `mindWrite=false`, and must
declare `readOnlyCredentialObservation=true`. It runs through the existing
`com.office.nightly-scheduler` LaunchAgent at 03:00 Europe/Lisbon. No second
scheduler or standalone vault daemon is introduced.

The job's declared artifacts are the autopilot snapshot, credential-health
state, incident state, and notification cursor. Scheduler receipts remain
separate and are bounded/redacted by the existing runner.

## Expiry, incidents, and notifications

Expiry is evidence-only: provider/catalog metadata supplies `expiresAt` and
provenance. The autopilot records `normal`, `renewal_window`, `urgent`,
`expired`, or `unknown`, plus last and next verification metadata. It never
invents dates.

The existing IKHP incident engine provides stable fingerprints and transitions
(`opened`, `continued`, `reopened`, `recovered`). The existing notification
cursor deduplicates transitions and rate-limits immediate alerts. The existing
macOS notification dispatcher is the supported operator surface. Healthy
checks produce no notification; all notification payloads contain metadata
only.

## Rotation and recovery

`credential-rotation-core.mjs` enforces the transaction:

```text
create replacement -> store -> verify -> cut over consumers
-> verify consumers -> retire old -> revoke if supported -> final health
```

Consumer verification failure rolls back the cutover and deletes the
replacement where possible; the old credential is not retired first.
Application-owned/provider-owned credentials never auto-rotate. Approval-gated
provider flows return a human-required disposition.

## Multi-host and consumer neutrality

Canonical host IDs are `host:office` (Office Mac mini authority host) and
`host:macbook` (MacBook consumer host), taken from the infrastructure asset
catalog. Secret bytes remain host-local. Central metadata tracks required,
provisioned, healthy, missing, and last-verified host state; offline/locked
hosts are unavailable or stale, never falsely revoked.

Consumers use `credential:<opaque-id>` through the provider-neutral resolver
and bounded verification boundary. Synthetic acceptance covers equivalent
consumer resolution for two provider classes. Codex, WebGPT, MCP OAuth, and
other application-owned sessions remain application-owned and are observed
only through redacted metadata/recovery state.

## Validation evidence

- Autopilot core, host, expiry, resolver, and rotation tests: **10/10**.
- Credential health lifecycle, expiry, outage/backoff, incident deduplication,
  recovery, and no-secret runtime tests: **5/5**.
- Vault core/CLI tests: **10/10**.
- Scheduler runner, registry, and documentation tests: **18/18** plus
  documentation validator pass.
- Live canonical zero-item autopilot run: passed; 0 Brain-managed items,
  0 health evaluations, 0 incidents, 2 canonical macOS hosts observed, and
  5 application-owned auth sessions observed.
- No secret values are accepted through scheduler args, environment, reports,
  notifications, or model context.

## Live activation evidence

The clean detached `/Users/Office/Repos/stevewesthoek/brain-runtime` checkout
was advanced to `aaafcdc650ea916f2b1215b537f55a404b0ffab7`, the pushed `main`
commit. The installed `com.office.nightly-scheduler` LaunchAgent points to
that checkout, remains configured for 03:00 Europe/Lisbon, and has no second
credential scheduler.

An explicit production-safe acceptance pass ran with trigger
`credential-autopilot-acceptance`:

- scheduler result: `success`, registry job count 17;
- executed active jobs: exactly the five admitted active jobs, including
  `credential-health-autopilot`;
- failed jobs: none; blocked/disabled jobs: none executed;
- credential-health receipt: `success`, exit code 0;
- discovery: 0 Brain-managed, 7 unknown metadata candidates, no auto-migration;
- health: 0 evaluations, 0 incidents, 0 notification attempts because the
  healthy zero-item state is intentionally quiet;
- hosts observed: canonical `host:office` and `host:macbook`;
- application-owned auth observations: 5;
- persisted autopilot, health, incident, and notification state: mode 0600,
  all `containsSecrets=false`.

Synthetic notification acceptance is covered by the existing production-path
health harness: a wrong-account incident opens, emits exactly one bounded
attention item, repeated evaluation deduplicates it, and recovery emits one
recovery item. The harness uses an injected test sender and never sends an
external notification or includes secret material.

The canonical main worktree was clean after the activation commit and the
concurrent dirty checkout remained untouched.

Final classification must be either
`BRAIN_CREDENTIALS_VAULT_AUTOPILOT_READY` or
`BRAIN_CREDENTIALS_VAULT_AUTOPILOT_READY_EMPTY`; zero production items selects
the latter because the live activation, zero-item, and synthetic notification
acceptance gates passed.
