#!/usr/bin/env bash
# Fail-closed pre-cutover preflight check for Dokploy Azure -> AWS Lightsail migration.
# Every check must PASS before cutover is authorized to proceed.
# On any FAIL: script exits non-zero. DO NOT proceed with cutover.

set -euo pipefail

FAIL=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; FAIL=1; }

echo "===== CUTOVER PREFLIGHT CHECK ====="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Resolve dynamic Dokploy postgres container (Swarm names include task ID suffix)
DOKPLOY_PG=$(docker ps --format '{{.Names}}' | grep '^dokploy-postgres\.' | head -1)
if [ -z "$DOKPLOY_PG" ]; then
  echo "[FAIL] Cannot locate dokploy-postgres container -- cannot run DB checks"
  exit 1
fi

echo "Dokploy PG container: $DOKPLOY_PG"
echo ""

# CHECK 1: Shadow suppression -- autoDeploy must be false on ALL applications
echo "--- CHECK 1: Application shadow suppression ---"
APP_ENABLED=$(docker exec "$DOKPLOY_PG" psql -U dokploy -d dokploy -t \
  -c 'SELECT COUNT(*) FROM application WHERE "autoDeploy" = true;' 2>/dev/null | tr -d ' ')
if [ "$APP_ENABLED" = "0" ]; then
  pass "All application autoDeploy=false (count=$APP_ENABLED)"
else
  fail "UNSAFE: $APP_ENABLED application(s) have autoDeploy=true"
fi

# CHECK 2: Shadow suppression -- autoDeploy must be false on ALL compose
echo "--- CHECK 2: Compose shadow suppression ---"
COMPOSE_ENABLED=$(docker exec "$DOKPLOY_PG" psql -U dokploy -d dokploy -t \
  -c 'SELECT COUNT(*) FROM compose WHERE "autoDeploy" = true;' 2>/dev/null | tr -d ' ')
if [ "$COMPOSE_ENABLED" = "0" ]; then
  pass "All compose autoDeploy=false (count=$COMPOSE_ENABLED)"
else
  fail "UNSAFE: $COMPOSE_ENABLED compose(s) have autoDeploy=true"
fi

# CHECK 3: Shadow suppression -- all schedules must be disabled
echo "--- CHECK 3: Schedule shadow suppression ---"
SCHED_ENABLED=$(docker exec "$DOKPLOY_PG" psql -U dokploy -d dokploy -t \
  -c 'SELECT COUNT(*) FROM schedule WHERE enabled = true;' 2>/dev/null | tr -d ' ')
if [ "$SCHED_ENABLED" = "0" ]; then
  pass "All schedules disabled (count=$SCHED_ENABLED)"
else
  fail "UNSAFE: $SCHED_ENABLED schedule(s) have enabled=true"
fi

# CHECK 4: cloudflared must be masked (not running, not startable)
echo "--- CHECK 4: cloudflared masked ---"
CF_STATE=$(systemctl is-enabled cloudflared 2>/dev/null; true)
CF_STATE=$(echo "$CF_STATE" | head -1 | tr -d '[:space:]')
if [ "$CF_STATE" = "masked" ]; then
  pass "cloudflared is masked"
else
  fail "UNSAFE: cloudflared state is '$CF_STATE' (expected: masked)"
fi

# CHECK 5: No Supabase-writer containers running (NO-DUAL-WRITER)
echo "--- CHECK 5: Zero Supabase production writer containers ---"
WRITERS=$(docker ps --format '{{.Names}}' | grep -cE '(prochat|cedula|jpv-bootcamp|openfund|fala|olivetoorganizing|boilerplate-general|saaskit|saaskit-studio|prokit|prokit-studio|saysthebible|viadieden|resend|statuslink|kratos)' || true)
if [ "$WRITERS" = "0" ]; then
  pass "Zero Supabase writer containers running"
else
  fail "UNSAFE: $WRITERS writer container(s) are running -- NO-DUAL-WRITER violation risk"
  docker ps --format '{{.Names}}' | grep -E '(prochat|cedula|jpv-bootcamp|openfund|fala|olivetoorganizing|boilerplate-general|saaskit|saaskit-studio|prokit|prokit-studio|saysthebible|viadieden|resend|statuslink|kratos)' | head -20 || true
fi

# CHECK 6: Expected postgres containers are running (DB sources intact)
# Excludes migration-rehearsal-* containers (temporary; removed in cleanup before cutover)
echo "--- CHECK 6: Database source containers running ---"
PG_COUNT=$(docker ps --format '{{.Names}}:{{.Image}}' | grep -E 'postgres:(15|16|17)' | grep -v 'migration-rehearsal' | wc -l || true)
if [ "$PG_COUNT" = "16" ]; then
  pass "16 postgres containers running (14xPG15 app + 1xPG17 n8n + 1xPG16 dokploy)"
else
  fail "UNEXPECTED: $PG_COUNT postgres containers running (expected 16)"
fi

# CHECK 7: Tailscale connectivity to Azure Dokploy
echo "--- CHECK 7: Tailscale reachability to Azure (100.83.38.48) ---"
if ping -c 1 -W 3 100.83.38.48 > /dev/null 2>&1; then
  pass "Azure Dokploy reachable via Tailscale"
else
  fail "Azure Dokploy NOT reachable via Tailscale (100.83.38.48) -- pg_dump will fail"
fi

# CHECK 8: Tailscale connectivity to Supabase
echo "--- CHECK 8: Tailscale reachability to Supabase (100.71.31.88:5433) ---"
if timeout 5 bash -c 'echo > /dev/tcp/100.71.31.88/5433' 2>/dev/null; then
  pass "Supabase reachable via Tailscale (100.71.31.88:5433)"
else
  fail "Supabase NOT reachable via Tailscale -- tenant schema sync will fail"
fi

# CHECK 9: Disk headroom (require >= 20 GB free on /)
echo "--- CHECK 9: Disk headroom ---"
FREE_KB=$(df / | awk 'NR==2{print $4}')
FREE_GB=$((FREE_KB / 1024 / 1024))
if [ "$FREE_GB" -ge 20 ]; then
  pass "Disk headroom OK: ${FREE_GB} GB free (required >= 20 GB)"
else
  fail "INSUFFICIENT DISK: ${FREE_GB} GB free (required >= 20 GB)"
fi

# CHECK 10: Docker daemon healthy
echo "--- CHECK 10: Docker daemon healthy ---"
if docker info > /dev/null 2>&1; then
  pass "Docker daemon responding"
else
  fail "Docker daemon not responding"
fi

# SUMMARY
echo ""
echo "===== PREFLIGHT RESULT ====="
if [ "$FAIL" = "0" ]; then
  echo "STATUS: ALL CHECKS PASSED -- cutover may proceed (pending explicit Steve authorization)"
  exit 0
else
  echo "STATUS: ONE OR MORE CHECKS FAILED -- DO NOT PROCEED WITH CUTOVER"
  exit 1
fi
