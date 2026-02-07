#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/var/backups/pgdump"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-prisma/migrations}"

: "${APP_SLUG:?set APP_SLUG}"
: "${SYSTEM_DATABASE_URL:?set SYSTEM_DATABASE_URL}"
: "${DATABASE_URL:?set DATABASE_URL}"

APP_SCHEMA="tenant_${APP_SLUG}"
LEGACY_APP_SLUG="${LEGACY_APP_SLUG:-}"
BACKUP_DIR="${BACKUP_ROOT}/${APP_SLUG}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${BACKUP_DIR}/deploy_${TS}.log"
STATUS_FILE="${BACKUP_DIR}/last_run.status"

DETECTED_MIGRATIONS="unknown"
BACKUP_PATH="none"
MIGRATION_STATUS="not_run"
SMOKE_STATUS="not_run"
RESTORE_STATUS="not_needed"
DETECT_REASON=""
BACKUP_ELIGIBLE="yes"
RESET_TENANT="no"
EXTRA_MIGRATIONS_IN_DB=""
RESET_FLAG="${PROKIT_RESET_TENANT_ON_MIGRATION_MISMATCH:-}"

normalize_psql_url() {
  local url="$1"
  if [[ "$url" != *"?"* ]]; then
    printf '%s' "$url"
    return
  fi

  local base="${url%%\?*}"
  local query="${url#*\?}"
  local filtered
  filtered=$(printf '%s' "$query" | sed -E 's/(^|&)schema=[^&]*//g; s/^&//; s/&&+/&/g; s/&$//')

  if [[ -z "$filtered" ]]; then
    printf '%s' "$base"
  else
    printf '%s?%s' "$base" "$filtered"
  fi
}

SYSTEM_DATABASE_URL_PSQL="$(normalize_psql_url "$SYSTEM_DATABASE_URL")"
DATABASE_URL_PSQL="$(normalize_psql_url "$DATABASE_URL")"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

write_status() {
  mkdir -p "$BACKUP_DIR"
  {
    printf 'LAST_RUN_TS=%q\n' "$TS"
    printf 'DETECTED_MIGRATIONS=%q\n' "$DETECTED_MIGRATIONS"
    printf 'DETECT_REASON=%q\n' "$DETECT_REASON"
    printf 'RESET_TENANT=%q\n' "$RESET_TENANT"
    printf 'EXTRA_MIGRATIONS_IN_DB=%q\n' "$EXTRA_MIGRATIONS_IN_DB"
    printf 'BACKUP_PATH=%q\n' "$BACKUP_PATH"
    printf 'MIGRATION_STATUS=%q\n' "$MIGRATION_STATUS"
    printf 'SMOKE_STATUS=%q\n' "$SMOKE_STATUS"
    printf 'RESTORE_STATUS=%q\n' "$RESTORE_STATUS"
    printf 'LOG_FILE=%q\n' "$LOG_FILE"
  } > "$STATUS_FILE"
}

on_error() {
  local exit_code=$?
  echo "deploy failed (exit $exit_code)" >&2
  write_status
  exit "$exit_code"
}
trap on_error ERR

require_cmd psql
require_cmd pg_dump
require_cmd pg_restore

validate_slug() {
  local slug="$1"
  if [[ -z "$slug" || ! "$slug" =~ ^[a-z0-9_]+$ ]]; then
    echo "invalid slug: $slug (allowed: [a-z0-9_]+)" >&2
    exit 1
  fi
}

get_pg_major() {
  local version_num
  version_num=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA -c "SHOW server_version_num;")
  if [[ -z "$version_num" ]]; then
    echo "failed to read server_version_num" >&2
    exit 1
  fi

  echo $((version_num / 10000))
}

get_client_major() {
  local ver major
  ver=$(pg_dump --version | awk '{print $NF}')
  major=${ver%%.*}
  if [[ -z "$major" ]]; then
    echo "failed to parse pg_dump version" >&2
    exit 1
  fi
  echo "$major"
}

SERVER_PG_MAJOR="$(get_pg_major)"
CLIENT_PG_MAJOR="$(get_client_major)"

