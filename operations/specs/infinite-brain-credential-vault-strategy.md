# Infinite Brain credential and session safety strategy

Status: design contract and staged implementation plan. This document does
not authorize credential migration, OAuth export/import, login automation,
keepalive traffic, rotation, or notification-scheduler activation.

## The architectural decision

Brain needs one account-agnostic identity and access plane, but it must not
force every secret and session into one physical store. The canonical model is
the existing Identity & Access catalog:

```text
provider/application
  ├─ opaque account
  │    ├─ expected principal
  │    ├─ credential reference(s)
  │    ├─ application-owned session(s)
    │    └─ logical runtime profile(s)
    │         └─ host-local runtime instance(s)
    ├─ access path(s) to admitted host instances
  ├─ storage adapter metadata
  ├─ read-only health evidence
  └─ recovery/approval policy
```

The account ID is a stable Brain identifier, not an email address, token hash,
filename, browser directory, or provider session ID. Multiple accounts of the
same provider are therefore ordinary catalog entries, not an exception.

The decisive rule is ownership before automation:

- Brain owns metadata, policy, evidence, incidents, leases, and recovery
  proposals.
- An application owns its application-managed OAuth/session material.
- A provider owns issuance, revocation, refresh semantics, and principal
  identity.
- macOS Keychain is the current/reference local `SecretStoreAdapter` for
  Brain-managed credential material, subject to the read-only and approval
  gates in its pilot runbook.
- OnePassword is only a possible future replaceable adapter. It is not the
  current Brain vault, an active dependency, or the intended owner of Codex,
  Desktop, IDE, browser, or MCP application sessions.

Brain-managed secret custody and application-owned runtime authentication are
separate concerns. A Brain metadata reference may point at an admitted
Brain-owned secret without making Brain the owner of an application's OAuth
state.

Host-local runtime instances are part of the access-plane topology, not a new
credential store. They reference application-owned authentication in the
owning host/profile namespace. Remote access paths (for example Tailscale or
Thunderbolt) carry operator access to an instance; they do not copy or
re-home the instance's OAuth state. This keeps multiple accounts and multiple
hosts account-agnostic while preserving application custody.

One concern has one owner. The catalog is the canonical metadata model; a
vault is not a second account registry, and a runtime lease is not an identity
registry.

## Where OnePassword fits

OnePassword may be evaluated later as a replaceable Brain secret-store
adapter for selected Brain-owned values such as API keys, service
credentials, recovery codes, and private keys. It is not recommended as the
current source of truth simply because it is a familiar vault product. Any
future adapter must expose only opaque item references and safe metadata to
Brain. It should never write secret values into Git, logs, reports, MCP
responses, model context, or the Identity & Access catalog.

OnePassword must not be treated as a universal receptacle for Codex Desktop,
Codex CLI, IDE, browser, or MCP OAuth state unless the owning application
provides a supported import/export and namespacing contract. Copying
`auth.json`, browser storage, cookies, Keychain items, or refresh tokens into a
vault would create a second owner, break revocation semantics, and risk
cross-account contamination. The current Codex work therefore keeps native
OAuth application-owned and uses dedicated CLI roots only as an adapter
boundary.

The OnePassword adapter is not active in this tranche. It should be considered
only after capability discovery, connector permission review, an explicit
namespace convention for multiple same-provider accounts, and a recovery test
on a replacement machine. No OpenBao, KeePassXC, or OnePassword dependency is
authorized by this contract.

## Credential classes and allowed lifecycle behavior

| Class | Custody | Safe health check | Renewal rule |
| --- | --- | --- | --- |
| OAuth/session | owning application/provider | supported status or minimal provider probe; expected-principal match | application-supported refresh or guided human reauthentication; no generic keepalive |
| Static API key | admitted vault/application/provider | provider-supported read-only identity/capability probe, expiry metadata | approval-gated provider rotation with overlap and rollback evidence |
| Service credential/private key | admitted vault or provider | metadata, certificate/key expiry, minimal read-only probe | provider-supported rotation only; never silently replace an active key |
| Password | vault/application | no blind login attempts; only provider-supported health signal | human or provider-supported reset; notify before known expiry |
| Recovery code | vault/application | presence and inventory metadata only | human-controlled regeneration; never test by consuming it |

