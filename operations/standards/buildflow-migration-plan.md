# BuildFlow Production Relay Migration Plan

**Document Status:** Foundation (Phase 0 → Phase 1 Ready)  
**Current Phase:** Phase 0 (Local only)  
**Created:** 2026-04-27  
**Owner:** Brain repo  
**Related:** `operations/runbooks/buildflow-deployment.md`

**IMPORTANT — Right now (Phase 0):**
- ✅ Local BuildFlow is running and primary
- ✅ Production relay does NOT exist yet
- ✅ Brain Console shows local BuildFlow only
- ✅ This document is planning-only; no changes to local config or infrastructure have been made
- ⏳ Next phase (Phase 1) will create production Dokploy application

---

## Phases

### Phase 0: Current State ✅

**Status:** Production ready (local only)

- ✅ Local BuildFlow running on localhost:3054
  - Agent: 3052
  - Relay: 3053
  - Web: 3054
- ✅ Local orchestrator (`buildflow-orchestrator.sh`) manages all three
- ✅ Brain Console shows unified health check at `/api/unified-health`
- ✅ Local relay data persists in `~/.buildflow/`
- ✅ No production relay service exists yet

**Verification:**
```bash
curl http://localhost:3054/api/unified-health
# Expected: 200 OK with all three services healthy
```

---

### Phase 1: Deploy Production Relay (Parallel) ⏳

**Preconditions:**
- [ ] BuildFlow repo has `.github/workflows/deploy.yml` with secrets
- [ ] Dockerfile builds both relay and web in single image
- [ ] RELAY_ADMIN_TOKEN and BUILDFLOW_ACTION_TOKEN generated
- [ ] Dokploy Web project app created
- [ ] GHCR pull credentials configured in Dokploy
- [ ] Environment variables set in Dokploy app

**During Phase 1:**
- Local BuildFlow continues as PRIMARY service
- Production relay deployable but not active in CustomGPT yet
- Domain `buildflow.prochat.tools` resolves to production relay
- Local relay isolated at localhost:3053 (unchanged)

**Verification:**
```bash
# Production relay should be ready
curl https://buildflow.prochat.tools/ready
# Expected: 200 OK {"ready": true}

# But local relay is still the active one
curl http://localhost:3054/api/unified-health
# Expected: 200 OK (local trio still working)
```

**Rollback:** Stop Dokploy app. Keep volume. Local BuildFlow unaffected.

---

### Phase 2: Test Production Relay (2–3 days)

**Prerequisites:** Phase 1 complete and verified

**During Phase 2:**
- Maintainer local agent tests connection to production relay
- Custom GPT still uses localhost:3054 (local agent) via ngrok or tunnel
- Production domain serves health checks only
- Verify all endpoints before going live

**Testing Checklist:**
```bash
# Device registration
curl -X POST https://buildflow.prochat.tools/api/register \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# WebSocket connection
# (Use wscat or custom script to test upgrade)
curl -i -N -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  https://buildflow.prochat.tools/api/bridge/ws

# Admin check
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices

# Local relay still works
curl http://localhost:3054/api/unified-health
```

**Success Criteria:**
- [ ] Device registration succeeds
- [ ] WebSocket connects without errors
- [ ] Admin token authentication works
- [ ] No device IDs in `/health` response
- [ ] Local relay remains stable
- [ ] No unusual error logs in production relay

**Next Step:** Phase 3 (switch) requires go-ahead from testing phase

**Rollback:** Stop or delete Dokploy app. No data loss (volume persists).

---

### Phase 3: Production Validation (5–7 days)

**Prerequisites:** Phase 2 passed all checks

**During Phase 3:**
- Custom GPT integration testing with production relay
- Real user requests routed through production
- Monitoring for errors, latency, device stability
- Load test if possible
- Watchdog on logs and metrics

**Production Validation Checklist:**
```bash
# Real request via ChatGPT Custom GPT (manual test)
curl -X POST https://buildflow.prochat.tools/api/actions/search \
  -H "Authorization: Bearer $BUILDFLOW_ACTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 5}'
# Expected: 200 OK with vault search results

# Check relay logs
ssh dokploy "docker logs buildflow-relay | tail -100" | grep -i error

# Check connected devices
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices | jq .
```

**Success Criteria:**
- [ ] Real ChatGPT actions work through production relay
- [ ] No crashes or restart loops
- [ ] Response times < 500ms
- [ ] All device tokens working
- [ ] Local BuildFlow still active as fallback
- [ ] 48+ hours with zero unplanned restarts

**Danger Signals:**
- X WebSocket connections failing
- X Device registrations rejected
- X High error rate (> 5% of requests)
- X Local relay degradation
- X Volume filling up

**Next Step:** Go/no-go decision after 5–7 days

**Rollback:** Revert CustomGPT to localhost. Stop Dokploy app. Investigate logs.

---

### Phase 4: Switch (After Phase 3 Validation) 🔄

