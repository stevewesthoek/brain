---
name: hetzner
description: Use when the user asks to work with Hetzner Cloud via the CLI — especially to inspect or manage servers, volumes, firewalls, networks, DNS zones, snapshots, and other Hetzner Cloud resources. Use this for Hetzner infrastructure, not for CloudPanel site migration itself.
---

# Hetzner CLI

## What this skill is for
Help Claude and Codex use the official Hetzner Cloud CLI (`hcloud`) safely and consistently for Hetzner infrastructure work.

This skill is for the infrastructure layer:
- Hetzner Cloud servers
- firewalls
- networks
- volumes
- floating IPs / primary IPs
- snapshots / images
- DNS zones

This skill is not the migration engine for websites inside CloudPanel. Use it to manage the Hetzner side of the infrastructure, not to move app data between CloudPanel hosts.

## Use this skill when
- Listing or inspecting Hetzner Cloud servers
- Creating or deleting Hetzner Cloud servers
- Managing Hetzner firewalls, volumes, IPs, networks, images, or snapshots
- Querying Hetzner locations, datacenters, and server types
- Working with Hetzner DNS zones through `hcloud zone`

## Do not use this skill for
- Copying websites out of CloudPanel directly
- Migrating databases between CloudPanel hosts
- Site-level CloudPanel inventory or app migration
- Hetzner console/browser-only workflows when no CLI work is needed

## Safety rules
1. **Read-only discovery first.** Start with `version`, `context list`, `server list`, `network list`, `firewall list`, or catalog commands before any mutation.
2. **State the exact target.** Before any create, update, delete, or rebuild action, identify the target server/resource and expected region/location.
3. **Treat deletion as high impact.** Destructive Hetzner actions require explicit confirmation.
4. **Do not expose secrets.** Never print API tokens, context tokens, or raw config contents into chat output.
5. **Keep layers separate.** Use `hcloud` for Hetzner infrastructure and use SSH/CloudPanel/database/file-sync workflows for website migration.

## Stable local entrypoint

Use this command path for both Claude and Codex:

```bash
~/.local/bin/hetzner-cli
```

Repo-managed wrapper source:

```bash
operations/system-configs/bin/hetzner-cli
```

Installed binary on this machine:

```bash
/opt/homebrew/bin/hcloud
```

Verified on this machine:
- `hcloud` version: `1.62.0`
- installed via Homebrew on 2026-04-03

## Auth contract

The Hetzner CLI supports:
- config contexts in `~/.config/hcloud/cli.toml`
- environment variable `HCLOUD_TOKEN`
- environment variable `HCLOUD_CONTEXT`

The shared wrapper also supports a local env file:

```bash
~/.config/hetzner/.env
```

Example local-only env file:

```bash
export HCLOUD_TOKEN=your_hetzner_cloud_api_token
# optional:
# export HCLOUD_CONTEXT=default
```

Important:
- Keep Hetzner auth local only
- Never commit `~/.config/hetzner/.env`
- Never paste the token into repo files

## Read-only discovery commands

```bash
~/.local/bin/hetzner-cli version
~/.local/bin/hetzner-cli context list
~/.local/bin/hetzner-cli context active

~/.local/bin/hetzner-cli server list
~/.local/bin/hetzner-cli image list
~/.local/bin/hetzner-cli server-type list
~/.local/bin/hetzner-cli location list
~/.local/bin/hetzner-cli datacenter list
~/.local/bin/hetzner-cli firewall list
~/.local/bin/hetzner-cli network list
~/.local/bin/hetzner-cli volume list
~/.local/bin/hetzner-cli zone list
```

## Common mutation commands

```bash
~/.local/bin/hetzner-cli server create ...
~/.local/bin/hetzner-cli server delete ...
~/.local/bin/hetzner-cli volume create ...
~/.local/bin/hetzner-cli firewall create ...
~/.local/bin/hetzner-cli primary-ip create ...
~/.local/bin/hetzner-cli zone create ...
```

## Workflow guidance

For infrastructure moves like “Hetzner CloudPanel to AWS CloudPanel”:
1. Use `/hetzner` to inspect or snapshot the Hetzner server if needed
2. Use `/aws` to provision the AWS target server
3. Install CloudPanel on AWS
4. Migrate sites with SSH, `rsync`, `mysqldump`, and `clpctl`
5. Cut over DNS after final sync

Do not confuse the Hetzner CLI with CloudPanel migration tooling.

## Official references
- Hetzner Cloud API FAQ: https://docs.hetzner.com/cloud/api/faq/
- Hetzner Cloud CLI repository: https://github.com/hetznercloud/cli

## Notes
- This skill applies to both Claude and Codex.
- Until `HCLOUD_TOKEN` or a valid `hcloud` context is configured on this Mac, the CLI is installed but not authenticated.
