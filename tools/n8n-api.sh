#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly CONTRACT_VERSION=1
readonly MAX_PAYLOAD_BYTES=500000
readonly MAX_RESPONSE_BYTES=500000
readonly DEFAULT_CONNECT_TIMEOUT_SECONDS=5
readonly MAX_CONNECT_TIMEOUT_SECONDS=30
readonly DEFAULT_TOTAL_TIMEOUT_SECONDS=60
readonly MAX_TOTAL_TIMEOUT_SECONDS=300

API_BASE_URL=""
CONNECT_TIMEOUT_SECONDS=""
TOTAL_TIMEOUT_SECONDS=""
CONFIG_ERROR_CODE="INVALID_RUNTIME_CONFIGURATION"
VALIDATION_ERROR_CODE="PAYLOAD_INVALID"
CREATED_TEMP_FILE=""
TEMP_FILES=()

cleanup_temp_files() {
  local temp_file
  for temp_file in "${TEMP_FILES[@]-}"; do
    if [[ -n "$temp_file" ]]; then
      rm -f -- "$temp_file"
    fi
  done
}

trap cleanup_temp_files EXIT

usage() {
  cat <<'EOF'
Usage:
  n8n-api.sh help
  n8n-api.sh get-workflow <workflowId>
  n8n-api.sh update-workflow <workflowId> -

Workbench contract v1:
  get-workflow <workflowId>
  update-workflow <workflowId> -

The update payload is a bounded JSON workflow object read from stdin. A legacy
file-path payload remains available for manual use outside the Workbench
contract:
  n8n-api.sh update-workflow <workflowId> <json_file>

Other pre-existing commands remain manual compatibility operations:
  request <METHOD> <PATH> [json_file|-]
  list-workflows
  create-workflow <json_file|->
  delete-workflow <id>
  activate-workflow <id> [versionId]
  deactivate-workflow <id>
  credential-schema <credentialTypeName>
  create-credential <json_file|->
  update-credential <id> <json_file|->
  list-projects
  list-variables
  create-variable <json_file|->

Runtime configuration:
  N8N_API_URL
  N8N_API_KEY
  N8N_CONNECT_TIMEOUT_SECONDS (default 5, maximum 30)
  N8N_TOTAL_TIMEOUT_SECONDS   (default 60, maximum 300)

The wrapper does not load a credential file. Installation-local secret storage
must inject configuration into the process environment.
EOF
}

usage_error() {
  printf 'error: invalid wrapper arguments\n' >&2
  usage >&2
  exit 64
}

require_exact_arg_count() {
  local expected="$1"
  local actual="$2"
  [[ "$actual" -eq "$expected" ]]
}

require_arg_count_between() {
  local minimum="$1"
  local maximum="$2"
  local actual="$3"
  [[ "$actual" -ge "$minimum" && "$actual" -le "$maximum" ]]
}

