# Codex Managed Runtime Root

> Legacy/default-root maintenance only. This runbook is not the normal
> Account A/B profile lifecycle and is not invoked by the runtime-profile
> manager. Normal isolated profiles use dedicated `CODEX_HOME` roots and the
> profile-local Brain configuration materializer. Any live default-root
> migration requires a separate operator-authorized maintenance window.

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
`~/.codex` symlink can resolve into a much longer repository path. The original
MacBook→Mac-mini Remote SSH failure was caused by this resolved runtime-root
length, not by the contents of `config.toml` itself.

The standard Brain layout therefore keeps `~/.codex` as a short, real,
machine-local runtime directory. Stable durable entries may use narrow
symlinks, while mutable `config.toml` is materialized as a physical generated
copy from the tracked Brain source. This preserves the short socket path that
made Codex Remote SSH work while keeping Brain as the configuration authority.

## Standard layout

```text
~/.codex/                              real local directory
├── AGENTS.md                          -> Brain canonical config
├── config.toml                        physical generated copy from Brain canonical config
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
test -f ~/.codex/config.toml && test ! -L ~/.codex/config.toml && echo "physical generated config present"
stat -f '%Lp %N' ~/.codex/config.toml
cmp -s ~/.codex/config.toml /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/codex/config.toml && echo "generated config matches Brain"
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

The shared/default `~/.codex` is not a normal Brain-managed profile. Generic
repair and migration are refused there, and they are also refused when the
WebGPT integration journal is present. This prevents a physical-file operation
from rewriting WebGPT routes, model/provider selection, hook trust state, or
other application-owned resources.

For normal Brain-managed profiles, use the runtime-profile manager and its
profile-local configuration materializer. It writes only a non-secret profile
configuration artifact after an ownership plan, revision recheck, atomic
publication, and verification. It never owns `auth.json`, sessions, logs,
SQLite, sockets, locks, cookies, or Keychain items.

For a real shared-root maintenance window, first obtain explicit resource-level
authority from the owning application surfaces, stop all relevant writers, and
record the approved resources and rollback location. Use the WebGPT adapter for
WebGPT-owned route or journal recovery; do not repair those resources through
this script. Keep the timestamped backup and perform the acceptance checks
before any separate cleanup operation.

The following commands are therefore appropriate only for an isolated,
synthetic/test root or an explicitly approved exceptional maintenance flow:

```bash
bash operations/scripts/codex-home-managed-root.sh check
bash operations/scripts/codex-home-managed-root.sh preflight
# A real default-root preflight should refuse generic mutation.
bash operations/scripts/codex-home-managed-root.sh repair
bash operations/scripts/codex-home-managed-root.sh check
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

`preflight` is read-only and must report `OK: controlled Codex repair is
approved to run.` before a synthetic repair. A `NOT OK` result is a hard stop;
do not bypass it with `CODEX_HOME_SKIP_PROCESS_CHECK` outside tests.

The general `brain-configs-link.sh` uses this manager. It never silently converts
a legacy whole-directory Codex symlink. Migration requires the explicit flags
shown above.

## Read-only runtime observation

For a current diagnostic without stopping or changing Codex, run from the Brain
repository:

```bash
node tools/observe-infrastructure.mjs
```

The observer uses supported WebGPT doctor/DEV status, native `codex login
status`, safe app metadata, and allowlisted process/listener metadata. It never
reads auth files, browser storage, process arguments, environment variables,
Keychain values, OAuth, tunnel credentials, or MCP payloads. It never starts,
stops, restarts, logs in/out, repairs configuration, or attaches a connector.

Interpretation is intentionally account-agnostic:

- `authenticated` means only that the supported native status command
  classified a current session as authenticated; it does not identify an
  account or prove multiple profiles are preserved;
- WebGPT production `degraded` may mean its connector attachment is not
  locally provable even when the launcher, bridge, proxy, and tunnel are
  healthy;
- DEV `unknown` is expected when the profile is configured but not running or
  its MCP runtime is not ready;
- candidates and admission plans are evidence-only and never modify the
  canonical catalog.

The evidence report is
`operations/reports/ikhp-live-codex-runtime-observation-2026-09-05.md`.

## Not in scope for this migration

- Removing legacy tracked runtime snapshots from
  `operations/system-configs/codex/`; that requires a separate path-by-path
  cleanup after live acceptance.
- Replacing the shared `config.toml` link with generated machine overlays;
  retain current compatibility until Codex has a documented composition model.
- Changing SSH, Thunderbolt, Wi-Fi, or Tailscale routing; those transports are
  independent of the local Unix-socket path failure.
