# Brain

Private knowledge base and shared resource repo for Steve across local machines, IDE tools, and the ProBot runtime.

## Purpose

This repo holds:
- durable personal, business, and project context
- reusable AI prompts and shared skills
- operational docs, scripts, and selected system configs
- runtime and ProBot workspace notes

It is meant to be:
- human-readable
- AI-readable
- Git-synced
- cautious about secrets and machine state

## Top-Level Structure

- `personal/` — personal profile, writing style, values, boundaries
- `organisations/` — company, brand, messaging, offers, playbooks
- `projects/` — project-specific context, assets, notes, and execution docs
- `ai/` — prompts, provider notes, shared multi-tool skills
- `operations/` — runbooks, standards, scripts, snippets, automations, infrastructure, deploy docs, system configs
- `tools/` — utility and workflow scripts for this machine (`tools/scripts/`, tool-specific docs)
- `runtime/` — ProBot runtime workspace material and local working state

## Reading Order

Start here:
1. `README.md`
2. `personal/README.md`
3. `organisations/README.md`
4. `projects/README.md`
5. `ai/README.md`
6. `operations/README.md`
7. `runtime/README.md`

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

### `personal/`
- Stable personal context.
- Prefer these files over ad-hoc notes for identity, communication, and values.

### `organisations/`
- Organised by organisation/brand.
- Use this for brand truth, positioning, legal docs, and growth playbooks.

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
- `operations/system-configs/` for synced tool config and selected machine state — subdirs are the symlink targets for `~/.claude`, `~/.codex`, `~/.kiro`, `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml`. Each subdir is mixed-content: portable config, intentionally versioned state, and gitignored machine noise. See `operations/system-configs/README.md` for details.

### `runtime/`
- ProBot-specific workspace and runtime notes.
- `runtime/cache/` and `runtime/local/` are local-support folders, not canonical truth.
- runtime bootstrap files should point to canonical docs instead of duplicating them.

## Runtime & ProBot

All runtime glue now lives under `runtime/`. The local ProBot daemon is the always-on teleport layer for Claude, Codex, and Brain — there is no separate OpenClaw workspace anymore.

If you need to understand the runtime setup:
- Read `projects/probot/SPEC.md` for the Telegram command center architecture.
- Track ongoing decisions in `operations/decision-log.md` (search for "ProBot" or "OpenClaw" to see the decommissioning notes).
- Use the `runtime/cache/` and `runtime/local/` folders only for disposable state; keep canonical context in the top-level folders.

Runtime bootstrap pointers, memory notes, and approval checkpoints belong in their canonical document rather than duplicated runtime files.

## Skills

Canonical shared skills live in:
- `ai/skills/`

Shared skills live in `ai/skills/` and are consumed directly by every agent; there is no
need to duplicate them under another workspace.

Tool-native or vendor-managed skills should stay separate:
- Cursor internal skills: `operations/system-configs/cursor/skills-cursor/`
- Codex bundled/system skills: `operations/system-configs/codex/skills/.system/`

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
