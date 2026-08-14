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
readonly NO_MUTATION_EXIT=20
readonly ROLLBACK_FAILED_EXIT=21
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

phase_is_no_mutation() { [ "$1" -lt 3 ]; }

normalize_failure_exit() {
  if [ "$1" -eq "$NO_MUTATION_EXIT" ]; then printf '1\n'; else printf '%s\n' "$1"; fi
}

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
  for name in \
    ChatGPT Codex codex codex-app-server codex-code-mode-host app-server \
    SkyComputerUseClient SkyComputerUseService Claude claude Cursor cursor Gemini gemini \
    Antigravity antigravity Kiro kiro Ghostty node-repl node_repl bare-modifier-monitor; do
    if pgrep -x "$name" >/dev/null 2>&1; then
      say "[BLOCKED] $label still has an affected process named $name"
      found=1
    fi
  done
  if pgrep -f '/(Codex|ChatGPT|Claude|Cursor|Gemini|Antigravity|Kiro|Ghostty)( \([^/]+\))?\.app/|/Applications/ChatGPT\.app/|codex[^ ]*.*(app-server|code-mode-host)|SkyComputerUse(Client|Service)|node[_-]?repl|bare-modifier-monitor' >/dev/null 2>&1; then
    say "[BLOCKED] $label still has an affected application/background process"
    found=1
  fi
  [ "$found" -eq 0 ] || return 1
  say "[OK] $label affected applications are quiescent"
}

# A normally quit desktop app can leave detached helpers behind. These exact
# helpers are known to touch migration-owned runtime state and are safe to ask
# to terminate only after launchd has adopted them (PPID 1); children of a
# still-running application are never signaled. ChatGPTHelper is deliberately
# excluded: it holds no migration-owned files and may persist independently of
# the ChatGPT UI. TERM is the only signal used. Failure to exit remains a hard
# preflight block.
quiesce_orphan_application_helpers() {
  local label="$1" name pid parent attempt remaining signaled=0
  for name in SkyComputerUseClient SkyComputerUseService codex-code-mode-host node_repl bare-modifier-monitor; do
    while IFS= read -r pid; do
      case "$pid" in ''|*[!0-9]*) continue ;; esac
      parent="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')"
      [ "$parent" = 1 ] || continue
      say "[QUIESCE] requesting graceful exit from detached $label helper $name"
      if ! kill -TERM "$pid"; then
        kill -0 "$pid" 2>/dev/null || continue
        return 1
      fi
      signaled=1
    done < <(pgrep -x "$name" 2>/dev/null || true)
  done
  [ "$signaled" -eq 1 ] || return 0
  for attempt in 1 2 3 4 5; do
    remaining=0
    for name in SkyComputerUseClient SkyComputerUseService codex-code-mode-host node_repl bare-modifier-monitor; do
      while IFS= read -r pid; do
        case "$pid" in ''|*[!0-9]*) continue ;; esac
        parent="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')"
        [ "$parent" != 1 ] || remaining=1
      done < <(pgrep -x "$name" 2>/dev/null || true)
    done
    [ "$remaining" -eq 1 ] || { say "[OK] detached $label helpers exited cleanly"; return 0; }
    sleep 1
  done
  fail "detached $label application helper did not exit after TERM; no force signal was used"
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

validate_hostkey_alias_inputs() {
  local alias="$1" address_one="$2" address_two="$3" known_hosts="$4" trusted_one trusted_two scanned_one scanned_two alias_key
  [ -f "$known_hosts" ] || { fail "known_hosts is missing: $known_hosts"; return 1; }
  trusted_one="$(trusted_ed25519_key "$address_one" "$known_hosts")"
  trusted_two="$(trusted_ed25519_key "$address_two" "$known_hosts")"
  scanned_one="$(scanned_ed25519_key "$address_one")"
  scanned_two="$(scanned_ed25519_key "$address_two")"
  [ -n "$trusted_one" ] && [ "$trusted_one" = "$trusted_two" ] || {
    fail "fixed-address trusted ED25519 keys disagree or are missing for $alias"
    return 1
  }
  [ "$trusted_one" = "$scanned_one" ] && [ "$trusted_one" = "$scanned_two" ] || {
    fail "live ED25519 key does not match both already-trusted fixed addresses for $alias"
    return 1
  }
  alias_key="$(trusted_ed25519_key "$alias" "$known_hosts")"
  if [ -n "$alias_key" ]; then
    [ "$alias_key" = "$trusted_one" ] || {
      fail "existing HostKeyAlias entry has an unexpected ED25519 key: $alias"
      return 1
    }
  fi
  say "[OK] fixed-address and existing HostKeyAlias keys agree for $alias"
}

validate_json_object_file() {
  local file="$1" label="$2"
  [ -f "$file" ] && [ ! -L "$file" ] || {
    fail "$label must be a physical JSON file: $file"
    return 1
  }
  JSON_FILE="$file" node -e '
    const fs = require("node:fs");
    const value = JSON.parse(fs.readFileSync(process.env.JSON_FILE, "utf8"));
    if (value === null || Array.isArray(value) || typeof value !== "object") process.exit(1);
  ' >/dev/null 2>&1 || {
    fail "$label is not a valid JSON object"
    return 1
  }
  say "[OK] $label is a valid physical JSON object"
}

ensure_hostkey_alias() {
  local alias="$1" address_one="$2" address_two="$3" known_hosts="$4" trusted_one alias_key staged
  validate_hostkey_alias_inputs "$alias" "$address_one" "$address_two" "$known_hosts" || return 1
  trusted_one="$(trusted_ed25519_key "$address_one" "$known_hosts")"
  alias_key="$(trusted_ed25519_key "$alias" "$known_hosts")"
  if [ -n "$alias_key" ]; then
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
  local label="$1" path="$2" receipt="$3" kind target="-" mode="-" uid="-" gid="-" bytes=0 files=0 xattrs=0 entry
  kind="$(path_kind "$path")"
  if [ "$kind" != "missing" ]; then
    mode="$(stat -f '%Lp' "$path" 2>/dev/null || printf '?')"
    uid="$(stat -f '%u' "$path" 2>/dev/null || printf '?')"
    gid="$(stat -f '%g' "$path" 2>/dev/null || printf '?')"
    bytes="$(du -sk "$path" 2>/dev/null | awk '{print $1 * 1024}' || printf '0')"
    files="$(find -L "$path" -type f 2>/dev/null | wc -l | tr -d ' ')"
    if command -v xattr >/dev/null 2>&1; then
      # Unix sockets are process-owned endpoints, not persistent state. macOS
      # xattr -r exits nonzero when it encounters one, so enumerate the same
      # persistent object set that copy_tree/tree_digest verify.
      if ! xattrs="$(
        find "$path" ! -type s -print0 |
        while IFS= read -r -d '' entry; do
          xattr -s "$entry" 2>/dev/null || exit 1
        done |
        wc -l | tr -d ' '
      )"; then
        fail "metadata xattr scan failed: $path"
        return 1
      fi
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
  local source="$1" destination="$2" unsupported
  if [ ! -d "$source" ]; then fail "copy source is not a directory: $source"; return 1; fi
  if [ -e "$destination" ] || [ -L "$destination" ]; then fail "copy destination already exists: $destination"; return 1; fi
  unsupported="$(find "$source" ! -type f ! -type d ! -type l ! -type s -print -quit)"
  if [ -n "$unsupported" ]; then
    fail "copy source contains an unsupported non-file object"
    return 1
  fi
  if [ "${HOST_ACTIVATION_TEST_MODE:-0}" = 1 ] && [ "${HOST_ACTIVATION_TEST_COPY_FAILURE:-0}" = 1 ]; then
    case "$source" in
      /private/tmp/host-activation-test.*)
        mkdir -p "$destination"
        printf 'simulated-partial-copy\n' > "$destination/partial"
        return 1
        ;;
      *) fail "test copy-failure hook refused a non-fixture path"; return 1 ;;
    esac
  fi
  mkdir -p "$destination"
  (
    cd -- "$source"
    find . ! -type s -print0 | tar --null --no-recursion -cf - -T -
  ) | tar -C "$destination" -xpf -
}

# Content-address every regular file and symlink target plus portable,
# non-secret metadata. Unprivileged macOS archive extraction cannot preserve a
# source group the owner is not a member of. The known portable case is a plain
# 0644 regular file, where group and other access are identical; retain the GID
# for every other object and mode. Directory inode size/mtime is not content
# metadata, and com.apple.provenance intentionally changes on copies. All other
# listed attributes remain verified. Sort the private stream and emit only the
# final SHA-256; no file content or path is recorded in receipts.
tree_digest() {
  local root="$1"
  (
    cd -- "$root"
    find . -type f -exec shasum -a 256 {} + || exit 1
    find . -type l -exec sh -c 'for p do printf "L %s " "$p"; readlink "$p" || exit 1; done' sh {} + || exit 1
    find . -type f -links +1 -exec stat -f '%d|%i|%N' {} + |
      LC_ALL=C sort -t '|' -k1,1 -k2,2n -k3,3 |
      awk -F '|' '
        function emit() { if (count > 1) print "H " members }
        {
          key=$1 "|" $2
          path=$3
          for (i=4; i<=NF; i++) path=path "|" $i
          if (NR > 1 && key != previous) { emit(); members=""; count=0 }
          members=(count == 0 ? path : members "|" path)
          count++
          previous=key
        }
        END { emit() }
      ' || exit 1
    find . -type f -exec stat -f '%u|%g|%Lp|%z|%m|%N' {} + |
      awk -F '|' '{path=$6; for(i=7;i<=NF;i++) path=path "|" $i; gid=($3 == "644" ? "-" : $2); print "F " path "|" $1 "|" gid "|" $3 "|" $4 "|" $5}' || exit 1
    find . -type l -exec stat -f '%u|%g|%Lp|%z|%m|%N' {} + |
      awk -F '|' '{path=$6; for(i=7;i<=NF;i++) path=path "|" $i; print "S " path "|" $1 "|" $2 "|" $3 "|" $4 "|" $5}' || exit 1
    find . -type d -exec stat -f '%u|%g|%Lp|%N' {} + |
      awk -F '|' '{path=$4; for(i=5;i<=NF;i++) path=path "|" $i; print "D " path "|" $1 "|" $2 "|" $3}' || exit 1
    # Batch ACL reads. Invoking ls once per runtime file makes large Claude and
    # Codex roots take hours; BSD ls emits each ACL entry directly after its
    # fixed-field -T path row, so attach it to that path in one streaming pass.
    find . ! -type s -exec /bin/ls -ldeT {} + |
      LC_ALL=C awk '
        /^[[:space:]]*[0-9]+:/ { print "A " current "|" $0; next }
        {
          current=$10
          for (i=11; i<=NF && $i != "->"; i++) current=current " " $i
        }
      ' || exit 1
    find . ! -type s -exec xattr -lxs {} + 2>/dev/null |
      awk '
        /^[^[:space:]].*: [^:]+:$/ {
          keep=($0 !~ /: com\.apple\.provenance:$/)
          if (keep) print "X " $0
          next
        }
        keep { print }
      ' || exit 1
  ) | LC_ALL=C sort | shasum -a 256 | awk '{print $1}'
}

