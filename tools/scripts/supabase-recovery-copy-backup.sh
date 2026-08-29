#!/usr/bin/env bash
set -Eeuo pipefail

# Durable, production-safe Supabase logical backup.
#
# The source of every logical dump is an isolated Azure AlternateLocation
# recovery copy. This script never runs pg_dump against the production VM.
# The default mode is read-only planning; --run is required for external
# Azure/Blob mutation. Secrets are transported only through ephemeral protected
# files/config input and are never logged or written to the repository.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AZURE_CLI_BIN="${AZURE_RECOVERY_CLI_BIN:-${AZURE_CLI_BIN:-/opt/homebrew/bin/az}}"
AZURE_PROVISIONER_BIN="${AZURE_DATA_PROVISIONER_BIN:-$HOME/.local/bin/azure-data-provisioner}"
AZURE_DESTROYER_BIN="${AZURE_DATA_DESTROYER_BIN:-$HOME/.local/bin/azure-data-destroyer}"
JQ_BIN="${JQ_BIN:-jq}"
CURL_BIN="${CURL_BIN:-curl}"
SSH_BIN="${SSH_BIN:-ssh}"
STATE_DIR="${SUPABASE_RECOVERY_STATE_DIR:-$REPO_ROOT/runtime/local/infrastructure}"
RUNTIME_STATE_FILE="${SUPABASE_RECOVERY_RUNTIME_STATE_FILE:-$STATE_DIR/backup-runtime-state.json}"
LOCK_DIR="${SUPABASE_RECOVERY_LOCK_DIR:-$STATE_DIR/supabase-recovery-copy.lock}"
REMOTE_SCRIPT=""

SUBSCRIPTION_ID="${AZURE_SUPABASE_SUBSCRIPTION_ID:-6e99b82d-43e3-41cc-ad94-8733afeb2a7e}"
LOCATION="${AZURE_SUPABASE_RECOVERY_LOCATION:-spaincentral}"
VAULT_RESOURCE_GROUP="${AZURE_BACKUP_RESOURCE_GROUP:-rg-saas-infra}"
VAULT_NAME="${AZURE_BACKUP_VAULT_NAME:-rsv-saas-infra}"
BACKUP_CONTAINER_NAME="${AZURE_BACKUP_CONTAINER_NAME:-iaasvmcontainer;iaasvmcontainerv2;rg-data-supabase;vm-supabase}"
BACKUP_ITEM_NAME="${AZURE_BACKUP_ITEM_NAME:-VM;iaasvmcontainerv2;rg-data-supabase;vm-supabase}"
SOURCE_VM_NAME="${AZURE_SOURCE_VM_NAME:-vm-supabase}"
PRODUCTION_RESOURCE_GROUP="${AZURE_PRODUCTION_RESOURCE_GROUP:-rg-data-supabase}"
STORAGE_ACCOUNT_NAME="${AZURE_RECOVERY_STORAGE_ACCOUNT_NAME:-}"
PROOFLY_HEALTH_URL="${PROOFLY_CANONICAL_HEALTH_URL:-https://getproofly.app/api/health}"
JPV_SERVICE_NAME="${JPV_PRODUCTION_SERVICE_NAME:-clients-jpv-bootcamp-app-tp9xrk}"
EXPECTED_DATABASE_COUNT=27
BACKUP_ROLE="${SUPABASE_BACKUP_ROLE:-postgres}"
RUN_ID=""
MODE="dry-run"
SCHEDULED="false"
TEMP_RG=""
TEMP_VM=""
TEMP_VNET=""
TEMP_SUBNET=""
TEMP_NSG=""
TEMP_STORAGE=""
TEMP_CREATED="false"
CLEANUP_STATUS="NOT_CREATED"
RECOVERY_POINT_ID=""
RECOVERY_POINT_TIME=""
RECOVERY_POINT_TYPE=""
BLOB_PREFIX=""
LAST_SUCCESS_AT=""
LAST_SUCCESS_RECOVERY_POINT_ID=""
RUN_STARTED_AT=""
ERROR_CODE=""

usage() {
  cat <<'USAGE'
Usage: supabase-recovery-copy-backup.sh [--dry-run] [--run] [--scheduled]

Default mode performs live read-only production/Azure/Blob preflight and
prints the exact planned isolated recovery-copy operation. --run is required
to create temporary Azure resources and upload a new Blob backup set.
USAGE
}

log() {
  printf 'supabase-recovery-copy: %s\n' "$*"
}

fail() {
  ERROR_CODE="$1"
  log "stop reason=$ERROR_CODE" >&2
  return 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "missing_command_${command_name}"
}

timestamp_utc() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

