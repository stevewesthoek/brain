# Arq CLI Runbook

CLI reference for Arq backup control and monitoring on macOS.

## Overview

**App:** Arq 7 (installed at `/Applications/Arq.app`)  
**CLI binary:** `arqc` at `/Applications/Arq.app/Contents/Resources/arqc`  
**Local symlink:** `~/.local/bin/arq` → `/Applications/Arq.app/Contents/Resources/arqc`  
**Version (this Mac):** 7.39.1  
**App identity:** `com.haystacksoftware.Arq` (Haystack Software LLC)

---

## What Arq CLI Does (and Does Not Do)

### ✅ What the CLI provides

- **License management** (activate, refresh, deactivate, set app password)
- **Backup plan inventory** (list all configured backup plans)
- **Backup control** (start, stop, pause, resume individual plans)
- **Activity monitoring** (fetch latest backup logs, activity JSON)

### ❌ What the CLI does NOT provide

- **File browsing** — cannot list or search files within backups
- **Restore workflow** — no direct restore or extract command
- **Backup discovery** — cannot browse or list backup destinations (Google Drive, S3, etc.)
- **Public API** — `arqc` is the only CLI interface; there is no documented REST API for Arq

**Reality:** `arqc` is for **backup operations and monitoring**, not recovery. File restoration requires the Arq GUI or direct access to backup storage (Google Drive, S3, etc.).

---

## Installation & Setup

### Prerequisites

- macOS 10.13 or later
- Arq 7.x installed at `/Applications/Arq.app`
- Arq license activated (in the GUI or via `arq activateLicense`)
- App password set (via GUI Preferences or `arq setAppPassword`)

### Symlink Setup

The symlink is already created at `~/.local/bin/arq`. Verify:

```bash
ls -la ~/.local/bin/arq
# Output: /Users/Office/.local/bin/arq -> /Applications/Arq.app/Contents/Resources/arqc
```

Manual creation (if needed):

```bash
ln -sf /Applications/Arq.app/Contents/Resources/arqc ~/.local/bin/arq
```

### Verify Installation

```bash
arq
# Output: usage: arqc <command> [options]
```

If you see `no command given`, the symlink is working. All `arqc` commands require explicit arguments.

---

## Quick Start

### List backup plans

```bash
arq listBackupPlans
```

Output format:
```
UUID=<plan-uuid>	name="<plan-name>"	storage location="<destination>"
...
total backup plans: N
```

Example output (from this Mac):
```
UUID=2C9CA29F-7422-45D4-92A9-3C8E383868C0	name="Back up to Google Drive"	storage location="Google Drive"
total backup plans: 1
```

Use the UUID from *your* output, not this example.

### Start a backup plan

```bash
arq startBackupPlan <plan-uuid>
```

### Stop a running backup

```bash
arq stopBackupPlan <plan-uuid>
```

### Get latest backup activity

```bash
arq latestBackupActivityLog <plan-uuid>
```

For machine-readable output:

```bash
arq latestBackupActivityJSON <plan-uuid> | jq
```

---

## Core Commands

### License Management

```bash
# Activate license with code
arq activateLicense <license-code>

# Refresh license (for time-limited or trial licenses)
arq refreshLicense

# Deactivate license (useful for moving to another machine)
arq deactivateLicense

# Set app password (used for CLI auth)
arq setAppPassword
# Prompts interactively for password
```

### Backup Plan Operations

```bash
# List all backup plans with UUID, name, and destination
arq listBackupPlans

# Start a backup plan (runs until completion or error)
arq startBackupPlan <plan-uuid>

# Stop an in-progress backup
arq stopBackupPlan <plan-uuid>

# Pause all backups for N minutes
arq pauseBackups <minutes>

# Resume all backups after pause
arq resumeBackups
```

### Activity & Monitoring

```bash
# Get latest activity log for a plan (human-readable text)
arq latestBackupActivityLog <plan-uuid>

# Get latest activity as JSON (for scripts, parsing)
arq latestBackupActivityJSON <plan-uuid>

# Parse JSON output
arq latestBackupActivityJSON <plan-uuid> | jq '.[] | .timestamp, .message'
```

---

## Authentication & App Password

### Setting Up App Password

The CLI requires an app password for authentication. Set it once:

```bash
arq setAppPassword
# Interactive prompt: Enter desired password (not echoed)
# Confirm password
```

This password is stored locally in Arq's keychain and not synced. Each machine needs its own app password.

### If Password Is Missing

If you see warnings like:
```
Warning: no app password configured in Arq. Run 'arqc setAppPassword' or pick "Preferences" from Arq's menu to set an app password.
```

The CLI will still work for read operations, but some commands may be restricted. Set the password to enable all features:

