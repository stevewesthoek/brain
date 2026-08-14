#!/usr/bin/env bash
set -Eeuo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# Receipt-backed Office + MacBook workstation activation.
#
# This file is intentionally self-contained. The owner starts it from a plain
# MacBook Terminal; it streams the same reviewed file to Office over a rescue
# SSH control connection. No AI application is required to remain running.
#
# Live execution is guarded by an explicit subcommand, an exact 40-character
# packet commit, clean candidate clones on both hosts, quiescence checks, fixed
# address SSH checks, and lossless backups. The default action is read-only.

readonly PACKET_BASE_COMMIT="ab6e6763097505e60e4104b91de5d379b9dd9c57"
readonly PACKET_BRANCH="maintenance/host-activation-integration-20260813"
readonly OLD_OFFICE_BRAIN_COMMIT="10622fabd4f931884c87fbe291fa70dd38849348"
readonly MIND_COMMIT="c3dcefdd808501a7ead7ffc4671eb5ef3822c268"
readonly PROVIDER_REVISION="076b9f97030e1c90bc66ffbb61d29456b41ed69f"
readonly OFFICE_CANDIDATE="/Users/Office/Repos/stevewesthoek/brain-host-activation"
readonly OFFICE_BRAIN="/Users/Office/Repos/stevewesthoek/brain"
readonly OFFICE_MIND="/Users/Office/Repos/stevewesthoek/mind"
readonly OFFICE_ARCHIVES="/Users/Office/Repos/stevewesthoek/brain-host-activation-archives"
readonly OFFICE_RECEIPTS="/Users/Office/.brain-host-activation"
readonly MAC_BRAIN="/Users/Steve/Repos/stevewesthoek/brain"
readonly MAC_RECEIPTS="/Users/Steve/.brain-host-activation"
readonly OFFICE_TB="192.168.2.1"
readonly OFFICE_TS="100.86.124.66"
readonly MAC_TB="192.168.2.2"
readonly MAC_TS="100.70.12.18"
readonly OFFICE_USER="office"
readonly MAC_USER="Steve"
readonly PREFLIGHT_BLOCKED_EXIT=20
readonly APPROVAL_FILE="/Users/Office/.brain/approvals/mind-context-read-only.json"
readonly CLAUDE_REGISTRY="/Users/Office/.claude.json"

SELF=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SELF="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")"
fi
ACTION="${1:-dry-run}"
EXPECTED_COMMIT=""
RUN_ID=""
RESCUE_SOCKET=""
LOCAL_RECEIPT=""
TEST_FIXTURE_ROOT=""
APPLICATIONS_MAY_BE_RUNNING=0

say() { printf '%s\n' "$*" >&2; }
phase() { say; say "=== Phase $1 — $2 ==="; }
fail() { say "[FAIL] $*"; return 1; }

usage() {
  cat >&2 <<'EOF'
Usage:
  host-activation.sh dry-run --expected-commit <40-hex-commit>
  host-activation.sh execute --expected-commit <40-hex-commit>
  host-activation.sh rollback --run-id <YYYYmmddTHHMMSSZ-pid>

The default action is dry-run. Live execution requires the exact final packet
commit and must be started by Steve from a plain MacBook Terminal after closing
the applications listed in operations/runbooks/host-activation.md.
EOF
}

