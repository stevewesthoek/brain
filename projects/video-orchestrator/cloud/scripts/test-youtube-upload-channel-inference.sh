#!/bin/bash
# Deterministic tests for youtube-upload-local.sh channel inference and dry-run behavior.
# Safe to run: reads env vars + temp files only; never uploads.
# Usage: bash scripts/test-youtube-upload-channel-inference.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPLOAD_SCRIPT="$SCRIPT_DIR/youtube-upload-local.sh"
JOBS_DIR="$SCRIPT_DIR/../jobs"
PASS=0
FAIL=0

green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }

assert_output_contains() {
    local label="$1"
    local expected="$2"
    local actual="$3"
    if echo "$actual" | grep -qF "$expected"; then
        green "  PASS: $label"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $label"
        echo "    expected output to contain: $expected"
        echo "    got: $(echo "$actual" | head -5)"
        FAIL=$((FAIL + 1))
    fi
}

assert_exit_nonzero() {
    local label="$1"
    local exit_code="$2"
    if [ "$exit_code" -ne 0 ]; then
        green "  PASS: $label (exit $exit_code)"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $label (expected non-zero exit, got 0)"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== youtube-upload-local.sh channel inference tests ==="
echo ""

# --- Test 1: explicit YOUTUBE_CHANNEL_ID override ---
echo "[1] Explicit YOUTUBE_CHANNEL_ID override takes priority over inference"
OUT=$(YOUTUBE_CHANNEL_ID=prochat bash "$UPLOAD_SCRIPT" "some-unknown-job-id" --dry-run 2>&1 || true)
assert_output_contains "explicit override used (prochat channel config)" "Channel config: prochat" "$OUT"

# --- Test 2: prochat-* inference ---
echo ""
echo "[2] prochat-* job ID infers 'prochat' channel"
OUT=$(bash "$UPLOAD_SCRIPT" "prochat-test-001" --dry-run 2>&1 || true)
assert_output_contains "prochat-* infers prochat channel" "Channel config: prochat" "$OUT"

# --- Test 3: says-the-bible-* inference ---
echo ""
echo "[3] says-the-bible-* job ID infers 'says-the-bible' channel"
OUT=$(bash "$UPLOAD_SCRIPT" "says-the-bible-test-001" --dry-run 2>&1 || true)
assert_output_contains "says-the-bible-* infers says-the-bible channel" "Channel config: says-the-bible" "$OUT"

# --- Test 4: approved-video-* inference from topic.json ---
echo ""
echo "[4] approved-video-* infers channel from topic.json projectId"
# Create temp job dir with topic.json for this test
TMP_JOBS="$(mktemp -d)"
mkdir -p "$TMP_JOBS/approved-video-test-inference-job/metadata"
cat > "$TMP_JOBS/approved-video-test-inference-job/metadata/topic.json" <<'EOF'
{"projectId":"prochat","title":"Test","source":"approved-moving-video-content"}
EOF

# The script resolves jobs dir relative to itself: jobs/ is sibling of scripts/
# Override: temporarily symlink or use JOBS_DIR env override if script supports it,
# otherwise test directly via a wrapper that puts topic.json at expected location.
# The script computes: jobs_dir="$(dirname "$script_dir")/jobs"
# Since SCRIPT_DIR = .../cloud/scripts, jobs_dir = .../cloud/jobs
# For this test we use an existing real job with a real topic.json
REAL_JOB_ID="approved-video-approval-content-mqkt437v-88eyy4"
if [ -f "$JOBS_DIR/$REAL_JOB_ID/metadata/topic.json" ]; then
    PROJ_ID=$(python3 -c "import json; d=json.load(open('$JOBS_DIR/$REAL_JOB_ID/metadata/topic.json')); print(d.get('projectId',''))" 2>/dev/null || echo "")
    if [ -n "$PROJ_ID" ]; then
        OUT=$(bash "$UPLOAD_SCRIPT" "$REAL_JOB_ID" --dry-run 2>&1 || true)
        assert_output_contains "approved-video-* infers channel from topic.json" "Channel config: $PROJ_ID" "$OUT"
    else
        red "  SKIP: topic.json found but projectId empty"
        FAIL=$((FAIL + 1))
    fi
else
    red "  SKIP: no real approved-video-* job with topic.json found at $JOBS_DIR/$REAL_JOB_ID"
    FAIL=$((FAIL + 1))
fi
rm -rf "$TMP_JOBS"

# --- Test 5: unknown job ID with no YOUTUBE_CHANNEL_ID → error ---
echo ""
echo "[5] Unknown job ID with no channel config → error + non-zero exit"
OUT=$(bash "$UPLOAD_SCRIPT" "unknown-job-xyz-123" --dry-run 2>&1; EXIT_CODE=$?; echo "EXIT:$EXIT_CODE")
EXIT_CODE=$(echo "$OUT" | grep "EXIT:" | sed 's/EXIT://')
assert_output_contains "unknown job prints channel error" "Cannot infer YouTube channel" "$OUT"
assert_exit_nonzero "unknown job exits non-zero" "${EXIT_CODE:-1}"

# --- Test 6: approved-video-* with missing topic.json → error ---
echo ""
echo "[6] approved-video-* with no topic.json → cannot infer channel → error"
OUT=$(bash "$UPLOAD_SCRIPT" "approved-video-no-such-job-zzz" --dry-run 2>&1; echo "EXIT:$?")
EXIT_CODE=$(echo "$OUT" | grep "EXIT:" | sed 's/EXIT://')
assert_output_contains "missing topic.json causes channel error" "Cannot infer YouTube channel" "$OUT"

# --- Test 7: dry-run without token file → skip with warning, not error ---
echo ""
echo "[7] dry-run without token file → warning skip, not fatal exit"
# Use a temp minimal channel config so source doesn't override YOUTUBE_TOKEN_FILE
TMP_CHANNEL_DIR="$(mktemp -d)"
TMP_CONFIG="$TMP_CHANNEL_DIR/test-chan.env"
cat > "$TMP_CONFIG" <<'EOF'
YOUTUBE_ACCOUNT_LABEL="test@test.invalid"
YOUTUBE_CHANNEL_TITLE="Test Channel"
EOF
FAKE_TOKEN_PATH="$TMP_CHANNEL_DIR/no-such-token.json"
OUT=$(YOUTUBE_CHANNEL_ID=test-chan \
      YOUTUBE_CONFIG_FILE="$TMP_CONFIG" \
      YOUTUBE_TOKEN_FILE="$FAKE_TOKEN_PATH" \
      bash "$UPLOAD_SCRIPT" "prochat-test-001" --dry-run 2>&1 || true)
assert_output_contains "dry-run skips missing token with warning" "DRY-RUN" "$OUT"
if echo "$OUT" | grep -q "ERROR: Token file not found"; then
    red "  FAIL: dry-run emitted fatal token error instead of warning"
    FAIL=$((FAIL + 1))
else
    green "  PASS: dry-run did not exit with token error"
    PASS=$((PASS + 1))
fi

# --- Test 8: live mode without token file → fatal error ---
echo ""
echo "[8] live mode without token file → fatal exit"
FAKE_TOKEN_PATH2="$TMP_CHANNEL_DIR/no-such-token-live.json"
OUT=$(YOUTUBE_CHANNEL_ID=test-chan \
      YOUTUBE_CONFIG_FILE="$TMP_CONFIG" \
      YOUTUBE_TOKEN_FILE="$FAKE_TOKEN_PATH2" \
      bash "$UPLOAD_SCRIPT" "prochat-test-001" 2>&1; echo "EXIT:$?")
EXIT_CODE=$(echo "$OUT" | grep "EXIT:" | sed 's/EXIT://')
assert_output_contains "live mode token error is fatal" "ERROR: Token file not found" "$OUT"
assert_exit_nonzero "live mode exits non-zero without token" "${EXIT_CODE:-1}"
rm -rf "$TMP_CHANNEL_DIR"

echo ""
echo "=== Results ==="
if [ "$FAIL" -eq 0 ]; then
    green "All $PASS tests passed"
else
    red "$FAIL failed, $PASS passed"
    exit 1
fi
