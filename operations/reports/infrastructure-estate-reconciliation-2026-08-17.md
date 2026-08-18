# Infrastructure Estate Reconciliation — 2026-08-17 / owner refresh 2026-08-18

**Purpose:** IKHP4 Packet 1 read-only census, superseded where necessary by explicit owner evidence received on 2026-08-18 during Packet 2.

**Repository baseline:** `a84711af — feat: implement IKHP3 incidents and attention`

**Current authority rule:** this report describes the current estate. Historical Azure Dokploy / Hetzner material remains valid only as migration/history provenance in its original source documents; those systems are not current IKHP infrastructure resources.

## Evidence classifications

- **OBSERVED-VERIFIED** — direct observation or owner-supplied provider-console evidence.
- **DERIVED-VERIFIED** — deterministic conclusion from multiple verified/config sources.
- **AUTHORITATIVE-CONFIG** — repository configuration/source-of-truth artifact.
- **USER-PROPOSED** — owner statement not yet independently corroborated.
- **UNKNOWN** — current state cannot safely be established from available evidence.

## Authoritative owner refresh — 2026-08-18

The owner explicitly clarified and supplied AWS console evidence that supersedes earlier Packet 1 uncertainty:

1. **AWS `dokploy-aws` is the live authoritative Dokploy production server.**
2. **Azure PROCHAT-APPS / old Azure Dokploy is fully decommissioned and is not part of the current estate.** Historical migration documents remain provenance only.
3. **CloudPanel is active on AWS** as `cloudpanel-aws`.
4. **Hetzner is not used** and must not appear in the current IKHP estate.
5. **Azure remains applicable only through the separate PROCHAT-DATA subscription for Supabase.**
6. The generic `dokploy` SSH alias now points to the AWS Dokploy server after the owner manually updated `operations/system-configs/ssh/config`. Workbench re-read the file and verified the target/user fields by inspection; the path remains user-authored and excluded from the Packet 2 commit.

The owner-supplied AWS console screenshot on 2026-08-18 shows the two canonical AWS Lightsail instances in the same AWS console view:

| Instance | State | Location | Public IPv4 | RAM | vCPU | SSD | Class |
|---|---|---|---|---:|---:|---:|---|
| `dokploy-aws` | Running | London, Zone A | `18.135.240.168` | 16 GiB | 4 | 320 GiB | General purpose |
| `cloudpanel-aws` | Running | London, Zone A | `13.135.227.0` | 8 GiB | 2 | 160 GiB | General purpose |

Classification: **OBSERVED-VERIFIED** from owner-supplied AWS console evidence. The Dokploy Tailscale address `100.71.47.24` remains **OBSERVED-VERIFIED** from the completed migration evidence.

# 1. Current estate

## 1.1 Production / control hosts

| Resource | Current role | Provider | Current evidence | Classification |
|---|---|---|---|---|
| `host:dokploy-aws` | Authoritative Dokploy production | AWS Lightsail | Running; London Zone A; `18.135.240.168`; 16 GiB RAM; 4 vCPU; 320 GiB SSD; Tailscale `100.71.47.24` | **OBSERVED-VERIFIED** |
| `host:cloudpanel-aws` | Authoritative CloudPanel host | AWS Lightsail | Running; London Zone A; `13.135.227.0`; 8 GiB RAM; 2 vCPU; 160 GiB SSD | **OBSERVED-VERIFIED** |
| `host:supabase` | Authoritative shared Supabase/PostgreSQL data host | Azure PROCHAT-DATA | Tailscale `100.71.31.88`; private endpoint evidence `10.0.2.4:5433`; exact current Azure VM state was not re-probed in Packet 2 | **OBSERVED-VERIFIED** authority from migration evidence; volatile VM state **UNKNOWN** |
| `host:office` | Local infrastructure/control host | local macOS | Repo configuration / IKHP1 | **AUTHORITATIVE-CONFIG** |
| `host:macbook` | Local consumer/development host | local macOS | Repo configuration / IKHP1 | **AUTHORITATIVE-CONFIG** |

## 1.2 Explicitly not current infrastructure

- Azure PROCHAT-APPS / historical `vm-dokploy`: **decommissioned** by owner authority. Do not model as a current host/provider account/access target.
- Hetzner / historical CloudPanel: **not used** by owner authority. Do not model as a current host/provider account/access target.
- Historical Azure/Hetzner IPs, tunnels, backup vaults, SSH aliases and migration roles may remain in dated migration/decision evidence but must not be surfaced as current topology.

