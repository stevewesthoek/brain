#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER="$ROOT_DIR/tools/n8n-api.sh"
CONTRACT_JSON="$ROOT_DIR/docs/contracts/n8n-workflow-wrapper-v1.json"
CONTRACT_DOC="$ROOT_DIR/docs/contracts/n8n-workflow-wrapper-v1.md"
RUNBOOK="$ROOT_DIR/operations/runbooks/n8n-access-setup.md"
FIXTURE_DIR="$ROOT_DIR/tests/fixtures/n8n-wrapper"
VALID_WORKFLOW="$FIXTURE_DIR/workflow-example-001.json"
WRONG_RESPONSE="$FIXTURE_DIR/response-wrong-workflow.json"
MALFORMED_RESPONSE="$FIXTURE_DIR/response-malformed.json"

TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/n8n-api-contract.XXXXXX")"
FAKE_BIN="$TEST_TMP/bin"
EMPTY_FILE="$TEST_TMP/empty"
CASE_INDEX=0
TEST_INDEX=0

cleanup() {
  if [[ -n "${TEST_TMP:-}" && "$TEST_TMP" == */n8n-api-contract.* ]]; then
    rm -rf -- "$TEST_TMP"
  fi
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN"
cp "$FIXTURE_DIR/fake-curl.sh" "$FAKE_BIN/curl"
chmod +x "$FAKE_BIN/curl"
: >"$EMPTY_FILE"

fail() {
  printf 'not ok %d - %s\n' "$TEST_INDEX" "$1" >&2
  exit 1
}

pass() {
  printf 'ok %d - %s\n' "$TEST_INDEX" "$1"
}

run_test() {
  local name="$1"
  local function_name="$2"
  TEST_INDEX="$((TEST_INDEX + 1))"
  "$function_name"
  pass "$name"
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    fail "$label (expected $expected, got $actual)"
  fi
}

assert_json_equal() {
  local filter="$1"
  local expected="$2"
  local label="$3"
  local actual
  if ! actual="$(jq -r "$filter" "$RUN_STDOUT" 2>/dev/null)"; then
    fail "$label (result was not valid JSON)"
  fi
  assert_equal "$expected" "$actual" "$label"
}

request_count() {
  if [[ -f "$CASE_STATE/invocation-count" ]]; then
    tr -d '[:space:]' <"$CASE_STATE/invocation-count"
  else
    printf '0'
  fi
}

request_record_value() {
  local key="$1"
  local request_number="${2:-1}"
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      print
      exit
    }
  ' "$CASE_STATE/request-$request_number"
}

new_case() {
  CASE_INDEX="$((CASE_INDEX + 1))"
  CASE_DIR="$TEST_TMP/case-$CASE_INDEX"
  CASE_STATE="$CASE_DIR/state"
  RUN_STDOUT="$CASE_DIR/stdout"
  RUN_STDERR="$CASE_DIR/stderr"
  RUN_INPUT="$EMPTY_FILE"
  RUN_RESPONSE="$VALID_WORKFLOW"
  RUN_HTTP_STATUS=200
  RUN_CURL_EXIT=0
  RUN_API_URL="https://n8n.invalid/api/v1"
  RUN_API_KEY="synthetic-api-key-not-a-secret"
  RUN_CONNECT_TIMEOUT=5
  RUN_TOTAL_TIMEOUT=60
  RUN_FAKE_STDERR=""
  mkdir -p "$CASE_STATE" "$CASE_DIR/tmp"
}

run_wrapper() {
  set +e
  PATH="$FAKE_BIN:/usr/bin:/bin" \
  TMPDIR="$CASE_DIR/tmp" \
  N8N_API_URL="$RUN_API_URL" \
  N8N_API_KEY="$RUN_API_KEY" \
  N8N_CONNECT_TIMEOUT_SECONDS="$RUN_CONNECT_TIMEOUT" \
  N8N_TOTAL_TIMEOUT_SECONDS="$RUN_TOTAL_TIMEOUT" \
  FAKE_CURL_STATE_DIR="$CASE_STATE" \
  FAKE_CURL_RESPONSE_PATH="$RUN_RESPONSE" \
  FAKE_CURL_HTTP_STATUS="$RUN_HTTP_STATUS" \
  FAKE_CURL_EXIT_CODE="$RUN_CURL_EXIT" \
  FAKE_CURL_STDERR="$RUN_FAKE_STDERR" \
    "$WRAPPER" "$@" <"$RUN_INPUT" >"$RUN_STDOUT" 2>"$RUN_STDERR"
  RUN_STATUS="$?"
  set -e
}