**Prerequisites:** Phase 3 complete, stable, and approved

**During Phase 4:**
- Update CustomGPT to use production buildflow.prochat.tools
- Update the dashboard to show production relay status
- Local relay continues as warm standby
- Gradual traffic shift (if A/B testable) or immediate switch
- Monitor both local and production concurrently
- Maintain dual-relay status for 48 hours

**Switch Procedure:**
```bash
# 1. Update CustomGPT action URL (manual, in ChatGPT dashboard)
# From: http://localhost:3054/api/actions/... (via tunnel)
# To: https://buildflow.prochat.tools/api/actions/...

# 2. Verify health before and after
curl https://buildflow.prochat.tools/ready  # production
curl http://localhost:3054/api/unified-health  # local

# 3. Update the dashboard (future: show both relays in sidebar)
# (Currently no change needed; local remains primary)

# 4. Run verification suite (see Phase 3 checks above)

# 5. Document status in operations/infrastructure/infra.md
```

**Success Criteria (Phase 4):**
- [ ] CustomGPT uses production URL
- [ ] First real action via production succeeds
- [ ] Local relay accessible as backup
- [ ] Dashboard shows status of both
- [ ] Zero user-facing downtime

**Dual-Relay Monitoring (48 hours):**
- Monitor production error rate
- Monitor local relay in case rollback needed
- Check log sizes (relay audit logs may grow)
- Verify no data corruption

**Next Step:** Phase 5 (cleanup) after 48–72 hours of stable production

**Rollback:** 
```bash
# Revert CustomGPT to localhost relay via tunnel
# Keep production relay running as warm standby
# No data loss (both volumes independent)
```

---

### Phase 5: Cleanup (After 48–72 Hours Stability) 🧹

**Prerequisites:** Phase 4 stable, no incidents, team confidence high

**During Phase 5:**
- Option 1: Keep local relay as warm standby (recommended)
- Option 2: Archive local relay data and remove from the active dashboard
- Remove references to localhost-only BuildFlow from docs
- Update infrastructure docs to mark production as primary

**Cleanup Actions:**
```bash
# Option 1 (Warm Standby — Recommended)
# Keep local BuildFlow running
# Update the dashboard to show "Local" label
# Document fallback procedure in runbook

# Option 2 (Remove Local)
# Backup local relay data
tar czf /tmp/buildflow-local-backup.tar.gz ~/.buildflow/
# Stop local BuildFlow from the dashboard
# Archive local relay from documentation
```

**Documentation Updates:**
- Remove "Phase 0" current-state section from migration plan
- Update infra.md to mark buildflow.prochat.tools as primary
- Document fallback procedure if production fails
- Update dashboard labels if local is removed

**Success Criteria:**
- [ ] Local relay data backed up (if removing)
- [ ] No local relay references in active docs
- [ ] Production marked as canonical in infra.md
- [ ] Team trained on emergency fallback
- [ ] Runbook updated with prod-primary assumption

**Future Maintenance:**
- Monitor relay audit logs (will grow — Phase 2E adds rotation)
- Monitor volume size and clean requests.json if needed (manual interim)
- Update dashboard labels annually

---

## Parallel State: Key Constraints

**During entire migration (Phases 1–4):**

- ✅ Local BuildFlow remains PRIMARY until Phase 4
- ✅ Local relay data never moves, never deleted
- ✅ Local dashboard continues unchanged until explicitly told
- ✅ Local agent can connect to BOTH relays (for testing)
- ✅ Production relay has independent data volume (no cross-contamination)
- ✅ Local and production tokens are separate (independent auth)

**What does NOT change until Phase 5:**
- Local orchestrator script
- Local health check endpoint
- Local database/vault location
- Dashboard UI (shows only local until told to add production)
- CustomGPT integration (uses local until Phase 4)

---

## Emergency Rollback (Any Phase)

If production relay has a critical issue at any time:

```bash
# 1. Stop production (1 minute)
ssh dokploy "docker stop buildflow-relay"
# OR
curl -X POST https://dokploy.prochat.tools/api/application.stop \
  -H "x-api-key: $DOKPLOY_API_KEY"

# 2. Revert CustomGPT to local (manual, 2 minutes)
# Edit CustomGPT action URL back to localhost via tunnel

# 3. Verify local relay healthy (1 minute)
curl http://localhost:3054/api/unified-health

# 4. Investigate logs (ongoing)
ssh dokploy "docker logs buildflow-relay | tail -200"
```

**Total Time to Rollback:** < 5 minutes

**Data Safety:** 
- Production volume (`buildflow-data`) persists — can be restarted
- Local relay independent — no impact from production restart
- All device tokens and history preserved on both sides

---

## Decision Gates (Go/No-Go)

### Gate 1: Phase 1 → Phase 2
**Verify:**
- [ ] Dokploy app exists and is healthy
- [ ] GHCR image pulls successfully
- [ ] Environment variables set correctly
- [ ] `/ready` and `/health` endpoints respond
- [ ] No errors in startup logs

