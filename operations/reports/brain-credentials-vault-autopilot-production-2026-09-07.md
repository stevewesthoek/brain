# Brain Credentials Vault Autopilot Production Report — 2026-09-07

## Classification

`IMPLEMENTATION_READY_PENDING_LIVE_ACTIVATION`

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

## Live activation gate

Before final classification, advance the clean detached
`/Users/Office/Repos/stevewesthoek/brain-runtime` checkout to this committed
main state, verify the installed LaunchAgent points to it, run one explicit
production-safe zero-item scheduler pass, and confirm the credential-health
receipt succeeds without enabling any unrelated job.

Final classification must be either
`BRAIN_CREDENTIALS_VAULT_AUTOPILOT_READY` or
`BRAIN_CREDENTIALS_VAULT_AUTOPILOT_READY_EMPTY`; zero production items selects
the latter only after the live activation and notification acceptance gates
pass.
