---
name: cloudpanel
description: Use when the user asks to work with CloudPanel via the CLI on the self-hosted server. Uses the remote `clpctl` binary through the shared local wrapper `~/.local/bin/cloudpanel-cli` and the `cloudpanel` SSH host alias. No MCP server.
---

# CloudPanel CLI

## What this skill is for
Help Claude and Codex use the self-hosted CloudPanel CLI safely and consistently through one shared command path:

```bash
~/.local/bin/cloudpanel-cli
```

This wrapper connects to the `cloudpanel` SSH host alias and runs the remote CloudPanel binary at `/usr/bin/clpctl`.

## Use this skill when
- Inspecting which CloudPanel CLI commands are available on the self-hosted server
- Exporting or importing a CloudPanel-managed database
- Resetting file permissions through CloudPanel
- Purging Varnish cache through CloudPanel
- Verifying that the CloudPanel host and CLI are reachable from the Mac

## Do not use this skill for
- Installing CloudPanel on a new server from scratch
- Browser-only CloudPanel admin tasks
- Production mutations without first stating the exact target and waiting for confirmation
- Building or using a CloudPanel MCP server

## Safety rules
1. **Treat the target as production by default.** This wrapper talks to the live self-hosted CloudPanel server, not a local sandbox.
2. **Confirm before mutations.** Wait for confirmation before database imports, permission resets, cache purges, or any other state-changing command.
3. **Remote paths are remote.** Any `--file` or `--path` argument refers to the CloudPanel server filesystem, not the Mac.
4. **Inspect before mutating.** Start with `~/.local/bin/cloudpanel-cli` (no args) to see the installed command set on the server.
5. **No secrets in output.** Do not print database credentials, backup contents, or SSH auth material into chat output.

## Local access contract

Stable local entrypoint:
```bash
~/.local/bin/cloudpanel-cli
```

Repo-managed wrapper source:
```bash
operations/system-configs/bin/cloudpanel-cli
```

SSH alias source of truth:
```bash
operations/system-configs/ssh/config
```

Current alias configuration:
- SSH host alias: `cloudpanel`
- Remote host: `ssh_cp.prochat.tools`
- Access path: Cloudflare Tunnel via `cloudflared access ssh`
- Remote user: `master`
- Remote CLI binary: `/usr/bin/clpctl`

Important:
- The current shared wrapper runs as `master` on the server.
- Root-only CloudPanel commands from the broader CloudPanel docs may require a different SSH user or passwordless `sudo` for `/usr/bin/clpctl`.

## Recommended workflow
```bash
# 1. Verify the wrapper can reach the host and list available commands
~/.local/bin/cloudpanel-cli

# 2. Decide whether the requested action is read-only or mutating
# 3. If mutating, restate the exact command and wait for confirmation
```

## Common commands

List the installed command surface:
```bash
~/.local/bin/cloudpanel-cli
```

Database export:
```bash
~/.local/bin/cloudpanel-cli db:export --databaseName=my-database --file=dump.sql.gz
```

Database import:
```bash
~/.local/bin/cloudpanel-cli db:import --databaseName=my-database --file=dump.sql.gz
```

Reset permissions:
```bash
~/.local/bin/cloudpanel-cli system:permissions:reset --directories=770 --files=660 --path=.
```

Purge Varnish cache:
```bash
~/.local/bin/cloudpanel-cli varnish-cache:purge --purge=all
~/.local/bin/cloudpanel-cli varnish-cache:purge --purge='tag1,tag2'
~/.local/bin/cloudpanel-cli varnish-cache:purge --purge='https://www.domain.com/site.html'
```

Direct SSH fallback:
```bash
ssh cloudpanel /usr/bin/clpctl
ssh cloudpanel /usr/bin/clpctl db:export --databaseName=my-database --file=dump.sql.gz
```

## Official references
- CloudPanel CLI docs overview: https://www.cloudpanel.io/docs/v1/cloudpanel-cli/cli-commands
- CloudPanel v2 CLI docs: https://www.cloudpanel.io/docs/v2/cloudpanel-cli/root-user-commands/
- CloudPanel CLI blog post: https://www.cloudpanel.io/blog/cloudpanel-cli-interface/

## Notes
- Verified on 2026-04-03 that the self-hosted `cloudpanel` SSH alias is reachable and exposes `/usr/bin/clpctl`.
- On this server, running `clpctl` with no args currently lists the `db`, `system`, and `varnish-cache` command groups.
- `sudo -n /usr/bin/clpctl ...` is not currently available for the `master` SSH user, so this shared setup is intentionally scoped to commands that work without password entry.
- This skill applies to both Claude and Codex. Both should use `~/.local/bin/cloudpanel-cli` or direct `ssh cloudpanel /usr/bin/clpctl`, not MCP.
