# Brain

Private knowledge base and shared resource repo for Steve across local machines and IDE tools.

## Infinite Brain canonical chain

```text
operations/specs/infinite-brain-philosophy.md
→ operations/specs/infinite-brain-strategy.md
→ operations/specs/infinite-brain-runtime-roadmap.md
→ operations/specs/infinite-brain-runtime-implementation-plan.md
→ operations/runbooks/infinite-brain-roadmap-status.md
```

Mind owns human meaning and the cross-repo priority order. Brain owns executable retrieval, capability, safety, and live status. See `/Users/Office/Repos/stevewesthoek/mind/system/mind-roadmap.md` and `/Users/Office/Repos/stevewesthoek/mind/system/brain-mind-bridge.md`.

## Purpose

This repo holds:
- reusable AI prompts and shared skills
- operational docs, scripts, and selected system configs
- runtime workspace notes
- project-specific assets and execution docs

It is meant to be:
- human-readable
- AI-readable
- Git-synced
- cautious about secrets and machine state

## Top-Level Structure

- `projects/` — project-specific context, assets, notes, and execution docs
- `ai/` — prompts, provider notes, shared multi-tool skills
- `operations/` — runbooks, standards, scripts, snippets, automations, infrastructure, deploy docs, system configs
- `tools/` — utility and workflow scripts for this machine (`tools/scripts/`, tool-specific docs)
- `runtime/` — runtime workspace material and local working state

## ⚡ Quick Reference: Installing & Managing CLIs

**You install a CLI? It goes here automatically.**

See: `operations/CLI-INSTALLATION-GUIDE.md` — Complete procedural guide for all AIs.

**To install a new CLI:**
```bash
install-cli --name "command-name" --path "/real/path/to/command" --description "what it does"
```

This automatically:
1. Creates symlink to `~/.local/bin/`
2. Updates `operations/CLI-MANIFEST.md`
3. Syncs to all AIs (Claude Code, Codex, Gemini)
4. Verifies access in all three

**To verify a CLI works in all AIs:**
```bash
verify-cli-access "command-name"
```

**For large local context:**
```bash
brain-compress compress logs/build.log --type log
brain-compress retrieve <hash>
brain-learn-failures --repo . --write-report
```

These tools are explicit and Brain-native. They do not proxy Claude, Codex, Gemini, or application AI calls.

**Files:**
- `operations/CLI-MANIFEST.md` — Complete registry (70+ CLIs)
- `operations/CLI-INSTALLATION-GUIDE.md` — Full procedural guide
- `operations/AI-CONFIG-INDEX.md` — AI configuration central directory
- `operations/runbooks/context-compression.md` — Reversible context compression and failure-learning workflow
- `tools/scripts/install-cli.sh` — Installation automation
- `tools/scripts/verify-cli-access.sh` — Access verification

**Optional standalone agent surfaces:**
- `omp` / Oh My Pi is installed as a separate terminal AI coding agent, like Cursor, Kiro, Antigravity, Claude Code, Codex, or Gemini. It is not part of the Brain platform architecture and must not replace AI Model Selector, Brain skills, shared memory, or routing policy. See `operations/runbooks/omp-optional-agent.md`.
- Open Design (`open-design`) is installed outside Brain at `/Users/Office/Repos/nexu-io/open-design` as an optional external visual design workbench for `/design`. It must not replace the design orchestrator, AI Model Selector, Brain skills, shared memory, or routing policy. See `operations/runbooks/open-design-optional-design-surface.md`.

---

## Reading Order

For AI agents, start here:

1. `AGENTS.md`
2. `00-start-here.md`
3. `00-current-context.md`
4. `00-memory-map.md`
5. `README.md`
6. `CLAUDE.md` when detailed repo-specific Claude behavior is needed
7. `operations/CLI-MANIFEST.md` when working with CLI tools

For humans or repo browsing, start here:

1. `README.md`
2. `projects/README.md`
3. `ai/README.md`
4. `operations/README.md`
5. `runtime/README.md`

For personal context and business organisation information, see the mind repo (`~/Repos/stevewesthoek/mind`). For AI-system context, skills, configs, runbooks, and automations, use this brain repo.

## Expanding This Repo

Rule: whenever you add or change content, update the documentation that describes it.

| What you're adding | What to update |
|--------------------|----------------|
| New top-level folder | This README (Top-Level Structure + Folder Notes), plus Reading Order if it needs a start-here doc |
| New project under projects/ | `projects/README.md`, plus a README in the new project folder if it's active |
| New skill | `ai/skills/README.md` if the structure changes; symlink in `ai/skills/active/` |
| New tool config under system-configs/ | `operations/system-configs/README.md` symlink map |
| New automation | `operations/automations/README.md` (if it exists), or note in `operations/README.md` |
| New script under tools/scripts/ | `tools/README.md` |
| Confirmed architecture decision | `operations/decision-log.md` |
| Change to how Claude or Codex should behave globally | `~/.claude/CLAUDE.md` (global) or `brain/CLAUDE.md` (repo-level) |

This table is the contract. If a tool reads the docs and finds no pointer to a new folder, it will not know it exists. Keep this table current.

