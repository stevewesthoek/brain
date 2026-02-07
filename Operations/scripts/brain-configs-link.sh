#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Brain configs linker
#
# Centralizes local dev config into:
#   $BRAIN_REPO/Operations/system-configs
#
# Symlinks created:
#   ~/.ssh/config                         -> $CONFIGS_DIR/ssh/config
#   ~/.gitconfig                          -> $CONFIGS_DIR/git/gitconfig
#   ~/.zshrc                              -> $CONFIGS_DIR/shell/.zshrc
#   ~/.zprofile                           -> $CONFIGS_DIR/shell/.zprofile
#   ~/.config/ghostty/config              -> $CONFIGS_DIR/ghostty/config
#   ~/Library/Application Support/com.mitchellh.ghostty/config
#                                        -> $CONFIGS_DIR/ghostty/config
#   ~/.gemini                             -> $CONFIGS_DIR/gemini
#   ~/.config/starship.toml               -> $CONFIGS_DIR/starship/starship.toml
#   ~/.cursor                             -> $CONFIGS_DIR/cursor
#   ~/.codex                              -> $CONFIGS_DIR/codex
#   ~/.claude                             -> $CONFIGS_DIR/claude
#   ~/.docker                             -> $CONFIGS_DIR/docker
#
# Usage:
#   DRY_RUN=1 ./brain-configs-link.sh    # preview
#   ./brain-configs-link.sh              # apply
###############################################################################

HOME_DIR="${HOME:-$PWD}"

# Defaults – override with env if needed
BRAIN_REPO="${BRAIN_REPO:-$HOME_DIR/Repos/Personal/Brain}"
BRAIN_OPERATIONS_DIR="${BRAIN_OPERATIONS_DIR:-$BRAIN_REPO/Operations}"
CONFIGS_DIR="${CONFIGS_DIR:-$BRAIN_OPERATIONS_DIR/system-configs}"
BRAIN_AI_DIR="${BRAIN_AI_DIR:-$BRAIN_REPO/AI}"

DRY_RUN="${DRY_RUN:-0}"

BACKUP_ROOT="$HOME_DIR/.brain-configs-backups"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"

say() {
  echo "$@" >&2
}

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s' "$1" >&2
    shift || true
    for arg in "$@"; do
      printf ' %q' "$arg" >&2
    done
    printf '\n' >&2
  else
    "$@"
  fi
}

ensure_dir() {
  local dir="$1"
  run mkdir -p "$dir"
}

backup_path() {
  local src="$1"

  [ ! -e "$src" ] && return 0

  ensure_dir "$BACKUP_DIR"

  # Preserve relative layout under $HOME when possible
  local rel="${src#$HOME_DIR}"
  local dst

  if [ "$rel" = "$src" ]; then
    # Not under $HOME – just drop into backup root
    dst="$BACKUP_DIR/$(basename "$src")"
  else
    dst="$BACKUP_DIR$rel"
    ensure_dir "$(dirname "$dst")"
  fi

  say "[WARN] Backing up $src -> $dst"
  run mv "$src" "$dst"
}

resolve_link_target_abs() {
  local link="$1"
  local target
  target="$(readlink "$link")" || return 1

  local dir
  dir="$(cd "$(dirname "$link")" 2>/dev/null \
        && cd "$(dirname "$target")" 2>/dev/null \
        && pwd)" || return 1

  printf '%s/%s\n' "$dir" "$(basename "$target")"
}

