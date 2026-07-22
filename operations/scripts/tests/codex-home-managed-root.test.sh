#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MANAGER="$(cd -- "$SCRIPT_DIR/.." && pwd)/codex-home-managed-root.sh"
BRAIN_LINKER="$(cd -- "$SCRIPT_DIR/.." && pwd)/brain-configs-link.sh"
TEST_ROOT="$(mktemp -d /tmp/chmr.XXXXXX)"

cleanup() {
  case "$TEST_ROOT" in
    /tmp/chmr.*) rm -rf -- "$TEST_ROOT" ;;
    *) printf '[ERROR] Refusing unsafe test cleanup: %s\n' "$TEST_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

fail() {
  printf '[FAIL] %s\n' "$*" >&2
  exit 1
}

pass() {
  printf '[PASS] %s\n' "$*"
}

create_brain_fixture() {
  local root="$1"
  mkdir -p \
    "$root/brain/operations/system-configs/codex/rules" \
    "$root/brain/ai/skills/active"
  printf 'fixture agents\n' > "$root/brain/operations/system-configs/codex/AGENTS.md"
  printf 'fixture config\n' > "$root/brain/operations/system-configs/codex/config.toml"
  printf 'fixture rtk\n' > "$root/brain/operations/system-configs/codex/RTK.md"
  printf 'fixture rules\n' > "$root/brain/operations/system-configs/codex/rules/default.rules"
  printf 'fixture skill\n' > "$root/brain/ai/skills/active/example.md"
}

run_manager() {
  local root="$1"
  shift
  (
    unset CODEX_HOME
    HOME="$root/home" \
      BRAIN_REPO="$root/brain" \
      CODEX_HOME_SKIP_PROCESS_CHECK="${CODEX_HOME_SKIP_PROCESS_CHECK:-1}" \
      bash "$MANAGER" "$@"
  )
}

assert_managed_link() {
  local link="$1"
  local expected="$2"
  [ -L "$link" ] || fail "Expected symlink: $link"
  [ "$(readlink "$link")" = "$expected" ] || {
    fail "$link points to $(readlink "$link"), expected $expected"
  }
}

###############################################################################
# Legacy whole-directory symlink migration
###############################################################################

MIGRATION_ROOT="$TEST_ROOT/migration"
create_brain_fixture "$MIGRATION_ROOT"
mkdir -p "$MIGRATION_ROOT/home"

LEGACY_CODEX="$MIGRATION_ROOT/brain/operations/system-configs/codex"
mkdir -p \
  "$LEGACY_CODEX/sessions" \
  "$LEGACY_CODEX/skills/.system" \
  "$LEGACY_CODEX/app-server-control"
printf 'session-data\n' > "$LEGACY_CODEX/sessions/thread.json"
printf '{}\n' > "$LEGACY_CODEX/auth.json"
printf 'system-skill\n' > "$LEGACY_CODEX/skills/.system/marker"
mkdir -p "$MIGRATION_ROOT/external-private-tree"
printf 'must stay external\n' > "$MIGRATION_ROOT/external-private-tree/marker"
ln -s "$MIGRATION_ROOT/external-private-tree" "$LEGACY_CODEX/external-link"
SHORT_SOCKET="$TEST_ROOT.sock"
ruby -rsocket -e 'server = UNIXServer.new(ARGV.fetch(0)); server.close' "$SHORT_SOCKET"
mv "$SHORT_SOCKET" "$LEGACY_CODEX/app-server-control/app-server-control.sock"
ln -s "$MIGRATION_ROOT/brain/ai/skills/active" "$LEGACY_CODEX/skills/user"
ln -s "$LEGACY_CODEX" "$MIGRATION_ROOT/home/.codex"

if run_manager "$MIGRATION_ROOT" check >/dev/null 2>&1; then
  fail "check unexpectedly accepted a whole-directory symlink"
fi
pass "check rejects the legacy whole-directory symlink"