test_metadata_fixture() {
  jq -e '
    .schemaVersion == 1
    and .kind == "n8n-workflow-wrapper"
    and .readOperation == "get-workflow"
    and .readArgv == ["get-workflow", "<workflowId>"]
    and .mutationOperation == "update-workflow"
    and .mutationArgv == ["update-workflow", "<workflowId>", "-"]
    and .mutationHttpMethod == "PUT"
    and .mutationPathTemplate == "/workflows/{workflowId}"
    and .mutationPayloadTransport == "stdin"
    and .maximumPayloadBytes == 500000
    and .maximumResponseBytes == 500000
    and .defaultConnectTimeoutSeconds == 5
    and .maximumConnectTimeoutSeconds == 30
    and .defaultTotalTimeoutSeconds == 60
    and .maximumTotalTimeoutSeconds == 300
    and .automaticRetries == 0
    and .maximumMutationRequestsPerInvocation == 1
    and .followsRedirects == false
    and .usesAmbientClientConfiguration == false
    and .requiresReadbackAfterMutation == true
    and .duplicateInvocationsAreIntrinsicallySafe == false
    and .requiresExternalReplayProtection == true
    and .classifications == [
      "succeeded",
      "definitively_failed",
      "ambiguous",
      "timed_out"
    ]
  ' "$CONTRACT_JSON" >/dev/null

  if jq -e '
    has("executablePath")
    or has("sourceId")
    or has("workflowId")
    or has("apiOrigin")
    or has("credentialLocation")
    or has("repositoryPath")
    or has("userName")
  ' "$CONTRACT_JSON" >/dev/null; then
    fail "metadata fixture contains installation identity"
  fi
}

test_get_workflow_contract() {
  new_case
  run_wrapper get-workflow workflow-example-001
  assert_equal 0 "$RUN_STATUS" "get-workflow exit"
  assert_equal 1 "$(request_count)" "get-workflow request count"
  assert_equal GET "$(request_record_value method)" "get-workflow method"
  assert_equal "https://n8n.invalid/api/v1/workflows/workflow-example-001" \
    "$(request_record_value url)" "get-workflow URL"
  assert_json_equal '.id' workflow-example-001 "get-workflow identity"
}

test_invalid_operation_argv() {
  new_case
  run_wrapper get-workflow
  assert_equal 64 "$RUN_STATUS" "missing read workflow ID"
  assert_equal 0 "$(request_count)" "missing read ID request count"

  new_case
  run_wrapper get-workflow workflow-example-001 extra
  assert_equal 64 "$RUN_STATUS" "extra read argument"
  assert_equal 0 "$(request_count)" "extra read argument request count"

  new_case
  run_wrapper update-workflow
  assert_equal 64 "$RUN_STATUS" "missing mutation workflow ID"
  assert_equal 0 "$(request_count)" "missing mutation ID request count"

  new_case
  run_wrapper update-workflow workflow-example-001 - extra
  assert_equal 64 "$RUN_STATUS" "extra mutation argument"
  assert_equal 0 "$(request_count)" "extra mutation argument request count"

  new_case
  run_wrapper unknown-operation
  assert_equal 64 "$RUN_STATUS" "unknown operation"
  assert_equal 0 "$(request_count)" "unknown operation request count"
}

test_success_stdin_and_fixed_request() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  run_wrapper update-workflow workflow-example-001 -

  assert_equal 0 "$RUN_STATUS" "successful mutation exit"
  assert_equal 1 "$(request_count)" "successful mutation request count"
  assert_json_equal '.contractVersion' 1 "contract version"
  assert_json_equal '.operation' update-workflow "operation"
  assert_json_equal '.classification' succeeded "success classification"
  assert_json_equal '.workflowId' workflow-example-001 "request workflow identity"
  assert_json_equal '.responseWorkflowId' workflow-example-001 "response workflow identity"
  assert_json_equal '.requestSent' true "request sent"
  assert_json_equal '.responseReceived' true "response received"
  assert_json_equal '.httpStatus' 200 "success HTTP status"
  assert_equal PUT "$(request_record_value method)" "mutation method"
  assert_equal "https://n8n.invalid/api/v1/workflows/workflow-example-001" \
    "$(request_record_value url)" "mutation URL"
  assert_equal file "$(request_record_value payload_transport)" "internal payload transport"
  cmp -s "$VALID_WORKFLOW" "$CASE_STATE/request-body-1" \
    || fail "stdin payload was not forwarded byte-for-byte"
}

