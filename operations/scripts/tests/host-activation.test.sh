#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNNER="$ROOT/operations/scripts/host-activation.sh"
FIXTURE="$(mktemp -d "/tmp/host-activation-test.XXXXXX")"
trap 'rm -rf "$FIXTURE"' EXIT

fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }
pass() { printf 'ok - %s\n' "$*"; }

bash -n "$RUNNER"
pass "runner has valid Bash syntax"

/bin/bash -s -- help < "$RUNNER" >"$FIXTURE/stdin.out" 2>&1
grep -Fq 'host-activation.sh dry-run' "$FIXTURE/stdin.out" || fail "stdin worker mode could not load the runner"
pass "runner loads safely through bash stdin worker mode"

HOST_ACTIVATION_TEST_MODE=1 bash "$RUNNER" __fixture-test "$FIXTURE"
pass "physical-root activation and rollback preserve fixture state"

if bash "$RUNNER" dry-run --expected-commit not-a-commit >"$FIXTURE/invalid.out" 2>&1; then
  fail "malformed packet commit was accepted"
fi
grep -Fq 'exactly 40 lowercase hexadecimal' "$FIXTURE/invalid.out" || fail "malformed commit did not fail at the commit gate"
pass "malformed packet commits fail before host inspection"

bash "$RUNNER" dry-run --expected-commit 0000000000000000000000000000000000000000 >"$FIXTURE/valid.out" 2>&1 || true
! grep -Fq 'exactly 40 lowercase hexadecimal' "$FIXTURE/valid.out" || fail "valid 40-character commit was rejected"
pass "valid 40-character packet commits pass the format gate"

if bash "$RUNNER" rollback --run-id '20260813T000000Z-1/../../escape' >"$FIXTURE/run-id.out" 2>&1; then
  fail "path-traversing run id was accepted"
fi
grep -Fq 'invalid run id' "$FIXTURE/run-id.out" || fail "unsafe run id did not fail at the run-id gate"
pass "run IDs cannot escape owner-only receipt roots"

grep -Fq 'StrictHostKeyChecking=yes' "$RUNNER" || fail "strict host-key verification guard is missing"
grep -Fq 'UpdateHostKeys=no' "$RUNNER" || fail "read-only SSH checks could update known_hosts"
grep -Fq 'ensure_hostkey_alias macbook-m1' "$RUNNER" || fail "Office HostKeyAlias trust derivation is missing"
grep -Fq 'ensure_hostkey_alias office-m4' "$RUNNER" || fail "MacBook HostKeyAlias trust derivation is missing"
! grep -Eq 'StrictHostKeyChecking=(no|accept-new)' "$RUNNER" || fail "host-key verification is weakened"
! grep -Eq '(^|[[:space:]])(rm|unlink)[[:space:]]+-[rRfF]' "$RUNNER" || fail "runner contains recursive/forced deletion"
! grep -Fq 'launchctl' "$RUNNER" || fail "runner must not manage launchd"
! grep -Eq 'codex-home-managed-root\.sh"[[:space:]]+migrate' "$RUNNER" || fail "runner must never migrate the Codex root"
grep -Fq 'codex-home-managed-root.sh" repair' "$RUNNER" || fail "Codex repair flow is missing"
grep -Fq 'codex-home-managed-root.sh" check' "$RUNNER" || fail "Codex check flow is missing"
pass "static destructive-action and Codex-root guards hold"

for phase in 0 1 2 3 4 5 6 7 8 9 10; do
  grep -Eq "phase $phase |Phase $phase" "$RUNNER" || fail "phase $phase is not represented"
done
pass "all required phases 0 through 10 are represented"

grep -Fq 'ROLLBACK COMPLETE' "$RUNNER" || fail "explicit rollback result is missing"
grep -Fq 'PASS — HOST ACTIVATION COMPLETE' "$RUNNER" || fail "explicit PASS result is missing"
grep -Fq 'DO NOT CLOSE until fresh post-change SSH succeeds' "$RUNNER" || fail "rescue-session warning is missing"
grep -Fq 'Save-to-Mind read-only canonical readback' "$RUNNER" || fail "final read-only Save-to-Mind acceptance is missing"
grep -Fq "trap 'office_abort 130' INT TERM HUP" "$RUNNER" || fail "Office signal rollback guard is missing"
grep -Fq "trap 'mac_abort 130' INT TERM HUP" "$RUNNER" || fail "MacBook signal rollback guard is missing"
pass "PASS/ROLLBACK and rescue-session output are explicit"

printf 'host activation tests passed\n'