safe_run_id() {
  local candidate="$1"
  [[ "$candidate" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || fail "invalid_run_id"
}

parse_http_body() {
  local response="$1"
  HTTP_CODE="${response##*$'\nHTTP_CODE:'}"
  HTTP_BODY="${response%$'\nHTTP_CODE:'*}"
}

check_http() {
  local name="$1"
  local url="$2"
  local response
  response="$($CURL_BIN -fsS --connect-timeout 8 --max-time 20 -w $'\nHTTP_CODE:%{http_code}' "$url")" || fail "${name}_request_failed"
  parse_http_body "$response"
  [[ "$HTTP_CODE" == "200" ]] || fail "${name}_http_${HTTP_CODE}"
  printf '%s' "$HTTP_BODY"
}

preflight_production() {
  local jpv_body proofly_body supabase_probe
  log "production preflight start"

  jpv_body="$(check_http jpv_root https://jpvbootcamp.com/)"
  [[ -n "$jpv_body" ]] || fail "jpv_root_empty"

  jpv_body="$(check_http jpv_health https://jpvbootcamp.com/api/health)"
  "$JQ_BIN" -e '.ok == true and .deploymentEnv == "production"' <<<"$jpv_body" >/dev/null || fail "jpv_health_not_ok"

  jpv_body="$(check_http jpv_staging_health https://staging.jpvbootcamp.com/api/health)"
  "$JQ_BIN" -e '.ok == true and .deploymentEnv == "staging"' <<<"$jpv_body" >/dev/null || fail "jpv_staging_health_not_ok"

  proofly_body="$(check_http proofly_canonical "$PROOFLY_HEALTH_URL")"
  "$JQ_BIN" -e '.status == "ok"' <<<"$proofly_body" >/dev/null || fail "proofly_canonical_health_not_ok"

  "$SSH_BIN" -o BatchMode=yes -o ConnectTimeout=5 dokploy \
    "set -e; test \"\$(sudo docker service ls --filter name=$JPV_SERVICE_NAME --format '{{.Replicas}}' | head -1)\" = 1/1; sudo docker service ps --filter desired-state=running --format '{{.CurrentState}}' $JPV_SERVICE_NAME | grep -q '^Running'; sudo docker ps --filter label=com.docker.swarm.service.name=$JPV_SERVICE_NAME --format '{{.Status}}' | grep -qi healthy"

  supabase_probe="$($SSH_BIN -o BatchMode=yes -o ConnectTimeout=5 supabase 'set -e
test "$(systemctl is-active docker)" = active
test "$(systemctl is-enabled pgdump-upload.timer 2>/dev/null || true)" = disabled
test "$(systemctl is-active pgdump-upload.timer 2>/dev/null || true)" = inactive
test "$(pgrep -af "pg_dump|pg_restore|pgdump_upload|azcopy" | grep -v pgrep | wc -l | awk "{print \$1}")" = 0
sudo docker exec supabase-db pg_isready -U postgres -d postgres >/dev/null
sudo docker exec supabase-db psql -U postgres -d postgres -Atqc "SELECT current_setting(\$\$server_version\$\$), pg_is_in_recovery(), 1;"')" || fail "supabase_production_preflight_failed"
  [[ "$supabase_probe" == *"15."* ]] || fail "supabase_not_pg15"
  [[ "$supabase_probe" == *"|f|1"* ]] || fail "supabase_database_health_failed"

  log "production preflight PASS jpv=1/1 jpv_staging=ok proofly=getproofly.app:200 supabase=pg15_ready_not_recovery_select1 timer=disabled_inactive backup_processes=0"
}

read_azure_json() {
  "$AZURE_CLI_BIN" "$@" --subscription "$SUBSCRIPTION_ID" --only-show-errors
}

preflight_azure() {
  local item_json point_json latest jobs_count
  log "azure preflight start subscription=$SUBSCRIPTION_ID vault=$VAULT_NAME"

  item_json="$(read_azure_json backup item show -g "$VAULT_RESOURCE_GROUP" -v "$VAULT_NAME" -c "$BACKUP_CONTAINER_NAME" --name "$BACKUP_ITEM_NAME" -o json)" || fail "azure_backup_item_unreadable"
  "$JQ_BIN" -e '.properties.healthStatus == "Passed" and .properties.protectionState == "Protected"' <<<"$item_json" >/dev/null || fail "azure_backup_item_not_healthy"

  jobs_count="$(read_azure_json backup job list -g "$VAULT_RESOURCE_GROUP" -v "$VAULT_NAME" --status InProgress --query 'length(@)' -o tsv)" || fail "azure_backup_jobs_unreadable"
  [[ "$jobs_count" == "0" ]] || fail "azure_backup_job_in_progress"

  point_json="$(read_azure_json backup recoverypoint list -g "$VAULT_RESOURCE_GROUP" -v "$VAULT_NAME" -c "$BACKUP_CONTAINER_NAME" --item-name "$BACKUP_ITEM_NAME" -o json)" || fail "azure_recovery_points_unreadable"
  latest="$("$JQ_BIN" -c 'sort_by(.properties.recoveryPointTime) | reverse | .[0] // empty' <<<"$point_json")"
  [[ -n "$latest" ]] || fail "azure_no_recovery_point"
  RECOVERY_POINT_ID="$("$JQ_BIN" -r '.name // empty' <<<"$latest")"
  RECOVERY_POINT_TIME="$("$JQ_BIN" -r '.properties.recoveryPointTime // empty' <<<"$latest")"
  RECOVERY_POINT_TYPE="$("$JQ_BIN" -r '.properties.recoveryPointType // empty' <<<"$latest")"
  [[ "$RECOVERY_POINT_TYPE" == "FileSystemConsistent" ]] || fail "azure_recovery_point_not_filesystem_consistent"

  log "azure preflight PASS item=Protected/Passed recovery_point=$RECOVERY_POINT_ID recovery_point_time=$RECOVERY_POINT_TIME consistency=$RECOVERY_POINT_TYPE active_jobs=0"
}

read_existing_blob_prefix_summary() {
  local output count bytes
  output="$(
    "$SSH_BIN" -o BatchMode=yes -o ConnectTimeout=5 supabase 'set -e
sas=$(sudo cat /etc/pgdump/container.sas | tr -d "\r\n")
test -n "$sas"
case "$sas" in
  \?*) sas_query="$sas" ;;
  *) sas_query="?$sas" ;;
esac
url="https://stsaasinfrabackup.blob.core.windows.net/backups${sas_query}&restype=container&comp=list&prefix=phase3v/20260828T102607Z/"
xml=$(printf "%s\n" "url = \"$url\"" "silent" "show-error" "fail" | /usr/bin/curl --config -)
count=$(printf "%s" "$xml" | awk "BEGIN { RS=\"<Blob>\" } NR > 1 { count++ } END { print count + 0 }")
bytes=$(printf "%s" "$xml" | grep -o "<Content-Length>[^<]*" | cut -d">" -f2 | awk "{ total += \$1 } END { print total + 0 }")
printf "count=%s bytes=%s\n" "$count" "$bytes"'
  )" || fail "blob_prefix_read_failed"
  count="${output#count=}"; count="${count%% bytes=*}"
  bytes="${output##* bytes=}"
  [[ "$count" == "29" && "$bytes" == "150266181" ]] || fail "phase3v_prefix_integrity_failed"
  log "blob preflight PASS phase3v_prefix_objects=$count phase3v_prefix_bytes=$bytes"
}

load_previous_success() {
  LAST_SUCCESS_AT=""
  LAST_SUCCESS_RECOVERY_POINT_ID=""
  if [[ -f "$RUNTIME_STATE_FILE" ]]; then
    LAST_SUCCESS_AT="$($JQ_BIN -r '.states[]? | select(.backupJobId == "backup_job:supabase-recovery" and (.state == "HEALTHY" or .status == "SUCCESS" or .status == "NOOP")) | .lastSuccessAt // empty' "$RUNTIME_STATE_FILE" 2>/dev/null | head -1 || true)"
    LAST_SUCCESS_RECOVERY_POINT_ID="$($JQ_BIN -r '.states[]? | select(.backupJobId == "backup_job:supabase-recovery" and (.state == "HEALTHY" or .status == "SUCCESS" or .status == "NOOP")) | .recoveryPointId // empty' "$RUNTIME_STATE_FILE" 2>/dev/null | head -1 || true)"
  fi
}