path_digest() {
  local path="$1" kind attribute acl
  kind="$(path_kind "$path")"
  case "$kind" in
    missing) printf 'missing\n' ;;
    directory) tree_digest "$path" ;;
    file)
      {
        printf 'F|'
        shasum -a 256 "$path" | awk '{print $1}'
        stat -f 'M|%u|%g|%Lp|%z|%m' "$path"
        acl="$(/bin/ls -lde "$path" | sed -n '2,$p')" || return 1
        if [ -n "$acl" ]; then
          printf 'A|'
          printf '%s' "$acl" | shasum -a 256 | awk '{print $1}'
        fi
        xattr -s "$path" 2>/dev/null | while IFS= read -r attribute; do
          [ "$attribute" = com.apple.provenance ] && continue
          printf 'X|%s|' "$attribute"
          xattr -spx "$attribute" "$path" 2>/dev/null || return 1
        done || return 1
      } | LC_ALL=C sort | shasum -a 256 | awk '{print $1}'
      ;;
    symlink)
      {
        printf 'L|%s\n' "$(readlink "$path")"
        stat -f 'M|%u|%g|%Lp|%z|%m' "$path"
      } | LC_ALL=C sort | shasum -a 256 | awk '{print $1}'
      ;;
    *) fail "unsupported snapshot path type: $path"; return 1 ;;
  esac
}

snapshot_path_digest() {
  local snapshot="$1"
  if [ -e "$snapshot.missing" ]; then
    [ ! -e "$snapshot" ] && [ ! -L "$snapshot" ] || { fail "snapshot has both missing and materialized forms: $snapshot"; return 1; }
    printf 'missing\n'
  else
    path_digest "$snapshot"
  fi
}

verify_tree_copy() {
  local source="$1" destination="$2" label="$3" receipt="$4" source_digest destination_digest
  source_digest="$(tree_digest "$source")"
  destination_digest="$(tree_digest "$destination")"
  [ "$source_digest" = "$destination_digest" ] || fail "$label content digest mismatch"
  printf '%s\t%s\t%s\n' "$label" "$source_digest" "verified" >> "$receipt"
  say "[OK] verified $label (SHA-256 $source_digest)"
}

# Capture a source only when it remains byte/metadata-identical for the whole
# operation. A plain copy-then-compare can report a destination mismatch but
# cannot distinguish a bad copy from a writer changing the source mid-copy.
# Keep every rejected attempt for diagnosis; never delete or overwrite it.
stable_copy_tree() {
  local source="$1" destination="$2" label="$3" receipt="$4"
  local attempt before after copied rejected
  for attempt in 1 2; do
    before="$(tree_digest "$source")" || return 1
    if ! copy_tree "$source" "$destination"; then
      if [ -e "$destination" ] || [ -L "$destination" ]; then
        rejected="$destination.copy-failure-attempt-$attempt"
        mv "$destination" "$rejected"
        fail "$label copy failed; partial attempt preserved at $rejected"
      fi
      return 1
    fi
    if [ "${HOST_ACTIVATION_TEST_MODE:-0}" = 1 ] && [ "${HOST_ACTIVATION_TEST_MUTATE_SOURCE:-0}" = 1 ]; then
      case "$source" in
        /private/tmp/host-activation-test.*) printf 'simulated-writer\n' >> "$source/state" ;;
        *) fail "test source-mutation hook refused a non-fixture path"; return 1 ;;
      esac
    fi
    after="$(tree_digest "$source")" || return 1
    copied="$(tree_digest "$destination")" || return 1
    if [ "$before" = "$after" ] && [ "$after" = "$copied" ]; then
      printf '%s\t%s\t%s\n' "$label" "$copied" "stable-source-verified" >> "$receipt"
      say "[OK] verified stable $label (SHA-256 $copied)"
      return 0
    fi
    rejected="$destination.unstable-attempt-$attempt"
    mv "$destination" "$rejected"
    if [ "$before" != "$after" ]; then
      say "[RETRY] $label source changed during snapshot attempt $attempt; rejected copy preserved at $rejected"
    else
      fail "$label copy fidelity mismatch; rejected copy preserved at $rejected"
      return 1
    fi
  done
  fail "$label source changed during both snapshot attempts; close every writer and retry with the retained receipt"
}

verify_stable_tree_against_snapshot() {
  local source="$1" snapshot="$2" label="$3" receipt="$4" before after saved
  before="$(tree_digest "$source")" || return 1
  saved="$(tree_digest "$snapshot")" || return 1
  after="$(tree_digest "$source")" || return 1
  [ "$before" = "$after" ] || { fail "$label source changed during the readiness gate"; return 1; }
  [ "$after" = "$saved" ] || { fail "$label no longer matches its verified snapshot"; return 1; }
  printf '%s\t%s\t%s\n' "$label" "$saved" "stable-readiness-verified" >> "$receipt"
  say "[OK] verified stable $label (SHA-256 $saved)"
}

# Query a Codex SQLite database without ever opening the live or retained copy.
# A WAL-mode database with no current -wal/-shm files can fail under
# SQLite's direct read-only mode because it still wants shared-memory setup. Copy the
# complete database family to an owner-only scratch directory, prove the source
# stayed stable and the copy is exact, then allow SQLite to create any ephemeral
# sidecars only in that disposable scratch directory.
codex_sqlite_set_digest() {
  local root="$1" suffix path
  for suffix in '' -wal -shm -journal; do
    path="$root/state_5.sqlite$suffix"
    if [ -L "$path" ]; then
      fail "Codex SQLite component must not be a symlink: $path"
      return 1
    elif [ -f "$path" ]; then
      printf '%s\t' "state_5.sqlite$suffix"
      shasum -a 256 "$path" | awk '{print $1}'
    elif [ -e "$path" ]; then
      fail "Codex SQLite component has an unsupported type: $path"
      return 1
    else
      printf '%s\tmissing\n' "state_5.sqlite$suffix"
    fi
  done
}

codex_sqlite_query() {
  local root="$1" query="$2" label="$3" setup_query="${4:-}" db="$root/state_5.sqlite"
  local scratch before after copied suffix source destination rc=0
  [ -f "$db" ] && [ ! -L "$db" ] || { fail "$label database is not a regular physical file"; return 1; }
  scratch="$(mktemp -d "/tmp/brain-host-activation-sqlite.XXXXXX")" || return 1
  chmod 0700 "$scratch" || rc=1
  before="$(codex_sqlite_set_digest "$root")" || rc=1
  if [ "$rc" -eq 0 ]; then
    for suffix in '' -wal -shm -journal; do
      source="$root/state_5.sqlite$suffix"
      destination="$scratch/state_5.sqlite$suffix"
      [ ! -f "$source" ] || cp -p "$source" "$destination" || { rc=1; break; }
    done
  fi
  after="$(codex_sqlite_set_digest "$root")" || rc=1
  copied="$(codex_sqlite_set_digest "$scratch")" || rc=1
  if [ "$rc" -eq 0 ] && { [ "$before" != "$after" ] || [ "$after" != "$copied" ]; }; then
    rc=1
  fi
  if [ "$rc" -eq 0 ]; then
    chmod u+rw "$scratch"/state_5.sqlite* 2>/dev/null || true
    if [ -n "$setup_query" ]; then
      sqlite3 "$scratch/state_5.sqlite" "$setup_query" "$query" > "$scratch/query.out" 2> "$scratch/query.err" || rc=1
    else
      sqlite3 "$scratch/state_5.sqlite" "$query" > "$scratch/query.out" 2> "$scratch/query.err" || rc=1
    fi
  fi
  if [ "$rc" -eq 0 ]; then
    cat "$scratch/query.out" || rc=1
  fi
  find "$scratch" -depth -delete >/dev/null 2>&1 || rc=1
  if [ "$rc" -ne 0 ]; then
    fail "$label could not produce a stable private SQLite verification copy"
    return 1
  fi
}

codex_sqlite_normalized_dump() {
  local root="$1" legacy_root="$2" final_root="$3" label="$4" has_threads setup_query=""
  case "$legacy_root$final_root" in *"'"*|*$'\n'*) fail "$label root cannot be represented safely in SQLite normalization"; return 1 ;; esac
  has_threads="$(codex_sqlite_query "$root" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='threads';" "$label")" || return 1
  if [ "$has_threads" -eq 1 ]; then
    setup_query="UPDATE threads SET rollout_path = replace(replace(rollout_path, '$legacy_root', '__CODEX_RUNTIME_ROOT__'), '$final_root', '__CODEX_RUNTIME_ROOT__');"
  fi
  codex_sqlite_query "$root" '.dump' "$label" "$setup_query"
}

probe_codex_database() {
  local root="$1" label="$2" legacy_root="$3" final_root="$4" result
  [ -d "$root" ] && [ ! -L "$root" ] || { fail "$label root is not a physical directory"; return 1; }
  if [ ! -e "$root/state_5.sqlite" ]; then
    say "[OK] $label has no state database to verify"
    return 0
  fi
  result="$(codex_sqlite_query "$root" 'PRAGMA integrity_check;' "$label")" || return 1
  [ "$result" = ok ] || { fail "$label database failed integrity validation"; return 1; }
  codex_sqlite_query "$root" "SELECT COUNT(*) FROM sqlite_master;" "$label" >/dev/null || return 1
  validate_codex_thread_rollout_files "$root" "$legacy_root" "$final_root" "$label" || return 1
  say "[OK] $label database is stable, readable, and internally consistent"
}

