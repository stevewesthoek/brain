# Brain

Private knowledge base and shared resource repo for Steve across local machines, IDE tools, and OpenClaw.

## Purpose

This repo holds:
- durable personal, business, and project context
- reusable AI prompts and shared skills
- operational docs, scripts, and selected system configs
- OpenClaw workspace files and runtime notes

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
- `operations/` — runbooks, scripts, snippets, automations, infrastructure, deploy docs, system configs
- `runtime/` — ProBot/OpenClaw runtime workspace material and local working state

## Reading Order

Start here:
1. `README.md`
2. `personal/README.md`
3. `organisations/README.md`
4. `projects/README.md`
5. `ai/README.md`
6. `operations/README.md`
7. `runtime/README.md`

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
- `operations/scripts/` for executable helpers
- `operations/snippets/` for small reusable fragments
- `operations/automations/` for workflow exports and higher-level automation
- `operations/infrastructure/` for architecture and infra docs
- `operations/deploy/` for real deployment configs only
- `operations/system-configs/` for curated machine/tool config that is intentionally synced

### `runtime/`
- Assistant-specific workspace and runtime notes.
- `runtime/openclaw/` is the dedicated OpenClaw workspace for this repo.
- `runtime/cache/` and `runtime/local/` are local-support folders, not canonical truth.
- runtime bootstrap files should point to canonical docs instead of duplicating them.

## OpenClaw Setup

This repo does **not** use the repo root as the OpenClaw workspace.

Instead, the OpenClaw workspace lives at:
- `runtime/openclaw/`

Why:
- keeps the repo root clean
- keeps OpenClaw bootstrap files in one obvious place
- still lets OpenClaw use the whole Brain through workspace symlinks
- avoids profile and business drift by keeping canonical truth outside the runtime folder

Inside `runtime/openclaw/` you will find standard OpenClaw workspace files such as:
- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- `MEMORY.md`
- `HEARTBEAT.md`
- `memory/`
- `skills/` → symlink to `ai/skills/`

Recommended OpenClaw config:

```json
{
  "agent": {
    "workspace": "/absolute/path/to/brain/runtime/openclaw"
  }
}
```

Current OpenClaw docs:
- https://openclawlab.com/en/docs/concepts/agent-workspace/
- https://openclawlab.com/en/docs/concepts/memory/

## Skills

Canonical shared skills live in:
- `ai/skills/`
- `runtime/openclaw/skills/` is only a workspace alias to that same location

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
- browser profiles
- session logs
- debug dumps
- SQLite state
- cache folders
- `.DS_Store`
- generated tool runtime

`operations/system-configs/` should stay curated. If a file is mostly machine state, it should be ignored or moved out of Git.

Generated-file rule:
- version generated **project artifacts** when they are intentional outputs you want synced, reviewed, reused, or shipped from this repo
- do **not** version generated **tool/runtime state** when it is just local machine noise, cache, session history, debug data, or transient automation output

Examples:
- version: generated SSML or other reusable production assets under a project like `projects/says-the-bible/production/`
- do not version: `.wrangler/`, Codex/Claude session data, browser profiles, SQLite tool state, IDE caches

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
