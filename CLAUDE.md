# CLAUDE.md — machine-brain

## Purpose

Claude Code instructions for the `machine-brain` repo — AI infrastructure, system config, and skills. This is part of a split repo structure (see "Repo split" section below).

## Required Brain Startup Protocol

When working with the brain repo or any AI-system question, start with:

1. `AGENTS.md`
2. `00-start-here.md`
3. `00-current-context.md`
4. `00-memory-map.md`
5. `README.md` when repo structure details are needed

Do not load the whole brain repo. Use `00-memory-map.md`, then search/read only relevant files.

## Session lifecycle

1. **Start** — If `.ai/current.md` exists in the target repo, run `/handoff resume`.
2. **Work** — Route by cost (Haiku → Sonnet → Opus → Codex). Use skills only when they add clear, measurable value over doing the task directly.
3. **End** — Run `/handoff pause`. If a non-obvious pattern was solved, run `/learner`.

`.ai/current.md` is the recovery point (auto-written by Stop hook). `decision-log.md` is durable — commit before switching devices.

## Universal capability install

Before installing ANY skill, CLI, or MCP server: run `/brain-universal-capability-install`. All three engines (Claude, Codex, Gemini) must be configured simultaneously.

After activating or installing a skill, export it to all configured AI/IDE consumers by running:
```bash
node tools/scripts/sync-ai-skills.mjs --dry-run && node tools/scripts/sync-ai-skills.mjs && node tools/scripts/sync-ai-skills.mjs --check
```

This syncs active skills to Claude Code, Codex, Gemini CLI, Cursor, Kiro, and Antigravity. The check should pass before continuing with other work.

## CLI Manifest — Unified Tool Access

**See:** `operations/CLI-MANIFEST.md` — canonical single-source-of-truth registry of all CLIs.

All CLIs (notebooklm, spark-cli, aws-cli, cloud CLIs, media tools, etc.) are available to all three AI agents:
- **Claude Code:** Via Bash tool directly (`bash command-name`)
- **Codex:** Via Computer Use shell access (all CLIs in PATH)
- **Gemini CLI:** Via context-mode shell execution

