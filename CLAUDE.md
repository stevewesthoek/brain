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

**Session recovery system (.ai/ folder):**
- `.ai/current.md` — Short-term compressed session state (auto-written by Stop hook, overwritten each session, not tracked in git)
- `.ai/decision-log.md` — Durable append-only decisions (tracked in git, survives across sessions)
- `.ai/handoffs/` — Optional milestone handoff snapshots (tracked in git, archived when important)

**Distinction:** `.ai/` is operational session state (like a browser tab recovery system). `ai/` is the tracked durable AI infrastructure (skills, policies, agents). Do not confuse them. Do not move `.ai/` without updating the `/handoff` skill and hooks.

## Skill Installation & Profile Management

**Critical rule:** When installing a new skill, you MUST decide whether it's always-active or domain-specific. This prevents context bloat in Codex and Claude Code.

### Always-Active Skills (Context Budget: 7 Skills Max)

These skills load in every session and should be minimal:

1. **code** — Master coding orchestrator (understand/improve/fix/review/build/document/ship)
2. **research** — Master research orchestrator
3. **memory** — Memory operations (recall/capture/facts/review)
4. **review** — Pre-landing code review
5. **qa** — QA and testing workflows
6. **handoff** — Session pause/resume with compressed state
7. **careful** — Safety guardrails for destructive commands

**Context usage:** ~1,800 lines total. If this grows beyond 15 skills, Codex will warn about context budget.

### Domain-Specific Skills (Load on Demand)

These load automatically when you invoke domain orchestrators:

- **Video domain** (`/video`): ffmpeg, stb-pipeline, n8n, notebooklm, video (11 skills active when invoked)
- **Design domain** (`/design`): design-system, design-motion-principles, design-review (8 skills active when invoked)
- **Deploy domain** (`/deploy` or `/land-and-deploy`): freeze, canary, dokploy, gh, forge (9 skills active when invoked)
- **Research domain** (`/research`): firecrawl, web, browse, autoresearch, investigate, graphify (9 skills active when invoked)

### Dormant Skills (Never Active)

These live in `ai/skills/custom/` or `ai/skills/vendors/` and are invoked explicitly when needed:

- Specialized vendor skills: agents-sdk, cloudflare, cloudflare-email-service, durable-objects, sandbox-sdk, web-perf, workers-best-practices, wrangler
- Single-use skills: individual project tasks, one-off integrations
- Reference skills: documentation, API references, runbooks

### Installation Checklist

When installing a new skill:

1. **Decide category** — Use the decision tree above (always-active, domain-specific, or dormant)
2. **Create skill folder:**
   - First-party → `ai/skills/custom/{skill-name}/SKILL.md`
   - Third-party → `ai/skills/vendors/{vendor}/{skill-name}/SKILL.md`
   - **Never** put a skill directly in `ai/skills/active/` (should only contain symlinks)
3. **Create symlink if always-active:**
   ```bash
   ln -s ../custom/{skill-name} ai/skills/active/{skill-name}
   # OR for vendor skills:
   ln -s ../vendors/{vendor}/{skill-name} ai/skills/active/{skill-name}
   ```
4. **If domain-specific:** Update the domain profile, then update the domain orchestrator's SKILL.md to reference it
5. **Verify the profile:**
   ```bash
   node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
   ```
6. **Sync to all AI consumers:**
   ```bash
   node tools/scripts/sync-ai-skills.mjs --check
   ```

### Profile Management

Switch between predefined skill profiles:

```bash
# Show available profiles
node tools/scripts/switch-skill-profile.mjs --list

# Preview a profile change
node tools/scripts/switch-skill-profile.mjs video --dry-run --verbose

# Apply a profile
node tools/scripts/switch-skill-profile.mjs video --apply --verbose

# Verify all consumers are synced
node tools/scripts/sync-ai-skills.mjs --check

# Restore original active set (if something breaks)
node tools/scripts/switch-skill-profile.mjs full-current --apply --verbose
```

Available profiles:

| Profile | Skills | Use case |
|---------|--------|----------|
| `default` | 7 | Minimal always-on (code, research, memory, review, qa, handoff, careful) |
| `video` | 11 | Add video orchestrator + ffmpeg, stb-pipeline, n8n, notebooklm |
| `design` | 8 | Add design orchestrator + design-system, design-motion-principles, design-review |
| `deploy` | 9 | Add deploy tools: freeze, canary, dokploy, gh, forge, land-and-deploy |
| `research` | 9 | Add research tools: firecrawl, web, browse, autoresearch, investigate, graphify |
| `power` | 17 | Most orchestrators + domain tools (for power users) |
| `productivity` | 5 | Minimal + memory + handoff (for focused work) |
| `full-current` | 119 | RECOVERY: all original active entries (pre-May-8-2026) |

**See:** `docs/skills/profile-activation-runbook.md` for full procedures and troubleshooting.

### Why This Matters

