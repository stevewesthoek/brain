#!/usr/bin/env bash
set -euo pipefail

# =========================
# brain-configs-link.sh
# Moves selected dotfiles/folders into the Brain configs folder and symlinks them back.
# Excludes: none (Gemini, Starship, Docker included when available).
# =========================

DRY_RUN="${DRY_RUN:-0}"
# Default to managing Docker configs unless explicitly disabled.
INCLUDE_DOCKER="${INCLUDE_DOCKER:-1}"

HOME_DIR="${HOME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve repo root even if this script is moved into subfolders.
BRAIN_REPO="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || (cd "${SCRIPT_DIR}/../.." && pwd))"
CONFIGS_DIR_DEFAULT="${BRAIN_REPO}/04_OPERATIONS/system-configs"
CONFIGS_DIR="${CONFIGS_DIR:-${CONFIGS_DIR_DEFAULT}}"

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

abs_path() {
  python3 - "$1" <<'PY'
import os, sys
path = sys.argv[1]
print(os.path.realpath(os.path.expanduser(path)))
PY
}

rel_path() {
  python3 - "$1" "$2" <<'PY'
import os, sys
start, target = sys.argv[1], sys.argv[2]
start = os.path.realpath(os.path.expanduser(start))
target = os.path.realpath(os.path.expanduser(target))
print(os.path.relpath(target, start))
PY
}

symlink_points_to() {
  local src="$1"
  local dst="$2"
  if ! is_symlink "$src"; then
    return 1
  fi
  local link_target
  link_target="$(readlink "$src" || true)"
  if [[ -z "$link_target" ]]; then
    return 1
  fi
  local src_dir target_abs desired_abs
  src_dir="$(dirname "$src")"
  target_abs="$(abs_path "${src_dir}/${link_target}")"
  desired_abs="$(abs_path "$dst")"
  [[ "$target_abs" == "$desired_abs" ]]
}

link_relative() {
  local src="$1"
  local dst="$2"
  local rel
  rel="$(rel_path "$(dirname "$src")" "$dst")"
  run "ln -sfn \"$rel\" \"$src\""
}

backup_path() {
  local src="$1"
  local rel="${src#${HOME_DIR}/}"   # strip $HOME prefix
  local dst="${BACKUP_DIR}/${rel}"
  ensure_dir "$(dirname "$dst")"
  run "mv \"$src\" \"$dst\""
  say "$dst"
}

# Move file into Brain path, then link back (relative symlink)
move_file_and_link() {
  local src="$1"    # e.g. ~/.gitconfig
  local dst="$2"    # e.g. $CONFIGS_DIR/git/gitconfig

  if is_symlink "$src"; then
    if symlink_points_to "$src" "$dst"; then
      say "==> Symlink OK: $src"
      return 0
    fi
    warn "Broken or outdated symlink: $src (relinking)"
    run "rm -f \"$src\""
  fi

  ensure_dir "$(dirname "$dst")"

  if ! exists_any "$src"; then
    if exists_any "$dst"; then
      ensure_dir "$(dirname "$src")"
      link_relative "$src" "$dst"
    else
      warn "Missing: $src and $dst (skipping)"
    fi
    return 0
  fi

  # If destination exists already, backup source and just link to destination
  if exists_any "$dst"; then
    warn "Brain already has $dst; backing up local $src and linking to Brain."
    warn "Backed up to: $(backup_path "$src")"
    ensure_dir "$(dirname "$src")"
    link_relative "$src" "$dst"
    return 0
  fi

  say ""
  say "==> Moving $(basename "$src") -> Brain and linking back"
  run "mv \"$src\" \"$dst\""
  ensure_dir "$(dirname "$src")"
  link_relative "$src" "$dst"
}

