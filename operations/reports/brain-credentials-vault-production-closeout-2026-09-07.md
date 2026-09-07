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

## Final live production verification — 2026-09-07

| Required outcome | Result | Evidence |
| --- | --- | --- |
| COMMITTED? | yes | Vault productionization is an ancestor; final autopilot commit `8f8d6c8d7a1eb8929a7dbdc2329407ebb73a8c51` is on `main`. |
| PUSHED? | yes | Final `origin/main` resolves to `b34b23215187f9ec7c9de624f21b1357f211691b`; executable autopilot commit `8f8d6c8d` is its ancestor; no force push was used. |
| DOCUMENTED? | yes | This closeout, the autopilot production report, operator runbook, strategy, adapter contract, and canonical catalog are present. |
| OPERATOR AVAILABLE? | yes | `npm run vault -- status|list|inspect|verify|add|update|rotate|retire|delete|doctor`. |
| ACTIVATED? | yes | The clean detached `brain-runtime` checkout runs `8f8d6c8d`; the existing 03:00 LaunchAgent executed the credential-health job successfully; no separate vault daemon is required. |
| OPERATIONAL? | yes | Live `status`, `list`, `doctor`, Keychain inventory, autopilot, and scheduler receipt checks passed. |
| AUTOMATIC READ-ONLY HEALTH? | yes | The provider-neutral health orchestrator automatically evaluates admitted catalog credentials through the fixed Keychain adapter and bounded verifier; the current empty catalog correctly produced zero evaluations. |
| AUTOMATIC BOUNDED CONSUMER USE? | yes | Opaque catalog references resolve only through the registered verification boundary; no general raw-secret read exists. |
| HUMAN-GATED SECRET MUTATION? | yes | Add, update, rotate, and delete require explicit confirmation and native hidden TTY input where applicable. |
| PRODUCTION ITEM COUNT? | 0 | Live Keychain inventory and canonical catalog both report zero. |
| SECURITY CLEAN? | yes | No real secrets were enrolled, migrated, printed, or committed; targeted secret scans and no-secret-output assertions passed. |

Automatic by design: metadata inventory, catalog reconciliation, health evaluation,
incident projection, opaque-reference resolution, and the bounded registered
provider verification path. Human-gated by design: secret entry, overwrite,
rotation, local deletion, provider cutover, provider revocation, and catalog
retirement. The vault activation model is on-demand through the Brain runtime;
the existing credential-health contract is read-only and does not mutate or
export credentials.

Final canonical `main` HEAD: `b34b23215187f9ec7c9de624f21b1357f211691b`.

## Deferred hardening

Stronger signed/entitled `SecAccessControl` remains future hardening because
the unsigned helper received `errSecMissingEntitlement`. It is not required
for this production-ready-empty status. Provider-specific renewal remains
approval-gated and application-owned OAuth remains excluded.

## Documentation

- Operator runbook: `operations/runbooks/brain-credentials-vault.md`.
- Autopilot production report: `operations/reports/brain-credentials-vault-autopilot-production-2026-09-07.md`.
- Adapter contract: `operations/runbooks/infrastructure-identity-access-macos-keychain-pilot.md`.
- Strategy: `operations/specs/infinite-brain-credential-vault-strategy.md`.
- Canonical metadata: `operations/infrastructure/catalog/identity-access.v1.json`.

The vault's continuous-operation contract is the existing Brain Scheduler
credential-health job. It performs metadata-only discovery, bounded read-only
health/expiry evaluation, stable incident projection, and deduplicated
notification planning. Secret entry, provider consent, destructive authority,
and unsupported rotation remain human-gated. See the autopilot report for the
live activation receipt and synthetic notification acceptance.

## Git closeout

The final productionization commit SHA and `main == origin/main` verification
are recorded with the completion evidence. No force push is used, and the
concurrent dirty checkout is preserved.
