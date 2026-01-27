#!/usr/bin/env bash
set -euo pipefail

# =========================
# brain-configs-link.sh
# Moves selected dotfiles/folders into Brain/Configs and symlinks them back.
# Excludes: Gemini, Starship (already managed elsewhere).
# =========================

DRY_RUN="${DRY_RUN:-0}"
INCLUDE_DOCKER="${INCLUDE_DOCKER:-0}"

HOME_DIR="${HOME}"
BRAIN_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIGS_DIR="${BRAIN_REPO}/Configs"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_BASE="${HOME_DIR}/.brain-configs-backups"
BACKUP_DIR="${BACKUP_BASE}/${TS}"

say() { printf "%s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*" >&2; }

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    say "[dry-run] $*"
  else
    eval "$@"
  fi
}

ensure_dir() { run "mkdir -p \"$1\""; }

is_symlink() { [[ -L "$1" ]]; }
exists_any() { [[ -e "$1" || -L "$1" ]]; }

backup_path() {
  local src="$1"
  local rel="${src#${HOME_DIR}/}"   # strip $HOME prefix
  local dst="${BACKUP_DIR}/${rel}"
  ensure_dir "$(dirname "$dst")"
  run "mv \"$src\" \"$dst\""
  say "$dst"
}

# Move file into Brain path, then link back
move_file_and_link() {
  local src="$1"    # e.g. ~/.gitconfig
  local dst="$2"    # e.g. $CONFIGS_DIR/git/gitconfig

  if ! exists_any "$src"; then
    warn "Missing: $src (skipping)"
    return 0
  fi

  if is_symlink "$src"; then
    say "==> Already a symlink: $src (skipping)"
    return 0
  fi

  ensure_dir "$(dirname "$dst")"

  # If destination exists already, backup source and just link to destination
  if exists_any "$dst"; then
    warn "Brain already has $dst; backing up local $src and linking to Brain."
    warn "Backed up to: $(backup_path "$src")"
    ensure_dir "$(dirname "$src")"
    run "ln -sfn \"$dst\" \"$src\""
    return 0
  fi

  say ""
  say "==> Moving $(basename "$src") -> Brain and linking back"
  run "mv \"$src\" \"$dst\""
  ensure_dir "$(dirname "$src")"
  run "ln -sfn \"$dst\" \"$src\""
}

