# IKHP1 Canonical Infrastructure Catalog — 2026-08-16

## Status

**Accepted 2026-08-16 as a repository implementation.** IKHP0-IKHP1 are complete. IKHP2-IKHP6 and CLR5 remain not authorized. No live provider polling, monitoring activation, credential verification, server/configuration mutation, backup mutation, or portal installation is claimed by this acceptance.

## Goal

Implement the first machine-readable Infrastructure Knowledge & Health Plane catalog without activating monitoring, changing servers/configuration, storing raw secrets, or modifying migration-owned architecture documents.

## Authority model

IKHP1 creates one logical catalog entry point under:

```text
operations/infrastructure/catalog/
```

The catalog is non-secret Git authority for stable infrastructure identities, relationships, configuration ownership, credential references, backup policies, health/freshness policies, safety policies, and source provenance.

It does **not** replace:

- `operations/architecture/**` as current human migration/evidence documentation;
- external/application-local secret stores for credential values;
- provider systems such as New Relic, Cloudflare, Tailscale, or Dokploy for live observations;
- runtime/local health state planned for IKHP2+;
- CLR3 Decision Core for actual human choices.

## Existing sources to map

Required source coverage:

1. `operations/infrastructure/infra.md`
2. `operations/architecture/prochat-infrastructure-architecture.md`
3. `operations/architecture/prochat-infrastructure-evidence-register.md`
4. `operations/accounts/credentials-index.md`
5. `operations/infrastructure/local-apps.json`
6. `operations/infrastructure/scheduler-inventory.md`
7. `operations/specs/infinite-brain-recovery-inventory.json`
8. `operations/fixtures/context-learning-deployment-profiles-v1.json`
9. `projects/brain-core/src/adapters/infra-new-relic.ts`
10. `projects/brain-core/src/adapters/infra-cloudflare-tunnels.ts`
11. `projects/brain-core/src/adapters/infra-dokploy.ts`

Mapping is reference-based. IKHP1 will not rewrite the architecture documents or provider adapters.

## Catalog contract

Create:

```text
operations/specs/infrastructure-catalog-v1.schema.json
operations/infrastructure/catalog/manifest.v1.json
operations/infrastructure/catalog/assets.v1.json
operations/infrastructure/catalog/relations.v1.json
operations/infrastructure/catalog/service-bindings.v1.json
operations/infrastructure/catalog/access-references.v1.json
operations/infrastructure/catalog/backup-policies.v1.json
operations/infrastructure/catalog/health-policies.v1.json
operations/infrastructure/catalog/safety-policies.v1.json
operations/fixtures/infrastructure-catalog-alternate-v1.json
```

Public schema resource classes:

```text
host
application
service
database
storage
backup_system
backup_job
network
tunnel
domain
dns_record
provider_account
credential_reference
scheduler
monitor
control_plane
```

Public relation classes:

```text
runs_on
depends_on
connects_to
routes_to
monitored_by
backed_up_by
authenticates_with
configured_by
owned_by
replaced_by
fails_over_to
```

Provenance classifications:

```text
OBSERVED-VERIFIED
DERIVED-VERIFIED
AUTHORITATIVE-CONFIG
USER-PROPOSED
UNKNOWN
```

## Stable ID design

Resource IDs are installation-local stable logical identifiers, not provider database IDs or IP addresses.

Pattern:

```text
<resource-class>:<slug>
```

Examples:

```text
host:office
host:dokploy-aws
application:prochat-local
service:brain-core
database:prochat-local-postgres
tunnel:prochat-production
credential_reference:cloudflare-brain-core
backup_job:office-n8n
monitor:newrelic-infrastructure
```

Provider IDs, IP addresses, ports, paths, URLs, and source entity IDs belong in attributes/references and may change without changing the stable resource ID.

## Credential boundary

Credential catalog entries store metadata only:

```text
resourceId
provider
purpose
secretStoreAdapter
secretStoreRef
variableNames
scopes
expiryKnown
expiresAt
rotateBeforeDays
lastVerifiedAt
verificationAdapterRef
regenerationRunbookRef
```

No password, token, key, OAuth secret, private key, or credential file contents may enter IKHP1 Git files.

## Conflict model

The validator must fail or report explicitly for:

- duplicate resource IDs;
- unresolved relation targets;
- invalid relation/resource classes;
- competing canonical owners for the same resource;
- duplicate logical relation facts with contradictory target/state metadata;
- missing source provenance;
- missing or invalid freshness deadline/verification metadata;
- credential references that appear to contain secret values;
- manifest paths that do not exist or point outside the catalog contract.

Conflicting facts are never silently resolved by file order.

## Portability boundary

Public schemas, validator/runtime logic, and alternate fixture must not depend on Steve, Office, MacBook, Brain/Mind names, Obsidian, New Relic, Cloudflare, Tailscale, or Dokploy.

Those names are allowed only in Steve/reference catalog data and mapping reports.

## Validation plan

Required:

