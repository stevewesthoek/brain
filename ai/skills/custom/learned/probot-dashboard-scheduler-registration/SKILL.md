---
name: probot-dashboard-scheduler-registration
description: When a nightly scheduler job runs but doesn't appear on the ProBot dashboard, the job is missing from a hardcoded TypeScript array in ProBot source code.
---

# ProBot Dashboard Scheduler Registration

## The insight

ProBot's dashboard **does not auto-discover** nightly scheduler jobs. It reads from a hardcoded TypeScript constant: `SCHEDULER_JOB_ORDER` in `src/bot/dashboard.ts`.

When you add a job to the nightly scheduler, it runs and logs state to `~/.local/state/office-scheduler/{job-name}.last`, but the dashboard won't render it until you:
1. Edit the TypeScript source file
2. Rebuild the TypeScript → JavaScript
3. Restart the ProBot daemon

This is a common gotcha because the scheduler and ProBot are decoupled — the scheduler doesn't know about the dashboard, and the dashboard doesn't query the scheduler dynamically.

## When this applies

Symptoms:
- You added a job to `office-nightly-scheduler.sh` and it runs successfully (you see it in the logs)
- But it doesn't appear in the Scheduler tab on the ProBot dashboard (`http://localhost:7070`)
- Other jobs (STB Pipeline, n8n Backup, etc.) are visible but yours isn't

## The approach

**Diagnosis:**
1. Verify the job actually ran: `cat ~/.local/state/office-scheduler/{job-name}.last` — if this file exists, the job executed
2. Check the scheduler logs: `tail ~/Library/Logs/office-scheduler/nightly.log` — look for "starting job=" and "finished job=" lines
3. If the job ran but doesn't appear on the dashboard, it's missing from ProBot's config

**Fix logic:**
- The dashboard reads from `brain/projects/probot/src/bot/dashboard.ts` (TypeScript source, not JavaScript)
- Find the `SCHEDULER_JOB_ORDER` constant array
- Add your job to it
- Rebuild the TypeScript (generates JavaScript in `dist/`)
- Restart the ProBot daemon to load the new code

## The fix

### Step 1: Edit the dashboard source

**File:** `brain/projects/probot/src/bot/dashboard.ts` (around line 503)

Find this array:

```typescript
const SCHEDULER_JOB_ORDER: Array<{ key: string; label: string }> = [
  { key: "stb-pipeline-batch",      label: "STB Pipeline" },
  { key: "n8n-backup",              label: "n8n Backup" },
  // ... etc
];
```

Add your job with a human-readable label:

```typescript
const SCHEDULER_JOB_ORDER: Array<{ key: string; label: string }> = [
  { key: "stb-pipeline-batch",      label: "STB Pipeline" },
  { key: "n8n-backup",              label: "n8n Backup" },
  { key: "your-job-name",           label: "Your Human-Readable Label" },
  // ... rest of the jobs
];
```

The `key` must match exactly the job name you used in `run_job "your-job-name"` in the scheduler script.

### Step 2: Rebuild ProBot

```bash
cd ~/Repos/stevewesthoek/brain/projects/probot
npm run build
```

Expected output: `> tsc -p tsconfig.json` with no errors. If it errors, fix the TypeScript syntax before proceeding.

Verify the compiled JavaScript was generated:
```bash
ls -la dist/bot/dashboard.js
```

### Step 3: Restart the ProBot daemon

```bash
launchctl stop tools.prochat.probot
sleep 2
launchctl start tools.prochat.probot
sleep 3
launchctl list tools.prochat.probot
```

Verify it restarted (PID should change):
```bash
launchctl list tools.prochat.probot | grep PID
```

### Step 4: Verify on the dashboard

1. Open `http://localhost:7070`
2. Click the **Scheduler** tab
3. Your job should now appear in the table

For a newly added job that hasn't run yet, it will show status **`not-run-yet`**.

## Gotchas

1. **Rebuild failed with TypeScript errors** → The key or label may have syntax issues. Check for missing quotes or commas.

2. **Restarted ProBot but the job still doesn't appear** → You may have edited the source but ProBot didn't reload the new JavaScript. Check:
   - Did `npm run build` complete without errors?
   - Is `dist/bot/dashboard.js` newer than your edit? (`ls -la dist/bot/dashboard.js`)
   - Try stopping and starting again more forcefully:
     ```bash
     launchctl stop tools.prochat.probot
     sleep 5
     launchctl start tools.prochat.probot
     sleep 5
     ```

3. **Job key doesn't match scheduler name** → If you called `run_job "ing-bank-statement-download"` in the scheduler but added `{ key: "ing_bank_statement" }` in ProBot, they won't connect. The key must match exactly.

4. **Forgot to add to the report renderer** → Even if ProBot shows it, it won't appear in the exported Markdown report unless you also added it to `brain/tools/scripts/render-office-scheduler-report.sh`. This is a separate step (see the nightly-scheduler-new-job skill).

## Context

Repo: brain  
Discovered: 2026-04-10  
Area: `brain/projects/probot/src/bot/dashboard.ts`, daemon restart sequence

## Related

- Skill: `brain-nightly-scheduler-new-job` — for the full workflow of adding a scheduler job
- File: `brain/projects/probot/src/bot/dashboard.ts` (line ~503)
- Daemon: `launchctl start/stop tools.prochat.probot`
