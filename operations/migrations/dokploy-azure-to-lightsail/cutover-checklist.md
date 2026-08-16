# Cutover Checklist — Azure Dokploy → AWS Lightsail

**Prepared:** 2026-08-16
**Version:** 1.0 (Phase 3C3)

---

## PRE-CUTOVER — Safe preparation (already complete)

- [x] AWS instance provisioned and healthy (dokploy-aws, eu-west-2)
- [x] Docker/Swarm/Dokploy platform running (4/4 services)
- [x] Tailscale joined (dokploy-aws, 100.71.47.24)
- [x] Supabase TCP route verified (10.0.2.4:5433 PASS)
- [x] All 16 databases restored and healthy
- [x] All application images pre-pulled (21/24; 3 error-status apps exempted)
- [x] buildflow pinned to exact source digest (sha256:4a657686731b)
- [x] All compose definitions validated
- [x] Traefik config + TLS certs in place
- [x] GHCR auth configured
- [x] cloudflared binary installed (v2026.8.2) — service MASKED
- [x] New Relic config staged (not yet installed)
- [x] All shadow suppressions active (24 apps, 17 compose, 1 schedule)
- [x] Snapshot `dokploy-aws-pre-cutover-ready-20260816` AVAILABLE
- [x] Production application tasks: 0
- [x] Azure unmodified
- [x] Supabase unmodified

---

## ==================================================
## MANUAL APPROVAL GATE
## ==================================================
## Steve must explicitly authorize cutover before any
## step below this line may be executed.
## ==================================================

- [ ] **EXPLICIT CUTOVER APPROVAL FROM STEVE RECEIVED**

---

## CUTOVER — Production mutation

### Phase A — Traffic freeze
- [ ] A1. Maintenance window announced
- [ ] A2. Azure cloudflared stopped (`sudo systemctl stop cloudflared` on Azure)
- [ ] A3. Azure cloudflared confirmed stopped (process count = 0)
- [ ] A4. No public traffic reaching Azure (dashboard + curl confirm)

### Phase B — Stop Azure writers
- [ ] B1. All 13 Azure application Supabase writers scaled to 0
- [ ] B2. n8n stopped on Azure
- [ ] B3. Umami stopped on Azure
- [ ] B4. Ory Kratos stopped on Azure
- [ ] B5. **VERIFIED: ZERO Azure application containers with write capability**
- [ ] B6. Azure `docker ps` shows only DB + platform containers

### Phase C — Final database sync
- [ ] C1. Final dumps of all 16 Azure databases (exit 0 for each)
- [ ] C2. Dumps transferred to AWS (verify file sizes reasonable)
- [ ] C3. All 16 databases restored to AWS (exit 0 for each)
- [ ] C4. Table counts validated on AWS (match Phase 3B + delta)

### Phase D — Azure Cloudflare confirmed offline
- [ ] D1. Azure cloudflared still stopped (re-check)
- [ ] D2. Cloudflare dashboard confirms Azure connector offline
- [ ] D3. No traffic flowing to Azure

### Phase E — Activate AWS services
- [ ] E1. Locally-built images rebuilt (free-resend, app-override, prochat-accountant)
- [ ] E2. New Relic installed and configured
- [ ] E3. Shadow suppressions reversed (per-app autoDeploy, schedule enabled)
- [ ] E4. Non-Supabase services started (n8n, vault-legal-frontend, jccp-holdings, yeshua-academy, free-resend, buildflow)
- [ ] E5. Non-Supabase services health checks passing

### NO-DUAL-WRITER CHECKPOINT
- [ ] **Azure Supabase writer count = 0 (re-verified now)**
- [ ] **Active connections to 10.0.2.4 from Azure = 0 (verified)**
- [ ] **Supabase-ready — AWS writers may now start**

- [ ] E6. Ory Kratos started on AWS
- [ ] E7. All 13 application Supabase writers started on AWS
- [ ] E8. Umami started on AWS (last — analytics writer)
- [ ] E9. All services health-checked (no restart loops)

### Phase F — Activate Cloudflare tunnel on AWS
- [ ] F1. cloudflared service unmasked on AWS
- [ ] F2. cloudflared service file placed (from .staged)
- [ ] F3. cloudflared enabled and started
- [ ] F4. cloudflared process running
- [ ] F5. Cloudflare dashboard shows AWS connector active

---

## POST-CUTOVER VALIDATION

- [ ] V1. At least 3 production domains respond correctly (HTTPS 200/301/302)
- [ ] V2. n8n UI accessible and workflows active
- [ ] V3. Supabase connections healthy from AWS apps
- [ ] V4. No container restart loops in first 5 minutes
- [ ] V5. No container restart loops in first 15 minutes
- [ ] V6. Email test (Resend) — send one test email
- [ ] V7. Stripe webhook — verify reception if applicable
- [ ] V8. New Relic reporting from dokploy-aws
- [ ] V9. Post-cutover snapshot created: `dokploy-aws-post-cutover-YYYYMMDD`

---

## ROLLBACK — CLASS A (no production writes on AWS)

**Use when:** AWS cloudflared never started, OR started but no Supabase writer processed a real request.

- [ ] RA1. Stop AWS cloudflared (`sudo systemctl stop cloudflared`)
- [ ] RA2. Confirm AWS cloudflared process = 0
- [ ] RA3. Start Azure cloudflared (`sudo systemctl start cloudflared`)
- [ ] RA4. Confirm Azure connector active in Cloudflare dashboard
- [ ] RA5. Confirm production traffic flows to Azure
- [ ] RA6. No data reconciliation needed — declare AWS shadow state preserved

---

## ROLLBACK — CLASS B (AWS accepted production writes)

**Use when:** Any AWS Supabase writer or local DB writer processed a real user request.

- [ ] RB1. **WRITE FREEZE** — stop ALL writers on BOTH Azure and AWS
- [ ] RB2. Stop AWS cloudflared
- [ ] RB3. **Confirm ZERO application containers with write capability on both sides**
- [ ] RB4. Identify which databases are authoritative:
  - [ ] AWS local PG = authoritative (Azure copies stale from cutover)
  - [ ] Supabase = current (single instance)
  - [ ] Azure local PG = STALE
- [ ] RB5. Consult Steve for rollback direction decision
- [ ] RB6. (If rolling back to Azure) Export AWS local DB writes → restore to Azure
- [ ] RB7. (If rolling back to Azure) Validate Azure data
- [ ] RB8. **(If rolling back to Azure) Supabase dual-write gate: confirm ZERO AWS Supabase writers before starting Azure Supabase writers**
- [ ] RB9. Choose traffic destination and activate cloudflared on selected host
- [ ] RB10. Monitor

---

## Key identifiers

| Property | Value |
|----------|-------|
| AWS instance | dokploy-aws |
| AWS static IP | 18.135.240.168 |
| AWS Tailscale IP | 100.71.47.24 |
| Azure Tailscale IP | 100.83.38.48 |
| Supabase Tailscale IP | 100.71.31.88 |
| Supabase endpoint | 10.0.2.4:5433 |
| Tunnel token location | /etc/systemd/system/cloudflared.service.staged |
| Pre-cutover snapshot | dokploy-aws-pre-cutover-ready-20260816 |
| Baseline snapshot | dokploy-aws-pre-production-baseline-20260816 |
| Schedule to re-enable | vyN0X3Y6OpO5b_cZbS0r3 (jpv-email-queue) |
