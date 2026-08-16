# Azure → AWS Lightsail Dokploy Migration — Execution Runbook

**Version:** 7 (Phase 3A — production state captured + staged on AWS, 2026-08-16)
**Status:** ✅ PHASE 3A COMPLETE — all production state captured and staged, not activated
**Azure state:** READ-ONLY — no mutations performed, still authoritative production
**AWS state:** STAGED — production data in staging directory, NOT in active runtime paths

---

## PHASE GATE OVERVIEW

```
PHASE 0 — Pre-provisioning               STATUS: ✅ COMPLETE (2026-08-16)
PHASE 1 — Provisioning                  STATUS: ✅ COMPLETE — instance dokploy-aws validated (2026-08-16)
PHASE 2A — Backup + Empty Platform      STATUS: ✅ COMPLETE — auto-snapshot + 4 services + reboot validated (2026-08-16)
PHASE 3A — Production State Capture     STATUS: ✅ COMPLETE — 16 DBs + all non-DB state staged (2026-08-16)
PHASE 3B — Shadow Restore + Validation  GATE: Phase 3A passes, side-effect audit complete
PHASE 3 — Data Import & Shadow Test    GATE: Phase 2 passes, source DBs still live
PHASE 4 — Cutover                       GATE: Phase 3 shadow test passes, maintenance window open
PHASE 5 — Post-cutover stabilization   GATE: All domains verified healthy
PHASE 6 — Azure deallocation           GATE: Phase 5 stable for 2+ hours, manual snapshot taken
PHASE 7 — Azure cleanup                GATE: Phase 6 stable 7+ days
```

Each phase requires explicit human approval before advancing. Failure at any phase triggers the phase-specific abort/rollback defined in Section 11-P.

---

## AUTHORITATIVE-DATA RULE

> **Once cloudflared starts on Lightsail (Phase 4, Step 9), the Lightsail databases become the sole authoritative source for all application data. Azure databases are immediately stale. Any rollback to Azure after this point requires reconciliation. Rolling back without reconciliation will cause data loss.**

This rule is unconditional. It is enforced by design: cloudflared cannot run with the same production token on both hosts simultaneously without Cloudflare load-balancing traffic to both.

---

## AZURE READ-ONLY BOUNDARY

### Permitted at any phase before cutover approval

| Operation | Method | Notes |
|-----------|--------|-------|
| Read files | `cat`, `ls`, `stat`, `sha256sum` | No writes |
| Query system state | `systemctl status`, `docker ps`, `df`, `lsblk` | No mutations |
| Query databases | `psql -c SELECT ...`, `pg_dump`, `pg_restore --list` | Read/dump only |
| Hash/inspect files | `sha256sum`, `openssl x509 -noout` | No writes |
| Copy FROM Azure | `scp`, `rsync` FROM Azure | Source only, no writes to Azure |
| Azure CLI reads | `az vm show`, `az disk list` | No mutations |
| Azure Run Command | Read-only shell commands | No writes to filesystem, DB, config, or services |

### Prohibited until Phase 4 cutover approval

- Modifying any file on the Azure VM
- Restarting, stopping, or reconfiguring any service (Docker, Traefik, Dokploy, cloudflared, Tailscale, New Relic)
- Modifying Docker containers, images, volumes, networks, or Swarm state
- Modifying databases (no INSERT, UPDATE, DELETE, ALTER, DROP)
- Modifying Azure cloud resources (disks, networking, firewall, VM size)
- Running `resize2fs`, `mkfs`, or any filesystem modification
- Modifying Cloudflare or DNS records

---

## REMAINING BLOCKERS — HARD STOP

**VERDICT: READY FOR PROVISIONING**

No blockers remain. Target region changed to eu-west-2 (London) — all checks API-verified 2026-08-16.

### ✅ RESOLVED — BLOCKER 1 — `lightsail:GetBlueprints` permission

**Resolved:** `lightsail:GetBlueprints` permission granted (2026-08-15).

Blueprint confirmed via API (eu-west-1, applies globally):

| Field | Verified Value |
|-------|---------------|
| blueprintId | **`ubuntu_24_04`** |
| name | Ubuntu |
| version | 24.04 LTS |
| versionCode | 1 |
| platform | LINUX_UNIX |
| type | os |
| isActive | **True** |
| minPower | 0 (compatible with all bundles including xlarge_3_0) |
| group | ubuntu_24 |

**Architecture note:** The Lightsail `GetBlueprints` API does not return an `architecture` field — the blueprint is architecture-neutral. Architecture is determined by the instance bundle. The `xlarge_3_0` bundle uses x86_64 (standard Lightsail instances). This matches the verified Azure source architecture (`uname -m` = `x86_64`).

### ✅ RESOLVED — TARGET REGION CHANGED to eu-west-2 (London)

**Previous blocker:** `RegionSetupInProgressException` on both `GetBundles` and `GetBlueprints` in eu-south-2 (Spain), persisted across 2026-08-15 and 2026-08-16 with no resolution timeline.

**Resolution (2026-08-16):** Target region changed to eu-west-2 (London) by explicit user decision. eu-west-2 is already used successfully by another Lightsail server in this account. eu-south-2 activation is not required.

**eu-west-2 (London) API verification (2026-08-16):**

| Check | Result |
|-------|--------|
| GetBlueprints eu-west-2 | ✅ `ubuntu_24_04` returned — isActive=True, platform=LINUX_UNIX |
| GetBundles eu-west-2 | ✅ `xlarge_3_0` returned — 4 vCPU, 16 GB, 320 GB, $84.00/month, 6144 GB, isActive=True |
| RegionSetupInProgressException | None — region fully operational |

---

## 1. DATA DISK SIZE DISCREPANCY — RESOLVED

### Root Cause

The Azure managed disk was enlarged from ~128 GiB to 256 GiB at some point, but `resize2fs` was never run. The ext4 filesystem remained at its original pre-expansion size.

### Verified Measurements (read-only, Azure Run Command)

| Layer | Measured Value | Source |
|-------|---------------|--------|
| Azure managed disk provisioned size | 256 GiB | `az vm show --query dataDisks[0].diskSizeGB` |
| Block device size | 274,877,906,944 bytes (256 GiB) | `blockdev --getsize64 /dev/sdb` |
| Partition table | "loop" — whole-disk ext4, no partition table | `parted /dev/sdb print` |
| ext4 filesystem size | 134,951,424,000 bytes (≈126 GiB) | `df -B1 /mnt/data-dokploy` |
| Filesystem used | 40,667,729,920 bytes (≈38 GiB) | `df -B1` |
| Filesystem available | 88,425,865,216 bytes (≈82 GiB) | `df -B1` |
| Unallocated (post-expansion gap) | ≈118 GiB | 256 GiB − 126 GiB ext4 header |

### Impact on Migration

The 38 GiB of actual data fits on the Lightsail 320 GiB SSD with 282 GiB headroom. The unallocated 118 GiB is irrelevant — we are not copying the disk image, only the data.

---

## 2. TARGET REGION AND BUNDLE

### eu-west-2 (London) — ✅ PRIMARY TARGET — API Verified 2026-08-16

| Property | Value |
|----------|-------|
| Bundle ID | `xlarge_3_0` |
| vCPU | 4 |
| RAM | 16.0 GB |
| SSD | 320 GB |
| Transfer | 6,144 GB/month |
| Price | $84.00/month |
| Static IPv4 | 1 included |
| Platform | LINUX_UNIX |
| Active | true |
| RegionSetupInProgressException | None — region fully operational |

### eu-west-1 (Ireland) — API Verified (historical reference only — not the target)

| Property | Value |
|----------|-------|
| Bundle ID | `xlarge_3_0` |
| vCPU | 4 |
| RAM | 16.0 GB |
| SSD | 320 GB |
| Transfer | 6,144 GB/month |
| Price | $84.00/month |
| Static IPv4 | 1 included |
| Platform | LINUX_UNIX |
| Active | true |

### eu-south-2 (Spain) — Historical context only — was original target, replaced by eu-west-2

`RegionSetupInProgressException` on both `GetBundles` and `GetBlueprints` persisted across 2026-08-15 and 2026-08-16.
Region exists in `get-regions` (name: `eu-south-2`, displayName: `Spain`) but account setup did not complete in time.
Target changed to eu-west-2 (London) by explicit user decision on 2026-08-16. eu-south-2 is no longer the target.

**xlarge_3_0 bundle in eu-south-2: NOT REQUIRED — target is now eu-west-2.**

### Region Decision Logic

1. **Primary target:** eu-west-2 (London) — already used by another Lightsail server in this account; fully operational; API-verified 2026-08-16
2. **Historical original target:** eu-south-2 (Spain) — stuck in Enabling; no longer in scope
3. **Historical reference:** eu-west-1 (Ireland) — verified but not the target

---

## 3. UBUNTU BLUEPRINT

### Source Architecture (verified read-only)

| Field | Value | How verified |
|-------|-------|--------------|
| Architecture | `x86_64` | `uname -m` via Azure Run Command |
| OS version | Ubuntu 24.04.3 LTS | `lsb_release -a` via Azure Run Command |

### Target Blueprint — ✅ VERIFIED via API (eu-west-1, 2026-08-15)

| Field | Verified Value |
|-------|---------------|
| blueprintId | **`ubuntu_24_04`** |
| name | Ubuntu |
| version | 24.04 LTS |
| versionCode | 1 |
| platform | LINUX_UNIX |
| type | os |
| isActive | **True** |
| minPower | 0 (compatible with xlarge_3_0 and all bundles) |
| Architecture | x86_64 (Lightsail API does not return `architecture` in GetBlueprints — architecture is determined by the bundle, which uses x86_64 for standard instances) |

**Architecture compatibility:** Source is `x86_64`. Lightsail standard bundles (including `xlarge_3_0`) are x86_64. Compatible.

**Blueprint ID is confirmed: `ubuntu_24_04`**. This is the value to pass to `CreateInstances --blueprint-id`. No assumption — API-verified.

**Verified in eu-west-2 (London):** Blueprint `ubuntu_24_04` confirmed `isActive=True`, `platform=LINUX_UNIX` via `GetBlueprints` API in eu-west-2 (2026-08-16). No further verification required before provisioning.

---

## 4. DOKPLOY POSTGRES SECRET — VESTIGIAL, NO MIGRATION NEEDED

### Verified Facts

| Question | Answer | Evidence |
|----------|--------|----------|
| Secret exists in Swarm? | Yes | `docker secret inspect dokploy_postgres_password` returns `{Name: "dokploy_postgres_password", Labels: {}}` |
| Any service mounts it? | **No** | All services inspected; `Secrets` field is `null` for every service |
| Postgres container reads it? | **No** | `/run/secrets/` is empty; `wc -c` = 0; sha256 = empty-string hash |
| How is password set? | Env var `POSTGRES_PASSWORD=dokploy` | Container inspect |
| DATABASE_URL | `postgresql://dokploy:dokploy@dokploy-postgres:5432/dokploy` | Dokploy service env |

### Action

The Docker Swarm secret is vestigial. Dokploy installer sets `POSTGRES_PASSWORD=dokploy` via environment. No secret value needs to be extracted or migrated. After Dokploy installs on Lightsail, optionally recreate the empty secret to prevent any Swarm warnings:
```bash
printf 'dokploy' | docker secret create dokploy_postgres_password -
```