write_runtime_state() {
  local status="$1"
  local reason="$2"
  local attempt_at="$3"
  local success_at="$4"
  local remote_verification="$5"
  local object_count="$6"
  local total_bytes="$7"
  local temp_cleaned="$8"
  local state_value="UNKNOWN"
  local tmp_file

  case "$status" in
    SUCCESS|NOOP) state_value="HEALTHY" ;;
    FAILED) state_value="FAILED" ;;
  esac
  mkdir -p "$STATE_DIR"
  tmp_file="$(mktemp "$STATE_DIR/.backup-runtime-state.XXXXXX")"
  chmod 600 "$tmp_file"
  "$JQ_BIN" -n \
    --arg generatedAt "$(timestamp_utc)" \
    --arg status "$status" \
    --arg state "$state_value" \
    --arg reason "$reason" \
    --arg attemptAt "$attempt_at" \
    --arg successAt "$success_at" \
    --arg runId "$RUN_ID" \
    --arg recoveryPointId "$RECOVERY_POINT_ID" \
    --arg recoveryPointTime "$RECOVERY_POINT_TIME" \
    --arg prefix "$BLOB_PREFIX" \
    --arg remoteVerification "$remote_verification" \
    --argjson objectCount "${object_count:-null}" \
    --argjson totalBytes "${total_bytes:-null}" \
    --argjson tempCleaned "$temp_cleaned" \
    '{
      schemaVersion: "1.0.0",
      generatedAt: $generatedAt,
      sourceKind: "durable-supabase-recovery-copy",
      states: [
        {
          backupJobId: "backup_job:supabase-recovery",
          state: $state,
          status: $status,
          reason: $reason,
          lastAttemptAt: (if $attemptAt == "" then null else $attemptAt end),
          lastSuccessAt: (if $successAt == "" then null else $successAt end),
          sourceRef: "runtime/local/infrastructure/backup-runtime-state.json",
          runId: (if $runId == "" then null else $runId end),
          recoveryPointId: (if $recoveryPointId == "" then null else $recoveryPointId end),
          recoveryPointTime: (if $recoveryPointTime == "" then null else $recoveryPointTime end),
          blobPrefix: (if $prefix == "" then null else $prefix end),
          objectCount: $objectCount,
          totalBytes: $totalBytes,
          localValidation: (if $status == "SUCCESS" or $status == "NOOP" then "PASS" else "NOT_EXECUTED" end),
          remoteVerification: (if $remoteVerification == "" then "NOT_EXECUTED" else $remoteVerification end),
          tempResourcesCleaned: $tempCleaned,
          productionLogicalDumpUsed: false,
          productionTouched: false
        }
      ]
    }' > "$tmp_file"
  mv "$tmp_file" "$RUNTIME_STATE_FILE"
}

write_remote_script() {
  REMOTE_SCRIPT="$RUN_DIR/isolated-recovery-copy-backup.sh"
  cat > "$REMOTE_SCRIPT" <<'REMOTE'
#!/usr/bin/env bash
set -Eeuo pipefail

SAS_FILE_INPUT="${1:-}"
BLOB_PREFIX_INPUT="${2:-}"
RUN_ID_INPUT="${3:-}"
[[ -n "$SAS_FILE_INPUT" && -n "$BLOB_PREFIX_INPUT" && -n "$RUN_ID_INPUT" ]] || exit 2
[[ "$BLOB_PREFIX_INPUT" =~ ^phase3x/[0-9]{8}T[0-9]{6}Z/$ ]] || exit 2
[[ -f "$SAS_FILE_INPUT" && -r "$SAS_FILE_INPUT" ]] || exit 2
BLOB_SAS_INPUT="$(cat "$SAS_FILE_INPUT")"
[[ -n "$BLOB_SAS_INPUT" ]] || exit 2

case "$BLOB_SAS_INPUT" in
  \?*) SAS_QUERY="$BLOB_SAS_INPUT" ;;
  *) SAS_QUERY="?$BLOB_SAS_INPUT" ;;
esac
PREFIX_BASE="https://stsaasinfrabackup.blob.core.windows.net/backups/${BLOB_PREFIX_INPUT}"
PREFIX_URL="${PREFIX_BASE}${SAS_QUERY}"
PREFIX_LIST_URL="https://stsaasinfrabackup.blob.core.windows.net/backups${SAS_QUERY}&restype=container&comp=list&prefix=${BLOB_PREFIX_INPUT}"
WORK_DIR="/var/tmp/supabase-recovery-copy-${RUN_ID_INPUT}"
RESULT_STATUS="FAIL"
RESULT_ERROR="remote_command_failed"
REMOTE_OBJECT_COUNT=""
REMOTE_TOTAL_BYTES=""
REMOTE_CRYPTO="NOT_EXECUTED"
LOCAL_DUMP_COUNT=0
LOCAL_VALIDATION_COUNT=0

mkdir -p "$WORK_DIR"
chmod 700 "$WORK_DIR"

finish() {
  local exit_code=$?
  if [[ "$exit_code" -eq 0 && "$RESULT_STATUS" == "PASS" ]]; then
    printf 'RESULT status=PASS runId=%s dumps=%s validations=%s objects=%s bytes=%s remoteVerification=%s\n' "$RUN_ID_INPUT" "$LOCAL_DUMP_COUNT" "$LOCAL_VALIDATION_COUNT" "$REMOTE_OBJECT_COUNT" "$REMOTE_TOTAL_BYTES" "$REMOTE_CRYPTO"
  else
    printf 'RESULT status=FAIL runId=%s error=%s dumps=%s validations=%s objects=%s bytes=%s remoteVerification=%s\n' "$RUN_ID_INPUT" "$RESULT_ERROR" "$LOCAL_DUMP_COUNT" "$LOCAL_VALIDATION_COUNT" "${REMOTE_OBJECT_COUNT:-0}" "${REMOTE_TOTAL_BYTES:-0}" "$REMOTE_CRYPTO"
  fi
  unset BLOB_SAS_INPUT SAS_QUERY PREFIX_URL PREFIX_LIST_URL
  rm -rf -- "$WORK_DIR"
  exit "$exit_code"
}
trap finish EXIT

die() {
  RESULT_ERROR="$1"
  exit 1
}

expected_databases=(
  "_supabase" "accountant" "analytics" "cedula" "fala" "finance" "finance\\"
  "finance_shadow" "jpvbootcamp" "jpvbootcamp_legacy" "jpvbootcamp_preview" "jpvbootcamp_staging"
  "olivetoorganizing" "openfund" "ory_prod" "postgres" "prochat" "prokitstudio"
  "proofly" "resend" "saaskitstudio" "saysthebible" "statuslink" "tenant_prokit"
  "tenant_saaskit" "vault_legal" "viadieden"
)

db_exec() { sudo docker exec supabase-db "$@"; }
db_exec_with_stdin() { sudo docker exec -i supabase-db "$@"; }
db_psql() { db_exec psql -U "$BACKUP_ROLE" "$@"; }
db_admin_psql() { db_exec psql -U supabase_admin "$@"; }
hex_name() { printf '%s' "$1" | od -An -tx1 | tr -d ' \n'; }
size_of() { stat -c '%s' "$1"; }
blob_object_url() { printf '%s/%s%s' "${PREFIX_BASE%/}" "$1" "$SAS_QUERY"; }
blob_list_xml() {
  local url="$1"
  printf 'url = "%s"\nsilent\nshow-error\nfail\n' "$url" | curl --config -
}
blob_upload() {
  local file="$1" url="$2"
  printf 'url = "%s"\nrequest = PUT\nheader = "x-ms-blob-type: BlockBlob"\nheader = "If-None-Match: *"\nheader = "x-ms-version: 2021-12-02"\nheader = "Content-Type: application/octet-stream"\nupload-file = "%s"\noutput = "/dev/null"\nsilent\nshow-error\nfail\n' "$url" "$file" | curl --config -
}

