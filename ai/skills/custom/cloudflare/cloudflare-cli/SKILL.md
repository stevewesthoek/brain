---
name: cloudflare
description: Use when the user asks to manage Cloudflare DNS records, zones, or Cloudflare Tunnels via CLI. Covers wrangler (DNS, zones, Workers, Pages, KV, R2) and cloudflared (tunnel creation, ingress config, routing). Assumes both CLIs are installed globally.
---

# Cloudflare CLI

## What this skill is for
Help Claude use `wrangler` and `cloudflared` to manage Cloudflare resources safely and consistently — DNS records, zone settings, tunnels, ingress rules, and Workers/Pages deployments.

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
1. **Auth before anything.** Verify auth state before issuing commands. Run `wrangler whoami` or `cloudflared tunnel list` to confirm. Guide through login if unauthenticated.
2. **State changes out loud.** For any mutation (create, update, delete), describe the exact change and wait for confirmation before executing.
3. **Never expose tokens.** Do not log, print, or commit Cloudflare API tokens, account IDs, or tunnel credentials.
4. **DNS changes propagate.** Warn the user that DNS changes may take time to propagate and can affect live traffic.

## Auth setup

### wrangler
```bash
# Login via browser OAuth
wrangler login

# Verify auth
wrangler whoami

# Use API token instead of OAuth (CI/CD)
export CLOUDFLARE_API_TOKEN=<token>
```

### cloudflared
```bash
# Login (opens browser, saves cert to ~/.cloudflared/)
cloudflared tunnel login

# Verify by listing tunnels
cloudflared tunnel list
```

---

## wrangler — DNS & zone management

```bash
# List zones
wrangler zones list

# List DNS records for a zone
wrangler dns list --zone-id <zone-id>

# Create a DNS record
wrangler dns create <zone-id> --type A --name subdomain.example.com --content 1.2.3.4 --ttl 1 --proxy

# Update a DNS record
wrangler dns update <zone-id> <record-id> --content 5.6.7.8

# Delete a DNS record
wrangler dns delete <zone-id> <record-id>
```

### Workers
```bash
# Deploy a worker (run from project dir with wrangler.toml)
wrangler deploy

# Tail worker logs
wrangler tail <worker-name>

# List workers
wrangler workers list
```

### Pages
```bash
# Deploy a Pages project
wrangler pages deploy <build-output-dir> --project-name <name>

# List Pages projects
wrangler pages project list
```

### KV
```bash
# List KV namespaces
wrangler kv namespace list

# Put a value
wrangler kv key put --namespace-id <id> <key> <value>

# Get a value
wrangler kv key get --namespace-id <id> <key>
```

### R2
```bash
# List R2 buckets
wrangler r2 bucket list

# Upload a file
wrangler r2 object put <bucket>/<key> --file <local-file>
```

---

## cloudflared — Tunnel management

### Create and run a tunnel
```bash
# Create a named tunnel
cloudflared tunnel create <tunnel-name>

# List tunnels
cloudflared tunnel list

# Run a tunnel (routes traffic to local service)
cloudflared tunnel run <tunnel-name>
```

### Configure ingress rules
Tunnels use a config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/<user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: app.example.com
    service: http://localhost:3000
  - hostname: api.example.com
    service: http://localhost:4000
  - service: http_status:404
```

```bash
# Validate config
cloudflared tunnel ingress validate

# Route a DNS hostname to a tunnel
cloudflared tunnel route dns <tunnel-name> <hostname>

# Delete a tunnel
cloudflared tunnel delete <tunnel-name>
```

### Run as a service (persistent tunnel)
```bash
# Install as a system service
sudo cloudflared service install

# Start/stop
sudo launchctl start com.cloudflare.cloudflared
sudo launchctl stop com.cloudflare.cloudflared
```

---

## Common workflow: expose a local service via tunnel

1. `cloudflared tunnel login`
2. `cloudflared tunnel create my-app`
3. Create `~/.cloudflared/config.yml` with ingress rules
4. `cloudflared tunnel route dns my-app app.example.com`
5. `cloudflared tunnel run my-app`

---

## Notes
- `wrangler` installed at: `$(npm root -g)/wrangler` (version 4.78.0, as of 2026-03-30)
- `cloudflared` installed at: `/opt/homebrew/bin/cloudflared` (version 2026.3.0, as of 2026-03-30)
- Install wrangler: `npm install -g wrangler`
- Install cloudflared: `brew install cloudflared`
- Cloudflare API docs: https://developers.cloudflare.com/api/
- Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
