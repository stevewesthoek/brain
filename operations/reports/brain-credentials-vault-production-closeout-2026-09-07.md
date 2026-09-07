# Brain Credentials Vault Production Closeout — 2026-09-07

## Final status

`PRODUCTION_READY_EMPTY`

The Brain Credentials Vault is production-ready, but the current authoritative
inventory contains **0 eligible Brain-owned production credentials**. No real
credential was migrated. The empty inventory is factual and intentional; no
application-owned OAuth was moved to populate the vault.

## Production contract

| Control | Final value |
| --- | --- |
| Physical Keychain | macOS user `login` Keychain |
| Namespace | `tools.prochat.brain` |
| Keychain item identity | generic-password account `credential.<opaque-id>` |
| Brain reference | `credential:<opaque-id>` → opaque `keychain-ref://...` |
| Accessibility | `WhenUnlockedThisDeviceOnly` |
| Synchronization | disabled; host-local; no iCloud distribution |
| Mutation authority | explicit operator confirmation plus native hidden input |
| Raw secret reads | unavailable as a general CLI/model capability |

The canonical I&A catalog contains zero credential records and one operational
Brain Keychain adapter. Catalog metadata never contains secret values.

## Inventory and ownership

- Eligible Brain-owned production candidates: **0**.
- Migrations completed: **0**.
- Migrated credential IDs: **none**.
- Live production Keychain item count: **0**.
- Live vault status: available, healthy 0, missing 0, unavailable 0.
- Duplicate active items: 0.
- Catalog-missing Keychain items: 0.
- Orphan Brain-namespaced items: 0.
- Retired items still present: 0.

Intentionally excluded: Codex CLI/Desktop OAuth, WebGPT browser/session state,
MCP OAuth, Stitch application authorization, Tailscale sessions, SSH
credentials, browser cookies, provider-managed sessions, and seven
infrastructure references whose underlying secret ownership/cutover/recovery
proof is not complete. Unknown ownership is not migrated.

## Operator UX and consumer resolution

The production CLI is `tools/infrastructure-identity-access/credential-vault-cli.mjs`
and is exposed as:

```bash
npm run vault -- status
npm run vault -- list
npm run vault -- inspect credential:<opaque-id>
npm run vault -- add credential:<opaque-id> --confirm
npm run vault -- update credential:<opaque-id> --confirm
npm run vault -- rotate credential:<opaque-id> --confirm
npm run vault -- verify credential:<opaque-id>
npm run vault -- retire credential:<opaque-id>
npm run vault -- delete credential:<opaque-id> --confirm
npm run vault -- doctor
```

List/inspect/status/doctor expose metadata only. Add/update/rotate use the
native hidden TTY prompt and do not accept secret/value/token/password
arguments. Verification resolves an opaque catalog reference and passes the
secret only to a registered bounded verifier. There is no `vault get-secret`.

## Health, lock behavior, rotation, deletion, recovery

Health separates Keychain availability/existence from provider verification:
healthy, missing, locked, unavailable, verification failure, wrong account,
expired, revoked, and unknown remain distinct. Locked/unavailable Keychain
behavior fails closed, returns a clear non-secret state, and has no plaintext
or environment fallback.

Rotation distinguishes replacement storage, consumer cutover, verification,
old-version retirement, and provider revocation. Local deletion removes only
the local Keychain item; it never claims provider revocation or catalog
retirement. Recovery is re-entry, provider regeneration, or approved
rotation—not secret export or plaintext backup. Keychain items remain
host-local and are not silently copied between Macs.

## Acceptance and security evidence

- Synthetic native lifecycle: create → metadata list/inspect → bounded verify
  → update/rotate → verify replacement → delete → absence proof: passed.
- Consumer acceptance: opaque reference → catalog metadata → native bounded
  verifier/use boundary, with no value returned: passed.
- Fail-closed acceptance: missing, locked/denied, unavailable, wrong-account,
  verification failure, duplicate, and orphan paths: passed.
- Native Keychain adapter: **14/14**.
- Hidden enrollment: **2/2**.
- Verification boundary: **6/6**.
- GitHub provider verifier: **13/13**.
- Vault core/CLI: **10/10**.
- Credential health: **5/5**; governance: **7/7**; observation admission:
  **10/10**.
- Identity-access and credential-health schema validators: passed.
- Live CLI `status`, `list`, and `doctor`: passed; zero-item inventory.
- Secret review: no real secret values, auth files, cookies, private keys, or
  provider tokens were read or committed; no-secret-output assertions passed.
- `git diff --check`: passed.

## Deferred hardening

Stronger signed/entitled `SecAccessControl` remains future hardening because
the unsigned helper received `errSecMissingEntitlement`. It is not required
for this production-ready-empty status. Provider-specific renewal remains
approval-gated and application-owned OAuth remains excluded.

## Documentation

- Operator runbook: `operations/runbooks/brain-credentials-vault.md`.
- Adapter contract: `operations/runbooks/infrastructure-identity-access-macos-keychain-pilot.md`.
- Strategy: `operations/specs/infinite-brain-credential-vault-strategy.md`.
- Canonical metadata: `operations/infrastructure/catalog/identity-access.v1.json`.

## Git closeout

The final productionization commit SHA and `main == origin/main` verification
are recorded with the completion evidence. No force push is used, and the
concurrent dirty checkout is preserved.
