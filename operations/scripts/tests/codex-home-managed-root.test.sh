#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MANAGER="$(cd -- "$SCRIPT_DIR/.." && pwd)/codex-home-managed-root.sh"
BRAIN_LINKER="$(cd -- "$SCRIPT_DIR/.." && pwd)/brain-configs-link.sh"
TEST_ROOT="$(mktemp -d /tmp/cx.XXXXXX)"

cleanup() {
  case "$TEST_ROOT" in
    /tmp/cx.*) rm -rf -- "$TEST_ROOT" ;;
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
  local configs_dir="${2:-$root/brain/operations/system-configs}"
  local brain_ai_dir="${3:-$root/brain/ai}"
  mkdir -p \
    "$root/brain" \
    "$configs_dir/codex/rules" \
    "$brain_ai_dir/skills/active"
  printf 'fixture agents\n' > "$configs_dir/codex/AGENTS.md"
  printf '[mcp_servers.node_repl.env]\nBROWSER_USE_AVAILABLE_BACKENDS = "chrome,iab"\nNODE_REPL_TRUSTED_CODE_PATHS = "/Users/Office/.codex:/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules"\n\n[shell_environment_policy.set]\nCODEX_HOME = "/Users/Office/.codex"\n\n[desktop]\nconversationDetailMode = "managed-default"\n\n[desktop.appearanceLightChromeTheme]\nfixtureAccent = "managed-default"\n' > "$configs_dir/codex/config.toml"
  printf 'fixture rtk\n' > "$configs_dir/codex/RTK.md"
  printf 'fixture rules\n' > "$configs_dir/codex/rules/default.rules"
  printf 'fixture skill\n' > "$brain_ai_dir/skills/active/example.md"
}

create_linker_fixture() {
  local root="$1"
  create_brain_fixture "$root"
  local configs="$root/brain/operations/system-configs"
  mkdir -p \
    "$configs/claude/hooks" \
    "$configs/claude/agents" \
    "$configs/claude/skills" \
    "$configs/cursor/skills" \
    "$configs/gemini" \
    "$configs/kiro/steering" \
    "$configs/shell" \
    "$configs/ghostty" \
    "$configs/starship" \
    "$configs/git" \
    "$configs/ssh"
  printf 'fixture claude\n' > "$configs/claude/CLAUDE.md"
  printf '{}\n' > "$configs/claude/settings.json"
  printf '#!/bin/sh\n' > "$configs/claude/statusline-command.sh"
  printf 'hook\n' > "$configs/claude/hooks/example"
  printf 'agent\n' > "$configs/claude/agents/example"
  printf 'skill\n' > "$configs/claude/skills/example"
  printf 'cursor skill\n' > "$configs/cursor/skills/example"
  printf 'fixture gemini\n' > "$configs/gemini/GEMINI.md"
  printf 'fixture kiro\n' > "$configs/kiro/steering/README.md"
  printf '# zshrc\n' > "$configs/shell/.zshrc"
  printf '# zprofile\n' > "$configs/shell/.zprofile"
  printf 'font-size = 12\n' > "$configs/ghostty/config"
  printf 'format = "$time"\n' > "$configs/starship/starship.toml"
  printf '[user]\n\tname = Fixture\n' > "$configs/git/gitconfig"
  printf 'Host office\n  HostName 100.86.124.66\n' > "$configs/ssh/config"
}

