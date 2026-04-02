#!/usr/bin/env bash
# check-db-prod.sh — PreToolUse hook for /supabase skill
# Detects destructive or write operations targeting the production database.
# Blocks if a production connection string is combined with a destructive command.
# Returns {"permissionDecision":"ask","message":"..."} to warn, or {} to allow.
set -euo pipefail

PROD_IP="100.71.31.88"
PROD_PATTERNS=("$PROD_IP" 'SUPABASE_DB_URL[^_]' 'SUPABASE_DB_URL"' "SUPABASE_DB_URL\$")

INPUT=$(cat)

# Extract command — try fast grep first, fall back to Python
CMD=$(printf '%s' "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//' || true)
if [ -z "$CMD" ]; then
  CMD=$(printf '%s' "$INPUT" | python3 -c 'import sys,json; print(json.loads(sys.stdin.read()).get("tool_input",{}).get("command",""))' 2>/dev/null || true)
fi
[ -z "$CMD" ] && echo '{}' && exit 0

CMD_LOWER=$(printf '%s' "$CMD" | tr '[:upper:]' '[:lower:]')

# --- Check if command targets production ---
TARGETS_PROD=false
if printf '%s' "$CMD" | grep -qE "$PROD_IP" 2>/dev/null; then
  TARGETS_PROD=true
fi
# Also catch when $SUPABASE_DB_URL (write, no READONLY suffix) is used
# We look for the env var name appearing in the command
if printf '%s' "$CMD" | grep -qE '\$\{?SUPABASE_DB_URL\b' 2>/dev/null; then
  TARGETS_PROD=true
fi

# If not targeting production, allow without warning
if [ "$TARGETS_PROD" = false ]; then
  echo '{}'
  exit 0
fi

# --- Production is targeted — check for destructive or write operations ---
WARN=""
SEVERITY=""

# db reset — always fatal on production
if printf '%s' "$CMD_LOWER" | grep -qE '\bdb\s+reset\b' 2>/dev/null; then
  WARN="PRODUCTION DATABASE: db reset wipes the entire database. This is IRREVERSIBLE and will destroy all client data."
  SEVERITY="BLOCKED"
fi

# DROP TABLE / DROP DATABASE
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE 'drop\s+(table|database|schema)' 2>/dev/null; then
  WARN="PRODUCTION DATABASE: DROP detected. This permanently destroys database objects and all their data."
  SEVERITY="BLOCKED"
fi

# TRUNCATE
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE '\btruncate\b' 2>/dev/null; then
  WARN="PRODUCTION DATABASE: TRUNCATE detected. This deletes all rows from a table — irreversible without a backup."
  SEVERITY="BLOCKED"
fi

# prisma db push / prisma migrate dev — bypasses migration safety on prod
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE 'prisma\s+(db\s+push|migrate\s+dev)' 2>/dev/null; then
  WARN="PRODUCTION DATABASE: prisma db push / migrate dev must never run against production. Only prisma migrate deploy via Dokploy build is allowed."
  SEVERITY="BLOCKED"
fi

# db push — apply schema changes (warn, don't hard-block — user may have reviewed)
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE '\bdb\s+push\b' 2>/dev/null; then
  # Allow if --dry-run is present
  if printf '%s' "$CMD_LOWER" | grep -q '\-\-dry-run' 2>/dev/null; then
    echo '{}'
    exit 0
  fi
  WARN="PRODUCTION DATABASE: db push applies schema changes to production. Have you reviewed the diff with --dry-run first?"
  SEVERITY="WARN"
fi

# DELETE FROM (SQL) — data deletion
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE '\bdelete\s+from\b' 2>/dev/null; then
  WARN="PRODUCTION DATABASE: DELETE FROM detected. This removes rows from a production table. Confirm scope and intent."
  SEVERITY="WARN"
fi

# UPDATE (SQL) — bulk data modification
if [ -z "$WARN" ] && printf '%s' "$CMD_LOWER" | grep -qE '\bupdate\s+\w+\s+set\b' 2>/dev/null; then
  WARN="PRODUCTION DATABASE: UPDATE statement targeting production. Verify the WHERE clause is correct before proceeding."
  SEVERITY="WARN"
fi

# --- Output ---
if [ -n "$WARN" ]; then
  # Log
  mkdir -p ~/.gstack/analytics 2>/dev/null || true
  echo '{"event":"db_prod_hook","severity":"'"$SEVERITY"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
    >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true

  WARN_ESCAPED=$(printf '%s' "$WARN" | sed 's/"/\\"/g')
  printf '{"permissionDecision":"ask","message":"[db-safety] %s"}\n' "$WARN_ESCAPED"
else
  # Production targeted but safe operation (read-only, migration list, gen types, etc.)
  echo '{}'
fi