test_http_client_constraints() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  run_wrapper update-workflow workflow-example-001 -

  assert_equal 1 "$(request_count)" "constrained client request count"
  assert_equal 5 "$(request_record_value connect_timeout)" "connect timeout"
  assert_equal 60 "$(request_record_value total_timeout)" "total timeout"
  assert_equal 0 "$(request_record_value retry_count)" "retry count"
  assert_equal 0 "$(request_record_value maximum_redirects)" "maximum redirects"
  assert_equal '*' "$(request_record_value proxy_bypass)" "proxy bypass"
  assert_equal '=https' "$(request_record_value allowed_protocols)" "allowed protocols"
  assert_equal 500000 "$(request_record_value maximum_response_bytes)" "response cap"
  assert_equal 1.1 "$(request_record_value http_version)" "HTTP version"
  assert_equal true "$(request_record_value ambient_config_disabled)" "ambient config disabled"
  assert_equal false "$(request_record_value follow_redirects)" "redirect following"
  assert_equal false "$(request_record_value retry_all_errors)" "retry-all-errors"
  assert_equal true "$(request_record_value secret_header_via_file)" "secret header transport"
  assert_equal false "$(request_record_value secret_env_present)" "secret removed from child env"
  assert_equal "X-N8N-API-KEY,Accept,Content-Type,Expect" \
    "$(request_record_value header_names)" "fixed header names"
}

test_manual_file_compatibility() {
  new_case
  run_wrapper update-workflow workflow-example-001 "$VALID_WORKFLOW"
  assert_equal 0 "$RUN_STATUS" "manual file-path exit"
  assert_equal 1 "$(request_count)" "manual file-path request count"
  cmp -s "$VALID_WORKFLOW" "$CASE_STATE/request-body-1" \
    || fail "manual file payload was not snapshotted exactly"
  rg -q 'manual compatibility' "$CONTRACT_DOC" \
    || fail "manual compatibility boundary is undocumented"
}

test_malformed_payload() {
  new_case
  malformed="$CASE_DIR/malformed.json"
  printf '{"id":' >"$malformed"
  RUN_INPUT="$malformed"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "malformed payload exit"
  assert_equal 0 "$(request_count)" "malformed payload request count"
  assert_json_equal '.classification' definitively_failed "malformed classification"
  assert_json_equal '.requestSent' false "malformed request sent"
  assert_json_equal '.errorCode' PAYLOAD_MALFORMED_JSON "malformed error code"
}

test_non_object_payload() {
  new_case
  non_object="$CASE_DIR/non-object.json"
  printf '[]\n' >"$non_object"
  RUN_INPUT="$non_object"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "non-object payload exit"
  assert_equal 0 "$(request_count)" "non-object request count"
  assert_json_equal '.errorCode' PAYLOAD_NOT_OBJECT "non-object error code"
}

test_oversized_payload() {
  new_case
  oversized="$CASE_DIR/oversized.json"
  {
    printf '{"id":"workflow-example-001","active":false,"nodes":[],"connections":{},"padding":"'
    head -c 500001 /dev/zero | tr '\0' x
    printf '"}'
  } >"$oversized"
  RUN_INPUT="$oversized"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "oversized payload exit"
  assert_equal 0 "$(request_count)" "oversized payload request count"
  assert_json_equal '.errorCode' PAYLOAD_TOO_LARGE "oversized payload error code"
}

