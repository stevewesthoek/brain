# Brain

Single source of truth for:
- Curated dotfiles/configs I actually want versioned (safe + stable)
- AI rules, prompts, and playbooks
- Infrastructure and operations docs
- Business + brand docs
- Identity docs (profile/style/theology)
- Project material

# Start Here

This Brain is the source of truth for cross-repo conventions and internal documentation used by ProChat repos.

Repo-specific technical documentation lives in each repo (for example: ProKit Core docs now live in the ProKit Core repo under `/docs`).

Read in this order:
1) README.md (map + config philosophy)
2) Identity/profile.md, Identity/style.md, Identity/theology.md
3) Business/conventions.md (folder boundaries + data classification)
4) AI/agents.md and AI/prompts/
5) Operations/ (runbooks + system configs)

## Top-level map
- `Identity/` - profile, style, theology
- `AI/` - agents, prompts, providers, skills
- `Business/` - brand + playbooks
- `Operations/` - infrastructure, automations, scripts, snippets, runbooks
- `Projects/` - project-specific docs
- `Operations/system-configs/` - curated config files (symlinked, includes Codex config)
- `Operations/system-configs/mcp/` - canonical MCP server docs/templates and install standards
- `AI/skills/` - canonical skill library (symlinked into AI tools)

## Ops boundaries (quick)
See `Business/conventions.md` for details.
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
- `~/.cursor` is symlinked into `Operations/system-configs/cursor/`
  - Git tracks only `Operations/system-configs/cursor/README.md`
- Docker configs are symlinked but **ignored** by default because they can contain auth tokens.
  - If you ever want to version specific Docker files, add explicit allowlist entries in `.gitignore`.
- MCP server configs are centralized in Brain:
  - Codex registry: `Operations/system-configs/codex/config.toml`
  - Server docs/templates: `Operations/system-configs/mcp/<server>/`
  - Token-bearing Antigravity runtime config: `Operations/system-configs/antigravity/User/mcp.json` (ignored)

## Bootstrap (new machine)
This repo expects your configs to be linked via:
- `Operations/scripts/brain-configs-link.sh`

Ghostty config is managed in two locations on macOS:
- `~/.config/ghostty/config`
- `~/Library/Application Support/com.mitchellh.ghostty/config`

Run it once after cloning to:
- move existing local files into `Operations/system-configs/...`
- create symlinks back to the standard locations
- create backups under `~/.brain-configs-backups/...`

### Safety first
Dry run:
```bash
DRY_RUN=1 bash Operations/scripts/brain-configs-link.sh
```

Run:
```bash
bash Operations/scripts/brain-configs-link.sh
```

## Skills (centralized)
Canonical skills live in `AI/skills/` and are symlinked to tool-specific locations:
- Codex: `Operations/system-configs/codex/skills/user` -> `AI/skills` (keeps `.system/` intact)
- Cursor: `Operations/system-configs/cursor/skills` -> `AI/skills`
- Claude: `Operations/system-configs/claude/skills` -> `AI/skills`
- Antigravity (global): `~/.gemini/antigravity/skills` -> `AI/skills`
- Gemini CLI (global): `~/.gemini/skills` -> `AI/skills`

### UI/UX Pro Max (manual)
UI-UX Pro Max is installed as an AI-agnostic skill in:
- `AI/skills/ui-ux-pro-max/`

Standard workflow (for you + AI):
1) You ask for a design (e.g. "Brutalism landing page").
2) AI uses **web-design** skill and auto-consults **ui-ux-pro-max** to select style/palette/typography.
3) AI returns a build-ready spec for Next.js + Tailwind + shadcn.

Quick start (manual):
```bash
python3 AI/skills/ui-ux-pro-max/scripts/search.py "<product + industry + style>" --design-system -p "<Project Name>"
```

Persist a design system:
```bash
python3 AI/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>" --page "<page name>"
```

Use with the web-design skill:
- Run the design-system command first, then apply its output to the web-design spec.

Update UI/UX Pro Max safely (does not touch your web-design skill):
```bash
bash Operations/scripts/update-ui-ux-pro-max.sh
```

One-liner wrapper (design system + persist):
```bash
bash Operations/scripts/design-web.sh "<query>" "<Project Name>" [page]
```
