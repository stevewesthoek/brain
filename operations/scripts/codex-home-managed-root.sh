#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Codex managed runtime root
#
# Codex creates Unix sockets below $CODEX_HOME. On macOS, a whole-directory
# symlink from ~/.codex to Brain resolves to a path that can exceed SUN_LEN.
# Keep ~/.codex as a short, real directory and link only portable config files.
#
# Commands:
#   check    Read-only validation.
#   repair   Create/repair the managed links inside a real ~/.codex directory.
#   migrate  Copy a legacy whole-directory symlink into a real ~/.codex and
#            atomically switch it. Requires CONFIRM_CODEX_HOME_MIGRATION=1.
#   rollback Restore a preserved legacy symlink without deleting the migrated
#            directory. Requires CODEX_HOME_ROLLBACK_BACKUP and confirmation.
#
# Environment overrides (primarily for tests):
#   HOME, BRAIN_REPO, DRY_RUN=1
#   CODEX_HOME_TEST_MODE=1 with CODEX_HOME_SKIP_PROCESS_CHECK=1
###############################################################################

COMMAND="${1:-check}"
HOME_DIR="${HOME:?HOME must be set}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT_FROM_SCRIPT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
BRAIN_REPO="${BRAIN_REPO:-$REPO_ROOT_FROM_SCRIPT}"
CONFIGS_DIR="${CONFIGS_DIR:-$BRAIN_REPO/operations/system-configs}"
BRAIN_AI_DIR="${BRAIN_AI_DIR:-$BRAIN_REPO/ai}"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME_DIR/.codex}"
DRY_RUN="${DRY_RUN:-0}"
SOCKET_RELATIVE_PATH="app-server-control/app-server-control.sock"
MACOS_SOCKET_PATH_MAX_BYTES=103

say() {
  printf '%s\n' "$*" >&2
}

die() {
  say "[ERROR] $*"
  exit 1
}

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run]' >&2
    for arg in "$@"; do
      printf ' %q' "$arg" >&2
    done
    printf '\n' >&2
    return 0
  fi
  "$@"
}

path_bytes() {
  LC_ALL=C printf '%s' "$1" | wc -c | tr -d ' '
}

control_socket_has_owner() {
  local socket_path="$1"
  command -v lsof >/dev/null 2>&1 || return 2
  lsof -nU -Fn 2>/dev/null | rg --fixed-strings --line-regexp "n$socket_path" >/dev/null
}