if CODEX_HOME_TEST_SOURCE_KB=100 \
  CODEX_HOME_TEST_AVAILABLE_KB=100 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly accepted insufficient free space"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "disk-space refusal changed the legacy symlink"
pass "migration refuses insufficient disk space without changing the source"

if CODEX_HOME_TEST_COPY_FAILURE=1 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly succeeded after a simulated copy failure"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "copy failure changed the legacy symlink"
pass "migration leaves the original symlink untouched when copying fails"

if CODEX_HOME_TEST_COPY_FAILURE_ENTRY=auth.json \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly succeeded after a simulated mid-copy failure"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "mid-copy failure changed the legacy symlink"
pass "migration propagates a mid-copy failure and leaves the original symlink untouched"

if CODEX_HOME_TEST_SWITCH_FAILURE=1 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly succeeded after a simulated switch failure"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "switch failure did not restore the legacy symlink"
pass "migration restores the original symlink when the atomic switch fails"

DRY_RUN=1 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "dry-run changed the legacy symlink"
pass "dry-run leaves the legacy Codex home unchanged"

CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null

[ -d "$MIGRATION_ROOT/home/.codex" ] || fail "migration did not create a Codex home"
[ ! -L "$MIGRATION_ROOT/home/.codex" ] || fail "migrated Codex home is still a symlink"
[ -f "$MIGRATION_ROOT/home/.codex/sessions/thread.json" ] || fail "session data was not preserved"
[ -f "$MIGRATION_ROOT/home/.codex/auth.json" ] || fail "authentication file was not preserved"
[ -f "$MIGRATION_ROOT/home/.codex/skills/.system/marker" ] || fail "system skills were not preserved"
[ -L "$MIGRATION_ROOT/home/.codex/external-link" ] || fail "a top-level symlink was dereferenced during migration"
[ "$(readlink "$MIGRATION_ROOT/home/.codex/external-link")" = "$MIGRATION_ROOT/external-private-tree" ] || {
  fail "a top-level symlink changed target during migration"
}
[ ! -S "$MIGRATION_ROOT/home/.codex/app-server-control/app-server-control.sock" ] || {
  fail "stale app-server socket was copied into the migrated root"
}
assert_managed_link \
  "$MIGRATION_ROOT/home/.codex/config.toml" \
  "$MIGRATION_ROOT/brain/operations/system-configs/codex/config.toml"
assert_managed_link \
  "$MIGRATION_ROOT/home/.codex/skills/user" \
  "$MIGRATION_ROOT/brain/ai/skills/active"

ORIGINAL_BACKUP_COUNT="$(find "$MIGRATION_ROOT/home/.brain-configs-backups" -type l -name original-codex-home | wc -l | tr -d ' ')"
[ "$ORIGINAL_BACKUP_COUNT" -eq 1 ] || fail "expected one preserved original Codex home link"
ORIGINAL_BACKUP="$(find "$MIGRATION_ROOT/home/.brain-configs-backups" -type l -name original-codex-home -print -quit)"
run_manager "$MIGRATION_ROOT" check >/dev/null
run_manager "$MIGRATION_ROOT" repair >/dev/null
run_manager "$MIGRATION_ROOT" repair >/dev/null
pass "migration preserves runtime state, installs links, validates, and remains idempotent"

CONFIRM_CODEX_HOME_ROLLBACK=1 \
  CODEX_HOME_ROLLBACK_BACKUP="$ORIGINAL_BACKUP" \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" rollback >/dev/null
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "rollback did not restore the original symlink"
FAILED_ROOT_COUNT="$(find "$(dirname "$ORIGINAL_BACKUP")" -maxdepth 1 -type d -name 'failed-codex-home-*' | wc -l | tr -d ' ')"
[ "$FAILED_ROOT_COUNT" -eq 1 ] || fail "rollback did not preserve the migrated directory"
pass "rollback restores the original symlink and preserves the migrated directory"

