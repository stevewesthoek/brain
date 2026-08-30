---
name: cloudflare
description: Use when the user asks to manage Cloudflare DNS records, zones, or Cloudflare Tunnels via CLI. Uses guarded account-aware wrappers for ProChat Studio and JPV Bootcamp, with explicit provisioner and destroyer entrypoints for both Claude and Codex.
---

# Cloudflare CLI

## What this skill is for
Help any supported agent manage Cloudflare safely and consistently through
Brain-owned wrappers instead of ad hoc raw commands or MCP.

Primary targets:
- DNS records
- zone inspection
- tunnel inspection
- tunnel DNS routing

The wrappers use token-based auth stored outside the repo and follow the same operating model as AWS and Azure:
- provisioner wrappers for normal work
- destroyer wrappers for delete or teardown
- explicit account separation for `ProChat Studio` and `JPV Bootcamp`

## Use this skill when
- Managing DNS records on a Cloudflare zone
- Creating or managing Cloudflare Tunnels
- Configuring tunnel ingress rules to route traffic to local services
- Deploying Cloudflare Workers or Pages
- Managing KV, R2, D1, or other Cloudflare primitives
- Listing zones, checking zone status, or modifying zone settings

## Do not use this skill for
- Modifying DNS records on production domains without stating the change and waiting for confirmation
- Deleting tunnels or DNS records without explicit user confirmation
- Operations that could cause downtime without a rollback plan

## Safety rules
1. **Use the generic read-only API wrapper for inspection.** Prefer
   `~/.local/bin/cloudflare-api` for generic REST reads. Use the guarded
   account-specific `~/.local/bin/cloudflare-*` entrypoints for explicitly
   approved DNS/tunnel mutations, not direct raw API calls.
2. **Provisioner first.** Use the `*-provisioner` wrappers for reads, inspection, DNS upserts, and tunnel routing.
3. **Destroyer only for explicit teardown.** Use the `*-destroyer` wrapper only when the user has clearly asked to delete or tear down Cloudflare resources.
4. **State changes out loud.** For any mutation, describe the exact DNS or tunnel change before execution.
5. **Never expose tokens.** Do not print, log, or commit Cloudflare API tokens, account IDs beyond what is operationally needed, or tunnel credentials.
6. **DNS changes propagate.** Warn the user that DNS changes may take time to propagate and can affect live traffic.
7. **Cloudflare permission model is coarse.** The local wrapper layer provides an important part of the safety boundary because Cloudflare does not cleanly separate tunnel/DNS edit from destructive delete at the token-permission level.

## Stable local entrypoints

```bash
~/.local/bin/cloudflare-api
~/.local/bin/cloudflare-cli
~/.local/bin/cloudflare-prochat-provisioner
~/.local/bin/cloudflare-prochat-destroyer
~/.local/bin/cloudflare-jpvbootcamp-provisioner
~/.local/bin/cloudflare-jpvbootcamp-destroyer
```

Repo-managed wrapper sources:

```bash
operations/system-configs/bin/cloudflare-api
operations/system-configs/bin/cloudflare-cli
operations/system-configs/bin/cloudflare-account-wrapper
operations/system-configs/bin/cloudflare-prochat-provisioner
operations/system-configs/bin/cloudflare-prochat-destroyer
operations/system-configs/bin/cloudflare-jpvbootcamp-provisioner
operations/system-configs/bin/cloudflare-jpvbootcamp-destroyer
```

Credential storage:

```bash
~/.config/cloudflare-ai/credentials/
```

The generic wrapper does not read account-specific profile files. Callers pass
`CLOUDFLARE_API_TOKEN` or a protected token-only
`CLOUDFLARE_API_TOKEN_FILE`; account-token verification additionally requires
`CLOUDFLARE_ACCOUNT_ID`. The CloudPanel Certbot INI remains on the remote host
and is never copied into Brain.

Cloudflare MCP is not a required or canonical route. The Brain Cloudflare API
wrapper is the provider-agnostic command surface; Wrangler and cloudflared
retain their narrower product and tunnel roles.

## Account model

Known Cloudflare accounts on this machine:
- `ProChat Studio`
- `JPV Bootcamp`

Recommended wrapper usage:

