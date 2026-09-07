# Brain Credentials Vault — Production Operator Runbook

Status: `PRODUCTION_READY_EMPTY` (2026-09-07)

The Brain Credentials Vault is production-ready for Brain-owned credentials.
The current authoritative inventory contains zero eligible production
credentials, so no real credential was migrated and no application-owned
OAuth/session material was moved.

## Production contract

- Physical store: the macOS user `login` Keychain.
- Namespace: `tools.prochat.brain`.
- Keychain item: generic password, account `credential.<opaque-id>`.
- Brain reference: `credential:<opaque-id>`.
- Accessibility: `WhenUnlockedThisDeviceOnly`.
- Synchronization: disabled/device-local; no iCloud distribution.
- Mutation: explicit operator confirmation plus hidden native input.
- Raw reads: not exposed; consumers use registered bounded verifier/use
  boundaries.

The catalog stores metadata and opaque references only. It is not a secret
store and does not become writable through the general vault CLI.

## Commands

Run from the Brain repository:

```bash
npm run vault -- status
npm run vault -- list
npm run vault -- inspect credential:<opaque-id>
npm run vault -- verify credential:<opaque-id>
npm run vault -- doctor
```

`status` reports adapter availability, namespace, item count, and summary
health. `list` and `inspect` return metadata only. `doctor` reports locked or
unavailable storage, catalog-missing items, orphans, duplicates, and retired
items; it never repairs or deletes them automatically.

## Add, update, and rotate

An exact Brain-owned credential must first be admitted in the canonical I&A
catalog with an owner, consumer, verifier, rotation policy, recovery policy,
and opaque Keychain reference. Then use the native hidden prompt:

```bash
npm run vault -- add credential:<opaque-id> --confirm
npm run vault -- update credential:<opaque-id> --confirm
npm run vault -- rotate credential:<opaque-id> --confirm
```

The command never accepts `--secret`, `--token`, `--password`, or value
arguments. The native helper requires a TTY, hides input, writes directly to
Keychain, and emits only redacted metadata. Rotation stores the replacement;
consumer cutover, verification, old-version retirement, and provider
revocation remain separately evidenced operations.

## Verify and consume

`verify` resolves the opaque credential reference through the catalog and
passes the Keychain value only to the registered provider verifier over the
native boundary. The operator receives normalized health metadata, never the
value. Keychain presence is not provider health: healthy means the bounded
provider check also confirms the expected principal and applicable scope.

Consumers must use:

```text
consumer → credential:<opaque-id> → catalog metadata → SecretStoreAdapter → registered bounded operation
```

No consumer should scatter arbitrary Keychain commands or request a generic
secret getter.

## Retire and delete

```bash
npm run vault -- retire credential:<opaque-id>
npm run vault -- delete credential:<opaque-id> --confirm
```

Retirement is a metadata/provider lifecycle decision. `delete` removes only
the local Keychain copy after explicit confirmation. Local deletion does not
revoke a provider credential and does not by itself retire catalog metadata.
Unknown/orphan items are reported by `doctor` and are never automatically
deleted.

## Locked or unavailable Mac

Metadata/background probes fail closed with `secret_store_locked` or
`secret_store_unavailable` and do not prompt, fall back to plaintext, recreate
configuration values, or copy secrets to environment variables. Retry after a
supported user unlock/login recovery. Keychain item existence, provider
verification, wrong-account, expired, revoked, and unavailable states remain
distinct health outcomes.

## Recovery and multi-host behavior

Keychain items are host-local and do not automatically move to another Mac.
Recovery is operator/provider driven: re-enter the credential through the
hidden prompt, regenerate it at the provider, or rotate it and cut consumers
over. Secret export and plaintext backup are not supported. A credential may
be provisioned independently on another host only after a separate owner,
scope, recovery, and verification decision. Codex, WebGPT, MCP, browser,
Tailscale, and SSH application/host credentials remain outside this vault.

## Ownership rules

Only a proven Brain-owned secret may enter this vault. Application-owned,
provider-owned, host-owned, and unknown credentials remain in their existing
owner's custody. Brain using a credential does not make Brain its owner.

The stronger signed/entitled `SecAccessControl` helper remains future
hardening; current production protection is unlocked-session,
device-local Keychain storage plus explicit operator-gated mutation.