# Move folder into Brain path, then link back
move_dir_and_link() {
  local src="$1"   # e.g. ~/.codex
  local dst="$2"   # e.g. $CONFIGS_DIR/codex

  if ! exists_any "$src"; then
    warn "Missing: $src (skipping)"
    return 0
  fi

  if is_symlink "$src"; then
    say "==> Already a symlink: $src (skipping)"
    return 0
  fi

  ensure_dir "$(dirname "$dst")"

  # If destination exists (even empty), we want to move INTO it only if it's empty.
  if exists_any "$dst"; then
    # If it's an existing directory and empty, we can move contents in.
    if [[ -d "$dst" ]] && [[ -z "$(ls -A "$dst" 2>/dev/null || true)" ]]; then
      say ""
      say "==> Brain folder exists and is empty: $dst"
      say "==> Moving contents of $src -> $dst and linking back"
      # Move the whole dir by moving into backup first then replace with symlink (cleanest).
      warn "Backed up to: $(backup_path "$src")"
      # Restore into dst (from backup) by moving back? No: simpler: move original into dst by renaming:
      # Since src is gone now, we need a deterministic approach:
      # We'll move the backup back into dst when NOT dry-run.
      if [[ "${DRY_RUN}" == "1" ]]; then
        say "[dry-run] mv \"$BACKUP_DIR/${src#${HOME_DIR}/}\"/* \"$dst/\""
      else
        shopt -s dotglob nullglob
        mv "${BACKUP_DIR}/${src#${HOME_DIR}/}"/* "$dst/" || true
        shopt -u dotglob nullglob
      fi
      run "ln -sfn \"$dst\" \"$src\""
      return 0
    fi

    # Non-empty destination: backup source and link
    warn "Brain already has (and is not empty): $dst; backing up local $src and linking to Brain."
    warn "Backed up to: $(backup_path "$src")"
    run "ln -sfn \"$dst\" \"$src\""
    return 0
  fi

  say ""
  say "==> Moving $(basename "$src") -> Brain and linking back"
  run "mv \"$src\" \"$dst\""
  run "ln -sfn \"$dst\" \"$src\""
}

say ""
say "==> Brain repo: ${BRAIN_REPO}"
say ""
say "==> Configs dir: ${CONFIGS_DIR}"
say ""
say "==> Backup dir: ${BACKUP_DIR}"
say ""
if [[ "${DRY_RUN}" == "1" ]]; then
  warn "DRY_RUN enabled: no changes will be made."
fi

ensure_dir "$CONFIGS_DIR"
ensure_dir "$BACKUP_DIR"

# -------------------------
# SSH (config only)
# -------------------------
say ""
say "==> SSH: only ~/.ssh/config (no keys, no known_hosts)"
ensure_dir "${CONFIGS_DIR}/ssh"
move_file_and_link "${HOME_DIR}/.ssh/config" "${CONFIGS_DIR}/ssh/config"
run "chmod 700 \"${HOME_DIR}/.ssh\" || true"
run "chmod 600 \"${CONFIGS_DIR}/ssh/config\" || true"

# -------------------------
# Git
# -------------------------
say ""
say "==> Git: ~/.gitconfig"
ensure_dir "${CONFIGS_DIR}/git"
move_file_and_link "${HOME_DIR}/.gitconfig" "${CONFIGS_DIR}/git/gitconfig"

# -------------------------
# Shell
# -------------------------
say ""
say "==> Shell: .zshrc and .zprofile"
ensure_dir "${CONFIGS_DIR}/shell"
move_file_and_link "${HOME_DIR}/.zshrc" "${CONFIGS_DIR}/shell/.zshrc"
move_file_and_link "${HOME_DIR}/.zprofile" "${CONFIGS_DIR}/shell/.zprofile"

# -------------------------
# Ghostty
# -------------------------
say ""
say "==> Ghostty: ~/.config/ghostty/config"
ensure_dir "${CONFIGS_DIR}/ghostty"
ensure_dir "${HOME_DIR}/.config/ghostty"
move_file_and_link "${HOME_DIR}/.config/ghostty/config" "${CONFIGS_DIR}/ghostty/config"

# -------------------------
# Cursor (skip cursor-server)
# -------------------------
say ""
say "==> Cursor: ~/.cursor (skip ~/.cursor-server)"
ensure_dir "${CONFIGS_DIR}/cursor"
move_dir_and_link "${HOME_DIR}/.cursor" "${CONFIGS_DIR}/cursor"

# -------------------------
# AI tool configs (folders)
# -------------------------
say ""
say "==> AI tool configs: ~/.codex ~/.claude (folders). (Gemini excluded.)"
ensure_dir "${CONFIGS_DIR}/codex"
ensure_dir "${CONFIGS_DIR}/claude"

move_dir_and_link "${HOME_DIR}/.codex" "${CONFIGS_DIR}/codex"
move_dir_and_link "${HOME_DIR}/.claude" "${CONFIGS_DIR}/claude"

if exists_any "${HOME_DIR}/.claude.json"; then
  warn "Found ~/.claude.json. Skipping by default (might contain secrets)."
fi

# -------------------------
# Docker (optional)
# -------------------------
say ""
if [[ "${INCLUDE_DOCKER}" == "1" ]]; then
  say "==> Docker: managing ~/.docker (WARNING: may contain auth tokens)."
  ensure_dir "${CONFIGS_DIR}/docker"
  move_dir_and_link "${HOME_DIR}/.docker" "${CONFIGS_DIR}/docker"
  warn "Strongly consider adding Configs/docker to .gitignore or auditing before committing."
else
  warn "Docker skipped (set INCLUDE_DOCKER=1 to manage ~/.docker)."
fi

say ""
say "==> Done."
say "Backups (if any) are here:"
say "  ${BACKUP_DIR}"
say ""
say "Next step:"
say "  cd \"${BRAIN_REPO}\" && git status"