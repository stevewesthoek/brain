#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/var/backups/pgdump"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "missing required env var: $name" >&2
    exit 1
  fi
}

require_env APP_SLUG
require_env SYSTEM_DATABASE_URL
require_env DATABASE_URL
require_env NODE_ENV

# Dokploy env values are treated as literal strings. If DATABASE_URL references
# TENANT_DB_PASSWORD, expand it here before running the deploy gate.
if [[ "${DATABASE_URL}" == *'${TENANT_DB_PASSWORD}'* || "${DATABASE_URL}" == *'$TENANT_DB_PASSWORD'* ]]; then
  require_env TENANT_DB_PASSWORD
  DATABASE_URL="${DATABASE_URL//\${TENANT_DB_PASSWORD}/${TENANT_DB_PASSWORD}}"
  DATABASE_URL="${DATABASE_URL//\$TENANT_DB_PASSWORD/${TENANT_DB_PASSWORD}}"
  export DATABASE_URL
fi

PORT="${PORT:-3000}"
export PORT

if [[ ! -d "$BACKUP_ROOT" ]]; then
  echo "backup root missing: $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi

if ! awk -v p="$BACKUP_ROOT" '$5==p {found=1} END {exit !found}' /proc/self/mountinfo; then
  echo "bind mount missing for $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi

if ! touch "${BACKUP_ROOT}/.write_test" 2>/dev/null; then
  echo "backup root not writable: $BACKUP_ROOT" >&2
  echo "Dokploy UI: App -> General -> Volumes/Mounts -> Bind Mount -> Host Path + Mount Path" >&2
  echo "Add bind mount: host /var/backups/pgdump -> container /var/backups/pgdump (RW)" >&2
  exit 1
fi
rm -f "${BACKUP_ROOT}/.write_test"

./scripts/db/deploy-prod.sh

# Refresh DATABASE_URL from the tenant registry for the app runtime.
# This avoids relying on Dokploy expanding env vars inside DATABASE_URL.
if command -v psql >/dev/null 2>&1; then
  SYS_PSQL_URL="$(node -e "const u=new URL(process.env.SYSTEM_DATABASE_URL);u.search='';console.log(u.toString());")"
  TENANT_ROW="$(psql "$SYS_PSQL_URL" -v ON_ERROR_STOP=1 -tA -c "SELECT db_user || '|' || db_password || '|' || schema_name FROM public.tenants WHERE slug='${APP_SLUG}';" 2>/dev/null || true)"
  if [[ -n "$TENANT_ROW" ]]; then
    TENANT_USER="${TENANT_ROW%%|*}"
    REST="${TENANT_ROW#*|}"
    TENANT_PASSWORD="${REST%%|*}"
    TENANT_SCHEMA="${REST#*|}"
    DB_HOST="$(node -e "console.log(new URL(process.env.SYSTEM_DATABASE_URL).hostname)")"
    DB_PORT="$(node -e "console.log(new URL(process.env.SYSTEM_DATABASE_URL).port||'5432')")"
    IDENT_SAFE='^[a-z0-9_]+$'
    if [[ "$TENANT_USER" =~ $IDENT_SAFE && "$TENANT_SCHEMA" =~ $IDENT_SAFE && -n "$TENANT_PASSWORD" ]]; then
      export DATABASE_URL="postgresql://${TENANT_USER}:${TENANT_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres?schema=${TENANT_SCHEMA}"
      echo "[deploy] DATABASE_URL refreshed from registry for app start (user=${TENANT_USER}, schema=${TENANT_SCHEMA})"
    fi
  fi
fi

script_exists() {
  node -e "const pkg=require('./package.json');process.exit(pkg.scripts&&pkg.scripts['$1']?0:1)" >/dev/null 2>&1
}

if script_exists start:app; then
  exec npm run start:app
fi

if script_exists start:prod; then
  exec npm run start:prod
fi

if script_exists start:production; then
  exec npm run start:production
fi

if [[ -d .next && -f .next/BUILD_ID && -x node_modules/.bin/next ]]; then
  exec node_modules/.bin/next start -p "$PORT"
fi

echo "no production start command found" >&2
echo "Define scripts.start:app (preferred) or scripts.start:prod in package.json." >&2
exit 1
