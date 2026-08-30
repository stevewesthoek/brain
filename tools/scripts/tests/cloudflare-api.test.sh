#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WRAPPER="${ROOT}/operations/system-configs/bin/cloudflare-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cloudflare-api-test.XXXXXX")"
trap 'rm -rf "${TEST_ROOT}"' EXIT

FAKE_BIN="${TEST_ROOT}/bin"
mkdir -p "${FAKE_BIN}"

cat > "${FAKE_BIN}/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${CURL_CALLS}"
case "$*" in
  *'/accounts/0123456789abcdef0123456789abcdef/tokens/verify'*)
    printf '%s\n' '{"success":true,"result":{"status":"active"},"errors":[]}'
    ;;
  *'/zones?name=thedutchperformance.nl'*)
    printf '%s\n' '{"success":true,"result":[{"id":"abcdefabcdefabcdefabcdefabcdefab","name":"thedutchperformance.nl"}],"errors":[]}'
    ;;
  *'/zones/abcdefabcdefabcdefabcdefabcdefab/dns_records'*)
    printf '%s\n' '{"success":true,"result":[],"errors":[]}'
    ;;
  *)
    printf '%s\n' '{"success":true,"result":[],"errors":[]}'
    ;;
esac
EOF
chmod +x "${FAKE_BIN}/curl"

export PATH="${FAKE_BIN}:/usr/bin:/bin"
export CURL_CALLS="${TEST_ROOT}/calls"
export CLOUDFLARE_API_TOKEN="test-token"
export CLOUDFLARE_ACCOUNT_ID="0123456789abcdef0123456789abcdef"

auth_output="$(${WRAPPER} auth)"
[[ "${auth_output}" == *'"status": "active"'* ]]
dns_output="$(${WRAPPER} dns list thedutchperformance.nl)"
[[ "${dns_output}" == *'"result": []'* ]]

token_file="${TEST_ROOT}/token"
printf '%s\n' 'test-token' > "${token_file}"
chmod 600 "${token_file}"
token_file_output="$(CLOUDFLARE_API_TOKEN='' CLOUDFLARE_API_TOKEN_FILE="${token_file}" ${WRAPPER} auth --account-id 0123456789abcdef0123456789abcdef)"
[[ "${token_file_output}" == *'"status": "active"'* ]]

env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID ${WRAPPER} --help >/dev/null 2>&1

if ${WRAPPER} api post /zones >/dev/null 2>&1; then
  echo "write method was unexpectedly accepted" >&2
  exit 1
fi

if grep -q 'test-token' "${CURL_CALLS}"; then
  echo "test fixture token was exposed in curl arguments" >&2
  exit 1
fi

if grep -Eq '\b(POST|PUT|PATCH|DELETE)\b' "${CURL_CALLS}"; then
  echo "non-GET request was unexpectedly issued" >&2
  exit 1
fi

printf '%s\n' 'cloudflare-api shell contract: PASS'
