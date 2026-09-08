# IKHP Infrastructure Catalog

`manifest.v1.json` is the single machine-readable discovery entrypoint for the IKHP1 repository catalog.

## Authority

This directory stores non-secret Git authority for stable infrastructure resource IDs, relationships, service bindings, access-reference metadata, backup policies, health/freshness policies, and safety policies.

It does not store live provider health, raw credential values, runtime observations, or infrastructure action state.

Human architecture/evidence remains in `operations/architecture/**`; live health normalization is IKHP2+; actual secret material remains external/application-local behind opaque references.

The Identity & Access extension has its own provider-neutral contract and catalog:

- `operations/specs/infrastructure-identity-access-v1.schema.json` — account, credential, session, runtime-profile, secret-store-adapter, lifecycle, and read-only verification contract.
- `identity-access.v1.json` — canonical non-secret enrollment catalog. It is intentionally empty until a later approved metadata-only enrollment tranche.
- `operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json` — temporary, non-canonical candidate input for the operator-assisted two-account CLI pilot; it is not a second identity registry.

This extension distinguishes account identity, credential evidence, application-managed sessions, and runtime profiles. It does not extract OAuth state, migrate credentials, or make any vault product canonical.

The same catalog contract now has an optional governance extension for runtime
ownership and onboarding. It records admission state, authoritative owner,
state custody, configuration/route writers, environment and isolation,
identity/runtime-profile bindings, dependencies, health/recovery coverage,
quiescence, lifecycle risk, and one/many-account capacity. It does not create a
second catalog. Automatic discovery can create candidates and evidence only;
the admission planner remains read-only until ownership and safety evidence are
resolved.

The generic live observation contract extends this boundary without adding a
second plane:

- `operations/specs/infrastructure-observation-v1.schema.json` — normalized
  runtime/relationship/health evidence with freshness and redaction;
- `operations/specs/infrastructure-candidate-v1.schema.json` — candidates,
  pure admission plans, and bounded onboarding backlog;
- `tools/infrastructure-catalog/observation-core.mjs` — shared observer seam;
- `tools/infrastructure-catalog/local-runtime-observer.mjs` — generic local
  process/listener metadata observer;
- `tools/infrastructure-catalog/codex-runtime-adapter.mjs` — product-specific
  proof adapter, not canonical Brain identity.

Observers are report-only: `discover()` creates candidates, `observe()` returns
evidence, and `verifyRelationship()` tests a claimed link. No observer writes
the catalog or imports application OAuth. The canonical backlog currently
contains 46 governance-unknown resources and is intentionally not hidden by
live observations.

The first local secret-store implementation is the read-only macOS Keychain
pilot. Its bounded-consumption capability is usable only by the registered
verification boundary; it is documented separately and does not enroll or
migrate the current Codex/application authentication state.

The CLI-only Codex runtime-profile manager is an adapter over this Identity &
Access catalog, not another registry. It stores no account list or OAuth
material. Its profile-scoped process lease is ephemeral lifecycle evidence;
the application remains the owner of authentication state. See
`tools/runtime-profile-manager.mjs` and
`operations/specs/infinite-brain-credential-vault-strategy.md`.

## Files

- `manifest.v1.json` — discovery entrypoint and file map.
- `assets.v1.json` — canonical stable resource identities.
- `relations.v1.json` — typed dependency/topology edges.
- `service-bindings.v1.json` — configuration/runtime/provider bindings.
- `access-references.v1.json` — credential-reference metadata only; no values.
- `backup-policies.v1.json` — backup/recovery policy metadata.
- `health-policies.v1.json` — expected freshness and condition policy.
- `safety-policies.v1.json` — protected-resource mutation evidence/approval policy.
- `identity-access.v1.json` — provider-neutral identity/access enrollment metadata; no current credentials are imported in the foundation tranche.

The access-reference filename is intentionally policy-safe while the JSON contract remains `credentialReference`/`credentialReferences` in the public schema.

## Validation

Run:

```text
npm run validate:infrastructure-catalog
npm run test:infrastructure-catalog
```

The validator checks schema/manifest integrity, stable IDs, relation targets, duplicate/conflicting facts, provenance/freshness chronology, credential-reference metadata safety, alternate-fixture portability, and mapping coverage.

Run the ownership/onboarding coverage check with:

```text
npm run validate:infrastructure-governance
npm run test:infrastructure-governance
npm run validate:infrastructure-observation-admission
npm run test:infrastructure-observation-admission
```

This reports unknown ownership, unowned routes, missing health/recovery,
multiple writers, dependency/isolation collisions, unresolved identity
bindings, and quiescence gaps without printing secret material. The Codex Web
GPT fixture is metadata-only proof of the adapter mapping; it is not a live
integration or an authority source. A future OnePassword adapter, if approved,
would be replaceable custody infrastructure rather than the Brain default.

Use the live, read-only observer when current runtime evidence is needed:

```text
node tools/observe-infrastructure.mjs
```

It emits allowlisted metadata only. A healthy probe does not prove account
identity, connector attachment, application OAuth custody, or multi-account
profile preservation; those require supported account/profile evidence.

Stale source provenance is reported as a warning, not silently refreshed or treated as healthy. Live verification belongs to later read-only provider normalization.

## Safety boundary

IKHP1 is repository-only. The catalog does not activate providers, poll live infrastructure, mutate servers/configuration/backups, rotate credentials, install portal components, or authorize IKHP2/CLR5.