**Automated CLI Installation** (you don't need to remember this):

When you need to install a new CLI, just run:
```bash
install-cli --name "command-name" --path "/path/to/binary" --description "what it does"
```

This automatically:
1. Creates the symlink to `~/.local/bin/`
2. Updates `operations/CLI-MANIFEST.md`
3. Syncs to all three AI agents
4. Verifies access

Then verify it worked:
```bash
verify-cli-access "command-name"
```

Key rule: **All three AIs must have access to all CLIs.** If a CLI is missing from any AI, it's a bug in the manifest or configuration. See the manifest for:
- Complete registry with paths and installation methods
- AI access matrix and verification commands
- How to verify notebooklm access specifically in Codex
- Automated installation and maintenance procedures

## Code, understand, improve, fix, review, build, document, ship

For ALL coding work — understanding your codebase, improving code quality, fixing bugs, reviewing code, building features, documenting modules, or shipping code — use `/code`. The master orchestrator accepts any natural language, classifies your intent (understand/improve/fix/review/build/document/ship/template), and routes automatically through the right toolchain. No skill names, no commands, no tool knowledge required — just describe what you need.

When you say "this code is spaghetti, clean it up" or "something is broken" or "review my code" or "ship this", the orchestrator:
1. Maps your codebase with `/graphify` (if needed) to understand structure and dependencies
2. Plans changes with `/plan-eng-review` (for refactors/builds)
3. Investigates bugs with `/investigate` (for fixes)
4. Reviews code with `/review` (always before shipping, escalates to `/codex` for high-risk changes)
5. Ships with `/ship` (PR creation, bump version, changelog)
6. Extracts patterns with `/learner` (after complex debugging or to create reusable templates)

Underlying tools remain independent and directly callable: power users can still invoke `/graphify`, `/investigate`, `/review`, `/ship`, etc. directly if they prefer.

## Design system

For ALL design work, use `/design` — the master orchestrator. It accepts any natural language, classifies the scenario (new project / reference mimic / existing upgrade) and project type (SaaS / landing / funnel / website), and sequences all 14 design skills automatically in the right order for that scenario. No commands, no skill names, no hooks to remember — just describe the goal.

Skills coordinated by the orchestrator: `/impeccable` (teach, shape, craft, document, critique, audit, polish, bolder, quieter, distill, harden, onboard, clarify, typeset, colorize, layout, adapt, optimize, overdrive, live), `/taste-skill`, `/soft-skill`, `/redesign-skill`, `/design-motion-principles`, `/web-design`, `/huashu-design`, `/design-consultation`, `/design-system`, `/plan-design-review`, `/design-review`, `/output-skill`, `/ui-ux-pro-max`.

## Web, browser & automation

For ALL web-related work — internet research, browser testing, authenticated interaction, reusable automations, and bulk scraping — use `/web`. The master orchestrator classifies intent and routes automatically to `/firecrawl` (research), `/browse` (interactive/testing), `/playwright` (reusable scripts), or `/apify` (scale). No tool names or commands needed — just describe the task in natural language.

Underlying tools remain independent and directly callable: users can still invoke `/firecrawl`, `/browse`, `/playwright`, `/apify` directly if they prefer.

## Video, media & production

For ALL video-related work — writing scripts, generating voiceovers, composing video assets, designing thumbnails, and posting to platforms — use `/video`. The master orchestrator classifies intent and routes automatically to `/stb-pipeline` (narrated slideshows), `/ffmpeg` (audio/video composition), `/design` (thumbnails and motion), and platform posting workflows. No tool names or commands needed — just describe the task in natural language.

Underlying tools remain independent and directly callable: users can still invoke `/stb-pipeline`, `/ffmpeg`, `/design`, `/n8n` directly if they prefer.

### Viral Flow Content Discovery & Strategy

For ALL viral content strategy work — discovering trending topics, generating angles, scoring hooks, building scripts, analyzing performance, and multi-platform posting — use `/video` orchestrator (routes to `STRATEGY` workflow via Viral Flow). Or invoke `/viral-flow` skill directly for content strategy work independent of video production. The orchestrator classifies intent and routes automatically to Viral Flow core workflows: DISCOVER (trending topics), ANGLE (unique framing), HOOK (compelling openings), SCRIPT (full video content), ANALYZE (performance tracking), POST (multi-platform uploading), ACCOUNT (account management), and SERIES (batch grouping). Platform-agnostic: posts to YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, X, and custom platforms. Single natural-language entry point — just describe the task in natural language.

Underlying tool (`Viral Flow` npm package at `/Users/Office/Repos/stevewesthoek/viralflow`) remains independent and directly callable: users can still invoke Viral Flow CLI directly if they prefer.

## Codebase comprehension & architecture

For ALL codebase-related work — mapping project structure, understanding architecture, finding dependencies, querying cross-module relationships, extracting design rationale — use `/graphify`. The master orchestrator turns any folder (code, docs, PDFs, images, videos) into a queryable knowledge graph with interactive visualization. No commands, no API knowledge needed — just describe what you want to know about your project.

Single command `/graphify .` generates: `graph.html` (interactive visualization), `GRAPH_REPORT.md` (god nodes + surprising connections + suggested questions), `graph.json` (queryable data for future sessions).

Underlying tool (`graphifyy` CLI) remains independent and directly callable: power users can still invoke `graphify query`, `graphify path`, `graphify explain` directly if they prefer.

## Workspace rules

1. Do not work in brain root unless the task is about the brain repo itself.
2. Project work: start in the target repo under `~/Repos/`.
3. Claude/system maintenance: `brain/operations/system-configs/claude`.
4. Skill maintenance: `brain/ai/skills`.

## Repo layout

Local repos at `~/Repos/` by GitHub account:

- `prochatdemo/` — demos
- `prochattools/` — tools, SaaS, clients, ops (`boilerplates/`, `clients/`, `ops/`, `saas/`, `waas/`, `web/`)
- `stevewesthoek/` — personal (this repo)
- `yeshuaacademy/` — Yeshua Academy

## Repo split

**Two independent repos with symlink connection:**

```
mind/                    ← Personal Obsidian vault (iOS + Mac)
  01-inbox/              Strategy captures
  02-strategy/           Strategic decisions
  03-projects/           Active project containers
  04-tasks/              742 atomic work items (business/personal/church/family)
  05-areas/              Long-term responsibilities
  kanban.md              Active work board (To Do, Doing, Done, Backlog)
  home.md                Dashboard command center
  .git/                  Independent repo: stevewesthoek/mind

brain/ (machine-brain)   ← AI infrastructure, system config, skills
  ai/skills/             Claude/Codex/Gemini skills
  tools/                 Utility scripts and tools
  operations/system-configs/  ← symlinked to home (~)
  mind/ → symlink to ../mind/ (AI agents read vault)
  .git/                  Independent repo: stevewesthoek/brain
```

**Content separation:**
- **mind/**: All strategy, projects, tasks, personal knowledge
- **brain/**: All AI infrastructure, system configs, automation, skills

**Sync:**
- `mind`: Obsidian Git plugin (iOS ↔ Mac bidirectional, ~200MB per clone)
- `brain`: Development workflow (Mac development)
- Symlink: `brain/mind` → `../mind` (AI agents access full vault context for reasoning)

## Repo structure (machine-brain)

| Directory | Purpose |
|-----------|---------|
| `ai/skills/` | Skill management (active symlinks → vendors/custom) |
| `operations/system-configs/` | Global tool configs, symlinked from home directory |
| `operations/runbooks/` | Procedures, standards, and reference documentation |
| `operations/standards/` | API standards, testing procedures, deployment guidelines |
| `operations/accounts/` | Credential metadata, billing, inventories |
| `operations/deploy/` | Deployment configs (Dokploy) |
| `tools/` | Utility scripts and tools (google-ads, aws, azure, cloudflare, n8n, etc.) |
| `mind/` | Symlink to ../mind (vault for AI context) |
| `projects/` | Project context, specs, execution docs |

## Reference docs

For credential conventions, see `operations/standards/api-standards.md`. For testing/QA procedures, see `operations/runbooks/testing.md`. For deployment rules, see `operations/runbooks/deploy.md`. For model tracking and cost transparency, see `operations/runbooks/model-tracking-reference.md`.

## RTK token-output optimization

RTK is installed globally (`rtk 0.39.0`) to reduce shell-command token output in AI sessions. Use `/rtk` for guidance and `operations/runbooks/rtk.md` for install, verification, and rollback.

- Claude Code: Bash commands pass through `~/.claude/hooks/rtk-safe-bash-hook.sh`, which runs `check-risky-command.sh` first, then RTK rewrite.
- Codex and Gemini: prefer explicit `rtk` prefixes for noisy shell commands unless a native hook has already rewritten them.
- Use raw commands or `rtk proxy <command>` when exact full output is required.

## Memory system

**Single entry point:** Use `/memory` orchestrator for all memory operations (recall, capture, facts, review, maintain). Works with Claude Code, Codex, Gemini CLI, and all IDEs. Automatic intent detection via natural language — no commands to remember.

**Write path:** `mem-write` creates/updates memory entries (types: user/feedback/project/ref) and auto-extracts facts to `mem-facts`.

**Structured facts:** `mem-facts` manages entity-predicate-object facts in append-only JSONL. Commands: add/list/search/invalidate.

**Read path:** `mem-search` queries memory files by keyword/ID. Also searches facts with `--facts` flag.

**Tools are CLI-based and all independent:** Users can invoke `mem-write`, `mem-facts`, `mem-search` directly via shell. The `/memory` orchestrator is a convenience routing layer, not a replacement.

**Progressive disclosure pattern:** Always `mem-search <keyword>` first (index + file matches). Only fetch full content for clearly relevant IDs.

**Automatic memo detection:** UserPromptSubmit hook in `~/.claude/hooks/memory-recall-hook.sh` detects 4 intents (RECALL/CAPTURE/FACTS/REVIEW) and injects context automatically. User never needs to invoke the hook.

See `brain/ai/skills/custom/memory/SKILL.md` for full orchestrator documentation and natural language routing table.

## ProBot Updates (Controlled & Safe)

**CRITICAL: All updates are manual and controlled. No automatic silent updates.**

ProBot now features a **safe update system** that:
- Detects when Node.js version or native modules need updates
- Shows "Update Available" banner in dashboard (never silent)
- Captures running services before update
- Gracefully stops all services in dependency order
- Runs update subprocess: `npm install` + `npm rebuild`
- Auto-restarts ProBot
- Auto-restores services that were running, in startup order
- Health-checks each service before marking restored
- Shows final status: success, partial, or error

**User workflow:**
1. See "Update Available" banner in ProBot dashboard (top-right corner, red background)
2. Read what's updating (shows Node version, native modules, package updates)
3. Click "Update Now" button
4. See "Updating..." spinner
5. Dashboard auto-reloads after ~30 seconds
6. See success/failure status
7. All services auto-restored

**Documentation:**
- Full runbook: `operations/runbooks/probot-updates.md`
- Implementation: `projects/probot/src/{services/updates.ts, bot/update-orchestrator.ts}`
- UI: Update banner + JS in `projects/probot/src/bot/dashboard.ts`

**Reference:**
- Dependency order for safe shutdown/startup (critical!)
- Service health-check endpoints and timeouts
- Pre-update state file (`~/.probot/update-restore-state.json`)
- Manual recovery steps if update fails

**See:** `operations/runbooks/probot-updates.md` for complete procedure, troubleshooting, and manual recovery steps.

## Spark CLI (Email/Calendar/Contacts)

**Spark CLI** provides universal access to Spark email client data (emails, calendar, contacts, meetings, teams) across all AI/IDE consumers.

**Installation:** Universal wrapper pattern — stable entry point across Claude Code, Codex, Gemini CLI, Kiro, Cursor, Antigravity.

**Entry points:**
- CLI consumers (Claude Code, Codex, Gemini CLI): `spark-cli <command>` (e.g., `spark-cli accounts`, `spark-cli search "topic"`)
- IDE consumers (Kiro, Cursor, Antigravity): Use `/use-spark` skill instead

**Requirements:**
- Spark Desktop app must be running (IPC-based client only)
- macOS only
- Cannot run in sandboxes, containers, or remote sessions
- Requires live Spark Desktop process on the local machine

**Key commands:**
```bash
spark-cli accounts                    # list accounts + access levels
spark-cli emails                      # list inbox
spark-cli search "topic"              # semantic search with bodies
spark-cli thread 1234                 # read full thread
spark-cli events --week               # calendar this week
spark-cli availability --tomorrow --attendees alice@co.com  # find free time
spark-cli draft --to alice@co.com --subject "Hi" --body "Message"  # compose
spark-cli action archive 1234         # archive email
spark-cli team "Team Name"            # team info
```

**Documentation:** See `operations/runbooks/spark-cli.md` for full reference, version tracking, updates, and troubleshooting. See `ai/skills/custom/spark/SKILL.md` for comprehensive command reference.

**Installation files:**
- Wrapper: `operations/system-configs/bin/spark-cli` (symlinked to `~/.local/bin/spark-cli`)
- Skill: `ai/skills/custom/spark/SKILL.md` (symlinked via `ai/skills/active/spark`)
- Distributed to: Claude Code, Codex, Gemini CLI, Kiro, Cursor, Antigravity

**Verification:** Run `operations/system-configs/bin/verify-spark-cli-installation.sh` to check all consumers.

## Container runtime

**OrbStack** is the default local container runtime on this Mac. It replaces Docker Desktop.
- For local container workflows, see `/orbstack` skill
- Local development databases (plain PostgreSQL) run in OrbStack via docker-compose
- Docker CLI commands work identically under OrbStack
- Production uses self-hosted Supabase server on Tailscale (100.71.31.88) — not replicated locally

## Symlink map (home → brain)

| Home path | Target |
|-----------|--------|
| `~/.claude` | `operations/system-configs/claude/` |
| `~/.codex` | `operations/system-configs/codex/` |
| `~/.gemini` | `operations/system-configs/gemini/` |
| `~/.kiro` | `operations/system-configs/kiro/` |
| `~/.config/starship.toml` | `operations/system-configs/starship/starship.toml` |
| `~/.config/ghostty/config` | `operations/system-configs/ghostty/config` |
| `~/.config/git/ignore` | `operations/system-configs/git/ignore` |

`~/.claude.json` is NOT symlinked (contains secrets). Template: `operations/system-configs/claude/claude.json.template`.

## Credentials

Master index (metadata only): `operations/accounts/credentials-index.md`. Run `sync-credentials` to scan for new `.env` files. A PostToolUse hook auto-runs it when `.env` files are written.

## Decision log

`operations/decision-log.md` — confirmed decisions only.

## Model tracking

Claude Code model routing is now **fully transparent** — your status line shows which model is running and why in real-time.

- **Status line display:** Dynamic badges show escalations, modes, preprocessing (`↑`, `⊙`, `◊`, `⚙`, etc.)
- **Tracking file:** `~/.claude/model-tracking.json` — readable state of current model + reason
- **Cost awareness:** See when tasks escalate from Haiku → Sonnet → Opus
- **Runbook:** `operations/runbooks/model-tracking.md` — full operational guide
- **Reference:** `operations/runbooks/model-tracking-reference.md` — user-facing quick reference

This system runs automatically via hooks in `~/.claude/settings.json`. No user action needed — just look at your status line.


## Machine-brain tasks

**What goes on the machine kanban (in mind/04-tasks/):**

Tasks for machine-brain infrastructure work (AI infrastructure, system config, skills):
- Skill development (new Claude/Codex/Gemini skills)
- System configuration updates
- Automation scripts and hooks
- Model routing and cost optimization
- Integration work (n8n, APIs, webhooks)
- Infrastructure maintenance (Dokploy, Docker, databases)
- Performance optimization
- Documentation updates for machine infrastructure

**Track in mind/kanban.md:**
- Create a "machine" tag or prefix: `#machine` in task name or tag
- Keep machine tasks visible alongside personal work
- Machine work gets priority on strategic decisions affecting AI agents

**Example machine task entries:**
```
- [ ] Build ChatGPT bridge skill #machine
- [ ] Optimize model-tracking hook for Opus #machine
- [ ] Set up Apify multi-account webhook automation #machine
- [ ] Update n8n brain-inbox workflow #machine
- [ ] Document skill installation process #machine
```

Machine tasks integrate with your main workflow — same kanban, same priorities, same daily execution.

---

## Do not break

**CRITICAL: Symlink-dependent folders (NEVER MOVE OR DELETE):**
- `operations/system-configs/` (17 symlinks from home ~)
- `tools/scripts/sync-credentials.sh` (→ ~/.local/bin/sync-credentials)
- `tools/n8n-api.sh` (→ ~/.local/bin/n8n-api)
- `ai/skills/custom/apify/` (2 symlinks)
- `mind/` symlink (→ ../mind)

**Symlinks map (home → machine-brain):**
- `~/.claude` → `machine-brain/operations/system-configs/claude`
- `~/.codex` → `machine-brain/operations/system-configs/codex`
- `~/.gemini` → `machine-brain/operations/system-configs/gemini`
- `~/.kiro` → `machine-brain/operations/system-configs/kiro`
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are symlinks → machine-brain
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may symlink into machine-brain

**If you touch these symlink folders, it breaks everything:**
- NEVER move `operations/system-configs/`
- NEVER move/delete symlinked scripts
- NEVER change the `mind/` symlink
- NEVER modify any symlink paths
