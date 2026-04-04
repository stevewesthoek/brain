# n8n

Runbook for the self-hosted n8n instance at `https://n8n.prochat.tools`.

## Live control path

Default automation path:
- Public API wrapper: `~/.local/bin/n8n-api`
- Local auth file: `~/.config/n8n/.env`

Server-side recovery path:
- SSH target: `dokploy`
- Live container: auto-detected by `tools/scripts/backup-n8n.sh`
- Official CLI inside container: `n8n`

## What is backed up

The local backup set includes:
- `credentials.decrypted.json`
- `credentials.encrypted.json`
- `workflows.json`
- `metadata.json`

Location:
```bash
brain/operations/automations/n8n/n8n_backup/
```

This folder is gitignored and intended to stay only on the local filesystem.

Latest backup symlink:
```bash
brain/operations/automations/n8n/n8n_backup/latest
```

## Backup commands

Manual backup:
```bash
cd ~/Repos/stevewesthoek/brain
tools/scripts/backup-n8n.sh
```

Scheduled backup guard:
```bash
cd ~/Repos/stevewesthoek/brain
tools/scripts/run-n8n-backup-schedule.sh
```

Forced run:
```bash
FORCE_RUN=1 tools/scripts/run-n8n-backup-schedule.sh
```

## Schedule

Nightly scheduler LaunchAgent:
```bash
~/Library/LaunchAgents/com.office.nightly-scheduler.plist
```

Repo source:
```bash
brain/operations/system-configs/launchagents/com.office.nightly-scheduler.plist
```

Behavior:
- The Office nightly scheduler starts at `03:00` local Mac time
- `RunAtLoad` also triggers the nightly scheduler after login / reboot
- The nightly scheduler checks `Europe/Lisbon` time and runs at most once per Lisbon day
- The `n8n` backup runs inside that ordered nightly chain after the STB batch lane
- If the machine was off at `03:00` and later boots or logs in after `03:00`, the nightly scheduler catches up automatically

This keeps the job light while still catching up after reboot or downtime.

## Restore procedure

### 1. Recreate the n8n server
- Recreate the Dokploy compose app or replacement self-hosted n8n instance
- Ensure you know the target n8n version and runtime

### 2. Restore the encryption key if possible
- If reusing the same `N8N_ENCRYPTION_KEY`, encrypted credentials may still work directly
- If the key changed, use the `credentials.decrypted.json` backup for migration

### 3. Restore workflows
From the running container:
```bash
docker exec -i -u node <n8n-container-name> n8n import:workflow --input=file.json
```

Or for split backups:
```bash
docker exec -i -u node <n8n-container-name> n8n import:workflow --separate --input=/path/to/dir/
```

### 4. Restore credentials
If using the same encryption key:
```bash
docker exec -i -u node <n8n-container-name> n8n import:credentials --input=file.json
```

If using a different encryption key:
- use the decrypted credential backup
- import it into the new instance so n8n re-encrypts it with the new key

Command:
```bash
docker exec -i -u node <n8n-container-name> n8n import:credentials --input=file.json
```

### 5. Validate
- Confirm credentials exist in n8n
- Confirm workflows imported
- Reactivate required workflows
- Test trigger and webhook flows

## Logs and state

Nightly scheduler log:
```bash
~/Library/Logs/office-scheduler/nightly.log
```

n8n backup job log inside the nightly scheduler lane:
```bash
~/Library/Logs/office-scheduler/n8n-backup.log
```

Last successful Lisbon-day backup marker:
```bash
~/.local/state/n8n-backup/last_successful_lisbon_date
```

## Important notes

- The Public API does not currently expose full credential listing on this live build/key, so credential recovery uses the server-side `n8n export:*` path.
- Existing OAuth credentials already stored in n8n are included in the backup.
- New OAuth credentials added later will be captured automatically by the next scheduled backup.
- This is installed as part of a user `LaunchAgent` nightly chain, so it runs when the `Office` user session is active. After reboot, it resumes automatically once that user session starts.
