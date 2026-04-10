---
name: brain-nightly-scheduler-new-job
description: Add a recurring automated job (monthly, weekly, or daily) to the brain nightly scheduler without breaking the execution chain or report rendering.
---

# Adding a New Job to brain Nightly Scheduler

## The insight

The nightly scheduler in brain has a deliberate layered architecture:
1. **LaunchAgent** (macOS) — runs the top-level script at 3 AM daily
2. **Main scheduler script** — defines job functions, handles state/locking, coordinates the execution chain
3. **Report renderer** — reads job state files and renders the dashboard status
4. **Per-job wrapper scripts** — optional lightweight shell wrappers around complex jobs

Adding a job requires changes to **all three layers**, not just the scheduler script. If you skip any layer, the job runs but won't appear on the dashboard or won't get logged/retried properly.

## When this applies

- You want to run a task periodically (1st of month, every Monday, daily, etc.)
- The task should log its state (success/failed/timeout) for monitoring
- You want it visible on the ProBot dashboard scheduler widget
- You want it integrated into the nightly scheduler's retry/locking mechanism

## The approach

**Mental model:** The nightly scheduler is a job runner with three concerns:
- **Execution** — runs the job with a timeout, captures exit code
- **State tracking** — writes success/failed/timeout to `~/.local/state/office-scheduler/{job_name}.last`
- **Reporting** — reads state files and renders the dashboard

To add a job:
1. Create a wrapper script (if needed)
2. Add a `run_job_name()` function in the scheduler
3. Call it from the main chain in the right place
4. Register it in the report renderer so it appears on the dashboard

## The fix

### Step 1: Create a wrapper script (optional but recommended)

**Location:** `brain/tools/scripts/run-{job-name}-schedule.sh`

Makes the job testable independently and keeps the scheduler uncluttered.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Your job logic here
# Exit 0 on success, non-zero on failure
# Use log output, not files — scheduler captures stdout/stderr

exit 0
```

Make it executable:
```bash
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/run-{job-name}-schedule.sh
```

### Step 2: Add a job function to the scheduler

**File:** `brain/tools/scripts/office-nightly-scheduler.sh`

Add this before the `main()` function:

```bash
run_job_name() {
  local timeout_seconds="${JOB_NAME_TIMEOUT_SECONDS:-600}"  # 10 min default
  local job_script="${JOB_NAME_SCHEDULE_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-job-name-schedule.sh}"
  local job_log="$LOG_DIR/job-name.log"
  local command

  # Optional: add date-based gate (for monthly/weekly jobs)
  local day_of_month
  day_of_month="$(TZ=Europe/Lisbon date +%-d)"
  if [[ "$day_of_month" -ne 1 ]]; then
    log "skipping job=job-name reason=not_first_of_month day=$day_of_month"
    return 0
  fi

  if [[ ! -x "$job_script" ]]; then
    log "skipping job=job-name reason=missing_script path=$job_script"
    return 0
  fi

  command=$(
    printf '%q >> %q 2>&1' \
      "$job_script" \
      "$job_log"
  )

  run_job "job-name" "$timeout_seconds" "$command" "$job_log"
}
```

### Step 3: Add the job to the execution chain

Still in `office-nightly-scheduler.sh`, add a call in the `main()` function in the right place. Insert where appropriate in this block (usually before lowest-priority jobs):

```bash
  # ... (after existing jobs)

  if [[ "$stop_chain" -eq 0 ]]; then
    if run_job_name; then
      :
    else
      local rc="$?"
      if [[ "$rc" -eq 124 ]]; then
        log "stopping chain reason=job_name_timeout"
        stop_chain=1
      else
        log "continuing chain after job_name failure exit_code=$rc"
      fi
    fi
  fi

  # ... (continue with lower-priority jobs)
```

**Decision:** Should your job stop the chain if it times out?
- **Yes** (stop_chain=1) — for critical infrastructure jobs (backups, CI/CD pipelines)
- **No** (continue) — for lower-priority content jobs (transcription, cleanup, ING downloads)

### Step 4: Register in the report renderer

**File:** `brain/tools/scripts/render-office-scheduler-report.sh`

Find the `SCHEDULER_JOB_ORDER` array and add your job in the right position:

```bash
$(render_job_row "your-job-name")
```

### Step 5: Register in ProBot dashboard

**File:** `brain/projects/probot/src/bot/dashboard.ts`

Find the `SCHEDULER_JOB_ORDER` const array (around line 503) and add your job:

```typescript
const SCHEDULER_JOB_ORDER: Array<{ key: string; label: string }> = [
  // ... existing jobs ...
  { key: "your-job-name", label: "Your Job Label" },
  // ... more jobs ...
];
```

Then rebuild and restart ProBot:
```bash
cd ~/Repos/stevewesthoek/brain/projects/probot
npm run build
launchctl stop tools.prochat.probot
launchctl start tools.prochat.probot
```

## Gotchas

1. **Forgot to register in the report renderer** → Job runs but doesn't appear in logs
2. **Forgot to register in ProBot** → Job runs but doesn't appear on dashboard
3. **Used wrong timeout variable name** → Timeout defaults to 600s even if you set `JOB_TIMEOUT_SECONDS` (it's `JOB_NAME_TIMEOUT_SECONDS`)
4. **Forgot `chmod +x`** on the wrapper script → Scheduler says "missing_script"
5. **Off-by-one in date check** → Use `date +%-d` (not `+%d`) to get unpadded day number for `[[ "$day_of_month" -ne 1 ]]`
6. **ProBot still doesn't update after rebuild** → You must `npm run build` (TypeScript → JavaScript), not just restart; rebuild outputs to `dist/`

## Context

Repo: brain  
Discovered: 2026-04-10  
Area: `brain/tools/scripts/office-nightly-scheduler.sh`, `brain/projects/probot/src/bot/dashboard.ts`

## Example

See: `brain/tools/scripts/run-ing-bank-statement-download.sh` and the corresponding `run_ing_bank_statement_download()` function in the scheduler (added 2026-04-10). Runs on the 1st of each month, never stops the chain.
