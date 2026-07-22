# Codex Config

Selected files in this folder are symlinked into `~/.codex`.

It is the canonical repository home for portable Codex configuration. The live
`~/.codex` root is a real, short, machine-local directory so macOS app-server
socket paths stay below the `SUN_LEN` limit.

## What's canonical here

- `AGENTS.md` — global Codex instructions
- `config.toml` — Codex runtime config, model selection, trusted projects, MCP/plugin setup
- `rules/default.rules` — curated reusable approval rules that should survive machine rebuilds
- `skills/user` — repository projection of the shared active skill set; the live
  `~/.codex/skills/user` points directly to `ai/skills/active`
- `skills-dormant/` — archived Codex-only skills that must not load in every default session

## What's machine state (not canonical)

- `history.jsonl`, `session_index.jsonl`, `sessions/`, `archived_sessions/`, `worktrees/` — session and workspace state
- `auth.json`, `models_cache.json`, `version.json`, `.codex-global-state.json`, `.personality_migration` — local auth or machine state
- `log/`, `logs_*.sqlite`, `state_*.sqlite`, `sqlite/`, `cache/`, `tmp/`, `.tmp/` — runtime logs, caches, and temporary databases
- `skills/.system/`, `vendor_imports/`, Computer Use bundles, and plugin cache
  internals — Codex-owned local runtime content unless explicitly normalized
  and documented

## Rule

Keep only durable Codex config in Git.

- `rules/default.rules` should contain reusable approvals, not one-off commands from ad hoc sessions
- Do not commit auth files, histories, logs, caches, or transient plugin/runtime state
- If a file is mostly machine-generated, ignore it unless there is a documented reason to version it

## Managed live layout

The standard live layout is:

```text
~/.codex/                    real directory
├── AGENTS.md                -> this folder
├── config.toml              -> this folder
├── RTK.md                   -> this folder
├── rules/                   real directory
│   └── default.rules        -> this folder
├── skills/                  real directory
│   ├── .system/             local Codex content
│   └── user                 -> brain/ai/skills/active
└── sessions, auth, plugins  local Codex content
```

Manage it with `operations/scripts/codex-home-managed-root.sh`; do not manually
replace the root with a symlink. The guarded migration and rollback procedure is
in `operations/runbooks/codex-managed-runtime-root.md`.

## Skill loading rule

Do not install user, vendor, or curated skills as top-level directories under
the live `~/.codex/skills/`. Codex treats that root as default-active. Shared
skills should enter through `ai/skills/` and `docs/skills/profiles/`; Codex-only
dormant skills stay under `skills-dormant/` until explicitly promoted.