```bash
arq setAppPassword
```

---

## Common Workflows

### Inventory: List all backup plans and their status

```bash
#!/bin/bash
echo "=== Arq Backup Plans ==="
arq listBackupPlans
echo ""
echo "To check activity for a plan, run:"
echo "arq latestBackupActivityLog <your-plan-uuid>"
```

### Monitor: Check if a backup completed recently

```bash
#!/bin/bash
# Find your plan UUID with: arq listBackupPlans
PLAN_UUID="<your-plan-uuid>"
echo "Latest backup activity for plan $PLAN_UUID:"
arq latestBackupActivityLog "$PLAN_UUID" | tail -20
```

### Automation: Daily backup trigger (cron or LaunchAgent)

```bash
#!/bin/bash
# Find your plan UUID with: arq listBackupPlans
# Run backup plan at scheduled time
PLAN_UUID="<your-plan-uuid>"
arq startBackupPlan "$PLAN_UUID"
# Wait for completion
sleep 300  # Adjust based on backup size
arq latestBackupActivityLog "$PLAN_UUID" | tail -5
```

### Pause backups during intensive tasks

```bash
# Pause all backups for 60 minutes (template - not tested end-to-end)
arq pauseBackups 60

# Do your intensive work here
# ...

# Resume backups
arq resumeBackups
```

---

## Backup Plan UUIDs

Get the UUID for a plan via:

```bash
arq listBackupPlans | grep "name="
```

Output format (example):
```
UUID=<your-plan-uuid>	name="<your-plan-name>"	storage location="<destination>"
```

Use the UUID value from your output in commands like `arq startBackupPlan <your-plan-uuid>`.

---

## Restore & Recovery (Not CLI-Based)

⚠️ **Important:** The Arq CLI does not support file restore or browsing.

### To restore files from an Arq backup:

1. **Option 1: Arq GUI** (recommended)
   - Open Arq.app
   - Select backup plan
   - Browse files in the backup
   - Click "Restore" for selected files

2. **Option 2: Google Drive direct access** (if backup destination is Google Drive)
   - Open https://drive.google.com
   - Navigate to backup folder
   - Manually download backup archive
   - Extract locally or mount as needed

3. **Option 3: Cloud provider tools** (if backup destination is S3, Azure, etc.)
   - Use `aws s3` (AWS), `az storage` (Azure), etc. to browse and download backup archives
   - Extract locally

### Verification status:
- ✅ CLI backup control verified on this Mac
- ✅ App password configuration verified
- ❌ CLI restore workflow NOT available (use GUI instead)
- ❌ CLI file browsing NOT available (use GUI or cloud provider tools)

---

## Troubleshooting

| Issue | Symptom | Fix |
|-------|---------|-----|
| Arq daemon not running | Commands hang or fail | Open Arq.app or restart it: `killall Arq; open /Applications/Arq.app` |
| App password not set | "no app password configured" warning | Run `arq setAppPassword` |
| License expired | License-related errors | Run `arq refreshLicense` or `arq activateLicense` |
| Plan UUID not found | "Plan not found" or invalid UUID | Verify UUID via `arq listBackupPlans` |
| Backup stuck | Backup plan not responding | Stop it: `arq stopBackupPlan <uuid>`, then restart: `arq startBackupPlan <uuid>` |

---

## Credentials & Security

**Credential type:** App password (local only)  
**Storage location:** Arq's system keychain (`~/Library/Keychains/`)  
**Expiration:** None (persistent until changed)  
**Rotation:** Re-run `arq setAppPassword` to change  
**Multi-machine:** Each machine needs its own app password; not synced

**Backup credentials (to destination):**
- For Google Drive: OAuth token managed by Arq.app GUI (not exposed via CLI)
- For S3, Azure, etc.: Configured in GUI; managed by Arq.app
- CLI does NOT expose or manage destination credentials

---

## Related

- **Skill:** `/arq` — AI-assisted Arq CLI automation and scripting
- **App:** Arq.app — Full GUI for browsing, restoring, and managing backups
- **Official docs:** https://www.arqbackup.com/help/index.html
- **Google Drive:** https://drive.google.com (direct access to backup files if stored there)

---

## Binary & Version Details

**Verified on this Mac (2026-04-18):**
- Binary path: `/Applications/Arq.app/Contents/Resources/arqc`
- App version: 7.39.1
- Architecture: Universal (x86_64 + arm64)
- App identifier: `com.haystacksoftware.Arq`
- Copyright: Haystack Software LLC

Command verified:
```bash
arq listBackupPlans
# Output: Shows 1 backup plan ("Back up to Google Drive")
# Status: ✅ CLI working
```
