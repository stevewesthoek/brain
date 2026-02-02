# Brain

Single source of truth for:
- Curated dotfiles/configs I actually want versioned (safe + stable)
- AI rules, prompts, and playbooks
- Infrastructure and operations docs
- Product boilerplates and project material

## Start here
- START_HERE.md
- CONVENTIONS.md

## Top-level map
- `00-IDENTITY/` - profile, style, theology
- `01-AI/` - agents, prompts, providers, skills
- `02-BUSINESS/` - brand + playbooks
- `03-PRODUCTS/` - boilerplates (ProKit)
- `04-OPERATIONS/` - infrastructure, automations, scripts, snippets, runbooks
- `05-PROJECTS/` - project-specific docs (use `_template/` when starting)
- `06-IDEAS/` - idea backlog (`saas-backlog.md`)
- `99-ARCHIVE/` - deprecated or duplicate docs
- `04-OPERATIONS/system-configs/` - curated config files (symlinked)
- `.codex/` - Codex project config (symlink to `04-OPERATIONS/system-configs/codex/config.toml`)
- `01-AI/skills/` - canonical skill library (symlinked into AI tools)

## Ops boundaries (quick)
See `CONVENTIONS.md` for details.
- `runbooks/` - short, repeatable operational procedures
- `scripts/` - executable automation
- `snippets/` - small reusable fragments
- `automations/` - higher-level flows (n8n/Zapier/etc)
- `infrastructure/` - architecture, inventories, and diagrams

## Configs philosophy (important)
We **symlink** important config locations into this repo, but we **do not** commit machine state.

- ✅ Commit: human-edited, portable config (e.g. `.ssh/config`, `.gitconfig`, `.zshrc`, `.zprofile`, selected tool config files)
- ❌ Never commit: tokens, auth, caches, logs, extensions, workspace state, etc.

For example:
- `~/.cursor` is symlinked into `04-OPERATIONS/system-configs/cursor/`
  - Git tracks only `04-OPERATIONS/system-configs/cursor/README.md`
- Docker configs are symlinked but **ignored** by default because they can contain auth tokens.
  - If you ever want to version specific Docker files, add explicit allowlist entries in `.gitignore`.

## Bootstrap (new machine)
This repo expects your configs to be linked via:
- `04-OPERATIONS/scripts/brain-configs-link.sh`

Ghostty config is managed in two locations on macOS:
- `~/.config/ghostty/config`
- `~/Library/Application Support/com.mitchellh.ghostty/config`

Run it once after cloning to:
- move existing local files into `04-OPERATIONS/system-configs/...`
- create symlinks back to the standard locations
- create backups under `~/.brain-configs-backups/...`

### Safety first
Dry run:
```bash
DRY_RUN=1 bash 04-OPERATIONS/scripts/brain-configs-link.sh
```

Run:
```bash
bash 04-OPERATIONS/scripts/brain-configs-link.sh
```

## Skills (centralized)
Canonical skills live in `01-AI/skills/` and are symlinked to tool-specific locations:
- Codex: `04-OPERATIONS/system-configs/codex/skills/user` -> `01-AI/skills` (keeps `.system/` intact)
- Cursor: `04-OPERATIONS/system-configs/cursor/skills` -> `01-AI/skills`
- Claude: `04-OPERATIONS/system-configs/claude/skills` -> `01-AI/skills`
- Antigravity (global): `~/.gemini/antigravity/skills` -> `01-AI/skills`
- Gemini CLI (global): `~/.gemini/skills` -> `01-AI/skills`

### UI/UX Pro Max (manual)
UI-UX Pro Max is installed as an AI-agnostic skill in:
- `01-AI/skills/ui-ux-pro-max/`

Standard workflow (for you + AI):
1) You ask for a design (e.g. "Brutalism landing page").
2) AI uses **web-design** skill and auto-consults **ui-ux-pro-max** to select style/palette/typography.
3) AI returns a build-ready spec for Next.js + Tailwind + shadcn.

Quick start (manual):
```bash
python3 01-AI/skills/ui-ux-pro-max/scripts/search.py "<product + industry + style>" --design-system -p "<Project Name>"
```

Persist a design system:
```bash
python3 01-AI/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>" --page "<page name>"
```

Use with the web-design skill:
- Run the design-system command first, then apply its output to the web-design spec.

Update UI/UX Pro Max safely (does not touch your web-design skill):
```bash
bash 04-OPERATIONS/scripts/update-ui-ux-pro-max.sh
```

One-liner wrapper (design system + persist):
```bash
bash 04-OPERATIONS/scripts/design-web.sh "<query>" "<Project Name>" [page]
```