link_symlink() {
  local link_path="$1"
  local target_abs="$2"
  local label="$3"

  ensure_dir "$CONFIGS_DIR"

  # Normalize absolute target
  target_abs="$(cd "$(dirname "$target_abs")" 2>/dev/null && pwd)/$(basename "$target_abs")"

  # Existing link?
  if [ -L "$link_path" ]; then
    local resolved
    resolved="$(resolve_link_target_abs "$link_path")" || resolved=""

    if [ "$resolved" = "$target_abs" ]; then
      # Already correct
      return 0
    fi

    say "[WARN] Broken or outdated symlink: $link_path (relinking)"
    if [ "$DRY_RUN" -eq 0 ]; then
      run rm -f "$link_path"
    fi
  elif [ -e "$link_path" ]; then
    # Real file/dir – back it up then replace
    say "[WARN] $link_path exists and is not a symlink; backing up before linking ($label)"
    backup_path "$link_path"
  fi

  # Ensure parent dir exists
  ensure_dir "$(dirname "$link_path")"

  # Create symlink (absolute target)
  run ln -sfn "$target_abs" "$link_path"
}

verify_link() {
  local link="$1"
  local expected_abs="$2"

  expected_abs="$(cd "$(dirname "$expected_abs")" 2>/dev/null && pwd)/$(basename "$expected_abs")"

  if [ ! -L "$link" ]; then
    say "[WARN] VERIFY missing symlink: $link"
    return
  fi

  local resolved
  resolved="$(resolve_link_target_abs "$link")" || {
    say "[WARN] VERIFY cannot resolve: $link"
    return
  }

  if [ "$resolved" != "$expected_abs" ]; then
    say "[WARN] VERIFY wrong target: $link -> $resolved (expected $expected_abs)"
  else
    say "OK: $link"
  fi
}

###############################################################################
# Start
###############################################################################

say "==> Brain repo: $BRAIN_REPO"
say
say "==> Configs dir: $CONFIGS_DIR"
say

ensure_dir "$CONFIGS_DIR"
ensure_dir "$BACKUP_ROOT"
run mkdir -p "$BACKUP_DIR"

if [ "$DRY_RUN" -eq 1 ]; then
  say "[WARN] DRY_RUN enabled: no changes will be made."
fi

###############################################################################
# SSH: ~/.ssh/config
###############################################################################
say
say "==> SSH: only ~/.ssh/config (no keys, no known_hosts)"
ensure_dir "$CONFIGS_DIR/ssh"
ensure_dir "$HOME_DIR/.ssh"
link_symlink "$HOME_DIR/.ssh/config" "$CONFIGS_DIR/ssh/config" "ssh/config"
run chmod 700 "$HOME_DIR/.ssh" || true
run chmod 600 "$CONFIGS_DIR/ssh/config" || true

###############################################################################
# Git: ~/.gitconfig
###############################################################################
say
say "==> Git: ~/.gitconfig"
ensure_dir "$CONFIGS_DIR/git"
link_symlink "$HOME_DIR/.gitconfig" "$CONFIGS_DIR/git/gitconfig" "git/gitconfig"

###############################################################################
# Shell: ~/.zshrc and ~/.zprofile
###############################################################################
say
say "==> Shell: .zshrc and .zprofile"
ensure_dir "$CONFIGS_DIR/shell"
link_symlink "$HOME_DIR/.zshrc"    "$CONFIGS_DIR/shell/.zshrc"    "shell/.zshrc"
link_symlink "$HOME_DIR/.zprofile" "$CONFIGS_DIR/shell/.zprofile" "shell/.zprofile"

###############################################################################
# Ghostty: ~/.config/ghostty/config + App Support config
###############################################################################
say
say "==> Ghostty: ~/.config/ghostty/config"
ensure_dir "$CONFIGS_DIR/ghostty"
ensure_dir "$HOME_DIR/.config/ghostty"
link_symlink "$HOME_DIR/.config/ghostty/config" \
             "$CONFIGS_DIR/ghostty/config" "ghostty/config"

say "==> Ghostty (macOS app support): ~/Library/Application Support/com.mitchellh.ghostty/config"
ensure_dir "$HOME_DIR/Library/Application Support/com.mitchellh.ghostty"
link_symlink "$HOME_DIR/Library/Application Support/com.mitchellh.ghostty/config" \
             "$CONFIGS_DIR/ghostty/config" "ghostty/config"