command -v sudo >/dev/null 2>&1 || die missing_sudo
command -v docker >/dev/null 2>&1 || die missing_docker
command -v curl >/dev/null 2>&1 || die missing_curl
db_exec pg_dump --version | grep -q '15\.' || die pg_dump_not_pg15
db_exec pg_restore --version | grep -q '15\.' || die pg_restore_not_pg15
db_exec pg_dumpall --version | grep -q '15\.' || die pg_dumpall_not_pg15
db_exec pg_isready -U postgres -d postgres >/dev/null || die pg_isready_failed
version="$(db_psql -d postgres -Atqc 'SELECT current_setting($$server_version$$);')"
[[ "$version" == 15.* ]] || die postgres_version_not_15
[[ "$(db_psql -d postgres -Atqc 'SELECT pg_is_in_recovery();')" == f ]] || die postgres_still_in_recovery
[[ "$(db_psql -d postgres -Atqc 'SELECT 1;')" == 1 ]] || die postgres_select_failed

printf '%s\n' "${expected_databases[@]}" | LC_ALL=C sort > "$WORK_DIR/expected-databases.txt"
db_psql -d postgres -Atqc "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname;" > "$WORK_DIR/actual-databases.txt"
LC_ALL=C sort "$WORK_DIR/actual-databases.txt" > "$WORK_DIR/actual-databases.sorted"
cmp -s "$WORK_DIR/expected-databases.txt" "$WORK_DIR/actual-databases.sorted" || die database_inventory_mismatch

role_fingerprint="$(db_psql -d postgres -Atqc 'SELECT rolname,rolcanlogin,rolsuper,rolreplication FROM pg_roles ORDER BY 1;' | sha256sum | awk '{print $1}')"
membership_fingerprint="$(db_psql -d postgres -Atqc 'SELECT member::regrole,roleid::regrole FROM pg_auth_members ORDER BY 1,2;' | sha256sum | awk '{print $1}')"
owner_acl_fingerprint="$(db_psql -d postgres -Atqc "SELECT datname,pg_get_userbyid(datdba),coalesce(datacl::text,'') FROM pg_database ORDER BY 1;" | sha256sum | awk '{print $1}')"
[[ -n "$role_fingerprint" && -n "$membership_fingerprint" && -n "$owner_acl_fingerprint" ]] || die fidelity_fingerprint_failed

wal_level="$(db_psql -d postgres -Atqc 'SHOW wal_level;')"
[[ -n "$wal_level" ]] || die wal_level_unreadable

mkdir -p "$WORK_DIR/databases" "$WORK_DIR/globals"
connect_matrix() {
  db_psql -d postgres -AtF $'\t' -c "WITH expected(datname) AS (
    VALUES ('_supabase'),('accountant'),('analytics'),('cedula'),('fala'),('finance'),('finance' || chr(92)),
      ('finance_shadow'),('jpvbootcamp'),('jpvbootcamp_legacy'),('jpvbootcamp_preview'),('jpvbootcamp_staging'),
      ('olivetoorganizing'),('openfund'),('ory_prod'),('postgres'),('prochat'),('prokitstudio'),('proofly'),
      ('resend'),('saaskitstudio'),('saysthebible'),('statuslink'),('tenant_prokit'),('tenant_saaskit'),
      ('vault_legal'),('viadieden'))
  SELECT e.datname, has_database_privilege(current_user, e.datname, 'CONNECT')
  FROM expected e ORDER BY e.datname;"
}

reconcile_recovery_copy_connect() {
  db_admin_psql -d postgres -v ON_ERROR_STOP=1 -c "DO \\$\\$
  DECLARE db_name text;
  BEGIN
    FOR db_name IN
      SELECT e.datname
      FROM (VALUES ('_supabase'),('accountant'),('analytics'),('cedula'),('fala'),('finance'),('finance' || chr(92)),
        ('finance_shadow'),('jpvbootcamp'),('jpvbootcamp_legacy'),('jpvbootcamp_preview'),('jpvbootcamp_staging'),
        ('olivetoorganizing'),('openfund'),('ory_prod'),('postgres'),('prochat'),('prokitstudio'),('proofly'),
        ('resend'),('saaskitstudio'),('saysthebible'),('statuslink'),('tenant_prokit'),('tenant_saaskit'),
        ('vault_legal'),('viadieden')) AS e(datname)
      WHERE NOT has_database_privilege('$BACKUP_ROLE', e.datname, 'CONNECT')
    LOOP
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', db_name, '$BACKUP_ROLE');
    END LOOP;
  END \\$\\$;" || die recovery_copy_connect_reconciliation_failed
}

connect_matrix > "$WORK_DIR/connect-matrix-before.tsv" || die backup_connect_matrix_unreadable
denied_databases="$(awk -F '\t' '$2 != "t" { print $1 }' "$WORK_DIR/connect-matrix-before.tsv")"
matrix_file="$WORK_DIR/connect-matrix-before.tsv"
if [[ -n "$denied_databases" ]]; then
  reconcile_recovery_copy_connect
  connect_matrix > "$WORK_DIR/connect-matrix-after.tsv" || die backup_connect_matrix_unreadable_after_reconciliation
  matrix_file="$WORK_DIR/connect-matrix-after.tsv"
fi
awk -F '\t' '$2 != "t" { denied = denied $1 " " } END { if (denied != "") { print denied > "/dev/stderr"; exit 1 } }' "$matrix_file" || die backup_connect_matrix_incomplete

db_psql -d postgres -Atqc 'SELECT current_setting($$server_version$$),pg_is_in_recovery(),1;' > "$WORK_DIR/recovery-health.txt"
db_exec pg_dumpall -U "$BACKUP_ROLE" --globals-only > "$WORK_DIR/globals/globals.sql" || die globals_dump_failed

for database_name in "${expected_databases[@]}"; do
  encoded_name="$(hex_name "$database_name")"
  dump_file="$WORK_DIR/databases/${encoded_name}.dump"
  container_dump_file="/var/tmp/supabase-recovery-${RUN_ID_INPUT}-${encoded_name}.dump"
  db_exec pg_dump -U "$BACKUP_ROLE" -d "$database_name" --format=custom --no-owner --no-privileges --file="$container_dump_file" || die "dump_failed_${encoded_name}"
  LOCAL_DUMP_COUNT=$((LOCAL_DUMP_COUNT + 1))
  db_exec pg_restore --list "$container_dump_file" >/dev/null || die "pg_restore_list_failed_${encoded_name}"
  db_exec sh -c "stat -c '%s' '$container_dump_file' >/dev/null" || die "dump_file_stat_failed_${encoded_name}"
  docker cp "supabase-db:${container_dump_file}" "$dump_file" >/dev/null || die "dump_copy_failed_${encoded_name}"
  db_exec rm -f "$container_dump_file" || die "dump_cleanup_failed_${encoded_name}"
  LOCAL_VALIDATION_COUNT=$((LOCAL_VALIDATION_COUNT + 1))
