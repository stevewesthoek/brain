# n8n Self-Hosted Access Setup and Configuration

**⚠️ IMPORTANT: This is n8n SELF-HOSTED, NOT n8n Cloud**

**n8n Instance:** Self-hosted on Dokploy  
**URL:** https://n8n.prochat.tools  
**Type:** Self-hosted deployment (docker container on Dokploy infrastructure)

---

## Quick Start

Both the n8n CLI and n8n API are now available and configured for the self-hosted instance.

### CLI Access
```bash
n8n --version      # Verify CLI is installed and in PATH
n8n help           # Show CLI commands
```

**Installed at:** `/opt/homebrew/bin/n8n`  
**Version:** 2.22.5+

### API Access
```bash
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh help
```

**Wrapper location:** `/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh`  
**Config location:** `~/.config/n8n/.env`

---

## Configuration

### 1. API Configuration (Required for `n8n-api.sh`)

**Self-hosted instance URL:** https://n8n.prochat.tools (NOT n8n.io/cloud)

Config file: `~/.config/n8n/.env`

```bash
# n8n Self-Hosted at https://n8n.prochat.tools
N8N_API_URL=https://n8n.prochat.tools/api/v1
N8N_API_KEY=<SET_IN_LOCAL_SECRET_STORE>
N8N_WEBHOOK_URL=https://n8n.prochat.tools/webhook
```

Credentials must be supplied from installation-local secret storage and injected
only at runtime. Never commit an API key, token, authorization header, or populated
secret-store file to this repository.

**Credential remediation required:** a non-placeholder n8n API key was previously
committed in this tracked runbook. Treat that key as compromised and rotate it
before any further use. Removing the value from the current tree does not remove
it from Git history; history remediation requires a separate, explicitly approved
procedure and coordinated force-push.

**To update the API key:**
1. Log in to the self-hosted n8n instance at `https://n8n.prochat.tools`
2. Go to **Settings** → **API**
3. Generate or copy the API key
4. Store the new key only in the installation-local secret store
5. Verify presence without printing it: `test -n "${N8N_API_KEY:-}"`

---

## Usage

### CLI Commands (Direct n8n commands)

```bash
# List workflows
n8n workflow:list

# Export workflow
n8n workflow:export --output=workflow.json

# Import workflow
n8n workflow:import --input=workflow.json

# Manage credentials (inside n8n container only)
n8n credentials:list

# See all available commands
n8n --help
```

### API Wrapper Commands

```bash
# List all workflows
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh list-workflows

# Get workflow details
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh get-workflow <workflow-id>

# Update workflow
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh update-workflow <id> workflow.json

# List credentials (note: returns limited info on this instance)
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh credential-schema facebookGraphApi

# Create credential
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh create-credential credential.json

# Update credential
/Users/Office/Repos/stevewesthoek/brain/tools/n8n-api.sh update-credential <id> credential.json
```

---

## Credential Management

### Server-Side Approach (Most Reliable)

For updating credentials directly inside the n8n container:

```bash
# SSH to Dokploy host
ssh dokploy

# Find the n8n container
docker ps | grep n8n

# Get n8n-encrypted credentials (for backup)
docker exec <container-id> n8n export:credentials --output=/tmp/credentials.json

# Import credentials
docker exec -i <container-id> n8n import:credentials --input=file.json
```

### UI Approach

1. Go to `https://n8n.prochat.tools`
2. Click **Credentials** (bottom left)
3. Find the credential you want to update
4. Click edit (pencil icon)
5. Update the fields
6. Click **Save**

---

## Testing Access

### Test CLI
```bash
n8n --version
# Expected: 2.22.5 or higher
```

### Test API
```bash
source ~/.config/n8n/.env
curl -s -X GET \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "${N8N_API_URL}/credentials/schema/facebookGraphApi" | jq .
```

**Expected output:** JSON schema for Facebook Graph API credentials

---

## Troubleshooting

### CLI not found
```bash
which n8n
# If empty, run:
npm install -g n8n@latest
```

### API returns 405 Method Not Allowed
- This is expected for certain endpoints on the public API
- Use the server-side Docker approach instead for credential management

### Credential not updating in UI
- Changes in the n8n UI are stored in the database
- Restart n8n if changes don't persist:
  ```bash
  ssh dokploy
  docker restart <n8n-container-id>
  ```

---

## Related Documentation

- Backup/Restore: `~/Repos/stevewesthoek/brain/operations/runbooks/n8n.md`
- API Reference: https://docs.n8n.io/api/
- CLI Reference: https://docs.n8n.io/cli/

---

**Last Updated:** 2026-07-14
**CLI Version:** 2.22.5
**API Config:** installation-local secret storage