test_workflow_identity_and_envelope_validation() {
  new_case
  wrong_id="$CASE_DIR/wrong-id.json"
  jq '.id = "workflow-example-002"' "$VALID_WORKFLOW" >"$wrong_id"
  RUN_INPUT="$wrong_id"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "wrong payload identity exit"
  assert_equal 0 "$(request_count)" "wrong payload identity request count"
  assert_json_equal '.errorCode' PAYLOAD_WORKFLOW_ID_MISMATCH "wrong payload identity code"

  new_case
  envelope="$CASE_DIR/envelope.json"
  jq '.payload = {"unexpected": true}' "$VALID_WORKFLOW" >"$envelope"
  RUN_INPUT="$envelope"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "transport envelope exit"
  assert_equal 0 "$(request_count)" "transport envelope request count"
  assert_json_equal '.errorCode' PAYLOAD_TRANSPORT_ENVELOPE_REJECTED "transport envelope code"
}

test_credential_like_payload_rejection() {
  new_case
  credential_field="$CASE_DIR/credential-field.json"
  jq '.nodes[0].parameters.apiKey = "synthetic-raw-value"' \
    "$VALID_WORKFLOW" >"$credential_field"
  RUN_INPUT="$credential_field"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "credential-like payload exit"
  assert_equal 0 "$(request_count)" "credential-like payload request count"
  assert_json_equal '.errorCode' PAYLOAD_CREDENTIAL_MATERIAL_REJECTED "credential-like code"

  new_case
  authorization="$CASE_DIR/authorization.json"
  jq '.nodes[0].parameters.header = {
    "name": "Authorization",
    "value": "Bearer synthetic-raw-value"
  }' "$VALID_WORKFLOW" >"$authorization"
  RUN_INPUT="$authorization"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "authorization payload exit"
  assert_equal 0 "$(request_count)" "authorization payload request count"
  assert_json_equal '.errorCode' PAYLOAD_CREDENTIAL_MATERIAL_REJECTED "authorization code"
}

test_invalid_credential_reference() {
  new_case
  invalid_reference="$CASE_DIR/invalid-reference.json"
  jq '.nodes[2].credentials.httpHeaderAuth.raw = "synthetic-raw-value"' \
    "$VALID_WORKFLOW" >"$invalid_reference"
  RUN_INPUT="$invalid_reference"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "invalid credential reference exit"
  assert_equal 0 "$(request_count)" "invalid credential reference request count"
  assert_json_equal '.errorCode' PAYLOAD_CREDENTIAL_REFERENCE_INVALID "invalid reference code"
}

test_http_rejection() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_HTTP_STATUS=400
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "HTTP rejection exit"
  assert_equal 1 "$(request_count)" "HTTP rejection request count"
  assert_json_equal '.classification' definitively_failed "HTTP rejection classification"
  assert_json_equal '.requestSent' true "HTTP rejection request sent"
  assert_json_equal '.responseReceived' true "HTTP rejection response received"
  assert_json_equal '.httpStatus' 400 "HTTP rejection status"
}

test_pretransmission_connection_failure() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$EMPTY_FILE"
  RUN_HTTP_STATUS=000
  RUN_CURL_EXIT=7
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "connection failure exit"
  assert_equal 1 "$(request_count)" "connection failure client invocation count"
  assert_json_equal '.classification' definitively_failed "connection failure classification"
  assert_json_equal '.requestSent' false "connection failure request sent"
  assert_json_equal '.errorCode' TRANSPORT_NOT_CONNECTED "connection failure code"
}

test_ambiguous_transport_failure() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$EMPTY_FILE"
  RUN_HTTP_STATUS=000
  RUN_CURL_EXIT=56
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 20 "$RUN_STATUS" "ambiguous transport exit"
  assert_equal 1 "$(request_count)" "ambiguous transport request count"
  assert_json_equal '.classification' ambiguous "ambiguous transport classification"
  assert_json_equal '.requestSent' true "ambiguous transport request sent"
  assert_json_equal '.responseReceived' false "ambiguous transport response received"
}

test_timeout_classification() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$EMPTY_FILE"
  RUN_HTTP_STATUS=000
  RUN_CURL_EXIT=28
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 21 "$RUN_STATUS" "timeout exit"
  assert_equal 1 "$(request_count)" "timeout request count"
  assert_json_equal '.classification' timed_out "timeout classification"
  assert_json_equal '.requestSent' true "timeout request sent"
  assert_json_equal '.errorCode' REQUEST_TIMED_OUT "timeout code"
}