done

printf 'databaseCount\t%s\n' "${#expected_databases[@]}" > "$WORK_DIR/recovery-manifest.tsv"
printf 'postgresVersion\t%s\n' "$version" >> "$WORK_DIR/recovery-manifest.tsv"
printf 'walLevel\t%s\n' "$wal_level" >> "$WORK_DIR/recovery-manifest.tsv"
printf 'roleFingerprint\t%s\n' "$role_fingerprint" >> "$WORK_DIR/recovery-manifest.tsv"
printf 'membershipFingerprint\t%s\n' "$membership_fingerprint" >> "$WORK_DIR/recovery-manifest.tsv"
printf 'ownerAclFingerprint\t%s\n' "$owner_acl_fingerprint" >> "$WORK_DIR/recovery-manifest.tsv"
for database_name in "${expected_databases[@]}"; do
  encoded_name="$(hex_name "$database_name")"
  dump_file="$WORK_DIR/databases/${encoded_name}.dump"
  printf '%s\t%s\t%s\n' "$database_name" "$(size_of "$dump_file")" "$(sha256sum "$dump_file" | awk '{print $1}')" >> "$WORK_DIR/recovery-manifest.tsv"
done

(cd "$WORK_DIR" && sha256sum globals/globals.sql recovery-manifest.tsv databases/*.dump > sha256sums.txt)

blob_list_xml "$PREFIX_LIST_URL" > "$WORK_DIR/prefix-list.xml" || die prefix_collision_probe_failed
if grep -q '<Blob>' "$WORK_DIR/prefix-list.xml"; then
 die blob_prefix_not_empty
fi

blob_upload "$WORK_DIR/globals/globals.sql" "$(blob_object_url globals.sql)" || die upload_globals_failed
blob_upload "$WORK_DIR/recovery-manifest.tsv" "$(blob_object_url recovery-manifest.tsv)" || die upload_manifest_failed
blob_upload "$WORK_DIR/sha256sums.txt" "$(blob_object_url sha256sums.txt)" || die upload_checksums_failed
for database_name in "${expected_databases[@]}"; do
  encoded_name="$(hex_name "$database_name")"
  blob_upload "$WORK_DIR/databases/${encoded_name}.dump" "$(blob_object_url "databases/${encoded_name}.dump")" || die "upload_failed_${encoded_name}"
done

blob_list_xml "$PREFIX_LIST_URL" > "$WORK_DIR/remote-list.xml" || die remote_listing_failed
sed 's#</Blob>#</Blob>\n#g' "$WORK_DIR/remote-list.xml" | awk 'BEGIN { RS="</Blob>" } /<Name>/ { name=$0; sub(/^.*<Name>/, "", name); sub(/<\/Name>.*/, "", name) } /<Content-Length>/ { size=$0; sub(/^.*<Content-Length>/, "", size); sub(/<\/Content-Length>.*/, "", size); print name "\t" size }' | while IFS=$'\t' read -r object_name object_size; do
  object_name="${object_name#${BLOB_PREFIX_INPUT}}"
  object_name="${object_name#/}"
  printf '%s\t%s\n' "$object_name" "$object_size"
done | LC_ALL=C sort > "$WORK_DIR/remote-objects.tsv"

{
  printf 'globals.sql\nrecovery-manifest.tsv\nsha256sums.txt\n'
  for database_name in "${expected_databases[@]}"; do
    printf 'databases/%s.dump\n' "$(hex_name "$database_name")"
  done
} | LC_ALL=C sort > "$WORK_DIR/expected-objects.txt"
cut -f1 "$WORK_DIR/remote-objects.tsv" | LC_ALL=C sort > "$WORK_DIR/actual-objects.txt"
cmp -s "$WORK_DIR/expected-objects.txt" "$WORK_DIR/actual-objects.txt" || die remote_object_names_mismatch

REMOTE_OBJECT_COUNT="$(wc -l < "$WORK_DIR/actual-objects.txt" | awk '{print $1}')"
REMOTE_TOTAL_BYTES="$(awk -F'\t' '{total += $2} END {print total + 0}' "$WORK_DIR/remote-objects.tsv")"
expected_total_bytes="$(awk '{total += $1} END {print total + 0}' <(find "$WORK_DIR" -type f \( -name '*.dump' -o -name 'globals.sql' -o -name 'recovery-manifest.tsv' -o -name 'sha256sums.txt' \) -exec stat -c '%s' {} \;))"
[[ "$REMOTE_TOTAL_BYTES" == "$expected_total_bytes" ]] || die remote_object_sizes_mismatch
REMOTE_CRYPTO="PARTIAL"

RESULT_STATUS="PASS"
RESULT_ERROR=""
exit 0
REMOTE
  chmod 700 "$REMOTE_SCRIPT"
}

create_temp_resources() {
  TEMP_RG="rg-temp-supabase-recovery-$RUN_ID"
  TEMP_VM="vm-temp-supabase-recovery-$RUN_ID"
  TEMP_VNET="vnet-temp-supabase-recovery-$RUN_ID"
  TEMP_SUBNET="subnet-temp-supabase-recovery"
  TEMP_NSG="nsg-temp-supabase-recovery-$RUN_ID"
  TEMP_STORAGE="${STORAGE_ACCOUNT_NAME:-stsuprec${RUN_ID//T/}}"
  TEMP_STORAGE="${TEMP_STORAGE//Z/}"
  TEMP_STORAGE="${TEMP_STORAGE:0:24}"

  [[ "$TEMP_STORAGE" =~ ^[a-z0-9]{3,24}$ ]] || fail invalid_storage_account_name
  if "$AZURE_CLI_BIN" group exists -n "$TEMP_RG" --subscription "$SUBSCRIPTION_ID" -o tsv | grep -q true; then
    fail temporary_resource_group_already_exists
  fi

  "$AZURE_PROVISIONER_BIN" group create -n "$TEMP_RG" -l "$LOCATION" --tags purpose=supabase-recovery-copy phase=3x runId="$RUN_ID" sourceVm="$SOURCE_VM_NAME" -o none
  TEMP_CREATED="true"
  "$AZURE_PROVISIONER_BIN" storage account create -g "$TEMP_RG" -n "$TEMP_STORAGE" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false -o none
  "$AZURE_PROVISIONER_BIN" network nsg create -g "$TEMP_RG" -n "$TEMP_NSG" -l "$LOCATION" -o none
  "$AZURE_PROVISIONER_BIN" network nsg rule create -g "$TEMP_RG" --nsg-name "$TEMP_NSG" -n deny-all-inbound --priority 100 --direction Inbound --access Deny --protocol '*' --source-address-prefixes '*' --source-port-ranges '*' --destination-address-prefixes '*' --destination-port-ranges '*' -o none
  "$AZURE_PROVISIONER_BIN" network nsg rule create -g "$TEMP_RG" --nsg-name "$TEMP_NSG" -n allow-azurecloud-management --priority 100 --direction Outbound --access Allow --protocol '*' --source-address-prefixes '*' --source-port-ranges '*' --destination-address-prefixes AzureCloud --destination-port-ranges '*' -o none
  "$AZURE_PROVISIONER_BIN" network nsg rule create -g "$TEMP_RG" --nsg-name "$TEMP_NSG" -n deny-internet-egress --priority 110 --direction Outbound --access Deny --protocol '*' --source-address-prefixes '*' --source-port-ranges '*' --destination-address-prefixes Internet --destination-port-ranges '*' -o none
  "$AZURE_PROVISIONER_BIN" network vnet create -g "$TEMP_RG" -n "$TEMP_VNET" -l "$LOCATION" --address-prefixes 10.254.0.0/24 --subnet-name "$TEMP_SUBNET" --subnet-prefixes 10.254.0.0/29 -o none
  "$AZURE_PROVISIONER_BIN" network vnet subnet update -g "$TEMP_RG" --vnet-name "$TEMP_VNET" -n "$TEMP_SUBNET" --network-security-group "$TEMP_NSG" -o none
}