run_manager() {
  local root="$1"
  shift
  (
    unset CODEX_HOME
    HOME="$root/home" \
      BRAIN_REPO="$root/brain" \
      CONFIGS_DIR="${CONFIGS_DIR:-$root/brain/operations/system-configs}" \
      BRAIN_AI_DIR="${BRAIN_AI_DIR:-$root/brain/ai}" \
      CODEX_HOME_TEST_MODE=1 \
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

assert_generated_copy() {
  local file="$1"
  local source="$2"
  local expected_mode="${3:-600}"
  local expected_home="${file%/.codex/config.toml}"
  [ -f "$file" ] || fail "Expected generated file: $file"
  [ ! -L "$file" ] || fail "Generated file must not be a symlink: $file"
  cmp -s "$file" <(sed "s#/Users/Office#$expected_home#g" "$source") || fail "Generated file differs from rendered source: $file"
  local actual_mode
  actual_mode="$(stat -f '%Lp' "$file")"
  [ "$actual_mode" = "$expected_mode" ] || fail "Generated file mode $actual_mode, expected $expected_mode: $file"
}

assert_portable_generated_copy() {
  local file="$1"
  local expected_home="$2"
  [ -f "$file" ] || fail "Expected generated file: $file"
  [ ! -L "$file" ] || fail "Generated file must not be a symlink: $file"
  grep -Fq "$expected_home/.codex" "$file" || fail "Generated config did not render the target home: $file"
  if [ "$expected_home" != "/Users/Office" ]; then
    ! grep -Fq '/Users/Office' "$file" || fail "Generated config retained the Office home on another host: $file"
  fi
}

###############################################################################
# Legacy whole-directory symlink migration
###############################################################################

MIGRATION_ROOT="$TEST_ROOT/m"
MIGRATION_CONFIGS="$TEST_ROOT/c"
MIGRATION_AI="$TEST_ROOT/a"
create_brain_fixture "$MIGRATION_ROOT" "$MIGRATION_CONFIGS" "$MIGRATION_AI"
mkdir -p "$MIGRATION_ROOT/home"

LEGACY_CODEX="$MIGRATION_CONFIGS/codex"
LEGACY_ROLLOUT_RELATIVE="sessions/2026/07/22/rollout-2026-07-22T12-00-00-00000000-0000-4000-8000-000000000001.jsonl"
CURRENT_ROLLOUT_RELATIVE="sessions/2026/07/22/rollout-2026-07-22T12-00-01-00000000-0000-4000-8000-000000000002.jsonl"
mkdir -p \
  "$LEGACY_CODEX/sessions" \
  "$LEGACY_CODEX/sessions/2026/07/22" \
  "$LEGACY_CODEX/skills/.system" \
  "$LEGACY_CODEX/app-server-control" \
  "$LEGACY_CODEX/ipc" \
  "$LEGACY_CODEX/n/d"
LEGACY_CODEX_PHYSICAL="$(cd -P -- "$LEGACY_CODEX" && pwd)"
FINAL_CODEX_HOME_PHYSICAL="$(cd -P -- "$MIGRATION_ROOT/home" && pwd)/.codex"
printf 'session-data\n' > "$LEGACY_CODEX/sessions/thread.json"
printf 'legacy-rollout\n' > "$LEGACY_CODEX/$LEGACY_ROLLOUT_RELATIVE"
printf 'current-rollout\n' > "$LEGACY_CODEX/$CURRENT_ROLLOUT_RELATIVE"
printf '{}\n' > "$LEGACY_CODEX/auth.json"
printf 'system-skill\n' > "$LEGACY_CODEX/skills/.system/marker"
printf 'control-neighbor\n' > "$LEGACY_CODEX/app-server-control/state.json"
printf 'ipc-neighbor\n' > "$LEGACY_CODEX/ipc/state.json"
printf 'deep-neighbor\n' > "$LEGACY_CODEX/n/d/state.json"
mkdir -p "$MIGRATION_ROOT/external-private-tree"
printf 'must stay external\n' > "$MIGRATION_ROOT/external-private-tree/marker"
ln -s "$MIGRATION_ROOT/external-private-tree" "$LEGACY_CODEX/external-link"
FIXTURE_SOCKETS=(
  "$LEGACY_CODEX/app-server-control/app-server-control.sock"
  "$LEGACY_CODEX/ipc/ipc.sock"
  "$LEGACY_CODEX/n/d/s.sock"
)
for socket in "${FIXTURE_SOCKETS[@]}"; do
  socket_parent="$(cd -P -- "$(dirname -- "$socket")" && pwd)"
  physical_socket="$socket_parent/$(basename -- "$socket")"
  socket_bytes="$(LC_ALL=C printf '%s' "$physical_socket" | wc -c | tr -d ' ')"
  [ "$socket_bytes" -le 103 ] || {
    fail "test construction produced a ${socket_bytes}-byte socket path (maximum 103): $physical_socket"
  }
  ruby -rsocket -e 'server = UNIXServer.new(ARGV.fetch(0)); server.close' "$socket"
  pass "fixture socket path is ${socket_bytes} bytes: ${socket#"$LEGACY_CODEX/"}"
done
ln -s "$MIGRATION_AI/skills/active" "$LEGACY_CODEX/skills/user"
ln -s "$LEGACY_CODEX" "$MIGRATION_ROOT/home/.codex"
sqlite3 "$LEGACY_CODEX/state_5.sqlite" "
CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL);
INSERT INTO threads VALUES (
  '00000000-0000-4000-8000-000000000001',
  '$LEGACY_CODEX_PHYSICAL/$LEGACY_ROLLOUT_RELATIVE'
);
INSERT INTO threads VALUES (
  '00000000-0000-4000-8000-000000000002',
  '$FINAL_CODEX_HOME_PHYSICAL/$CURRENT_ROLLOUT_RELATIVE'
);
"

if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  run_manager "$MIGRATION_ROOT" check >/dev/null 2>&1; then
  fail "check unexpectedly accepted a whole-directory symlink"
fi
pass "check rejects the legacy whole-directory symlink"

if (
  unset CODEX_HOME
  HOME="$MIGRATION_ROOT/home" \
    BRAIN_REPO="$MIGRATION_ROOT/brain" \
    CONFIGS_DIR="$MIGRATION_CONFIGS" \
    BRAIN_AI_DIR="$MIGRATION_AI" \
    CODEX_HOME_SKIP_PROCESS_CHECK=1 \
    CONFIRM_CODEX_HOME_MIGRATION=1 \
    bash "$MANAGER" migrate >/dev/null 2>&1
); then
  fail "migration accepted the test-only process-check bypass outside test mode"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "process-check bypass refusal changed the legacy symlink"
pass "migration prevents the test-only process-check bypass in live use"

if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  CODEX_HOME_TEST_SOURCE_KB=100 \
  CODEX_HOME_TEST_AVAILABLE_KB=100 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly accepted insufficient free space"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "disk-space refusal changed the legacy symlink"
pass "migration refuses insufficient disk space without changing the source"

if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  CODEX_HOME_TEST_COPY_FAILURE=1 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly succeeded after a simulated copy failure"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "copy failure changed the legacy symlink"
pass "migration leaves the original symlink untouched when copying fails"

if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  CODEX_HOME_TEST_COPY_FAILURE_ENTRY=auth.json \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly succeeded after a simulated mid-copy failure"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "mid-copy failure changed the legacy symlink"
pass "migration propagates a mid-copy failure and leaves the original symlink untouched"

if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  CODEX_HOME_TEST_SWITCH_FAILURE=1 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null 2>&1; then
  fail "migration unexpectedly succeeded after a simulated switch failure"
fi
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "switch failure did not restore the legacy symlink"
pass "migration restores the original symlink when the atomic switch fails"

CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  DRY_RUN=1 \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null
[ -L "$MIGRATION_ROOT/home/.codex" ] || fail "dry-run changed the legacy symlink"
pass "dry-run leaves the legacy Codex home unchanged"

CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  CONFIRM_CODEX_HOME_MIGRATION=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  run_manager "$MIGRATION_ROOT" migrate >/dev/null

[ -d "$MIGRATION_ROOT/home/.codex" ] || fail "migration did not create a Codex home"
[ ! -L "$MIGRATION_ROOT/home/.codex" ] || fail "migrated Codex home is still a symlink"
[ -f "$MIGRATION_ROOT/home/.codex/sessions/thread.json" ] || fail "session data was not preserved"
[ -f "$MIGRATION_ROOT/home/.codex/auth.json" ] || fail "authentication file was not preserved"
[ -f "$MIGRATION_ROOT/home/.codex/skills/.system/marker" ] || fail "system skills were not preserved"
[ "$(sqlite3 "$MIGRATION_ROOT/home/.codex/state_5.sqlite" \
  "SELECT COUNT(*) FROM threads WHERE rollout_path LIKE '$LEGACY_CODEX_PHYSICAL/%';")" -eq 0 ] || {
  fail "migration left legacy repository rollout paths in the state database"
}
[ "$(sqlite3 "$MIGRATION_ROOT/home/.codex/state_5.sqlite" \
  "SELECT COUNT(*) FROM threads WHERE rollout_path LIKE '$FINAL_CODEX_HOME_PHYSICAL/%';")" -eq 2 ] || {
  fail "migration did not preserve and normalize both rollout paths"
}
[ "$(sqlite3 "$LEGACY_CODEX/state_5.sqlite" \
  "SELECT COUNT(*) FROM threads WHERE rollout_path LIKE '$LEGACY_CODEX_PHYSICAL/%';")" -eq 1 ] || {
  fail "migration modified the source state database"
}
[ -L "$MIGRATION_ROOT/home/.codex/external-link" ] || fail "a top-level symlink was dereferenced during migration"
[ "$(readlink "$MIGRATION_ROOT/home/.codex/external-link")" = "$MIGRATION_ROOT/external-private-tree" ] || {
  fail "a top-level symlink changed target during migration"
}
for socket in \
  app-server-control/app-server-control.sock \
  ipc/ipc.sock \
  n/d/s.sock; do
  [ ! -e "$MIGRATION_ROOT/home/.codex/$socket" ] || {
    fail "socket was copied into the migrated root: $socket"
  }
  [ -S "$LEGACY_CODEX/$socket" ] || {
    fail "migration modified or removed the source socket: $socket"
  }
done
for neighbor in \
  app-server-control/state.json \
  ipc/state.json \
  n/d/state.json; do
  [ -f "$MIGRATION_ROOT/home/.codex/$neighbor" ] || {
    fail "ordinary file beside a socket was not preserved: $neighbor"
  }
done
assert_generated_copy \
  "$MIGRATION_ROOT/home/.codex/config.toml" \
  "$MIGRATION_CONFIGS/codex/config.toml" \
  "600"
assert_managed_link \
  "$MIGRATION_ROOT/home/.codex/skills/user" \
  "$MIGRATION_AI/skills/active"

ORIGINAL_BACKUP_COUNT="$(find "$MIGRATION_ROOT/home/.brain-configs-backups" -type l -name original-codex-home | wc -l | tr -d ' ')"
[ "$ORIGINAL_BACKUP_COUNT" -eq 1 ] || fail "expected one preserved original Codex home link"
ORIGINAL_BACKUP="$(find "$MIGRATION_ROOT/home/.brain-configs-backups" -type l -name original-codex-home -print -quit)"
[ -f "$(dirname -- "$ORIGINAL_BACKUP")/state_5.sqlite-before-path-rewrite" ] || {
  fail "migration did not preserve the staged state database before path repair"
}
CONFIGS_DIR="$MIGRATION_CONFIGS" BRAIN_AI_DIR="$MIGRATION_AI" run_manager "$MIGRATION_ROOT" check >/dev/null
CONFIGS_DIR="$MIGRATION_CONFIGS" BRAIN_AI_DIR="$MIGRATION_AI" run_manager "$MIGRATION_ROOT" repair >/dev/null
CONFIGS_DIR="$MIGRATION_CONFIGS" BRAIN_AI_DIR="$MIGRATION_AI" run_manager "$MIGRATION_ROOT" repair >/dev/null
pass "migration preserves runtime state, installs links, validates, and remains idempotent"

MIGRATED_STATE_DB="$MIGRATION_ROOT/home/.codex/state_5.sqlite"
sqlite3 "$MIGRATED_STATE_DB" 'PRAGMA journal_mode=WAL; PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null
[ ! -e "$MIGRATED_STATE_DB-wal" ] || unlink "$MIGRATED_STATE_DB-wal"
[ ! -e "$MIGRATED_STATE_DB-shm" ] || unlink "$MIGRATED_STATE_DB-shm"
if sqlite3 -readonly "$MIGRATED_STATE_DB" 'PRAGMA integrity_check;' >/dev/null 2>&1; then
  fail "WAL fixture did not reproduce the direct read-only SQLITE_CANTOPEN state"
fi
CONFIGS_DIR="$MIGRATION_CONFIGS" BRAIN_AI_DIR="$MIGRATION_AI" run_manager "$MIGRATION_ROOT" check >/dev/null
[ ! -e "$MIGRATED_STATE_DB-wal" ] || fail "managed-root check created a WAL file beside the live fixture database"
[ ! -e "$MIGRATED_STATE_DB-shm" ] || fail "managed-root check created shared memory beside the live fixture database"
pass "check validates a sidecar-free WAL database through an exact private snapshot"

sqlite3 "$MIGRATION_ROOT/home/.codex/state_5.sqlite" "
UPDATE threads
SET rollout_path = '$LEGACY_CODEX_PHYSICAL/$LEGACY_ROLLOUT_RELATIVE'
WHERE id = '00000000-0000-4000-8000-000000000001';
"
if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  run_manager "$MIGRATION_ROOT" check >/dev/null 2>&1; then
  fail "check accepted a state database with a legacy repository rollout path"
fi
CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  run_manager "$MIGRATION_ROOT" repair >/dev/null
[ "$(sqlite3 "$MIGRATION_ROOT/home/.codex/state_5.sqlite" \
  "SELECT COUNT(*) FROM threads WHERE rollout_path LIKE '$LEGACY_CODEX_PHYSICAL/%';")" -eq 0 ] || {
  fail "repair left a legacy repository rollout path in the state database"
}
CONFIGS_DIR="$MIGRATION_CONFIGS" BRAIN_AI_DIR="$MIGRATION_AI" run_manager "$MIGRATION_ROOT" check >/dev/null
pass "check rejects and repair normalizes legacy repository rollout paths in the state database"

MIGRATED_CONTROL_SOCKET="$MIGRATION_ROOT/home/.codex/app-server-control/app-server-control.sock"
mkdir -p "$(dirname -- "$MIGRATED_CONTROL_SOCKET")"
ruby -rsocket -e 'server = UNIXServer.new(ARGV.fetch(0)); server.close' "$MIGRATED_CONTROL_SOCKET"
if CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  run_manager "$MIGRATION_ROOT" check >/dev/null 2>&1; then
  fail "check accepted an unowned control socket"
fi
CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
  run_manager "$MIGRATION_ROOT" repair >/dev/null
[ ! -e "$MIGRATED_CONTROL_SOCKET" ] || fail "repair left the stale control socket in place"
CONFIGS_DIR="$MIGRATION_CONFIGS" BRAIN_AI_DIR="$MIGRATION_AI" run_manager "$MIGRATION_ROOT" check >/dev/null
pass "check rejects and repair removes an unowned control socket"

CONFIGS_DIR="$MIGRATION_CONFIGS" \
  BRAIN_AI_DIR="$MIGRATION_AI" \
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
assert_generated_copy \
  "$REPAIR_ROOT/home/.codex/config.toml" \
  "$REPAIR_ROOT/brain/operations/system-configs/codex/config.toml" \
  "600"
grep -Fq 'BROWSER_USE_AVAILABLE_BACKENDS = "chrome,iab"' \
  "$REPAIR_ROOT/home/.codex/config.toml" || fail "generated config dropped the supported browser backend setting"
grep -Fq "NODE_REPL_TRUSTED_CODE_PATHS = \"$REPAIR_ROOT/home/.codex:/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules\"" \
  "$REPAIR_ROOT/home/.codex/config.toml" || fail "generated config dropped the supported trusted code path setting"
assert_portable_generated_copy \
  "$REPAIR_ROOT/home/.codex/config.toml" \
  "$REPAIR_ROOT/home"
pass "generated Codex config renders absolute home paths for the target host"

printf '\n[app_upgrade_state]\nversion = "fixture-upgrade"\n' >> "$REPAIR_ROOT/home/.codex/config.toml"
printf '\n[marketplaces.fixture-runtime]\nsource_type = "local"\nsource = "%s"\n' "$REPAIR_ROOT/home/.codex/.tmp/fixture-marketplace" >> "$REPAIR_ROOT/home/.codex/config.toml"
sed -i '' 's/conversationDetailMode = "managed-default"/conversationDetailMode = "app-local"/' "$REPAIR_ROOT/home/.codex/config.toml"
sed -i '' 's/fixtureAccent = "managed-default"/fixtureAccent = "app-local-nested"/' "$REPAIR_ROOT/home/.codex/config.toml"
run_manager "$REPAIR_ROOT" check >/dev/null
grep -Fq 'fixture-upgrade' "$REPAIR_ROOT/home/.codex/config.toml" || fail "check removed app-derived upgrade state"
pass "check accepts app-derived additions and desktop overrides while enforcing the managed subset"

sed -i '' "s#$REPAIR_ROOT/home/.codex#$REPAIR_ROOT/wrong-codex#" "$REPAIR_ROOT/home/.codex/config.toml"
if run_manager "$REPAIR_ROOT" check >/dev/null 2>&1; then
  fail "check accepted a changed Brain-owned generated config value"
fi
run_manager "$REPAIR_ROOT" repair >/dev/null
run_manager "$REPAIR_ROOT" check >/dev/null
[ "$(stat -f '%Lp' "$REPAIR_ROOT/home/.codex/config.toml")" = "600" ] || fail "repaired generated config lost mode 0600"
assert_portable_generated_copy "$REPAIR_ROOT/home/.codex/config.toml" "$REPAIR_ROOT/home"
grep -Fq 'BROWSER_USE_AVAILABLE_BACKENDS = "chrome,iab"' \
  "$REPAIR_ROOT/home/.codex/config.toml" || fail "repair dropped the supported browser backend setting"
grep -Fq "NODE_REPL_TRUSTED_CODE_PATHS = \"$REPAIR_ROOT/home/.codex:/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules\"" \
  "$REPAIR_ROOT/home/.codex/config.toml" || fail "repair dropped the supported trusted code path setting"
grep -Fq '[marketplaces.fixture-runtime]' "$REPAIR_ROOT/home/.codex/config.toml" || fail "repair dropped approved app-local marketplace registration"
grep -Fq 'conversationDetailMode = "app-local"' "$REPAIR_ROOT/home/.codex/config.toml" || fail "repair dropped an app-local desktop override"
grep -Fq 'fixtureAccent = "app-local-nested"' "$REPAIR_ROOT/home/.codex/config.toml" || fail "repair dropped a nested app-local desktop override"
UPGRADE_BACKUP_COUNT="$(find "$REPAIR_ROOT/home/.brain-configs-backups" -type f -path '*/replaced-managed-entries/config.toml' | wc -l | tr -d ' ')"
[ "$UPGRADE_BACKUP_COUNT" -ge 1 ] || fail "repair did not preserve the complete prior generated config"
pass "repair rejects changed managed values and preserves prior config plus app-local desktop and marketplace state"

PRESERVED_FILE_COUNT="$(find "$REPAIR_ROOT/home/.brain-configs-backups" -type f -path '*/replaced-managed-entries/AGENTS.md' | wc -l | tr -d ' ')"
[ "$PRESERVED_FILE_COUNT" -eq 1 ] || fail "conflicting managed file was not preserved"
pass "repair creates a fresh managed root and preserves conflicting files"

printf 'temporary conflicting config\n' > "$REPAIR_ROOT/home/.codex/config.toml"
chmod 600 "$REPAIR_ROOT/home/.codex/config.toml"
if CODEX_HOME_TEST_FORCE_PROCESS_RUNNING=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=0 \
  run_manager "$REPAIR_ROOT" repair >/dev/null 2>&1; then
  fail "repair unexpectedly changed an invalid layout while Codex was running"
fi
[ ! -L "$REPAIR_ROOT/home/.codex/config.toml" ] || fail "blocked repair changed the conflicting config into a symlink"
grep -q 'temporary conflicting config' "$REPAIR_ROOT/home/.codex/config.toml" || fail "blocked repair rewrote the conflicting config"
pass "repair refuses changes while a protected Codex process is running"

sed "s#/Users/Office#$REPAIR_ROOT/home#g" \
  "$REPAIR_ROOT/brain/operations/system-configs/codex/config.toml" \
  > "$REPAIR_ROOT/home/.codex/config.toml"
chmod 600 "$REPAIR_ROOT/home/.codex/config.toml"
CODEX_HOME_TEST_FORCE_PROCESS_RUNNING=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=0 \
  run_manager "$REPAIR_ROOT" repair >/dev/null
assert_generated_copy \
  "$REPAIR_ROOT/home/.codex/config.toml" \
  "$REPAIR_ROOT/brain/operations/system-configs/codex/config.toml" \
  "600"
pass "repair is a no-op when the managed generated-copy layout already passes"

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
create_linker_fixture "$LINKER_ROOT"
mkdir -p "$LINKER_ROOT/home"
HOME="$LINKER_ROOT/home" \
  BRAIN_REPO="$LINKER_ROOT/brain" \
  CODEX_HOME="$LINKER_ROOT/ambient-wrong-codex-home" \
  CODEX_HOME_TEST_MODE=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  bash "$BRAIN_LINKER" >/dev/null 2>&1
for runtime_root in .claude .cursor .gemini .kiro .codex; do
  [ -d "$LINKER_ROOT/home/$runtime_root" ] && [ ! -L "$LINKER_ROOT/home/$runtime_root" ] || {
    fail "general Brain linker did not create physical runtime root: $runtime_root"
  }
done
assert_managed_link \
  "$LINKER_ROOT/home/.claude/settings.json" \
  "$LINKER_ROOT/brain/operations/system-configs/claude/settings.json"
assert_managed_link \
  "$LINKER_ROOT/home/.gemini/GEMINI.md" \
  "$LINKER_ROOT/brain/operations/system-configs/gemini/GEMINI.md"
assert_generated_copy \
  "$LINKER_ROOT/home/.codex/config.toml" \
  "$LINKER_ROOT/brain/operations/system-configs/codex/config.toml" \
  "600"
[ -f "$LINKER_ROOT/home/.gitconfig" ] && [ ! -L "$LINKER_ROOT/home/.gitconfig" ] || fail "Git include root is not physical"
grep -q "$LINKER_ROOT/brain/operations/system-configs/git/gitconfig" "$LINKER_ROOT/home/.gitconfig" || fail "Git include root does not reference Brain config"
[ -f "$LINKER_ROOT/home/.ssh/config" ] && [ ! -L "$LINKER_ROOT/home/.ssh/config" ] || fail "SSH include root is not physical"
grep -q "$LINKER_ROOT/brain/operations/system-configs/ssh/config" "$LINKER_ROOT/home/.ssh/config" || fail "SSH include root does not reference Brain config"
[ ! -e "$LINKER_ROOT/ambient-wrong-codex-home" ] || {
  fail "general Brain linker leaked an ambient CODEX_HOME override into its helper"
}
run_manager "$LINKER_ROOT" check >/dev/null
pass "general Brain linker delegates with its resolved paths and ignores unrelated ambient overrides"

LEGACY_LINKER_ROOT="$TEST_ROOT/legacy-linker"
create_linker_fixture "$LEGACY_LINKER_ROOT"
mkdir -p "$LEGACY_LINKER_ROOT/home"
ln -s \
  "$LEGACY_LINKER_ROOT/brain/operations/system-configs/codex" \
  "$LEGACY_LINKER_ROOT/home/.codex"
if HOME="$LEGACY_LINKER_ROOT/home" \
  BRAIN_REPO="$LEGACY_LINKER_ROOT/brain" \
  CODEX_HOME_TEST_MODE=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  bash "$BRAIN_LINKER" >/dev/null 2>&1; then
  fail "general Brain linker reported success for an unresolved legacy Codex symlink"
fi
[ -L "$LEGACY_LINKER_ROOT/home/.codex" ] || {
  fail "general Brain linker silently migrated the legacy Codex symlink"
}
pass "general Brain linker leaves legacy Codex homes untouched and reports the unresolved requirement"

PHYSICAL_CONFIG_ROOT="$TEST_ROOT/physical-config-linker"
create_linker_fixture "$PHYSICAL_CONFIG_ROOT"
mkdir -p "$PHYSICAL_CONFIG_ROOT/home/.ssh"
printf 'user-owned git config\n' > "$PHYSICAL_CONFIG_ROOT/home/.gitconfig"
printf 'user-owned ssh config\n' > "$PHYSICAL_CONFIG_ROOT/home/.ssh/config"
if HOME="$PHYSICAL_CONFIG_ROOT/home" \
  BRAIN_REPO="$PHYSICAL_CONFIG_ROOT/brain" \
  CODEX_HOME_TEST_MODE=1 \
  CODEX_HOME_SKIP_PROCESS_CHECK=1 \
  bash "$BRAIN_LINKER" >/dev/null 2>&1; then
  fail "general Brain linker overwrote arbitrary physical Git/SSH config instead of requiring migration"
fi
grep -Fxq 'user-owned git config' "$PHYSICAL_CONFIG_ROOT/home/.gitconfig" || fail "physical Git config changed despite fail-closed preflight"
grep -Fxq 'user-owned ssh config' "$PHYSICAL_CONFIG_ROOT/home/.ssh/config" || fail "physical SSH config changed despite fail-closed preflight"
[ ! -e "$PHYSICAL_CONFIG_ROOT/home/.claude" ] || fail "linker mutated runtime roots after physical include preflight failure"
pass "general Brain linker preserves arbitrary physical Git/SSH configs and requires controlled INCLUDE migration"

printf 'All Codex managed runtime root tests passed.\n'
