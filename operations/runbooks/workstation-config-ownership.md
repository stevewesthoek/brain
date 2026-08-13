# Workstation Configuration Ownership and Migration

**Status:** Canonical configuration-ownership standard
**Effective:** 2026-08-12
**Contract:** `operations/specs/workstation-config-ownership.json`
**Validator:** `node tools/validate-workstation-config-ownership.mjs`

## Goal

Brain should let a new Mac reproduce the owner's intentional, non-secret workstation configuration from Git without turning Git into the live storage layer for application sessions, authentication, caches, histories, databases, locks, or other runtime state.

The governing rule is:

> Git owns reproducible configuration intent. Applications own mutable runtime state.

Symlinks remain useful, but they are one deployment mechanism rather than the ownership model itself.

## Four Ownership Modes

### `SYMLINK`

Use for stable, non-secret files or narrow directories that applications read but do not use as their mutable runtime root.

Examples:

- `~/.zshrc`
- `~/.zprofile`
- Ghostty config
- Starship config
- `~/.claude/settings.json`
- `~/.claude/hooks`
- `~/.claude/agents`
- active skill exports
- `~/.gemini/GEMINI.md`
- `~/.kiro/steering`

### `GENERATED-COPY`

Git remains canonical, but the live file is a physical local file. Refresh must use an atomic staged write, preserve a rollback copy, apply the required mode, and never replace the application's runtime root.

Canonical example:

```text
operations/system-configs/codex/config.toml
  -> generated physical ~/.codex/config.toml
```

### `INCLUDE`

Use an application's native include mechanism so the root config remains a physical local file while importing tracked Brain configuration plus an optional machine-local overlay.

Canonical examples:

```text
~/.gitconfig
  -> include Brain operations/system-configs/git/gitconfig
  -> include ~/.gitconfig.local

~/.ssh/config
  -> Include Brain operations/system-configs/ssh/config
  -> Include ~/.ssh/config.local
```

SSH private keys and `known_hosts` remain local-only.

### `LOCAL-ONLY`

Use for application-owned runtime/session/auth/cache state. Git may document expected locations but does not own live content.

Canonical local runtime roots:

```text
~/.claude
~/.cursor
~/.gemini
~/.kiro
~/.codex
```

These roots must never be whole-directory symlinks again.

## Why Whole-Directory IDE Symlinks Are Retired

The previous model put application runtime roots directly inside `operations/system-configs`. That mixed durable configuration with mutable state such as:

- Claude sessions, jobs, logs, locks, caches and daemon state;
- Cursor project/terminal/MCP runtime state;
- Gemini/Antigravity OAuth/account state, history, temporary data, knowledge locks and media;
- Kiro extension/power/runtime state;
- Codex auth, sessions, history, computer-use assets and caches.

Even when secrets are ignored by Git, this creates ambiguous ownership, noisy repositories, accidental persistence of runtime data, and migration risk.

## Office Mac and Thunderbolt MacBook Are One Configuration System

This standard covers both computers as one operational topology. Only fixed addresses are configuration authority; DHCP-assigned Wi-Fi/LAN addresses are deliberately ignored.

Canonical endpoints:

```text
Office Mac mini
  Thunderbolt: 192.168.2.1
  Tailscale:   100.86.124.66

MacBook M1
  Thunderbolt: 192.168.2.2
  Tailscale:   100.70.12.18
```

Canonical route policy:

```text
MacBook -> Office
  1. Thunderbolt 192.168.2.1 when directly connected
  2. Tailscale   100.86.124.66 everywhere else

Office -> MacBook
  1. Thunderbolt 192.168.2.2 when directly connected
  2. Tailscale   100.70.12.18 everywhere else
```

Home Wi-Fi, mobile/5G, and other networks are treated as underlays for Tailscale rather than separate canonical SSH identities. This avoids DHCP churn while preserving one stable remote identity per machine.

The tracked SSH config carries `MacBook` / `macbook` for the direct MacBook route and `office` for the Office host. Migration is not accepted unless aliases still resolve, fixed Thunderbolt and Tailscale routes remain correct, and non-destructive SSH connectivity works after the change.

Private keys stay local. The migration must never move, copy into Git, rewrite, or print private key material.

## Controlled Existing-Machine Migration

Current repository policy is **plan-only**. `liveMutationAuthorized=false` in the canonical spec. Do not convert the live Office or MacBook roots merely because the repo contract exists.

When the owner explicitly authorizes the host migration, perform each application independently.

### Gate 0 — Read-only baseline

