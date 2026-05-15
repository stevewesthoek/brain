# Warp Environment - Copy & Paste Configuration

## Fill In These Exact Values

### 1. Name Field
```
brain-health-audit
```

### 2. Description Field
```
Monthly infrastructure health check for brain repo - verifies skill sync, symlinks, documentation, git status, and reports issues
```

### 3. Repo(s) Field
```
stevewesthoek/brain
```

### 4. Docker image reference Field
```
node:24-alpine
```

### 5. Setup command(s) Field
```bash
apk add --no-cache python3 bash git curl mailx && cd /workspace && npm install
```

**Note:** `mailx` is included to enable email delivery of audit results to info@prochat.tools

---

## What This Does

| Field | Purpose |
|-------|---------|
| **Name** | Identifies your environment in Warp |
| **Description** | Explains what this environment is for |
| **Repo** | Tells Warp to clone your brain repo |
| **Docker image** | Provides Node.js, npm, bash, git in a lightweight container |
| **Setup command** | Installs Python and any dependencies |

---

## After Creating the Environment

### Monthly Usage

In Warp Agent Mode, ask it to:

```
Run the health audit in the brain-health-audit environment. 
Execute: bash operations/scripts/warp-health-audit.sh
```

**That's it!** The agent will:
- ✓ Set up the environment
- ✓ Run the comprehensive health checks
- ✓ Report any issues found
- ✓ Give you a summary

**Uses:** 2-4 of your 60 free messages/month (hard cap after 2-month promo)  
**Time:** ~30 seconds  
**Cost:** ~7% of monthly budget (leaves 93% for other work)

---

## No Other Setup Needed

Everything else is pre-configured:
- ✓ Health audit script is ready (`operations/scripts/warp-health-audit.sh`)
- ✓ Documentation is ready (`operations/runbooks/warp-agent-setup.md`)
- ✓ You have CLI tools available in the container
- ✓ Git repo will be cloned automatically

Just fill in the 5 fields above and click Create!

---

## Questions?

See the full documentation:
`operations/runbooks/warp-agent-setup.md`
