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

grep -Fq 'readonly NO_MUTATION_EXIT=20' "$RUNNER" || fail "dedicated no-mutation exit is missing"
grep -Fq 'readonly ROLLBACK_FAILED_EXIT=21' "$RUNNER" || fail "dedicated rollback-failure exit is missing"
grep -Fq 'Office Phase 0 made no changes; no receipt or rollback is required.' "$RUNNER" || fail "Office no-mutation preflight result is missing"
grep -Fq 'Office Phase 0–2 changed no live paths; partial receipt retained for diagnosis.' "$RUNNER" || fail "Office partial-receipt no-mutation result is missing"
grep -Fq 'Office run state is pre-mutation but the live SSH config is absent; manual recovery is required' "$RUNNER" || fail "Office rollback does not detect an impossible pre-mutation SSH state"
grep -Fq 'if [ "$office_rc" -eq "$NO_MUTATION_EXIT" ]; then' "$RUNNER" || fail "MacBook does not distinguish a no-mutation stop from a rollback failure"
grep -A4 -F 'if [ "$office_rc" -eq "$NO_MUTATION_EXIT" ]; then' "$RUNNER" | grep -Fq 'close_rescue' || fail "no-mutation stop does not close its unused rescue connection"
grep -Fq 'no live state changed on either host; rescue connection closed.' "$RUNNER" || fail "MacBook no-mutation preflight result is missing"
grep -Fq 'require_snapshot "$snapshot" any' "$RUNNER" || fail "full snapshot restore does not validate before moving the live path"
grep -Fq 'Office phase state is unavailable; keep rescue open for manual recovery' "$RUNNER" || fail "missing Office phase state is not fail-closed"

phase6_state_line="$(grep -n -F 'write_phase_state "$LOCAL_RECEIPT" 6 "MACBOOK_CONFIG_ACTIVATION_IN_PROGRESS"' "$RUNNER" | cut -d: -f1)"
phase6_mutation_line="$(grep -n -F 'write_mac_include_root git' "$RUNNER" | cut -d: -f1)"
[ -n "$phase6_state_line" ] && [ -n "$phase6_mutation_line" ] && [ "$phase6_state_line" -lt "$phase6_mutation_line" ] || fail "MacBook Phase 6 is not marked in progress before its first mutation"

preflight_run_id="20991231T235959Z-$$"
set +e
(
  set -- help
  source "$RUNNER"
  RUN_ID="$preflight_run_id"
  office_abort 1
) >"$FIXTURE/preflight-blocked.out" 2>&1
preflight_rc=$?
set -e
[ "$preflight_rc" -eq 20 ] || fail "receipt-free Office preflight failure returned $preflight_rc instead of 20"
grep -Fq 'Office Phase 0 made no changes; no receipt or rollback is required.' "$FIXTURE/preflight-blocked.out" || fail "receipt-free Office preflight failure was misreported"
[ ! -e "/Users/Office/.brain-host-activation/$preflight_run_id" ] || fail "preflight regression test unexpectedly created a receipt"
pass "Phase 0 blocks are not misreported as rollback failures; fixture coverage proves Phase 1–2 classification"

grep -Fq 'stable_copy_tree /Users/Office/.codex' "$RUNNER" || fail "Office Codex backup does not require a stable source snapshot"
grep -Fq 'stable_copy_tree /Users/Steve/.codex' "$RUNNER" || fail "MacBook Codex backup does not require a stable source snapshot"
grep -Fq 'stable_copy_path_snapshot "$live" "$root/backups/paths/$name"' "$RUNNER" || fail "Office narrow backups are not stable and verified"
grep -Fq 'stable_copy_path_snapshot "$live" "$root/backups/paths/$label"' "$RUNNER" || fail "MacBook narrow backups are not stable and verified"
grep -Fq "find . -type f -links +1" "$RUNNER" || fail "tree fidelity does not include hard-link topology"
grep -Fq "/bin/ls -lde" "$RUNNER" || fail "snapshot fidelity does not include ACLs"
grep -Fq 'source changed during snapshot attempt' "$RUNNER" || fail "unstable source snapshots are not diagnosed distinctly"
grep -Fq 'source changed during both snapshot attempts' "$RUNNER" || fail "repeated source instability is not fail-closed"
if grep -Fq 'stable_copy_tree "$OFFICE_BRAIN"' "$RUNNER"; then
  fail "old dirty canonical Brain is redundantly copied instead of atomically archived"
fi
grep -Fq 'mv "$OFFICE_BRAIN" "$archive"' "$RUNNER" || fail "old canonical Brain is not preserved by atomic archive rename"
grep -Fq "canonical Brain archive is not on the same filesystem" "$RUNNER" || fail "atomic Brain archive lacks a same-filesystem gate"
grep -Fq "staged canonical Brain is not on the same filesystem" "$RUNNER" || fail "atomic Brain placement lacks a same-filesystem gate"
grep -Fq "old canonical Brain archive identity changed during atomic rename" "$RUNNER" || fail "atomic Brain archive does not verify directory identity"
grep -Fq 'canonical-brain-placement-conflict' "$RUNNER" || fail "a path recreated during Brain placement would not be preserved"
grep -Fq 'destination.unstable-attempt' "$RUNNER" || fail "rejected unstable snapshots are not preserved"
grep -Fq 'dry-run cannot pass while affected processes or detached helpers remain' "$RUNNER" || fail "dry-run still exits successfully when quiescence is unproven"
grep -Fq 'This is not a future execution guarantee.' "$RUNNER" || fail "dry-run still overstates what a read-only inspection can prove"
pass "stable snapshots distinguish live writers from copy failures and retain every rejected attempt"

