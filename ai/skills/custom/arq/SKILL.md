---
name: arq
description: Arq backup CLI — control and monitor backup plans, check activity logs, manage app password and license; restore requires Arq GUI or direct storage access
---

# Arq CLI Skill

## What this skill is for

Help Claude and Codex use Arq CLI (`arqc`) for:

- **Backup plan inventory** — list all configured backup plans and their destinations
- **Backup control** — start, stop, pause, or resume backups programmatically
- **Activity monitoring** — fetch and parse latest backup logs and status
- **Automation** — integrate backup operations into scripts, cron jobs, or n8n workflows
- **License & auth management** — activate, refresh, deactivate licenses; manage app passwords

This skill is NOT for file restore. That requires Arq GUI or direct access to backup storage.

## Use this skill when

- You want to list or start a backup via CLI
- You want to fetch backup activity logs (human or JSON)
- You want to pause backups during intensive tasks
- You need to automate backup operations in a script or workflow
- You want to check if a backup completed successfully
- You need to manage Arq license or app password

## Do not use this skill for

- Restoring files — the CLI does not support restore (use Arq GUI instead)
- Browsing backup contents — the CLI cannot list files in backups (use Arq GUI or cloud storage access)
- Discovering backup destinations — the CLI only lists plans, not what's inside them
- Public API access — Arq does not expose a documented API beyond the CLI

## Safety & honest limits

1. **CLI is for control, not recovery.** The `arqc` binary provides backup start/stop/monitor, but not file access.
2. **App password required.** CLI commands work best after setting an app password via `arq setAppPassword`.
3. **Arq daemon must be running.** The CLI communicates with the local Arq.app process; if Arq is closed, commands may fail or hang.
4. **Destinations are opaque to CLI.** You can list backup plan UUIDs and names, but the CLI does not let you browse or restore from those plans.
5. **Restore requires alternative paths** — either Arq GUI, direct cloud storage access (e.g., Google Drive, AWS S3), or third-party backup utilities.

## Stable local entrypoint

Use this command path for both Claude and Codex:

```bash
~/.local/bin/arq
```

This symlinks directly to the bundled `arqc` binary:

```bash
/Applications/Arq.app/Contents/Resources/arqc
```

Verification:

```bash
which arq
# Output: /Users/Office/.local/bin/arq

arq
# Output: usage: arqc <command> [options]
```

## Installation & Prerequisites

- macOS 10.13 or later
- Arq 7.x installed at `/Applications/Arq.app`
- Arq license activated (via GUI or `arq activateLicense`)
- App password set (via GUI Preferences or `arq setAppPassword`)
- Arq.app process running (or launched on demand)

The symlink at `~/.local/bin/arq` is already configured on this machine.

## Command Discovery

List all available commands:

```bash
arq
# No arguments prints usage and all available commands
```

Available commands:

```
arqc acceptLicenseAgreement
arqc activateLicense <licenseCode>
arqc refreshLicense
arqc deactivateLicense
arqc setAppPassword
arqc listBackupPlans
arqc latestBackupActivityLog <backupPlanUUID>
arqc latestBackupActivityJSON <backupPlanUUID>
arqc startBackupPlan <backupPlanUUID>
arqc stopBackupPlan <backupPlanUUID>
arqc pauseBackups <minutes>
arqc resumeBackups
```

**Note:** These commands were discovered from the CLI usage output. Only `arq listBackupPlans` has been individually verified to work on this Mac. The other commands are inferred from the usage text but not individually tested.

## Common Patterns

### List backup plans

```bash
arq listBackupPlans
```

Output format:
```
UUID=<uuid>	name="<name>"	storage location="<destination>"
...
total backup plans: N
```

Parse to find a specific plan:

```bash
# Find your plan UUID with: arq listBackupPlans
arq listBackupPlans | grep "name=\"<your-plan-name>\""
```

### Start a backup plan

```bash
# Find your plan UUID with: arq listBackupPlans
PLAN_UUID="<your-plan-uuid>"
arq startBackupPlan "$PLAN_UUID"
```

Wait for completion (template):