# Move folder into Brain path, then link back (relative symlink)
move_dir_and_link() {
  local src="$1"   # e.g. ~/.codex
  local dst="$2"   # e.g. $CONFIGS_DIR/codex

  if is_symlink "$src"; then
    if symlink_points_to "$src" "$dst"; then
      say "==> Symlink OK: $src"
      return 0
    fi
    warn "Broken or outdated symlink: $src (relinking)"
    run "rm -f \"$src\""
  fi

  ensure_dir "$(dirname "$dst")"

  if ! exists_any "$src"; then
    if exists_any "$dst"; then
      ensure_dir "$(dirname "$src")"
      link_relative "$src" "$dst"
    else
      warn "Missing: $src and $dst (skipping)"
    fi
    return 0
  fi

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
      link_relative "$src" "$dst"
      return 0
    fi

    # Non-empty destination: backup source and link
    warn "Brain already has (and is not empty): $dst; backing up local $src and linking to Brain."
    warn "Backed up to: $(backup_path "$src")"
    link_relative "$src" "$dst"
    return 0
  fi

  say ""
  say "==> Moving $(basename "$src") -> Brain and linking back"
  run "mv \"$src\" \"$dst\""
  link_relative "$src" "$dst"
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

say "==> Ghostty (macOS app support): ~/Library/Application Support/com.mitchellh.ghostty/config"
ensure_dir "${HOME_DIR}/Library/Application Support/com.mitchellh.ghostty"
move_file_and_link "${HOME_DIR}/Library/Application Support/com.mitchellh.ghostty/config" "${CONFIGS_DIR}/ghostty/config"

# -------------------------
# Gemini (folder)
# -------------------------
say ""
say "==> Gemini: ~/.gemini (folder)"
ensure_dir "${CONFIGS_DIR}/gemini"
if is_symlink "${HOME_DIR}/.gemini"; then
  if symlink_points_to "${HOME_DIR}/.gemini" "${CONFIGS_DIR}/gemini"; then
    say "==> Symlink OK: ${HOME_DIR}/.gemini"
  else
    warn "Broken or outdated symlink: ${HOME_DIR}/.gemini (relinking)"
    run "rm -f \"${HOME_DIR}/.gemini\""
    link_relative "${HOME_DIR}/.gemini" "${CONFIGS_DIR}/gemini"
  fi
elif [[ -d "${HOME_DIR}/.gemini" ]]; then
  if [[ -d "${CONFIGS_DIR}/gemini" ]] && [[ -n "$(ls -A "${CONFIGS_DIR}/gemini" 2>/dev/null || true)" ]]; then
    say "==> Existing repo gemini contents detected; backing up to ${CONFIGS_DIR}/gemini.backup-${TS}"
    run "mv \"${CONFIGS_DIR}/gemini\" \"${CONFIGS_DIR}/gemini.backup-${TS}\""
    ensure_dir "${CONFIGS_DIR}/gemini"
  fi
  say "==> Moving ~/.gemini -> ${CONFIGS_DIR}/gemini and linking back"
  run "mv \"${HOME_DIR}/.gemini\" \"${CONFIGS_DIR}/gemini\""
  link_relative "${HOME_DIR}/.gemini" "${CONFIGS_DIR}/gemini"
else
  warn "Missing: ${HOME_DIR}/.gemini (skipping)"
fi

# -------------------------
# Starship
# -------------------------
say ""
say "==> Starship: ~/.config/starship.toml"
ensure_dir "${CONFIGS_DIR}/starship"
ensure_dir "${HOME_DIR}/.config"
move_file_and_link "${HOME_DIR}/.config/starship.toml" "${CONFIGS_DIR}/starship/starship.toml"

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
  warn "Strongly consider adding ${CONFIGS_DIR}/docker to .gitignore or auditing before committing."
else
  warn "Docker skipped (set INCLUDE_DOCKER=1 to manage ~/.docker)."
fi

say ""
say "==> Done."
say "Backups (if any) are here:"
say "  ${BACKUP_DIR}"
say ""
say "==> Verifying symlinks..."
verify_failed=0

verify_link() {
  local src="$1"
  local dst="$2"
  if ! exists_any "$dst"; then
    warn "VERIFY missing destination: $dst"
    verify_failed=1
    return 0
  fi
  if ! is_symlink "$src"; then
    warn "VERIFY not a symlink: $src"
    verify_failed=1
    return 0
  fi
  if ! symlink_points_to "$src" "$dst"; then
    warn "VERIFY wrong target: $src"
    verify_failed=1
    return 0
  fi
  say "OK: $src"
}

verify_link "${HOME_DIR}/.ssh/config" "${CONFIGS_DIR}/ssh/config"
verify_link "${HOME_DIR}/.gitconfig" "${CONFIGS_DIR}/git/gitconfig"
verify_link "${HOME_DIR}/.zshrc" "${CONFIGS_DIR}/shell/.zshrc"
verify_link "${HOME_DIR}/.zprofile" "${CONFIGS_DIR}/shell/.zprofile"
verify_link "${HOME_DIR}/.config/ghostty/config" "${CONFIGS_DIR}/ghostty/config"
verify_link "${HOME_DIR}/Library/Application Support/com.mitchellh.ghostty/config" "${CONFIGS_DIR}/ghostty/config"
verify_link "${HOME_DIR}/.gemini" "${CONFIGS_DIR}/gemini"
verify_link "${HOME_DIR}/.config/starship.toml" "${CONFIGS_DIR}/starship/starship.toml"
verify_link "${HOME_DIR}/.cursor" "${CONFIGS_DIR}/cursor"
verify_link "${HOME_DIR}/.codex" "${CONFIGS_DIR}/codex"
verify_link "${HOME_DIR}/.claude" "${CONFIGS_DIR}/claude"

if [[ "${INCLUDE_DOCKER}" == "1" ]]; then
  verify_link "${HOME_DIR}/.docker" "${CONFIGS_DIR}/docker"
fi

if [[ "${verify_failed}" == "1" ]]; then
  warn "One or more symlinks failed verification."
  exit 1
fi

say ""
say "Next step:"
say "  cd \"${BRAIN_REPO}\" && git status"