###############################################################################
# Gemini: ~/.gemini (folder)
###############################################################################
say
say "==> Gemini: ~/.gemini (folder)"
ensure_dir "$CONFIGS_DIR/gemini"
link_symlink "$HOME_DIR/.gemini" "$CONFIGS_DIR/gemini" "gemini"

###############################################################################
# Starship: ~/.config/starship.toml
###############################################################################
say
say "==> Starship: ~/.config/starship.toml"
ensure_dir "$CONFIGS_DIR/starship"
ensure_dir "$HOME_DIR/.config"
link_symlink "$HOME_DIR/.config/starship.toml" \
             "$CONFIGS_DIR/starship/starship.toml" "starship/starship.toml"

###############################################################################
# Cursor: ~/.cursor (skip ~/.cursor-server)
###############################################################################
say
say "==> Cursor: ~/.cursor (skip ~/.cursor-server)"
ensure_dir "$CONFIGS_DIR/cursor"
link_symlink "$HOME_DIR/.cursor" "$CONFIGS_DIR/cursor" "cursor"

###############################################################################
# AI tool configs: ~/.codex ~/.claude
###############################################################################
say
say "==> AI tool configs: ~/.codex ~/.claude (folders). (Gemini excluded.)"
ensure_dir "$CONFIGS_DIR/codex"
ensure_dir "$CONFIGS_DIR/claude"

link_symlink "$HOME_DIR/.codex"  "$CONFIGS_DIR/codex"  "codex"
link_symlink "$HOME_DIR/.claude" "$CONFIGS_DIR/claude" "claude"

if [ -f "$HOME_DIR/.claude.json" ]; then
  say "[WARN] Found ~/.claude.json. Skipping by default (might contain secrets)."
fi

###############################################################################
# Docker: ~/.docker
###############################################################################
say
say "==> Docker: managing ~/.docker (WARNING: may contain auth tokens)."
ensure_dir "$CONFIGS_DIR/docker"
link_symlink "$HOME_DIR/.docker" "$CONFIGS_DIR/docker" "docker"
say "[WARN] ~/.docker is now centralized at $CONFIGS_DIR/docker; this path should be ignored in .gitignore (which it currently is)."

###############################################################################
# Done + verify
###############################################################################
say
say "==> Done."
say "Backups (if any) are here:"
say "  $BACKUP_DIR"
say
say "==> Verifying symlinks..."

verify_link "$HOME_DIR/.ssh/config"                                  "$CONFIGS_DIR/ssh/config"
verify_link "$HOME_DIR/.gitconfig"                                   "$CONFIGS_DIR/git/gitconfig"
verify_link "$HOME_DIR/.zshrc"                                       "$CONFIGS_DIR/shell/.zshrc"
verify_link "$HOME_DIR/.zprofile"                                    "$CONFIGS_DIR/shell/.zprofile"
verify_link "$HOME_DIR/.config/ghostty/config"                       "$CONFIGS_DIR/ghostty/config"
verify_link "$HOME_DIR/Library/Application Support/com.mitchellh.ghostty/config" "$CONFIGS_DIR/ghostty/config"
verify_link "$HOME_DIR/.gemini"                                      "$CONFIGS_DIR/gemini"
verify_link "$HOME_DIR/.config/starship.toml"                        "$CONFIGS_DIR/starship/starship.toml"
verify_link "$HOME_DIR/.cursor"                                      "$CONFIGS_DIR/cursor"
verify_link "$HOME_DIR/.codex"                                       "$CONFIGS_DIR/codex"
verify_link "$HOME_DIR/.claude"                                      "$CONFIGS_DIR/claude"
verify_link "$HOME_DIR/.docker"                                      "$CONFIGS_DIR/docker"

say
say "Next step:"
say "  cd \"$BRAIN_REPO\" && git status"