if (( CLIENT_PG_MAJOR < SERVER_PG_MAJOR )); then
  echo "pg_dump/pg_restore major (${CLIENT_PG_MAJOR}) is older than server (${SERVER_PG_MAJOR})" >&2
  echo "Install a matching client (postgresql-client-${SERVER_PG_MAJOR})." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || true
if ! touch "${BACKUP_DIR}/.write_test" 2>/dev/null; then
  echo "backup dir not writable: $BACKUP_DIR" >&2
  echo "If running in a Swarm service, bind-mount $BACKUP_ROOT at the service level." >&2
  exit 1
fi
rm -f "${BACKUP_DIR}/.write_test"

exec > >(tee -a "$LOG_FILE") 2>&1

write_status

echo "[deploy] app schema: $APP_SCHEMA"

maybe_rename_legacy_tenant() {
  local legacy_slug="$1"

  if [[ -z "$legacy_slug" ]]; then
    return 0
  fi

  if [[ "$legacy_slug" == "$APP_SLUG" ]]; then
    return 0
  fi

  validate_slug "$legacy_slug"
  validate_slug "$APP_SLUG"

  local legacy_schema="tenant_${legacy_slug}"
  local target_schema="$APP_SCHEMA"
  local target_exists legacy_exists

  target_exists=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA     -c "SELECT 1 FROM information_schema.schemata WHERE schema_name='${target_schema}';")

  if [[ "$target_exists" == "1" ]]; then
    echo "[deploy] legacy rename skipped: target schema already exists (${target_schema})"
    return 0
  fi

  legacy_exists=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA     -c "SELECT 1 FROM information_schema.schemata WHERE schema_name='${legacy_schema}';")

  if [[ "$legacy_exists" != "1" ]]; then
    echo "[deploy] legacy rename skipped: legacy schema not found (${legacy_schema})"
    return 0
  fi

  echo "[deploy] renaming legacy tenant: ${legacy_slug} -> ${APP_SLUG}"
  NODE_ENV=production npm run db:rename -- --from "$legacy_slug" --to "$APP_SLUG" --apply
}

maybe_rename_legacy_tenant "$LEGACY_APP_SLUG"