“Automatically retrieve a new key” is therefore not one generic operation. It
is a provider-specific mutation that requires an approved adapter, an exact
scope, a rollback/overlap plan, and post-change verification. Expiry alerts
can be centralized; renewal cannot be assumed universal.

## Health and notification loop

The safe loop is:

```text
catalog metadata
  → bounded read-only check
  → redacted evidence + freshness deadline
  → IKHP health/incident projection
  → attention notification
  → human or explicitly approved provider recovery
  → re-check principal, capability, and ownership
```

Checks must be account-scoped. A global “Codex authenticated” or “API request
succeeded” result cannot mark every account healthy. A successful probe for the
wrong account is `wrong_account`, not healthy. Unknown, stale, revoked,
expired, insufficient-scope, and interactive-reauthentication states remain
distinct.

The existing IKHP/CLR attention and incident projections remain the one
notification surface. A vault adapter may report safe expiry metadata and
provider responses, but it must not create a parallel alert database. Cadence,
backoff, rate limits, deduplication, and missed-run materialization belong in
the existing health orchestration contract.

## Codex account switching contract

The first implementation is deliberately CLI-only:

- each opaque runtime profile resolves to a distinct deterministic `CODEX_HOME`;
- `file` storage is required for the pilot because keyring and `auto`
  namespacing are not proven;
- login is a human handoff into the selected root;
- switching means launching a new process against another root, never copying
  auth state and never using global logout/login;
- child process environment is scoped; the parent environment is unchanged;
- process leases are profile-scoped and no global kill is available;
- Desktop, WebGPT, IDE shared-cache, and MCP authorization remain separate
  application-owned surfaces;
- normal account use is blocked until expected-principal and isolation evidence
  are accepted.

The implementation is at
`tools/runtime-profile-manager.mjs`, with provider-neutral policy in
`tools/runtime-profile-manager/runtime-profile-manager-core.mjs` and Codex
mechanics in `tools/runtime-profile-manager/codex-cli-adapter.mjs`.

## Staged implementation gates

1. **Contract foundation — complete.** Existing I&A schemas represent accounts,
   credentials, sessions, runtime profiles, storage metadata, lifecycle,
   recovery, evidence, and binding provenance without secret material.
2. **CLI manager proof — complete as repository-only proof.** Synthetic tests
   cover distinct roots, owner-only permissions, human login handoff,
   child-only launch, process leases, duplicate roots, route preservation,
   account ambiguity, and MCP separation.
3. **Two-account CLI pilot — complete for the admitted Office host.** Two
   opaque records have independent authenticated CLI roots on `host:office`.
   The MacBook is admitted as a remote client only; no local MacBook OAuth is
   claimed. Do not migrate or copy existing auth state.
4. **Read-only vault inventory — next.** Admit OnePassword or another store
   only for selected Brain-owned references; test permissions, auditability,
   recovery, account namespacing, expiry metadata, and notification delivery.
5. **Provider-specific renewal — last.** Add only where the provider has a
   supported issuance/rotation API and the adapter has approval, idempotency,
   overlap, rollback, and post-change verification. OAuth refresh remains
   application-owned unless the provider explicitly documents otherwise.

No stage may silently broaden custody or skip the preceding evidence gate.

## Current conclusion

The durable solution is not “save every OAuth token forever.” It is a
provider-neutral control plane that knows which account, session, runtime
profile, credential reference, owner, lifecycle, and recovery path are in
scope; continuously verifies what can be verified; alerts on actionable
failure; and delegates renewal to the party that owns issuance. This avoids
the repeated revoked-token incident without creating a more dangerous central
copy of application authentication state.