**Go/No-Go Decision:** Team consensus + 0 errors in health checks

---

### Gate 2: Phase 2 → Phase 3
**Verify:**
- [ ] Device registration works
- [ ] WebSocket connects and upgrades
- [ ] Admin token authentication works
- [ ] No device IDs in /health response
- [ ] Local relay still stable

**Go/No-Go Decision:** All tests pass + maintainer confidence

---

### Gate 3: Phase 3 → Phase 4 (CRITICAL)
**Verify:**
- [ ] 5–7 days of production relay stability
- [ ] Zero unplanned restarts
- [ ] Response times acceptable (< 500ms p95)
- [ ] Error rate < 5%
- [ ] Local relay unchanged and accessible
- [ ] Production monitoring in place (NewRelic, logs)

**Go/No-Go Decision:** Stakeholder sign-off + metrics green for 48+ hours

---

### Gate 4: Phase 4 → Phase 5
**Verify:**
- [ ] CustomGPT uses production URL (live traffic)
- [ ] 48–72 hours of production traffic routed successfully
- [ ] Zero unplanned production incidents
- [ ] Local relay remains responsive
- [ ] Team trained on emergency fallback

**Go/No-Go Decision:** No critical incidents + local backup verified

---

## Monitoring & Observability

### During All Phases

**Health Checks (automated):**
```bash
# Every 5 minutes (via the dashboard or Dokploy health check)
curl -s https://buildflow.prochat.tools/ready | jq .ready
# Alert if: not ready OR timeout

# Local relay backup check (hourly)
curl -s http://localhost:3054/api/unified-health | jq .status
# Alert if: not "ok"
```

**Logs (manual review):**
```bash
# Daily during Phase 2–3
ssh dokploy "docker logs buildflow-relay | tail -50" | grep -i error

# Weekly during Phase 4–5
# (Consider adding to nightly scheduler)
```

**Metrics (NewRelic, if available):**
- Response time p50, p95, p99
- Error rate
- Device connection count
- Request throughput

---

## Communication

- **Phase 1–2:** Internal testing only (no user communication needed)
- **Phase 3:** May monitor real CustomGPT usage (no communication needed)
- **Phase 4:** Production switch (notify team + interested users)
  - Subject: "BuildFlow relay now served from `buildflow.prochat.tools` (production)"
  - Details: Performance unchanged, same functionality, rollback plan if issues
- **Phase 5:** Cleanup + documentation update (internal only)

---

## Troubleshooting Reference

| Issue | Phase | Resolution |
|-------|-------|-----------|
| Dokploy app won't start | 1 | Check startup logs: `docker logs buildflow-relay`. Verify env vars. Check volume permissions. |
| WebSocket upgrade fails | 2 | Check Dokploy domain middleware. Verify Traefik config allows `Upgrade` header. May require Dokploy domain edit. |
| Device registration 500 | 2–3 | Check relay has started. Verify data directory writeable. Check RELAY_ADMIN_TOKEN not interfering. |
| Token auth returns 403 | 2–3 | Verify RELAY_ADMIN_TOKEN matches env var. Check Bearer header format. |
| Local relay degraded during prod test | 2–3 | Independent issue. Restart local relay: `bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh restart`. Test both again. |
| Production response slow | 3–4 | Check Dokploy VM CPU/RAM. Check relay audit logs. May need log cleanup (interim). |
| CustomGPT fails after switch | 4 | Check `buildflow.prochat.tools` is responsive. Verify BUILDFLOW_ACTION_TOKEN matches env. Check logs. Rollback to local if needed. |

---

## Success Metrics

**Phase 1:** Dokploy app created, image pulls, all endpoints respond

**Phase 2:** Device registration, WebSocket, admin auth all work

**Phase 3:** 7 days + 0 unplanned restarts + 0 critical errors

**Phase 4:** Zero user-visible downtime, local backup accessible

**Phase 5:** Cleanup complete, documentation updated, team trained

---

## Appendix: Local-Only vs Production Reference

### Local BuildFlow (Phase 0)
- **Domain:** localhost:3054 (via ngrok/tunnel for external access)
- **Backend Mode:** direct-agent (web → agent directly)
- **Relay:** runs locally, state in ~/.buildflow/
- **Token:** BUILDFLOW_ACTION_TOKEN for ChatGPT (local dev only)
- **Primary Use:** Development, maintainer testing

### Production BuildFlow (Phase 1+)
- **Domain:** buildflow.prochat.tools (HTTPS public)
- **Backend Mode:** relay-agent (web → relay → device)
- **Relay:** runs on Dokploy, state in Docker volume `buildflow-data`
- **Token:** RELAY_ADMIN_TOKEN for admin ops, device tokens for auth
- **Primary Use:** Production CustomGPT, multi-user multi-device

---

**Last Updated:** 2026-04-27  
**Next Review:** After Phase 1 deployment