validate_workflow_id() {
  local workflow_id="$1"
  [[ ${#workflow_id} -ge 1
    && ${#workflow_id} -le 128
    && "$workflow_id" =~ ^[A-Za-z0-9][A-Za-z0-9._~-]*$ ]]
}

validate_bounded_integer() {
  local value="$1"
  local minimum="$2"
  local maximum="$3"
  [[ "$value" =~ ^[0-9]+$ ]] || return 1
  (( 10#$value >= minimum && 10#$value <= maximum ))
}

load_runtime_config() {
  local raw_url="${N8N_API_URL:-}"
  local raw_key="${N8N_API_KEY:-}"
  local authority_and_path
  local authority

  CONNECT_TIMEOUT_SECONDS="${N8N_CONNECT_TIMEOUT_SECONDS:-$DEFAULT_CONNECT_TIMEOUT_SECONDS}"
  TOTAL_TIMEOUT_SECONDS="${N8N_TOTAL_TIMEOUT_SECONDS:-$DEFAULT_TOTAL_TIMEOUT_SECONDS}"

  if [[ -z "$raw_url" || -z "$raw_key" ]]; then
    CONFIG_ERROR_CODE="RUNTIME_CONFIGURATION_MISSING"
    return 1
  fi

  API_BASE_URL="${raw_url%/}"
  if [[ "$API_BASE_URL" != https://* ]]; then
    CONFIG_ERROR_CODE="API_URL_INVALID"
    return 1
  fi

  authority_and_path="${API_BASE_URL#https://}"
  authority="${authority_and_path%%/*}"
  if [[ -z "$authority"
    || "$authority_and_path" == *[[:space:]]*
    || "$authority_and_path" == *@*
    || "$authority_and_path" == *\?*
    || "$authority_and_path" == *\#*
    || "$authority_and_path" == *\\* ]]; then
    CONFIG_ERROR_CODE="API_URL_INVALID"
    return 1
  fi

  if [[ ${#raw_key} -gt 4096
    || "$raw_key" == *[[:space:]]*
    || "$raw_key" == '<'*'>' ]]; then
    CONFIG_ERROR_CODE="API_KEY_INVALID"
    return 1
  fi

  if ! validate_bounded_integer "$CONNECT_TIMEOUT_SECONDS" 1 "$MAX_CONNECT_TIMEOUT_SECONDS"; then
    CONFIG_ERROR_CODE="CONNECT_TIMEOUT_INVALID"
    return 1
  fi

  if ! validate_bounded_integer "$TOTAL_TIMEOUT_SECONDS" 1 "$MAX_TOTAL_TIMEOUT_SECONDS"; then
    CONFIG_ERROR_CODE="TOTAL_TIMEOUT_INVALID"
    return 1
  fi

  if (( 10#$TOTAL_TIMEOUT_SECONDS < 10#$CONNECT_TIMEOUT_SECONDS )); then
    CONFIG_ERROR_CODE="TIMEOUT_ORDER_INVALID"
    return 1
  fi

  return 0
}

create_temp_file() {
  if ! CREATED_TEMP_FILE="$(mktemp "${TMPDIR:-/tmp}/n8n-wrapper-v1.XXXXXX")"; then
    return 1
  fi
  TEMP_FILES[${#TEMP_FILES[@]}]="$CREATED_TEMP_FILE"
}

build_secret_header_file() {
  if ! create_temp_file; then
    return 1
  fi
  printf 'X-N8N-API-KEY: %s\n' "$N8N_API_KEY" >"$CREATED_TEMP_FILE"
}

pretty_print() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

api_request() {
  local method="$1"
  local path="$2"
  local body_source="${3:-}"
  local url="${API_BASE_URL}${path}"
  local secret_header_file
  local -a curl_args

  if ! command -v curl >/dev/null 2>&1; then
    printf 'error: HTTP client unavailable\n' >&2
    return 69
  fi
  if ! build_secret_header_file; then
    printf 'error: secure request setup failed\n' >&2
    return 70
  fi
  secret_header_file="$CREATED_TEMP_FILE"

  curl_args=(
    --disable
    --fail
    --silent
    --show-error
    --http1.1
    --globoff
    --request "$method"
    --connect-timeout "$CONNECT_TIMEOUT_SECONDS"
    --max-time "$TOTAL_TIMEOUT_SECONDS"
    --retry 0
    --max-redirs 0
    --noproxy '*'
    --proto '=https'
    --max-filesize "$MAX_RESPONSE_BYTES"
    --header "@$secret_header_file"
    --header 'Accept: application/json'
    "$url"
  )

  if [[ -n "$body_source" ]]; then
    curl_args+=(--header 'Content-Type: application/json')
    if [[ "$body_source" == "-" ]]; then
      curl_args+=(--data-binary @-)
    else
      curl_args+=(--data-binary "@$body_source")
    fi
  fi

  N8N_API_URL= N8N_API_KEY= \
    http_proxy= https_proxy= all_proxy= \
    HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= NO_PROXY= no_proxy= \
    curl "${curl_args[@]}"
}

post_without_body() {
  api_request POST "$1"
}

snapshot_payload() {
  local body_source="$1"
  local destination="$2"
  local byte_count

  VALIDATION_ERROR_CODE="PAYLOAD_SOURCE_UNAVAILABLE"

  if [[ "$body_source" == "-" ]]; then
    if ! head -c "$((MAX_PAYLOAD_BYTES + 1))" >"$destination"; then
      return 1
    fi
  else
    if [[ ! -f "$body_source" || -L "$body_source" || ! -r "$body_source" ]]; then
      return 1
    fi
    if ! head -c "$((MAX_PAYLOAD_BYTES + 1))" "$body_source" >"$destination"; then
      return 1
    fi
  fi

  byte_count="$(wc -c <"$destination" | tr -d '[:space:]')"
  if [[ -z "$byte_count" || "$byte_count" -gt "$MAX_PAYLOAD_BYTES" ]]; then
    VALIDATION_ERROR_CODE="PAYLOAD_TOO_LARGE"
    return 1
  fi

  return 0
}

validate_payload() {
  local workflow_id="$1"
  local payload_file="$2"

  if ! command -v jq >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="JSON_VALIDATOR_UNAVAILABLE"
    return 1
  fi

  if ! jq -e . "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_MALFORMED_JSON"
    return 1
  fi

  if ! jq -e 'type == "object"' "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_NOT_OBJECT"
    return 1
  fi

  if ! jq -e --arg workflow_id "$workflow_id" '
    (.id as $id
      | ($id | type) == "string"
      and $id == $workflow_id)
  ' "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_WORKFLOW_ID_MISMATCH"
    return 1
  fi

  if ! jq -e '
    (.nodes | type) == "array"
    and (.connections | type) == "object"
    and (.name | type) == "string"
    and (.settings | type) == "object"
    and ((.staticData | type) == "object" or (.staticData | type) == "null")
    and (.active | type) == "boolean"
  ' "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_WORKFLOW_SHAPE_INVALID"
    return 1
  fi

  if ! jq -e '
    def normalized_key:
      ascii_downcase | gsub("[^a-z0-9]"; "");
    [keys[] | normalized_key]
    | map(select(
        . == "body"
        or . == "payload"
        or . == "workflow"
        or . == "request"
        or . == "transport"
        or . == "method"
        or . == "url"
        or . == "path"
        or . == "headers"
      ))
    | length == 0
  ' "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_TRANSPORT_ENVELOPE_REJECTED"
    return 1
  fi

  if ! jq -e '
    def normalized_key:
      ascii_downcase | gsub("[^a-z0-9]"; "");
    def forbidden_credential_key:
      normalized_key as $key
      | [
          "authorization",
          "xn8napikey",
          "n8napikey",
          "apikey",
          "apitoken",
          "accesstoken",
          "refreshtoken",
          "authtoken",
          "clientsecret",
          "privatekey",
          "password",
          "secret",
          "token",
          "credentialvalues",
          "credentialdata",
          "rawcredentials"
        ]
      | index($key) != null;
    def is_authorization_header:
      (.name? // null) as $name
      | if ($name | type) == "string"
        then (($name | normalized_key) == "authorization"
          or ($name | normalized_key) == "xn8napikey")
        else false
        end;
    def is_approved_runtime_authorization_reference:
      (.value? // null) as $value
      | ($value | type) == "string"
      and ($value | test(
        "^=\\{\\{[[:space:]]*[\\\"\u0027](Bearer|token)[[:space:]]+[\\\"\u0027][[:space:]]*\\+[[:space:]]*\\$env\\.[A-Z][A-Z0-9_]{0,63}[[:space:]]*\\}\\}$"
      ));
    ([.. | objects | to_entries[] | select(.key | forbidden_credential_key)] | length == 0)
    and ([.. | strings | select(test("^(bearer|basic)[[:space:]]+"; "i"))] | length == 0)
    and ([
      ..
      | objects
      | select(is_authorization_header and (is_approved_runtime_authorization_reference | not))
    ] | length == 0)
  ' "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_CREDENTIAL_MATERIAL_REJECTED"
    return 1
  fi

  if ! jq -e '
    def valid_credential_reference_map:
      type == "object"
      and all(
        to_entries[];
        (.value | type) == "object"
        and ((.value | keys) - ["id", "name"] | length == 0)
        and ((.value.id | type) == "string")
        and (.value.id | test("^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$"))
        and (
          ((.value | has("name")) | not)
          or (((.value.name | type) == "string") and ((.value.name | length) <= 256))
        )
      );
    [.. | objects | select(has("credentials")) | .credentials]
    | all(.[]; valid_credential_reference_map)
  ' "$payload_file" >/dev/null 2>&1; then
    VALIDATION_ERROR_CODE="PAYLOAD_CREDENTIAL_REFERENCE_INVALID"
    return 1
  fi

  return 0
}

build_update_payload() {
  local source_file="$1"
  local destination_file="$2"

  jq -c '{name, nodes, connections, settings, staticData}' \
    "$source_file" >"$destination_file"
}

emit_contract_result() {
  local classification="$1"
  local workflow_id="$2"
  local request_sent="$3"
  local response_received="$4"
  local http_status="$5"
  local response_workflow_id="$6"
  local failure_phase="$7"
  local error_code="$8"
  local http_status_json="null"
  local response_workflow_id_json="null"

  if [[ "$http_status" =~ ^[0-9]{3}$ ]]; then
    http_status_json="$http_status"
  fi
  if [[ -n "$response_workflow_id" ]]; then
    response_workflow_id_json="\"$response_workflow_id\""
  fi

  printf '{"contractVersion":%d,"operation":"update-workflow","classification":"%s","workflowId":"%s","requestSent":%s,"responseReceived":%s,"httpStatus":%s,"responseWorkflowId":%s,"failurePhase":"%s","errorCode":"%s"}\n' \
    "$CONTRACT_VERSION" \
    "$classification" \
    "$workflow_id" \
    "$request_sent" \
    "$response_received" \
    "$http_status_json" \
    "$response_workflow_id_json" \
    "$failure_phase" \
    "$error_code"
}

emit_definitive_pretransmission_failure() {
  local workflow_id="$1"
  local error_code="$2"
  emit_contract_result \
    "definitively_failed" "$workflow_id" false false "" "" \
    "pre_transmission" "$error_code"
  return 10
}

execute_http_once() {
  local workflow_id="$1"
  local payload_file="$2"
  local response_file="$3"
  local status_file="$4"
  local secret_header_file
  local url="${API_BASE_URL}/workflows/${workflow_id}"

  if ! build_secret_header_file; then
    return 70
  fi
  secret_header_file="$CREATED_TEMP_FILE"

  N8N_API_URL= N8N_API_KEY= \
    http_proxy= https_proxy= all_proxy= \
    HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= NO_PROXY= no_proxy= \
    curl \
      --disable \
      --silent \
      --show-error \
      --http1.1 \
      --globoff \
      --request PUT \
      --connect-timeout "$CONNECT_TIMEOUT_SECONDS" \
      --max-time "$TOTAL_TIMEOUT_SECONDS" \
      --retry 0 \
      --max-redirs 0 \
      --noproxy '*' \
      --proto '=https' \
      --max-filesize "$MAX_RESPONSE_BYTES" \
      --header "@$secret_header_file" \
      --header 'Accept: application/json' \
      --header 'Content-Type: application/json' \
      --header 'Expect:' \
      --data-binary "@$payload_file" \
      --output "$response_file" \
      --write-out '%{http_code}' \
      "$url" \
      >"$status_file" 2>/dev/null
  local curl_exit="$?"

  return "$curl_exit"
}

classify_result() {
  local workflow_id="$1"
  local curl_exit="$2"
  local response_file="$3"
  local status_file="$4"
  local status_bytes
  local response_bytes
  local http_status=""
  local response_received=false

  status_bytes="$(wc -c <"$status_file" | tr -d '[:space:]')"
  response_bytes="$(wc -c <"$response_file" | tr -d '[:space:]')"

  if [[ "$status_bytes" -le 16 ]]; then
    http_status="$(tr -d '\r\n' <"$status_file")"
    if [[ ! "$http_status" =~ ^[0-9]{3}$ || "$http_status" == "000" ]]; then
      http_status=""
    else
      response_received=true
    fi
  fi

  if [[ "$curl_exit" -eq 28 ]]; then
    emit_contract_result \
      "timed_out" "$workflow_id" true "$response_received" "$http_status" "" \
      "post_transmission" "REQUEST_TIMED_OUT"
    return 21
  fi

  if [[ "$curl_exit" -ne 0 ]]; then
    if [[ "$response_received" == false
      && ( "$curl_exit" -eq 5 || "$curl_exit" -eq 6 || "$curl_exit" -eq 7 ) ]]; then
      emit_contract_result \
        "definitively_failed" "$workflow_id" false false "" "" \
        "pre_transmission" "TRANSPORT_NOT_CONNECTED"
      return 10
    fi

    emit_contract_result \
      "ambiguous" "$workflow_id" true "$response_received" "$http_status" "" \
      "post_transmission" "TRANSPORT_OUTCOME_UNCERTAIN"
    return 20
  fi

  if [[ "$response_bytes" -gt "$MAX_RESPONSE_BYTES" ]]; then
    emit_contract_result \
      "ambiguous" "$workflow_id" true "$response_received" "$http_status" "" \
      "response_validation" "RESPONSE_TOO_LARGE"
    return 20
  fi

  if [[ -z "$http_status" ]]; then
    emit_contract_result \
      "ambiguous" "$workflow_id" true false "" "" \
      "post_transmission" "HTTP_STATUS_UNAVAILABLE"
    return 20
  fi

  if [[ "$http_status" =~ ^4[0-9]{2}$ ]]; then
    emit_contract_result \
      "definitively_failed" "$workflow_id" true true "$http_status" "" \
      "remote_rejection" "HTTP_REQUEST_REJECTED"
    return 10
  fi

  if [[ ! "$http_status" =~ ^2[0-9]{2}$ ]]; then
    emit_contract_result \
      "ambiguous" "$workflow_id" true true "$http_status" "" \
      "post_transmission" "HTTP_OUTCOME_UNCERTAIN"
    return 20
  fi

  if ! jq -e 'type == "object"' "$response_file" >/dev/null 2>&1; then
    emit_contract_result \
      "ambiguous" "$workflow_id" true true "$http_status" "" \
      "response_validation" "MALFORMED_RESPONSE"
    return 20
  fi

  if ! jq -e --arg workflow_id "$workflow_id" '
    (.id as $id
      | ($id | type) == "string"
      and $id == $workflow_id)
  ' "$response_file" >/dev/null 2>&1; then
    emit_contract_result \
      "ambiguous" "$workflow_id" true true "$http_status" "" \
      "response_validation" "RESPONSE_WORKFLOW_ID_MISMATCH"
    return 20
  fi

  emit_contract_result \
    "succeeded" "$workflow_id" true true "$http_status" "$workflow_id" \
    "none" "NONE"
  return 0
}

update_workflow_contract() {
  local workflow_id="$1"
  local body_source="$2"
  local payload_file
  local request_payload_file
  local response_file
  local status_file
  local curl_exit

  if ! load_runtime_config; then
    emit_definitive_pretransmission_failure "$workflow_id" "$CONFIG_ERROR_CODE"
    return $?
  fi

  if ! command -v curl >/dev/null 2>&1; then
    emit_definitive_pretransmission_failure "$workflow_id" "HTTP_CLIENT_UNAVAILABLE"
    return $?
  fi

  if ! create_temp_file; then
    emit_definitive_pretransmission_failure "$workflow_id" "TEMPORARY_STORAGE_UNAVAILABLE"
    return $?
  fi
  payload_file="$CREATED_TEMP_FILE"

  if ! snapshot_payload "$body_source" "$payload_file"; then
    emit_definitive_pretransmission_failure "$workflow_id" "$VALIDATION_ERROR_CODE"
    return $?
  fi

  if ! validate_payload "$workflow_id" "$payload_file"; then
    emit_definitive_pretransmission_failure "$workflow_id" "$VALIDATION_ERROR_CODE"
    return $?
  fi

  if ! create_temp_file; then
    emit_definitive_pretransmission_failure "$workflow_id" "TEMPORARY_STORAGE_UNAVAILABLE"
    return $?
  fi
  request_payload_file="$CREATED_TEMP_FILE"

  if ! build_update_payload "$payload_file" "$request_payload_file"; then
    emit_definitive_pretransmission_failure "$workflow_id" "PAYLOAD_NORMALIZATION_FAILED"
    return $?
  fi

  if ! create_temp_file; then
    emit_definitive_pretransmission_failure "$workflow_id" "TEMPORARY_STORAGE_UNAVAILABLE"
    return $?
  fi
  response_file="$CREATED_TEMP_FILE"

  if ! create_temp_file; then
    emit_definitive_pretransmission_failure "$workflow_id" "TEMPORARY_STORAGE_UNAVAILABLE"
    return $?
  fi
  status_file="$CREATED_TEMP_FILE"

  set +e
  execute_http_once "$workflow_id" "$request_payload_file" "$response_file" "$status_file"
  curl_exit="$?"
  set -e

  if [[ "$curl_exit" -eq 70 ]]; then
    emit_definitive_pretransmission_failure "$workflow_id" "TEMPORARY_STORAGE_UNAVAILABLE"
    return $?
  fi

  classify_result "$workflow_id" "$curl_exit" "$response_file" "$status_file"
}

load_runtime_config_or_fail() {
  if ! load_runtime_config; then
    printf 'error: invalid runtime configuration\n' >&2
    return 78
  fi
}

main() {
  local cmd="${1:-help}"

  case "$cmd" in
    help|-h|--help)
      require_exact_arg_count 1 "$#" || usage_error
      usage
      ;;
    get-workflow)
      require_exact_arg_count 2 "$#" || usage_error
      validate_workflow_id "$2" || usage_error
      load_runtime_config_or_fail
      api_request GET "/workflows/$2" | pretty_print
      ;;
    update-workflow)
      require_exact_arg_count 3 "$#" || usage_error
      validate_workflow_id "$2" || usage_error
      update_workflow_contract "$2" "$3"
      ;;
    request)
      require_arg_count_between 3 4 "$#" || usage_error
      load_runtime_config_or_fail
      api_request "$2" "$3" "${4:-}" | pretty_print
      ;;
    list-workflows)
      require_exact_arg_count 1 "$#" || usage_error
      load_runtime_config_or_fail
      api_request GET "/workflows" | pretty_print
      ;;
    create-workflow)
      require_exact_arg_count 2 "$#" || usage_error
      load_runtime_config_or_fail
      api_request POST "/workflows" "$2" | pretty_print
      ;;
    delete-workflow)
      require_exact_arg_count 2 "$#" || usage_error
      validate_workflow_id "$2" || usage_error
      load_runtime_config_or_fail
      api_request DELETE "/workflows/$2" | pretty_print
      ;;
    activate-workflow)
      require_arg_count_between 2 3 "$#" || usage_error
      validate_workflow_id "$2" || usage_error
      load_runtime_config_or_fail
      if [[ -n "${3:-}" ]]; then
        api_request POST "/workflows/$2/activate" - <<EOF | pretty_print
{"versionId":"$3"}
EOF
      else
        post_without_body "/workflows/$2/activate" | pretty_print
      fi
      ;;
    deactivate-workflow)
      require_exact_arg_count 2 "$#" || usage_error
      validate_workflow_id "$2" || usage_error
      load_runtime_config_or_fail
      post_without_body "/workflows/$2/deactivate" | pretty_print
      ;;
    credential-schema)
      require_exact_arg_count 2 "$#" || usage_error
      load_runtime_config_or_fail
      api_request GET "/credentials/schema/$2" | pretty_print
      ;;
    create-credential)
      require_exact_arg_count 2 "$#" || usage_error
      load_runtime_config_or_fail
      api_request POST "/credentials" "$2" | pretty_print
      ;;
    update-credential)
      require_exact_arg_count 3 "$#" || usage_error
      load_runtime_config_or_fail
      api_request PATCH "/credentials/$2" "$3" | pretty_print
      ;;
    list-projects)
      require_exact_arg_count 1 "$#" || usage_error
      load_runtime_config_or_fail
      api_request GET "/projects" | pretty_print
      ;;
    list-variables)
      require_exact_arg_count 1 "$#" || usage_error
      load_runtime_config_or_fail
      api_request GET "/variables" | pretty_print
      ;;
    create-variable)
      require_exact_arg_count 2 "$#" || usage_error
      load_runtime_config_or_fail
      api_request POST "/variables" "$2" | pretty_print
      ;;
    *)
      usage_error
      ;;
  esac
}

main "$@"