office_prepare_line="$(grep -n -F 'stream_office_worker office-prepare' "$RUNNER" | cut -d: -f1)"
mac_prepare_line="$(grep -n -F '  mac_snapshot_paths' "$RUNNER" | tail -1 | cut -d: -f1)"
activate_prompt_line="$(grep -n -F "printf 'Type ACTIVATE" "$RUNNER" | cut -d: -f1)"
office_commit_line="$(grep -n -F 'stream_office_worker office-commit' "$RUNNER" | cut -d: -f1)"
[ "$office_prepare_line" -lt "$mac_prepare_line" ] && \
  [ "$mac_prepare_line" -lt "$activate_prompt_line" ] && \
  [ "$activate_prompt_line" -lt "$office_commit_line" ] || fail "two-host preparation does not precede the explicit mutation boundary"
grep -Fq 'office-apply is disabled' "$RUNNER" || fail "legacy one-host mutation worker can bypass two-host preparation"
grep -Fq 'PREPARED_AND_ROLLBACK_READY' "$RUNNER" || fail "Office prepared state is not explicit"
if grep -Fq 'still has another interactive shell' "$RUNNER"; then
  fail "an idle or launcher shell is still treated as an application writer"
fi
grep -Fq 'validate_hostkey_alias_inputs macbook-m1' "$RUNNER" || fail "Office preflight does not validate HostKeyAlias inputs before mutation"
grep -Fq 'validate_hostkey_alias_inputs office-m4' "$RUNNER" || fail "MacBook preflight does not validate HostKeyAlias inputs before mutation"
grep -Fq 'validate_json_object_file "$CLAUDE_REGISTRY"' "$RUNNER" || fail "Office preflight does not parse the Claude registry before mutation"
if grep -Fq 'ChatGPT ChatGPTHelper' "$RUNNER" || grep -Fq 'for name in ChatGPTHelper' "$RUNNER"; then
  fail "unrelated persistent ChatGPT UI helper is still classified as a migration writer"
fi
for helper in SkyComputerUseService codex-code-mode-host node_repl bare-modifier-monitor; do
  grep -Fq "$helper" "$RUNNER" || fail "quiescence does not cover current helper process $helper"
done
grep -Fq 'kill -TERM "$pid"' "$RUNNER" || fail "detached helpers are not limited to graceful TERM"
grep -Fq 'no force signal was used' "$RUNNER" || fail "helper quiescence does not fail closed without force"
pass "both hosts become rollback-ready before the owner can authorize the first mutation"

grep -Fq 'office-codex-rollback-stage' "$RUNNER" || fail "Office Codex rollback tree is not prepared before mutation"
grep -Fq 'macbook-codex-rollback-stage' "$RUNNER" || fail "MacBook Codex rollback tree is not prepared before mutation"
grep -Fq 'activate_prepared_restore_tree' "$RUNNER" || fail "rollback does not use a preverified atomic restore tree"
! grep -A3 -F 'move_aside /Users/Office/.codex' "$RUNNER" | grep -Fq 'copy_tree' || fail "Office rollback can remove live Codex before rebuilding it"
! grep -A3 -F 'move_aside /Users/Steve/.codex' "$RUNNER" | grep -Fq 'copy_tree' || fail "MacBook rollback can remove live Codex before rebuilding it"
pass "Codex rollback replacements exist and verify before either live root is moved"

grep -Fq 'session/history continuity mismatch; do not reopen Codex' "$RUNNER" || fail "Codex continuity failure does not prohibit application reopen"
grep -Fq '/Users/Office/.codex "Office Codex"' "$RUNNER" || fail "Office preflight does not verify Codex SQLite readiness"
grep -Fq '/Users/Steve/.codex "MacBook Codex"' "$RUNNER" || fail "MacBook preflight does not verify Codex SQLite readiness"
! grep -Eq 'sqlite3[[:space:]]+-readonly' "$RUNNER" || fail "live-incompatible SQLite readonly mode remains in the activation runner"
grep -Fq 'private SQLite probe changed its source database family' "$RUNNER" || fail "WAL-mode SQLite source immutability regression coverage is missing"
grep -Fq 'indexed thread rollout files are present inside the protected runtime tree' "$RUNNER" || fail "Codex continuity does not bind indexed threads to protected rollout files"
grep -Fq 'session/auth/history continuity mismatch; do not reopen the application' "$RUNNER" || fail "non-Codex runtime continuity failure does not prohibit application reopen"
for application in claude cursor gemini kiro; do
  grep -Fq 'for name in claude cursor gemini kiro' "$RUNNER" || fail "$application runtime continuity loop is missing"
done
grep -Fq 'Codex conversation files and its logical thread index have already passed' "$RUNNER" || fail "manual acceptance is not gated on deterministic Codex continuity"
grep -Fq 'office-post-change-metadata' "$RUNNER" || fail "Office post-change metadata is not captured before application acceptance"
pass "all application-owned session/auth/history plus Codex logical thread state are checked before reopen"

printf 'host activation tests passed\n'
