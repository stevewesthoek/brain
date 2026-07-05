# Runtime System-Config Ownership Audit

**Status:** Task D audit baseline  
**Date:** 2026-07-05  
**Scope:** `operations/system-configs/**` and adjacent runtime logs/state that repeatedly appear as local dirty files.  
**Purpose:** separate canonical configuration from generated adapter shims, live local machine state, logs, and machine-specific files before any cleanup or ignore migration is proposed.

## Boundary

This audit is documentation only.

It does **not** authorize:

- reset, clean, stash, delete, or archive operations;
- broad `.gitignore` changes;
- committing currently dirty local/runtime files;
- editing binary app bundles or SQLite state;
- replacing symlinks or runtime config paths;
- regenerating adapter shims.

Any future action must name exact paths and receive separate approval.

## Current source evidence

`operations/system-configs/README.md` already defines the folder as synced tool configuration for Claude Code, Codex, Kiro, Cursor, shell, git, Ghostty, Starship, Docker, SSH, MCP, Antigravity, and IDE context.

The README also states that subdirectories may contain a mix of:

- portable config;
- intentionally synced state;
- machine state;
- local-only secrets and overlays;
- logs, session data, auth tokens, caches, SQLite files, history files, and symlink targets.

Current recurring dirty-state evidence includes:

- `.graphifyignore`;
- `operations/system-configs/claude/**` runtime/update state and plan deletions;
- `operations/system-configs/codex/**` app bundle files, SQLite state, config, skills/plugin files, attachments, browser, computer-use config, and process manager state;
- `tools/firecrawl/logs/firecrawl.log`.

These paths are evidence for classification pressure, not permission to clean them.

## Ownership classes

### Class 1 — Canonical portable config

Definition: human-maintained configuration intended to be versioned and reused across machines or AI/IDE tools.

Examples from existing documentation:

- `operations/system-configs/README.md`;
- `operations/system-configs/ide-context.md`;
- portable `CLAUDE.md`, `AGENTS.md`, `config.toml`, shell, git, Ghostty, Starship, Cursor, Kiro, Gemini, and Antigravity templates when they contain no secrets;
- MCP templates that contain no tokens or local credentials.

Default handling:

- may be edited intentionally;
- may be committed when the change is reviewed and scoped;
- should have clear purpose and owner documentation.

### Class 2 — Canonical templates / generated-from-canon inputs

Definition: files that act as safe, tracked templates or canonical inputs for runtime tools, but are not live secret-bearing overlays.

Examples:

- token-free MCP templates;
- documented adapter input files;
- skill source definitions that are activated through the canonical skill export flow.

Default handling:

- may be committed when token-free and reviewed;
- should not contain machine-local credentials;
- should be regenerated/synced into runtime locations only through documented commands.

### Class 3 — Generated adapter shims / reproducible exports

Definition: files produced by a sync/export command from canonical source.

Known pattern from `operations/system-configs/README.md`:

```bash
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

Default handling:

- do not hand-edit unless the shim is also explicitly the canonical source;
- prefer regenerating from canonical source;
- commit only when the generator and expected output are both understood;
- future audit should identify which dirty Codex/Claude/Gemini/Cursor/Kiro files are generated shims versus canonical inputs.

### Class 4 — Intentionally synced runtime state

Definition: runtime artifacts that are versioned only by practical necessity and should be treated as state, not doctrine.

Possible examples mentioned by existing documentation:

- selected history files;
- selected SQLite state;
- selected imported skill/vendor state.

Default handling:

- do not treat as canonical knowledge;
- commit only with an explicit reason;
- prefer moving toward reproducible exports when possible;
- future audit should decide whether each intentionally synced runtime file still earns its versioned status.

### Class 5 — Local-only machine state

Definition: local runtime state, logs, auth/session files, caches, tokens, machine-specific overlays, temporary files, and tool process state.

Examples from current dirty-state pressure:

- `operations/system-configs/claude/.last-*` update state;
- Claude transient plan files if they are local execution artifacts;
- Codex attachments/browser/process-manager state;
- computer-use local config when machine-specific;
- `tools/firecrawl/logs/firecrawl.log`;
- auth/session/cache/temp/log files;
- token-bearing MCP config.

Default handling:

- should remain uncommitted unless separately proven canonical;
- should not be used as durable Brain/Mind truth;
- should not be cleaned by this audit;
- may need exact-path ignore or local overlay policy in a future approved task.

### Class 6 — Binary/application bundles

Definition: application bundle files or binary assets under system-config paths.

Examples from current dirty-state pressure:

- `operations/system-configs/codex/computer-use/Codex Computer Use.app/**`;
- nested helper applications and code signature files.

Default handling:

- do not edit or commit casually;
- treat as high-risk for repo noise and platform-specific drift;
- future audit should decide whether the bundle belongs in git, a release artifact, a local install path, or a documented external dependency.

### Class 7 — Unknown / pending classification

Definition: any path whose ownership class is not documented.

Default handling:

- do not commit;
- do not clean;
- classify with exact path evidence first.

## Decision rules for future cleanup or ignore work

Before any exact path is ignored, deleted, moved, or committed, answer:

1. Is this path canonical portable config, a token-free template, generated output, runtime state, local-only machine state, a binary bundle, or unknown?
2. Is there an existing documented generator or sync command?
3. Does the file contain secrets, tokens, credentials, private keys, logs, local paths, or machine-specific state?
4. Would removing it break a symlink target or live tool runtime?
5. Is the desired action a commit, ignore, regeneration, local overlay, or no-op?
6. What command validates the result without broad staging or cleanup?

## Recommended next follow-up task

Create a path-by-path classification table for the recurring dirty paths only:

```text
.graphifyignore
operations/system-configs/claude/**
operations/system-configs/codex/**
tools/firecrawl/logs/firecrawl.log
```

That follow-up should remain report-only unless Steve separately approves exact-path ignore or cleanup proposals.

## Current conclusion

Task D establishes the ownership model but intentionally does not resolve any dirty files.

The safest immediate policy is:

- canonical portable config may be committed when scoped and reviewed;
- generated shims should be regenerated, not hand-edited;
- runtime state and machine-local files should stay uncommitted;
- binary app bundles require a separate explicit decision;
- unknown paths must be classified before action.