resolve_link_target_abs() {
  local link="$1"
  local target
  target="$(readlink "$link")" || return 1

  if [[ "$target" = /* ]]; then
    local target_dir
    target_dir="$(cd -P -- "$(dirname -- "$target")" 2>/dev/null && pwd)" || return 1
    printf '%s/%s\n' "$target_dir" "$(basename -- "$target")"
    return 0
  fi

  local link_dir
  link_dir="$(cd -P -- "$(dirname -- "$link")" 2>/dev/null && pwd)" || return 1
  local target_dir
  target_dir="$(cd -P -- "$link_dir/$(dirname -- "$target")" 2>/dev/null && pwd)" || return 1
  printf '%s/%s\n' "$target_dir" "$(basename -- "$target")"
}

normalize_existing_path() {
  local path="$1"
  local parent
  parent="$(cd -P -- "$(dirname -- "$path")" 2>/dev/null && pwd)" || return 1
  printf '%s/%s\n' "$parent" "$(basename -- "$path")"
}

managed_entries() {
  printf '%s\t%s\n' \
    "AGENTS.md" "$CONFIGS_DIR/codex/AGENTS.md" \
    "config.toml" "$CONFIGS_DIR/codex/config.toml" \
    "RTK.md" "$CONFIGS_DIR/codex/RTK.md" \
    "rules/default.rules" "$CONFIGS_DIR/codex/rules/default.rules" \
    "skills/user" "$BRAIN_AI_DIR/skills/active"
}

validate_sources() {
  [ -d "$BRAIN_REPO" ] || die "Brain repo not found: $BRAIN_REPO"

  local relative target
  while IFS=$'\t' read -r relative target; do
    [ -e "$target" ] || die "Managed source is missing for $relative: $target"
  done < <(managed_entries)
}

backup_existing_path() {
  local path="$1"
  local relative="$2"
  local backup_dir="$3"

  if [ ! -e "$path" ] && [ ! -L "$path" ]; then
    return 0
  fi

  local destination="$backup_dir/$relative"
  if [ -e "$destination" ] || [ -L "$destination" ]; then
    die "Backup destination already exists; refusing to overwrite it: $destination"
  fi
  run mkdir -p "$(dirname -- "$destination")"
  say "[WARN] Preserving existing $path at $destination"
  run mv "$path" "$destination"
}

ensure_real_directory() {
  local root="$1"
  local relative="$2"
  local backup_dir="$3"
  local path="$root/$relative"

  if [ -d "$path" ] && [ ! -L "$path" ]; then
    return 0
  fi

  if [ -L "$path" ] && [ -d "$path" ]; then
    local source_dir
    source_dir="$(cd -P -- "$path" && pwd)" || die "Cannot resolve directory symlink: $path"

    if [ "$DRY_RUN" -eq 1 ]; then
      say "[dry-run] Would preserve contents from $source_dir in a new real directory at $path."
      backup_existing_path "$path" "$relative" "$backup_dir"
      run mkdir -p "$path"
      return 0
    fi

    local staged_dir
    staged_dir="$(mktemp -d "$(dirname -- "$path")/.$(basename -- "$path").managed.XXXXXX")"
    if ! copy_directory "$source_dir" "$staged_dir"; then
      die "Could not preserve directory contents from $source_dir; staging retained at $staged_dir"
    fi

    backup_existing_path "$path" "$relative" "$backup_dir"
    if ! mv "$staged_dir" "$path"; then
      mv "$backup_dir/$relative" "$path"
      die "Could not activate the real directory; original symlink restored. Staging retained at $staged_dir"
    fi
    return 0
  fi

  backup_existing_path "$path" "$relative" "$backup_dir"
  run mkdir -p "$path"
}

ensure_managed_link() {
  local root="$1"
  local relative="$2"
  local target="$3"
  local backup_dir="$4"
  local link="$root/$relative"
  local expected
  expected="$(normalize_existing_path "$target")" || die "Cannot resolve managed target: $target"

  if [ -L "$link" ]; then
    local actual
    actual="$(resolve_link_target_abs "$link")" || actual=""
    if [ "$actual" = "$expected" ]; then
      return 0
    fi
  fi

  backup_existing_path "$link" "$relative" "$backup_dir"
  run mkdir -p "$(dirname -- "$link")"
  run ln -s "$target" "$link"
}

install_managed_layout() {
  local root="$1"
  local backup_dir="$2"

  ensure_real_directory "$root" "rules" "$backup_dir"
  ensure_real_directory "$root" "skills" "$backup_dir"

  local relative target
  while IFS=$'\t' read -r relative target; do
    ensure_managed_link "$root" "$relative" "$target" "$backup_dir"
  done < <(managed_entries)
}

check_managed_layout() {
  local failures=0

  if [ -L "$CODEX_HOME_DIR" ]; then
    say "[FAIL] $CODEX_HOME_DIR is still a whole-directory symlink."
    failures=$((failures + 1))
  elif [ ! -d "$CODEX_HOME_DIR" ]; then
    say "[FAIL] $CODEX_HOME_DIR is not a real directory."
    failures=$((failures + 1))
  else
    say "[OK] $CODEX_HOME_DIR is a real directory."
  fi

  local runtime_dir
  for runtime_dir in rules skills; do
    if [ -d "$CODEX_HOME_DIR/$runtime_dir" ] && [ ! -L "$CODEX_HOME_DIR/$runtime_dir" ]; then
      say "[OK] $CODEX_HOME_DIR/$runtime_dir is a real directory."
    else
      say "[FAIL] $CODEX_HOME_DIR/$runtime_dir must be a real directory."
      failures=$((failures + 1))
    fi
  done

  local relative target link expected actual
  while IFS=$'\t' read -r relative target; do
    link="$CODEX_HOME_DIR/$relative"
    expected="$(normalize_existing_path "$target")" || expected=""
    if [ ! -L "$link" ]; then
      say "[FAIL] Missing managed symlink: $link"
      failures=$((failures + 1))
      continue
    fi
    actual="$(resolve_link_target_abs "$link")" || actual=""
    if [ "$actual" != "$expected" ]; then
      say "[FAIL] Wrong target: $link -> ${actual:-unresolved}"
      say "       Expected: $expected"
      failures=$((failures + 1))
    else
      say "[OK] $link"
    fi
  done < <(managed_entries)

  local socket_root="$CODEX_HOME_DIR"
  if [ -d "$CODEX_HOME_DIR" ]; then
    socket_root="$(cd -P -- "$CODEX_HOME_DIR" && pwd)"
  fi
  local socket_path="$socket_root/$SOCKET_RELATIVE_PATH"
  local socket_bytes
  socket_bytes="$(path_bytes "$socket_path")"
  if [ "$socket_bytes" -le "$MACOS_SOCKET_PATH_MAX_BYTES" ]; then
    say "[OK] Socket path is $socket_bytes bytes (maximum $MACOS_SOCKET_PATH_MAX_BYTES)."
  else
    say "[FAIL] Socket path is $socket_bytes bytes (maximum $MACOS_SOCKET_PATH_MAX_BYTES)."
    failures=$((failures + 1))
  fi

  if [ -S "$socket_path" ]; then
    if ! command -v lsof >/dev/null 2>&1; then
      say "[FAIL] lsof is required to determine whether the control socket is stale."
      failures=$((failures + 1))
    elif control_socket_has_owner "$socket_path"; then
      say "[OK] Control socket is owned by a running process."
    else
      say "[FAIL] Control socket exists but no process owns it: $socket_path"
      failures=$((failures + 1))
    fi
  fi

  local state_db="$CODEX_HOME_DIR/state_5.sqlite"
  if [ -f "$state_db" ]; then
    if ! command -v sqlite3 >/dev/null 2>&1; then
      say "[FAIL] sqlite3 is required to validate $state_db."
      failures=$((failures + 1))
    else
      local integrity threads_table rollout_column legacy_root legacy_sql legacy_count
      integrity="$(sqlite3 -readonly "$state_db" 'PRAGMA integrity_check;' 2>/dev/null || true)"
      if [ "$integrity" != "ok" ]; then
        say "[FAIL] $state_db failed integrity validation."
        failures=$((failures + 1))
      else
        threads_table="$(sqlite3 -readonly "$state_db" \
          "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='threads';")"
        rollout_column="$(sqlite3 -readonly "$state_db" \
          "SELECT COUNT(*) FROM pragma_table_info('threads') WHERE name='rollout_path';")"
        if [ "$threads_table" -eq 1 ] && [ "$rollout_column" -eq 1 ]; then
          legacy_root="$(normalize_existing_path "$CONFIGS_DIR/codex")" || legacy_root=""
          legacy_sql="$(sql_quote_literal "$legacy_root")"
          legacy_count="$(sqlite3 -readonly "$state_db" \
            "SELECT COUNT(*) FROM threads
             WHERE substr(rollout_path, 1, length(${legacy_sql}) + 1) = ${legacy_sql} || '/';")"
          if [ "$legacy_count" -eq 0 ]; then
            say "[OK] State database has no legacy repository rollout paths."
          else
            say "[FAIL] State database still has $legacy_count legacy repository rollout path(s)."
            failures=$((failures + 1))
          fi
        else
          say "[OK] State database has no rollout-path inventory to validate."
        fi
      fi
    fi
  fi

  [ "$failures" -eq 0 ] || return 1
  say "Codex managed runtime root check passed."
}

codex_processes_are_running() {
  if [ "${CODEX_HOME_TEST_FORCE_PROCESS_RUNNING:-0}" -eq 1 ]; then
    say "[ERROR] A simulated Codex process is still running."
    return 0
  fi

  if [ "${CODEX_HOME_SKIP_PROCESS_CHECK:-0}" -eq 1 ]; then
    [ "${CODEX_HOME_TEST_MODE:-0}" -eq 1 ] || {
      die "CODEX_HOME_SKIP_PROCESS_CHECK is test-only and cannot bypass the live Codex process guard."
    }
    say "[WARN] Process check skipped by CODEX_HOME_SKIP_PROCESS_CHECK=1."
    return 1
  fi

  local process_name
  for process_name in ChatGPT Codex codex codex-app-server app-server SkyComputerUseClient; do
    if pgrep -x "$process_name" >/dev/null 2>&1; then
      say "[ERROR] A $process_name process is still running."
      return 0
    fi
  done

  if pgrep -f '/(Codex|ChatGPT)\.app/|codex[^ ]*.*app-server|app-server.*codex|SkyComputerUseClient' >/dev/null 2>&1; then
    say "[ERROR] A Codex app-server process is still running."
    return 0
  fi

  return 1
}

check_copy_space() {
  local source="$1"
  local source_kb available_kb reserve_kb required_kb

  source_kb="${CODEX_HOME_TEST_SOURCE_KB:-$(du -sk "$source" | awk '{print $1}')}"
  available_kb="${CODEX_HOME_TEST_AVAILABLE_KB:-$(df -Pk "$HOME_DIR" | awk 'NR == 2 {print $4}')}"
  reserve_kb=$((source_kb / 10))
  if [ "$reserve_kb" -lt 524288 ]; then
    reserve_kb=524288
  fi
  required_kb=$((source_kb + reserve_kb))

  if [ "$available_kb" -lt "$required_kb" ]; then
    die "Not enough free disk space. Need at least ${required_kb} KB; ${available_kb} KB is available."
  fi

  say "Disk-space check passed: ${source_kb} KB to copy, ${available_kb} KB available."
}

repair_layout() {
  validate_sources

  if [ -L "$CODEX_HOME_DIR" ]; then
    die "$CODEX_HOME_DIR is a whole-directory symlink. Run the guarded migrate command instead."
  fi

  if check_managed_layout >/dev/null 2>&1; then
    say "Codex managed runtime root is already valid; no repair was needed."
    return 0
  fi

  if codex_processes_are_running; then
    die "Close the Codex/ChatGPT application and Computer Use before repairing the managed layout."
  fi

  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local backup_root="$HOME_DIR/.brain-configs-backups/codex-managed-root/$timestamp-$$"
  local backup_dir="$backup_root/replaced-managed-entries"

  run mkdir -p "$CODEX_HOME_DIR"
  install_managed_layout "$CODEX_HOME_DIR" "$backup_dir"

  local control_socket="$CODEX_HOME_DIR/$SOCKET_RELATIVE_PATH"
  if [ -S "$control_socket" ]; then
    command -v lsof >/dev/null 2>&1 || {
      die "lsof is required to determine whether the control socket is stale."
    }
    if control_socket_has_owner "$control_socket"; then
      die "The control socket is still owned by a running process: $control_socket"
    fi
    say "Removing stale Codex control socket: $control_socket"
    run unlink "$control_socket"
  fi

  local legacy_root final_root
  legacy_root="$(normalize_existing_path "$CONFIGS_DIR/codex")" || {
    die "Cannot resolve the legacy Codex repository path."
  }
  final_root="$(normalize_existing_path "$CODEX_HOME_DIR")" || {
    die "Cannot resolve the final Codex home path: $CODEX_HOME_DIR"
  }
  if [ "$DRY_RUN" -eq 1 ]; then
    say "[dry-run] Would validate and repair legacy rollout paths in $CODEX_HOME_DIR/state_5.sqlite."
  else
    repair_state_db_rollout_paths "$CODEX_HOME_DIR" "$legacy_root" "$final_root" "$backup_root"
  fi

  if [ "$DRY_RUN" -eq 0 ]; then
    check_managed_layout
  fi
}

copy_directory() {
  local source="$1"
  local destination="$2"

  if [ "${CODEX_HOME_TEST_COPY_FAILURE:-0}" -eq 1 ]; then
    return 1
  fi

  mkdir -p "$destination" || return 1

  # Archive each discovered entry without recursive tar traversal so find's
  # type filter is authoritative. This skips every Unix socket at any depth
  # while preserving all other files, directories, symlinks, and permissions.
  (
    cd -- "$source" || exit 1
    find . ! -type s -print0 | tar --null --no-recursion -cf - -T -
  ) | tar -C "$destination" -xpf - || return 1

  if [ -n "${CODEX_HOME_TEST_COPY_FAILURE_ENTRY:-}" ] && {
    [ -e "$source/$CODEX_HOME_TEST_COPY_FAILURE_ENTRY" ] ||
      [ -L "$source/$CODEX_HOME_TEST_COPY_FAILURE_ENTRY" ]
  }; then
    return 1
  fi
}

sql_quote_literal() {
  local value="$1"
  value="$(printf '%s' "$value" | sed "s/'/''/g")"
  printf "'%s'" "$value"
}

repair_state_db_rollout_paths() {
  local staged_root="$1"
  local legacy_root="$2"
  local final_root="$3"
  local backup_dir="$4"
  local state_db="$staged_root/state_5.sqlite"

  [ -f "$state_db" ] || return 0
  command -v sqlite3 >/dev/null 2>&1 || {
    die "sqlite3 is required to validate and repair the migrated Codex state database."
  }
  [ -r "$state_db" ] && [ -w "$state_db" ] && [ -w "$(dirname -- "$state_db")" ] || {
    die "The Codex state database or its parent directory is not writable: $state_db"
  }

  local integrity
  integrity="$(sqlite3 -cmd '.timeout 5000' "$state_db" 'PRAGMA integrity_check;')" || {
    die "Could not validate the Codex state database at $state_db."
  }
  [ "$integrity" = "ok" ] || {
    die "The Codex state database failed integrity validation: $integrity"
  }

  local threads_table rollout_column
  threads_table="$(sqlite3 -cmd '.timeout 5000' "$state_db" \
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='threads';")"
  if [ "$threads_table" -eq 0 ]; then
    say "[WARN] Codex state database has no threads table; no rollout paths were rewritten."
    return 0
  fi
  rollout_column="$(sqlite3 -cmd '.timeout 5000' "$state_db" \
    "SELECT COUNT(*) FROM pragma_table_info('threads') WHERE name='rollout_path';")"
  [ "$rollout_column" -eq 1 ] || {
    die "The Codex state database has no threads.rollout_path column."
  }

  local legacy_sql final_sql legacy_count legacy_path relative missing_paths
  legacy_sql="$(sql_quote_literal "$legacy_root")"
  final_sql="$(sql_quote_literal "$final_root")"
  legacy_count="$(sqlite3 -cmd '.timeout 5000' "$state_db" \
    "SELECT COUNT(*) FROM threads
     WHERE substr(rollout_path, 1, length(${legacy_sql}) + 1) = ${legacy_sql} || '/';")"
  [ "$legacy_count" -gt 0 ] || {
    say "No legacy rollout paths required rewriting in the staged state database."
    return 0
  }

  missing_paths=0
  while IFS= read -r legacy_path; do
    case "$legacy_path" in
      "$legacy_root"/*) relative="${legacy_path#"$legacy_root"/}" ;;
      *)
        missing_paths=$((missing_paths + 1))
        continue
        ;;
    esac
    if [ ! -f "$staged_root/$relative" ]; then
      missing_paths=$((missing_paths + 1))
    fi
  done < <(sqlite3 -cmd '.timeout 5000' "$state_db" \
    "SELECT rollout_path FROM threads
     WHERE substr(rollout_path, 1, length(${legacy_sql}) + 1) = ${legacy_sql} || '/';")
  [ "$missing_paths" -eq 0 ] || {
    die "$missing_paths legacy rollout path(s) have no target file; refusing to rewrite the state database."
  }

  mkdir -p "$backup_dir"
  sqlite3 "$state_db" ".backup '$backup_dir/state_5.sqlite-before-path-rewrite'" || {
    die "Could not back up the Codex state database before path repair."
  }

  local updated_count
  updated_count="$(sqlite3 "$state_db" "
BEGIN IMMEDIATE;
UPDATE threads
SET rollout_path = ${final_sql} || substr(rollout_path, length(${legacy_sql}) + 1)
WHERE substr(rollout_path, 1, length(${legacy_sql}) + 1) = ${legacy_sql} || '/';
SELECT changes();
COMMIT;
PRAGMA wal_checkpoint(TRUNCATE);
" | sed -n '1p')" || {
    die "Could not rewrite legacy rollout paths in the Codex state database."
  }
  [ "$updated_count" -eq "$legacy_count" ] || {
    die "State database path repair updated $updated_count row(s); expected $legacy_count."
  }

  integrity="$(sqlite3 -cmd '.timeout 5000' "$state_db" 'PRAGMA integrity_check;')" || {
    die "Could not revalidate the repaired Codex state database."
  }
  [ "$integrity" = "ok" ] || {
    die "The repaired Codex state database failed integrity validation: $integrity"
  }
  [ "$(sqlite3 -cmd '.timeout 5000' "$state_db" \
    "SELECT COUNT(*) FROM threads
     WHERE substr(rollout_path, 1, length(${legacy_sql}) + 1) = ${legacy_sql} || '/';")" -eq 0 ] || {
    die "Legacy rollout paths remain after staged state database repair."
  }
  [ "$(sqlite3 -cmd '.timeout 5000' "$state_db" 'SELECT COUNT(*) FROM pragma_foreign_key_check;')" -eq 0 ] || {
    die "The repaired staged Codex state database failed foreign-key validation."
  }

  say "Rewrote $updated_count legacy rollout path(s) in the Codex state database."
}

migrate_layout() {
  validate_sources

  [ "${CONFIRM_CODEX_HOME_MIGRATION:-0}" -eq 1 ] || {
    die "Migration requires CONFIRM_CODEX_HOME_MIGRATION=1. Run check first and close Codex/ChatGPT."
  }

  [ -L "$CODEX_HOME_DIR" ] || die "$CODEX_HOME_DIR is not a symlink; use repair instead."

  local actual_source expected_source
  actual_source="$(resolve_link_target_abs "$CODEX_HOME_DIR")" || die "Cannot resolve $CODEX_HOME_DIR"
  expected_source="$(normalize_existing_path "$CONFIGS_DIR/codex")" || die "Cannot resolve canonical Codex config directory"
  [ "$actual_source" = "$expected_source" ] || {
    die "$CODEX_HOME_DIR points to $actual_source, not the expected $expected_source"
  }

  if codex_processes_are_running; then
    die "Close the Codex/ChatGPT application and stop remote Codex sessions before migrating."
  fi

  check_copy_space "$actual_source"

  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local backup_dir="$HOME_DIR/.brain-configs-backups/codex-managed-root/$timestamp-$$"
  local original_backup="$backup_dir/original-codex-home"

  if [ "$DRY_RUN" -eq 1 ]; then
    say "[dry-run] Would copy $actual_source into a new real directory beside $CODEX_HOME_DIR."
    say "[dry-run] Would install the managed links, preserve the original symlink at $original_backup, and atomically switch."
    return 0
  fi

  mkdir -p "$backup_dir"

  local stage_root
  stage_root="$(mktemp -d "$HOME_DIR/.codex-migration.XXXXXX")"
  say "Copying existing Codex data into staging: $stage_root"
  if ! copy_directory "$actual_source" "$stage_root"; then
    die "Copy failed. The original symlink is untouched; staging was retained at $stage_root"
  fi

  local final_root
  final_root="$(normalize_existing_path "$CODEX_HOME_DIR")" || {
    die "Cannot resolve the final Codex home path: $CODEX_HOME_DIR"
  }
  repair_state_db_rollout_paths "$stage_root" "$actual_source" "$final_root" "$backup_dir"

  install_managed_layout "$stage_root" "$backup_dir/replaced-managed-entries"

  # A stopped daemon can leave its socket inode behind. Never carry that socket
  # into the new runtime root; all other app-server data remains preserved.
  if [ -S "$stage_root/$SOCKET_RELATIVE_PATH" ]; then
    unlink "$stage_root/$SOCKET_RELATIVE_PATH"
  fi

  if codex_processes_are_running; then
    die "A Codex process started during the copy. The original symlink is untouched; staging was retained at $stage_root"
  fi

  say "Preserving original Codex home link at: $original_backup"
  mv "$CODEX_HOME_DIR" "$original_backup"
  if [ "${CODEX_HOME_TEST_SWITCH_FAILURE:-0}" -eq 1 ]; then
    mv "$original_backup" "$CODEX_HOME_DIR" || {
      die "Simulated switch failure also failed to restore the original symlink: $original_backup"
    }
    die "Simulated atomic switch failure. The original symlink was restored; staging remains at $stage_root"
  fi
  if ! mv "$stage_root" "$CODEX_HOME_DIR"; then
    say "[ERROR] Atomic switch failed; restoring the original symlink."
    mv "$original_backup" "$CODEX_HOME_DIR" || {
      die "Migration failed and automatic restoration failed. Original symlink remains at $original_backup; staging remains at $stage_root"
    }
    die "Migration failed before activation. Staging remains at $stage_root"
  fi

  if ! check_managed_layout; then
    say "[ERROR] Post-migration validation failed."
    say "Rollback after closing Codex: move $CODEX_HOME_DIR aside, then move $original_backup back to $CODEX_HOME_DIR"
    exit 1
  fi

  if codex_processes_are_running; then
    say "[ERROR] A Codex process started immediately after activation."
    say "Rollback with the preserved path before reopening Codex: $original_backup"
    exit 1
  fi

  say "Migration complete."
  say "Original symlink backup: $original_backup"
  say "Do not remove the backup until remote Codex, sessions, skills, MCPs, and plugins are verified."
}

rollback_layout() {
  local original_backup="${CODEX_HOME_ROLLBACK_BACKUP:-}"

  [ "${CONFIRM_CODEX_HOME_ROLLBACK:-0}" -eq 1 ] || {
    die "Rollback requires CONFIRM_CODEX_HOME_ROLLBACK=1."
  }
  [ -n "$original_backup" ] || die "Set CODEX_HOME_ROLLBACK_BACKUP to the exact original-codex-home path printed by migrate."

  case "$original_backup" in
    "$HOME_DIR"/.brain-configs-backups/codex-managed-root/*/original-codex-home) ;;
    *) die "Rollback backup is outside the managed backup area: $original_backup" ;;
  esac

  [ -L "$original_backup" ] || die "Rollback backup is not a preserved symlink: $original_backup"
  [ -d "$CODEX_HOME_DIR" ] && [ ! -L "$CODEX_HOME_DIR" ] || {
    die "$CODEX_HOME_DIR is not the migrated real directory; rollback stopped."
  }

  local backup_target expected_source
  backup_target="$(resolve_link_target_abs "$original_backup")" || die "Cannot resolve rollback backup"
  expected_source="$(normalize_existing_path "$CONFIGS_DIR/codex")" || die "Cannot resolve canonical Codex config directory"
  [ "$backup_target" = "$expected_source" ] || {
    die "Rollback backup points to $backup_target, not the expected $expected_source"
  }

  if codex_processes_are_running; then
    die "Close the Codex/ChatGPT application and stop remote Codex sessions before rollback."
  fi

  local failed_root
  failed_root="$(dirname -- "$original_backup")/failed-codex-home-$(date +%Y%m%d-%H%M%S)-$$"
  [ ! -e "$failed_root" ] || die "Rollback preservation path already exists: $failed_root"

  if [ "$DRY_RUN" -eq 1 ]; then
    say "[dry-run] Would preserve the migrated directory at $failed_root."
    say "[dry-run] Would restore $original_backup to $CODEX_HOME_DIR."
    return 0
  fi

  mv "$CODEX_HOME_DIR" "$failed_root"
  if ! mv "$original_backup" "$CODEX_HOME_DIR"; then
    say "[ERROR] Could not restore the original symlink; restoring the migrated directory."
    mv "$failed_root" "$CODEX_HOME_DIR"
    die "Rollback failed before activation."
  fi

  say "Rollback complete."
  say "Restored legacy Codex home: $CODEX_HOME_DIR"
  say "Migrated directory preserved at: $failed_root"
}

case "$COMMAND" in
  check)
    validate_sources
    check_managed_layout
    ;;
  repair)
    repair_layout
    ;;
  migrate)
    migrate_layout
    ;;
  rollback)
    validate_sources
    rollback_layout
    ;;
  *)
    say "Usage: $0 {check|repair|migrate|rollback}"
    exit 2
    ;;
esac