---

## 5. DOKPLOY NATIVE BACKUP — NOT CONFIGURED

### Verified State

| Check | Result | How verified |
|-------|--------|--------------|
| `/etc/dokploy/backups/` | Does not exist | Azure Run Command `ls` |
| Dokploy DB `backup` table | Empty | `psql -c "SELECT * FROM backup LIMIT 1"` returned no rows |
| Dokploy DB `destination` table | Empty | `psql -c "SELECT * FROM destination LIMIT 1"` returned no rows |
| Any pg_dump cron | None | `crontab -l`, `/etc/cron.d/`, `systemctl list-timers` — all negative |

### Existing Ad-hoc Dumps (at `/var/backups/pgdump/`)

These are NOT from an automated scheduler. Last-modified dates suggest manual or app-triggered runs:

| Directory | Last modified | Size |
|-----------|--------------|------|
| cedula/ | 2026-05-26 | 20 KB |
| jpvbootcamp/ | 2026-08-13 | 98 KB |
| jpvbootcamp_staging/ | 2026-07-24 | 12 KB |
| procore/ | 2026-02-13 | 4 KB |
| prokit/ | 2026-02-13 | 405 KB |
| prokitcore/ | 2026-02-13 | 4 KB |
| prokitstudio/ | 2026-04-12 | 806 KB |
| proofly/ | 2026-05-26 | 12 KB |
| saaskit/ | 2026-02-13 | 4 KB |
| saaskitcore/ | 2026-02-10 | 4 KB |
| saaskitstudio/ | 2026-04-12 | 802 KB |
| saysthebible/ | 2026-05-31 | 1.8 MB |

These are migrated as historical reference only. They are not used for restoration.

---

## 6. COMPLETE PERSISTENT-STATE CLASSIFICATION

### A. Database Volumes — dump/restore

**Important correction from previous version:** Database names do NOT have `tenant_` prefixes. The `tenant_*` names are PostgreSQL schema names within the database, not database names.

| # | Source Container | PG | Database Name | Role | Volume | Size |
|---|------------------|----|---------------|------|--------|------|
| 1 | `dokploy-postgres.1.yecs4gx618210giif8omjm7hp` | 16 | `dokploy` | `dokploy` | `dokploy-postgres` | 67 MB |
| 2 | `apps-internal-n8n-cvjx2s-postgres-1` | 17 | `n8n` | `lyla_gislason` | `apps-internal-n8n-cvjx2s_postgres_data` | 68 MB |
| 3 | `compose-bypass-optical-alarm-tb4ukd-postgres-1` | 15 | `prochat` | `postgres` | `compose-bypass-optical-alarm-tb4ukd_data` | 46 MB |
| 4 | `compose-connect-wireless-application-d1n939-postgres-1` | 15 | `viadieden` | `postgres` | `compose-connect-wireless-application-d1n939_data` | 46 MB |
| 5 | `compose-copy-auxiliary-protocol-3gfh3x-postgres-1` | 15 | `statuslink` | `postgres` | `compose-copy-auxiliary-protocol-3gfh3x_data` | 47 MB |
| 6 | `compose-copy-cross-platform-bus-wojn3n-postgres-1` | 15 | `prokitstudio` | `postgres` | `compose-copy-cross-platform-bus-wojn3n_data` | 46 MB |
| 7 | `compose-copy-open-source-interface-fkhqrw-postgres-1` | 15 | `saysthebible` | `postgres` | `compose-copy-open-source-interface-fkhqrw_data` | 48 MB |
| 8 | `compose-copy-redundant-capacitor-zc4esw-postgres-1` | 15 | `prokit` | `postgres` | `compose-copy-redundant-capacitor-zc4esw_data` | 46 MB |
| 9 | `compose-generate-mobile-microchip-tksvis-postgres-1` | 15 | `openfund` | `postgres` | `compose-generate-mobile-microchip-tksvis_data` | 48 MB |
| 10 | `compose-generate-wireless-bandwidth-v7bvut-postgres-1` | 15 | `cedula` | `postgres` | `compose-generate-wireless-bandwidth-v7bvut_data` | 46 MB |
| 11 | `compose-hack-open-source-driver-mmchh4-postgres-1` | 15 | `jpvbootcamp` | `postgres` | `compose-hack-open-source-driver-mmchh4_data` | 47 MB |
| 12 | `compose-input-open-source-bandwidth-droye2-postgres-1` | 15 | `jpvbootcamp` | `postgres` | `compose-input-open-source-bandwidth-droye2_data` | 46 MB |
| 13 | `compose-navigate-optical-monitor-vi714i-postgres-1` | 15 | `olivetoorganizing` | `postgres` | `compose-navigate-optical-monitor-vi714i_data` | 46 MB |
| 14 | `compose-quantify-1080p-system-tp1q5f-postgres-1` | 15 | `saaskitstudio` | `postgres` | `compose-quantify-1080p-system-tp1q5f_data` | 46 MB |
| 15 | `compose-reboot-cross-platform-driver-6l6dun-postgres-1` | 15 | `resend` | `postgres` | `compose-reboot-cross-platform-driver-6l6dun_data` | 47 MB |
| 16 | `compose-synthesize-bluetooth-panel-tg5mhy-postgres-1` | 15 | `saaskit` | `postgres` | `compose-synthesize-bluetooth-panel-tg5mhy_data` | 46 MB |

⚠️ **DB name collision:** Entries 11 and 12 both have database name `jpvbootcamp`. They are separate containers in separate Dokploy projects. Dump filenames must use the container project slug, not the database name.

### B. Persistent Non-DB Data — Must Transfer

| Item | Source Path | Size | Transfer | Validation |
|------|------------|------|----------|-----------|
| Dokploy token_seed | `/mnt/data-dokploy/docker/volumes/dokploy/_data/.token_seed` | 133 B | `scp` (never cat to terminal) | SHA-256: `ebaf861266cde621f2215407e957ea591b38d56727c0945ae4c35b3ba73cdd38` |
| n8n app config | `/mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data/config` | 112 B | `rsync` | SHA-256 match |
| n8n binary data | `/mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data/binaryData/` | 16 KB | `rsync` | File count + SHA-256 |
| Buildflow relay data | `/mnt/data-dokploy/docker/volumes/buildflow-data-staging/_data/` (3 JSON files) | 16 KB | `rsync` | SHA-256 per file |
| Ory Kratos config | `/mnt/data-dokploy/docker/volumes/ory-config/_data/` (2 files) | 12 KB | `rsync` | SHA-256 per file |
| ACME certificates | `/etc/dokploy/traefik/dynamic/acme.json` | 53 KB | `rsync --perms` (preserve mode 600) | `pg_restore --list` equivalent: `openssl pkey -noout` on embedded key |
| Cloudflare Origin cert | `/etc/dokploy/traefik/dynamic/dokploy-origin.crt` | 1.2 KB | `rsync` | `openssl x509 -noout -subject -dates` |
| Cloudflare Origin key | `/etc/dokploy/traefik/dynamic/dokploy-origin.key` | 1.7 KB | `rsync --perms` (preserve mode 600) | `openssl rsa -noout -check` |
| All Dokploy config | `/etc/dokploy/` (excl. `traefik/dynamic/access.log`) | ~900 MB net | `rsync --exclude='traefik/dynamic/access.log'` | File count diff |
| GHCR auth | `/home/master/.docker/config.json` | 123 B | `scp` (preserve mode 600) | `docker pull ghcr.io/prochattools/prochat:latest` succeeds |
| cloudflared service | `/etc/systemd/system/cloudflared.service` | ~400 B | `scp` | File SHA-256 match |
| New Relic config | `/etc/newrelic-infra.yml` | ~200 B | `scp` | `newrelic-infra --test` succeeds |
| Historical pgdumps | `/var/backups/pgdump/` | 3.9 MB | `rsync` | Directory listing match |

Note on rsync size: `/etc/dokploy/` is ~2.1 GB total, but `traefik/dynamic/access.log` is 1.2 GB alone. Excluding it reduces transfer to ~900 MB.

### C. Rebuildable — Do Not Copy

| Item | Reason |
|------|--------|
| Docker images (35 GB) | Re-pulled by digest from registries |
| `dokploy` volume → `buildx/` (4.2 MB) | Docker BuildKit cache, auto-recreated |
| `dokploy-redis` (132 KB) | Queue cache, rebuilt from DB on restart |
| `jpv-bootcamp-preview-media` (empty) | Populated by running app |
| n8n event logs (`n8nEventLog*.log`, `crash.journal`) | Application logs, not state |
| `traefik/dynamic/access.log` (1.2 GB) | Traefik access log, new file created on start |

### D. Orphaned — Do Not Copy

| Volume | Evidence of orphan status |
|--------|--------------------------|
| `ops-umami-sqswbj_db-data` (64 MB) | Umami container has `[]` mounts; env confirms external Supabase |
| `code_n8n_data` (20 KB) | No running container mounts this volume |
| `code_postgres_data` (49 MB) | No running container mounts this volume |
| `dokploy_postgres` (underscore, 4 KB) | Different from active `dokploy-postgres`; unused |
| `ory_ory-data` (4 KB) | Empty directory, no container mounts it |
| 25+ hash-named volumes (4 KB each) | None matched to any running container |
| `08ba160c...` (28 MB) | No consumer found |
| `d35b158e...` (676 KB) | No consumer found |

### Non-DB Application State — Full Accounting

| Application | External DB (Supabase) | Local non-DB state | Status |
|-------------|----------------------|-------------------|--------|
| n8n | No | `config` (112 B) + `binaryData/` (16 KB) | Must copy |
| Ory Kratos | Yes (`10.0.2.4:5433/ory_prod`) | Config files only (12 KB, read-only mount) | Must copy config |
| Umami | Yes (`10.0.2.4:5433/analytics`) | None (empty mounts) | Nothing to copy |
| Buildflow | No | 3 JSON relay files (16 KB) | Must copy |
| All SaaS/web apps | No | Only `/var/backups/pgdump` bind (historical) | DB dump handles state |
| Dokploy platform | No | `.token_seed` (133 B) | Must copy |
| Traefik | No | Certs, ACME JSON | Must copy |

---

## 7. GHCR / REGISTRY CREDENTIALS

### Verified State

| Property | Value | Verified how |
|----------|-------|--------------|
| Config path | `/home/master/.docker/config.json` | `ls -la` via Azure Run Command |
| Owner:mode | `master:master 600` | `stat` |
| Size | 123 bytes | `stat` |
| Registered registry | `ghcr.io` only | `cat \| python3 -c 'print(d["auths"].keys())'` (keys only, not values) |
| mtime (Unix) | `1776272064` (≈ 2026-04-13) | `stat --format=%Y` |
| PAT expiry | Unknown — GitHub PATs are no-expiry by default unless explicitly set | Cannot verify without GitHub API access |

### Private Images (14 total requiring auth)

| Org | Images |
|-----|--------|
| `ghcr.io/prochattools/` | cedula, jccp-holdings, jpv-bootcamp, oliveto-organizing, prochat, proofly, says-the-bible, statuslink, vault-legal-backend, vault-legal-frontend, via-di-eden (11) |
| `ghcr.io/stevewesthoek/` | buildflow (1) |
| `ghcr.io/yeshuaacademy/` | finance, yeshuaacademy (2) |