detect_migrations() {
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    echo "missing migrations dir: $MIGRATIONS_DIR" >&2
    exit 1
  fi

  local schema_exists table_exists failed_count rolled_count
  schema_exists=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM information_schema.schemata WHERE schema_name='${APP_SCHEMA}';")

  if [[ "$schema_exists" != "1" ]]; then
    BACKUP_ELIGIBLE="no"
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="schema_missing"
    return 0
  fi

  table_exists=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM information_schema.tables WHERE table_schema='${APP_SCHEMA}' AND table_name='_prisma_migrations';")

  if [[ "$table_exists" != "1" ]]; then
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="migrations_table_missing"
    if [[ "${RESET_FLAG}" == "1" ]]; then
      RESET_TENANT="yes"
      echo "[deploy] _prisma_migrations missing; reset enabled (PROKIT_RESET_TENANT_ON_MIGRATION_MISMATCH=1)"
    fi
    return 0
  fi

  failed_count=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT count(*) FROM ${APP_SCHEMA}._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;")
  if [[ "$failed_count" != "0" ]]; then
    echo "found unfinished migrations in ${APP_SCHEMA} (count=$failed_count)" >&2
    exit 1
  fi

  rolled_count=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT count(*) FROM ${APP_SCHEMA}._prisma_migrations WHERE rolled_back_at IS NOT NULL;")
  if [[ "$rolled_count" != "0" ]]; then
    echo "found rolled-back migrations in ${APP_SCHEMA} (count=$rolled_count)" >&2
    exit 1
  fi

  local disk_list db_list missing_in_db extra_in_db
  disk_list=$(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -type f -name migration.sql \
    -printf '%P\n' | cut -d/ -f1 | sort -u)

  db_list=$(psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT migration_name FROM ${APP_SCHEMA}._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;")

  list_to_stream() {
    if [[ -n "$1" ]]; then
      printf '%s\n' "$1"
    fi
  }

  missing_in_db=$(comm -23 <(list_to_stream "$disk_list") <(list_to_stream "$db_list"))
  extra_in_db=$(comm -13 <(list_to_stream "$disk_list") <(list_to_stream "$db_list"))

  if [[ -n "$extra_in_db" ]]; then
    EXTRA_MIGRATIONS_IN_DB="$extra_in_db"
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="migrations_missing_on_disk"

    if [[ "${RESET_FLAG}" == "1" ]]; then
      RESET_TENANT="yes"
      echo "[deploy] migration history mismatch detected; reset enabled (PROKIT_RESET_TENANT_ON_MIGRATION_MISMATCH=1)"
      echo "[deploy] extra migrations in DB:"
      printf '%s\n' "$extra_in_db"
      return 0
    fi

    echo "db has migrations not present on disk:" >&2
    echo "$extra_in_db" >&2
    echo "" >&2
    echo "This usually happens when migrations were squashed/removed or when this tenant schema was reused by another app." >&2
    echo "Fix options:" >&2
    echo "- Restore the missing migration directories on disk (must match checksums), OR" >&2
    echo "- Reset the tenant schema on next deploy (DATA LOSS) by setting:" >&2
    echo "  PROKIT_RESET_TENANT_ON_MIGRATION_MISMATCH=1" >&2
    exit 1
  fi

  if [[ -n "$missing_in_db" ]]; then
    DETECTED_MIGRATIONS="yes"
    DETECT_REASON="pending_on_disk"
  else
    DETECTED_MIGRATIONS="no"
    DETECT_REASON="none"
  fi
}

backup_schema() {
  BACKUP_PATH="${BACKUP_DIR}/${APP_SCHEMA}_${TS}.dump"
  pg_dump --dbname="$SYSTEM_DATABASE_URL_PSQL" \
    --format=custom --no-owner --no-acl \
    --schema="$APP_SCHEMA" \
    --file="$BACKUP_PATH"

  write_status

  # retention: keep last 3, delete older than 14 days
  ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | tail -n +4 | xargs -r rm -f
  find "$BACKUP_DIR" -type f -name '*.dump' -mtime +14 -delete
}

smoke_check() {
  local schema_exists table_exists
  schema_exists=$(psql "$DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM information_schema.schemata WHERE schema_name='${APP_SCHEMA}';")
  if [[ "$schema_exists" != "1" ]]; then
    echo "missing tenant schema: ${APP_SCHEMA}" >&2
    return 1
  fi

  table_exists=$(psql "$DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT 1 FROM information_schema.tables WHERE table_schema='${APP_SCHEMA}' AND table_name='_prisma_migrations';")
  if [[ "$table_exists" != "1" ]]; then
    echo "missing _prisma_migrations table in ${APP_SCHEMA}" >&2
    return 1
  fi
}

restore_schema() {
  local dump_path="$1"
  if [[ ! -f "$dump_path" ]]; then
    echo "restore dump not found: $dump_path" >&2
    return 1
  fi

  if ! pg_restore -l "$dump_path" | grep -q "$APP_SCHEMA"; then
    echo "refusing restore: dump does not reference $APP_SCHEMA" >&2
    return 1
  fi

  pg_restore --dbname="$SYSTEM_DATABASE_URL_PSQL" \
    --clean --if-exists --no-owner --no-acl \
    --schema="$APP_SCHEMA" \
    --single-transaction --exit-on-error \
    "$dump_path"
}

reset_tenant_schema() {
  validate_slug "$APP_SLUG"
  local role="${APP_SCHEMA}_user"
  local ident_safe='^[a-z0-9_]+$'
  if [[ ! "$APP_SCHEMA" =~ $ident_safe || ! "$role" =~ $ident_safe ]]; then
    echo "refusing reset: unsafe identifiers (schema=${APP_SCHEMA}, role=${role})" >&2
    exit 1
  fi

  echo "[deploy] resetting tenant schema + role (data will be lost): ${APP_SCHEMA}"
  psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS ${APP_SCHEMA} CASCADE;"
  psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS ${role};"
}

detect_migrations
write_status

echo "[deploy] detected migrations: $DETECTED_MIGRATIONS ($DETECT_REASON)"

if [[ "$DETECTED_MIGRATIONS" == "yes" && "$BACKUP_ELIGIBLE" == "yes" ]]; then
  echo "[deploy] creating backup"
  backup_schema
elif [[ "$DETECTED_MIGRATIONS" == "yes" && "$BACKUP_ELIGIBLE" != "yes" ]]; then
  echo "[deploy] skipping backup (schema missing)"
else
  echo "[deploy] no pending migrations; backup skipped"
fi

MIGRATION_STATUS="running"
write_status

if [[ "$RESET_TENANT" == "yes" ]]; then
  reset_tenant_schema
fi

echo "[deploy] running db:init"
npm run db:init -- --slug "$APP_SLUG"

# Refresh DATABASE_URL from the tenant registry so Prisma uses the exact
# credentials that were provisioned/updated by db:init (avoid env drift).
get_host_port() {
  node - <<'NODE'
const u = new URL(process.env.SYSTEM_DATABASE_URL);
const host = u.hostname;
const port = u.port || '5432';
process.stdout.write(host + '\n' + port + '\n');
NODE
}

read_tenant_row() {
  psql "$SYSTEM_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -tA \
    -c "SELECT db_user || '|' || db_password || '|' || schema_name FROM public.tenants WHERE slug='${APP_SLUG}';"
}

tenant_row="$(read_tenant_row || true)"
if [[ -n "$tenant_row" ]]; then
  tenant_user="${tenant_row%%|*}"
  rest="${tenant_row#*|}"
  tenant_password="${rest%%|*}"
  tenant_schema="${rest#*|}"
  read -r db_host db_port < <(get_host_port)

  ident_safe='^[a-z0-9_]+$'
  if [[ "$tenant_user" =~ $ident_safe && "$tenant_schema" =~ $ident_safe && -n "$tenant_password" ]]; then
    DATABASE_URL="postgresql://${tenant_user}:${tenant_password}@${db_host}:${db_port}/postgres?schema=${tenant_schema}"
    export DATABASE_URL
    DATABASE_URL_PSQL="$(normalize_psql_url "$DATABASE_URL")"
    echo "[deploy] refreshed DATABASE_URL from registry (user=${tenant_user}, schema=${tenant_schema})"
  else
    echo "[deploy] failed to refresh DATABASE_URL from registry (unsafe values)" >&2
  fi
else
  echo "[deploy] tenant registry row not found; continuing with existing DATABASE_URL env" >&2
fi

echo "[deploy] running db:migrate:prod"
NODE_ENV=production npm run db:migrate:prod

MIGRATION_STATUS="success"
write_status

SMOKE_STATUS="running"
write_status

if smoke_check; then
  SMOKE_STATUS="success"
  write_status
  echo "[deploy] smoke check passed"
else
  SMOKE_STATUS="failed"
  write_status
  echo "[deploy] smoke check failed"

  if [[ "$DETECTED_MIGRATIONS" == "yes" && "$BACKUP_PATH" != "none" ]]; then
    echo "[deploy] attempting auto-restore"
    if restore_schema "$BACKUP_PATH"; then
      RESTORE_STATUS="success"
      write_status
      echo "[deploy] restore complete, re-running smoke check"
      if smoke_check; then
        SMOKE_STATUS="success"
        write_status
        echo "[deploy] smoke check passed after restore"
      else
        SMOKE_STATUS="failed"
        RESTORE_STATUS="failed"
        write_status
        echo "[deploy] smoke check failed after restore" >&2
        exit 1
      fi
    else
      RESTORE_STATUS="failed"
      write_status
      echo "[deploy] auto-restore failed" >&2
      exit 1
    fi
  else
    RESTORE_STATUS="skipped_no_backup"
    write_status
    echo "[deploy] no backup available; cannot auto-restore" >&2
    exit 1
  fi
fi

write_status

echo "[deploy] done"