# 2. Current provider/account model

| Provider/account | Current role | Classification |
|---|---|---|
| AWS primary | Current compute provider for Dokploy and CloudPanel | **OBSERVED-VERIFIED / DERIVED-VERIFIED** from shared AWS console evidence |
| Azure PROCHAT-DATA | Current Supabase/data subscription | **AUTHORITATIVE-CONFIG** + migration authority evidence |
| Cloudflare ProChat | Public ingress / DNS provider authority | **AUTHORITATIVE-CONFIG**; volatile connector health belongs to IKHP observations |
| Tailscale | Private network dependency | **OBSERVED-VERIFIED** dated migration evidence; current device health belongs to IKHP observations |
| Dokploy management | Current management provider/account surface | **AUTHORITATIVE-CONFIG** |
| New Relic | Monitoring account/access surface | **AUTHORITATIVE-CONFIG**; current host coverage remains **UNKNOWN** until observed |

Not current:
- Azure PROCHAT-APPS — decommissioned.
- Hetzner — unused.

# 3. Current topology authority

## Dokploy

- `service:dokploy-platform` runs on `host:dokploy-aws` — **OBSERVED-VERIFIED**.
- `tunnel:cloudflare-production` routes production ingress to `host:dokploy-aws` — **OBSERVED-VERIFIED** from completed cutover evidence.
- No current catalog resource or active relation should point to old Azure Dokploy.
- Migration history preserves the Azure source role separately.

## CloudPanel

- `service:cloudpanel-platform` runs on `host:cloudpanel-aws` — **OBSERVED-VERIFIED** from owner AWS evidence plus current repository configuration.
- Exact current CloudPanel hosted-site inventory, Cloudflare connector health, backup state, and monitoring coverage were not independently live-probed in Packet 2 and remain **UNKNOWN** where applicable.
- No Hetzner current resource should exist.

## Supabase

- Supabase remains on Azure PROCHAT-DATA and remains shared authoritative data infrastructure for migration-documented dependencies.
- Azure PROCHAT-DATA remains the only current Azure infrastructure/account representation required by this reconciliation.

# 4. SSH reconciliation

Current repository configuration still contains an obsolete generic Dokploy block pointing to historical Azure Tailscale `100.83.38.48` with user `master`.

The migration cutover runbook independently documents the AWS production SSH target as user `ubuntu`, including `ubuntu@100.71.47.24` over Tailscale and `ubuntu@18.135.240.168` over public Lightsail access.

Owner-required current configuration should therefore be equivalent to:

```sshconfig
Host dokploy dokploy-aws
  HostName 100.71.47.24
  User ubuntu
  Port 22
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
  ConnectTimeout 5
```

The existing local identity is retained because the allowed cutover runbook uses `ubuntu@100.71.47.24` without an explicit `-i` override for the Tailscale path. The exact downloaded Lightsail public-key filename is intentionally not invented.

**Current SSH state:** Workbench could not write this path directly because source policy returned `PATH_NOT_ALLOWED`, but the owner manually applied the correction. Workbench then re-read the file and verified `Host dokploy dokploy-aws`, `HostName 100.71.47.24`, and `User ubuntu` by inspection. The SSH file is intentionally excluded from the Packet 2 commit because it is an owner-authored concurrent configuration change.

# 5. Backup/recovery state

## AWS Dokploy

Verified migration recovery evidence includes:
- Lightsail provider snapshots;
- 16/16 version-matched PostgreSQL logical restores;
- post-cutover snapshot evidence.

Current ongoing snapshot schedule, retention, and restore-verification cadence remain **UNKNOWN** unless separately observed.

Important invariant: provider/VM snapshot evidence is not equivalent to application-consistent database recovery evidence.

## Supabase

Supabase remains authoritative data infrastructure. Current backup cadence / restore-verification state remains **UNKNOWN** in this packet and must fail closed where backup evidence is required.

## CloudPanel AWS

Current backup mechanism, cadence, retention, and restore verification remain **UNKNOWN**.

There is no current Hetzner recovery requirement because Hetzner is not used.

# 6. Monitoring / health state

- Static health-policy definitions remain fail-closed: `unknownIsHealthy=false`.
- Current New Relic coverage for the AWS Dokploy and CloudPanel hosts was not live-probed in Packet 2; do not infer healthy coverage from historical decisions.
- Supabase host/service health remains dependent on IKHP observation evidence.
- Decommissioned Azure PROCHAT-APPS and unused Hetzner require no current health policies.