###############################################################################
# Refusal when the legacy symlink is not the canonical Brain directory
###############################################################################

REFUSAL_ROOT="$TEST_ROOT/refusal"
create_brain_fixture "$REFUSAL_ROOT"
mkdir -p "$REFUSAL_ROOT/home" "$REFUSAL_ROOT/unexpected-codex"
ln -s "$REFUSAL_ROOT/unexpected-codex" "$REFUSAL_ROOT/home/.codex"

if CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$REFUSAL_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly accepted an unknown symlink target"
fi
[ -L "$REFUSAL_ROOT/home/.codex" ] || fail "refusal changed the unknown symlink"
pass "migration refuses an unexpected source without changing it"

###############################################################################
# Fresh install and preservation of conflicting managed files
###############################################################################

REPAIR_ROOT="$TEST_ROOT/repair"
create_brain_fixture "$REPAIR_ROOT"
mkdir -p "$REPAIR_ROOT/home/.codex"
printf 'local custom agents\n' > "$REPAIR_ROOT/home/.codex/AGENTS.md"

run_manager "$REPAIR_ROOT" repair >/dev/null
run_manager "$REPAIR_ROOT" check >/dev/null
assert_managed_link \
  "$REPAIR_ROOT/home/.codex/AGENTS.md" \
  "$REPAIR_ROOT/brain/operations/system-configs/codex/AGENTS.md"

PRESERVED_FILE_COUNT="$(find "$REPAIR_ROOT/home/.brain-configs-backups" -type f -path '*/replaced-managed-entries/AGENTS.md' | wc -l | tr -d ' ')"
[ "$PRESERVED_FILE_COUNT" -eq 1 ] || fail "conflicting managed file was not preserved"
pass "repair creates a fresh managed root and preserves conflicting files"

unlink "$REPAIR_ROOT/home/.codex/config.toml"
printf 'temporary conflicting config\n' > "$REPAIR_ROOT/home/.codex/config.toml"
if CODEX_HOME_TEST_FORCE_PROCESS_RUNNING=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=0 \
  run_manager "$REPAIR_ROOT" repair >/dev/null 2>&1; then
  fail "repair unexpectedly changed an invalid layout while Codex was running"
fi
[ ! -L "$REPAIR_ROOT/home/.codex/config.toml" ] || fail "blocked repair changed the conflicting config"
pass "repair refuses changes while a protected Codex process is running"

mv "$REPAIR_ROOT/home/.codex/config.toml" "$REPAIR_ROOT/home/.codex/config.toml.conflict"
ln -s \
  "$REPAIR_ROOT/brain/operations/system-configs/codex/config.toml" \
  "$REPAIR_ROOT/home/.codex/config.toml"
CODEX_HOME_TEST_FORCE_PROCESS_RUNNING=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=0 \
  run_manager "$REPAIR_ROOT" repair >/dev/null
pass "repair is a no-op when the managed layout already passes"

###############################################################################
# Existing nested directory symlinks are materialized without losing contents
###############################################################################

NESTED_ROOT="$TEST_ROOT/nested"
create_brain_fixture "$NESTED_ROOT"
mkdir -p \
  "$NESTED_ROOT/home/.codex" \
  "$NESTED_ROOT/external-rules" \
  "$NESTED_ROOT/external-skills/.system"
printf 'custom rule\n' > "$NESTED_ROOT/external-rules/extra.rules"
printf 'system skill\n' > "$NESTED_ROOT/external-skills/.system/marker"
ln -s "$NESTED_ROOT/external-rules" "$NESTED_ROOT/home/.codex/rules"
ln -s "$NESTED_ROOT/external-skills" "$NESTED_ROOT/home/.codex/skills"