Before touching a root:

1. record symlink/physical state and target;
2. record permissions and ownership;
3. inventory session/history/auth/runtime subpaths without printing secret contents;
4. record application version and executable path;
5. record disk usage and file counts;
6. run non-destructive app/CLI smoke checks;
7. for SSH, record `ssh -G MacBook`, `ssh -G macbook`, and `ssh -G office` resolution;
8. verify the Brain repository is clean and the ownership spec validates.

### Gate 1 — Application quiescence

Close the application or stop only the application process that owns the runtime root. Do not kill unrelated terminals, agents, IDEs, or services.

For Claude/Cursor/Gemini/Kiro/Codex, no root swap should happen while that application can still write to the old target.

### Gate 2 — Lossless snapshot

Before replacing a whole-directory symlink:

1. preserve the symlink metadata;
2. make a timestamped local backup outside the repo;
3. copy the current target contents into a staged physical runtime directory, preserving modes, symlinks and extended attributes where applicable;
4. verify important runtime/session/auth paths exist in staging;
5. write a rollback receipt containing original path, target, backup path and checksums/counts for non-secret critical files.

Do not clean the old repo-side runtime residue yet.

### Gate 3 — Atomic root conversion

Only after the staged runtime copy verifies:

1. move the whole-root symlink aside;
2. atomically place the staged physical directory at the original runtime-root path;
3. create only the narrow `SYMLINK` entries declared by the ownership spec;
4. materialize `GENERATED-COPY` entries atomically;
5. create physical `INCLUDE` roots for Git/SSH;
6. keep local overlays and private state outside Git.

### Gate 4 — Continuity tests

Before accepting a migrated app, verify its actual behavior.

Required categories:

- app/CLI starts normally;
- existing sessions/history/memory remain visible where the application supports them;
- authentication remains valid without re-importing secrets;
- managed settings/hooks/skills are still loaded;
- no runtime root is a whole-directory symlink;
- managed narrow links resolve to the expected Brain paths.

For SSH specifically:

```text
ssh -G MacBook
ssh -G macbook
ssh -G office
```

must resolve to the expected hosts, users, identity paths and Thunderbolt/Tailscale rules. Then run a non-destructive connectivity command using existing credentials. Failure means immediate rollback.

### Gate 5 — Rollback or accept

If any continuity check fails, restore the original symlink/root from the rollback receipt before further cleanup.

Only after acceptance may repo-side runtime residue be reviewed and removed. That later cleanup is a separate step and must never delete the local runtime copy that now owns the sessions/auth/history.

## New-Machine Bootstrap

For a fresh Mac:

1. clone Brain into the expected repository location;
2. validate `operations/specs/workstation-config-ownership.json`;
3. install required applications separately;
4. run `DRY_RUN=1 bash operations/scripts/brain-configs-link.sh`;
5. inspect the plan;
6. apply the bootstrap only when no existing runtime root would be overwritten;
7. sign in to apps locally where authentication is required;
8. verify Git and SSH includes;
9. verify Office↔MacBook connectivity if the machine participates in that topology.

The bootstrap must create real runtime directories first and only then attach narrow managed config entries.

## Adding a New Configuration Surface

Do not add ad-hoc symlinks.

For every new application/config path:

1. classify it as `SYMLINK`, `GENERATED-COPY`, `INCLUDE`, or `LOCAL-ONLY`;
2. add it to `operations/specs/workstation-config-ownership.json`;
3. set `gitSecretAllowance=false`;
4. document whether the application writes the path;
5. define session/auth/runtime preservation requirements;
6. add or update validation coverage;
7. update the bootstrap/migration tooling;
8. dry-run on the target machine;
9. only then change the live filesystem.

Whole mutable runtime roots are not eligible for `SYMLINK`.

## Secret Boundary

Git may store references to credential providers, host aliases, expected environment-variable names, public host addresses, and non-secret client configuration.

Git must not store:

- private SSH keys;
- OAuth tokens;
- API tokens;
- auth databases;
- session cookies;
- credential caches;
- application-generated secret state.

## Current Migration Status

As of 2026-08-12:

- the ownership contract is defined in Brain;
- repository validation is required;
- new bootstrap behavior is being updated to stop creating unsafe whole-root links;
- live Office/MacBook symlinks have **not** been migrated by this maintenance tranche;
- application sessions, histories, memories, auth state, caches and runtime databases remain untouched;
- model caches/apps remain untouched;
- host migration requires a separately authorized, receipt-backed execution pass.
