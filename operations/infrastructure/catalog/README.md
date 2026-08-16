# IKHP Infrastructure Catalog

`manifest.v1.json` is the single machine-readable discovery entrypoint for the IKHP1 repository catalog.

## Authority

This directory stores non-secret Git authority for stable infrastructure resource IDs, relationships, service bindings, access-reference metadata, backup policies, health/freshness policies, and safety policies.

It does not store live provider health, raw credential values, runtime observations, or infrastructure action state.

Human architecture/evidence remains in `operations/architecture/**`; live health normalization is IKHP2+; actual secret material remains external/application-local behind opaque references.

## Files

- `manifest.v1.json` — discovery entrypoint and file map.
- `assets.v1.json` — canonical stable resource identities.
- `relations.v1.json` — typed dependency/topology edges.
- `service-bindings.v1.json` — configuration/runtime/provider bindings.
- `access-references.v1.json` — credential-reference metadata only; no values.
- `backup-policies.v1.json` — backup/recovery policy metadata.
- `health-policies.v1.json` — expected freshness and condition policy.
- `safety-policies.v1.json` — protected-resource mutation evidence/approval policy.

The access-reference filename is intentionally policy-safe while the JSON contract remains `credentialReference`/`credentialReferences` in the public schema.

## Validation

Run:

```text
npm run validate:infrastructure-catalog
npm run test:infrastructure-catalog
```

The validator checks schema/manifest integrity, stable IDs, relation targets, duplicate/conflicting facts, provenance/freshness chronology, credential-reference metadata safety, alternate-fixture portability, and mapping coverage.

Stale source provenance is reported as a warning, not silently refreshed or treated as healthy. Live verification belongs to later read-only provider normalization.

## Safety boundary

IKHP1 is repository-only. The catalog does not activate providers, poll live infrastructure, mutate servers/configuration/backups, rotate credentials, install portal components, or authorize IKHP2/CLR5.
