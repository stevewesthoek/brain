# IKHP Identity & Access — Brain Keychain production-readiness audit

## Decision

**Audit classification: `COMPLETE_WITH_INTENTIONAL_DEFERRED_CAPABILITIES`**

The Brain-owned macOS Keychain adapter is operational and validated for
production use when a credential has passed the custody and enrollment gates.
No real production credential is currently eligible for migration. That is a
valid zero-candidate result, not a reason to create a synthetic production
record. The synthetic acceptance credential is ephemeral and is removed after
testing.

## Canonical store and namespace

| Control | Production decision |
| --- | --- |
| Physical store | User's macOS `login` Keychain |
| Logical namespace | `tools.prochat.brain` |
| Item class | Generic password |
| Reference | `keychain-ref://<service>/<opaque-account>` |
| Host scope | Host-local |
| Synchronization | Explicitly disabled; no automatic iCloud Keychain distribution |
| Accessibility | `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` |
| Mutation | Approval-gated create/update/delete |
| Raw read | Not exposed; authorized read is bounded verifier stdin delivery |
| Inventory | Metadata-only; never requests secret data |

A separate physical Brain keychain is documented as an optional future
deployment mode, not the default security boundary.

## Security boundary

Secret input is accepted only in memory and sent to the native
Security.framework helper over stdin for create/update. The helper emits only
allowlisted redacted metadata. Authorized verification reads the Keychain item
inside the native boundary and sends it only to an explicitly registered
verifier over stdin; the parent receives normalized metadata only.

No secret crosses command-line arguments, environment variables, stdout,
stderr, logs, Git, LLM context, reports, or plaintext temporary files. Apple's
`security` CLI and `-w <secret>` are not used. The native process group is
bounded and killed on timeout; in-memory zeroization remains best effort.

Items are non-synchronizing and available only while the user Keychain is
unlocked. Metadata/background probes use `kSecUseAuthenticationUIFail`.
Locked/denied access fails closed and is reported as
`secret_store_locked`; unavailable storage is reported as
`secret_store_unavailable`. Neither condition falls back to plaintext or
application-owned storage.

## Candidate and migration audit

- Production Brain-owned candidates: **0 eligible**.
- Synthetic candidates: **1 ephemeral fixture**, used only for acceptance and
  deleted afterward.
- Migrated production credential IDs: **none**.
- Codex OAuth, Codex Desktop OAuth, WebGPT browser/session state, MCP OAuth,
  Tailscale sessions, SSH keys, browser cookies, and provider-managed sessions:
  **intentionally excluded**.
- Seven existing infrastructure references: metadata remains in the existing
  catalog; underlying ownership, consumers, rotation, recovery, and cutover
  evidence are not uniform, so they remain `unknown` and are not migrated.

The complete matrix is in
`operations/reports/credential-custody-inventory-2026-09-07-keychain-operationalization.md`.

## Adapter behavior

The adapter exposes:

- `describe()` with physical store, namespace, host scope, synchronization,
  accessibility, and access-control metadata;
- `inspectReference()` for redacted existence and storage state;
- `inspectNamespace()` for redacted namespace inventory;
- approval-gated `create()`, `update(), and `delete()`;
- `read()` only as the existing registered-verifier bounded-consume boundary.

Duplicate creation is rejected. Keychain labels are presentation metadata;
the opaque credential ID/reference is the stable lookup identity. Version,
active-version, replacement, retirement, creation, verification, rotation,
and recovery metadata are represented by the credential schema for future
enrollment. Provider rotation is not automatic.

Deleting a local Keychain item is distinct from provider revocation and catalog
retirement. The adapter never claims provider revocation from local deletion.

## Health and operations

Credential health distinguishes healthy, missing, locked, unavailable,
verification failure, wrong account, expired, revoked, and unknown states.
Keychain existence alone never marks provider authentication healthy.
Provider-specific read-only verifiers remain responsible for principal and
scope checks. The existing IKHP incident/attention projection remains the
single notification surface.

The live canonical catalog contains zero Brain-managed credential records, so
the health CLI's zero-evaluation result is expected. The adapter and health
pipeline are ready for a reviewed future credential without changing
application-owned OAuth.

## Validation evidence

- JavaScript adapter suite: 14/14 passed.
- Native macOS synthetic lifecycle: create → metadata lookup → existence
  check → bounded verification → update → delete → absence proof: passed.
- Enrollment, verification boundary, GitHub verifier, credential health,
  Identity & Access, governance, observation, catalog, registry, and layer
  validations: passed.
- Locked/denied and unavailable fail-closed tests: passed.
- Secret-sensitive source/diff review and `git diff --check`: passed.
- No production Keychain item, OAuth state, auth file, browser state, or
  provider credential was read or modified.

## Deferred boundaries

1. Real Brain-owned enrollment requires a reviewed owner/consumer/rotation/
   recovery contract and an exact human-gated secret input boundary.
2. Replacement-machine Keychain restoration and entitlement evidence remain
   unproven.
3. Provider-specific renewal/rotation remains approval-gated and is not
   generic or automatic.
4. Application-owned Codex, WebGPT, MCP, Tailscale, and SSH credentials
   remain outside Brain custody.

## Git closeout

This work is committed with the intent
`feat(identity): operationalize Brain Keychain secret storage`, pushed to
canonical `main`, and verified with local `main == origin/main` and a clean
worktree. No force push was used.