parse_args() {
  shift || true
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --expected-commit)
        [ "$#" -ge 2 ] || fail "--expected-commit requires a value"
        EXPECTED_COMMIT="$2"
        shift 2
        ;;
      --run-id)
        [ "$#" -ge 2 ] || fail "--run-id requires a value"
        RUN_ID="$2"
        shift 2
        ;;
      /*)
        if [ "$ACTION" = "__fixture-test" ] && [ -z "$TEST_FIXTURE_ROOT" ]; then
          TEST_FIXTURE_ROOT="$1"
          shift
        else
          fail "unexpected positional argument: $1"
        fi
        ;;
      *) fail "unknown argument: $1" ;;
    esac
  done
}

validate_commit_arg() {
  [[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "expected commit must be exactly 40 lowercase hexadecimal characters"
}

validate_run_id() {
  [[ "$RUN_ID" =~ ^20[0-9]{6}T[0-9]{6}Z-[0-9]+$ ]] || fail "invalid run id: $RUN_ID"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

repo_exact_clean() {
  local repo="$1" label="$2"
  [ -d "$repo" ] || fail "$label is missing: $repo"
  [ "$(git -C "$repo" branch --show-current)" = "$PACKET_BRANCH" ] || fail "$label is not on $PACKET_BRANCH"
  [ "$(git -C "$repo" rev-parse HEAD)" = "$EXPECTED_COMMIT" ] || fail "$label is not at exact packet commit $EXPECTED_COMMIT"
  git -C "$repo" merge-base --is-ancestor "$PACKET_BASE_COMMIT" "$EXPECTED_COMMIT" || fail "$label commit is not a descendant of the validated integration base"
  [ -z "$(git -C "$repo" status --short)" ] || fail "$label is dirty"
  say "[OK] $label: $EXPECTED_COMMIT (clean)"
}

path_kind() {
  if [ -L "$1" ]; then printf 'symlink';
  elif [ -d "$1" ]; then printf 'directory';
  elif [ -f "$1" ]; then printf 'file';
  elif [ -e "$1" ]; then printf 'other';
  else printf 'missing'; fi
}

resolve_link() {
  local link="$1" raw parent
  [ -L "$link" ] || return 1
  raw="$(readlink "$link")"
  if [[ "$raw" = /* ]]; then
    parent="$(cd -P -- "$(dirname -- "$raw")" && pwd)"
    printf '%s/%s\n' "$parent" "$(basename -- "$raw")"
  else
    parent="$(cd -P -- "$(dirname -- "$link")/$(dirname -- "$raw")" && pwd)"
    printf '%s/%s\n' "$parent" "$(basename -- "$raw")"
  fi
}

check_no_forbidden_processes() {
  local label="$1" found=0 name
  for name in ChatGPT Codex codex codex-app-server app-server SkyComputerUseClient Claude claude Cursor cursor Gemini gemini Antigravity antigravity Kiro kiro Ghostty node-repl; do
    if pgrep -x "$name" >/dev/null 2>&1; then
      say "[BLOCKED] $label still has an affected process named $name"
      found=1
    fi
  done
  if pgrep -f '/(Codex|ChatGPT|Claude|Cursor|Gemini|Antigravity|Kiro|Ghostty)\.app/|codex[^ ]*.*app-server|SkyComputerUseClient|node[^ ]*.*repl' >/dev/null 2>&1; then
    say "[BLOCKED] $label still has an affected application/background process"
    found=1
  fi
  [ "$found" -eq 0 ] || return 1
  say "[OK] $label affected applications are quiescent"
}

check_port() {
  /usr/bin/nc -G 2 -z "$1" 22 >/dev/null 2>&1
}

ssh_explicit() {
  local user="$1" host="$2" alias="$3" identity="$4"
  shift 4
  /usr/bin/ssh \
    -o BatchMode=yes \
    -o ConnectTimeout=7 \
    -o StrictHostKeyChecking=yes \
    -o UpdateHostKeys=no \
    -o IdentitiesOnly=yes \
    -o "HostKeyAlias=$alias" \
    -i "$identity" \
    "$user@$host" "$@"
}

trusted_ed25519_key() {
  local host="$1" known_hosts="$2"
  ssh-keygen -F "$host" -f "$known_hosts" 2>/dev/null | awk '$2 == "ssh-ed25519" {print $2 " " $3; exit}'
}

scanned_ed25519_key() {
  local host="$1"
  ssh-keyscan -T 5 -t ed25519 "$host" 2>/dev/null | awk '$2 == "ssh-ed25519" {print $2 " " $3; exit}'
}

ensure_hostkey_alias() {
  local alias="$1" address_one="$2" address_two="$3" known_hosts="$4" trusted_one trusted_two scanned_one scanned_two alias_key staged
  [ -f "$known_hosts" ] || fail "known_hosts is missing: $known_hosts"
  trusted_one="$(trusted_ed25519_key "$address_one" "$known_hosts")"
  trusted_two="$(trusted_ed25519_key "$address_two" "$known_hosts")"
  scanned_one="$(scanned_ed25519_key "$address_one")"
  scanned_two="$(scanned_ed25519_key "$address_two")"
  [ -n "$trusted_one" ] && [ "$trusted_one" = "$trusted_two" ] || fail "fixed-address trusted ED25519 keys disagree or are missing for $alias"
  [ "$trusted_one" = "$scanned_one" ] && [ "$trusted_one" = "$scanned_two" ] || fail "live ED25519 key does not match both already-trusted fixed addresses for $alias"
  alias_key="$(trusted_ed25519_key "$alias" "$known_hosts")"
  if [ -n "$alias_key" ]; then
    [ "$alias_key" = "$trusted_one" ] || fail "existing HostKeyAlias entry has an unexpected ED25519 key: $alias"
    say "[OK] trusted HostKeyAlias already present: $alias"
    return 0
  fi
  staged="$(mktemp "$(dirname -- "$known_hosts")/.known_hosts.host-activation.XXXXXX")"
  cp -p "$known_hosts" "$staged"
  printf '%s %s\n' "$alias" "$trusted_one" >> "$staged"
  chmod 0600 "$staged"
  mv "$staged" "$known_hosts"
  [ "$(trusted_ed25519_key "$alias" "$known_hosts")" = "$trusted_one" ] || fail "HostKeyAlias activation verification failed: $alias"
  say "[OK] added $alias using the identical keys already trusted for $address_one and $address_two"
}

metadata_line() {
  local label="$1" path="$2" receipt="$3" kind target="-" mode="-" uid="-" gid="-" bytes=0 files=0 xattrs=0
  kind="$(path_kind "$path")"
  if [ "$kind" != "missing" ]; then
    mode="$(stat -f '%Lp' "$path" 2>/dev/null || printf '?')"
    uid="$(stat -f '%u' "$path" 2>/dev/null || printf '?')"
    gid="$(stat -f '%g' "$path" 2>/dev/null || printf '?')"
    bytes="$(du -sk "$path" 2>/dev/null | awk '{print $1 * 1024}' || printf '0')"
    files="$(find -L "$path" -type f 2>/dev/null | wc -l | tr -d ' ')"
    if command -v xattr >/dev/null 2>&1; then
      xattrs="$(xattr -r "$path" 2>/dev/null | wc -l | tr -d ' ')"
    fi
  fi
  if [ "$kind" = "symlink" ]; then target="$(readlink "$path")"; fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$label" "$path" "$kind" "$target" "$uid" "$gid" "$mode" "$files" "$bytes:$xattrs" >> "$receipt"
}

record_host_metadata() {
  local prefix="$1" home_dir="$2" output="$3" relative
  printf 'label\tpath\tkind\ttarget\tuid\tgid\tmode\tfiles\tbytes:xattrs\n' > "$output"
  chmod 0600 "$output"
  for relative in .claude .cursor .gemini .kiro .codex .gitconfig .ssh/config .ssh/known_hosts .zshrc .zprofile .config/ghostty/config .config/starship.toml; do
    metadata_line "$prefix-${relative//\//-}" "$home_dir/$relative" "$output"
  done
}

# Copy all persistent entries and omit Unix sockets, which are process-owned
# endpoints rather than durable state. BSD tar on macOS preserves modes, ACLs,
# symlinks, and extended attributes in this archive-stream form.
copy_tree() {
  local source="$1" destination="$2"
  [ -d "$source" ] || fail "copy source is not a directory: $source"
  [ ! -e "$destination" ] && [ ! -L "$destination" ] || fail "copy destination already exists: $destination"
  mkdir -p "$destination"
  (
    cd -- "$source"
    find . ! -type s -print0 | tar --null --no-recursion -cf - -T -
  ) | tar -C "$destination" -xpf -
}

# Content-address every regular file and symlink target plus non-secret
# ownership/mode/size/mtime/xattr metadata. Sort the private stream and
# emit only the final SHA-256; no file content or path is recorded in receipts.
tree_digest() {
  local root="$1"
  (
    cd -- "$root"
    find . -type f -exec shasum -a 256 {} +
    find . -type l -exec sh -c 'for p do printf "L %s " "$p"; readlink "$p"; done' sh {} +
    find . ! -type s -exec stat -f 'M %N|%u|%g|%Lp|%z|%m' {} +
    xattr -lr . 2>/dev/null || true
  ) | LC_ALL=C sort | shasum -a 256 | awk '{print $1}'
}

verify_tree_copy() {
  local source="$1" destination="$2" label="$3" receipt="$4" source_digest destination_digest
  source_digest="$(tree_digest "$source")"
  destination_digest="$(tree_digest "$destination")"
  [ "$source_digest" = "$destination_digest" ] || fail "$label content digest mismatch"
  printf '%s\t%s\t%s\n' "$label" "$source_digest" "verified" >> "$receipt"
  say "[OK] verified $label (SHA-256 $source_digest)"
}

copy_path_snapshot() {
  local source="$1" destination="$2"
  if [ ! -e "$source" ] && [ ! -L "$source" ]; then
    : > "$destination.missing"
  elif [ -L "$source" ]; then
    mkdir -p "$(dirname -- "$destination")"
    cp -pP "$source" "$destination"
  elif [ -d "$source" ]; then
    copy_tree "$source" "$destination"
  else
    mkdir -p "$(dirname -- "$destination")"
    cp -p "$source" "$destination"
  fi
}

move_aside() {
  local path="$1" destination="$2"
  if [ -e "$path" ] || [ -L "$path" ]; then
    [ ! -e "$destination" ] && [ ! -L "$destination" ] || fail "preservation destination already exists: $destination"
    mkdir -p "$(dirname -- "$destination")"
    mv "$path" "$destination"
  fi
}

restore_snapshot() {
  local live="$1" snapshot="$2" failed="$3"
  move_aside "$live" "$failed"
  if [ -e "$snapshot.missing" ]; then
    return 0
  fi
  if [ -L "$snapshot" ] || [ -f "$snapshot" ]; then
    mkdir -p "$(dirname -- "$live")"
    mv "$snapshot" "$live"
  elif [ -d "$snapshot" ]; then
    mv "$snapshot" "$live"
  fi
}

restore_snapshot_copy() {
  local live="$1" snapshot="$2" failed="$3" staged
  move_aside "$live" "$failed"
  if [ -e "$snapshot.missing" ]; then
    return 0
  fi
  mkdir -p "$(dirname -- "$live")"
  staged="$(mktemp "$(dirname -- "$live")/.$(basename -- "$live").restore.XXXXXX")"
  if [ -L "$snapshot" ]; then
    unlink "$staged"
    cp -pP "$snapshot" "$staged"
  elif [ -f "$snapshot" ]; then
    cp -p "$snapshot" "$staged"
  else
    fail "copy-restore snapshot is unavailable: $snapshot"
  fi
  mv "$staged" "$live"
}

write_phase_state() {
  local root="$1" number="$2" status="$3"
  printf '%s\t%s\n' "$number" "$status" > "$root/state.tsv.tmp"
  chmod 0600 "$root/state.tsv.tmp"
  mv "$root/state.tsv.tmp" "$root/state.tsv"
}

read_phase_number() {
  awk 'NR == 1 {print $1}' "$1/state.tsv" 2>/dev/null || printf '0'
}

receipt_note() {
  local root="$1"
  shift
  printf '%s\n' "$*" >> "$root/receipt.md"
}

office_preflight() {
  local execution="$1" old_head mind_dirty path expected
  phase 0 "Office preflight"
  for expected in awk chmod cp df du find git grep mkdir mktemp mv node pgrep sed shasum ssh-keygen ssh-keyscan stat tar unlink xattr; do require_command "$expected"; done
  [ -x /usr/bin/nc ] || fail "required command is unavailable: /usr/bin/nc"
  [ -x /usr/bin/ssh ] || fail "required command is unavailable: /usr/bin/ssh"
  [ "$(id -un)" = "Office" ] || fail "Office worker must run as Office"
  repo_exact_clean "$OFFICE_CANDIDATE" "Office integration candidate"
  [ -d "$OFFICE_BRAIN" ] || fail "old canonical Brain is missing"
  old_head="$(git -C "$OFFICE_BRAIN" rev-parse HEAD)"
  if [ "$old_head" = "$EXPECTED_COMMIT" ]; then
    fail "Office canonical Brain is already at the packet commit; execute is a guarded one-time operation and will not repeat"
  fi
  [ "$old_head" = "$OLD_OFFICE_BRAIN_COMMIT" ] || fail "old canonical Brain HEAD changed unexpectedly: $old_head"
  say "[OK] dirty old canonical Brain is preserved as an allowed input"
  [ "$(git -C "$OFFICE_MIND" rev-parse HEAD)" = "$MIND_COMMIT" ] || fail "Mind HEAD is not the approved exact commit"
  mind_dirty="$(git -C "$OFFICE_MIND" status --short | awk '{print substr($0,4)}' | awk '$0 != "kanban.md" && $0 !~ /^\.obsidian\// {print}')"
  [ -z "$mind_dirty" ] || fail "Mind has unexpected dirty paths outside .obsidian/** and kanban.md"
  say "[OK] Mind exact HEAD and allowed out-of-scope dirt"

  for path in .claude .cursor .gemini .kiro; do
    [ -L "/Users/Office/$path" ] || fail "/Users/Office/$path is not the expected legacy symlink"
    expected="$OFFICE_BRAIN/operations/system-configs/${path#.}"
    [ "$(resolve_link "/Users/Office/$path")" = "$expected" ] || fail "/Users/Office/$path has an unexpected target"
  done
  [ -d /Users/Office/.codex ] && [ ! -L /Users/Office/.codex ] || fail "Office .codex must already be physical"
  [ -L /Users/Office/.gitconfig ] || fail "Office .gitconfig is not the expected legacy symlink"
  [ -L /Users/Office/.ssh/config ] || fail "Office .ssh/config is not the expected legacy symlink"

  [ -f "$OFFICE_CANDIDATE/operations/scripts/brain-configs-link.sh" ] || fail "Brain config linker is missing"
  [ -f "$OFFICE_CANDIDATE/operations/scripts/codex-home-managed-root.sh" ] || fail "Codex check/repair manager is missing"
  [ -f "$OFFICE_CANDIDATE/projects/mind-context/src/provider/runtime.mjs" ] || fail "Mind provider runtime is missing"

  check_port "$MAC_TB" || fail "Office cannot reach MacBook Thunderbolt SSH"
  check_port "$MAC_TS" || fail "Office cannot reach MacBook Tailscale SSH"
  ssh_explicit "$MAC_USER" "$MAC_TB" "$MAC_TB" /Users/Office/.ssh/id_ed25519 /usr/bin/true >/dev/null
  ssh_explicit "$MAC_USER" "$MAC_TS" "$MAC_TS" /Users/Office/.ssh/id_ed25519 /usr/bin/true >/dev/null
  say "[OK] Office→MacBook authentication over both fixed addresses"

  local source_kb runtime_kb available_kb required_kb reserve_kb runtime_target
  source_kb="$(du -sk "$OFFICE_BRAIN" /Users/Office/.codex "$OFFICE_CANDIDATE" | awk '{s += $1} END {print s}')"
  runtime_kb=0
  for path in .claude .cursor .gemini .kiro; do
    runtime_target="$(resolve_link "/Users/Office/$path")"
    runtime_kb=$((runtime_kb + $(du -sk "$runtime_target" | awk '{print $1}')))
  done
  # Each legacy runtime target is copied once to backup and once to staging.
  source_kb=$((source_kb + (runtime_kb * 2)))
  available_kb="$(df -Pk /Users/Office | awk 'NR == 2 {print $4}')"
  reserve_kb=5242880
  required_kb=$((source_kb + reserve_kb))
  [ "$available_kb" -ge "$required_kb" ] || fail "Office free space is insufficient: need ${required_kb}KB; have ${available_kb}KB"
  say "[OK] Office free-space gate: ${available_kb}KB available; ${required_kb}KB required"

  if [ "$execution" = "execute" ]; then
    check_no_forbidden_processes "Office"
  else
    check_no_forbidden_processes "Office" || say "[PLAN] Close the reported Office processes before execute; dry-run remains read-only."
  fi
}

office_phase1_backup() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" metadata="$OFFICE_RECEIPTS/$RUN_ID/metadata.tsv" name live source backup label
  phase 1 "Office backup and receipts"
  umask 077
  [ ! -e "$root" ] || fail "Office receipt already exists: $root"
  mkdir -p "$root/backups/runtime" "$root/backups/paths" "$root/staging/runtime" "$root/staging/candidate" "$root/original-paths" "$root/failed"
  chmod 0700 "$root" "$root/backups" "$root/staging" "$root/original-paths" "$root/failed"
  printf 'label\tpath\tkind\ttarget\tuid\tgid\tmode\tfiles\tbytes:xattrs\n' > "$metadata"
  chmod 0600 "$metadata"
  cat > "$root/receipt.md" <<EOF
# Host Activation Receipt

- Run ID: $RUN_ID
- Started UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Packet commit: $EXPECTED_COMMIT
- Old canonical Brain commit: $OLD_OFFICE_BRAIN_COMMIT
- Expected Mind commit: $MIND_COMMIT
- Backup/receipt root: $root
- Status: IN PROGRESS
EOF
  chmod 0600 "$root/receipt.md"

  for name in claude cursor gemini kiro; do
    live="/Users/Office/.$name"
    source="$(resolve_link "$live")"
    backup="$root/backups/runtime/$name"
    label="office-$name-runtime"
    metadata_line "$label" "$live" "$metadata"
    copy_tree "$source" "$backup"
    verify_tree_copy "$source" "$backup" "$label-backup" "$root/integrity.tsv"
  done

  metadata_line "office-codex-runtime" /Users/Office/.codex "$metadata"
  copy_tree /Users/Office/.codex "$root/backups/runtime/codex"
  verify_tree_copy /Users/Office/.codex "$root/backups/runtime/codex" "office-codex-backup" "$root/integrity.tsv"

  metadata_line "office-old-canonical-brain" "$OFFICE_BRAIN" "$metadata"
  copy_tree "$OFFICE_BRAIN" "$root/backups/old-canonical-brain-copy"
  verify_tree_copy "$OFFICE_BRAIN" "$root/backups/old-canonical-brain-copy" "old-canonical-brain-backup" "$root/integrity.tsv"

  for name in gitconfig ssh-config known-hosts zshrc zprofile ghostty starship claude-registry approval; do
    case "$name" in
      gitconfig) live=/Users/Office/.gitconfig ;;
      ssh-config) live=/Users/Office/.ssh/config ;;
      known-hosts) live=/Users/Office/.ssh/known_hosts ;;
      zshrc) live=/Users/Office/.zshrc ;;
      zprofile) live=/Users/Office/.zprofile ;;
      ghostty) live=/Users/Office/.config/ghostty/config ;;
      starship) live=/Users/Office/.config/starship.toml ;;
      claude-registry) live="$CLAUDE_REGISTRY" ;;
      approval) live="$APPROVAL_FILE" ;;
    esac
    metadata_line "office-$name" "$live" "$metadata"
    copy_path_snapshot "$live" "$root/backups/paths/$name"
  done

  git clone --no-local --single-branch --branch "$PACKET_BRANCH" "$OFFICE_CANDIDATE" "$root/staging/candidate/brain"
  repo_exact_clean "$root/staging/candidate/brain" "staged standalone canonical Brain"
  write_phase_state "$root" 1 "BACKUP_VERIFIED"
  say "[OK] owner-only Office receipt and all required backups verified: $root"
}

office_phase2_stage_roots() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" name
  phase 2 "Office staged physical runtime copies"
  for name in claude cursor gemini kiro; do
    copy_tree "$root/backups/runtime/$name" "$root/staging/runtime/$name"
    verify_tree_copy "$root/backups/runtime/$name" "$root/staging/runtime/$name" "office-$name-stage" "$root/integrity.tsv"
  done
  write_phase_state "$root" 2 "RUNTIME_STAGING_VERIFIED"
}

activate_runtime_root() {
  local root="$1" name="$2" live="/Users/Office/.$2" staged="$1/staging/runtime/$2" original="$1/original-paths/$2.symlink"
  [ -L "$live" ] || fail "$live changed after preflight"
  [ -d "$staged" ] && [ ! -L "$staged" ] || fail "runtime stage is invalid: $staged"
  mv "$live" "$original"
  if ! mv "$staged" "$live"; then
    mv "$original" "$live"
    fail "atomic activation failed for $live; original symlink restored"
  fi
  if [ ! -d "$live" ] || [ -L "$live" ]; then
    move_aside "$live" "$root/failed/$name-switch-failure"
    mv "$original" "$live"
    fail "post-switch path validation failed for $live; original symlink restored"
  fi
  verify_tree_copy "$root/backups/runtime/$name" "$live" "office-$name-live" "$root/integrity.tsv"
}

office_phase3_convert_roots() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" name
  phase 3 "Office atomic root conversion"
  check_no_forbidden_processes "Office"
  write_phase_state "$root" 3 "RUNTIME_ROOT_CONVERSION_IN_PROGRESS"
  for name in claude cursor gemini kiro; do
    activate_runtime_root "$root" "$name"
  done
  [ -d /Users/Office/.codex ] && [ ! -L /Users/Office/.codex ] || fail "Office .codex root changed unexpectedly"
  BRAIN_REPO="$OFFICE_CANDIDATE" CODEX_HOME=/Users/Office/.codex bash "$OFFICE_CANDIDATE/operations/scripts/codex-home-managed-root.sh" check >/dev/null 2>&1 || say "[EXPECTED] Codex root is physical; managed entries will be repaired only after canonical Brain placement."
  write_phase_state "$root" 3 "RUNTIME_ROOTS_PHYSICAL"
}

office_phase4_replace_brain() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" archive="$OFFICE_ARCHIVES/$RUN_ID/brain-before-activation" staged="$root/staging/candidate/brain"
  phase 4 "Office canonical Brain replacement"
  mkdir -p "$OFFICE_ARCHIVES/$RUN_ID"
  chmod 0700 "$OFFICE_ARCHIVES/$RUN_ID"
  [ ! -e "$archive" ] || fail "archive destination already exists: $archive"
  printf '%s\n' "$archive" > "$root/archive-path"
  write_phase_state "$root" 4 "CANONICAL_BRAIN_SWITCH_IN_PROGRESS"
  mv "$OFFICE_BRAIN" "$archive"
  if ! mv "$staged" "$OFFICE_BRAIN"; then
    mv "$archive" "$OFFICE_BRAIN"
    fail "canonical Brain placement failed; old canonical Brain restored"
  fi
  repo_exact_clean "$OFFICE_BRAIN" "new Office canonical Brain"
  write_phase_state "$root" 4 "CANONICAL_BRAIN_ACTIVE"
  receipt_note "$root" "- Old canonical Brain archive: $archive"
  say "[OK] old dirty canonical Brain preserved losslessly: $archive"
}

write_include_root() {
  local kind="$1" target managed overlay marker staged
  case "$kind" in
    git)
      target=/Users/Office/.gitconfig
      managed="$OFFICE_BRAIN/operations/system-configs/git/gitconfig"
      overlay=/Users/Office/.gitconfig.local
      marker="# Managed by Brain workstation config: Git INCLUDE root"
      staged="$(mktemp /Users/Office/.gitconfig.host-activation.XXXXXX)"
      {
        printf '%s\n' "$marker"
        printf '[include]\n\tpath = %s\n' "$managed"
        [ ! -f "$overlay" ] || printf '[include]\n\tpath = %s\n' "$overlay"
      } > "$staged"
      ;;
    ssh)
      target=/Users/Office/.ssh/config
      managed="$OFFICE_BRAIN/operations/system-configs/ssh/config"
      overlay=/Users/Office/.ssh/config.local
      marker="# Managed by Brain workstation config: SSH INCLUDE root"
      staged="$(mktemp /Users/Office/.ssh/.config.host-activation.XXXXXX)"
      {
        printf '%s\n' "$marker"
        printf 'Include %s\n' "$managed"
        [ ! -f "$overlay" ] || printf 'Include %s\n' "$overlay"
      } > "$staged"
      ;;
    *) fail "unknown include root kind: $kind" ;;
  esac
  chmod 0600 "$staged"
  move_aside "$target" "$OFFICE_RECEIPTS/$RUN_ID/original-paths/$kind-root-before-include"
  mv "$staged" "$target"
}

office_phase5_activate_configs() {
  local root="$OFFICE_RECEIPTS/$RUN_ID"
  phase 5 "Office narrow configuration activation"
  check_no_forbidden_processes "Office"
  write_phase_state "$root" 5 "OFFICE_CONFIG_ACTIVATION_IN_PROGRESS"
  write_include_root git
  write_include_root ssh
  ensure_hostkey_alias macbook-m1 "$MAC_TB" "$MAC_TS" /Users/Office/.ssh/known_hosts
  BRAIN_REPO="$OFFICE_BRAIN" \
    BRAIN_CONFIG_BACKUP_DIR="$root/linker-backups" \
    bash "$OFFICE_BRAIN/operations/scripts/brain-configs-link.sh"
  BRAIN_REPO="$OFFICE_BRAIN" CODEX_HOME=/Users/Office/.codex \
    bash "$OFFICE_BRAIN/operations/scripts/codex-home-managed-root.sh" check
  node "$OFFICE_BRAIN/tools/validate-workstation-config-ownership.mjs"
  if find /Users/Office/.claude /Users/Office/.cursor /Users/Office/.gemini /Users/Office/.kiro /Users/Office/.codex \
    -type l -exec readlink {} \; 2>/dev/null | grep -Eq 'brain-next|brain-host-activation|/Volumes/Office'; then
    fail "a managed Office target still references a noncanonical Brain path"
  fi
  write_phase_state "$root" 5 "OFFICE_CONFIG_ACTIVE"
}

write_approval_file() {
  local directory staged approved_at approval_id
  directory="$(dirname -- "$APPROVAL_FILE")"
  mkdir -p "$directory"
  chmod 0700 "$directory"
  staged="$(mktemp "$directory/.mind-context-read-only.host-activation.XXXXXX")"
  approved_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  approval_id="host-activation-$RUN_ID"
  cat > "$staged" <<EOF
{
  "approved": true,
  "approvedBy": "Steve Westhoek",
  "approvedAt": "$approved_at",
  "approvalId": "$approval_id",
  "scope": "mind-context-read-only",
  "providerRevision": "$PROVIDER_REVISION",
  "mindCommit": "$MIND_COMMIT",
  "allowedScopes": ["faith", "knowledge", "organizations", "people", "projects", "resources", "system", "tasks", "wiki"]
}
EOF
  chmod 0600 "$staged"
  mv "$staged" "$APPROVAL_FILE"
}

update_claude_mind_registration() {
  [ -f "$CLAUDE_REGISTRY" ] || fail "Claude registry is missing: $CLAUDE_REGISTRY"
  CLAUDE_REGISTRY="$CLAUDE_REGISTRY" OFFICE_BRAIN="$OFFICE_BRAIN" OFFICE_MIND="$OFFICE_MIND" \
  MIND_COMMIT="$MIND_COMMIT" PROVIDER_REVISION="$PROVIDER_REVISION" node --input-type=module - <<'NODE'
import fs from 'node:fs';
const file = process.env.CLAUDE_REGISTRY;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data.projects ??= {};
data.projects[process.env.OFFICE_MIND] ??= {};
data.projects[process.env.OFFICE_MIND].mcpServers ??= {};
data.projects[process.env.OFFICE_MIND].mcpServers['mind-context'] = {
  type: 'stdio',
  command: process.execPath,
  args: [`${process.env.OFFICE_BRAIN}/projects/mind-context/src/provider/server.mjs`],
  env: {
    MIND_CONTEXT_ALLOWED_TOOLS: 'mind_context_health,mind_context_resolve,mind_context_explain',
    MIND_CONTEXT_ALLOWED_SUBOPERATIONS: '',
    MIND_CONTEXT_ACTIVATION_APPROVAL_FILE: '/Users/Office/.brain/approvals/mind-context-read-only.json',
    MIND_CONTEXT_ALLOWED_SCOPES: 'faith,knowledge,organizations,people,projects,resources,system,tasks,wiki',
    MIND_CONTEXT_EXPECTED_HEAD: process.env.MIND_COMMIT,
    MIND_CONTEXT_PREPARATION_APPROVAL_FILE: '/Users/Office/.brain/approvals/mind-context-preparation.json',
    MIND_CONTEXT_PREPARATION_MODE: '0',
    MIND_CONTEXT_PROVIDER_REVISION: process.env.PROVIDER_REVISION,
    MIND_CONTEXT_ROOT: process.env.OFFICE_MIND,
  },
};
const staged = `${file}.host-activation-${process.pid}`;
fs.writeFileSync(staged, `${JSON.stringify(data, null, 2)}\n`, {mode: 0o600, flag: 'wx'});
fs.renameSync(staged, file);
fs.chmodSync(file, 0o600);
NODE
}

verify_bridge() {
  MIND_CONTEXT_ALLOWED_TOOLS=mind_context_health,mind_context_resolve,mind_context_explain \
  MIND_CONTEXT_ALLOWED_SUBOPERATIONS= \
  MIND_CONTEXT_ACTIVATION_APPROVAL_FILE="$APPROVAL_FILE" \
  MIND_CONTEXT_ALLOWED_SCOPES=faith,knowledge,organizations,people,projects,resources,system,tasks,wiki \
  MIND_CONTEXT_EXPECTED_HEAD="$MIND_COMMIT" \
  MIND_CONTEXT_PREPARATION_APPROVAL_FILE=/Users/Office/.brain/approvals/mind-context-preparation.json \
  MIND_CONTEXT_PREPARATION_MODE=0 \
  MIND_CONTEXT_PROVIDER_REVISION="$PROVIDER_REVISION" \
  MIND_CONTEXT_ROOT="$OFFICE_MIND" \
  PROVIDER_RUNTIME="$OFFICE_BRAIN/projects/mind-context/src/provider/runtime.mjs" \
  node --input-type=module - <<'NODE'
const runtime = await import(`file://${process.env.PROVIDER_RUNTIME}`);
const config = runtime.loadProviderConfig(process.env);
const health = runtime.providerHealth(config);
if (!health.healthy || !health.readOnly || health.mutationPathExposed || !health.source.headMatchesExpected || !health.source.worktreeMatchesCommit) throw new Error('mind-context health invariant failed');
const names = runtime.TOOL_DEFINITIONS.map((tool) => tool.name);
if (JSON.stringify(names) !== JSON.stringify(['mind_context_health', 'mind_context_resolve', 'mind_context_explain'])) throw new Error('mind-context tool surface changed');
const resolved = runtime.providerResolve(config, {query: 'canonical agent context entry point', scopeSubset: ['system'], authorityFilter: 'current', freshnessFilter: 'fresh', maxItems: 3, maxTokens: 800});
const pack = resolved.pack ?? resolved;
if (!pack || pack.state?.verified !== 'runtime-verified' || !Array.isArray(pack.sources) || pack.sources.length < 1) throw new Error('bounded cited resolve failed');
if (!pack.sources.every((source) => source.citation && /^[a-f0-9]{64}$/.test(source.sha256 ?? ''))) throw new Error('resolve result lacks citations or source hashes');
process.stderr.write('[OK] mind-context health, exact three-tool read-only surface, and bounded cited resolve\n');
NODE
}

office_phase7_activate_bridge() {
  local root="$OFFICE_RECEIPTS/$RUN_ID"
  phase 7 "Brain–Mind bridge activation"
  [ "$(git -C "$OFFICE_MIND" rev-parse HEAD)" = "$MIND_COMMIT" ] || fail "Mind HEAD changed before approval repin"
  write_phase_state "$root" 7 "BRIDGE_ACTIVATION_IN_PROGRESS"
  write_approval_file
  update_claude_mind_registration
  verify_bridge
  write_phase_state "$root" 7 "BRIDGE_ACTIVE"
  receipt_note "$root" "- Bridge: exact Mind $MIND_COMMIT; provider $PROVIDER_REVISION; health/resolve/read-only surface PASS"
}

office_connectivity_acceptance() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" host
  phase 8 "Office connectivity acceptance"
  for host in "$MAC_TB" "$MAC_TS"; do
    ssh_explicit "$MAC_USER" "$host" macbook-m1 /Users/Office/.ssh/id_ed25519 /usr/bin/true >/dev/null
  done
  /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=7 -o UpdateHostKeys=no MacBook /usr/bin/true >/dev/null
  /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=7 -o UpdateHostKeys=no macbook /usr/bin/true >/dev/null
  ssh -G MacBook 2>/dev/null | grep -Eq '^hostkeyalias macbook-m1$' || fail "MacBook alias lost HostKeyAlias"
  ssh -G macbook 2>/dev/null | grep -Eq '^hostkeyalias macbook-m1$' || fail "macbook alias lost HostKeyAlias"
  write_phase_state "$root" 8 "OFFICE_CONNECTIVITY_PASS"
  receipt_note "$root" "- Office→MacBook: Thunderbolt PASS; Tailscale PASS; MacBook/macbook aliases PASS"
}

office_restore_ssh_only() {
  local root="$OFFICE_RECEIPTS/$RUN_ID"
  [ -d "$root" ] || return 0
  restore_snapshot_copy /Users/Office/.ssh/config "$root/backups/paths/ssh-config" "$root/failed/ssh-config-post-failure"
  say "[ROLLBACK] Office SSH root config restored from the pre-migration snapshot"
}

office_rollback() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" number name archive failed_root
  validate_run_id
  [ -d "$root" ] || fail "Office receipt does not exist: $root"
  number="$(read_phase_number "$root")"
  case "$number" in ''|*[!0-9]*) fail "invalid Office phase state" ;; esac
  if [ "$number" -eq 0 ]; then
    say "[OK] Office run $RUN_ID is already rolled back; no paths changed."
    return 0
  fi
  check_no_forbidden_processes "Office"
  say "[ROLLBACK] reversing Office run $RUN_ID from completed phase $number"
  mkdir -p "$root/failed/rollback-$(date -u +%Y%m%dT%H%M%SZ)"
  failed_root="$root/failed/rollback-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$failed_root"

  if [ "$number" -ge 7 ]; then
    restore_snapshot "$APPROVAL_FILE" "$root/backups/paths/approval" "$failed_root/approval"
    restore_snapshot "$CLAUDE_REGISTRY" "$root/backups/paths/claude-registry" "$failed_root/claude-registry"
  fi
  if [ "$number" -ge 5 ]; then
    restore_snapshot /Users/Office/.gitconfig "$root/backups/paths/gitconfig" "$failed_root/gitconfig"
    restore_snapshot /Users/Office/.ssh/config "$root/backups/paths/ssh-config" "$failed_root/ssh-config"
    restore_snapshot /Users/Office/.ssh/known_hosts "$root/backups/paths/known-hosts" "$failed_root/known-hosts"
    restore_snapshot /Users/Office/.zshrc "$root/backups/paths/zshrc" "$failed_root/zshrc"
    restore_snapshot /Users/Office/.zprofile "$root/backups/paths/zprofile" "$failed_root/zprofile"
    restore_snapshot /Users/Office/.config/ghostty/config "$root/backups/paths/ghostty" "$failed_root/ghostty"
    restore_snapshot /Users/Office/.config/starship.toml "$root/backups/paths/starship" "$failed_root/starship"
    move_aside /Users/Office/.codex "$failed_root/codex-after-activation"
    copy_tree "$root/backups/runtime/codex" /Users/Office/.codex
  fi
  if [ "$number" -ge 4 ]; then
    archive="$(cat "$root/archive-path")"
    if [ -d "$archive" ]; then
      move_aside "$OFFICE_BRAIN" "$failed_root/new-canonical-brain"
      mv "$archive" "$OFFICE_BRAIN"
    fi
  fi
  if [ "$number" -ge 3 ]; then
    for name in claude cursor gemini kiro; do
      if [ -L "$root/original-paths/$name.symlink" ]; then
        move_aside "/Users/Office/.$name" "$failed_root/$name-physical"
        mv "$root/original-paths/$name.symlink" "/Users/Office/.$name"
      fi
    done
  fi
  write_phase_state "$root" 0 "ROLLED_BACK"
  receipt_note "$root" "- Rollback: completed at $(date -u +%Y-%m-%dT%H:%M:%SZ); replacement artifacts preserved under $failed_root"
  say "ROLLBACK COMPLETE — Office originals restored; failed/new artifacts preserved at $failed_root"
}

office_abort() {
  local rc="$1" rollback_rc=0
  trap - ERR INT TERM HUP
  set +e
  if [ ! -d "$OFFICE_RECEIPTS/$RUN_ID" ]; then
    say "PRECHECK BLOCKED — Office Phase 0 made no changes; no receipt or rollback is required."
    exit "$PREFLIGHT_BLOCKED_EXIT"
  fi
  if [ -d "$OFFICE_RECEIPTS/$RUN_ID" ] && [ "$(read_phase_number "$OFFICE_RECEIPTS/$RUN_ID")" -ge 3 ]; then
    (set -e; office_rollback) || rollback_rc=$?
  fi
  if [ "$rollback_rc" -ne 0 ]; then
    say "[STOP] Office rollback could not complete safely; keep rescue open and use the receipt after quiescing affected processes."
  fi
  say "ROLLBACK REQUIRED/ATTEMPTED after Office interruption or failure (exit $rc; rollback $rollback_rc)"
  exit "$rc"
}

office_apply() {
  local root="$OFFICE_RECEIPTS/$RUN_ID"
  validate_commit_arg
  validate_run_id
  trap 'office_abort $?' ERR
  trap 'office_abort 130' INT TERM HUP
  office_preflight execute
  office_phase1_backup
  office_phase2_stage_roots
  office_phase3_convert_roots
  office_phase4_replace_brain
  office_phase5_activate_configs
  office_phase7_activate_bridge
  trap - ERR INT TERM HUP
  say "[OK] Office phases 0–5 and 7 complete; rescue connection must remain open through fresh connectivity acceptance."
}

office_dry_run() {
  validate_commit_arg
  office_preflight dry-run
  phase 1 "would create owner-only receipt and verified complete backups"
  phase 2 "would create and verify physical runtime stages"
  phase 3 "would atomically convert only .claude/.cursor/.gemini/.kiro; .codex check→repair only"
  phase 4 "would archive old dirty canonical Brain and activate exact packet clone"
  phase 5 "would activate only declared narrow ownership entries"
  phase 7 "would repin approval, canonical registration, and verify read-only bridge"
  phase 8 "would verify fresh fixed-address and alias connectivity"
  say "DRY-RUN PASS — Office topology inspected; no mutation attempted."
}

mac_preflight() {
  local execution="$1" path available_kb backup_kb required_kb path_kb
  phase 0 "MacBook preflight"
  for path in awk chmod cp df du find git grep mkdir mktemp mv node pgrep sed shasum ssh-keygen ssh-keyscan stat tar unlink xattr; do require_command "$path"; done
  [ -x /usr/bin/nc ] || fail "required command is unavailable: /usr/bin/nc"
  [ -x /usr/bin/ssh ] || fail "required command is unavailable: /usr/bin/ssh"
  [ "$(id -un)" = "Steve" ] || fail "top-level runner must be started by Steve on the MacBook"
  repo_exact_clean "$MAC_BRAIN" "MacBook local Brain"
  for path in .claude .cursor .gemini .kiro .codex; do
    if [ -L "/Users/Steve/$path" ]; then fail "MacBook /Users/Steve/$path must not be a whole-root symlink"; fi
    if [ -e "/Users/Steve/$path" ] && [ ! -d "/Users/Steve/$path" ]; then fail "MacBook /Users/Steve/$path has an unexpected type"; fi
  done
  if [ -S /Users/Steve/.codex/app-server-control/app-server-control.sock ] && ! command -v rg >/dev/null 2>&1; then
    fail "MacBook has a Codex control socket but no rg command for the canonical ownership check; close Codex and remove only the stale socket through the documented Codex manager before execution"
  fi
  check_port "$OFFICE_TB" || fail "MacBook cannot reach Office Thunderbolt SSH"
  check_port "$OFFICE_TS" || fail "MacBook cannot reach Office Tailscale SSH"
  ssh_explicit "$OFFICE_USER" "$OFFICE_TB" "$OFFICE_TB" /Users/Steve/.ssh/id_ed25519 /usr/bin/true >/dev/null
  ssh_explicit "$OFFICE_USER" "$OFFICE_TS" "$OFFICE_TS" /Users/Steve/.ssh/id_ed25519 /usr/bin/true >/dev/null
  say "[OK] MacBook→Office authentication over both fixed addresses"
  backup_kb=0
  for path in \
    /Users/Steve/.codex /Users/Steve/.gitconfig /Users/Steve/.ssh/config /Users/Steve/.ssh/known_hosts \
    /Users/Steve/.zshrc /Users/Steve/.zprofile /Users/Steve/.config/ghostty/config \
    /Users/Steve/.config/starship.toml /Users/Steve/.claude/CLAUDE.md \
    /Users/Steve/.claude/settings.json /Users/Steve/.claude/hooks /Users/Steve/.claude/agents \
    /Users/Steve/.claude/skills /Users/Steve/.claude/statusline-command.sh \
    /Users/Steve/.cursor/skills /Users/Steve/.gemini/GEMINI.md /Users/Steve/.kiro/steering; do
    if [ -e "$path" ] || [ -L "$path" ]; then
      path_kb="$(du -sk "$path" | awk '{print $1}')"
      backup_kb=$((backup_kb + path_kb))
    fi
  done
  available_kb="$(df -Pk /Users/Steve | awk 'NR == 2 {print $4}')"
  required_kb=$((backup_kb + 1048576))
  [ "$available_kb" -ge "$required_kb" ] || fail "MacBook free space is insufficient"
  if [ "$execution" = "execute" ]; then
    check_no_forbidden_processes "MacBook"
  else
    check_no_forbidden_processes "MacBook" || say "[PLAN] Close the reported MacBook processes before execute; dry-run remains read-only."
  fi
}

mac_snapshot_paths() {
  local root="$LOCAL_RECEIPT" label live
  umask 077
  [ ! -e "$root" ] || fail "MacBook receipt already exists: $root"
  mkdir -p "$root/backups/paths" "$root/backups/runtime" "$root/failed"
  chmod 0700 "$root" "$root/backups" "$root/failed"
  cat > "$root/receipt.md" <<EOF
# MacBook Host Activation Receipt

- Run ID: $RUN_ID
- Started UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Packet commit: $EXPECTED_COMMIT
- Backup/receipt root: $root
- Status: IN PROGRESS
EOF
  chmod 0600 "$root/receipt.md"
  record_host_metadata "macbook-before" /Users/Steve "$root/metadata-before.tsv"
  for label in gitconfig ssh-config known-hosts zshrc zprofile ghostty starship claude-CLAUDE claude-settings claude-hooks claude-agents claude-skills claude-statusline cursor-skills gemini-GEMINI kiro-steering; do
    case "$label" in
      gitconfig) live=/Users/Steve/.gitconfig ;;
      ssh-config) live=/Users/Steve/.ssh/config ;;
      known-hosts) live=/Users/Steve/.ssh/known_hosts ;;
      zshrc) live=/Users/Steve/.zshrc ;;
      zprofile) live=/Users/Steve/.zprofile ;;
      ghostty) live=/Users/Steve/.config/ghostty/config ;;
      starship) live=/Users/Steve/.config/starship.toml ;;
      claude-CLAUDE) live=/Users/Steve/.claude/CLAUDE.md ;;
      claude-settings) live=/Users/Steve/.claude/settings.json ;;
      claude-hooks) live=/Users/Steve/.claude/hooks ;;
      claude-agents) live=/Users/Steve/.claude/agents ;;
      claude-skills) live=/Users/Steve/.claude/skills ;;
      claude-statusline) live=/Users/Steve/.claude/statusline-command.sh ;;
      cursor-skills) live=/Users/Steve/.cursor/skills ;;
      gemini-GEMINI) live=/Users/Steve/.gemini/GEMINI.md ;;
      kiro-steering) live=/Users/Steve/.kiro/steering ;;
    esac
    copy_path_snapshot "$live" "$root/backups/paths/$label"
  done
  if [ -d /Users/Steve/.codex ]; then
    copy_tree /Users/Steve/.codex "$root/backups/runtime/codex"
    verify_tree_copy /Users/Steve/.codex "$root/backups/runtime/codex" "macbook-codex-backup" "$root/integrity.tsv"
  else
    : > "$root/backups/runtime/codex.missing"
  fi
  write_phase_state "$root" 1 "MACBOOK_BACKUP_VERIFIED"
}

ensure_link() {
  local source="$1" target="$2" backup_label="$3"
  [ -e "$source" ] || fail "managed source missing: $source"
  if [ -L "$target" ] && [ "$(resolve_link "$target")" = "$source" ]; then return 0; fi
  move_aside "$target" "$LOCAL_RECEIPT/failed/replaced-$backup_label"
  mkdir -p "$(dirname -- "$target")"
  ln -s "$source" "$target"
}

write_mac_include_root() {
  local kind="$1" target managed overlay staged marker
  case "$kind" in
    git)
      target=/Users/Steve/.gitconfig; managed="$MAC_BRAIN/operations/system-configs/git/gitconfig"; overlay=/Users/Steve/.gitconfig.local; marker="# Managed by Brain workstation config: Git INCLUDE root"; staged="$(mktemp /Users/Steve/.gitconfig.host-activation.XXXXXX)" ;;
    ssh)
      target=/Users/Steve/.ssh/config; managed="$MAC_BRAIN/operations/system-configs/ssh/config"; overlay=/Users/Steve/.ssh/config.local; marker="# Managed by Brain workstation config: SSH INCLUDE root"; staged="$(mktemp /Users/Steve/.ssh/.config.host-activation.XXXXXX)" ;;
    *) fail "unknown MacBook include kind" ;;
  esac
  {
    printf '%s\n' "$marker"
    if [ "$kind" = git ]; then printf '[include]\n\tpath = %s\n' "$managed"; [ ! -f "$overlay" ] || printf '[include]\n\tpath = %s\n' "$overlay"
    else printf 'Include %s\n' "$managed"; [ ! -f "$overlay" ] || printf 'Include %s\n' "$overlay"; fi
  } > "$staged"
  chmod 0600 "$staged"
  move_aside "$target" "$LOCAL_RECEIPT/failed/$kind-root-before-include"
  mv "$staged" "$target"
}

mac_phase6_activate() {
  local c="$MAC_BRAIN/operations/system-configs"
  phase 6 "MacBook narrow configuration activation"
  mac_snapshot_paths
  check_no_forbidden_processes "MacBook"
  write_mac_include_root git
  write_mac_include_root ssh
  ensure_hostkey_alias office-m4 "$OFFICE_TB" "$OFFICE_TS" /Users/Steve/.ssh/known_hosts
  ensure_link "$c/shell/.zshrc" /Users/Steve/.zshrc zshrc
  ensure_link "$c/shell/.zprofile" /Users/Steve/.zprofile zprofile
  ensure_link "$c/ghostty/config" /Users/Steve/.config/ghostty/config ghostty
  ensure_link "$c/starship/starship.toml" /Users/Steve/.config/starship.toml starship
  if [ -d /Users/Steve/.claude ]; then
    ensure_link "$c/claude/CLAUDE.md" /Users/Steve/.claude/CLAUDE.md claude-CLAUDE
    ensure_link "$c/claude/settings.json" /Users/Steve/.claude/settings.json claude-settings
    ensure_link "$c/claude/hooks" /Users/Steve/.claude/hooks claude-hooks
    ensure_link "$c/claude/agents" /Users/Steve/.claude/agents claude-agents
    ensure_link "$c/claude/skills" /Users/Steve/.claude/skills claude-skills
    ensure_link "$c/claude/statusline-command.sh" /Users/Steve/.claude/statusline-command.sh claude-statusline
  fi
  [ ! -d /Users/Steve/.cursor ] || ensure_link "$c/cursor/skills" /Users/Steve/.cursor/skills cursor-skills
  [ ! -d /Users/Steve/.gemini ] || ensure_link "$c/gemini/GEMINI.md" /Users/Steve/.gemini/GEMINI.md gemini-GEMINI
  [ ! -d /Users/Steve/.kiro ] || ensure_link "$c/kiro/steering" /Users/Steve/.kiro/steering kiro-steering
  if [ -d /Users/Steve/.codex ]; then
    BRAIN_REPO="$MAC_BRAIN" CODEX_HOME=/Users/Steve/.codex bash "$MAC_BRAIN/operations/scripts/codex-home-managed-root.sh" repair
    BRAIN_REPO="$MAC_BRAIN" CODEX_HOME=/Users/Steve/.codex bash "$MAC_BRAIN/operations/scripts/codex-home-managed-root.sh" check
  fi
  if find /Users/Steve/.claude /Users/Steve/.cursor /Users/Steve/.gemini /Users/Steve/.kiro /Users/Steve/.codex /Users/Steve/.config \
    -type l -exec readlink {} \; 2>/dev/null | grep -Eq '/Volumes/Office|brain-next|brain-host-activation'; then
    fail "MacBook managed targets still reference /Volumes/Office or a noncanonical Brain path"
  fi
  write_phase_state "$LOCAL_RECEIPT" 6 "MACBOOK_CONFIG_ACTIVE"
}

mac_rollback() {
  local root="$MAC_RECEIPTS/$RUN_ID" label live phase_number failed="$MAC_RECEIPTS/$RUN_ID/failed/rollback-$(date -u +%Y%m%dT%H%M%SZ)"
  [ -d "$root" ] || return 0
  phase_number="$(read_phase_number "$root")"
  if [ "$phase_number" = 0 ]; then
    say "[OK] MacBook run $RUN_ID is already rolled back; no paths changed."
    return 0
  fi
  check_no_forbidden_processes "MacBook"
  mkdir -p "$failed"
  for label in gitconfig ssh-config known-hosts zshrc zprofile ghostty starship claude-CLAUDE claude-settings claude-hooks claude-agents claude-skills claude-statusline cursor-skills gemini-GEMINI kiro-steering; do
    case "$label" in
      gitconfig) live=/Users/Steve/.gitconfig ;;
      ssh-config) live=/Users/Steve/.ssh/config ;;
      known-hosts) live=/Users/Steve/.ssh/known_hosts ;;
      zshrc) live=/Users/Steve/.zshrc ;;
      zprofile) live=/Users/Steve/.zprofile ;;
      ghostty) live=/Users/Steve/.config/ghostty/config ;;
      starship) live=/Users/Steve/.config/starship.toml ;;
      claude-CLAUDE) live=/Users/Steve/.claude/CLAUDE.md ;;
      claude-settings) live=/Users/Steve/.claude/settings.json ;;
      claude-hooks) live=/Users/Steve/.claude/hooks ;;
      claude-agents) live=/Users/Steve/.claude/agents ;;
      claude-skills) live=/Users/Steve/.claude/skills ;;
      claude-statusline) live=/Users/Steve/.claude/statusline-command.sh ;;
      cursor-skills) live=/Users/Steve/.cursor/skills ;;
      gemini-GEMINI) live=/Users/Steve/.gemini/GEMINI.md ;;
      kiro-steering) live=/Users/Steve/.kiro/steering ;;
    esac
    if [ -e "$root/backups/paths/$label" ] || [ -L "$root/backups/paths/$label" ] || [ -e "$root/backups/paths/$label.missing" ]; then
      restore_snapshot "$live" "$root/backups/paths/$label" "$failed/$label"
    fi
  done
  if [ -d "$root/backups/runtime/codex" ]; then
    move_aside /Users/Steve/.codex "$failed/codex-after-activation"
    copy_tree "$root/backups/runtime/codex" /Users/Steve/.codex
  elif [ -e "$root/backups/runtime/codex.missing" ]; then
    move_aside /Users/Steve/.codex "$failed/codex-created-by-activation"
  fi
  write_phase_state "$root" 0 "ROLLED_BACK"
  say "ROLLBACK COMPLETE — MacBook originals restored; failed/new artifacts preserved at $failed"
}

open_rescue() {
  RESCUE_SOCKET="/tmp/brain-host-activation-$RUN_ID.sock"
  [ ! -e "$RESCUE_SOCKET" ] || fail "rescue socket already exists: $RESCUE_SOCKET"
  /usr/bin/ssh -A -M -S "$RESCUE_SOCKET" -fN \
    -o BatchMode=yes -o ConnectTimeout=7 -o StrictHostKeyChecking=yes -o UpdateHostKeys=no -o IdentitiesOnly=yes \
    -o HostKeyAlias="$OFFICE_TB" -i /Users/Steve/.ssh/id_ed25519 "$OFFICE_USER@$OFFICE_TB"
  /usr/bin/ssh -S "$RESCUE_SOCKET" -O check "$OFFICE_USER@$OFFICE_TB" >/dev/null
  say "[RESCUE] open at $RESCUE_SOCKET — DO NOT CLOSE until fresh post-change SSH succeeds."
}

rescue_remote() {
  /usr/bin/ssh -A -S "$RESCUE_SOCKET" -o ControlMaster=no "$OFFICE_USER@$OFFICE_TB" "$@"
}

stream_office_worker() {
  local subcommand="$1"
  rescue_remote /bin/bash -s -- "$subcommand" --expected-commit "$EXPECTED_COMMIT" --run-id "$RUN_ID" < "$SELF"
}

stream_office_rollback() {
  rescue_remote /bin/bash -s -- office-rollback --run-id "$RUN_ID" < "$SELF"
}

fresh_connectivity() {
  phase 8 "fresh bidirectional connectivity acceptance"
  ssh_explicit "$OFFICE_USER" "$OFFICE_TB" office-m4 /Users/Steve/.ssh/id_ed25519 /usr/bin/true >/dev/null
  ssh_explicit "$OFFICE_USER" "$OFFICE_TS" office-m4 /Users/Steve/.ssh/id_ed25519 /usr/bin/true >/dev/null
  /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=7 -o UpdateHostKeys=no office /usr/bin/true >/dev/null
  ssh -G office 2>/dev/null | grep -Eq '^hostkeyalias office-m4$' || fail "office alias lost HostKeyAlias"
  stream_office_worker office-connectivity
  receipt_note "$LOCAL_RECEIPT" "- MacBook→Office: Thunderbolt PASS; Tailscale PASS; office alias PASS"
  say "[OK] fresh SSH passed both fixed routes in both directions and all aliases"
}

prompt_acceptance() {
  local item answer
  phase 9 "manual application acceptance"
  APPLICATIONS_MAY_BE_RUNNING=1
  cat >&2 <<'EOF'
Reopen one item at a time. Confirm launch, existing auth/session/history,
settings, managed instructions/skills, and MCP/provider behavior where relevant.
Type PASS only after each item is verified.
EOF
  for item in "Claude" "Cursor" "Gemini / Antigravity" "Kiro" "Codex / ChatGPT (including Remote SSH)" "shell" "Ghostty"; do
    printf '%s: ' "$item" >&2
    IFS= read -r answer
    if [ "$answer" != "PASS" ]; then
      receipt_note "$LOCAL_RECEIPT" "- Application acceptance: $item FAILED/DECLINED"
      return 1
    fi
    receipt_note "$LOCAL_RECEIPT" "- Application acceptance: $item PASS"
  done
  cat >&2 <<'EOF'
If a safe authenticated read-only canonical Save-to-Mind export/readback is
available, compare its canonical structure/hash now without invoking a webhook.
Type PASS after comparison, or DEFERRED when read-only access is unavailable.
EOF
  printf 'Save-to-Mind read-only canonical readback: ' >&2
  IFS= read -r answer
  case "$answer" in
    PASS) receipt_note "$LOCAL_RECEIPT" "- Save-to-Mind read-only canonical readback: PASS" ;;
    DEFERRED) receipt_note "$LOCAL_RECEIPT" "- Save-to-Mind read-only canonical readback: DEFERRED; no safe authenticated read-only export available" ;;
    *)
      receipt_note "$LOCAL_RECEIPT" "- Save-to-Mind read-only canonical readback: FAILED/DECLINED"
      return 1
      ;;
  esac
}

close_rescue() {
  if [ -n "$RESCUE_SOCKET" ] && [ -S "$RESCUE_SOCKET" ]; then
    /usr/bin/ssh -S "$RESCUE_SOCKET" -O exit "$OFFICE_USER@$OFFICE_TB" >/dev/null 2>&1 || true
  fi
}

mac_abort() {
  local rc="$1" office_ssh_rc=0 mac_rollback_rc=0 office_rollback_rc=0
  trap - ERR INT TERM HUP
  set +e
  if [ "$APPLICATIONS_MAY_BE_RUNNING" -eq 1 ]; then
    say "[STOP] Applications may have been reopened. No filesystem rollback was attempted while they may be writing."
    say "[STOP] Close the Phase 9 applications, keep rescue open at $RESCUE_SOCKET, then run the documented rollback command for $RUN_ID."
    exit "$rc"
  fi
  say "[FAIL] activation interrupted or failed; restoring SSH first and rolling back"
  (set -e; rescue_remote /bin/bash -s -- office-restore-ssh --run-id "$RUN_ID" < "$SELF") || office_ssh_rc=$?
  (set -e; mac_rollback) || mac_rollback_rc=$?
  (set -e; stream_office_rollback) || office_rollback_rc=$?
  say "ROLLBACK COMPLETE/ATTEMPTED (exit $rc; Office SSH $office_ssh_rc; MacBook $mac_rollback_rc; Office $office_rollback_rc)."
  say "Rescue remains at $RESCUE_SOCKET if any rollback check failed."
  exit "$rc"
}

mac_execute() {
  local answer office_rc=0
  validate_commit_arg
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  LOCAL_RECEIPT="$MAC_RECEIPTS/$RUN_ID"
  mac_preflight execute
  open_rescue
  trap 'mac_abort $?' ERR
  trap 'mac_abort 130' INT TERM HUP
  stream_office_worker office-apply || office_rc=$?
  if [ "$office_rc" -eq "$PREFLIGHT_BLOCKED_EXIT" ]; then
    trap - ERR INT TERM HUP
    close_rescue
    say "PRECHECK BLOCKED — no live state changed on either host; rescue connection closed."
    exit 1
  fi
  if [ "$office_rc" -ne 0 ]; then
    mac_abort "$office_rc"
  fi
  mac_phase6_activate
  fresh_connectivity
  if ! prompt_acceptance; then
    say "Close the reopened affected applications, then type ROLLBACK to restore the pre-migration state."
    IFS= read -r answer
    [ "$answer" = "ROLLBACK" ] || fail "application acceptance failed; rescue left open for manual rollback"
    mac_rollback
    stream_office_rollback
    trap - ERR INT TERM HUP
    fail "application acceptance failed; rollback completed"
  fi
  trap - ERR INT TERM HUP
  phase 10 "final receipt"
  record_host_metadata "macbook-after" /Users/Steve "$LOCAL_RECEIPT/metadata-after.tsv"
  write_phase_state "$LOCAL_RECEIPT" 10 "PASS"
  receipt_note "$LOCAL_RECEIPT" "- Completed UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  receipt_note "$LOCAL_RECEIPT" "- Final canonical Brain: $EXPECTED_COMMIT"
  receipt_note "$LOCAL_RECEIPT" "- Final MacBook Brain: $EXPECTED_COMMIT"
  receipt_note "$LOCAL_RECEIPT" "- Final Mind: $MIND_COMMIT"
  receipt_note "$LOCAL_RECEIPT" "- Backups intentionally retained; cleanup and model/app deletion remain deferred"
  rescue_remote /bin/bash -s -- office-finalize --run-id "$RUN_ID" --expected-commit "$EXPECTED_COMMIT" < "$SELF"
  close_rescue
  say "PASS — HOST ACTIVATION COMPLETE"
  say "MacBook receipt: $LOCAL_RECEIPT/receipt.md"
  say "Office receipt: $OFFICE_RECEIPTS/$RUN_ID/receipt.md"
}

mac_dry_run() {
  validate_commit_arg
  mac_preflight dry-run
  ssh_explicit "$OFFICE_USER" "$OFFICE_TB" "$OFFICE_TB" /Users/Steve/.ssh/id_ed25519 /bin/bash -s -- office-dry-run --expected-commit "$EXPECTED_COMMIT" < "$SELF"
  phase 6 "would back up and repair only declared MacBook narrow entries from local Brain"
  phase 8 "would hold rescue SSH and require fresh direct/fallback/alias acceptance"
  phase 9 "would require one-at-a-time manual application PASS responses"
  phase 10 "would emit owner-only non-secret receipts and retain every backup"
  say "DRY-RUN PASS — current two-host topology inspected; no mutation attempted."
}

mac_top_level_rollback() {
  validate_run_id
  LOCAL_RECEIPT="$MAC_RECEIPTS/$RUN_ID"
  [ "$(id -un)" = "Steve" ] || fail "rollback must be started by Steve on the MacBook"
  check_no_forbidden_processes "MacBook"
  check_port "$OFFICE_TB" || fail "MacBook cannot reach Office Thunderbolt SSH for rollback"
  ssh_explicit "$OFFICE_USER" "$OFFICE_TB" "$OFFICE_TB" /Users/Steve/.ssh/id_ed25519 /usr/bin/true >/dev/null
  open_rescue
  mac_rollback
  stream_office_rollback
  close_rescue
}

office_finalize() {
  local root="$OFFICE_RECEIPTS/$RUN_ID"
  validate_commit_arg
  validate_run_id
  repo_exact_clean "$OFFICE_BRAIN" "final Office canonical Brain"
  [ "$(git -C "$OFFICE_MIND" rev-parse HEAD)" = "$MIND_COMMIT" ] || fail "final Mind HEAD changed"
  record_host_metadata "office-after" /Users/Office "$root/metadata-after.tsv"
  write_phase_state "$root" 10 "PASS"
  receipt_note "$root" "- Completed UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  receipt_note "$root" "- Final canonical Brain: $EXPECTED_COMMIT"
  receipt_note "$root" "- Final Mind: $MIND_COMMIT"
  receipt_note "$root" "- Backups/archive intentionally retained; cleanup deferred"
}

fixture_test() {
  [ "${HOST_ACTIVATION_TEST_MODE:-0}" = 1 ] || fail "fixture mode is test-only"
  local root="$1" root_parent source live receipt digest_before
  root_parent="$(cd -P -- "$(dirname -- "$root")" && pwd)"
  root="$root_parent/$(basename -- "$root")"
  case "$root" in /private/tmp/host-activation-test.*) ;; *) fail "fixture root must be a dedicated host-activation-test directory under /private/tmp" ;; esac
  mkdir -p "$root/source" "$root/receipt/staging/runtime" "$root/receipt/original-paths" "$root/receipt/failed"
  source="$root/source"
  live="$root/home-root"
  receipt="$root/receipt"
  printf 'session-state\n' > "$source/session.db"
  chmod 0640 "$source/session.db"
  xattr -w com.brain.host-activation-test fixture-xattr "$source/session.db"
  mkdir -p "$source/history"
  printf 'history-state\n' > "$source/history/entry"
  ln -s "$source" "$live"
  copy_tree "$source" "$receipt/staging/runtime/app"
  digest_before="$(tree_digest "$source")"
  mv "$live" "$receipt/original-paths/app.symlink"
  mv "$receipt/staging/runtime/app" "$live"
  [ -d "$live" ] && [ ! -L "$live" ] || fail "fixture activation did not produce a physical root"
  [ "$(tree_digest "$live")" = "$digest_before" ] || fail "fixture activation digest changed"
  move_aside "$live" "$receipt/failed/app-physical"
  mv "$receipt/original-paths/app.symlink" "$live"
  [ -L "$live" ] && [ "$(resolve_link "$live")" = "$(cd -P -- "$source" && pwd)" ] || fail "fixture rollback did not restore the original symlink"

  mkdir -p "$root/failure/source" "$root/failure/receipt/original-paths"
  printf 'keep-me\n' > "$root/failure/source/state"
  ln -s "$root/failure/source" "$root/failure/live"
  mv "$root/failure/live" "$root/failure/receipt/original-paths/app.symlink"
  if mv "$root/failure/missing-stage" "$root/failure/live" 2>/dev/null; then fail "fixture switch failure was not simulated"; fi
  mv "$root/failure/receipt/original-paths/app.symlink" "$root/failure/live"
  [ -L "$root/failure/live" ] || fail "switch-failure rollback did not restore original symlink"
  [ "$(cat "$root/failure/live/state")" = keep-me ] || fail "switch-failure rollback lost state"

  mkdir -p "$root/ssh-rollback"
  printf 'original-ssh-config\n' > "$root/ssh-rollback/snapshot"
  printf 'changed-ssh-config\n' > "$root/ssh-rollback/live"
  restore_snapshot_copy "$root/ssh-rollback/live" "$root/ssh-rollback/snapshot" "$root/ssh-rollback/failed-fresh-connection"
  [ "$(cat "$root/ssh-rollback/live")" = original-ssh-config ] || fail "immediate SSH restore did not restore the snapshot"
  [ -f "$root/ssh-rollback/snapshot" ] || fail "immediate SSH restore consumed the full-rollback snapshot"
  printf 'changed-again\n' > "$root/ssh-rollback/live"
  restore_snapshot "$root/ssh-rollback/live" "$root/ssh-rollback/snapshot" "$root/ssh-rollback/failed-full-rollback"
  [ "$(cat "$root/ssh-rollback/live")" = original-ssh-config ] || fail "full rollback could not reuse the SSH snapshot"
  say "fixture rollback tests passed"
}

parse_args "$@"
case "$ACTION" in
  dry-run) mac_dry_run ;;
  execute) mac_execute ;;
  rollback) mac_top_level_rollback ;;
  office-dry-run) office_dry_run ;;
  office-apply) office_apply ;;
  office-rollback) office_rollback ;;
  office-restore-ssh) validate_run_id; office_restore_ssh_only ;;
  office-connectivity) validate_run_id; office_connectivity_acceptance ;;
  office-finalize) office_finalize ;;
  __fixture-test)
    [ -n "$TEST_FIXTURE_ROOT" ] || fail "fixture root required"
    fixture_test "$TEST_FIXTURE_ROOT"
    ;;
  -h|--help|help) usage ;;
  *) usage; fail "unknown action: $ACTION" ;;
esac
