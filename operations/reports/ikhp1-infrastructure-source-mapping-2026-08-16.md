# IKHP1 Infrastructure Source Mapping Coverage — 2026-08-16

## Purpose

Document how the IKHP1 reference catalog maps existing Brain infrastructure sources without rewriting those sources or pretending that IKHP1 has already normalized all live provider state.

**Coverage rule:** `mapped` means the relevant source surface is represented by stable IKHP resource IDs/bindings. `partial` means IKHP1 records representative/current authority anchors but deliberately defers broader enumeration to later catalog expansion or IKHP2 provider normalization.

## Required source coverage

| Source | IKHP1 status | Catalog mappings | Deferred / unresolved |
|---|---|---|---|
| `operations/infrastructure/infra.md` | partial | Human entrypoint is referenced by `application:prochat-local` provenance and catalog architecture; Office/local runtime ownership remains represented through `host:office`, local app/database resources, and CLR4 reference profile. | Document's last live verification predates the current migration. Broad cloud-account/server details are not duplicated when the newer architecture/evidence register is more authoritative. |
| `operations/architecture/prochat-infrastructure-architecture.md` | partial | `host:dokploy-aws`, `host:dokploy-azure`, `host:supabase`, `tunnel:cloudflare-production`, `domain:prochat-tools`, `dns_record:prochat-tools-root`; active/planned tunnel routing; production safety policies. | Full production app/database inventory is intentionally not copied in IKHP1. Exact tunnel origin protocol remains an explicit source-level unknown. |
| `operations/architecture/prochat-infrastructure-evidence-register.md` | partial | Tailscale host addresses, `network:tailnet-infrastructure`, direct Supabase connectivity evidence, storage evidence, and provenance classifications. | Detailed app/database/schema evidence remains source evidence until dedicated catalog expansion. Historical corrected claims are not copied as competing catalog truth. |
| `operations/accounts/credentials-index.md` | partial | `provider_account:cloudflare-prochat`, `provider_account:newrelic-primary`, `provider_account:dokploy-primary`; three corresponding `credential_reference:*` resources and metadata records. | Index `Last synced` is 2026-04-19. Many additional provider credentials remain unmapped. Expiry/connectedness probes are IKHP2+ work. No credential values were copied. |
| `operations/infrastructure/local-apps.json` | partial | `application:prochat-local`, `database:prochat-local-postgres`, runtime binding, `runs_on` and `depends_on` relations. | Remaining local applications are not yet normalized to avoid an oversized first catalog slice. |
| `operations/infrastructure/scheduler-inventory.md` | partial | `scheduler:office-nightly`, `service:n8n-office`, `backup_job:n8n-backup`, `backup_system:office-nightly-maintenance`, scheduler/backup relations and binding. | Source live verification is from 2026-04-04 and is surfaced as stale provenance. Other scheduled jobs remain unmapped. |
| `operations/specs/infinite-brain-recovery-inventory.json` | partial | Linked as backup/recovery evidence for `backup_policy:n8n-office` and recovery-policy provenance. | Recovery inventory primarily covers Brain/Mind recoverability, not a complete infrastructure backup CMDB. IKHP1 does not reinterpret all entries as server assets. |
| `operations/fixtures/context-learning-deployment-profiles-v1.json` | mapped | `host:office`, `host:macbook`, Office/Brain Core runtime relation, source-neutral deployment-profile ownership. | Generic/alternate CLR4 deployment fixtures remain separate product portability evidence rather than Steve catalog assets. |
| `projects/brain-core/src/adapters/infra-new-relic.ts` | mapped | `monitor:newrelic-infrastructure`, `provider_account:newrelic-primary`, `credential_reference:newrelic-query`, Brain Core monitoring binding, planned AWS monitoring relation. | Live host/synthetic entity IDs and observations remain provider runtime state for IKHP2. |
| `projects/brain-core/src/adapters/infra-cloudflare-tunnels.ts` | mapped | `provider_account:cloudflare-prochat`, `credential_reference:cloudflare-provisioner`, `tunnel:cloudflare-production`, Brain Core tunnel-monitoring binding. | Live tunnel IDs, connector counts, hostnames, and reachability observations remain IKHP2 runtime/provider data. |
| `projects/brain-core/src/adapters/infra-dokploy.ts` | mapped | `provider_account:dokploy-primary`, `credential_reference:dokploy-management`, Brain Core management-status binding. | Live project/application/compose inventory remains IKHP2/provider observation input; no Dokploy writes are introduced. |

## Coverage summary

- Required source families represented: **11/11**.
- Fully mapped bounded adapter/profile surfaces: **4/11**.
- Partially mapped broad inventories/evidence sources: **7/11**.
- Architecture documents modified: **0**.
- Provider adapters modified: **0**.
- Raw secret values migrated: **0**.

## Explicit unresolved freshness and unknowns

IKHP1 intentionally surfaces rather than hides the following:

1. Credential metadata sourced from `operations/accounts/credentials-index.md` is stale relative to its 2026-05-19 catalog freshness deadline. This is a **warning**, not a fabricated refresh. IKHP2 credential-health verification is required to make it current.
2. Scheduler/n8n backup source verification from 2026-04-04 is stale. The initial catalog preserves that timestamp rather than claiming a new live check.
3. `backup_policy:n8n-office` has explicit unknown retention, destination normalization, restore-verification cadence, and recovery class. IKHP1 does not invent these values.
4. The exact Cloudflare tunnel origin protocol remains unknown in the current architecture evidence and is not invented in the catalog.
5. Full live Cloudflare connector/tunnel IDs, New Relic entities, Dokploy app/compose entities, and Tailscale live device state are deferred to IKHP2 read-only normalization.
6. `operations/infrastructure/infra.md` remains a human entrypoint with older verification; the 2026-08-16 architecture/evidence register is preferred for current migration facts where the two overlap.

## Conflict handling result

The IKHP1 reference catalog does not silently import corrected historical claims from the evidence register. Current resource facts use the evidence classification/authority hierarchy documented by IKHP0.

Known source corrections remain visible in `operations/architecture/prochat-infrastructure-evidence-register.md`; they are not represented as duplicate catalog resources or contradictory active relations.

The IKHP1 validator is responsible for failing on duplicate resource IDs, unresolved relation targets, duplicate relation IDs, competing canonical owners in duplicate records, contradictory duplicate relation facts, missing provenance, invalid freshness chronology, and secret-bearing credential metadata.

## Boundary

This report proves repository mapping coverage only. It does not prove live health, current provider connectivity, backup success, credential validity, OAuth connectedness, or runtime monitoring activation.
