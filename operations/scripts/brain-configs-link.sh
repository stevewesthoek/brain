#!/usr/bin/env bash
set -euo pipefail

# Brain workstation configuration bootstrap.
# Canonical policy: operations/specs/workstation-config-ownership.json
# Migration runbook: operations/runbooks/workstation-config-ownership.md
#
# This script is intentionally conservative:
# - mutable IDE/LLM runtime roots must be real local directories;
# - only narrow approved configuration entries are symlinked;
# - Codex config.toml is a physical generated copy managed by
#   codex-home-managed-root.sh;
# - Git and SSH use physical root configs with native include directives;
# - existing legacy whole-root symlinks fail closed and require the controlled
#   migration runbook instead of being rewritten in place.

SCRIPT_REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="${BRAIN_REPO:-$SCRIPT_REPO_ROOT}"
CONFIG_DIR="${CONFIGS_DIR:-$ROOT/operations/system-configs}"
HOME_DIR="${HOME:?HOME must be set}"
DRY_RUN="${DRY_RUN:-0}"
BACKUP_DIR="${BRAIN_CONFIG_BACKUP_DIR:-$HOME_DIR/.brain-config-backups/$(date +%Y%m%d-%H%M%S)}"
MIGRATION_REQUIRED=0

say() {
  printf '%s\n' "$*" >&2
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

backup_existing() {
  local target="$1"
  local relative="$2"
  if [ ! -e "$target" ] && [ ! -L "$target" ]; then
    return 0
  fi
  local backup="$BACKUP_DIR/$relative"
  say "[backup] $target -> $backup"
  run mkdir -p "$(dirname -- "$backup")"
  run mv "$target" "$backup"
}

resolved_link() {
  local target="$1"
  [ -L "$target" ] || return 1
  local raw
  raw="$(readlink "$target")" || return 1
  if [[ "$raw" = /* ]]; then
    printf '%s\n' "$raw"
  else
    local dir
    dir="$(cd -P -- "$(dirname -- "$target")" && pwd)"
    printf '%s/%s\n' "$dir" "$raw"
  fi
}

ensure_symlink() {
  local source="$1"
  local target="$2"
  local backup_relative="$3"
  [ -e "$source" ] || { say "[ERROR] missing managed source: $source"; return 1; }

  if [ -L "$target" ]; then
    local actual
    actual="$(resolved_link "$target" 2>/dev/null || true)"
    if [ "$actual" = "$source" ]; then
      say "[ok] $target -> $source"
      return 0
    fi
  fi

  backup_existing "$target" "$backup_relative"
  run mkdir -p "$(dirname -- "$target")"
  run ln -s "$source" "$target"
  say "[linked] $target -> $source"
}

mark_migration_required() {
  say "[migration-required] $1"
  MIGRATION_REQUIRED=1
}

preflight_runtime_root() {
  local root="$1"
  if [ -L "$root" ]; then
    mark_migration_required "$root is a legacy whole-root symlink. Preserve sessions/auth/runtime state and follow operations/runbooks/workstation-config-ownership.md."
  elif [ -e "$root" ] && [ ! -d "$root" ]; then
    mark_migration_required "$root exists but is not a directory."
  fi
}

preflight_include_root() {
  local file="$1"
  local marker="$2"
  if [ -L "$file" ]; then
    mark_migration_required "$file is a legacy direct config symlink. Convert it with the controlled INCLUDE migration; do not overwrite it in bootstrap."
  elif [ -e "$file" ] && [ ! -f "$file" ]; then
    mark_migration_required "$file exists but is not a regular file."
  elif [ -f "$file" ] && ! grep -Fq "$marker" "$file"; then
    mark_migration_required "$file is an existing physical config not yet owned by the Brain INCLUDE contract. Preserve it and convert it through the controlled migration instead of overwriting it."
  fi
}

# Fail closed before changing anything when legacy roots require state-preserving
# migration. This protects Claude/Cursor/Gemini/Kiro/Codex sessions and the SSH
# topology used by the Office Mac and MacBook.
for runtime_root in \
  "$HOME_DIR/.claude" \
  "$HOME_DIR/.cursor" \
  "$HOME_DIR/.gemini" \
  "$HOME_DIR/.kiro" \
  "$HOME_DIR/.codex"; do
  preflight_runtime_root "$runtime_root"
done
preflight_include_root "$HOME_DIR/.gitconfig" "# Managed by Brain workstation config: Git INCLUDE root"
preflight_include_root "$HOME_DIR/.ssh/config" "# Managed by Brain workstation config: SSH INCLUDE root"

if [ "$MIGRATION_REQUIRED" -ne 0 ]; then
  say "[STOP] Legacy configuration ownership detected. No changes were made."
  say "[STOP] Run the controlled, receipt-backed migration documented in:"
  say "       $ROOT/operations/runbooks/workstation-config-ownership.md"
  say "[STOP] Office↔MacBook network contract:"
  say "       $ROOT/operations/runbooks/office-macbook-connectivity.md"
  exit 2
fi

# Fresh/newly migrated machines get physical runtime roots first.
for runtime_root in \
  "$HOME_DIR/.claude" \
  "$HOME_DIR/.cursor" \
  "$HOME_DIR/.gemini" \
  "$HOME_DIR/.kiro" \
  "$HOME_DIR/.codex"; do
  run mkdir -p "$runtime_root"
done

# Narrow SYMLINK ownership only. Mutable runtime roots stay local.
ensure_symlink "$CONFIG_DIR/claude/CLAUDE.md" "$HOME_DIR/.claude/CLAUDE.md" "claude/CLAUDE.md"
ensure_symlink "$CONFIG_DIR/claude/settings.json" "$HOME_DIR/.claude/settings.json" "claude/settings.json"
ensure_symlink "$CONFIG_DIR/claude/hooks" "$HOME_DIR/.claude/hooks" "claude/hooks"
ensure_symlink "$CONFIG_DIR/claude/agents" "$HOME_DIR/.claude/agents" "claude/agents"
ensure_symlink "$CONFIG_DIR/claude/skills" "$HOME_DIR/.claude/skills" "claude/skills"
ensure_symlink "$CONFIG_DIR/claude/statusline-command.sh" "$HOME_DIR/.claude/statusline-command.sh" "claude/statusline-command.sh"

ensure_symlink "$CONFIG_DIR/cursor/skills" "$HOME_DIR/.cursor/skills" "cursor/skills"
ensure_symlink "$CONFIG_DIR/gemini/GEMINI.md" "$HOME_DIR/.gemini/GEMINI.md" "gemini/GEMINI.md"
ensure_symlink "$CONFIG_DIR/kiro/steering" "$HOME_DIR/.kiro/steering" "kiro/steering"

# Stable dotfiles remain eligible for direct narrow symlinks.
ensure_symlink "$CONFIG_DIR/shell/.zshrc" "$HOME_DIR/.zshrc" "shell/.zshrc"
ensure_symlink "$CONFIG_DIR/shell/.zprofile" "$HOME_DIR/.zprofile" "shell/.zprofile"
ensure_symlink "$CONFIG_DIR/ghostty/config" "$HOME_DIR/.config/ghostty/config" "ghostty/config"
ensure_symlink "$CONFIG_DIR/starship/starship.toml" "$HOME_DIR/.config/starship.toml" "starship/starship.toml"

# Git INCLUDE root. Brain owns reproducible intent; machine-local overlays remain
# physical and untracked.
write_git_include_root() {
  local target="$HOME_DIR/.gitconfig"
  local managed="$CONFIG_DIR/git/gitconfig"
  local local_overlay="$HOME_DIR/.gitconfig.local"
  local staged

  if [ "$DRY_RUN" -eq 1 ]; then
    say "[dry-run] Would materialize physical Git include root at $target"
    return 0
  fi

  staged="$(mktemp "$HOME_DIR/.gitconfig.generated.XXXXXX")"
  {
    printf '# Managed by Brain workstation config: Git INCLUDE root\n'
    printf '[include]\n\tpath = %s\n' "$managed"
    if [ -f "$local_overlay" ]; then
      printf '[include]\n\tpath = %s\n' "$local_overlay"
    fi
  } > "$staged"
  chmod 0600 "$staged"
  mv "$staged" "$target"
  say "[generated] $target (Git INCLUDE root)"
}

# SSH INCLUDE root. Private keys and known_hosts remain local-only. The tracked
# include owns stable Office↔MacBook aliases/routing; DHCP Wi-Fi IPs are not
# canonical workstation identities.
write_ssh_include_root() {
  local ssh_dir="$HOME_DIR/.ssh"
  local target="$ssh_dir/config"
  local managed="$CONFIG_DIR/ssh/config"
  local local_overlay="$ssh_dir/config.local"
  local staged

  run mkdir -p "$ssh_dir"
  if [ "$DRY_RUN" -eq 1 ]; then
    say "[dry-run] Would materialize physical SSH include root at $target"
    return 0
  fi

  staged="$(mktemp "$ssh_dir/.config.generated.XXXXXX")"
  {
    printf '# Managed by Brain workstation config: SSH INCLUDE root\n'
    printf 'Include %s\n' "$managed"
    if [ -f "$local_overlay" ]; then
      printf 'Include %s\n' "$local_overlay"
    fi
  } > "$staged"
  chmod 0600 "$staged"
  mv "$staged" "$target"
  say "[generated] $target (SSH INCLUDE root)"
}

write_git_include_root
write_ssh_include_root

# Codex must keep a short physical ~/.codex root for the macOS app-server Unix
# socket used by MacBook→Office Remote SSH. The manager preserves sessions/auth
# and materializes config.toml as a physical mode-0600 GENERATED-COPY.
CODEX_MANAGER="$SCRIPT_REPO_ROOT/operations/scripts/codex-home-managed-root.sh"
if [ "$DRY_RUN" -eq 1 ] && [ ! -d "$HOME_DIR/.codex" ]; then
  say "[dry-run] Would run Codex managed-root repair after creating physical ~/.codex"
else
  DRY_RUN="$DRY_RUN" \
    BRAIN_REPO="$ROOT" \
    CONFIGS_DIR="$CONFIG_DIR" \
    CODEX_HOME="$HOME_DIR/.codex" \
    bash "$CODEX_MANAGER" repair
fi

# Validate canonical repo-owned policy after materialization. Host migration
# acceptance still requires application/session smoke tests and Office↔MacBook SSH checks.
node "$SCRIPT_REPO_ROOT/tools/validate-workstation-config-ownership.mjs"

say "[done] Brain workstation configuration bootstrap completed."
say "[note] Live session/auth/runtime state remains application-owned and local."
say "[note] For migrated hosts, complete the runbook acceptance checks before deleting any backup."
