# Codex Config

Selected files in this folder are symlinked into `~/.codex`.

It is the canonical repository home for portable Codex configuration. The live
`~/.codex` root is a real, short, machine-local directory so macOS app-server
socket paths stay below the `SUN_LEN` limit.

## What's canonical here

- `AGENTS.md` — global Codex instructions
- `config.toml` — portable Codex baseline for model selection, trusted projects,
  MCP/plugin setup, and intentional preferences; host paths are rendered when copied
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
- App-build hashes, marketplace refresh timestamps, cache locations, and other
  upgrade-derived fields stay local and must not be copied back into this baseline

The Cloudflare API MCP is intentionally not part of the Brain baseline. Use the
provider-agnostic `cloudflare-api` command documented in
`operations/runbooks/cloudflare.md`; Cloudflare Skills remain available through
the shared skill sources and profile system.

## Managed live layout

The standard live layout is:

```text
~/.codex/                    real directory
├── AGENTS.md                -> this folder
├── config.toml              physical mode-0600 generated copy
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

The manager renders `/Users/Office` placeholders to the current account home,
so the same Git checkout is safe on Office, MacBook, and a restored Mac. It
requires every Brain-owned TOML key/value while allowing additional app-derived
keys/sections and app-local overrides inside `[desktop]` in the physical copy,
so normal Codex upgrades and UI preferences do not create false drift. The
tracked `[desktop]` values act as restore defaults, not continuously enforced
runtime authority. A deliberate Brain source change may require `repair`; repair
preserves the complete previous physical config in its timestamped backup before
regeneration and carries forward app-local `marketplaces.*` and model-availability
tables plus the existing `[desktop]` table, so installed plugins remain
discoverable and UI preferences survive. Restore the app and let it
initialize its bundled marketplaces before applying the Brain baseline on a new
Mac. App-derived state remains local-only and is never promoted automatically.

## Skill loading rule

Do not install user, vendor, or curated skills as top-level directories under
the live `~/.codex/skills/`. Codex treats that root as default-active. Shared
skills should enter through `ai/skills/` and `docs/skills/profiles/`; Codex-only
dormant skills stay under `skills-dormant/` until explicitly promoted.
