# CLAUDE.md — machine-brain

## Purpose

Claude Code instructions for the `machine-brain` repo — AI infrastructure, system config, and skills. This is part of a split repo structure (see "Repo split" section below).

## Session lifecycle

1. **Start** — If `.ai/current.md` exists in the target repo, run `/handoff resume`.
2. **Work** — Route by cost (Haiku → Sonnet → Opus → Codex). Use skills only when they add clear, measurable value over doing the task directly.
3. **End** — Run `/handoff pause`. If a non-obvious pattern was solved, run `/learner`.

`.ai/current.md` is the recovery point (auto-written by Stop hook). `decision-log.md` is durable — commit before switching devices.

## Universal capability install

Before installing ANY skill, CLI, or MCP server: run `/brain-universal-capability-install`. All three engines (Claude, Codex, Gemini) must be configured simultaneously.

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
| `operations/runbooks/` | Procedures for tools and workflows |
| `operations/accounts/` | Credential metadata, billing, inventories |
| `operations/deploy/` | Deployment configs (Dokploy) |
| `docs/` | Reference documentation (google-ads, standards) |
| `tools/` | Utility scripts and tools (google-ads, aws, azure, cloudflare, n8n, etc.) |
| `mind/` | Symlink to ../mind (vault for AI context) |
| `organisations/` | Brand truth, positioning, playbooks |
| `projects/` | Project context, specs, execution docs |
| `personal/` | Profile, writing style, values |

## Reference docs

For credential conventions, see `docs/api-standards.md`. For testing/QA procedures, see `docs/testing.md`. For deployment rules, see `docs/deploy.md`. For model tracking and cost transparency, see `docs/model-tracking-reference.md`.

## Symlink map (home → brain)

| Home path | Target |
|-----------|--------|
| `~/.claude` | `operations/system-configs/claude/` |
| `~/.codex` | `operations/system-configs/codex/` |
| `~/.gemini` | `operations/system-configs/gemini/` |
| `~/.kiro` | `operations/system-configs/kiro/` |
| `~/.docker` | `operations/system-configs/docker/` |
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
- **Reference:** `docs/model-tracking-reference.md` — user-facing quick reference

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
- `~/.docker` → `machine-brain/operations/system-configs/docker`
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are symlinks → machine-brain
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may symlink into machine-brain

**If you touch these symlink folders, it breaks everything:**
- NEVER move `operations/system-configs/`
- NEVER move/delete symlinked scripts
- NEVER change the `mind/` symlink
- NEVER modify any symlink paths