test_redirect_and_server_failure_are_ambiguous() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_HTTP_STATUS=302
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 20 "$RUN_STATUS" "redirect exit"
  assert_equal 1 "$(request_count)" "redirect request count"
  assert_json_equal '.classification' ambiguous "redirect classification"

  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_HTTP_STATUS=500
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 20 "$RUN_STATUS" "server failure exit"
  assert_equal 1 "$(request_count)" "server failure request count"
  assert_json_equal '.classification' ambiguous "server failure classification"
}

test_malformed_success_response() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$MALFORMED_RESPONSE"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 20 "$RUN_STATUS" "malformed response exit"
  assert_equal 1 "$(request_count)" "malformed response request count"
  assert_json_equal '.classification' ambiguous "malformed response classification"
  assert_json_equal '.errorCode' MALFORMED_RESPONSE "malformed response code"
}

test_wrong_response_identity() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$WRONG_RESPONSE"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 20 "$RUN_STATUS" "wrong response identity exit"
  assert_equal 1 "$(request_count)" "wrong response identity request count"
  assert_json_equal '.classification' ambiguous "wrong response identity classification"
  assert_json_equal '.errorCode' RESPONSE_WORKFLOW_ID_MISMATCH "wrong response identity code"
}

test_bounded_response_output() {
  new_case
  oversized_response="$CASE_DIR/oversized-response.json"
  {
    printf '{"id":"workflow-example-001","padding":"'
    head -c 500100 /dev/zero | tr '\0' x
    printf '"}'
  } >"$oversized_response"
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$oversized_response"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 20 "$RUN_STATUS" "oversized response exit"
  assert_equal 1 "$(request_count)" "oversized response request count"
  assert_json_equal '.classification' ambiguous "oversized response classification"
  assert_json_equal '.errorCode' RESPONSE_TOO_LARGE "oversized response code"
  output_bytes="$(wc -c <"$RUN_STDOUT" | tr -d '[:space:]')"
  if [[ "$output_bytes" -gt 1024 ]]; then
    fail "structured response output exceeded 1,024 bytes"
  fi
}

test_protected_payload_forwarding() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  run_wrapper update-workflow workflow-example-001 -
  cmp -s "$VALID_WORKFLOW" "$CASE_STATE/request-body-1" \
    || fail "protected workflow payload bytes changed"
  jq -e '
    .active == false
    and (.settings | type) == "object"
    and (.tags | length) == 1
    and (.shared | length) == 1
    and .nodes[2].credentials.httpHeaderAuth.id == "credential-reference-example"
    and ([.nodes[].type] | index("n8n-nodes-base.webhook") != null)
    and ([.nodes[].type] | index("n8n-nodes-base.scheduleTrigger") != null)
  ' "$CASE_STATE/request-body-1" >/dev/null
  rg -q 'Workbench must always perform readback' "$CONTRACT_DOC" \
    || fail "mandatory protected-state readback is undocumented"
}

test_duplicate_invocations_require_external_protection() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 0 "$RUN_STATUS" "first duplicate test invocation"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 0 "$RUN_STATUS" "second duplicate test invocation"
  assert_equal 2 "$(request_count)" "separate invocation mutation count"
  documented_contract_text="$(awk '{ printf "%s ", $0 }' "$CONTRACT_DOC" | tr -s '[:space:]' ' ')"
  [[ "$documented_contract_text" == *"A second wrapper invocation is a second mutation request"* ]] \
    || fail "duplicate invocation limitation is undocumented"
  rg -q 'never blind retry' "$CONTRACT_DOC" \
    || fail "ambiguous retry prohibition is undocumented"
}

test_timeout_bounds_rejected_before_client() {
  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_CONNECT_TIMEOUT=31
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "connect timeout maximum exit"
  assert_equal 0 "$(request_count)" "invalid connect timeout request count"
  assert_json_equal '.errorCode' CONNECT_TIMEOUT_INVALID "connect timeout code"

  new_case
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_TOTAL_TIMEOUT=301
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 10 "$RUN_STATUS" "total timeout maximum exit"
  assert_equal 0 "$(request_count)" "invalid total timeout request count"
  assert_json_equal '.errorCode' TOTAL_TIMEOUT_INVALID "total timeout code"
}

