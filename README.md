# Brain (Configs + Playbooks)

This repo is the single source of truth for:
- Curated dotfiles/configs I actually want versioned (safe + stable)
- AI rules / playbooks / operating docs

## Configs philosophy (important)
We **symlink** important config locations into this repo, but we **do not** commit machine state.

- ✅ Commit: human-edited, portable config (e.g. `.ssh/config`, `.gitconfig`, `.zshrc`, `.zprofile`, selected tool config files)
- ❌ Never commit: tokens, auth, caches, logs, extensions, workspace state, etc.

For example:
- `~/.cursor` is symlinked into `Configs/cursor/`
  - Git tracks only `Configs/cursor/README.md`
  - Everything else under Cursor is ignored (extensions, projects, caches, state)

## Bootstrap (new machine)
This repo expects your configs to be linked via:

- `brain-configs-link.sh`

Run it once after cloning to:
- move existing local files into `Configs/…`
- create symlinks back to the standard locations
- create backups under `~/.brain-configs-backups/…`

### Safety first
Dry run:
```bash
DRY_RUN=1 bash brain-configs-link.sh