```bash
PLAN_UUID="<your-plan-uuid>"
arq startBackupPlan "$PLAN_UUID" && sleep 300 && arq latestBackupActivityLog "$PLAN_UUID" | tail -10
```

### Monitor backup activity (JSON)

```bash
# Find your plan UUID with: arq listBackupPlans
PLAN_UUID="<your-plan-uuid>"
arq latestBackupActivityJSON "$PLAN_UUID" | jq
```

Extract specific fields (template):

```bash
PLAN_UUID="<your-plan-uuid>"
arq latestBackupActivityJSON "$PLAN_UUID" | jq '.[] | {timestamp: .timestamp, status: .status, filesAdded: .filesAdded}'
```

### Pause & resume all backups

```bash
# Pause for 60 minutes (template - not end-to-end tested)
arq pauseBackups 60

# Do intensive work...

# Resume
arq resumeBackups
```

### Set app password (interactive)

```bash
arq setAppPassword
# Prompts: Enter app password (not echoed)
# Prompts: Confirm password
```

## Credential Management

**App password:** Stored in local keychain (`~/Library/Keychains/`)  
**Storage credentials:** Managed by Arq GUI (Google Drive OAuth, S3 keys, etc.); not exposed via CLI  
**Expiration:** App password does not expire unless manually changed  
**Rotation:** Re-run `arq setAppPassword` to change

⚠️ Do not commit or expose Arq credentials in code or documentation.

## Integration Patterns

### n8n Workflow (backup monitoring)

```
Webhook trigger → Run CLI command: arq latestBackupActivityJSON <uuid> → Parse JSON → Send alert if status != "success"
```

### Automation: Schedule daily backup

```bash
#!/bin/bash
# Find your plan UUID with: arq listBackupPlans
# crontab: 0 2 * * * /path/to/this-script.sh
PLAN_UUID="<your-plan-uuid>"
arq startBackupPlan "$PLAN_UUID"
```

### Automation: Pause during intensive task

```bash
#!/bin/bash
arq pauseBackups 120  # Pause for 2 hours
# Run intensive operation
/path/to/intensive/task.sh
arq resumeBackups
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| Command hangs | Arq.app not running | `open /Applications/Arq.app` or `killall Arq; open /Applications/Arq.app` |
| "no app password configured" (warning) | App password not set | `arq setAppPassword` |
| "Plan not found" | Invalid or missing UUID | Verify via `arq listBackupPlans` |
| License error | License expired or invalid | `arq refreshLicense` or `arq activateLicense` |
| Commands exit with no output | Arq daemon crashed | Restart: `killall Arq; open /Applications/Arq.app` |

## Deep Links

- **Arq Help:** https://www.arqbackup.com/help/index.html
- **Arq Home:** https://www.arqbackup.com/
- **Arq Runbook (brain):** `brain/operations/runbooks/arq-cli.md`

## Verified Status on This Mac

**Verified (tested and confirmed):**
- ✅ CLI binary exists at `/Applications/Arq.app/Contents/Resources/arqc`
- ✅ App version: 7.39.1 (from Info.plist CFBundleShortVersionString)
- ✅ Architecture: Universal binary (x86_64 + arm64, verified via `file` command)
- ✅ Symlink created: `~/.local/bin/arq` → binary path
- ✅ Command verified: `arq listBackupPlans` works and returns backup plans

**Discovered from usage output (not individually tested):**
- License management: activateLicense, refreshLicense, deactivateLicense, setAppPassword, acceptLicenseAgreement
- Backup plan control: startBackupPlan, stopBackupPlan, pauseBackups, resumeBackups
- Activity logging: latestBackupActivityLog, latestBackupActivityJSON

**Not available via CLI:**
- ❌ Public API: No documented REST or programmatic API
- ❌ CLI restore: No file restore or file-browse commands available
- ❌ CLI backup browsing: Cannot list or search files within backups

---

## Decision Rationale

Arq was discovered on this Mac as a native macOS backup client. The bundled CLI (`arqc`) provides backup automation and monitoring capabilities suitable for scripts and CI workflows. However, file restore is not exposed via CLI and requires either the Arq GUI or direct access to backup storage (Google Drive, S3, etc.). This skill documents the CLI's actual scope without overstating its capabilities.