validate_private_restore_copy() {
  local vm_json nic_id nic_name public_ip peer_count power_state
  vm_json="$(read_azure_json vm show -g "$TEMP_RG" -n "$TEMP_VM" -o json)" || fail restored_vm_unreadable
  [[ "$($JQ_BIN -r '.name' <<<"$vm_json")" == "$TEMP_VM" ]] || fail restored_vm_identity_mismatch
  nic_id="$($JQ_BIN -r '.networkProfile.networkInterfaces[0].id // empty' <<<"$vm_json")"
  [[ "$nic_id" == "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$TEMP_RG/providers/Microsoft.Network/networkInterfaces/"* ]] || fail restored_vm_nic_identity_mismatch
  nic_name="${nic_id##*/}"
  public_ip="$(read_azure_json network nic show -g "$TEMP_RG" -n "$nic_name" --query 'ipConfigurations[].publicIpAddress.id' -o tsv)" || fail restored_vm_network_unreadable
  [[ -z "$public_ip" || "$public_ip" == "None" ]] || fail restored_copy_has_public_ip
  peer_count="$(read_azure_json network vnet peering list -g "$TEMP_RG" --vnet-name "$TEMP_VNET" --query 'length(@)' -o tsv)" || fail restored_copy_peering_probe_failed
  [[ "$peer_count" == "0" ]] || fail restored_copy_has_vnet_peering
  power_state="$(read_azure_json vm show -d -g "$TEMP_RG" -n "$TEMP_VM" --query powerState -o tsv)" || fail restored_vm_power_state_unreadable
  [[ "$power_state" == "VM running" ]] || fail restored_vm_not_running
}

detach_temporary_public_ips() {
  local vm_json nic_id nic_name ip_config_names ip_config_name public_ip_id
  vm_json="$(read_azure_json vm show -g "$TEMP_RG" -n "$TEMP_VM" -o json)" || fail restored_vm_unreadable_for_network_repair
  nic_id="$($JQ_BIN -r '.networkProfile.networkInterfaces[0].id // empty' <<<"$vm_json")"
  [[ "$nic_id" == "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$TEMP_RG/providers/Microsoft.Network/networkInterfaces/"* ]] || fail restored_vm_nic_identity_mismatch
  nic_name="${nic_id##*/}"
  ip_config_names="$(read_azure_json network nic ip-config list -g "$TEMP_RG" --nic-name "$nic_name" --query '[].name' -o tsv)" || fail restored_vm_ip_config_unreadable
  [[ -n "$ip_config_names" ]] || fail restored_vm_ip_config_missing

  while IFS= read -r ip_config_name; do
    [[ -n "$ip_config_name" ]] || continue
    public_ip_id="$(read_azure_json network nic ip-config show -g "$TEMP_RG" --nic-name "$nic_name" -n "$ip_config_name" --query 'publicIpAddress.id' -o tsv)" || fail restored_vm_public_ip_unreadable
    [[ -z "$public_ip_id" ]] && continue
    [[ "$public_ip_id" == "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$TEMP_RG/providers/Microsoft.Network/publicIPAddresses/"* ]] || fail restored_vm_public_ip_identity_mismatch
    read_azure_json network nic ip-config update -g "$TEMP_RG" --nic-name "$nic_name" -n "$ip_config_name" --remove publicIpAddress -o none || fail restored_vm_public_ip_detach_failed
    log "temporary restore public IP detached ip_config=$ip_config_name"
  done <<<"$ip_config_names"
}

cleanup_temp_resources() {
  [[ "$TEMP_CREATED" == "true" ]] || { CLEANUP_STATUS="NOT_CREATED"; return 0; }
  local group_json inventory_json invalid_resource vm_compact vm_disk_prefix
  group_json="$(read_azure_json group show -n "$TEMP_RG" -o json)" || { CLEANUP_STATUS="FAILED"; ERROR_CODE="temporary_resource_group_unreadable"; return 1; }
  "$JQ_BIN" -e --arg run "$RUN_ID" --arg source "$SOURCE_VM_NAME" \
    '.tags.phase == "3x" and .tags.purpose == "supabase-recovery-copy" and .tags.runId == $run and .tags.sourceVm == $source' \
    <<<"$group_json" >/dev/null || { CLEANUP_STATUS="FAILED"; ERROR_CODE="temporary_resource_group_identity_mismatch"; return 1; }

  inventory_json="$(read_azure_json resource list -g "$TEMP_RG" -o json)" || { CLEANUP_STATUS="FAILED"; return 1; }
  vm_compact="${TEMP_VM//-/}"
  vm_disk_prefix="${vm_compact%%T*}"
  invalid_resource="$($JQ_BIN -r --arg storage "$TEMP_STORAGE" --arg nsg "$TEMP_NSG" --arg vnet "$TEMP_VNET" --arg vm "$TEMP_VM" --arg vmDiskPrefix "$vm_disk_prefix" '
    .[]
    | select(
        (.type == "Microsoft.Storage/storageAccounts" and .name == $storage)
        or (.type == "Microsoft.Network/networkSecurityGroups" and .name == $nsg)
        or (.type == "Microsoft.Network/virtualNetworks" and .name == $vnet)
        or (.type == "Microsoft.Compute/virtualMachines" and .name == $vm)
        or (.type == "Microsoft.Compute/disks" and ((.name | startswith($vm + "-")) or (.name | startswith($vmDiskPrefix + "-"))))
        or (.type == "Microsoft.Network/networkInterfaces" and (.name | startswith($vm + "-nic-")))
        or (.type == "Microsoft.Network/publicIPAddresses" and (.name | startswith($vm + "-pip-")))
      | not
    )
    | "\(.type):\(.name)"
  ' <<<"$inventory_json" | head -1)"
  [[ -z "$invalid_resource" ]] || { CLEANUP_STATUS="FAILED"; ERROR_CODE="temporary_inventory_contains_unrelated_resource"; return 1; }
  "$AZURE_DESTROYER_BIN" group delete -n "$TEMP_RG" --yes -o none || { CLEANUP_STATUS="FAILED"; return 1; }
  if read_azure_json group exists -n "$TEMP_RG" -o tsv | grep -q true; then
    CLEANUP_STATUS="FAILED"
    ERROR_CODE="temporary_resource_group_remains"
    return 1
  fi
  CLEANUP_STATUS="PASS"
  TEMP_CREATED="false"
}