run_manager "$NESTED_ROOT" repair >/dev/null
[ -d "$NESTED_ROOT/home/.codex/rules" ] && [ ! -L "$NESTED_ROOT/home/.codex/rules" ] || {
  fail "repair did not materialize the rules directory"
}
[ -d "$NESTED_ROOT/home/.codex/skills" ] && [ ! -L "$NESTED_ROOT/home/.codex/skills" ] || {
  fail "repair did not materialize the skills directory"
}
[ -f "$NESTED_ROOT/home/.codex/rules/extra.rules" ] || fail "repair lost an existing custom rule"
[ -f "$NESTED_ROOT/home/.codex/skills/.system/marker" ] || fail "repair lost an existing system skill"
run_manager "$NESTED_ROOT" check >/dev/null
pass "repair materializes nested directory symlinks without losing their contents"

###############################################################################
# Socket validation uses the physical path, not a deceptively short symlink
###############################################################################

LONG_SEGMENT="this-is-an-intentionally-long-physical-home-parent-used-to-test-the-macos-unix-socket-limit-0123456789"
PHYSICAL_ROOT="$TEST_ROOT/$LONG_SEGMENT"
SHORT_ROOT="$TEST_ROOT/short-root"
create_brain_fixture "$PHYSICAL_ROOT"
mkdir -p "$PHYSICAL_ROOT/home"
ln -s "$PHYSICAL_ROOT" "$SHORT_ROOT"

if run_manager "$SHORT_ROOT" repair >/dev/null 2>&1; then
  fail "repair unexpectedly accepted a physical socket path beyond the macOS limit"
fi
[ -d "$PHYSICAL_ROOT/home/.codex" ] && [ ! -L "$PHYSICAL_ROOT/home/.codex" ] || {
  fail "physical-path validation test did not create the expected real Codex home"
}
if run_manager "$SHORT_ROOT" check >/dev/null 2>&1; then
  fail "check measured the short lexical path instead of the long physical path"
fi
pass "socket validation measures the physical Codex home path"

###############################################################################
# General Brain linker integration
###############################################################################

LINKER_ROOT="$TEST_ROOT/linker"
create_brain_fixture "$LINKER_ROOT"
mkdir -p "$LINKER_ROOT/home"
HOME="$LINKER_ROOT/home" \
  BRAIN_REPO="$LINKER_ROOT/brain" \
  CODEX_HOME="$LINKER_ROOT/ambient-wrong-codex-home" \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  bash "$BRAIN_LINKER" >/dev/null 2>&1
[ -d "$LINKER_ROOT/home/.codex" ] && [ ! -L "$LINKER_ROOT/home/.codex" ] || {
  fail "general Brain linker did not create a real Codex runtime root"
}
[ ! -e "$LINKER_ROOT/ambient-wrong-codex-home" ] || {
  fail "general Brain linker leaked an ambient CODEX_HOME override into its helper"
}
run_manager "$LINKER_ROOT" check >/dev/null
pass "general Brain linker delegates with its resolved paths and ignores unrelated ambient overrides"

LEGACY_LINKER_ROOT="$TEST_ROOT/legacy-linker"
create_brain_fixture "$LEGACY_LINKER_ROOT"
mkdir -p "$LEGACY_LINKER_ROOT/home"
ln -s \
  "$LEGACY_LINKER_ROOT/brain/operations/system-configs/codex" \
  "$LEGACY_LINKER_ROOT/home/.codex"
if HOME="$LEGACY_LINKER_ROOT/home" \
  BRAIN_REPO="$LEGACY_LINKER_ROOT/brain" \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  bash "$BRAIN_LINKER" >/dev/null 2>&1; then
  fail "general Brain linker reported success for an unresolved legacy Codex symlink"
fi
[ -L "$LEGACY_LINKER_ROOT/home/.codex" ] || {
  fail "general Brain linker silently migrated the legacy Codex symlink"
}
pass "general Brain linker leaves legacy Codex homes untouched and reports the unresolved requirement"

printf 'All Codex managed runtime root tests passed.\n'
