# Brain

Single source of truth for:
- Curated dotfiles/configs I actually want versioned (safe + stable)
- AI rules, prompts, and playbooks
- Infrastructure and operations docs
- Product boilerplates and project material

## Top-level map
- `00-Identity/` — profile, style, theology
- `01-AI/` — agents, prompts, providers
- `02-Business/` — brand + playbooks
- `03-Products/` — boilerplates (ProKit)
- `04-Operations/` — infrastructure, automations, scripts, snippets
- `05-Projects/` — project-specific docs
- `06-Ideas/` — idea backlog
- `99-Archive/` — deprecated or duplicate docs
- `04-Operations/System-Configs/` — curated config files (symlinked)

## Configs philosophy (important)
We **symlink** important config locations into this repo, but we **do not** commit machine state.

- ✅ Commit: human-edited, portable config (e.g. `.ssh/config`, `.gitconfig`, `.zshrc`, `.zprofile`, selected tool config files)
- ❌ Never commit: tokens, auth, caches, logs, extensions, workspace state, etc.

For example:
- `~/.cursor` is symlinked into `04-Operations/System-Configs/cursor/`
  - Git tracks only `04-Operations/System-Configs/cursor/README.md`
  - Everything else under Cursor is ignored (extensions, projects, caches, state)

## Bootstrap (new machine)
This repo expects your configs to be linked via:

- `04-Operations/Scripts/brain-configs-link.sh`

Run it once after cloning to:
- move existing local files into `04-Operations/System-Configs/…`
- create symlinks back to the standard locations
- create backups under `~/.brain-configs-backups/…`

### Safety first
Dry run:
```bash
DRY_RUN=1 bash 04-Operations/Scripts/brain-configs-link.sh
```

Run:
```bash
bash 04-Operations/Scripts/brain-configs-link.sh
```
