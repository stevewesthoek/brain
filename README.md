# Brain

Single source of truth for:
- Curated dotfiles/configs I actually want versioned (safe + stable)
- AI rules, prompts, and playbooks
- Infrastructure and operations docs
- Product boilerplates and project material

## Top-level map
- `00-identity/` — profile, style, theology
- `01-ai/` — agents, prompts, providers
- `02-business/` — brand + playbooks
- `03-products/` — boilerplates (ProKit)
- `04-operations/` — infrastructure, automations, scripts, snippets, runbooks
- `05-projects/` — project-specific docs
- `06-ideas/` — idea backlog
- `99-archive/` — deprecated or duplicate docs
- `04-operations/system-configs/` — curated config files (symlinked)

## Configs philosophy (important)
We **symlink** important config locations into this repo, but we **do not** commit machine state.

- ✅ Commit: human-edited, portable config (e.g. `.ssh/config`, `.gitconfig`, `.zshrc`, `.zprofile`, selected tool config files)
- ❌ Never commit: tokens, auth, caches, logs, extensions, workspace state, etc.

For example:
- `~/.cursor` is symlinked into `04-operations/system-configs/cursor/`
  - Git tracks only `04-operations/system-configs/cursor/README.md`
  - Everything else under Cursor is ignored (extensions, projects, caches, state)

## Bootstrap (new machine)
This repo expects your configs to be linked via:

- `04-operations/scripts/brain-configs-link.sh`

Ghostty config is managed in two locations on macOS:
- `~/.config/ghostty/config`
- `~/Library/Application Support/com.mitchellh.ghostty/config`

Run it once after cloning to:
- move existing local files into `04-operations/system-configs/…`
- create symlinks back to the standard locations
- create backups under `~/.brain-configs-backups/…`

### Safety first
Dry run:
```bash
DRY_RUN=1 bash 04-operations/scripts/brain-configs-link.sh
```

Run:
```bash
bash 04-operations/scripts/brain-configs-link.sh
```
