---
name: tailscale
description: Use when the user asks to inspect Tailscale network status, check node reachability, list peers, or run Tailscale pre-flight checks before SSH or deploy operations.
---

# Tailscale CLI

## What this skill is for

Help Claude and Codex inspect and reason about the Tailscale network safely using the local CLI wrapper. Tailscale is the primary private network for this infrastructure — AWS servers `dokploy-aws` and `cloudpanel-aws`, Azure VM `vm-supabase`, and the Office Mac communicate over Tailscale. Current Tailscale identities are `dokploy`, `cloudpanel`, and `supabase`.

This skill is primarily read-only and observability-oriented. For device removal and account management, use the Tailscale API (key at `~/.config/tailscale/.env`) or the admin console.

## Use this skill when

- Checking which nodes are online or offline in the tailnet
- Verifying reachability of a server before SSH or deploy
- Looking up a node's Tailscale IP
- Diagnosing connectivity issues between nodes
- Running pre-flight checks in scripts or skills before remote operations
- Inventorying the current tailnet topology

## Do not use this skill for

- Managing Tailscale ACLs or user permissions (use the admin console)
- Changing tailscale network configuration
- Connecting or disconnecting the local node without explicit user confirmation
- Any action that could disrupt the private network tunnel

## Device removal via API

API key is stored at `~/.config/tailscale/.env` (`TAILSCALE_API_KEY`).

```bash
source ~/.config/tailscale/.env

# List all devices with IDs
curl -s -u "$TAILSCALE_API_KEY:" "https://api.tailscale.com/api/v2/tailnet/-/devices" \
  | python3 -c "import sys,json; [print(d['id'], d['hostname'], d['addresses']) for d in json.load(sys.stdin)['devices']]"

# Remove a device by ID
curl -s -X DELETE -u "$TAILSCALE_API_KEY:" "https://api.tailscale.com/api/v2/device/{deviceId}"
```

## Safety rules

1. **Read-only by default.** All standard operations (`status`, `ping`, `ip`, `whois`) are safe and non-mutating. Use them freely.
2. **Confirm before `up`/`down`.** Connecting or disconnecting Tailscale affects all server access — confirm with the user before running `tailscale up` or `tailscale down`.
3. **Never expose auth keys.** Tailscale auth keys and OAuth secrets must not appear in output or logs.
4. **Pre-flight, not gate.** A failed ping means the node may be offline or unreachable — investigate before assuming the Tailscale network itself is broken.
5. **This skill applies to both Claude and Codex.**

## Stable local entrypoint

```
~/.local/bin/tailscale-cli
```

Repo source: `operations/system-configs/bin/tailscale-cli`
Binary: `/opt/homebrew/bin/tailscale` (v1.92.5, Homebrew)

No auth config file needed — Tailscale uses its own daemon (`tailscaled`) and GUI/CLI auth. The local wrapper only resolves the binary path.

## Tailnet node inventory

Current production nodes as of 2026-08-26 (the 2026-08-18 inventory was superseded by Azure Dokploy decommission):

| Node | Tailscale IP | OS | Role | Status |
|------|--------------|----|------|--------|
| `office` | `100.86.124.66` | macOS | Primary control plane (Mac mini) | Online |
| `dokploy` (AWS resource `dokploy-aws`) | `100.71.47.24` | Linux | AWS Lightsail — authoritative Dokploy production | Online |
| `cloudpanel` (AWS resource `cloudpanel-aws`) | `100.121.12.36` | Linux | AWS Lightsail — authoritative CloudPanel host | Online |
| `vm-supabase` (Tailscale identity `supabase`) | `100.71.31.88` | Linux | Azure-hosted self-managed Supabase/PostgreSQL VM in subscription `supabase-azure` | Online |
| `macbook` | `100.70.12.18` | macOS | Secondary Mac — personal laptop | Idle |
| `iphone` | `100.107.201.123` | iOS | Mobile device | Online |
| `motorola` | `100.107.156.26` | Android | Mobile device | Offline |

All production servers use OpenSSH-over-Tailscale (not Tailscale SSH mode). Public TCP/22 is blocked at the Lightsail cloud firewall on both AWS hosts.

## Read-only discovery commands

```bash
# Show all peers and their status
~/.local/bin/tailscale-cli status

# Show peers as JSON (useful for scripting)
~/.local/bin/tailscale-cli status --json

# Ping a specific node (connectivity check)
~/.local/bin/tailscale-cli ping dokploy

# Ping with timeout and count (for pre-flight use)
~/.local/bin/tailscale-cli ping -c 1 --timeout 5s dokploy

# Show this node's Tailscale IP
~/.local/bin/tailscale-cli ip -4

# Look up a node's identity
~/.local/bin/tailscale-cli whois 100.71.47.24

# Show version
~/.local/bin/tailscale-cli version
```

## Pre-flight check pattern

Use this pattern in any script that SSHes to a Tailscale-connected server:

```bash
# Tailscale pre-flight: verify node is reachable before SSH
_ts="${TAILSCALE_BIN:-$HOME/.local/bin/tailscale-cli}"
[[ -x "$_ts" ]] || _ts="$(command -v tailscale 2>/dev/null || true)"
if [[ -n "$_ts" ]] && ! "$_ts" ping -c 1 --timeout 5s "$SSH_TARGET" >/dev/null 2>&1; then
  echo "Pre-flight failed: Tailscale node '$SSH_TARGET' is unreachable. Aborting." >&2
  exit 1
fi
```

## Scripts with pre-flight integration

- `brain/tools/scripts/backup-n8n.sh` — verifies `dokploy` is reachable before SSH export

## Notes

- Tailscale is the primary private network for this infrastructure. All production server SSH goes through Tailscale IPs.
- Public SSH (TCP/22) is blocked on both AWS Lightsail hosts. Emergency access only via `lightsail-connect` browser console.
- Tailscale admin console and ACL management are out of scope for this skill.