**Before removing anything:** check if the item is a symlink target (see `CLAUDE.md` under "Do not break"), has an active symlink in `ai/skills/active/`, or is referenced in the table above. If yes, update those references first.

## Folder Notes

### `projects/`
- Organised by project.
- Each project folder should stand on its own and contain its own README when the project is active enough to justify one.

### `ai/`
- Shared prompts, publishing systems, agent definitions, and reusable skills.
- `ai/skills/` is the canonical shared skill library for cross-tool use.

### `operations/`
- `operations/runbooks/` for repeatable procedures
- `operations/standards/` for reference docs, API standards, testing procedures
- `operations/runbooks/` for operational procedures and guides
- `operations/scripts/` for executable helpers
- `operations/snippets/` for small reusable fragments
- `operations/automations/` for workflow exports and higher-level automation
- `operations/infrastructure/` for architecture and infra docs
- `operations/deploy/` for real deployment configs only
- `operations/system-configs/` for synced tool config and selected machine state — subdirs supply home symlink targets for Claude, Kiro, Ghostty, git, and Starship, plus the managed config-file targets inside the real local `~/.codex` runtime root. Each subdir is mixed-content: portable config, intentionally versioned state, and gitignored machine noise. See `operations/system-configs/README.md` for details.

### `runtime/`
- runtime-specific workspace notes.
- `runtime/cache/` and `runtime/local/` are local-support folders, not canonical truth.
- runtime bootstrap files should point to canonical docs instead of duplicating them.

## Obsidian-First Brain Core Direction

The accepted roadmap is to make Obsidian the only primary human dashboard for personal, business, machine, workflow, and orchestrator operation.

Canonical docs:

- `docs/system/obsidian-brain-core-roadmap.md` — architecture roadmap and boundaries
- `docs/system/obsidian-brain-core-implementation-plan.md` — execution plan and migration phases
- `docs/system/obsidian-mind-steward-roadmap.md` — historical mind vault roadmap; current implementation name is Mind Steward
- `docs/system/obsidian-mind-steward-implementation-plan.md` — historical implementation plan; current project lives at `projects/mind-steward`

## Runtime and Brain Core

The accepted architecture direction is Obsidian-first:

- Obsidian / `mind` is the target primary human cockpit.
- Brain Core is the small local machine boundary for structured status and controlled actions.
- Slack and Telegram, if retained, should remain thin fallback clients over Brain Core.

Read first for the current direction:

- `docs/system/obsidian-brain-core-roadmap.md`
- `docs/system/obsidian-brain-core-implementation-plan.md`

All runtime glue now lives under `runtime/`.

If you need to understand the runtime setup:
- Track ongoing decisions in `operations/decision-log.md`.
- Use the `runtime/cache/` and `runtime/local/` folders only for disposable state; keep canonical context in the top-level folders.

Runtime bootstrap pointers, memory notes, and approval checkpoints belong in their canonical document rather than duplicated runtime files.

## Skills

Canonical shared skills live in:
- `ai/skills/`

Shared skills live in `ai/skills/` and are consumed directly by every agent; there is no
need to duplicate them under another workspace.

Tool-native or vendor-managed skills should stay separate:
- Cursor internal skills: `operations/system-configs/cursor/skills-cursor/`
- Codex bundled/system skills: live machine state under `~/.codex/skills/.system/`

Rule of thumb:
- shared business/domain skills → `ai/skills/`
- tool-specific helper skills → stay with that tool

## Config and Git Policy

Only version:
- portable, human-maintained config
- docs, prompts, scripts, templates, and canonical notes
- intentional project deliverables and generated assets that are part of the reusable knowledge base or product library

Do **not** version:
- auth tokens
- credentials, connection strings, and client secrets
- browser profiles
- session logs
- debug dumps
- SQLite state
- cache folders
- `.DS_Store`
- generated tool runtime

Exception: some tool state is intentionally versioned for continuity. This includes Codex skill imports, vendor references, and selective history files. These are present by design but are not canonical reference material — treat them as supporting artifacts, not docs.

`operations/system-configs/` should stay curated. If a file is mostly machine state, it should be ignored or moved out of Git.

Generated-file rule:
- version generated **project artifacts** when they are intentional outputs you want synced, reviewed, reused, or shipped from this repo
- do **not** version generated **tool/runtime state** when it is just local machine noise, cache, session history, debug data, or transient automation output

Examples:
- version: generated SSML, scripts, and intentional reusable production source assets under a project like `projects/says-the-bible/production/`
- do not version: rendered media output folders, `.wrangler/`, Codex/Claude session data, browser profiles, SQLite tool state, IDE caches, local shell credentials

## Cloudflare / Wrangler

This repo currently has **no active Cloudflare Pages site**.

If you are not deploying anything to Cloudflare, you do not need:
- `wrangler.toml`
- Cloudflare Pages placeholder folders
- `.wrangler/` cache folders

Wrangler is just Cloudflare’s CLI/config system for Workers and Pages:
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/

## Design Principle

This repo should optimize for:
- clear top-level boundaries
- low ambiguity
- minimal duplication
- canonical truth in one place
- runtime state separated from durable knowledge
