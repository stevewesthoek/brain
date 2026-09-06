#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$(cd -- "$SCRIPT_DIR/.." && pwd)/codex-stop-and-repair.sh"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
TEST_ROOT="$(mktemp -d /tmp/codex-stop-test.XXXXXX)"

cleanup() {
  case "$TEST_ROOT" in
    /tmp/codex-stop-test.*) rm -rf -- "$TEST_ROOT" ;;
    *) printf '[ERROR] Refusing unsafe test cleanup: %s\n' "$TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

fail() {
  printf '[FAIL] %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1" needle="$2"
  [[ "$haystack" == *"$needle"* ]] || fail "Expected output to contain: $needle"
}

assert_not_contains() {
  local haystack="$1" needle="$2"
  [[ "$haystack" != *"$needle"* ]] || fail "Expected output not to contain: $needle"
}

cat > "$TEST_ROOT/affected.ps" <<'EOF'
100 1 Office /Applications/ChatGPT.app/Contents/MacOS/ChatGPT
101 1 Office /usr/bin/ssh office
102 1 Office /opt/homebrew/bin/codex app-server --listen
106 1 Office /Applications/Codex Computer Use.app/Contents/MacOS/CUALockScreenGuardian
103 1 Office Contents/Resources/ChatGPTHelper
104 1 Office /usr/bin/ssh-agent -l
105 1 Office /usr/bin/Terminal
EOF

set +e
affected_output="$(
  CODEX_SHUTDOWN_TEST_PS_FILE="$TEST_ROOT/affected.ps" \
    BRAIN_REPO="$REPO_ROOT" HOME=/Users/Office \
    bash "$SCRIPT" --dry-run 2>&1
)"
affected_rc=$?
set -e
[ "$affected_rc" -eq 1 ] || fail "Affected dry-run should exit 1, got $affected_rc"
assert_contains "$affected_output" "PID 100 — ChatGPT application"
assert_contains "$affected_output" "PID 101 — user-owned SSH session"
assert_contains "$affected_output" "PID 102 — Codex app-server"
assert_contains "$affected_output" "PID 106 — Computer Use"
assert_not_contains "$affected_output" "PID 103"
assert_not_contains "$affected_output" "PID 104"
printf '[PASS] dry-run identifies only the scoped Codex and SSH processes\n'

cat > "$TEST_ROOT/clean.ps" <<'EOF'
103 1 Office Contents/Resources/ChatGPTHelper
104 1 Office /usr/bin/ssh-agent -l
105 1 Office /usr/bin/Terminal
EOF

clean_output="$(
  CODEX_SHUTDOWN_TEST_PS_FILE="$TEST_ROOT/clean.ps" \
    BRAIN_REPO="$REPO_ROOT" HOME=/Users/Office \
    bash "$SCRIPT" --dry-run 2>&1
)"
assert_contains "$clean_output" "OK: no affected Codex application, helper, or user-owned SSH process is running."
printf '[PASS] dry-run returns OK when the scoped runtime is clean\n'

printf 'All Codex stop-and-repair tests passed.\n'