```bash
# ProChat Studio
~/.local/bin/cloudflare-prochat-provisioner verify
~/.local/bin/cloudflare-prochat-provisioner zones list
~/.local/bin/cloudflare-prochat-provisioner dns list prochat.tools
~/.local/bin/cloudflare-prochat-provisioner tunnels list

# JPV Bootcamp
~/.local/bin/cloudflare-jpvbootcamp-provisioner verify
~/.local/bin/cloudflare-jpvbootcamp-provisioner zones list
~/.local/bin/cloudflare-jpvbootcamp-provisioner tunnels list
```

Destroyer wrappers exist for delete workflows:

```bash
~/.local/bin/cloudflare-prochat-destroyer ...
~/.local/bin/cloudflare-jpvbootcamp-destroyer ...
```

## Common commands

Verify token and account access:

```bash
~/.local/bin/cloudflare-prochat-provisioner verify
~/.local/bin/cloudflare-prochat-provisioner account
```

List zones:

```bash
~/.local/bin/cloudflare-prochat-provisioner zones list
~/.local/bin/cloudflare-prochat-provisioner zones list prochat.tools
```

List DNS records:

```bash
~/.local/bin/cloudflare-prochat-provisioner dns list prochat.tools
```

Create or update a DNS record:

```bash
~/.local/bin/cloudflare-prochat-provisioner dns upsert prochat.tools A app.prochat.tools 203.0.113.10 --ttl 1 --proxied false
~/.local/bin/cloudflare-prochat-provisioner dns upsert prochat.tools CNAME cp.prochat.tools 91069afe-7e45-4703-88c3-73bcf61c3fb6.cfargotunnel.com --ttl 1 --proxied true
```

List or inspect tunnels:

```bash
~/.local/bin/cloudflare-prochat-provisioner tunnels list
~/.local/bin/cloudflare-prochat-provisioner tunnels info CloudPanel
```

Route a hostname to an existing tunnel:

```bash
~/.local/bin/cloudflare-prochat-provisioner tunnels dns-route CloudPanel cp.prochat.tools
```

Delete a DNS record or tunnel:

```bash
~/.local/bin/cloudflare-prochat-destroyer dns delete prochat.tools <record-id>
~/.local/bin/cloudflare-prochat-destroyer tunnels delete CloudPanel
```

Escape hatches:

```bash
~/.local/bin/cloudflare-prochat-provisioner api GET /zones
~/.local/bin/cloudflare-prochat-provisioner wrangler whoami
~/.local/bin/cloudflare-prochat-provisioner cloudflared tunnel list
```

The provisioner wrapper blocks obvious destructive raw operations.

---

## Notes
- The old skill text assumed `wrangler zones` and `wrangler dns` subcommands that are not available in the currently installed Wrangler.
- This skill now prefers the guarded wrapper layer for DNS and tunnel operations.
- Live `wrangler whoami` on 2026-04-03 showed OAuth auth for `info@prochat.tools` and access to the `ProChat Studio` and `JPV Bootcamp` accounts.
- The current Wrangler OAuth token only exposes `zone (read)`, not `zone (write)`, so full DNS write access should use dedicated API tokens stored under `~/.config/cloudflare-ai/credentials/`.

## Token permissions (ProChat Studio)

Two API tokens exist under `~/.config/cloudflare-ai/credentials/`:

| File | Role | Permissions |
|------|------|-------------|
| `prochat-provisioner.env` | Provisioner | DNS (read/write), Tunnels (read/write), **Access: Apps and Policies (edit)** |
| `prochat-destroyer.env` | Destroyer | DNS (delete), Tunnels (delete), **Access: Apps and Policies (edit)** |

Both tokens were upgraded on 2026-04-05 to include `Access: Apps and Policies — Edit` for the ProChat Studio account.
This enables automated creation and management of Cloudflare Zero Trust Access applications and policies via the API escape hatch:
```bash
~/.local/bin/cloudflare-prochat-provisioner api POST /accounts/<id>/access/apps '{...}'
~/.local/bin/cloudflare-prochat-provisioner api POST /accounts/<id>/access/apps/<app-id>/policies '{...}'
```
- Cloudflare API docs: https://developers.cloudflare.com/api/
- Cloudflare token docs: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