**Before:** 16 active skills = 5,943 lines → Codex warns about context budget  
**After (default):** 7 active skills = 1,800 lines → 69% context saved  
**Result:** ~4,100 lines freed for actual work in Codex and Claude Code

---

## Universal capability install

Before installing ANY skill, CLI, or MCP server: run `/brain-universal-capability-install`. All three engines (Claude, Codex, Gemini) must be configured simultaneously.

After activating or installing a skill, export it to all configured AI/IDE consumers by running:
```bash
node tools/scripts/sync-ai-skills.mjs --dry-run && node tools/scripts/sync-ai-skills.mjs && node tools/scripts/sync-ai-skills.mjs --check
```

This syncs active skills to Claude Code, Codex, Cursor, Kiro, and Antigravity. The check should pass before continuing with other work.

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

### Optional standalone agent surfaces

`omp` / Oh My Pi is installed as an optional separate terminal AI coding agent, comparable to Cursor, Kiro, Antigravity, Codex, and Gemini. Use it only as a manually selected external coding surface or evaluation harness.

Do not use `omp` as the Brain provider/model router. Do not migrate Brain skills, shared memory, or routing policy into `omp`. The AI Model Selector at `localhost:4890`, `brain/ai/skills/`, `~/.brain/memory/`, and `brain/ai/policy/routing.md` remain canonical. Runbook: `operations/runbooks/omp-optional-agent.md`.

Open Design (`open-design`) is installed outside Brain at `/Users/Office/Repos/nexu-io/open-design` as an optional external visual design workbench for `/design`, comparable to Cursor, Kiro, Antigravity, and other IDE-like surfaces. It must not replace `/design`, `/web-design`, Brain skills, shared memory, or the AI Model Selector. Runbook: `operations/runbooks/open-design-optional-design-surface.md`.

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

For ALL design work, use `/design` — the master orchestrator. It classifies the scenario (new project / reference mimic / existing upgrade) and project type (SaaS / landing / funnel / website), then sequences the relevant design subskills.

Skills coordinated by the orchestrator: `/impeccable` (teach, shape, craft, document, critique, audit, polish, bolder, quieter, distill, harden, onboard, clarify, typeset, colorize, layout, adapt, optimize, overdrive, live), `/taste-skill`, `/soft-skill`, `/redesign-skill`, `/design-motion-principles`, `/web-design`, `/huashu-design`, `/design-consultation`, `/design-system`, `/plan-design-review`, `/design-review`, `/output-skill`, `/ui-ux-pro-max`, `/awesome-design-md`.

`/awesome-design-md` is a public-brand DESIGN.md reference at `brain/ai/skills/custom/awesome-design-md/SKILL.md`. It provides style direction, reference-brand patterns, and token cues when no approved project `DESIGN.md` exists.

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
  ai/skills/             Claude/Codex skills
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

For large non-command context, use `brain-compress` explicitly. It compresses JSON, logs, and text, stores the original under `~/.brain/cache/compression/`, and retrieves exact content by hash. It is not a model proxy and does not affect Claude, Codex, Gemini, or the AI Model Selector. Runbook: `operations/runbooks/context-compression.md`.

For recurring failed paths, command forms, or local runtime gotchas, use `brain-learn-failures --repo . --write-report` to generate an advisory report before promoting only high-signal items through `/learner`.

## Memory system

**Single entry point:** Use `/memory` orchestrator for all memory operations (recall, capture, facts, review, maintain). Works with Claude Code, Codex, Gemini CLI, and all IDEs. Automatic intent detection via natural language — no commands to remember.

**Write path:** `mem-write` creates/updates memory entries (types: user/feedback/project/ref) and auto-extracts facts to `mem-facts`.

**Structured facts:** `mem-facts` manages entity-predicate-object facts in append-only JSONL. Commands: add/list/search/invalidate.

**Read path:** `mem-search` queries memory files by keyword/ID. Also searches facts with `--facts` flag.

**Tools are CLI-based and all independent:** Users can invoke `mem-write`, `mem-facts`, `mem-search` directly via shell. The `/memory` orchestrator is a convenience routing layer, not a replacement.

**Progressive disclosure pattern:** Always `mem-search <keyword>` first (index + file matches). Only fetch full content for clearly relevant IDs.

**Automatic memo detection:** UserPromptSubmit hook in `~/.claude/hooks/memory-recall-hook.sh` detects 4 intents (RECALL/CAPTURE/FACTS/REVIEW) and injects context automatically. User never needs to invoke the hook.

See `brain/ai/skills/custom/memory/SKILL.md` for full orchestrator documentation and natural language routing table.

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
- Skill development (new Claude/Codex skills)
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
- `~/.kiro` → `machine-brain/operations/system-configs/kiro`
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are symlinks → machine-brain
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may symlink into machine-brain

**If you touch these symlink folders, it breaks everything:**
- NEVER move `operations/system-configs/`
- NEVER move/delete symlinked scripts
- NEVER change the `mind/` symlink
- NEVER modify any symlink paths