on_exit() {
  local exit_code=$?
  trap - EXIT
  if [[ "$TEMP_CREATED" == "true" ]]; then
    if ! cleanup_temp_resources; then
      exit_code=1
    fi
  fi
  if [[ "$MODE" == "run" && -n "$RUN_STARTED_AT" ]]; then
    if [[ "$exit_code" -eq 0 && "$CLEANUP_STATUS" == "PASS" ]]; then
      write_runtime_state SUCCESS "Azure recovery-copy backup completed; production logical dump path was not used." "$RUN_STARTED_AT" "$(timestamp_utc)" "${REMOTE_CRYPTO:-PASS}" "${REMOTE_OBJECT_COUNT:-29}" "${REMOTE_TOTAL_BYTES:-0}" true
    elif [[ "$exit_code" -ne 0 ]]; then
      write_runtime_state FAILED "${ERROR_CODE:-automation_failed}; temporary cleanup=${CLEANUP_STATUS}" "$RUN_STARTED_AT" "$LAST_SUCCESS_AT" "${REMOTE_CRYPTO:-NOT_EXECUTED}" "${REMOTE_OBJECT_COUNT:-null}" "${REMOTE_TOTAL_BYTES:-null}" "$([[ "$CLEANUP_STATUS" == PASS ]] && echo true || echo false)"
    fi
  fi
  if [[ -n "$LOCK_DIR" && -d "$LOCK_DIR" ]]; then
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
  if [[ -n "${RUN_DIR:-}" && -d "$RUN_DIR" ]]; then
    rm -rf -- "$RUN_DIR"
  fi
  exit "$exit_code"
}