# 7. Safety-policy implications

Current protected infrastructure should include at minimum:
- AWS Dokploy production host;
- AWS CloudPanel production host;
- Supabase host;
- production/CloudPanel tunnels that remain current;
- AWS, Azure PROCHAT-DATA, Cloudflare, Tailscale, Dokploy and New Relic provider/account or access resources as applicable;
- domain/DNS resources;
- backup/recovery resources.

All Packet 2 safety policies remain fail-closed and permit only `inspect`, `diagnose`, `plan`, and `propose`. Packet 2 does **not** grant `mutate`, `delete`, or `restore` authority.

# 8. Contradictions resolved

## Dokploy authority

Resolved: AWS is current and authoritative. Azure Dokploy is decommissioned and removed from current catalog truth. Historical migration evidence remains history only.

## CloudPanel authority

Resolved: AWS `cloudpanel-aws` is current and running. Hetzner is not used and is removed from current catalog truth.

## Azure scope

Resolved: Azure is not a current Dokploy/provider estate. The separate Azure PROCHAT-DATA subscription remains current because it hosts Supabase.

## Production tunnel

Resolved: current production ingress routes to AWS Dokploy only. No current tunnel attribute/relation should reference old Azure Dokploy.

## SSH alias

Known unresolved configuration artifact: `operations/system-configs/ssh/config` still points `dokploy` to old Azure because Workbench policy blocks edits to that path. The correct target/user are documented above.

# 9. Remaining UNKNOWNs intentionally preserved

1. Exact AWS account identifier; current catalog uses a normalized non-secret `provider_account:aws-primary` abstraction.
2. CloudPanel current hosted-site inventory and per-site live status.
3. CloudPanel Cloudflare connector live health.
4. AWS Dokploy ongoing automated backup cadence and latest restore-verification status.
5. CloudPanel backup and restore-verification model.
6. Supabase ongoing backup/restore evidence.
7. Current New Relic coverage for Dokploy, Supabase and CloudPanel.
8. Current Tailscale membership/health beyond dated migration evidence.
9. Exact current Azure VM/provider entity details for Supabase where not already canonicalized.

# 10. Packet 2 canonical-change requirements

The IKHP catalog remains the single machine-readable discovery system through `operations/infrastructure/catalog/manifest.v1.json`.

Packet 2 current-state rules:

- `host:dokploy-aws` = active authoritative AWS Lightsail production.
- `host:cloudpanel-aws` = active authoritative AWS Lightsail CloudPanel runtime.
- `host:supabase` = current data host under Azure PROCHAT-DATA.
- no `host:dokploy-azure` current resource.
- no Azure PROCHAT-APPS current provider/access resource.
- no Hetzner current host/provider/access/tunnel resource.
- production Cloudflare tunnel routes only to AWS Dokploy.
- CloudPanel tunnel state may remain UNKNOWN until observed.
- backup/monitoring unknowns stay explicit.
- current resource safety remains fail-closed.

The infrastructure catalog schema remains sufficient; the Packet 2 data-only expansion uses catalog version `1.1.0` while schema version stays `1.0.0`.

# 11. Human/configuration views

- `operations/infrastructure/infra.md` should describe AWS Dokploy + AWS CloudPanel as current, Azure PROCHAT-DATA/Supabase as the only current Azure scope, and must not present Hetzner or Azure Dokploy as current.
- `operations/architecture/prochat-infrastructure-architecture.md` keeps migration procedure/history but clearly marks current-vs-historical semantics.
- `operations/accounts/credentials-index.md` contains stale descriptive location prose but Workbench blocks writes because the path is credential-sensitive. It is not current infrastructure-location authority.
- `operations/system-configs/ssh/config` requires the owner-authorized Dokploy correction described above but Workbench blocks writes to that path.

# 12. Validation expectations

Packet 2 validation must prove:

- exactly one current authoritative Dokploy runtime: AWS;
- exactly one current CloudPanel runtime: AWS;
- production tunnel has one active route to AWS Dokploy;
- no current Azure PROCHAT-APPS / old Dokploy identity;
- no current Hetzner identity;
- Azure PROCHAT-DATA/Supabase remains represented;
- every health policy has `unknownIsHealthy=false`;
- no safety policy enables `mutate`, `delete`, or `restore`;
- manifest remains the single catalog discovery entrypoint;
- no raw secrets are introduced.