test_secret_safe_output() {
  new_case
  secret_response="$CASE_DIR/secret-response.json"
  printf '%s\n' '{
    "id": "workflow-example-001",
    "authorization": "Bearer synthetic-secret-marker"
  }' >"$secret_response"
  RUN_INPUT="$VALID_WORKFLOW"
  RUN_RESPONSE="$secret_response"
  RUN_FAKE_STDERR="synthetic-secret-marker"
  run_wrapper update-workflow workflow-example-001 -
  assert_equal 0 "$RUN_STATUS" "secret-safe response exit"
  if rg -q 'synthetic-secret-marker|Bearer' "$RUN_STDOUT" "$RUN_STDERR"; then
    fail "raw response or client error leaked into wrapper output"
  fi
}

test_no_retry_loop_or_ambient_identity() {
  mutation_function="$TEST_TMP/execute-http-once.sh"
  sed -n '/^execute_http_once()/,/^}/p' "$WRAPPER" >"$mutation_function"
  mutation_curl_calls="$(awk '$1 == "curl" { count++ } END { print count + 0 }' "$mutation_function")"
  assert_equal 1 "$mutation_curl_calls" "mutation HTTP-client call sites"

  if rg -q '^[[:space:]]*(for|while|until)[[:space:]]' "$mutation_function"; then
    fail "mutation HTTP function contains a retry-capable loop"
  fi
  if rg -q -- '--retry[=[:space:]]+[1-9]' "$WRAPPER"; then
    fail "wrapper contains a nonzero retry configuration"
  fi
  if rg -q '/Users/|n8n\.prochat\.tools|\.config/n8n|source-a|brain' "$WRAPPER" "$CONTRACT_JSON"; then
    fail "generic wrapper contract contains installation identity"
  fi
}

test_changed_path_secret_scan() {
  if rg -q -P '^[[:space:]]*(?:export[[:space:]]+)?N8N_API_KEY[[:space:]]*=[[:space:]]*(?!<SET_IN_LOCAL_SECRET_STORE>[[:space:]]*$)' "$RUNBOOK"; then
    fail "runbook contains a non-placeholder n8n API key assignment"
  fi
  rg -q '<SET_IN_LOCAL_SECRET_STORE>' "$RUNBOOK" \
    || fail "runbook credential placeholder is missing"

  if rg -q -P '(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])' \
    "$WRAPPER" "$CONTRACT_DOC" "$CONTRACT_JSON" "$FIXTURE_DIR" "$RUNBOOK"; then
    fail "JWT-like material found in changed contract paths"
  fi
}

run_test "machine-readable contract fixture" test_metadata_fixture
run_test "get-workflow fixed read operation" test_get_workflow_contract
run_test "operation and argv rejection" test_invalid_operation_argv
run_test "successful stdin mutation and fixed request" test_success_stdin_and_fixed_request
run_test "HTTP client timeout/retry/redirect constraints" test_http_client_constraints
run_test "manual file-path compatibility boundary" test_manual_file_compatibility
run_test "malformed payload rejected before HTTP" test_malformed_payload
run_test "non-object payload rejected before HTTP" test_non_object_payload
run_test "oversized payload rejected before HTTP" test_oversized_payload
run_test "workflow identity and envelope validation" test_workflow_identity_and_envelope_validation
run_test "credential and authorization rejection" test_credential_like_payload_rejection
run_test "credential references remain references" test_invalid_credential_reference
run_test "HTTP rejection is definitive" test_http_rejection
run_test "proven pre-transmission connection failure" test_pretransmission_connection_failure
run_test "post-transmission transport ambiguity" test_ambiguous_transport_failure
run_test "timeout classification" test_timeout_classification
run_test "redirect and server failure ambiguity" test_redirect_and_server_failure_are_ambiguous
run_test "malformed success response ambiguity" test_malformed_success_response
run_test "wrong response workflow identity ambiguity" test_wrong_response_identity
run_test "bounded response output" test_bounded_response_output
run_test "protected payload forwarded byte-for-byte" test_protected_payload_forwarding
run_test "duplicate invocations require external replay protection" test_duplicate_invocations_require_external_protection
run_test "timeout maxima enforced before HTTP" test_timeout_bounds_rejected_before_client
run_test "secret-safe structured output" test_secret_safe_output
run_test "no retry loop or installation identity" test_no_retry_loop_or_ambient_identity
run_test "changed-path secret scan" test_changed_path_secret_scan

printf '1..%d\n' "$TEST_INDEX"
printf 'All n8n wrapper contract tests passed with fake HTTP only.\n'