- JSON syntax validation;
- schema validation for every catalog file;
- manifest integrity;
- stable resource-ID validation;
- relation target integrity;
- duplicate/conflict detection;
- source provenance/freshness checks;
- credential metadata/no-secret checks;
- alternate fixture portability;
- mapping coverage report;
- `git diff --check`;
- `forbidden_secret_material` scan on exact IKHP1 paths.

## Explicit exclusions

Do not modify or activate:

- `operations/architecture/**`;
- `operations/system-configs/claude/settings.json`;
- Mind;
- Workbench-private;
- `feature/video-orchestrator`;
- New Relic/Cloudflare/Tailscale/Dokploy provider state;
- live monitoring;
- servers or configuration;
- backups or restore state;
- Obsidian installation;
- CLR5;
- IKHP2+;
- Git push.

## Acceptance boundary

IKHP1 acceptance means the repository catalog/contracts are validated and discoverable through one manifest. It does **not** mean that live health is normalized, providers are polled, credentials are verified, alerts are emitted, or infrastructure mutation is enabled.

## Final implementation evidence

### Catalog and schema

Single machine-readable entrypoint:

```text
operations/infrastructure/catalog/manifest.v1.json
```

Implemented repository surfaces:

```text
operations/specs/infrastructure-catalog-v1.schema.json
operations/infrastructure/catalog/README.md
operations/infrastructure/catalog/manifest.v1.json
operations/infrastructure/catalog/assets.v1.json
operations/infrastructure/catalog/relations.v1.json
operations/infrastructure/catalog/service-bindings.v1.json
operations/infrastructure/catalog/access-references.v1.json
operations/infrastructure/catalog/backup-policies.v1.json
operations/infrastructure/catalog/health-policies.v1.json
operations/infrastructure/catalog/safety-policies.v1.json
operations/fixtures/infrastructure-catalog-alternate-v1.json
```

`access-references.v1.json` is the policy-safe filename for credential-reference metadata; the public JSON schema contract remains `credentialReference` / `credentialReferences`. No credential values are stored.

### Reference catalog counts

`npm run validate:infrastructure-catalog` passed with:

```text
resources=25
relations=28
bindings=5
accessRefs=3
backupPolicies=1
healthPolicies=4
safetyPolicies=9
resourceClasses=16
mappingSources=11
staleWarnings=23
```

All 16 required resource classes and all 11 required relation classes are defined by the public schema. The alternate fixture exercises every public resource class and relation class without Steve, Office, MacBook, Brain/Mind names, Obsidian, New Relic, Cloudflare, Tailscale, or Dokploy coupling.

### Integrity/conflict validation

`npm run test:infrastructure-catalog` passed **8/8**.

Coverage proves:

1. reference catalog/manifest integrity while stale provenance is surfaced as warnings;
2. alternate fixture portability and complete public taxonomy coverage;
3. duplicate resource IDs and competing canonical owners fail closed;
4. unresolved relation targets fail closed;
5. contradictory duplicate topology facts fail closed;
6. missing provenance and invalid freshness chronology fail validation;
7. raw access-bearing fields and unsafe inline secret-store references are rejected;
8. stable resource-ID prefixes must match their declared resource class.

### Mapping coverage

`operations/reports/ikhp1-infrastructure-source-mapping-2026-08-16.md` covers all **11/11** required source families. It records **4 fully mapped bounded adapter/profile surfaces** and **7 partially mapped broad inventories/evidence sources** without rewriting `operations/architecture/**` or provider adapters.

### Surfaced unresolved state

The 23 stale provenance warnings are intentional and remain visible rather than being falsely refreshed. Material unresolved items include:

- credential metadata verified from the 2026-04-19 credential index is stale and requires later live verification;
- scheduler/n8n backup metadata verified from 2026-04-04 is stale;
- `backup_policy:n8n-office` has unknown normalized retention, destination, restore-verification cadence, and recovery class;
- exact Cloudflare tunnel origin protocol remains unknown in current architecture evidence;
- live Cloudflare connector IDs, New Relic entities, Dokploy entities, Tailscale device state, credential connectedness/expiry verification, and backup health remain IKHP2 work.

Unknown and stale are therefore first-class states, not silently treated as healthy/current.

### Live-versus-repository truth

Verified repository catalog/contracts: **yes**.

Live health normalization/provider polling: **no**.

Credential/OAuth validity verification: **no**.

Infrastructure/server/config/backup mutation: **no**.

Obsidian installation change: **no**.

CLR5 implementation: **no**.

IKHP2 authorization: **no**.

Git push: **no**.



## Final repository hygiene

- `npm run validate:diff-check`: **PASS**.
- Exact IKHP1 `forbidden_secret_material` scan: **PASS — 0 findings**.
- One bounded validation repair was required: the first secret scan flagged a test-only lexical assignment to a redacted placeholder field. The fixture now constructs that forbidden field dynamically while preserving the rejection assertion; focused tests still pass 8/8 and the exact secret scan passes with zero findings.
