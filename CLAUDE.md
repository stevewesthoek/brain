# CLAUDE.md — brain

## Purpose
Claude Code instructions for the `brain` repo — the central source of truth for personal config, skills, and operations.

## Session lifecycle

Every session follows this flow — know where you are in it at all times:

1. **Start** — Check for `.ai/current.md` in the target repo. If it exists, run `/handoff resume` to restore goal, status, files touched, and next steps without re-reading everything.
2. **Work** — Route by task weight (Haiku → Sonnet → Opus → Codex). Track what's done and what's pending. Prefer surgical changes; don't widen scope.
3. **End** — Run `/handoff pause` to compress session state. If something non-obvious was solved (tricky bug, codebase gotcha, workaround), run the shared `/learner` skill to extract it as a reusable skill for Claude, Codex, and Gemini.

**Resilience:** `.ai/current.md` is the recovery point if a session breaks mid-task. The Stop hook writes it automatically — no manual action needed.
**Cross-device continuity:** `.ai/current.md` is ephemeral and gitignored in this repo — it's auto-regenerated each session. `decision-log.md` is durable and in git; commit it before switching devices.
**Skills:** Only use a skill if it adds clear value. If two skills overlap, merge or delete. No skill for the sake of a skill.

## Mandatory: Universal capability installation

**Before installing ANY new capability (skill, CLI, or MCP server), use `/brain-universal-capability-install`.**

This is non-negotiable. The pattern: Install once globally, configure all three engines (CLAUDE.md, AGENTS.md, GEMINI.md) simultaneously, commit together.

Why: NotebookLM was installed in Codex config but not Claude. This prevents asymmetric capabilities where one engine has a tool but the others don't.

When: Whenever you hear "install X", "add Y skill", "set up Z MCP", immediately ask to run the skill first.

---

## Workspace rules

1. Do not use the root of `brain` as the default working directory unless the task is explicitly about maintaining the `brain` repo itself.
2. For project work, start in the specific target repo under `Repos/`.
3. For Claude/system maintenance, start in `brain/operations/system-configs/claude`.
4. For shared skill maintenance, start in `brain/ai/skills`.

## Repo layout awareness

Local repos live at `~/Repos/` organized by GitHub account / ownership group:

- `prochatdemo/` — demo projects
- `prochattools/` — tools, SaaS, client work, ops
  - `boilerplates/` — product and studio boilerplates
  - `clients/` — client repos
  - `ops/` — operational tools (e.g. freeresend, probot)
  - `saas/` — SaaS products (e.g. proofly, xgrow, statuslink)
  - `waas/` — white-label-as-a-service projects
  - `web/` — web properties (e.g. says-the-bible, prochat, cedula)
- `stevewesthoek/` — personal repos (this one)
- `yeshuaacademy/` — Yeshua Academy projects

When working across repos, treat each Git repo independently. Do not apply one repo's instructions to another.

## Brain repo structure

- `ai/skills/` — skill management (active symlinks, vendors, custom)
- `tools/scripts/` — utility and workflow scripts
  - `brain-auto-router.py` — Auto-Router automation (runs every 1 minute via cron; routes inbox notes based on decision tree). See `operations/runbooks/brain-auto-router.md` for full docs.
  - `brain-project-decomposer.py` — Project Decomposer automation (runs every 5 minutes via cron; uses Gemini to decompose projects into atomic tasks). See `operations/runbooks/brain-project-decomposer.md` for full docs.
  - `brain-kanban-syncer.py` — Kanban Syncer automation (runs every 10 minutes via cron; generates interactive Kanban board via Obsidian Kanban plugin). See `operations/runbooks/brain-kanban-syncer.md` for full docs.
  - `clickup-importer.py` — One-time or recurring ClickUp CSV import utility (converts ClickUp export to Brain task format, creates task files, syncs to Kanban). See `operations/runbooks/clickup-importer.md` for full docs.
  - `brain-automate-verify.sh` — Post-reboot/reinstall verification script (run after OS updates to confirm all systems are working)
  - `repos.sh` — unified repo picker (`repos` shell command): pick Claude or Codex, then pick a repo to open
  - `sessions.sh` — unified session picker (`sessions` shell command): pick Claude or Codex, then resume a session
  - `backup-n8n.sh` — server-side export of live n8n credentials/workflows into the gitignored local backup folder
- `tools/n8n-api.sh` — wrapper for the live `n8n.prochat.tools` Public API (for manual n8n workflow management)
- `operations/system-configs/` — global tool configs, all symlinked from home directory
- `operations/runbooks/` — documentation for key tools and workflows
  - `brain-auto-router.md` — Python Auto-Router script, cron scheduling, decision tree logic, troubleshooting
  - `brain-project-decomposer.md` — Python Project Decomposer script, Gemini integration, task creation, cron scheduling
  - `brain-kanban-syncer.md` — Python Kanban Syncer script, Obsidian Kanban plugin format, drag-and-drop board, color-coded cards, cron scheduling
  - `clickup-importer.md` — ClickUp CSV import utility, status mapping, task file generation, dry-run testing, troubleshooting
  - `playwright.md` — Playwright CLI usage, patterns, and nightly scheduler integration
  - `notebooklm.md` — NotebookLM CLI v0.3.4, research workflows, batch operations, nightly scheduler integration
