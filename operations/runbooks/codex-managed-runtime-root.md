# Codex Managed Runtime Root

## Purpose

Use this runbook when Codex Remote SSH fails with:

```text
path must be shorter than SUN_LEN
```

Codex creates its control socket at:

```text
$CODEX_HOME/app-server-control/app-server-control.sock
```

On macOS, that socket path must be at most 103 bytes. A whole-directory
`~/.codex` symlink can resolve into a much longer repository path. The standard
Brain layout therefore keeps `~/.codex` as a short, real, machine-local runtime
directory and symlinks only durable configuration entries into it.

## Standard layout

```text
~/.codex/                              real local directory
├── AGENTS.md                          -> Brain canonical config
├── config.toml                        -> Brain canonical config
├── RTK.md                             -> Brain canonical config
├── rules/                             real local directory
│   └── default.rules                  -> Brain canonical config
├── skills/                            real local directory
│   ├── .system/                       Codex-owned runtime content
│   └── user                           -> brain/ai/skills/active
├── app-server-control/                local runtime content
├── sessions/                          local runtime content
├── plugins/                           local runtime content
└── auth.json, SQLite, caches, etc.     local runtime content
```

Do not symlink the whole `~/.codex` directory, `rules/`, or `skills/`.

## Safety rules

- Run the live migration only after the repository change containing this
  runbook and `operations/scripts/codex-home-managed-root.sh` is on the Mini's
  canonical Brain branch.
- Close Codex/ChatGPT on the Mini before migration or rollback.
- Run the migration from Terminal on another computer over SSH. The Codex task
  controlling the Mini cannot safely migrate its own live runtime directory.
- Never set `CODEX_HOME_SKIP_PROCESS_CHECK=1` during a real migration. That
  override exists only for automated tests.
- Do not remove the timestamped backup until all acceptance checks pass.
- The script does not delete the original symlink, migrated data, or conflicts.
  It moves them into `~/.brain-configs-backups/codex-managed-root/`.

## One-time migration

### 1. On the Mac Mini, finish repository integration

The migration script must be available from the canonical Brain checkout:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
git branch --show-current
git status --short
```

Expected branch: the intended canonical branch, normally `main`.

Do not continue while there are unresolved merge conflicts or while the managed
Codex files are only present in a separate feature worktree.

### 2. Close Codex on the Mac Mini

Save any unfinished task, then use **Command-Q** to quit the Codex/ChatGPT app.
Also close Computer Use and any other Codex windows.

### 3. From the M1 MacBook, open Terminal and connect to the Mini

Use the SSH host or address that already works. For the direct address from the
original diagnosis:

```bash
ssh office@192.168.2.1
```

### 4. Enter the Brain repository

```bash
cd /Users/Office/Repos/stevewesthoek/brain
```

### 5. Run the read-only check

```bash
bash operations/scripts/codex-home-managed-root.sh check
```

Before migration, this should report that `~/.codex` is still a
whole-directory symlink. That failure is expected.

### 6. Preview the migration

```bash
DRY_RUN=1 CONFIRM_CODEX_HOME_MIGRATION=1 \
  bash operations/scripts/codex-home-managed-root.sh migrate
```

The preview must name the expected source:

```text
/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/codex
```

It must not report an unexpected source or an active Codex process.

### 7. Perform the migration

```bash
CONFIRM_CODEX_HOME_MIGRATION=1 \
  bash operations/scripts/codex-home-managed-root.sh migrate
```

Copy the printed `Original symlink backup:` path into a temporary private note.
It is needed only if rollback becomes necessary. The path contains no secret.

### 8. Re-run the check

```bash
bash operations/scripts/codex-home-managed-root.sh check
```

Every line should start with `[OK]`, and the final line should be:

```text
Codex managed runtime root check passed.
```

### 9. Start Codex on the Mini and validate locally

Confirm, without printing secret contents:

```bash
test -f ~/.codex/auth.json && echo "auth file present"
test -d ~/.codex/sessions && echo "sessions directory present"
test -L ~/.codex/config.toml && echo "config link present"
test -L ~/.codex/skills/user && echo "user skills link present"
codex mcp list
```

Then open Codex and confirm that existing tasks, skills, MCP servers, plugins,
browser/Computer Use, and normal local work still function.

### 10. Validate Remote SSH from the M1

In the Codex Mac app on the M1, connect to the Mini using the same SSH host as
before. A successful task opening proves the remote app server created its
short control socket. Repeat with other network routes only when those routes
have separate SSH configuration that also needs validation.

### 11. Keep the backup

Retain `~/.brain-configs-backups/codex-managed-root/<timestamp-pid>/` until the
system has worked normally for several sessions. Cleanup is a separate,
explicit operation and is not part of this migration.

## Rollback

Rollback is only needed if local or remote Codex behavior fails after migration.

1. Quit Codex/ChatGPT on the Mini again.
2. Connect from the M1 using Terminal and enter the Brain repository.
3. Use the exact `Original symlink backup:` path printed by migration:

```bash
CODEX_HOME_ROLLBACK_BACKUP="/Users/Office/.brain-configs-backups/codex-managed-root/REPLACE_WITH_TIMESTAMP_AND_PID/original-codex-home" \
CONFIRM_CODEX_HOME_ROLLBACK=1 \
  bash operations/scripts/codex-home-managed-root.sh rollback
```

The rollback restores the original symlink and moves the migrated real directory
beside the backup under a `failed-codex-home-<timestamp>` name. It deletes
nothing. Report the failure before attempting another migration.

## Maintenance

Use these commands after changing managed configuration or skill exports:

```bash
bash operations/scripts/codex-home-managed-root.sh check
# If check fails, quit Codex/ChatGPT and Computer Use before continuing.
bash operations/scripts/codex-home-managed-root.sh repair
bash operations/scripts/codex-home-managed-root.sh check
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

The general `brain-configs-link.sh` uses this manager. It never silently converts
a legacy whole-directory Codex symlink. Migration requires the explicit flags
shown above.

## Not in scope for this migration

- Removing legacy tracked runtime snapshots from
  `operations/system-configs/codex/`; that requires a separate path-by-path
  cleanup after live acceptance.
- Replacing the shared `config.toml` link with generated machine overlays;
  retain current compatibility until Codex has a documented composition model.
- Changing SSH, Thunderbolt, Wi-Fi, or Tailscale routing; those transports are
  independent of the local Unix-socket path failure.
