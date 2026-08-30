# Cloudflare Runbook

## Purpose

Manage Cloudflare safely through an agent- and IDE-independent command surface.
This runbook is the canonical operational entry point for Cloudflare access in
Brain.

## Tool hierarchy

Use the smallest tool that owns the operation:

1. `cloudflare-api` for generic, read-only Cloudflare REST API access.
2. The existing account-specific provisioner wrappers for explicitly approved
   DNS or tunnel changes, with the matching destroyer wrapper for teardown.
3. `wrangler` for Workers development, deployment, and Wrangler-owned product
   commands.
4. `cloudflared` for Tunnel and Access connectivity functions.
5. Cloudflare Skills for current platform guidance and product-specific
   instructions.

Cloudflare MCP is intentionally not part of the canonical Brain toolchain.
Cloudflare operations must not require Codex, Claude Code, Cursor, ChatGPT, or
an MCP registration.

## Generic read-only API wrapper

Source: `operations/system-configs/bin/cloudflare-api`

Machine entry point: `~/.local/bin/cloudflare-api`

The wrapper uses the Cloudflare v4 REST API with an `Authorization: Bearer`
token and issues GET requests only:

```bash
cloudflare-api auth
cloudflare-api auth --account-id <account-id>
cloudflare-api zones list thedutchperformance.nl
cloudflare-api zones get thedutchperformance.nl
cloudflare-api dns list thedutchperformance.nl
cloudflare-api api get /accounts/<account-id>/cfd_tunnel
```

Authentication contract:

- `CLOUDFLARE_API_TOKEN` is the preferred caller-supplied secret.
- `CLOUDFLARE_API_TOKEN_FILE` may point to a mode-`0600` file containing only
  one token line.
- `CLOUDFLARE_ACCOUNT_ID` (or `auth --account-id`) selects the account-token
  verification endpoint. Without it, `auth` uses the user-token endpoint.
- `CLOUDFLARE_API_BASE` is reserved for bounded tests or an explicitly
  approved compatible endpoint.

Secrets never belong in Brain, shell history, command arguments, logs, CI
configuration committed to Git, or documentation. The CloudPanel Certbot
credential remains a remote INI file at `/root/.cloudflare-dns-creds.ini`; it
must be parsed in place and must not be copied into the repository or a second
credential store. Its account-owned token is verified with
`/accounts/<account-id>/tokens/verify`, not `/user/tokens/verify`.

The generic wrapper is intentionally read-only. Use the existing guarded
account wrappers when a separately approved DNS or tunnel mutation is required:

```bash
cloudflare-jpvbootcamp-provisioner verify
cloudflare-prochat-provisioner zones list prochat.tools
cloudflare-prochat-destroyer dns delete prochat.tools <record-id>
```

## Wrangler and `cf` CLI boundary

Wrangler is retained for Workers/local development and product-specific
commands. It is not the generic DNS/account interface; use `cloudflare-api` or
the guarded account wrappers for zones and DNS. The unified `cf` CLI remains a
technical preview and is not canonicalized by Brain.

## OfficeMac Workbench tunnel

The owner-local OfficeMac tunnel is
1b1fa7bf-a00f-4f1a-86bb-faecac746051. Its Workbench route is intentionally
narrow:

    workbench.prochat.tools -> http://127.0.0.1:3154

As of 2026-08-22, cloudflared is 2026.8.2 and the local configuration
explicitly uses protocol: http2. This is a reversible transport mitigation
for intermittent QUIC/UDP resets observed on the Office network. The local
macOS application firewall is disabled; no local firewall rule was added.

Required network egress is TCP/UDP port 7844 to Cloudflare tunnel edge
endpoints. If HTTP/2 is reverted, verify UDP reachability first. Do not change
the Workbench origin, expose port 3154 publicly, or use compatibility ports
3052-3054 as a substitute.

### Verification

    launchctl print gui/502/com.cloudflare.cloudflared
    curl http://127.0.0.1:20241/metrics
    curl https://workbench.prochat.tools/health
    curl http://127.0.0.1:3154/health

Require the LaunchAgent to be running, four active HA connections, zero
cloudflared_tunnel_request_errors, and successful local and public health
responses. Restart only the tunnel with:

    launchctl kickstart -k gui/502/com.cloudflare.cloudflared

Rollback is a config-only change: remove protocol: http2, restart the same
LaunchAgent, and repeat the verification checks. Preserve the Workbench app
runtime while testing tunnel changes.

## Checklist
- Verify tunnel status
- Confirm DNS points to the correct tunnel
- Ensure only intended services are exposed

## Rollback
- Disable/rollback DNS change
- Remove tunnel route if needed