validate_codex_thread_rollout_files() {
  local root="$1" legacy_root="$2" final_root="$3" label="$4"
  local has_threads has_rollout total rollouts rollout_file relative
  local processed=0 missing=0 outside=0
  [ -f "$root/state_5.sqlite" ] || return 0
  has_threads="$(codex_sqlite_query "$root" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='threads';" "$label")" || return 1
  case "$has_threads" in ''|*[!0-9]*) fail "$label thread-table check returned an invalid count"; return 1 ;; esac
  if [ "$has_threads" -eq 0 ]; then
    say "[OK] $label has no indexed thread table to validate"
    return 0
  fi
  has_rollout="$(codex_sqlite_query "$root" "SELECT COUNT(*) FROM pragma_table_info('threads') WHERE name='rollout_path';" "$label")" || return 1
  [ "$has_rollout" = 1 ] || { fail "$label thread index has no unique rollout_path column"; return 1; }
  total="$(codex_sqlite_query "$root" 'SELECT COUNT(*) FROM threads;' "$label")" || return 1
  case "$total" in ''|*[!0-9]*) fail "$label thread index returned an invalid count"; return 1 ;; esac
  if [ "$total" -eq 0 ]; then
    say "[OK] $label thread index is empty and has no rollout files to validate"
    return 0
  fi
  rollouts="$(codex_sqlite_query "$root" 'SELECT rollout_path FROM threads ORDER BY id;' "$label")" || return 1
  while IFS= read -r rollout_file; do
    processed=$((processed + 1))
    case "$rollout_file" in
      "$legacy_root"/*) relative="${rollout_file#"$legacy_root"/}" ;;
      "$final_root"/*) relative="${rollout_file#"$final_root"/}" ;;
      *) outside=$((outside + 1)); continue ;;
    esac
    case "/$relative/" in
      *"/../"*) outside=$((outside + 1)); continue ;;
    esac
    if [ ! -f "$root/$relative" ] || [ -L "$root/$relative" ]; then
      missing=$((missing + 1))
    fi
  done <<< "$rollouts"
  [ "$processed" -eq "$total" ] || {
    fail "$label could not safely enumerate every indexed thread rollout path"
    return 1
  }
  [ "$outside" -eq 0 ] || {
    fail "$label has $outside indexed thread rollout path(s) outside the approved legacy/final runtime roots"
    return 1
  }
  [ "$missing" -eq 0 ] || {
    fail "$label has $missing indexed thread rollout file(s) missing from the protected runtime tree"
    return 1
  }
  say "[OK] $label all $total indexed thread rollout files are present inside the protected runtime tree"
}

# Hash all Codex application-owned durable data while allowing only the exact
# managed entries and the physical SQLite representation to differ. The SQLite
# database is compared as a logical dump with the legacy/final root prefixes
# normalized, so a rollout_path-only repair cannot hide any changed thread row.
# Only the aggregate digest and non-secret counts are written to the receipt.
codex_continuity_manifest() {
  local root="$1" output="$2" legacy_root="$3" final_root="$4"
  local digest file_count session_count thread_count db="$root/state_5.sqlite"
  [ -d "$root" ] && [ ! -L "$root" ] || fail "Codex continuity root is not a physical directory: $root"
  if [ -f "$db" ]; then
    require_command sqlite3
    [ "$(codex_sqlite_query "$root" 'PRAGMA integrity_check;' "Codex continuity")" = ok ] || {
      fail "Codex continuity database failed integrity validation: $db"
      return 1
    }
    validate_codex_thread_rollout_files "$root" "$legacy_root" "$final_root" "Codex continuity" || return 1
  fi
  digest="$({
    (
      cd -- "$root"
      find . \
        \( -path './AGENTS.md' -o -path './RTK.md' -o -path './config.toml' -o \
           -path './rules/default.rules' -o -path './skills/user' -o \
           -path './state_5.sqlite' -o -path './state_5.sqlite-wal' -o -path './state_5.sqlite-shm' \) -prune -o \
        -type f -exec shasum -a 256 {} +
      find . \
        \( -path './AGENTS.md' -o -path './RTK.md' -o -path './config.toml' -o \
           -path './rules/default.rules' -o -path './skills/user' \) -prune -o \
        -type l -exec sh -c 'for p do printf "L %s " "$p"; readlink "$p" || exit 1; done' sh {} +
    )
    if [ -f "$db" ]; then
      codex_sqlite_normalized_dump "$root" "$legacy_root" "$final_root" "Codex continuity" |
        sed 's/^/DB /'
    fi
  } | LC_ALL=C sort | shasum -a 256 | awk '{print $1}')" || return 1
  file_count="$(
    cd -- "$root"
    find . \
      \( -path './AGENTS.md' -o -path './RTK.md' -o -path './config.toml' -o \
         -path './rules/default.rules' -o -path './skills/user' -o \
         -path './state_5.sqlite' -o -path './state_5.sqlite-wal' -o -path './state_5.sqlite-shm' \) -prune -o \
      -type f -print | wc -l | tr -d ' '
  )"
  session_count="$(find "$root" -type f \
    \( -path "$root/sessions/*" -o -path "$root/archived_sessions/*" \) |
    wc -l | tr -d ' ')"
  thread_count=0
  if [ -f "$db" ] && [ "$(codex_sqlite_query "$root" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='threads';" "Codex continuity")" -eq 1 ]; then
    thread_count="$(codex_sqlite_query "$root" 'SELECT COUNT(*) FROM threads;' "Codex continuity")"
  fi
  printf 'digest\t%s\nfiles\t%s\nsession_files\t%s\nthreads\t%s\n' "$digest" "$file_count" "$session_count" "$thread_count" > "$output"
  chmod 0600 "$output"
}

assert_codex_continuity() {
  local before="$1" root="$2" legacy_root="$3" final_root="$4" label="$5" after
  after="$(mktemp "$(dirname -- "$before")/.codex-continuity-after.XXXXXX")"
  codex_continuity_manifest "$root" "$after" "$legacy_root" "$final_root"
  if ! cmp -s "$before" "$after"; then
    fail "$label session/history continuity mismatch; do not reopen Codex and use the retained rollback snapshot"
    return 1
  fi
  mv "$after" "$before.after-verified"
  say "[OK] $label Codex session/history continuity verified before application reopen"
}

runtime_find() {
  local root="$1" application="$2" selection="$3"
  local -a managed
  case "$application" in
    claude)
      managed=( -path ./CLAUDE.md -o -path ./settings.json -o -path ./hooks -o -path './hooks/*' -o -path ./agents -o -path './agents/*' -o -path ./skills -o -path './skills/*' -o -path ./statusline-command.sh )
      ;;
    cursor) managed=( -path ./skills -o -path './skills/*' ) ;;
    gemini) managed=( -path ./GEMINI.md ) ;;
    kiro) managed=( -path ./steering -o -path './steering/*' ) ;;
    *) fail "unknown runtime continuity application: $application"; return 1 ;;
  esac
  (
    cd -- "$root"
    case "$selection" in
      files) find . \( "${managed[@]}" \) -prune -o -type f -exec shasum -a 256 {} + ;;
      links) find . \( "${managed[@]}" \) -prune -o -type l -exec sh -c 'for p do printf "L %s|" "$p"; readlink "$p" || exit 1; done' sh {} + ;;
      metadata) find . \( "${managed[@]}" \) -prune -o ! -type s -exec stat -f '%HT|%u|%g|%Lp|%N' {} + ;;
      count) find . \( "${managed[@]}" \) -prune -o ! -type s -print ;;
      *) fail "unknown runtime continuity selection: $selection"; return 1 ;;
    esac
  )
}

# Application roots are permitted to change only at their declared managed
# entries. Everything else—including sessions, auth, history, caches, and
# private runtime state—must retain content, link targets, ownership, and mode.
runtime_continuity_manifest() {
  local root="$1" application="$2" output="$3" digest count
  [ -d "$root" ] && [ ! -L "$root" ] || fail "$application continuity root is not a physical directory: $root"
  digest="$({
    runtime_find "$root" "$application" files
    runtime_find "$root" "$application" links
    runtime_find "$root" "$application" metadata |
      awk -F '|' 'BEGIN{OFS="|"} {gid=$3; if ($1 == "Regular File" && $4 == "644") gid="-"; print "M",$1,$2,gid,$4,$5}'
  } | LC_ALL=C sort | shasum -a 256 | awk '{print $1}')" || return 1
  count="$(runtime_find "$root" "$application" count | wc -l | tr -d ' ')"
  printf 'digest\t%s\nentries\t%s\n' "$digest" "$count" > "$output"
  chmod 0600 "$output"
}

assert_runtime_continuity() {
  local before="$1" root="$2" application="$3" label="$4" after
  after="$(mktemp "$(dirname -- "$before")/.${application}-continuity-after.XXXXXX")"
  runtime_continuity_manifest "$root" "$application" "$after"
  if ! cmp -s "$before" "$after"; then
    fail "$label $application session/auth/history continuity mismatch; do not reopen the application"
    return 1
  fi
  mv "$after" "$before.after-verified"
  say "[OK] $label $application session/auth/history continuity verified before application reopen"
}

# Build and verify a complete restore tree while the live path is still intact.
# Rollback later needs only an atomic same-filesystem switch; it never removes
# the live root before a verified replacement exists.
prepare_tree_restore_stage() {
  local snapshot="$1" stage="$2" label="$3" receipt="$4"
  copy_tree "$snapshot" "$stage"
  verify_tree_copy "$snapshot" "$stage" "$label" "$receipt"
}

trees_match() {
  local first="$1" second="$2" first_digest second_digest
  [ -d "$first" ] && [ ! -L "$first" ] && [ -d "$second" ] && [ ! -L "$second" ] || return 1
  first_digest="$(tree_digest "$first")" || return 1
  second_digest="$(tree_digest "$second")" || return 1
  [ "$first_digest" = "$second_digest" ]
}

ensure_tree_restore_stage() {
  local snapshot="$1" stage="$2" label="$3" receipt="$4" rejected
  if trees_match "$snapshot" "$stage"; then
    say "[OK] $label is already prepared and verified"
    return 0
  fi
  if [ -e "$stage" ] || [ -L "$stage" ]; then
    rejected="$stage.rejected-${RUN_ID:-fixture}-$$-$RANDOM"
    mv "$stage" "$rejected"
    say "[PRESERVED] unusable $label retained at $rejected"
  fi
  prepare_tree_restore_stage "$snapshot" "$stage" "$label" "$receipt"
}

activate_prepared_restore_tree() {
  local live="$1" snapshot="$2" stage="$3" failed="$4" label="$5" receipt="$6"
  [ -d "$stage" ] && [ ! -L "$stage" ] || fail "$label prepared restore tree is unavailable: $stage"
  verify_tree_copy "$snapshot" "$stage" "$label-pre-switch" "$receipt"
  move_aside "$live" "$failed"
  if ! mv "$stage" "$live"; then
    mv "$failed" "$live" || fail "$label switch and immediate live-root restoration both failed; preserved paths require manual recovery"
    fail "$label atomic restore switch failed; original live root restored"
  fi
  verify_tree_copy "$snapshot" "$live" "$label-restored" "$receipt"
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

stable_copy_path_snapshot() {
  local source="$1" destination="$2" label="$3" receipt="$4"
  local attempt before after copied rejected
  for attempt in 1 2; do
    before="$(path_digest "$source")" || return 1
    if ! copy_path_snapshot "$source" "$destination"; then
      rejected="$destination.copy-failure-attempt-$attempt"
      if [ -e "$destination" ] || [ -L "$destination" ]; then
        mv "$destination" "$rejected"
      elif [ -e "$destination.missing" ]; then
        mv "$destination.missing" "$rejected.missing"
      fi
      fail "$label snapshot copy failed; partial attempt retained"
      return 1
    fi
    if [ "${HOST_ACTIVATION_TEST_MODE:-0}" = 1 ] && [ "${HOST_ACTIVATION_TEST_MUTATE_PATH_SOURCE:-0}" = 1 ]; then
      case "$source" in
        /private/tmp/host-activation-test.*) printf 'simulated-path-writer\n' >> "$source" ;;
        *) fail "test path-mutation hook refused a non-fixture path"; return 1 ;;
      esac
    fi
    after="$(path_digest "$source")" || return 1
    copied="$(snapshot_path_digest "$destination")" || return 1
    if [ "$before" = "$after" ] && [ "$after" = "$copied" ]; then
      printf '%s\t%s\t%s\n' "$label" "$copied" "stable-path-verified" >> "$receipt"
      say "[OK] verified stable $label (snapshot fingerprint $copied)"
      return 0
    fi
    rejected="$destination.unstable-attempt-$attempt"
    if [ -e "$destination" ] || [ -L "$destination" ]; then
      mv "$destination" "$rejected"
    elif [ -e "$destination.missing" ]; then
      mv "$destination.missing" "$rejected.missing"
    fi
    if [ "$before" != "$after" ]; then
      say "[RETRY] $label changed during snapshot attempt $attempt; rejected snapshot retained"
    else
      fail "$label snapshot fidelity mismatch; rejected snapshot retained"
      return 1
    fi
  done
  fail "$label changed during both snapshot attempts; close every writer and retry with the retained receipt"
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
  local live="$1" snapshot="$2" failed="$3" staged
  require_snapshot "$snapshot" any || return 1
  if [ -e "$snapshot.missing" ]; then
    move_aside "$live" "$failed"
    return 0
  fi
  mkdir -p "$(dirname -- "$live")"
  staged="$(dirname -- "$live")/.$(basename -- "$live").restore-${RUN_ID:-fixture}-$$-$RANDOM"
  [ ! -e "$staged" ] && [ ! -L "$staged" ] || fail "restore stage unexpectedly exists: $staged"
  if [ -L "$snapshot" ]; then
    cp -pP "$snapshot" "$staged"
  elif [ -f "$snapshot" ]; then
    cp -p "$snapshot" "$staged"
  elif [ -d "$snapshot" ]; then
    copy_tree "$snapshot" "$staged"
  fi
  [ "$(path_digest "$snapshot")" = "$(path_digest "$staged")" ] || fail "restore stage verification failed: $snapshot"
  move_aside "$live" "$failed"
  if ! mv "$staged" "$live"; then
    mv "$failed" "$live" || fail "snapshot activation and immediate restoration both failed: $live"
    fail "snapshot activation failed; original live path restored: $live"
  fi
  verify_path_matches_snapshot "$live" "$snapshot" "restored snapshot $live" || return 1
}

restore_snapshot_copy() {
  local live="$1" snapshot="$2" failed="$3"
  require_snapshot "$snapshot" file || return 1
  restore_snapshot "$live" "$snapshot" "$failed"
}

require_snapshot() {
  local snapshot="$1" expected_kind="$2"
  if [ -e "$snapshot.missing" ]; then
    [ ! -e "$snapshot" ] && [ ! -L "$snapshot" ] || fail "snapshot has both missing and materialized forms: $snapshot"
    return 0
  fi
  if [ -L "$snapshot" ] || [ -f "$snapshot" ]; then return 0; fi
  if [ "$expected_kind" = any ] && [ -d "$snapshot" ] && [ ! -L "$snapshot" ]; then return 0; fi
  fail "snapshot is unavailable or has an invalid type: $snapshot"
}

verify_path_matches_snapshot() {
  local live="$1" snapshot="$2" label="$3" live_stat snapshot_stat
  require_snapshot "$snapshot" any || return 1
  if [ -e "$snapshot.missing" ]; then
    [ ! -e "$live" ] && [ ! -L "$live" ] || { fail "$label appeared after preparation"; return 1; }
  elif [ -L "$snapshot" ]; then
    [ -L "$live" ] && [ "$(readlink "$live")" = "$(readlink "$snapshot")" ] || { fail "$label symlink changed after preparation"; return 1; }
  elif [ -f "$snapshot" ]; then
    [ -f "$live" ] && [ ! -L "$live" ] && cmp -s "$snapshot" "$live" || { fail "$label file changed after preparation"; return 1; }
    snapshot_stat="$(stat -f '%u|%g|%Lp' "$snapshot")"
    live_stat="$(stat -f '%u|%g|%Lp' "$live")"
    [ "$snapshot_stat" = "$live_stat" ] || { fail "$label ownership or mode changed after preparation"; return 1; }
  elif [ -d "$snapshot" ]; then
    trees_match "$snapshot" "$live" || { fail "$label directory changed after preparation"; return 1; }
  fi
  [ "$(path_digest "$live")" = "$(snapshot_path_digest "$snapshot")" ] || {
    fail "$label content, link target, ownership, mode, time, ACL, or xattr changed after preparation"
    return 1
  }
  say "[OK] $label still matches its pre-mutation snapshot"
}

write_phase_state() {
  local root="$1" number="$2" status="$3"
  printf '%s\t%s\n' "$number" "$status" > "$root/state.tsv.tmp"
  chmod 0600 "$root/state.tsv.tmp"
  mv "$root/state.tsv.tmp" "$root/state.tsv"
}

read_phase_number() {
  [ -f "$1/state.tsv" ] || return 1
  awk 'NR == 1 && NF >= 2 {print $1; found=1} END {if (!found) exit 1}' "$1/state.tsv"
}

receipt_note() {
  local root="$1"
  shift
  printf '%s\n' "$*" >> "$root/receipt.md"
}

office_preflight() {
  local execution="$1" old_head mind_dirty path expected
  phase 0 "Office preflight"
  for expected in awk chmod cmp cp df du find git grep kill mkdir mktemp mv node pgrep ps sed shasum sleep sqlite3 ssh-keygen ssh-keyscan stat tar unlink xattr; do require_command "$expected"; done
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
  validate_json_object_file "$CLAUDE_REGISTRY" "Office Claude registry"

  check_port "$MAC_TB" || fail "Office cannot reach MacBook Thunderbolt SSH"
  check_port "$MAC_TS" || fail "Office cannot reach MacBook Tailscale SSH"
  ssh_explicit "$MAC_USER" "$MAC_TB" "$MAC_TB" /Users/Office/.ssh/id_ed25519 /usr/bin/true >/dev/null
  ssh_explicit "$MAC_USER" "$MAC_TS" "$MAC_TS" /Users/Office/.ssh/id_ed25519 /usr/bin/true >/dev/null
  say "[OK] Office→MacBook authentication over both fixed addresses"
  validate_hostkey_alias_inputs macbook-m1 "$MAC_TB" "$MAC_TS" /Users/Office/.ssh/known_hosts

  local source_kb runtime_kb codex_kb brain_kb available_kb required_kb reserve_kb runtime_target
  source_kb="$(du -sk "$OFFICE_BRAIN" /Users/Office/.codex "$OFFICE_CANDIDATE" | awk '{s += $1} END {print s}')"
  codex_kb="$(du -sk /Users/Office/.codex | awk '{print $1}')"
  brain_kb="$(du -sk "$OFFICE_BRAIN" | awk '{print $1}')"
  runtime_kb=0
  for path in .claude .cursor .gemini .kiro; do
    runtime_target="$(resolve_link "/Users/Office/$path")"
    runtime_kb=$((runtime_kb + $(du -sk "$runtime_target" | awk '{print $1}')))
  done
  # Each legacy runtime target is copied once to backup and once to staging.
  # Codex is copied once to backup and once more to a preverified rollback
  # stage, so rollback never has to remove the live root before rebuilding it.
  # One rejected first attempt is retained for every stable-copy source. Count
  # that worst-case retry space explicitly rather than relying on the reserve.
  source_kb=$((source_kb + (runtime_kb * 3) + (codex_kb * 2) + brain_kb))
  available_kb="$(df -Pk /Users/Office | awk 'NR == 2 {print $4}')"
  reserve_kb=5242880
  required_kb=$((source_kb + reserve_kb))
  [ "$available_kb" -ge "$required_kb" ] || fail "Office free space is insufficient: need ${required_kb}KB; have ${available_kb}KB"
  say "[OK] Office free-space gate: ${available_kb}KB available; ${required_kb}KB required"

  if [ "$execution" = "execute" ]; then
    quiesce_orphan_application_helpers "Office"
    check_no_forbidden_processes "Office"
    probe_codex_database \
      /Users/Office/.codex "Office Codex" \
      "$OFFICE_BRAIN/operations/system-configs/codex" /Users/Office/.codex
  else
    check_no_forbidden_processes "Office" || {
      fail "Office dry-run cannot pass while affected processes or detached helpers remain; execute may gracefully TERM only adopted helper processes"
      return 1
    }
    probe_codex_database \
      /Users/Office/.codex "Office Codex" \
      "$OFFICE_BRAIN/operations/system-configs/codex" /Users/Office/.codex
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
  write_phase_state "$root" 1 "BACKUP_IN_PROGRESS"

  for name in claude cursor gemini kiro; do
    live="/Users/Office/.$name"
    source="$(resolve_link "$live")"
    backup="$root/backups/runtime/$name"
    label="office-$name-runtime"
    metadata_line "$label" "$live" "$metadata"
    stable_copy_tree "$source" "$backup" "$label-backup" "$root/integrity.tsv"
    runtime_continuity_manifest "$backup" "$name" "$root/$name-continuity-before.tsv"
  done

  metadata_line "office-codex-runtime" /Users/Office/.codex "$metadata"
  stable_copy_tree /Users/Office/.codex "$root/backups/runtime/codex" "office-codex-backup" "$root/integrity.tsv"
  codex_continuity_manifest \
    "$root/backups/runtime/codex" "$root/codex-continuity-before.tsv" \
    "$OFFICE_BRAIN/operations/system-configs/codex" /Users/Office/.codex

  metadata_line "office-old-canonical-brain" "$OFFICE_BRAIN" "$metadata"
  stable_copy_tree "$OFFICE_BRAIN" "$root/backups/old-canonical-brain-copy" "old-canonical-brain-backup" "$root/integrity.tsv"

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
    stable_copy_path_snapshot "$live" "$root/backups/paths/$name" "office-$name-backup" "$root/integrity.tsv"
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
  mkdir -p "$root/staging/rollback"
  ensure_tree_restore_stage \
    "$root/backups/runtime/codex" "$root/staging/rollback/codex" \
    "office-codex-rollback-stage" "$root/integrity.tsv"
  # Re-prove that every mutable source still equals its verified backup. This
  # is the final readiness gate immediately before the remote worker returns
  # control to the MacBook for its own preparation.
  for name in claude cursor gemini kiro; do
    verify_stable_tree_against_snapshot "$(resolve_link "/Users/Office/.$name")" "$root/backups/runtime/$name" "office-$name-readiness" "$root/integrity.tsv"
  done
  verify_stable_tree_against_snapshot /Users/Office/.codex "$root/backups/runtime/codex" "office-codex-readiness" "$root/integrity.tsv"
  write_phase_state "$root" 2 "PREPARED_AND_ROLLBACK_READY"
  say "[OK] Office preparation is complete; no live path has changed"
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
  quiesce_orphan_application_helpers "Office"
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
  local root="$OFFICE_RECEIPTS/$RUN_ID" name live
  phase 5 "Office narrow configuration activation"
  check_no_forbidden_processes "Office"
  for name in gitconfig ssh-config known-hosts zshrc zprofile ghostty starship; do
    case "$name" in
      gitconfig) live=/Users/Office/.gitconfig ;;
      ssh-config) live=/Users/Office/.ssh/config ;;
      known-hosts) live=/Users/Office/.ssh/known_hosts ;;
      zshrc) live=/Users/Office/.zshrc ;;
      zprofile) live=/Users/Office/.zprofile ;;
      ghostty) live=/Users/Office/.config/ghostty/config ;;
      starship) live=/Users/Office/.config/starship.toml ;;
    esac
    verify_path_matches_snapshot "$live" "$root/backups/paths/$name" "Office $name"
  done
  write_phase_state "$root" 5 "OFFICE_CONFIG_ACTIVATION_IN_PROGRESS"
  write_include_root git
  write_include_root ssh
  ensure_hostkey_alias macbook-m1 "$MAC_TB" "$MAC_TS" /Users/Office/.ssh/known_hosts
  BRAIN_REPO="$OFFICE_BRAIN" \
    BRAIN_CONFIG_BACKUP_DIR="$root/linker-backups" \
    bash "$OFFICE_BRAIN/operations/scripts/brain-configs-link.sh"
  BRAIN_REPO="$OFFICE_BRAIN" CODEX_HOME=/Users/Office/.codex \
    bash "$OFFICE_BRAIN/operations/scripts/codex-home-managed-root.sh" check
  for name in claude cursor gemini kiro; do
    assert_runtime_continuity \
      "$root/$name-continuity-before.tsv" "/Users/Office/.$name" "$name" "Office"
  done
  assert_codex_continuity \
    "$root/codex-continuity-before.tsv" /Users/Office/.codex \
    "$OFFICE_BRAIN/operations/system-configs/codex" /Users/Office/.codex \
    "Office"
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
  verify_path_matches_snapshot "$APPROVAL_FILE" "$root/backups/paths/approval" "Office bridge approval"
  verify_path_matches_snapshot "$CLAUDE_REGISTRY" "$root/backups/paths/claude-registry" "Office Claude registry"
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
  local root="$OFFICE_RECEIPTS/$RUN_ID" snapshot phase_number expected
  [ -d "$root" ] || return 0
  snapshot="$root/backups/paths/ssh-config"
  phase_number="$(read_phase_number "$root")" || fail "Office phase state is unavailable; keep rescue open for manual recovery"
  case "$phase_number" in ''|*[!0-9]*) fail "invalid Office phase state; keep rescue open for manual recovery" ;; esac
  if [ "$phase_number" -lt 5 ]; then
    expected="$OFFICE_BRAIN/operations/system-configs/ssh/config"
    [ -L /Users/Office/.ssh/config ] && [ "$(resolve_link /Users/Office/.ssh/config)" = "$expected" ] || fail "Office SSH was not scheduled to change but its original symlink is not intact; manual recovery is required"
    say "[OK] Office SSH remained at the exact pre-migration symlink; no restore was needed."
    return 0
  fi
  require_snapshot "$snapshot" file
  restore_snapshot_copy /Users/Office/.ssh/config "$snapshot" "$root/failed/ssh-config-post-failure"
  say "[ROLLBACK] Office SSH root config restored from the pre-migration snapshot"
}

office_prevalidate_rollback() {
  local root="$1" number="$2" name live expected archive
  if [ "$number" -ge 7 ]; then
    require_snapshot "$root/backups/paths/approval" any
    require_snapshot "$root/backups/paths/claude-registry" any
  fi
  if [ "$number" -ge 5 ]; then
    for name in gitconfig ssh-config known-hosts zshrc zprofile ghostty starship; do
      require_snapshot "$root/backups/paths/$name" any
    done
    [ -d "$root/backups/runtime/codex" ] && [ ! -L "$root/backups/runtime/codex" ] || fail "Office Codex rollback snapshot is unavailable"
    if ! trees_match "$root/backups/runtime/codex" /Users/Office/.codex; then
      ensure_tree_restore_stage "$root/backups/runtime/codex" "$root/staging/rollback/codex" "office-codex-rollback-prevalidation" "$root/integrity.tsv"
    else
      say "[OK] Office Codex is already restored to its verified snapshot"
    fi
  fi
  if [ "$number" -ge 4 ]; then
    [ -f "$root/archive-path" ] || fail "Office canonical Brain archive path is unavailable"
    archive="$(cat "$root/archive-path")"
    if [ ! -d "$archive" ]; then
      [ -d "$OFFICE_BRAIN/.git" ] && [ "$(git -C "$OFFICE_BRAIN" rev-parse HEAD)" = "$OLD_OFFICE_BRAIN_COMMIT" ] || fail "Office canonical Brain rollback archive is unavailable"
    fi
  fi
  if [ "$number" -ge 3 ]; then
    for name in claude cursor gemini kiro; do
      live="/Users/Office/.$name"
      expected="$OFFICE_BRAIN/operations/system-configs/$name"
      if [ -L "$root/original-paths/$name.symlink" ]; then
        [ "$(resolve_link "$root/original-paths/$name.symlink")" = "$expected" ] || fail "Office $name original symlink snapshot has an unexpected target"
      else
        [ -L "$live" ] && [ "$(resolve_link "$live")" = "$expected" ] || fail "Office $name rollback state is ambiguous; original symlink is unavailable"
      fi
    done
  fi
}

office_rollback() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" number name archive failed_root
  validate_run_id
  [ -d "$root" ] || fail "Office receipt does not exist: $root"
  number="$(read_phase_number "$root")" || fail "Office phase state is unavailable; keep rescue open for manual recovery"
  case "$number" in ''|*[!0-9]*) fail "invalid Office phase state" ;; esac
  if [ "$number" -eq 0 ]; then
    [ -e /Users/Office/.ssh/config ] || [ -L /Users/Office/.ssh/config ] || fail "Office run state is pre-mutation but the live SSH config is absent; manual recovery is required"
    say "[OK] Office run $RUN_ID is already rolled back; no paths changed."
    return 0
  fi
  quiesce_orphan_application_helpers "Office"
  check_no_forbidden_processes "Office"
  office_prevalidate_rollback "$root" "$number"
  say "[ROLLBACK] reversing Office run $RUN_ID from completed phase $number"
  failed_root="$root/failed/rollback-$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
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
    if ! trees_match "$root/backups/runtime/codex" /Users/Office/.codex; then
      activate_prepared_restore_tree \
        /Users/Office/.codex "$root/backups/runtime/codex" "$root/staging/rollback/codex" \
        "$failed_root/codex-after-activation" "office-codex-rollback" "$root/integrity.tsv"
    fi
    assert_codex_continuity \
      "$root/codex-continuity-before.tsv" /Users/Office/.codex \
      "$OFFICE_BRAIN/operations/system-configs/codex" /Users/Office/.codex \
      "Office rollback"
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
    for name in claude cursor gemini kiro; do
      assert_runtime_continuity \
        "$root/$name-continuity-before.tsv" "$(resolve_link "/Users/Office/.$name")" "$name" \
        "Office rollback"
    done
  fi
  write_phase_state "$root" 0 "ROLLED_BACK"
  receipt_note "$root" "- Rollback: completed at $(date -u +%Y-%m-%dT%H:%M:%SZ); replacement artifacts preserved under $failed_root"
  say "ROLLBACK COMPLETE — Office originals restored; failed/new artifacts preserved at $failed_root"
}

office_abort() {
  local rc="$1" rollback_rc=0 phase_number
  trap - ERR INT TERM HUP
  set +e
  if [ ! -d "$OFFICE_RECEIPTS/$RUN_ID" ]; then
    say "PRECHECK BLOCKED — Office Phase 0 made no changes; no receipt or rollback is required."
    exit "$NO_MUTATION_EXIT"
  fi
  if ! phase_number="$(read_phase_number "$OFFICE_RECEIPTS/$RUN_ID")"; then
    say "[STOP] Office phase state is unavailable; keep rescue open for manual recovery"
    exit "$ROLLBACK_FAILED_EXIT"
  fi
  case "$phase_number" in ''|*[!0-9]*) say "[STOP] invalid Office phase state; keep rescue open"; exit "$ROLLBACK_FAILED_EXIT" ;; esac
  if phase_is_no_mutation "$phase_number"; then
    say "PRE-MUTATION BLOCKED — Office Phase 0–2 changed no live paths; partial receipt retained for diagnosis."
    exit "$NO_MUTATION_EXIT"
  fi
  if [ "$phase_number" -ge 3 ]; then
    (set -e; office_rollback) || rollback_rc=$?
  fi
  if [ "$rollback_rc" -ne 0 ]; then
    say "[STOP] Office rollback could not complete safely; keep rescue open and use the receipt after quiescing affected processes."
    say "ROLLBACK REQUIRED/ATTEMPTED after Office interruption or failure (exit $rc; rollback $rollback_rc)"
    exit "$ROLLBACK_FAILED_EXIT"
  fi
  say "ROLLBACK REQUIRED/ATTEMPTED after Office interruption or failure (exit $rc; rollback $rollback_rc)"
  rc="$(normalize_failure_exit "$rc")"
  exit "$rc"
}

office_prepare() {
  local root="$OFFICE_RECEIPTS/$RUN_ID"
  validate_commit_arg
  validate_run_id
  trap 'office_abort $?' ERR
  trap 'office_abort 130' INT TERM HUP
  office_preflight execute
  office_phase1_backup
  office_phase2_stage_roots
  trap - ERR INT TERM HUP
  say "[READY] Office backups, stages, continuity baseline, and rollback tree are verified; no live path changed."
}

office_commit() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" name phase_number
  validate_commit_arg
  validate_run_id
  trap 'office_abort $?' ERR
  trap 'office_abort 130' INT TERM HUP
  [ -d "$root" ] || fail "Office prepared receipt does not exist: $root"
  phase_number="$(read_phase_number "$root")" || fail "Office prepared phase state is unavailable"
  [ "$phase_number" -eq 2 ] || fail "Office is not at the exact prepared pre-mutation state: $phase_number"
  office_preflight execute
  for name in claude cursor gemini kiro; do
    verify_stable_tree_against_snapshot "$(resolve_link "/Users/Office/.$name")" "$root/backups/runtime/$name" "office-$name-commit-gate" "$root/integrity.tsv"
  done
  verify_stable_tree_against_snapshot /Users/Office/.codex "$root/backups/runtime/codex" "office-codex-commit-gate" "$root/integrity.tsv"
  verify_tree_copy "$root/backups/runtime/codex" "$root/staging/rollback/codex" "office-codex-rollback-commit-gate" "$root/integrity.tsv"
  office_phase3_convert_roots
  office_phase4_replace_brain
  office_phase5_activate_configs
  office_phase7_activate_bridge
  trap - ERR INT TERM HUP
  say "[OK] Office phases 0–5 and 7 complete; rescue connection must remain open through fresh connectivity acceptance."
}

office_apply() {
  fail "office-apply is disabled; start top-level execute on the MacBook so both hosts are prepared before mutation"
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
  say "READ-ONLY DRY-RUN INSPECTION PASS — Office topology is currently eligible; no receipt, copy, stage, or live mutation was attempted."
  say "[BOUNDARY] Mutable runtime data can change after any read-only inspection. Execute independently requires stable before/copy/after digests and complete rollback preparation before ACTIVATE."
}

mac_preflight() {
  local execution="$1" path available_kb backup_kb required_kb path_kb
  phase 0 "MacBook preflight"
  for path in awk chmod cmp cp df du find git grep kill mkdir mktemp mv node pgrep ps sed shasum sleep sqlite3 ssh-keygen ssh-keyscan stat tar unlink xattr; do require_command "$path"; done
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
  validate_hostkey_alias_inputs office-m4 "$OFFICE_TB" "$OFFICE_TS" /Users/Steve/.ssh/known_hosts
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
  # Codex needs both an immutable backup and a preverified same-filesystem
  # rollback tree. Other narrow snapshots are single copies.
  if [ -d /Users/Steve/.codex ]; then
    path_kb="$(du -sk /Users/Steve/.codex | awk '{print $1}')"
    # The first unstable attempt is preserved before a single retry.
    backup_kb=$((backup_kb + (path_kb * 2)))
  fi
  required_kb=$((backup_kb + 1048576))
  [ "$available_kb" -ge "$required_kb" ] || fail "MacBook free space is insufficient"
  if [ "$execution" = "execute" ]; then
    quiesce_orphan_application_helpers "MacBook"
    check_no_forbidden_processes "MacBook"
    [ ! -d /Users/Steve/.codex ] || probe_codex_database \
      /Users/Steve/.codex "MacBook Codex" \
      "$MAC_BRAIN/operations/system-configs/codex" /Users/Steve/.codex
  else
    check_no_forbidden_processes "MacBook" || {
      fail "MacBook dry-run cannot pass while affected processes or detached helpers remain; execute may gracefully TERM only adopted helper processes"
      return 1
    }
    [ ! -d /Users/Steve/.codex ] || probe_codex_database \
      /Users/Steve/.codex "MacBook Codex" \
      "$MAC_BRAIN/operations/system-configs/codex" /Users/Steve/.codex
  fi
}

mac_snapshot_paths() {
  local root="$LOCAL_RECEIPT" label live
  quiesce_orphan_application_helpers "MacBook"
  check_no_forbidden_processes "MacBook"
  umask 077
  [ ! -e "$root" ] || fail "MacBook receipt already exists: $root"
  mkdir -p "$root/backups/paths" "$root/backups/runtime" "$root/staging/rollback" "$root/failed"
  chmod 0700 "$root" "$root/backups" "$root/staging" "$root/failed"
  cat > "$root/receipt.md" <<EOF
# MacBook Host Activation Receipt

- Run ID: $RUN_ID
- Started UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Packet commit: $EXPECTED_COMMIT
- Backup/receipt root: $root
- Status: IN PROGRESS
EOF
  chmod 0600 "$root/receipt.md"
  write_phase_state "$root" 1 "MACBOOK_BACKUP_IN_PROGRESS"
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
    stable_copy_path_snapshot "$live" "$root/backups/paths/$label" "macbook-$label-backup" "$root/integrity.tsv"
  done
  for label in claude cursor gemini kiro; do
    if [ -d "/Users/Steve/.$label" ] && [ ! -L "/Users/Steve/.$label" ]; then
      runtime_continuity_manifest "/Users/Steve/.$label" "$label" "$root/$label-continuity-before.tsv"
    else
      : > "$root/$label-continuity-before.tsv.missing"
    fi
  done
  if [ -d /Users/Steve/.codex ]; then
    stable_copy_tree /Users/Steve/.codex "$root/backups/runtime/codex" "macbook-codex-backup" "$root/integrity.tsv"
    codex_continuity_manifest \
      "$root/backups/runtime/codex" "$root/codex-continuity-before.tsv" \
      "$MAC_BRAIN/operations/system-configs/codex" /Users/Steve/.codex
    ensure_tree_restore_stage \
      "$root/backups/runtime/codex" "$root/staging/rollback/codex" \
      "macbook-codex-rollback-stage" "$root/integrity.tsv"
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
  local c="$MAC_BRAIN/operations/system-configs" phase_number label live name
  phase 6 "MacBook narrow configuration activation"
  phase_number="$(read_phase_number "$LOCAL_RECEIPT")" || fail "MacBook prepared phase state is unavailable"
  [ "$phase_number" -eq 1 ] || fail "MacBook is not at the exact prepared pre-mutation state: $phase_number"
  quiesce_orphan_application_helpers "MacBook"
  check_no_forbidden_processes "MacBook"
  if [ -d /Users/Steve/.codex ]; then
    verify_stable_tree_against_snapshot /Users/Steve/.codex "$LOCAL_RECEIPT/backups/runtime/codex" "macbook-codex-commit-gate" "$LOCAL_RECEIPT/integrity.tsv"
    verify_tree_copy "$LOCAL_RECEIPT/backups/runtime/codex" "$LOCAL_RECEIPT/staging/rollback/codex" "macbook-codex-rollback-commit-gate" "$LOCAL_RECEIPT/integrity.tsv"
  fi
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
    verify_path_matches_snapshot "$live" "$LOCAL_RECEIPT/backups/paths/$label" "MacBook $label"
  done
  for name in claude cursor gemini kiro; do
    if [ -f "$LOCAL_RECEIPT/$name-continuity-before.tsv" ]; then
      assert_runtime_continuity \
        "$LOCAL_RECEIPT/$name-continuity-before.tsv" "/Users/Steve/.$name" "$name" \
        "MacBook commit gate"
    else
      [ ! -e "/Users/Steve/.$name" ] && [ ! -L "/Users/Steve/.$name" ] || fail "MacBook $name root appeared after preparation"
    fi
  done
  write_phase_state "$LOCAL_RECEIPT" 6 "MACBOOK_CONFIG_ACTIVATION_IN_PROGRESS"
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
  for name in claude cursor gemini kiro; do
    if [ -f "$LOCAL_RECEIPT/$name-continuity-before.tsv" ]; then
      assert_runtime_continuity \
        "$LOCAL_RECEIPT/$name-continuity-before.tsv" "/Users/Steve/.$name" "$name" "MacBook"
    else
      [ ! -e "/Users/Steve/.$name" ] && [ ! -L "/Users/Steve/.$name" ] || fail "MacBook $name root appeared after preparation"
    fi
  done
  if [ -d /Users/Steve/.codex ]; then
    BRAIN_REPO="$MAC_BRAIN" CODEX_HOME=/Users/Steve/.codex bash "$MAC_BRAIN/operations/scripts/codex-home-managed-root.sh" repair
    BRAIN_REPO="$MAC_BRAIN" CODEX_HOME=/Users/Steve/.codex bash "$MAC_BRAIN/operations/scripts/codex-home-managed-root.sh" check
    assert_codex_continuity \
      "$LOCAL_RECEIPT/codex-continuity-before.tsv" /Users/Steve/.codex \
      "$MAC_BRAIN/operations/system-configs/codex" /Users/Steve/.codex \
      "MacBook"
  fi
  if find /Users/Steve/.claude /Users/Steve/.cursor /Users/Steve/.gemini /Users/Steve/.kiro /Users/Steve/.codex /Users/Steve/.config \
    -type l -exec readlink {} \; 2>/dev/null | grep -Eq '/Volumes/Office|brain-next|brain-host-activation'; then
    fail "MacBook managed targets still reference /Volumes/Office or a noncanonical Brain path"
  fi
  write_phase_state "$LOCAL_RECEIPT" 6 "MACBOOK_CONFIG_ACTIVE"
}

mac_rollback() {
  local root="$MAC_RECEIPTS/$RUN_ID" label live phase_number failed="$MAC_RECEIPTS/$RUN_ID/failed/rollback-$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
  [ -d "$root" ] || return 0
  phase_number="$(read_phase_number "$root")" || fail "MacBook phase state is unavailable; keep rescue open for manual recovery"
  case "$phase_number" in ''|*[!0-9]*) fail "invalid MacBook phase state; keep rescue open for manual recovery" ;; esac
  if [ "$phase_number" = 0 ]; then
    say "[OK] MacBook run $RUN_ID is already rolled back; no paths changed."
    return 0
  fi
  if [ "$phase_number" -lt 6 ]; then
    write_phase_state "$root" 0 "ROLLED_BACK"
    say "[OK] MacBook backup phase changed no live paths; no MacBook restore was needed."
    return 0
  fi
  quiesce_orphan_application_helpers "MacBook"
  check_no_forbidden_processes "MacBook"
  for label in gitconfig ssh-config known-hosts zshrc zprofile ghostty starship claude-CLAUDE claude-settings claude-hooks claude-agents claude-skills claude-statusline cursor-skills gemini-GEMINI kiro-steering; do
    require_snapshot "$root/backups/paths/$label" any
  done
  if [ ! -d "$root/backups/runtime/codex" ] || [ -L "$root/backups/runtime/codex" ]; then
    [ -e "$root/backups/runtime/codex.missing" ] || fail "MacBook Codex rollback snapshot is unavailable"
  fi
  if [ -d "$root/backups/runtime/codex" ]; then
    if ! trees_match "$root/backups/runtime/codex" /Users/Steve/.codex; then
      ensure_tree_restore_stage "$root/backups/runtime/codex" "$root/staging/rollback/codex" "macbook-codex-rollback-prevalidation" "$root/integrity.tsv"
    else
      say "[OK] MacBook Codex is already restored to its verified snapshot"
    fi
  fi
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
    restore_snapshot "$live" "$root/backups/paths/$label" "$failed/$label"
  done
  if [ -d "$root/backups/runtime/codex" ]; then
    if ! trees_match "$root/backups/runtime/codex" /Users/Steve/.codex; then
      activate_prepared_restore_tree \
        /Users/Steve/.codex "$root/backups/runtime/codex" "$root/staging/rollback/codex" \
        "$failed/codex-after-activation" "macbook-codex-rollback" "$root/integrity.tsv"
    fi
    assert_codex_continuity \
      "$root/codex-continuity-before.tsv" /Users/Steve/.codex \
      "$MAC_BRAIN/operations/system-configs/codex" /Users/Steve/.codex \
      "MacBook rollback"
  elif [ -e "$root/backups/runtime/codex.missing" ]; then
    move_aside /Users/Steve/.codex "$failed/codex-created-by-activation"
  fi
  for label in claude cursor gemini kiro; do
    if [ -f "$root/$label-continuity-before.tsv" ]; then
      assert_runtime_continuity \
        "$root/$label-continuity-before.tsv" "/Users/Steve/.$label" "$label" \
        "MacBook rollback"
    fi
  done
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
Codex conversation files and its logical thread index have already passed the
deterministic continuity gate; do not continue if an application looks empty.
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
  stream_office_worker office-prepare || office_rc=$?
  if [ "$office_rc" -eq "$NO_MUTATION_EXIT" ]; then
    trap - ERR INT TERM HUP
    close_rescue
    say "PRECHECK BLOCKED — no live state changed on either host; rescue connection closed."
    exit 1
  fi
  if [ "$office_rc" -ne 0 ]; then
    mac_abort "$office_rc"
  fi
  mac_snapshot_paths
  phase 2 "two-host mutation readiness"
  say "[READY] Office and MacBook backups, Codex continuity baselines, and preverified rollback trees are complete."
  say "[READY] No live configuration or runtime path has changed on either host."
  printf 'Type ACTIVATE to cross the first live mutation boundary, or anything else to stop safely: ' >&2
  IFS= read -r answer
  if [ "$answer" != ACTIVATE ]; then
    trap - ERR INT TERM HUP
    receipt_note "$LOCAL_RECEIPT" "- Activation declined after complete preparation; no live path changed"
    close_rescue
    say "STOPPED SAFELY — preparation receipts and verified backups were retained; no live path changed."
    exit 1
  fi
  office_rc=0
  stream_office_worker office-commit || office_rc=$?
  if [ "$office_rc" -eq "$NO_MUTATION_EXIT" ]; then
    trap - ERR INT TERM HUP
    close_rescue
    say "PRE-MUTATION BLOCKED — both hosts remain unchanged; verified preparation receipts were retained."
    exit 1
  fi
  if [ "$office_rc" -ne 0 ]; then
    mac_abort "$office_rc"
  fi
  mac_phase6_activate
  fresh_connectivity
  # Capture recursive topology evidence while every affected application is
  # still closed. Finalization after Phase 9 must never scan volatile runtimes.
  record_host_metadata "macbook-after" /Users/Steve "$LOCAL_RECEIPT/metadata-after.tsv"
  stream_office_worker office-post-change-metadata
  if ! prompt_acceptance; then
    say "Close the reopened affected applications, then type ROLLBACK to restore the pre-migration state."
    IFS= read -r answer
    [ "$answer" = "ROLLBACK" ] || fail "application acceptance failed; rescue left open for manual rollback"
    mac_rollback
    stream_office_rollback
    close_rescue
    trap - ERR INT TERM HUP
    fail "application acceptance failed; rollback completed"
  fi
  phase 10 "final receipt"
  write_phase_state "$LOCAL_RECEIPT" 10 "PASS"
  receipt_note "$LOCAL_RECEIPT" "- Completed UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  receipt_note "$LOCAL_RECEIPT" "- Final canonical Brain: $EXPECTED_COMMIT"
  receipt_note "$LOCAL_RECEIPT" "- Final MacBook Brain: $EXPECTED_COMMIT"
  receipt_note "$LOCAL_RECEIPT" "- Final Mind: $MIND_COMMIT"
  receipt_note "$LOCAL_RECEIPT" "- Backups intentionally retained; cleanup and model/app deletion remain deferred"
  rescue_remote /bin/bash -s -- office-finalize --run-id "$RUN_ID" --expected-commit "$EXPECTED_COMMIT" < "$SELF"
  close_rescue
  trap - ERR INT TERM HUP
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
  say "READ-ONLY DRY-RUN INSPECTION PASS — current two-host topology inspected; no mutation attempted."
  say "[BOUNDARY] This is not a future execution guarantee. Execute performs the full two-host preparation, then stops for explicit ACTIVATE before its first live change."
}

mac_top_level_rollback() {
  validate_run_id
  LOCAL_RECEIPT="$MAC_RECEIPTS/$RUN_ID"
  [ "$(id -un)" = "Steve" ] || fail "rollback must be started by Steve on the MacBook"
  quiesce_orphan_application_helpers "MacBook"
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
  write_phase_state "$root" 10 "PASS"
  receipt_note "$root" "- Completed UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  receipt_note "$root" "- Final canonical Brain: $EXPECTED_COMMIT"
  receipt_note "$root" "- Final Mind: $MIND_COMMIT"
  receipt_note "$root" "- Backups/archive intentionally retained; cleanup deferred"
}

office_post_change_metadata() {
  local root="$OFFICE_RECEIPTS/$RUN_ID" phase_number
  validate_commit_arg
  validate_run_id
  phase_number="$(read_phase_number "$root")" || fail "Office phase state is unavailable before post-change metadata"
  [ "$phase_number" -ge 7 ] || fail "Office is not ready for post-change metadata: $phase_number"
  quiesce_orphan_application_helpers "Office"
  check_no_forbidden_processes "Office"
  record_host_metadata "office-after" /Users/Office "$root/metadata-after.tsv"
  receipt_note "$root" "- Deterministic Codex continuity and post-change topology captured before application reopen"
}

fixture_test() {
  [ "${HOST_ACTIVATION_TEST_MODE:-0}" = 1 ] || fail "fixture mode is test-only"
  local root="$1" root_parent source live receipt digest_before before_db_digest primary_group alternate_group orphan_alive
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
  ln "$source/history/entry" "$source/history/hardlink-entry"
  chmod +a "user:$(id -un) allow read" "$source/history/entry"
  mkdir -p "$source/ipc"
  /usr/bin/ruby -rsocket -e 'server = UNIXServer.new(ARGV.fetch(0)); server.close' "$source/ipc/ipc.sock"
  [ -S "$source/ipc/ipc.sock" ] || fail "fixture Unix socket was not created"
  metadata_line "fixture-runtime-with-socket" "$source" "$root/metadata.tsv"
  grep -Fq 'fixture-runtime-with-socket' "$root/metadata.tsv" || fail "metadata omitted the runtime containing a Unix socket"
  [ -S "$source/ipc/ipc.sock" ] || fail "metadata inspection changed the fixture Unix socket"
  xattr() { return 1; }
  if metadata_line "fixture-xattr-read-failure" "$source" "$root/metadata-failure.tsv" 2>/dev/null; then
    fail "metadata accepted an incomplete xattr scan"
  fi
  unset -f xattr
  [ ! -s "$root/metadata-failure.tsv" ] || fail "failed metadata inspection wrote a partial row"
  find() { return 1; }
  if metadata_line "fixture-find-failure" "$source" "$root/metadata-find-failure.tsv" 2>/dev/null; then
    fail "metadata accepted an incomplete object enumeration"
  fi
  unset -f find
  [ ! -s "$root/metadata-find-failure.tsv" ] || fail "failed object enumeration wrote a partial metadata row"
  ln -s "$source" "$live"
  copy_tree "$source" "$receipt/staging/runtime/app"
  [ ! -e "$receipt/staging/runtime/app/ipc/ipc.sock" ] || fail "runtime copy retained a process-owned Unix socket"
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

  mkdir -p "$root/missing-snapshot"
  printf 'live-must-remain\n' > "$root/missing-snapshot/live"
  if restore_snapshot_copy "$root/missing-snapshot/live" "$root/missing-snapshot/not-created" "$root/missing-snapshot/failed-live" 2>/dev/null; then
    fail "copy restore accepted a missing snapshot"
  fi
  [ "$(cat "$root/missing-snapshot/live")" = live-must-remain ] || fail "missing snapshot moved or changed the live path"
  [ ! -e "$root/missing-snapshot/failed-live" ] || fail "missing snapshot preserved the live path in the failure area"
  if restore_snapshot "$root/missing-snapshot/live" "$root/missing-snapshot/not-created" "$root/missing-snapshot/failed-full-live" 2>/dev/null; then
    fail "full restore accepted a missing snapshot"
  fi
  [ "$(cat "$root/missing-snapshot/live")" = live-must-remain ] || fail "missing full snapshot moved or changed the live path"

  mkdir -p "$root/path-commit-gate"
  printf 'prepared-config\n' > "$root/path-commit-gate/snapshot"
  cp -p "$root/path-commit-gate/snapshot" "$root/path-commit-gate/live"
  verify_path_matches_snapshot "$root/path-commit-gate/live" "$root/path-commit-gate/snapshot" "fixture path"
  printf 'late-writer\n' > "$root/path-commit-gate/live"
  if verify_path_matches_snapshot "$root/path-commit-gate/live" "$root/path-commit-gate/snapshot" "fixture changed path" 2>/dev/null; then
    fail "pre-mutation path gate accepted a late config writer"
  fi
  [ "$(cat "$root/path-commit-gate/snapshot")" = prepared-config ] || fail "pre-mutation path gate changed its snapshot"

  mkdir -p "$root/unsupported/source"
  mkfifo "$root/unsupported/source/fifo"
  if copy_tree "$root/unsupported/source" "$root/unsupported/copy" 2>/dev/null; then
    fail "copy accepted an unsupported FIFO"
  fi
  [ ! -e "$root/unsupported/copy" ] || fail "unsupported-object rejection created a partial copy"
  unlink "$root/unsupported/source/fifo"

  mkdir -p "$root/portable-digest/source" "$root/portable-digest/copy"
  printf 'portable-content\n' > "$root/portable-digest/source/state"
  cp -p "$root/portable-digest/source/state" "$root/portable-digest/copy/state"
  xattr -w com.brain.host-activation-test stable "$root/portable-digest/source/state"
  xattr -w com.brain.host-activation-test stable "$root/portable-digest/copy/state"
  primary_group="$(id -g)"
  alternate_group="$(id -G | tr ' ' '\n' | awk -v primary="$primary_group" '$0 != primary {print; exit}')"
  if [ -n "$alternate_group" ]; then
    chgrp "$primary_group" "$root/portable-digest/source/state"
    chgrp "$alternate_group" "$root/portable-digest/copy/state"
  fi
  touch -t 202001010000 "$root/portable-digest/source"
  touch -t 202101010000 "$root/portable-digest/copy"
  [ "$(tree_digest "$root/portable-digest/source")" = "$(tree_digest "$root/portable-digest/copy")" ] || fail "portable digest rejected equivalent copied state"
  if [ -n "$alternate_group" ]; then
    chmod 0640 "$root/portable-digest/source/state" "$root/portable-digest/copy/state"
    [ "$(tree_digest "$root/portable-digest/source")" != "$(tree_digest "$root/portable-digest/copy")" ] || fail "portable digest ignored a security-relevant group change"
    chmod 0644 "$root/portable-digest/source/state" "$root/portable-digest/copy/state"
    chgrp "$primary_group" "$root/portable-digest/source" "$root/portable-digest/copy"
    chgrp "$alternate_group" "$root/portable-digest/copy"
    chmod 2755 "$root/portable-digest/source" "$root/portable-digest/copy"
    [ "$(tree_digest "$root/portable-digest/source")" != "$(tree_digest "$root/portable-digest/copy")" ] || fail "portable digest ignored a setgid-directory group change"
    chgrp "$primary_group" "$root/portable-digest/copy"
    chmod 0755 "$root/portable-digest/source" "$root/portable-digest/copy"
  fi
  xattr -w com.brain.host-activation-test changed "$root/portable-digest/copy/state"
  [ "$(tree_digest "$root/portable-digest/source")" != "$(tree_digest "$root/portable-digest/copy")" ] || fail "portable digest ignored a meaningful xattr change"
  mkdir -p "$root/portable-digest/failing-bin"
  printf '#!/bin/sh\nexit 1\n' > "$root/portable-digest/failing-bin/stat"
  chmod 0700 "$root/portable-digest/failing-bin/stat"
  if PATH="$root/portable-digest/failing-bin:$PATH" tree_digest "$root/portable-digest/source" >/dev/null 2>&1; then
    fail "portable digest accepted an incomplete metadata stream"
  fi

  mkdir -p "$root/stable-copy/source"
  printf 'stable-state\n' > "$root/stable-copy/source/state"
  stable_copy_tree "$root/stable-copy/source" "$root/stable-copy/destination" \
    "fixture-stable-copy" "$root/stable-copy/integrity.tsv"
  [ "$(tree_digest "$root/stable-copy/source")" = "$(tree_digest "$root/stable-copy/destination")" ] || fail "stable snapshot fixture changed content"

  mkdir -p "$root/stable-path"
  printf 'narrow-config\n' > "$root/stable-path/source"
  chmod 0600 "$root/stable-path/source"
  chmod +a "user:$(id -un) allow read" "$root/stable-path/source"
  xattr -w com.brain.host-activation-test narrow-xattr "$root/stable-path/source"
  stable_copy_path_snapshot "$root/stable-path/source" "$root/stable-path/snapshot" \
    "fixture-stable-path" "$root/stable-path/integrity.tsv"
  [ "$(path_digest "$root/stable-path/source")" = "$(snapshot_path_digest "$root/stable-path/snapshot")" ] || fail "narrow snapshot lost content or metadata"
  ln -s relative-target "$root/stable-path/source-link"
  stable_copy_path_snapshot "$root/stable-path/source-link" "$root/stable-path/snapshot-link" \
    "fixture-stable-symlink" "$root/stable-path/integrity.tsv"
  [ "$(path_digest "$root/stable-path/source-link")" = "$(snapshot_path_digest "$root/stable-path/snapshot-link")" ] || fail "narrow symlink snapshot lost target or metadata"
  stable_copy_path_snapshot "$root/stable-path/missing" "$root/stable-path/snapshot-missing" \
    "fixture-stable-missing" "$root/stable-path/integrity.tsv"
  [ "$(snapshot_path_digest "$root/stable-path/snapshot-missing")" = missing ] || fail "missing-path snapshot is ambiguous"

  mkdir -p "$root/unstable-path"
  printf 'narrow-writer\n' > "$root/unstable-path/source"
  if HOST_ACTIVATION_TEST_MUTATE_PATH_SOURCE=1 stable_copy_path_snapshot \
    "$root/unstable-path/source" "$root/unstable-path/snapshot" \
    "fixture-unstable-path" "$root/unstable-path/integrity.tsv" 2>/dev/null; then
    fail "narrow snapshot accepted a path that changed during both attempts"
  fi
  [ -e "$root/unstable-path/snapshot.unstable-attempt-1" ] && \
    [ -e "$root/unstable-path/snapshot.unstable-attempt-2" ] || fail "unstable narrow snapshots were not retained"

  mkdir -p "$root/unstable-copy/source"
  printf 'writer-state\n' > "$root/unstable-copy/source/state"
  if HOST_ACTIVATION_TEST_MUTATE_SOURCE=1 stable_copy_tree \
    "$root/unstable-copy/source" "$root/unstable-copy/destination" \
    "fixture-unstable-copy" "$root/unstable-copy/integrity.tsv" 2>/dev/null; then
    fail "stable snapshot accepted a source that changed during both attempts"
  fi
  [ ! -e "$root/unstable-copy/destination" ] || fail "unstable snapshot left a destination that could be mistaken for verified"
  [ -d "$root/unstable-copy/destination.unstable-attempt-1" ] && \
    [ -d "$root/unstable-copy/destination.unstable-attempt-2" ] || fail "unstable snapshot attempts were not preserved"

  mkdir -p "$root/copy-failure/source"
  printf 'source-survives\n' > "$root/copy-failure/source/state"
  if HOST_ACTIVATION_TEST_COPY_FAILURE=1 stable_copy_tree \
    "$root/copy-failure/source" "$root/copy-failure/destination" \
    "fixture-copy-failure" "$root/copy-failure/integrity.tsv" 2>/dev/null; then
    fail "stable snapshot accepted a partial copy failure"
  fi
  [ ! -e "$root/copy-failure/destination" ] || fail "partial copy remained at the verified destination path"
  [ -f "$root/copy-failure/destination.copy-failure-attempt-1/partial" ] || fail "partial copy failure was not preserved for diagnosis"
  [ "$(cat "$root/copy-failure/source/state")" = source-survives ] || fail "copy failure changed its source"

  mkdir -p "$root/prepared-restore/snapshot" "$root/prepared-restore/live"
  printf 'original-session\n' > "$root/prepared-restore/snapshot/session"
  printf 'changed-session\n' > "$root/prepared-restore/live/session"
  prepare_tree_restore_stage \
    "$root/prepared-restore/snapshot" "$root/prepared-restore/stage" \
    "fixture-rollback-stage" "$root/prepared-restore/integrity.tsv"
  activate_prepared_restore_tree \
    "$root/prepared-restore/live" "$root/prepared-restore/snapshot" "$root/prepared-restore/stage" \
    "$root/prepared-restore/failed-live" "fixture-rollback" "$root/prepared-restore/integrity.tsv"
  [ "$(cat "$root/prepared-restore/live/session")" = original-session ] || fail "prepared atomic restore did not restore original state"
  [ "$(cat "$root/prepared-restore/failed-live/session")" = changed-session ] || fail "prepared atomic restore did not preserve failed state"
  [ "$(cat "$root/prepared-restore/snapshot/session")" = original-session ] || fail "prepared atomic restore consumed its immutable snapshot"

  mkdir -p "$root/hardlinks/source"
  printf 'shared-inode\n' > "$root/hardlinks/source/one"
  ln "$root/hardlinks/source/one" "$root/hardlinks/source/two"
  copy_tree "$root/hardlinks/source" "$root/hardlinks/copy"
  verify_tree_copy "$root/hardlinks/source" "$root/hardlinks/copy" "fixture-hardlinks" "$root/hardlinks/integrity.tsv"
  [ "$(stat -f '%i' "$root/hardlinks/copy/one")" = "$(stat -f '%i' "$root/hardlinks/copy/two")" ] || fail "copy did not preserve hard-link topology"
  cp -p "$root/hardlinks/copy/two" "$root/hardlinks/copy/replacement"
  mv "$root/hardlinks/copy/replacement" "$root/hardlinks/copy/two"
  [ "$(tree_digest "$root/hardlinks/source")" != "$(tree_digest "$root/hardlinks/copy")" ] || fail "tree digest ignored broken hard-link topology"

  mkdir -p "$root/rebuild-restore/snapshot" "$root/rebuild-restore/live"
  printf 'rollback-original\n' > "$root/rebuild-restore/snapshot/session"
  printf 'live-remains\n' > "$root/rebuild-restore/live/session"
  prepare_tree_restore_stage \
    "$root/rebuild-restore/snapshot" "$root/rebuild-restore/stage" \
    "fixture-rebuild-stage" "$root/rebuild-restore/integrity.tsv"
  printf 'corrupt-stage\n' > "$root/rebuild-restore/stage/session"
  ensure_tree_restore_stage \
    "$root/rebuild-restore/snapshot" "$root/rebuild-restore/stage" \
    "fixture-rebuild-stage" "$root/rebuild-restore/integrity.tsv"
  trees_match "$root/rebuild-restore/snapshot" "$root/rebuild-restore/stage" || fail "corrupt restore stage was not safely rebuilt"
  [ "$(cat "$root/rebuild-restore/live/session")" = live-remains ] || fail "restore-stage rebuild touched the live root"
  find "$root/rebuild-restore" -maxdepth 1 -type d -name 'stage.rejected-*' | grep -q . || fail "corrupt restore stage was not preserved"

  mkdir -p "$root/continuity/before/sessions" "$root/continuity/after/sessions"
  printf 'conversation\n' > "$root/continuity/before/sessions/thread.jsonl"
  cp -p "$root/continuity/before/sessions/thread.jsonl" "$root/continuity/after/sessions/thread.jsonl"
  sqlite3 "$root/continuity/before/state_5.sqlite" \
    "PRAGMA journal_mode=WAL; CREATE TABLE threads(id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, title TEXT NOT NULL); INSERT INTO threads VALUES('fixture-thread','/legacy/codex/sessions/thread.jsonl','fixture');" >/dev/null
  sqlite3 "$root/continuity/after/state_5.sqlite" \
    "PRAGMA journal_mode=WAL; CREATE TABLE threads(id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, title TEXT NOT NULL); INSERT INTO threads VALUES('fixture-thread','/final/codex/sessions/thread.jsonl','fixture');" >/dev/null
  before_db_digest="$(codex_sqlite_set_digest "$root/continuity/before")"
  probe_codex_database \
    "$root/continuity/before" "fixture Codex" /legacy/codex /final/codex >/dev/null
  [ "$before_db_digest" = "$(codex_sqlite_set_digest "$root/continuity/before")" ] || fail "private SQLite probe changed its source database family"
  codex_continuity_manifest \
    "$root/continuity/before" "$root/continuity/before.tsv" /legacy/codex /final/codex
  assert_codex_continuity \
    "$root/continuity/before.tsv" "$root/continuity/after" /legacy/codex /final/codex "fixture"
  sqlite3 "$root/continuity/after/state_5.sqlite" \
    "UPDATE threads SET rollout_path='/outside/codex/sessions/thread.jsonl';" >/dev/null
  if probe_codex_database \
    "$root/continuity/after" "fixture Codex preflight" /legacy/codex /final/codex 2>/dev/null; then
    fail "Codex preflight accepted an indexed thread outside the protected runtime roots"
  fi
  if codex_continuity_manifest \
    "$root/continuity/after" "$root/continuity/outside.tsv" /legacy/codex /final/codex 2>/dev/null; then
    fail "Codex continuity accepted an indexed thread outside the protected runtime roots"
  fi
  sqlite3 "$root/continuity/after/state_5.sqlite" \
    "UPDATE threads SET rollout_path='/final/codex/sessions/missing.jsonl';" >/dev/null
  if codex_continuity_manifest \
    "$root/continuity/after" "$root/continuity/missing.tsv" /legacy/codex /final/codex 2>/dev/null; then
    fail "Codex continuity accepted a missing indexed thread rollout file"
  fi
  sqlite3 "$root/continuity/after/state_5.sqlite" \
    "UPDATE threads SET rollout_path='/final/codex/sessions/thread.jsonl';" >/dev/null
  printf 'lost-context\n' >> "$root/continuity/after/sessions/thread.jsonl"
  if assert_codex_continuity \
    "$root/continuity/before.tsv" "$root/continuity/after" /legacy/codex /final/codex "fixture-corrupt" 2>/dev/null; then
    fail "Codex continuity gate accepted changed conversation content"
  fi

  mkdir -p "$root/runtime-continuity/before/sessions" "$root/runtime-continuity/after/sessions"
  printf 'private-history\n' > "$root/runtime-continuity/before/sessions/history.jsonl"
  cp -p "$root/runtime-continuity/before/sessions/history.jsonl" "$root/runtime-continuity/after/sessions/history.jsonl"
  printf 'old-managed-settings\n' > "$root/runtime-continuity/before/settings.json"
  printf 'new-managed-settings\n' > "$root/runtime-continuity/after/settings.json"
  runtime_continuity_manifest \
    "$root/runtime-continuity/before" claude "$root/runtime-continuity/before.tsv"
  assert_runtime_continuity \
    "$root/runtime-continuity/before.tsv" "$root/runtime-continuity/after" claude "fixture"
  printf 'lost-private-history\n' >> "$root/runtime-continuity/after/sessions/history.jsonl"
  if assert_runtime_continuity \
    "$root/runtime-continuity/before.tsv" "$root/runtime-continuity/after" claude "fixture-corrupt" 2>/dev/null; then
    fail "runtime continuity gate accepted changed private history"
  fi

  orphan_alive=1
  pgrep() {
    if [ "${2:-}" = SkyComputerUseService ] && [ "$orphan_alive" -eq 1 ]; then printf '4242\n'; else return 1; fi
  }
  ps() { printf '1\n'; }
  kill() {
    [ "${1:-}" = -TERM ] && [ "${2:-}" = 4242 ] || return 1
    orphan_alive=0
  }
  sleep() { :; }
  quiesce_orphan_application_helpers "fixture" >/dev/null
  [ "$orphan_alive" -eq 0 ] || fail "detached application helper was not asked to exit gracefully"
  unset -f pgrep ps kill sleep

  pgrep() {
    [ "${2:-}" != ChatGPTHelper ] || fail "unrelated ChatGPT UI helper was queried for termination"
    return 1
  }
  ps() { printf '1\n'; }
  kill() { fail "unrelated ChatGPT UI helper was signaled"; }
  quiesce_orphan_application_helpers "fixture" >/dev/null
  unset -f pgrep ps kill

  pgrep() { return 1; }
  ps() { fail "idle shell process table was queried by application quiescence"; }
  # Idle shells do not own application runtime roots. The prior process-table
  # scan could see its own process-substitution Bash and block the launcher.
  check_no_forbidden_processes "fixture" >/dev/null
  unset -f pgrep ps

  trusted_ed25519_key() {
    case "$1" in
      fixed-one|fixed-two|scan-wrong|expected-alias) printf 'ssh-ed25519 fixture-key\n' ;;
      fixed-mismatch|wrong-alias) printf 'ssh-ed25519 wrong-key\n' ;;
    esac
  }
  scanned_ed25519_key() {
    case "$1" in
      fixed-one|fixed-two) printf 'ssh-ed25519 fixture-key\n' ;;
      fixed-mismatch|scan-wrong) printf 'ssh-ed25519 wrong-key\n' ;;
    esac
  }
  : > "$root/known-hosts-fixture"
  validate_hostkey_alias_inputs expected-alias fixed-one fixed-two "$root/known-hosts-fixture" >/dev/null
  validate_hostkey_alias_inputs absent-alias fixed-one fixed-two "$root/known-hosts-fixture" >/dev/null
  if validate_hostkey_alias_inputs wrong-alias fixed-one fixed-two "$root/known-hosts-fixture" >/dev/null 2>&1; then
    fail "HostKeyAlias preflight accepted a mismatched existing alias key"
  fi
  if validate_hostkey_alias_inputs absent-alias fixed-one fixed-mismatch "$root/known-hosts-fixture" >/dev/null 2>&1; then
    fail "HostKeyAlias preflight accepted disagreeing trusted fixed-address keys"
  fi
  if validate_hostkey_alias_inputs absent-alias fixed-one scan-wrong "$root/known-hosts-fixture" >/dev/null 2>&1; then
    fail "HostKeyAlias preflight accepted a live key that differs from the trusted key"
  fi
  if validate_hostkey_alias_inputs absent-alias fixed-one fixed-two "$root/missing-known-hosts" >/dev/null 2>&1; then
    fail "HostKeyAlias preflight accepted a missing known_hosts file"
  fi
  unset -f trusted_ed25519_key scanned_ed25519_key

  printf '{}\n' > "$root/valid-registry.json"
  printf 'not-json\n' > "$root/invalid-registry.json"
  printf '[]\n' > "$root/array-registry.json"
  validate_json_object_file "$root/valid-registry.json" "fixture registry" >/dev/null
  if validate_json_object_file "$root/invalid-registry.json" "fixture registry" >/dev/null 2>&1; then
    fail "JSON-object preflight accepted malformed registry state"
  fi
  if validate_json_object_file "$root/array-registry.json" "fixture registry" >/dev/null 2>&1; then
    fail "JSON-object preflight accepted a non-object registry"
  fi

  phase_is_no_mutation 0 && phase_is_no_mutation 1 && phase_is_no_mutation 2 || fail "Phase 0–2 no-mutation classification failed"
  if phase_is_no_mutation 3; then fail "Phase 3 was incorrectly classified as no-mutation"; fi
  [ "$(normalize_failure_exit "$NO_MUTATION_EXIT")" = 1 ] || fail "reserved no-mutation exit escaped a mutation failure"
  say "fixture rollback tests passed"
}

parse_args "$@"
case "$ACTION" in
  dry-run) mac_dry_run ;;
  execute) mac_execute ;;
  rollback) mac_top_level_rollback ;;
  office-dry-run) office_dry_run ;;
  office-apply) office_apply ;;
  office-prepare) office_prepare ;;
  office-commit) office_commit ;;
  office-rollback) office_rollback ;;
  office-restore-ssh) validate_run_id; office_restore_ssh_only ;;
  office-connectivity) validate_run_id; office_connectivity_acceptance ;;
  office-finalize) office_finalize ;;
  office-post-change-metadata) office_post_change_metadata ;;
  __fixture-test)
    [ -n "$TEST_FIXTURE_ROOT" ] || fail "fixture root required"
    fixture_test "$TEST_FIXTURE_ROOT"
    ;;
  -h|--help|help) usage ;;
  *) usage; fail "unknown action: $ACTION" ;;
esac