### Secure Transfer and Validation

```bash
# On local machine (acting as transfer relay):
scp master@<azure-ts-ip>:/home/master/.docker/config.json /tmp/ghcr-config.json
# Transfer to Lightsail:
scp /tmp/ghcr-config.json master@<lightsail-ts-ip>:/home/master/.docker/config.json
chmod 600 /home/master/.docker/config.json  # on Lightsail
shred -u /tmp/ghcr-config.json             # clean up local copy
```

**Validity test on Lightsail (after copy):**
```bash
docker pull ghcr.io/prochattools/prochat:latest 2>&1 | tail -1
# Must produce: Status: Downloaded newer image for ... or Status: Image is up to date
# Must NOT produce: unauthorized: unauthenticated
```

**If PAT is expired:** Generate new classic PAT on GitHub with scope `read:packages`, then:
```bash
echo <new-token> | docker login ghcr.io -u <github-username> --password-stdin
```

---

## 8. TRAEFIK / ACME

### ACME Configuration (verified)

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: info@prochat.tools
      storage: /etc/dokploy/traefik/dynamic/acme.json
      httpChallenge:
        entryPoint: web   # HTTP-01 challenge via port 80
```

### Key Facts

| Question | Answer | Evidence |
|----------|--------|----------|
| Challenge type | HTTP-01 | `httpChallenge.entryPoint: web` in traefik.yml |
| DNS challenge? | No | No `dnsChallenge` block present |
| ACME depends on Cloudflare Tunnel? | Yes — indirectly | HTTP-01 challenges reach port 80 via Cloudflare Tunnel; port 80 not directly exposed |
| Port 80 needs to be publicly exposed on Lightsail? | No | Tunnel handles delivery; Lightsail firewall can block port 80 |
| Copy acme.json sufficient? | Yes — avoids re-issuance rate limits | 53 KB file with embedded account key + domain certs |
| acme.json owner/mode | `root:root 0600` | `stat` |
| acme.json last modified | 2026-08-11 13:05 | `ls -la` |
| Temporary port 80 opening needed? | No | Same architecture on Lightsail; tunnel delivers challenges |

### Cloudflare Origin Certificate

| Field | Value |
|-------|-------|
| File | `dokploy-origin.crt` |
| Subject CN | `dokploy.prochat.tools` |
| Issuer | Self-signed (CN = `dokploy.prochat.tools`) |
| Expiry | 2027-05-19 |
| Key file | `dokploy-origin.key` (1.7 KB, mode 600) |
| Action | Copy both files in rsync of `/etc/dokploy/traefik/` |

---

## 9. CLOUDFLARE TUNNEL CREDENTIAL

### Verified State

| Property | Value |
|----------|-------|
| Service file | `/etc/systemd/system/cloudflared.service` |
| Token format | JWT (starts with `eyJ`) |
| Token length | 184 characters |
| Token storage | Plaintext in `ExecStart` args of service file |
| Recovery source | Service file copy OR Cloudflare dashboard → Zero Trust → Tunnels → `<tunnel>` → Configuration |

### Secure Transfer

```bash
# Copy the full service file — do not extract/print the token
scp master@<azure-ts-ip>:/etc/systemd/system/cloudflared.service /tmp/cloudflared.service
scp /tmp/cloudflared.service master@<lightsail-ts-ip>:/etc/systemd/system/cloudflared.service
chmod 644 /etc/systemd/system/cloudflared.service  # on Lightsail
systemctl daemon-reload  # on Lightsail (does not start the service)
shred -u /tmp/cloudflared.service
```

**Do not echo or print the token at any point.**

### Dual-Connector Safety Rule

Running cloudflared with the production tunnel token on two hosts simultaneously causes Cloudflare to load-balance traffic between them. This violates write isolation. The production token must run on **exactly one host at a time**.

---

## 10. NEW RELIC CONFIGURATION

### Verified State

| Property | Value |
|----------|-------|
| Config file | `/etc/newrelic-infra.yml` |
| `display_name` | `dokploy` |
| `custom_attributes.cloud` | `azure` — **must change to `aws` after migration** |
| `custom_attributes.location` | `spain-central` — **must change to `eu-west-2`** |
| `license_key` field | Present, 40-character key (not exposed) |

### Migration Action

Copy config file. Before starting New Relic on Lightsail, update:
```yaml
custom_attributes:
  cloud: aws
  location: eu-west-2
```

---

## 11. STARTUP ORDERING

### Why This Matters

On Azure: `/mnt/data-dokploy` is a real ext4 partition. systemd generates `mnt-data\x2ddokploy.mount` from fstab, and `docker.service` waits on `local-fs.target` which includes this unit.

On Lightsail (single disk): `/mnt/data-dokploy` is a regular directory. No mount unit is generated for it. Docker still depends on `local-fs.target`, which will include the two bind-mount units (`var-lib-containerd.mount` and `etc-dokploy-applications.mount`). Docker starts only after those binds are active.

### Mandatory Reboot Test (Phase 2 gate — must pass before any data import)

```bash
# --- SETUP (once, before reboot) ---
mkdir -p /mnt/data-dokploy/{docker,containerd,dokploy/applications}
mkdir -p /etc/dokploy/applications /var/lib/containerd

# Add to /etc/fstab (bind mounts only — no UUID entry needed):
cat >> /etc/fstab << 'EOF'
/mnt/data-dokploy/containerd /var/lib/containerd none bind,nofail 0 0
/mnt/data-dokploy/dokploy/applications /etc/dokploy/applications none bind,nofail 0 0
EOF

# Configure Docker data-root:
echo '{"data-root": "/mnt/data-dokploy/docker"}' > /etc/docker/daemon.json

# --- INSTALL Docker/containerd (exact version commands in Section 11-B) ---

# --- REBOOT ---
sudo reboot

# --- VERIFICATION (reconnect via SSH after instance status shows running) ---

# Gate 1: Bind mounts active
findmnt /var/lib/containerd \
  && echo "PASS: containerd bind" || { echo "FAIL: containerd bind not mounted"; exit 1; }
findmnt /etc/dokploy/applications \
  && echo "PASS: applications bind" || { echo "FAIL: applications bind not mounted"; exit 1; }

# Gate 2: Docker data-root correct
docker info --format '{{.DockerRootDir}}' | grep -qF '/mnt/data-dokploy/docker' \
  && echo "PASS: data-root" || { echo "FAIL: wrong data-root"; exit 1; }

# Gate 3: Services running
systemctl is-active --quiet docker \
  && echo "PASS: docker active" || { echo "FAIL: docker not active"; exit 1; }
systemctl is-active --quiet containerd \
  && echo "PASS: containerd active" || { echo "FAIL: containerd not active"; exit 1; }

# Gate 4: No data written to wrong path
test ! -d /var/lib/docker \
  && echo "PASS: no /var/lib/docker" || { echo "FAIL: docker wrote to default path"; exit 1; }

# Gate 5: Startup order confirms correct chain
systemd-analyze critical-chain docker.service

# ALL gates must print PASS. Any FAIL = abort, diagnose, fix, reboot again before proceeding.
```

### Abort Conditions

| Failure | Action |
|---------|--------|
| `findmnt` fails | fstab syntax error; fix entry, run `systemctl daemon-reload && mount -a` to test without reboot; reboot again |
| data-root wrong | daemon.json not loaded; check JSON syntax; restart Docker |
| `/var/lib/docker` exists | Docker started before bind mounts; fix systemd dependency; purge `/var/lib/docker` before retry |
| Docker not active | Check `journalctl -u docker -n 50` |

---

## 12. LIGHTSAIL SNAPSHOT BEHAVIOR

### What Instance Snapshots Do and Do Not Cover

| Behavior | Detail |
|----------|--------|
| Captures | Full system disk, block-level |
| Does NOT capture | Firewall rules, static IP association, DNS |
| Consistency | Crash-consistent only — NOT application-consistent |
| DB safety | PostgreSQL WAL recovers clean, but in-flight transactions are not guaranteed |
| Auto-snapshot lifecycle | **Deleted when source instance is deleted** |
| Manual snapshot lifecycle | Persists indefinitely |
| Static IP | Separate Lightsail resource; free while attached, $3.50/month unattached |

### Required Runbook Additions

1. **Document firewall rules** applied to Lightsail instance at provisioning time, store in `migration-manifest.json`
2. **Take manual snapshot** immediately after Phase 5 validation passes — tag: `post-migration-verified-good`
3. **Do not delete auto-snapshots** until manual snapshot is confirmed present
4. **Before any future instance deletion:** create a new manual snapshot first; export critical pg_dumps independently

### Lightsail Firewall Ports

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | `<your-IP>/32` | Emergency SSH |
| 80 | TCP | BLOCKED | Not needed — Cloudflare Tunnel delivers HTTP-01 |
| 443 | TCP | BLOCKED | Not needed — Cloudflare Tunnel delivers HTTPS |

All application traffic routes through the Cloudflare Tunnel. No public ports beyond SSH are required.

---

## 13. COMPLETE DATABASE MIGRATION — DETERMINISTIC MAPPING

### Overview

Target container names are **identical to source container names** because Dokploy generates deterministic container names from its stored project/service slugs. After Dokploy DB is restored on Lightsail, it re-deploys services with the same names. Container discovery on the target uses exact name matching, not fuzzy DB-name matching.

### Dump Filename Convention

**Format:** `<container-project-slug>.dump`

The slug is the container name minus `-postgres-1` suffix. This is unique even when two containers share the same database name (entries 11 and 12 both have DB `jpvbootcamp` but different project slugs).

### Complete 16-Database Mapping

| # | Source Container (exact) | PG | DB | Role | Dump File | Schema(s) (non-public) | Tables |
|---|--------------------------|----|----|------|-----------|----------------------|--------|
| 1 | `dokploy-postgres.1.yecs4gx618210giif8omjm7hp` | 16 | `dokploy` | `dokploy` | `dokploy-postgres.dump` | public | 61 |
| 2 | `apps-internal-n8n-cvjx2s-postgres-1` | 17 | `n8n` | `lyla_gislason` | `apps-internal-n8n-cvjx2s.dump` | public | 54 |
| 3 | `compose-bypass-optical-alarm-tb4ukd-postgres-1` | 15 | `prochat` | `postgres` | `compose-bypass-optical-alarm-tb4ukd.dump` | `tenant_prochat` | 7 |
| 4 | `compose-connect-wireless-application-d1n939-postgres-1` | 15 | `viadieden` | `postgres` | `compose-connect-wireless-application-d1n939.dump` | `tenant_viadieden` | unknown† |
| 5 | `compose-copy-auxiliary-protocol-3gfh3x-postgres-1` | 15 | `statuslink` | `postgres` | `compose-copy-auxiliary-protocol-3gfh3x.dump` | `tenant_statuslink` | 19 |
| 6 | `compose-copy-cross-platform-bus-wojn3n-postgres-1` | 15 | `prokitstudio` | `postgres` | `compose-copy-cross-platform-bus-wojn3n.dump` | `prokitstudio` | 2 |
| 7 | `compose-copy-open-source-interface-fkhqrw-postgres-1` | 15 | `saysthebible` | `postgres` | `compose-copy-open-source-interface-fkhqrw.dump` | `tenant_saysthebible` | 21 |
| 8 | `compose-copy-redundant-capacitor-zc4esw-postgres-1` | 15 | `prokit` | `postgres` | `compose-copy-redundant-capacitor-zc4esw.dump` | `tenant_prokit` | 2 |
| 9 | `compose-generate-mobile-microchip-tksvis-postgres-1` | 15 | `openfund` | `postgres` | `compose-generate-mobile-microchip-tksvis.dump` | `tenant_openfund`, `ya_finance_schema` | 13+11=24 |
| 10 | `compose-generate-wireless-bandwidth-v7bvut-postgres-1` | 15 | `cedula` | `postgres` | `compose-generate-wireless-bandwidth-v7bvut.dump` | `tenant_cedula` | 5 |
| 11 | `compose-hack-open-source-driver-mmchh4-postgres-1` | 15 | `jpvbootcamp` | `postgres` | `compose-hack-open-source-driver-mmchh4.dump` | `tenant_jpvbootcamp` | 12 |
| 12 | `compose-input-open-source-bandwidth-droye2-postgres-1` | 15 | `jpvbootcamp` | `postgres` | `compose-input-open-source-bandwidth-droye2.dump` | `jpvbootcamp` | 2 |
| 13 | `compose-navigate-optical-monitor-vi714i-postgres-1` | 15 | `olivetoorganizing` | `postgres` | `compose-navigate-optical-monitor-vi714i.dump` | `tenant_olivetoorganizing` | unknown† |
| 14 | `compose-quantify-1080p-system-tp1q5f-postgres-1` | 15 | `saaskitstudio` | `postgres` | `compose-quantify-1080p-system-tp1q5f.dump` | `tenant_saaskitstudio` | 4 |
| 15 | `compose-reboot-cross-platform-driver-6l6dun-postgres-1` | 15 | `resend` | `postgres` | `compose-reboot-cross-platform-driver-6l6dun.dump` | `tenant_resend` | 6 |
| 16 | `compose-synthesize-bluetooth-panel-tg5mhy-postgres-1` | 15 | `saaskit` | `postgres` | `compose-synthesize-bluetooth-panel-tg5mhy.dump` | `tenant_saaskit` | 4 |

† `viadieden` and `olivetoorganizing` had schema names confirmed but table counts not explicitly returned. Counts will be captured in the pre-dump verification manifest.

### Phase 3 — Pre-Dump Verification Manifest (run on Azure BEFORE final dump)

This manifest is captured before stopping apps. It becomes the authoritative baseline.

```bash
mkdir -p /tmp/migration/manifests