- `operations/decision-log.md` — confirmed decisions for the brain repo itself

### Per-repo AI memory (not in brain itself)

Each project repo uses a conventional `ai/` directory for Claude handoff memory:
- `.ai/current.md` — short-term resumable session handoff (overwritten each session)
- `.ai/handoffs/` — archive of timestamped past handoffs
- `decision-log.md` — long-term durable decisions only (append-only, separate from handoffs)

### Symlink map (home → brain)

| Home path | Points to |
|-----------|-----------|
| `~/.claude` | `operations/system-configs/claude/` |
| `~/.codex` | `operations/system-configs/codex/` |
| `~/.gemini` | `operations/system-configs/gemini/` |
| `~/.kiro` | `operations/system-configs/kiro/` |
| `~/.config/starship.toml` | `operations/system-configs/starship/starship.toml` |
| `~/.config/ghostty/config` | `operations/system-configs/ghostty/config` |
| `~/.config/git/ignore` | `operations/system-configs/git/ignore` |
| `~/.docker` | `operations/system-configs/docker/` |

`~/.claude.json` (Claude Code's MCP registrations) is **not** symlinked — it contains secrets. A safe template lives at `operations/system-configs/claude/claude.json.template`.

Local machine secrets that are intentionally not in-repo:
- `~/.config/dokploy/.env`
- `~/.config/n8n/.env`

## Credentials

All API keys, tokens, and credentials are indexed (no values) at `operations/accounts/credentials-index.md`.

Canonical Stripe operations and ProBot dashboard model live at `operations/runbooks/stripe-cli-and-probot.md`.
Use that runbook for Stripe CLI auth, profile handling, and live/test account semantics across the AI system.
Run `sync-credentials` to scan `~/.config/` for new `.env` files and append untracked entries.
A PostToolUse hook auto-runs `sync-credentials` whenever Claude writes or edits a `.env` file.

## Integrations (AI-Agnostic Shared Capabilities)

All skills, CLIs, and MCP servers below are **available to Claude, Codex, and Gemini equally** unless marked [Claude specific] or [Codex specific].

Use `/skill-name` to invoke any skill. For CLIs, call directly via bash.

### Planning & Architecture
- `/plan-ceo-review` — CEO/founder-mode plan review (6 forcing questions)
- `/plan-eng-review` — Eng manager-mode plan review (execution plan lockdown)
- `/plan-design-review` — Designer-eye plan review (UX/visual architecture)
- `/autoplan` — Auto-review pipeline (reads full CEO + eng + design reviews)
- `/office-hours` — YC Office Hours mode (startup evaluation)

### Ship & Deploy
- `/ship` — Ship workflow (detect + merge + test + version + changelog + push + PR)
- `/land-and-deploy` — Land PR and deploy (merge + wait for CI + deploy)
- `/setup-deploy` — Configure deployment settings for land-and-deploy
- `/canary` — Post-deploy canary monitoring (watch live app for errors)
- `/document-release` — Post-ship documentation update

### Code Review & Quality
- `/review` — Pre-landing PR review (SQL safety, LLM trust, patterns)
- `/design-review` — Designer-eye QA (visual consistency, spacing, hierarchy)
- `/qa` — Systematic QA testing (find bugs, report with fixes)
- `/qa-only` — QA report only (test + document, no fixes)
- `/benchmark` — Performance regression detection (page load, Core Web Vitals)

### Investigation & Learning
- `/investigate` — Systematic debugging (4 phases: investigate → hypothesize → test → confirm)
- `/retro` — Weekly engineering retrospective (git history analysis, patterns)
- `/learner` — Extract hard-won patterns from session (shared across all three engines)

### Safety & Guardrails
- `/careful` — Safety guardrails for destructive commands (warn before rm -rf, DROP TABLE, force-push)
- `/freeze` — Restrict file edits to specific directory
- `/guard` — Full safety mode (warnings + approval prompts)
- `/unfreeze` — Clear freeze boundary
- `/cso` — Chief Security Officer mode (infrastructure-first security audit)

### Web Research & Data
- `/firecrawl` — Web search + scraping to clean markdown (http://100.83.38.48:3051 via Tailscale)
- `/apify` — Web scraping + data extraction via multi-account Apify system ($50/mo total = 10 accounts × $5 each, round-robin rotation, deduplication patterns A/B/C, n8n webhook integration)
- `/autoresearch` — Autonomous optimization loop (define scope + metric → iterate → keep improvements)

### Content & Design
- `/design-system` — Build landing pages, websites, UI projects with design systems
- `/design-consultation` — Design consultation (product understanding + landscape + system proposal)
- `/redesign-skill` — Upgrade existing websites/apps to premium quality
- `/soft-skill` — Design like high-end agency (teaches premium UX/UI patterns)
- `/taste-skill` — Senior UI/UX engineer (architect interfaces over time)
- `/ui-ux-pro-max` — UI/UX design intelligence (searchable database)
- `/web-design` — Web design work (landing pages, SaaS, marketing sites)

### Research & Knowledge
- `/notebooklm` — NotebookLM CLI v0.3.4 (create notebooks, add sources, generate audio/video/slides/quizzes/flashcards/mind-maps)
- `/firecrawl` — Web scraping to markdown (also above)

### Infrastructure & Integrations
- `/aws` — AWS EC2/Lightsail provisioning, resource inspection
- `/azure` — Azure resource discovery/management
- `/clerk` — Clerk authentication CLI (users, orgs, apps, webhooks, sessions); inspect and manage all Clerk applications from the CLI
- `/cloudflare` — DNS record management
- `/gcp` — Google Cloud project/resource discovery and management via `gcloud`
- `/google-ads` — Yeshua Academy Google Ad Grants automation via the shared CLI and docs in `docs/google-ads/`
- `/gws` — Google Workspace calendar, drive, admin operations
- `/hetzner` — Hetzner Cloud infrastructure management
- `/gh` — GitHub operations (PR, issue, release management)
- `/stripe` — Stripe webhook forwarding, test events, auth
- `/supabase` — Database migrations, auth management
- `/dokploy` — Application deployment, management, inspection
- `/tailscale` — Network inspection, VPN state
- `/n8n` — Self-hosted n8n workflow export/import, audit, recovery

### System & Config
- `/model-router` — Routing policy guidance (Haiku → Sonnet → Opus → Codex, when to use Gemini)
- `/skill-creator` — Create new skills, modify existing, measure performance
- `/skill-prune` — Monthly skill library pruning (review all active skills)
- `/ai-agnostic-config` — Configure Claude Code settings (settings.json, hooks, CLAUDE.md)
- `/output-skill` — Override LLM truncation (enforce complete output)

### Browser & Automation
- `/playwright` — Browser automation, testing, scraping
- `/ffmpeg` — Audio/video processing

### Session Management
- `/handoff` — Session pause/resume/setup (compress state, restore context, initialize .ai/ memory system)

### [Claude Specific] AI Model Routing
- `/codex` — Codex CLI wrapper for code review (OpenAI CLI integration)
- `/codex-second-opinion` — Codex code review second opinion (controlled review tier)
- `/gemini` — Gemini CLI for large-context preprocessing, bulk analysis (free Flash tier)

### CLIs (installed globally, available to all three engines)
- `aws`, `azure`, `cloudflare`, `gcloud`, `gws`, `hetzner` — cloud provider CLIs
- `clerk` — Clerk authentication management CLI
- `gh`, `stripe`, `supabase`, `dokploy`, `tailscale` — SaaS/deployment CLIs
- `apify`, `apify-multi`, `ffmpeg`, `notebooklm`, `playwright`, `firecrawl` — development/web/media CLIs
- `n8n` — self-hosted workflow CLI

### MCP Servers
- **stitch** [Codex only] — Stitch MCP for design tools (command: `npx @_davideast/stitch-mcp proxy`)
- **context-mode** — Large-context preprocessing, batch execution (marketplace plugin)
- **OpenAI plugins** [Codex only] — Canva, Stripe, GitHub, Google Drive

## Decision log

The decision log for this repo lives at `operations/decision-log.md`.
Use it for confirmed architecture and workflow decisions only.

## Do not break

- `~/.claude` is a directory-level symlink → `brain/operations/system-configs/claude`. Do not delete or restructure that folder.
- `~/.claude/skills` is a symlink → `brain/ai/skills/active`. Keep `active/` as symlinks only; do not put raw skill folders directly in `active/`.
- `~/.codex` is a directory-level symlink → `brain/operations/system-configs/codex`. Do not delete or restructure that folder.
- `~/.gemini` is a directory-level symlink → `brain/operations/system-configs/gemini`. Do not delete or restructure that folder.
- `~/.kiro` is a directory-level symlink → `brain/operations/system-configs/kiro`. Do not delete or restructure that folder.
- `~/.docker` is a directory-level symlink → `brain/operations/system-configs/docker`. Do not delete or restructure that folder — Docker Desktop will fail to start if the target doesn't exist.
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are individual file symlinks → brain. Do not delete the source files in brain.
- `tools/scripts/` contains workflow and setup scripts that are used on this machine — do not delete without checking if they are still in use.
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may be a symlink into `brain/operations/system-configs/launchagents/com.office.nightly-scheduler.plist`. Keep the repo file as the source of truth.
