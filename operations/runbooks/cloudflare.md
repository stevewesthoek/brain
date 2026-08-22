# Cloudflare Runbook

## Purpose
Manage tunnels, DNS, and edge exposure safely.

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