main() {
  local existing_sas run_output run_messages result_line remote_script_b64 remote_stage_path remote_stage_b64 stage_init_path chunk_script_path secret_wrapper_path chunk offset idempotency_state
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) MODE="dry-run" ;;
      --run) MODE="run" ;;
      --scheduled) SCHEDULED="true" ;;
      --run-id) [[ $# -ge 2 ]] || fail missing_run_id; RUN_ID="$2"; shift ;;
      --help|-h) usage; return 0 ;;
      *) fail "unknown_argument_$1" ;;
    esac
    shift
  done

  require_command "$JQ_BIN"
  require_command "$CURL_BIN"
  require_command "$SSH_BIN"
  require_command date
  require_command mktemp
  require_command rmdir
  require_command base64
  [[ -x "$AZURE_CLI_BIN" || "$AZURE_CLI_BIN" == az ]] || fail "azure_cli_unavailable"
  [[ "$MODE" == dry-run || -x "$AZURE_PROVISIONER_BIN" ]] || fail azure_provisioner_unavailable
  [[ "$MODE" == dry-run || -x "$AZURE_DESTROYER_BIN" ]] || fail azure_destroyer_unavailable

  RUN_ID="${RUN_ID:-$(timestamp_utc | tr -d ':-' | sed 's/^\([0-9]\{8\}\)\([0-9]\{6\}\)Z$/\1T\2Z/')}"
  safe_run_id "$RUN_ID"
  BLOB_PREFIX="phase3x/${RUN_ID}/"
  load_previous_success

  mkdir -p "$STATE_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "NOOP reason=run_already_active"
    return 0
  fi
  chmod 700 "$LOCK_DIR"
  trap on_exit EXIT

  preflight_production
  preflight_azure
  read_existing_blob_prefix_summary

  if [[ "$MODE" == "dry-run" ]]; then
    idempotency_state="ELIGIBLE"
    [[ "$LAST_SUCCESS_RECOVERY_POINT_ID" == "$RECOVERY_POINT_ID" ]] && idempotency_state="NOOP"
    log "DRY_RUN=PASS mode=dry-run recovery_point=$RECOVERY_POINT_ID recovery_point_time=$RECOVERY_POINT_TIME prefix=$BLOB_PREFIX restore_mode=AlternateLocation overwrite=false idempotency=$idempotency_state expected_databases=$EXPECTED_DATABASE_COUNT scheduler=$SCHEDULED"
    return 0
  fi

  if [[ -f "$RUNTIME_STATE_FILE" ]] && "$JQ_BIN" -e --arg rp "$RECOVERY_POINT_ID" '.states[]? | select(.backupJobId == "backup_job:supabase-recovery" and (.state == "HEALTHY" or .status == "SUCCESS") and .recoveryPointId == $rp)' "$RUNTIME_STATE_FILE" >/dev/null 2>&1; then
    log "NOOP reason=recovery_point_already_processed recovery_point=$RECOVERY_POINT_ID"
    return 0
  fi

  RUN_STARTED_AT="$(timestamp_utc)"
  RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/supabase-recovery-copy.XXXXXX")"
  chmod 700 "$RUN_DIR"
  write_remote_script
  existing_sas="$($SSH_BIN -o BatchMode=yes -o ConnectTimeout=5 supabase 'sudo cat /etc/pgdump/container.sas' | tr -d '\r\n')" || fail blob_sas_unreadable
  [[ -n "$existing_sas" ]] || fail blob_sas_empty

  create_temp_resources
  run_output="$(read_azure_json backup restore restore-disks -g "$VAULT_RESOURCE_GROUP" -v "$VAULT_NAME" -c "$BACKUP_CONTAINER_NAME" --item-name "$BACKUP_ITEM_NAME" -r "$RECOVERY_POINT_ID" --storage-account "$TEMP_STORAGE" --storage-account-resource-group "$TEMP_RG" --restore-mode AlternateLocation --restore-as-unmanaged-disks false --restore-to-staging-storage-account true --target-resource-group "$TEMP_RG" --target-vm-name "$TEMP_VM" --target-vnet-name "$TEMP_VNET" --target-vnet-resource-group "$TEMP_RG" --target-subnet-name "$TEMP_SUBNET" -o json)" || fail azure_restore_request_failed
  restore_job_id="$($JQ_BIN -r '.name // .properties.jobId // empty' <<<"$run_output")"
  [[ -n "$restore_job_id" ]] || fail azure_restore_job_id_missing
  read_azure_json backup job wait -g "$VAULT_RESOURCE_GROUP" -v "$VAULT_NAME" -n "$restore_job_id" --timeout "${AZURE_RESTORE_TIMEOUT_SECONDS:-3600}" -o none || fail azure_restore_job_failed
  restore_status="$(read_azure_json backup job show -g "$VAULT_RESOURCE_GROUP" -v "$VAULT_NAME" -n "$restore_job_id" --query properties.status -o tsv)" || fail azure_restore_status_unreadable
  [[ "$restore_status" == Completed ]] || fail azure_restore_not_completed

  detach_temporary_public_ips
  validate_private_restore_copy
  remote_stage_path="/var/tmp/supabase-recovery-copy-${RUN_ID}.sh"
  remote_stage_b64="${remote_stage_path}.b64"
  remote_script_b64="$(base64 < "$REMOTE_SCRIPT" | tr -d '\n=' | tr '+/' '-_')" || fail isolated_script_encoding_failed
  stage_init_path="$RUN_DIR/stage-init.sh"
  {
    printf '%s\n' '#!/usr/bin/env bash' 'set -eu'
    printf ': > %q\n' "$remote_stage_b64"
  } > "$stage_init_path"
  chmod 700 "$stage_init_path"
  read_azure_json vm run-command invoke -g "$TEMP_RG" -n "$TEMP_VM" --command-id RunShellScript --scripts "@$stage_init_path" -o none || fail isolated_script_stage_init_failed
  for ((offset = 0; offset < ${#remote_script_b64}; offset += 1800)); do
    chunk="${remote_script_b64:offset:1800}"
    chunk_script_path="$RUN_DIR/stage-chunk-${offset}.sh"
    {
      printf '%s\n' '#!/usr/bin/env bash' 'set -eu'
      printf 'printf %q >> %q\n' "$chunk" "$remote_stage_b64"
    } > "$chunk_script_path"
    chmod 700 "$chunk_script_path"
    read_azure_json vm run-command invoke -g "$TEMP_RG" -n "$TEMP_VM" --command-id RunShellScript --scripts "@$chunk_script_path" -o none || fail isolated_script_stage_chunk_failed
  done
  secret_wrapper_path="$RUN_DIR/remote-final-wrapper.sh"
  {
    printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail'
    printf 'stage_b64=%q\n' "$remote_stage_b64"
    printf 'stage_script=%q\n' "$remote_stage_path"
    printf 'blob_sas=%q\n' "$existing_sas"
    printf 'blob_prefix=%q\n' "$BLOB_PREFIX"
    printf 'run_id=%q\n' "$RUN_ID"
    cat <<'REMOTE_WRAPPER'
stage_normalized="${stage_b64}.normalized"
secret_file="${stage_script}.sas"
trap 'rm -f -- "$stage_b64" "$stage_normalized" "$stage_script" "$secret_file"' EXIT
if ! tr '_-' '/+' < "$stage_b64" > "$stage_normalized"; then
  printf 'RESULT status=FAIL runId=%s error=stage_normalize_failed dumps=0 validations=0 objects=0 bytes=0 remoteVerification=NOT_EXECUTED\n' "$run_id"
  exit 0
fi
stage_length="$(wc -c < "$stage_normalized")"
stage_length="${stage_length//[[:space:]]/}"
stage_padding=$(( (4 - stage_length % 4) % 4 ))
if (( stage_padding > 0 )); then
  printf '%*s' "$stage_padding" '' | tr ' ' '=' >> "$stage_normalized"
fi
if ! base64 -d "$stage_normalized" > "$stage_script"; then
  printf 'RESULT status=FAIL runId=%s error=stage_decode_failed_bytes_%s dumps=0 validations=0 objects=0 bytes=0 remoteVerification=NOT_EXECUTED\n' "$run_id" "$stage_length"
  exit 0
fi
chmod 700 "$stage_script"
umask 077
printf '%s' "$blob_sas" > "$secret_file"
child_status=0
child_output="$("$stage_script" "$secret_file" "$blob_prefix" "$run_id" 2>&1)" || child_status=$?
child_result="$(sed -n 's/.*\(RESULT status=.*\)/\1/p' <<<"$child_output" | tail -1 || true)"
if [[ -n "$child_result" ]]; then
  printf '%s\n' "$child_result"
else
  printf 'RESULT status=FAIL runId=%s error=remote_script_result_missing_exit_%s dumps=0 validations=0 objects=0 bytes=0 remoteVerification=NOT_EXECUTED\n' "$run_id" "$child_status"
fi
REMOTE_WRAPPER
  } > "$secret_wrapper_path"
  chmod 700 "$secret_wrapper_path"
  unset existing_sas
  run_output="$(read_azure_json vm run-command invoke -g "$TEMP_RG" -n "$TEMP_VM" --command-id RunShellScript --scripts "@$secret_wrapper_path" -o json)" || fail isolated_backup_command_failed
  run_messages="$($JQ_BIN -r '.. | strings | select(contains("RESULT status="))' <<<"$run_output" | tr -d '\r')"
  result_line="$(sed -n 's/.*\(RESULT status=.*\)/\1/p' <<<"$run_messages" | tail -1 || true)"
  [[ -n "$result_line" ]] || fail isolated_backup_result_missing
  REMOTE_OBJECT_COUNT="$(awk '{for (i=1;i<=NF;i++) if ($i ~ /^objects=/) {split($i,a,"="); print a[2]}}' <<<"$result_line")"
  REMOTE_TOTAL_BYTES="$(awk '{for (i=1;i<=NF;i++) if ($i ~ /^bytes=/) {split($i,a,"="); print a[2]}}' <<<"$result_line")"
  REMOTE_CRYPTO="$(awk '{for (i=1;i<=NF;i++) if ($i ~ /^remoteVerification=/) {split($i,a,"="); print a[2]}}' <<<"$result_line")"
  if [[ "$result_line" != *"status=PASS"* ]]; then
    remote_error="$(awk '{for (i=1;i<=NF;i++) if ($i ~ /^error=/) {split($i,a,"="); print a[2]}}' <<<"$result_line")"
    [[ "$remote_error" =~ ^[a-z0-9_]+$ ]] || remote_error="unknown_remote_failure"
    ERROR_CODE="isolated_backup_failed_${remote_error}"
    log "BACKUP_RESULT=FAIL run_id=$RUN_ID error=$remote_error dumps=${REMOTE_DUMP_COUNT:-0} validations=${REMOTE_VALIDATION_COUNT:-0} objects=${REMOTE_OBJECT_COUNT:-0} bytes=${REMOTE_TOTAL_BYTES:-0} remote_crypto=${REMOTE_CRYPTO:-NOT_EXECUTED}" >&2
    fail "$ERROR_CODE"
  fi
  [[ "$REMOTE_OBJECT_COUNT" == 29 ]] || fail isolated_object_count_not_29
  [[ "$REMOTE_CRYPTO" == PASS || "$REMOTE_CRYPTO" == PARTIAL ]] || fail remote_crypto_result_missing

  log "BACKUP_RESULT=PASS run_id=$RUN_ID recovery_point=$RECOVERY_POINT_ID dumps=${#expected_databases[@]} validations=${#expected_databases[@]} objects=$REMOTE_OBJECT_COUNT bytes=$REMOTE_TOTAL_BYTES remote_crypto=$REMOTE_CRYPTO temp_cleanup=pending"
}

main "$@"