# For each database, capture schema+table inventory and extension list
for entry in \
  "dokploy-postgres.1.yecs4gx618210giif8omjm7hp|dokploy|dokploy|dokploy-postgres" \
  "apps-internal-n8n-cvjx2s-postgres-1|lyla_gislason|n8n|apps-internal-n8n-cvjx2s" \
  "compose-bypass-optical-alarm-tb4ukd-postgres-1|postgres|prochat|compose-bypass-optical-alarm-tb4ukd" \
  "compose-connect-wireless-application-d1n939-postgres-1|postgres|viadieden|compose-connect-wireless-application-d1n939" \
  "compose-copy-auxiliary-protocol-3gfh3x-postgres-1|postgres|statuslink|compose-copy-auxiliary-protocol-3gfh3x" \
  "compose-copy-cross-platform-bus-wojn3n-postgres-1|postgres|prokitstudio|compose-copy-cross-platform-bus-wojn3n" \
  "compose-copy-open-source-interface-fkhqrw-postgres-1|postgres|saysthebible|compose-copy-open-source-interface-fkhqrw" \
  "compose-copy-redundant-capacitor-zc4esw-postgres-1|postgres|prokit|compose-copy-redundant-capacitor-zc4esw" \
  "compose-generate-mobile-microchip-tksvis-postgres-1|postgres|openfund|compose-generate-mobile-microchip-tksvis" \
  "compose-generate-wireless-bandwidth-v7bvut-postgres-1|postgres|cedula|compose-generate-wireless-bandwidth-v7bvut" \
  "compose-hack-open-source-driver-mmchh4-postgres-1|postgres|jpvbootcamp|compose-hack-open-source-driver-mmchh4" \
  "compose-input-open-source-bandwidth-droye2-postgres-1|postgres|jpvbootcamp|compose-input-open-source-bandwidth-droye2" \
  "compose-navigate-optical-monitor-vi714i-postgres-1|postgres|olivetoorganizing|compose-navigate-optical-monitor-vi714i" \
  "compose-quantify-1080p-system-tp1q5f-postgres-1|postgres|saaskitstudio|compose-quantify-1080p-system-tp1q5f" \
  "compose-reboot-cross-platform-driver-6l6dun-postgres-1|postgres|resend|compose-reboot-cross-platform-driver-6l6dun" \
  "compose-synthesize-bluetooth-panel-tg5mhy-postgres-1|postgres|saaskit|compose-synthesize-bluetooth-panel-tg5mhy"
do
  CONTAINER=$(echo "$entry" | cut -d'|' -f1)
  USER=$(echo "$entry"     | cut -d'|' -f2)
  DB=$(echo "$entry"       | cut -d'|' -f3)
  SLUG=$(echo "$entry"     | cut -d'|' -f4)
  MANIFEST="/tmp/migration/manifests/${SLUG}.manifest"

  echo "=== DB: $DB ===" > "$MANIFEST"

  # 1. Schema list
  echo "--- SCHEMAS ---" >> "$MANIFEST"
  docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -tAc \
    "SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
     ORDER BY schema_name;" >> "$MANIFEST"

  # 2. Table count per schema
  echo "--- SCHEMA TABLE COUNTS ---" >> "$MANIFEST"
  docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -tAc \
    "SELECT table_schema, count(*) AS table_count
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
       AND table_type='BASE TABLE'
     GROUP BY table_schema ORDER BY table_schema;" >> "$MANIFEST"

  # 3. Extensions (excluding default plpgsql)
  echo "--- EXTENSIONS ---" >> "$MANIFEST"
  docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -tAc \
    "SELECT extname FROM pg_extension ORDER BY extname;" >> "$MANIFEST"

  # 4. Role list
  echo "--- ROLES ---" >> "$MANIFEST"
  docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -tAc \
    "SELECT rolname, rolsuper FROM pg_roles
     WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname;" >> "$MANIFEST"

  echo "Manifest written: $MANIFEST"
done
```

### Phase 3 — Dump Commands (run on Azure, all apps stopped, DBs still running)

```bash
mkdir -p /tmp/migration/dumps

# DB 1: Dokploy (PG16, user=dokploy)
CONTAINER="dokploy-postgres.1.yecs4gx618210giif8omjm7hp"
docker exec "$CONTAINER" pg_dump -Fc -U dokploy -d dokploy \
  > /tmp/migration/dumps/dokploy-postgres.dump
echo "Exit: $?"
pg_restore --list /tmp/migration/dumps/dokploy-postgres.dump | wc -l

# DB 2: n8n (PG17, user=lyla_gislason)
CONTAINER="apps-internal-n8n-cvjx2s-postgres-1"
docker exec "$CONTAINER" pg_dump -Fc -U lyla_gislason -d n8n \
  > /tmp/migration/dumps/apps-internal-n8n-cvjx2s.dump
echo "Exit: $?"

# DBs 3-16: All PG15, user=postgres, parallel execution
declare -A CONTAINERS=(
  [compose-bypass-optical-alarm-tb4ukd]="prochat"
  [compose-connect-wireless-application-d1n939]="viadieden"
  [compose-copy-auxiliary-protocol-3gfh3x]="statuslink"
  [compose-copy-cross-platform-bus-wojn3n]="prokitstudio"
  [compose-copy-open-source-interface-fkhqrw]="saysthebible"
  [compose-copy-redundant-capacitor-zc4esw]="prokit"
  [compose-generate-mobile-microchip-tksvis]="openfund"
  [compose-generate-wireless-bandwidth-v7bvut]="cedula"
  [compose-hack-open-source-driver-mmchh4]="jpvbootcamp"
  [compose-input-open-source-bandwidth-droye2]="jpvbootcamp"
  [compose-navigate-optical-monitor-vi714i]="olivetoorganizing"
  [compose-quantify-1080p-system-tp1q5f]="saaskitstudio"
  [compose-reboot-cross-platform-driver-6l6dun]="resend"
  [compose-synthesize-bluetooth-panel-tg5mhy]="saaskit"
)

for SLUG in "${!CONTAINERS[@]}"; do
  DB="${CONTAINERS[$SLUG]}"
  CNAME="${SLUG}-postgres-1"
  docker exec "$CNAME" pg_dump -Fc -U postgres -d "$DB" \
    > "/tmp/migration/dumps/${SLUG}.dump" &
done
wait  # Wait for all parallel dumps to complete

# Verify all dumps readable
echo "=== DUMP VERIFICATION ==="
for f in /tmp/migration/dumps/*.dump; do
  count=$(pg_restore --list "$f" 2>/dev/null | wc -l)
  size=$(wc -c < "$f")
  echo "$(basename $f): $count restore-list items, $size bytes"
  [ "$size" -gt 0 ] || echo "ERROR: $f is empty!"
done
```

### Phase 3 — Transfer to Lightsail (via Tailscale)

```bash
# From local machine (acting as relay, or directly from Azure via tailscale)
rsync -avz --progress \
  /tmp/migration/ \
  master@<lightsail-ts-ip>:/tmp/migration/
# Wait for rsync to complete. Verify with:
ssh master@<lightsail-ts-ip> "find /tmp/migration -name '*.dump' | wc -l"
# Must report: 16
```

### Phase 3 — Restore Commands (on Lightsail, containers running post-Dokploy deploy)

**Container existence check before each restore:**
```bash
# Discover container name (deterministic — same as source after Dokploy redeploy):
docker ps --filter "name=<slug>-postgres-1" --format "{{.Names}}"
# Must return exactly the expected container name. Exit if empty.
```

```bash
# --- RESTORE ORDER: DB 1 first (platform must be up) ---

# DB 1: Dokploy (PG16)
TARGET="dokploy-postgres"
docker ps --filter "name=${TARGET}" --format "{{.Names}}" | grep -q . \
  || { echo "ABORT: $TARGET container not found"; exit 1; }
docker exec -i $(docker ps --filter "name=${TARGET}" --format "{{.Names}}" | head -1) \
  pg_restore -U dokploy -d dokploy --clean --if-exists --exit-on-error \
  < /tmp/migration/dumps/dokploy-postgres.dump
echo "Dokploy restore exit: $?"

# DB 2: n8n (PG17 — needs uuid-ossp created first)
TARGET="apps-internal-n8n-cvjx2s-postgres-1"
docker ps --filter "name=${TARGET}" --format "{{.Names}}" | grep -q . \
  || { echo "ABORT: $TARGET not found"; exit 1; }
docker exec "$TARGET" psql -U lyla_gislason -d n8n \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
docker exec -i "$TARGET" \
  pg_restore -U lyla_gislason -d n8n --clean --if-exists --exit-on-error \
  < /tmp/migration/dumps/apps-internal-n8n-cvjx2s.dump
echo "n8n restore exit: $?"

# DBs 3-16: PG15, parallel restore
declare -a SLUGS=(
  "compose-bypass-optical-alarm-tb4ukd"
  "compose-connect-wireless-application-d1n939"
  "compose-copy-auxiliary-protocol-3gfh3x"
  "compose-copy-cross-platform-bus-wojn3n"
  "compose-copy-open-source-interface-fkhqrw"
  "compose-copy-redundant-capacitor-zc4esw"
  "compose-generate-mobile-microchip-tksvis"
  "compose-generate-wireless-bandwidth-v7bvut"
  "compose-hack-open-source-driver-mmchh4"
  "compose-input-open-source-bandwidth-droye2"
  "compose-navigate-optical-monitor-vi714i"
  "compose-quantify-1080p-system-tp1q5f"
  "compose-reboot-cross-platform-driver-6l6dun"
  "compose-synthesize-bluetooth-panel-tg5mhy"
)

for SLUG in "${SLUGS[@]}"; do
  CNAME="${SLUG}-postgres-1"
  docker ps --filter "name=${CNAME}" --format "{{.Names}}" | grep -q . \
    || { echo "ERROR: $CNAME not found — skipping (investigate before continuing)"; continue; }
  (
    docker exec -i "$CNAME" \
      pg_restore -U postgres -d \
      $(docker exec "$CNAME" psql -U postgres -tAc \
        "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1') LIMIT 1") \
      --clean --if-exists --exit-on-error \
      < "/tmp/migration/dumps/${SLUG}.dump"
    echo "$SLUG restore exit: $?"
  ) &
done
wait
echo "All PG15 restores complete"
```

---

## 14. DETERMINISTIC DATABASE VERIFICATION

### Verification Manifest Comparison (run on Lightsail after restore)

```bash
for MANIFEST in /tmp/migration/manifests/*.manifest; do
  SLUG=$(basename "$MANIFEST" .manifest)
  echo "=== Verifying: $SLUG ==="

  # Determine container and credentials from slug
  # (same lookup table as restore section above)

  # 1. pg_restore --list: dump must be readable (already verified at dump time)
  pg_restore --list "/tmp/migration/dumps/${SLUG}.dump" > /dev/null 2>&1 \
    && echo "  PASS: dump readable" || echo "  FAIL: dump unreadable"

  # 2. Schema list matches
  SCHEMAS_SOURCE=$(grep -A100 "^--- SCHEMAS ---" "$MANIFEST" | grep -B100 "^---" | grep -v "^---" | sort)
  SCHEMAS_TARGET=$(docker exec "$CNAME" psql -U "$USER" -d "$DB" -tAc \
    "SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
     ORDER BY schema_name;")
  [ "$SCHEMAS_SOURCE" = "$SCHEMAS_TARGET" ] \
    && echo "  PASS: schemas match" || echo "  FAIL: schema mismatch"

  # 3. Table count per schema matches
  COUNTS_SOURCE=$(grep -A100 "^--- SCHEMA TABLE COUNTS ---" "$MANIFEST" | grep -B100 "^---" | grep -v "^---")
  COUNTS_TARGET=$(docker exec "$CNAME" psql -U "$USER" -d "$DB" -tAc \
    "SELECT table_schema, count(*) FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
       AND table_type='BASE TABLE'
     GROUP BY table_schema ORDER BY table_schema;")
  [ "$COUNTS_SOURCE" = "$COUNTS_TARGET" ] \
    && echo "  PASS: table counts match" || echo "  FAIL: table count mismatch"

  # 4. Extensions match
  EXT_SOURCE=$(grep -A100 "^--- EXTENSIONS ---" "$MANIFEST" | grep -B100 "^---" | grep -v "^---")
  EXT_TARGET=$(docker exec "$CNAME" psql -U "$USER" -d "$DB" -tAc \
    "SELECT extname FROM pg_extension ORDER BY extname;")
  [ "$EXT_SOURCE" = "$EXT_TARGET" ] \
    && echo "  PASS: extensions match" || echo "  FAIL: extension mismatch"
done
```

### Additional COUNT(*) Verification for Populated Databases

For `dokploy` (61 tables) and `n8n` (54 tables), which are confirmed populated:

```bash
# Capture source row counts before dump (on Azure):
docker exec dokploy-postgres.1.yecs4gx618210giif8omjm7hp psql -U dokploy -d dokploy -c \
  "SELECT table_schema, table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS row_count
   FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   ORDER BY table_schema, table_name;" \
  > /tmp/migration/manifests/dokploy-row-counts.txt

# Same for n8n:
docker exec apps-internal-n8n-cvjx2s-postgres-1 psql -U lyla_gislason -d n8n -c \
  "SELECT table_schema, table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS row_count
   FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   ORDER BY table_schema, table_name;" \
  > /tmp/migration/manifests/n8n-row-counts.txt

# After restore on Lightsail, run the same queries and diff:
# diff /tmp/migration/manifests/dokploy-row-counts.txt <(same query on target)
# diff /tmp/migration/manifests/n8n-row-counts.txt    <(same query on target)
```

For the 14 app databases (mostly empty schemas based on 0 rows in pg_stat_user_tables): the table-count manifest comparison above is sufficient, since zero-row tables are fully reconstructed by schema alone.

### Restore Exit Status Check

Every `pg_restore --exit-on-error` invocation must return exit code 0. Any non-zero exit requires investigation before proceeding with shadow validation. Do not suppress or ignore pg_restore errors.

---

## 15. SHADOW VALIDATION METHOD

### Rule: Production Cloudflare Tunnel Token NEVER Active on Lightsail Before Cutover

All pre-cutover validation uses Tailscale direct access only.

### Validation Steps

```bash
# 1. Lightsail joins the prochat.tools tailnet
#    (Tailscale auth key generated from admin.tailscale.com beforehand)
tailscale up --authkey=<one-time-key> --hostname=dokploy-lightsail

# 2. Discover Lightsail Tailscale IP (run from local machine)
LIGHTSAIL_TS=$(tailscale status | awk '/dokploy-lightsail/ {print $1}')
echo "Lightsail Tailscale IP: $LIGHTSAIL_TS"

# 3. Test all HTTP routes via Host header simulation
#    (Simulates what Cloudflare Tunnel delivers to Traefik port 80)
for HOST in \
  prochat.tools \
  yeshua.academy \
  n8n.prochat.tools \
  dokploy.prochat.tools \
  jpvbootcamp.prochat.tools \
  cedula.prochat.tools \
  statuslink.prochat.tools \
  viadieden.prochat.tools
do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Host: $HOST" --max-time 10 "http://$LIGHTSAIL_TS:80/")
  echo "$HOST → HTTP $HTTP_CODE"
  # 200 or 301/302 = routing works; 502/503 = app not running; 404 = Traefik routing error
done

# 4. Verify Dokploy admin responds
curl -s -H "Host: dokploy.prochat.tools" "http://$LIGHTSAIL_TS:80/" | grep -q 'Dokploy' \
  && echo "PASS: Dokploy UI accessible" || echo "FAIL: Dokploy UI not found"

# 5. Verify external Supabase reachability from Lightsail (Umami and Kratos)
#    Must be on same Tailscale tailnet as the Supabase server (100.71.31.88)
ssh master@$LIGHTSAIL_TS "nc -z 100.71.31.88 5433 && echo 'PASS: Supabase reachable' || echo 'FAIL: Supabase unreachable'"

# 6. Verify Docker Swarm health
ssh master@$LIGHTSAIL_TS "docker node ls && docker service ls | awk '{print \$2, \$4}'"
# All services should show desired replica count met (e.g., 1/1)
```

### Shadow Validation Pass Criteria

All of the following must be true before proceeding to Phase 4:

- [ ] All HTTP routes return 200, 301, or 302 (not 502/503)
- [ ] Dokploy admin UI accessible
- [ ] Supabase reachable from Lightsail
- [ ] All 16 database restore verifications passed
- [ ] All Docker services show correct replica counts
- [ ] GHCR pull test succeeded
- [ ] Reboot test passed (Phase 2)

---

## 16. CUTOVER SEQUENCE (Phase 4)

### Pre-Conditions (all must be met)

- [ ] Shadow validation pass criteria all met
- [ ] User has explicitly approved cutover
- [ ] Maintenance window communicated to users
- [ ] Azure disk snapshot exists (taken at start of Phase 3)
- [ ] All 16 pg_dump files verified readable on Lightsail
- [ ] No active database writes needed for reconciliation (fresh final dump taken)

### Cutover Steps

| Step | Action | Completion Criterion | Abort Action |
|------|--------|---------------------|--------------|
| 1 | Take final Azure manual snapshot (both disks) | Azure snapshot status = `succeeded` | Cancel cutover, snapshot again |
| 2 | Stop all non-postgres Dokploy services on Azure | `docker service ls` shows 0/1 replicas for app services | `docker service scale <svc>=1` for all |
| 3 | Take final pre-cutover pg_dump of all 16 DBs | All 16 dump files created, `pg_restore --list` readable | `docker service scale` back up, abort |
| 4 | Replace Lightsail DB contents with final dumps | All 16 `pg_restore --exit-on-error` exit 0 | Keep both running on Azure, abort cutover |
| 5 | Run DB verification manifest comparison | All diffs empty | Investigate, abort cutover |
| 6 | Stop cloudflared on Azure | `systemctl is-active cloudflared` = `inactive` | Restart cloudflared on Azure, abort |
| 7 | Confirm Cloudflare shows 0 connectors for tunnel | Cloudflare dashboard: Tunnels → 0 active connectors | Restart cloudflared on Azure |
| 8 | Start cloudflared on Lightsail | `systemctl is-active cloudflared` = `active` | Stop Lightsail cloudflared, restart Azure cloudflared |
| 9 | Verify single connector in Cloudflare dashboard | Dashboard: Tunnels → exactly 1 active connector | Stop Lightsail cloudflared, restart Azure cloudflared |
| 10 | Test all domains via public internet | HTTP 200/301/302 for all domains listed in shadow test | Stop Lightsail cloudflared, restart Azure cloudflared |
| 11 | Mark cutover complete | — | — |

**Downtime window: Steps 6–10.** Begins when cloudflared stops on Azure, ends when all domains verify on Lightsail. Estimated 3–6 minutes based on tunnel deregistration and startup, not elapsed time.

---

## 17. ROLLBACK PROCEDURE — WRITE-AWARE

### Classification

**Class A — Rollback before Lightsail accepts production writes**
Defined as: before Step 8 (cloudflared starts on Lightsail). No production user has written to Lightsail databases.

**Class B — Rollback after Lightsail has accepted production writes**
Defined as: after Step 8 completes. Lightsail databases are authoritative. Azure databases are stale.

### Class A Rollback (safe, no reconciliation needed)

| Trigger | Action | Expected recovery time |
|---------|--------|----------------------|
| Step 2: service scale fails | `docker service scale <svc>=1` for all apps on Azure | Until `1/1` replicas shown |
| Step 3: dump fails | `docker service scale` back up on Azure | Until `1/1` replicas shown |
| Step 4: pg_restore fails | Apps on Azure still down; Azure DBs untouched; restart apps on Azure | Until `1/1` replicas shown |
| Step 5: verification fails | Discard Lightsail DBs; restart apps on Azure | Until `1/1` replicas shown |
| Steps 6-7: cloudflared fails to stop cleanly | Force: `systemctl kill cloudflared` on Azure; wait for Cloudflare deregistration | Until 0 connectors shown |
| Step 8-9: Lightsail tunnel fails | Stop cloudflared on Lightsail; start on Azure | Until single connector on Azure |
| Step 10: domains fail | Stop cloudflared on Lightsail; start on Azure; scale apps on Azure | Until `docker service ls` shows `1/1` |

### Class B Rollback (production writes occurred — RECONCILIATION REQUIRED)

**Situation:** cloudflared ran on Lightsail and users wrote data. An issue is discovered and rollback to Azure is considered.

**Authoritative-data rule:** Lightsail is authoritative. Azure data is stale. Routing to Azure without reconciliation causes confirmed data loss.

**Reconciliation procedure:**
1. Stop cloudflared on Lightsail (freeze all new writes)
2. Take final pg_dump of all Lightsail databases
3. Transfer Lightsail dumps to Azure
4. Assess reconciliation feasibility:
   - If delta is small (minutes of writes): restore Lightsail dumps to Azure containers, then switch cloudflared back to Azure
   - If delta is too large or complex: **Lightsail is the authoritative source; Azure rollback is not safe**; fix the issue on Lightsail instead
5. If reconciliation is not feasible: fix the issue on Lightsail and keep Lightsail as production

**Write-freeze rule:** The only safe Class B rollback requires first freezing writes on Lightsail (stop cloudflared), capturing the latest state, and applying it to Azure. Routing to Azure while Lightsail has written more data is equivalent to a point-in-time rollback with data loss.

### Post-Cutover Rollback Window

| Time since cutover | Azure state | Rollback feasibility |
|--------------------|-------------|---------------------|
| 0–2 hours | Running (allocated) | Class B reconciliation possible; Azure VM warm |
| 2+ hours | Deallocated | Reconciliation requires VM reallocation (~5 min) plus dump/restore |
| 7+ days | Resource group deleted | No Azure rollback possible; Lightsail is sole production source |

---

## 18. BACKUP ARCHITECTURE

### Current State (inadequate)

| Layer | Status | Risk |
|-------|--------|------|
| Lightsail auto-snapshot (daily, crash-consistent) | Planned at provisioning | Deleted if instance deleted; not DB-consistent |
| pg_dump to `/var/backups/pgdump/` | Planned post-migration | On same disk as data — not independent; single point of failure |
| Azure enhanced backup | Running on source | Stops being relevant after deallocation |

### Required Post-Migration Hardening — S3 Off-Instance Backup

**Must be configured within 24 hours of Phase 5 completion.** Not a nice-to-have.

**Design (document now, implement post-migration):**

```
Architecture:
  Lightsail instance → daily pg_dump (all 16 DBs) → gzip → AWS S3 bucket
  Encryption: SSE-S3 (AES-256) or SSE-KMS
  Retention: 30 days minimum, 90 days preferred
  Bucket: separate from any application bucket; single-purpose
  Region: same as Lightsail instance

IAM Policy (least-privilege — create separate IAM user for backup):
  {
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::dokploy-backups-<account-id>",
      "arn:aws:s3:::dokploy-backups-<account-id>/*"
    ]
  }
  # Explicitly DENY s3:DeleteObject to prevent accidental/malicious deletion

Daily cron script (/etc/cron.d/pg-backup-s3):
  0 2 * * * root /usr/local/bin/backup-postgres-s3.sh >> /var/log/pg-backup.log 2>&1

Script logic:
  1. For each of 16 databases: pg_dump -Fc | gzip > /tmp/backup/<date>/<slug>.dump.gz
  2. Verify each dump: pg_restore --list <file> | wc -l > 0
  3. aws s3 cp /tmp/backup/<date>/ s3://dokploy-backups-<id>/<date>/ --recursive \
       --sse AES256 --storage-class STANDARD_IA
  4. Verify upload: aws s3 ls s3://dokploy-backups-<id>/<date>/ | count matches local count
  5. If any step fails: send alert (New Relic or email) and exit non-zero
  6. Remove local /tmp/backup/<date>/

Restore test procedure (monthly):
  1. Pull one day's dumps from S3 to a throwaway container
  2. Run pg_restore into a test database
  3. Run schema verification manifest comparison
  4. Confirm success, delete test data

Monitoring:
  - New Relic custom event or alert if backup cron exits non-zero
  - Alert if S3 bucket has no object newer than 25 hours
```

**Gate:** This S3 backup configuration must be implemented before the Azure resource group is deleted (Phase 7). It is acceptable to run Phase 6 deallocation with only Lightsail snapshots + local pg_dumps, but the S3 layer must be in place before the Azure fallback is permanently removed.

---

## 19. CLAIMS REVIEW — WORDING CORRECTIONS

The following claims from the previous version have been downgraded to match actual evidence:

| Previous claim | Corrected claim |
|---------------|-----------------|
| "Exact blueprint ID: `ubuntu_24_04`" | ✅ **NOW VERIFIED**: blueprintId `ubuntu_24_04`, isActive=True, confirmed via `GetBlueprints` API (eu-west-1, 2026-08-15; eu-west-2, 2026-08-16) |
| "Proven safe" (2 disks → 1) | "Evidence supports safety: no UUID/device dependencies found in 5 search locations; no scripts found in 3 searched directories; not an exhaustive proof" |
| "No unknown remains (v1)" | "All pre-provisioning checks complete. Target changed to eu-west-2 (London) — eu-south-2 stuck in Enabling. No blockers remain." |
| "~10 sec transfer" | "Transfer completes when rsync exits 0 — time not assumed" |
| "~30 sec restore" | "Restore completes when all pg_restore processes exit 0 — time not assumed" |
| "~2-3 minutes downtime" | "Downtime window: Steps 6–10 of cutover; duration depends on Cloudflare tunnel deregistration latency (typically under 60 seconds) plus cloudflared startup; total expected under 5 minutes but gate is on validation, not elapsed time" |
| "DB names: tenant_prochat, tenant_viadieden..." | **Corrected**: Actual DB names are `prochat`, `viadieden`, `statuslink`, etc. `tenant_*` are schema names within those databases |
| "...match by db name" | **Removed**: Replaced by deterministic slug-based container mapping in Section 13 |
| "GHCR credentials likely still valid" | "GHCR PAT expiry unknown; validity must be tested by attempting a pull during Phase 3 setup" |
| "ACME copying sufficient — YES" | "Copying acme.json avoids re-issuance, but cert validity for the new IP is implicit in Cloudflare Tunnel routing — no independent certificate validation is needed since TLS termination is at Cloudflare edge" |

---

## 20. COMPLETE ARCHITECTURE SUMMARY

### A. Source Architecture

| Component | Verified Value |
|-----------|---------------|
| Provider | Azure |
| VM | Standard_D4as_v5, Spain Central |
| vCPU | 4 |
| RAM | 16 GB |
| Architecture | x86_64 |
| OS | Ubuntu 24.04.3 LTS |
| OS Disk | 30 GB Premium SSD (P4), 86% used |
| Data Disk | 256 GiB Standard_LRS HDD, ext4 filesystem 126 GiB, 38 GiB used |
| Docker | 29.2.0, containerd 2.2.1, overlayfs |
| Swarm | Single-node |
| Proxy | Traefik v3.6.7, HTTP-01 ACME, httpChallenge |
| Ingress | cloudflared (systemd), JWT token 184 chars |
| Mesh | Tailscale (hostname: `dokploy-new`, tailnet: `prochat.tools`) |
| Monitoring | New Relic Infrastructure |
| Platform | Dokploy `sha256:72c082d0...` |
| Total persistent data | ~1.5 GB (excl. rebuildable images and access.log) |

### B. Target Architecture

| Component | Value | Status |
|-----------|-------|--------|
| Provider | AWS Lightsail | — |
| Bundle | `xlarge_3_0` | ✅ Verified in eu-west-2 (London) — 2026-08-16 |
| vCPU | 4 | ✅ API-confirmed |
| RAM | 16 GB | ✅ API-confirmed |
| Architecture | x86_64 | ✅ Lightsail standard instances; compatible with source |
| OS | Ubuntu 24.04 LTS | ✅ blueprintId `ubuntu_24_04` API-confirmed in eu-west-2 — 2026-08-16 |
| Disk | 320 GB SSD (single disk) | ✅ API-confirmed |
| Transfer | 6,144 GB/month | ✅ API-confirmed |
| Region | eu-west-2 London (primary) | ✅ Fully operational — API-verified 2026-08-16 |
| Historical reference | eu-west-1 Ireland | ✅ Previously verified — not the target |
| Historical original target | eu-south-2 Spain | Was primary target; stuck in Enabling; replaced by eu-west-2 |
| Price | $84.00/month | ✅ API-confirmed in eu-west-2 (2026-08-16) |
| Docker | 29.2.0 (install exact version) | — |
| ACME | Copy acme.json — no re-issuance needed | — |
| Firewall | SSH/22 only; no port 80/443 | — |

### C. Why Evidence Supports 2 Disks → 1 Disk

| Evidence | Finding |
|----------|---------|
| Files referencing disk UUID | Only `/etc/fstab` and `/etc/docker/daemon.json` (searched all of `/etc`, `/opt`, `/usr/local/bin`, `/root`, cron.d, systemd units) |
| Scripts with disk path | None found in searched locations |
| containerd config disk ref | Commented out; uses defaults |
| Docker daemon.json | Path-based (`/mnt/data-dokploy/docker`); works as regular directory |
| Capacity fit | 38 GiB used vs 320 GiB target = 12% utilization |
| Performance | Source is Standard HDD; target is SSD (improvement) |

Caveat: search was not exhaustive of all filesystem locations. The risk of an undiscovered hard-coded disk reference is assessed as low but not zero.

### D. Every Secret / Credential

| Secret | Source path | Secure transfer method |
|--------|------------|----------------------|
| Dokploy PG password | Literal `dokploy` in container env | Re-set by Dokploy installer; no transfer needed |
| Dokploy token_seed | `/mnt/.../dokploy/_data/.token_seed` (133 B) | `scp` direct, SHA-256 verify |
| GHCR PAT | `/home/master/.docker/config.json` (123 B) | `scp` direct, `docker pull` test |
| Cloudflare Tunnel token | `/etc/systemd/system/cloudflared.service` ExecStart | Copy service file via `scp` |
| Cloudflare Origin cert key | `/etc/dokploy/traefik/dynamic/dokploy-origin.key` | `rsync --perms` |
| Let's Encrypt account key | Inside `acme.json` | `rsync --perms` |
| New Relic license key | `/etc/newrelic-infra.yml` (40-char key) | `scp` then edit cloud/location attributes |
| Tailscale auth key | Does not exist on source; generate new one-time key | Tailscale admin → Auth keys → One-time |
| All app Postgres passwords | In per-app `.env` files under `/etc/dokploy/` | Included in `/etc/dokploy/` rsync |
| Kratos DSN (Supabase) | In Kratos compose `.env` | Included in rsync |
| Umami DSN (Supabase) | In Umami compose `.env` | Included in rsync |

No secret value appears in this document or in terminal output.

### E. Backup Layers — Before Migration

1. Azure enhanced backup (application-consistent, running daily)
2. Fresh pg_dump of all 16 databases (taken at Phase 3 start, verified readable)
3. Azure manual disk snapshot (taken at Phase 4 Step 1)
4. Dump files retained on Azure VM until Phase 6 deallocation

### F. Backup Layers — After Migration

1. Lightsail daily auto-snapshot (crash-consistent, enabled at provisioning)
2. Manual Lightsail snapshot after Phase 5 validation (permanent)
3. pg_dump cron to local `/var/backups/pgdump/` (daily at 02:00 UTC)
4. **S3 off-instance backup layer** (mandatory, configure within 24h of Phase 5)
5. Azure deallocated VM retained until Phase 7 (7+ days)

### G. Azure Deallocation Point

| Milestone | Action |
|-----------|--------|
| Phase 5 passes (all domains healthy, monitoring green) | Start 2-hour observation |
| 2+ hours stable, no errors | Create manual Lightsail snapshot; then deallocate Azure VM |
| 7+ days stable, S3 backup configured and verified | Delete Azure resource group (manual approval required) |

Deallocation stops billing but retains disks. Only resource group deletion is irreversible.

### H. Resource Mutation by Phase

| Phase | AWS mutations allowed | Azure mutations allowed |
|-------|-----------------------|------------------------|
| 0 (current) | NONE | NONE |
| 1 Provisioning | Create instance, allocate static IP, attach IP, configure firewall, enable auto-snapshot | NONE |
| 2 Setup | Install packages, configure Docker, setup filesystem | NONE |
| 3 Data import | Pull images, restore DBs, copy config | pg_dump only (read-only to DB) |
| 4 Cutover | Start cloudflared | Stop cloudflared; stop app services |
| 5 Stabilize | Normal operation | NONE |
| 6 Deallocation | Normal operation | Deallocate VM |
| 7 Cleanup | Normal operation | Delete resource group |

---

## PHASE 1 RESULTS — PROVISIONING + EMPTY-HOST VALIDATION

**Date:** 2026-08-16
**Status:** ✅ ALL GATES PASS

### Provisioned Resources

| Resource | Name | Details |
|----------|------|---------|
| Instance | `dokploy-aws` | eu-west-2a, ubuntu_24_04, xlarge_3_0, running |
| Instance ARN | `arn:aws:lightsail:eu-west-2:909439522876:Instance/74bf0f48-d8bd-46d0-8e01-394126716235` | — |
| Static IP | `dokploy-aws-ip` → `18.135.240.168` | Attached to dokploy-aws |
| Firewall | SSH/22 from `5.249.73.210/32` only | No port 80, no port 443 |
| Auto-snapshot | ✅ Enabled (Phase 2A) — daily at 03:00 UTC | Resolved after IAM policy updated |

### Base OS Verification

| Property | Value |
|----------|-------|
| Architecture | x86_64 |
| OS | Ubuntu 24.04.4 LTS |
| Hostname | ip-172-26-3-123 (default — will change post-Dokploy) |
| CPU | 4 cores |
| RAM | 15 GiB (16 GB) |
| Root filesystem | 309G ext4 on NVMe (320 GB SSD) |
| Disk usage | 1% (2.5G used) |
| Inode usage | 1% |

### Filesystem Structure

| Path | Purpose | Status |
|------|---------|--------|
| `/mnt/data-dokploy/` | Data root (replaces Azure's separate disk mount) | ✅ Created |
| `/mnt/data-dokploy/docker` | Docker data-root | ✅ Created, Docker confirmed using it |
| `/mnt/data-dokploy/containerd` | containerd state → bind mount to `/var/lib/containerd` | ✅ Active post-reboot |
| `/mnt/data-dokploy/dokploy/applications` | Dokploy apps → bind mount to `/etc/dokploy/applications` | ✅ Active post-reboot |
| `/etc/docker/daemon.json` | `{"data-root": "/mnt/data-dokploy/docker"}` | ✅ Configured |
| `/etc/fstab` | Two bind-mount entries (nofail) | ✅ Survives reboot |

### Runtime Versions

| Component | Installed | Source (Azure) | Status |
|-----------|-----------|----------------|--------|
| Docker CE | 29.2.0 | 29.2.0 | ✅ Exact match |
| containerd | 2.2.3 | 2.2.1 | ✅ Compatible (minor patch) |
| Docker Compose | v5.4.0 | — | ✅ Installed |
| Storage driver | overlayfs | overlayfs | ✅ Match |

### Cold Reboot Test Results (10/10 PASS)

| Gate | Check | Result |
|------|-------|--------|
| 1 | `/var/lib/containerd` bind mount active | ✅ PASS |
| 2 | `/etc/dokploy/applications` bind mount active | ✅ PASS |
| 3 | DockerRootDir = `/mnt/data-dokploy/docker` | ✅ PASS |
| 4 | Docker service active | ✅ PASS |
| 5 | containerd service active | ✅ PASS |
| 6 | `/var/lib/docker` does NOT exist | ✅ PASS |
| 7 | Ownership root:root, correct modes (755/710/700) | ✅ PASS |
| 8 | Disk 1%, inodes 1% | ✅ PASS |
| 9 | Systemd chain: docker → containerd → basic.target (no mount failures) | ✅ PASS |
| 10 | Zero Docker/containerd/mount errors in journal | ✅ PASS |

### Empty-Host Smoke Test

`docker run --rm hello-world` succeeded from `/mnt/data-dokploy/docker` data-root. Image pulled, ran, cleaned up. No `/var/lib/docker` created.

### Single-Disk Runtime Behavior

**EMPIRICALLY VERIFIED.** The two-disk-to-one-disk architecture is confirmed operational:
- fstab bind mounts survive cold reboot
- Docker uses path-based data-root on the single disk
- containerd state lives under the same filesystem via bind mount
- No separate disk UUID or device dependency exists

### Instance Name History

Originally created as `dokploy-london` (2026-08-16T10:02). Lightsail does not support instance rename. Deleted and recreated as `dokploy-aws` (2026-08-16T10:09) per explicit user instruction. Old static IP `dokploy-london-ip` released; new `dokploy-aws-ip` allocated and attached.

---

## PHASE 2A RESULTS — BACKUP + EMPTY DOKPLOY PLATFORM

**Date:** 2026-08-16
**Status:** ✅ ALL STEPS COMPLETE

### Step 1: Auto-Snapshot Enabled

| Property | Value |
|----------|-------|
| Auto-snapshot | ✅ Enabled |
| Schedule | 03:00 UTC daily |
| Status | Enabling → Active |

### Step 3: Empty Dokploy Platform Deployed

Platform deployed manually (official installer URL unreachable — `get.dokploy.com` DNS failed). Services pinned to exact source digests/tags:

| Service | Image | Replicas | Status |
|---------|-------|----------|--------|
| `dokploy` | `dokploy/dokploy:latest` (sha256:72c082d0...) | 1/1 | ✅ Running |
| `dokploy-postgres` | `postgres:16` | 1/1 | ✅ Running |
| `dokploy-redis` | `redis:7` | 1/1 | ✅ Running |
| `dokploy-traefik` | `traefik:v3.6.7` | 1/1 | ✅ Running |

**Platform infrastructure:**
- Docker Swarm: single-node, active
- Network: `dokploy-network` (overlay)
- Traefik config: `/etc/dokploy/traefik/traefik.yml` — uses `providers.swarm` (v3 syntax)
- Dokploy port: 3000 (published)
- Traefik ports: 80, 443, 8080 (dashboard)

**Traefik v3 fix applied:** Original config used deprecated `providers.docker.swarmMode` (removed in v3). Rewritten to use `providers.swarm` with correct endpoint syntax. Traefik healthy after fix.

### Step 5: Post-Dokploy Cold Reboot Validation (10/10 PASS)

Instance rebooted via `aws lightsail reboot-instance`. All gates verified after reboot:

| Gate | Check | Result |
|------|-------|--------|
| 1 | `/var/lib/containerd` bind mount active | ✅ PASS — `/dev/nvme0n1p1[/mnt/data-dokploy/containerd]` |
| 2 | `/etc/dokploy/applications` bind mount active | ✅ PASS — `/dev/nvme0n1p1[/mnt/data-dokploy/dokploy/applications]` |
| 3 | Docker data-root = `/mnt/data-dokploy/docker` | ✅ PASS |
| 4 | Docker service active | ✅ PASS |
| 5 | containerd service active | ✅ PASS |
| 6 | Docker Swarm active | ✅ PASS |
| 7 | All 4 platform services 1/1 | ✅ PASS — dokploy, postgres, redis, traefik all 1/1 |
| 8 | No critical journal errors | ✅ PASS — only transient veth/networkctl (Swarm startup) |
| 9 | Expected ports only | ✅ PASS — 22, 80, 443, 3000, 8080, 2377, 7946 |
| 10 | No production credentials | ✅ PASS — 0 .env files found |

### Step 6: Manual Baseline Snapshot

| Property | Value |
|----------|-------|
| Name | `dokploy-aws-pre-production-baseline-20260816` |
| Created | 2026-08-16T10:33:24+01:00 |
| Status | pending → available |
| Type | Manual (persists indefinitely, not deleted with instance) |

### Known Behaviors (not failures)

- **`/var/lib/docker/network/files/`** (28KB): Expected Docker Swarm overlay LB metadata. Separate from data-root. Created by Swarm init regardless of `data-root` setting.
- **Transient `networkctl` errors at boot:** Docker/Swarm veth interfaces appear transiently during container startup before systemd-networkd can track them. Benign.
- **Lightsail SSH certs:** Temporary ECDSA certs with ~13 min validity. Must fetch fresh credentials via `get-instance-access-details` before each SSH session after any gap.

---

## PHASE 3A RESULTS — PRODUCTION STATE CAPTURE + SECURE STAGING

**Date:** 2026-08-16
**Status:** ✅ ALL STEPS COMPLETE
**Source capture timestamp:** 2026-08-16T10:00–10:15 UTC
**Azure drift detected:** NO — all 16 containers running, cloudflared active, 42 containers total

### Step 0: Baseline Snapshot Gate

| Property | Value |
|----------|-------|
| Snapshot name | `dokploy-aws-pre-production-baseline-20260816` |
| Status | ✅ `available` |
| Size | 320 GB |

### Step 3: Source Verification Manifests

All 16 manifests generated and stored at `/var/lib/dokploy-migration-staging/manifests/` on AWS.

| # | Slug | PG | DB | Size (bytes) | Tables |
|---|------|----|----|-------------|--------|
| 1 | dokploy-postgres | 16.13 | dokploy | 12,770,327 | 61 |
| 2 | apps-internal-n8n-cvjx2s | 17.7 | n8n | — | 54 |
| 3 | compose-bypass-optical-alarm-tb4ukd | 15 | prochat | — | — |
| 4 | compose-connect-wireless-application-d1n939 | 15 | viadieden | — | — |
| 5 | compose-copy-auxiliary-protocol-3gfh3x | 15 | statuslink | — | — |
| 6 | compose-copy-cross-platform-bus-wojn3n | 15 | prokitstudio | — | — |
| 7 | compose-copy-open-source-interface-fkhqrw | 15 | saysthebible | — | — |
| 8 | compose-copy-redundant-capacitor-zc4esw | 15 | prokit | — | — |
| 9 | compose-generate-mobile-microchip-tksvis | 15 | openfund | — | — |
| 10 | compose-generate-wireless-bandwidth-v7bvut | 15 | cedula | — | — |
| 11 | compose-hack-open-source-driver-mmchh4 | 15 | jpvbootcamp | — | — |
| 12 | compose-input-open-source-bandwidth-droye2 | 15 | jpvbootcamp | — | — |
| 13 | compose-navigate-optical-monitor-vi714i | 15 | olivetoorganizing | — | — |
| 14 | compose-quantify-1080p-system-tp1q5f | 15 | saaskitstudio | — | — |
| 15 | compose-reboot-cross-platform-driver-6l6dun | 15 | resend | — | — |
| 16 | compose-synthesize-bluetooth-panel-tg5mhy | 15 | saaskit | — | — |

### Step 4: Database Dumps

All 16 dumps streamed directly from Azure to AWS (no persistent files written on Azure). Transfer method: `docker exec pg_dump | ssh ... "cat > ..."` via `az vm run-command invoke`.

| # | Dump file | Exit | Size | pg_restore --list |
|---|-----------|------|------|-------------------|
| 1 | dokploy-postgres.dump | 0 | 244,798 | 399 items |
| 2 | apps-internal-n8n-cvjx2s.dump | 0 | 381,554 | Valid (PG17 format, PG16 pg_restore can't list — PGDMP header confirmed) |
| 3 | compose-bypass-optical-alarm-tb4ukd.dump | 0 | 17,379 | 54 items |
| 4 | compose-connect-wireless-application-d1n939.dump | 0 | 1,076 | 16 items |
| 5 | compose-copy-auxiliary-protocol-3gfh3x.dump | 0 | 54,124 | 130 items |
| 6 | compose-copy-cross-platform-bus-wojn3n.dump | 0 | 7,014 | 32 items |
| 7 | compose-copy-open-source-interface-fkhqrw.dump | 0 | 69,857 | 140 items |
| 8 | compose-copy-redundant-capacitor-zc4esw.dump | 0 | 5,648 | 27 items |
| 9 | compose-generate-mobile-microchip-tksvis.dump | 0 | 136,645 | 161 items |
| 10 | compose-generate-wireless-bandwidth-v7bvut.dump | 0 | 13,928 | 46 items |
| 11 | compose-hack-open-source-driver-mmchh4.dump | 0 | 38,695 | 89 items |
| 12 | compose-input-open-source-bandwidth-droye2.dump | 0 | 6,111 | 29 items |
| 13 | compose-navigate-optical-monitor-vi714i.dump | 0 | 1,132 | 16 items |
| 14 | compose-quantify-1080p-system-tp1q5f.dump | 0 | 9,050 | 34 items |
| 15 | compose-reboot-cross-platform-driver-6l6dun.dump | 0 | 113,191 | 64 items |
| 16 | compose-synthesize-bluetooth-panel-tg5mhy.dump | 0 | 8,696 | 34 items |

Total dump size: ~1.1 MB. All dumps non-empty, all exit 0.

### Step 5: Non-DB Persistent State

All transferred to `/var/lib/dokploy-migration-staging/non-db/` on AWS (staging only, NOT active runtime).

| Item | Source size | Staged as | Status |
|------|------------|-----------|--------|
| Dokploy .token_seed | 133 B | `token/.token_seed` | ✅ |
| n8n config + binaryData | 112 B | `n8n/n8n-data.tar.gz` | ✅ |
| Buildflow relay JSON | 7,325 B | `buildflow/buildflow-data.tar.gz` | ✅ |
| Ory/Kratos config | 3,434 B | `kratos/kratos-config.tar.gz` | ✅ |
| GHCR config | 123 B | `ghcr/config.json` (mode 600) | ✅ |
| Historical pgdumps | 86 MB | `pgdumps-historical/pgdumps.tar.gz` | ✅ |
| Traefik (acme+certs+config) | 53 KB acme | `traefik/traefik-config.tar.gz` | ✅ |
| cloudflared service file | 451 B | `cloudflared/cloudflared.service` | ✅ |
| New Relic config | 171 B | `newrelic/newrelic-infra.yml` (mode 600) | ✅ |
| Dokploy compose configs | 46 KB | `dokploy-compose.tar.gz` | ✅ |
| Dokploy monitoring | 126 KB | `dokploy-monitoring.tar.gz` | ✅ |
| Dokploy applications (source+.env) | 530 MB | `dokploy-applications.tar.gz` (426 MB compressed) | ✅ |

### Step 6: Credential Handling

All credentials staged to root-accessible files only. NONE activated:
- Cloudflare tunnel token: in `cloudflared.service` file — NOT installed as systemd service
- GHCR PAT: in `ghcr/config.json` — NOT in Docker's config path
- New Relic key: in `newrelic/newrelic-infra.yml` — NOT installed to `/etc/`
- n8n encryption key: inside compose .env — NOT in active runtime
- Application .env files: in tar archives — NOT deployed
- Origin cert/key: in tar archive — NOT in Traefik path
- ACME account key: in tar archive — NOT in Traefik path

### Step 7: Side-Effect Audit

#### Classification

| Category | Service/App | Risk | Status |
|----------|------------|------|--------|
| **A — Safe (isolated)** | dokploy, dokploy-postgres, dokploy-redis, dokploy-traefik | Internal platform only | May start in shadow |
| **B — Outbound side effects** | n8n (6 active workflows), apps-internal-free-resend (email), StatusLink (webhook broker), OpenFund (Stripe), all web apps with STRIPE env | Posts to Facebook, sends emails, fires webhooks, processes payments | **MUST REMAIN STOPPED** |
| **C — Scheduled/background** | n8n workflows (6 active: Facebook Autopublish, Mind Steward, StatusLink Callback, Video Post Dispatcher, calendar-manage, calendar-read), Dokploy schedule (1 item) | Automated job execution | **MUST REMAIN STOPPED** |
| **D — Requires external dep** | Umami (Supabase 10.0.2.4:5433), Ory Kratos (Supabase), compose-index-haptic-firewall (Kratos) | External DB via Tailscale subnet route | **MUST REMAIN STOPPED until Tailscale configured** |
| **E — Unknown** | fala (standalone), app-override-online-interface-1wzjpb (locally built) | Purpose unclear | **MUST REMAIN STOPPED** |

#### n8n Active Workflows (6) — ALL must be disabled before ANY n8n start

1. `STB - Facebook Autopublish` — posts to Facebook
2. `Save to Mind — Capture for Mind Steward` — writes to external system
3. `StatusLink - Callback to Broker Push` — fires webhooks
4. `Video Orchestrator — Post Dispatcher` — posts video to platforms
5. `calendar-manage-fixed` — modifies calendar
6. `calendar-read-stable` — reads calendar (likely safe but grouped with workers)

#### Critical n8n constraint

`N8N_ENCRYPTION_KEY` must be preserved exactly — it encrypts stored credentials. Present in compose .env (confirmed). Without this key, all n8n credential data is unreadable after restore.

### Step 8: Staging Validation Summary

| Check | Result |
|-------|--------|
| All 16 DB dumps present | ✅ 16/16 |
| All dumps pass pg_restore --list | ✅ 15/16 native + 1 verified by PGDMP header (PG17 version) |
| Source verification manifests complete | ✅ 16/16 |
| All required non-DB state present | ✅ 12/12 items |
| SHA-256 checksums generated | ✅ Stored at `checksums/phase3a-checksums.txt` |
| No production runtime path overwritten | ✅ All in `/var/lib/dokploy-migration-staging/` |
| Empty Dokploy platform still healthy | ✅ 4 services 1/1 |
| Production tunnel absent on AWS | ✅ cloudflared not installed |
| No production apps started on AWS | ✅ Only platform services running |
| Azure still serves production | ✅ 42 containers, cloudflared active |
| Transfer infrastructure cleaned up | ✅ Keys removed, firewall closed |

---

## REMAINING BLOCKERS

### ✅ RESOLVED — IAM: `lightsail:GetBlueprints`

**Status:** Resolved (2026-08-15)
**Blueprint confirmed:** `ubuntu_24_04`, isActive=True, platform=LINUX_UNIX, version=24.04 LTS

### ✅ RESOLVED — TARGET REGION CHANGED to eu-west-2 (London)

**Status:** Resolved 2026-08-16 by explicit user decision.
**History:** eu-south-2 (Spain) was the primary target. `RegionSetupInProgressException` on both `GetBundles` and `GetBlueprints` persisted across 2026-08-15 and 2026-08-16 with no resolution timeline.
**Decision:** eu-west-2 (London) selected as new target — already used successfully by another Lightsail server in this account.
**eu-west-2 API verification (2026-08-16):** Both `GetBlueprints` and `GetBundles` returned expected values. No `RegionSetupInProgressException`. Region fully operational.

| Verified Field | Value |
|----------------|-------|
| blueprintId | `ubuntu_24_04` |
| blueprint isActive | `true` |
| blueprint platform | `LINUX_UNIX` |
| bundleId | `xlarge_3_0` |
| bundle isActive | `true` |
| vCPU | 4 |
| RAM | 16.0 GB |
| Disk | 320 GB |
| Transfer | 6,144 GB/month |
| Price | $84.00/month |
| Static IPv4 | 1 included |

### Known Uncertainties (not blockers — handled at execution time)

| Item | Status |
|------|--------|
| GHCR PAT expiry | Unknown — test during Phase 3 setup with `docker pull ghcr.io/prochattools/prochat:latest` |
| `viadieden` and `olivetoorganizing` table counts | Schemas confirmed present; exact counts captured in Phase 3 pre-dump manifest |
| Tailscale SSH from local → Azure | Blocked by tailnet ACL policy — use `az vm run-command invoke` for all Azure-side operations |
| Buildflow relay data semantics | 3 JSON files captured and will be transferred; application-level behavior post-migration not pre-validated |
| eu-west-2 bundle price | ✅ $84.00/month — API-confirmed in eu-west-2 (2026-08-16) |

---

## VERDICT

**✅ PHASE 3A COMPLETE — all production state captured and staged on AWS**

All 16 databases dumped, all non-DB persistent state transferred, all credentials staged (not activated), side-effect audit complete. Azure remains authoritative production. AWS has complete shadow copy in staging directory only.

**All Phase 0 + Phase 1 + Phase 2A + Phase 3A checks are complete:**
- ✅ Baseline snapshot available before data capture
- ✅ All 16 PostgreSQL databases dumped (exit 0, pg_restore verified)
- ✅ All non-DB persistent state captured (12 items)
- ✅ SHA-256 checksums for all artifacts
- ✅ Source verification manifests (schemas, extensions, roles, table counts)
- ✅ Credentials staged ONLY — none activated
- ✅ Side-effect audit complete — B/C/D/E services classified
- ✅ 6 n8n active workflows identified for mandatory disablement
- ✅ No production runtime paths overwritten
- ✅ No production apps started on AWS
- ✅ No Cloudflare tunnel on AWS
- ✅ Azure unmodified and still serving production (42 containers, cloudflared active)
- ✅ Transfer infrastructure cleaned up (keys removed, firewall closed)

**Exact next action:** Phase 3B — Shadow Restore + Validation. This would:
1. Restore DB dumps into app-specific Postgres containers on AWS
2. Deploy Dokploy-managed services from staged source
3. Verify all services start cleanly in ISOLATED mode (no tunnel, no outbound)
4. Keep all B/C/D/E services STOPPED
5. Validate DB integrity against source manifests

Requires explicit approval. Azure remains authoritative. No cutover.
