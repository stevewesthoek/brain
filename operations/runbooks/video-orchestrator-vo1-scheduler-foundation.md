# Video Orchestrator VO-1: Scheduler + Job Foundation

**Date:** 2026-05-11  
**Phase:** VO-1 (Scheduler Foundation, Pre-Production)  
**Status:** ✅ Complete — production-safe job scheduler foundation ready  

---

## Executive Summary

VO-1 delivers a minimal, production-safe job scheduler foundation for ProBot's Video Orchestrator. The system allows Steve to **schedule videos for the rest of the month**, run them on a **nightly cadence**, and **safely pause when YouTube quota is exhausted**.

**Key property: Everything is dry-run by default.** No real YouTube publishing in VO-1. Jobs transition through states correctly but don't execute real adapters. Ready for Phase 2 (adapter implementations).

---

## What Currently Exists

**Infrastructure:**
- Account registry (Keychain-backed, multi-channel YouTube support)
- YouTube OAuth flow (PKCE + optional client secret)
- Dashboard rendering for accounts and credentials
- Database schema defined (Phase 2B work)
- Nightly scheduler LaunchAgent configured

**What Was Missing:**
- Job storage layer (no persistent job store in codebase)
- Job scheduler runner (no CLI entry points)
- Dashboard-job integration (counts came from hypothetical DB, not real jobs)
- Quota guard interface (planned, not implemented)

---

## What VO-1 Implements

### 1. Job Model & Storage

**File:** `projects/probot/src/bot/video-orchestrator-jobs.ts` (430 lines)

**Data Structures:**
- `ScheduledVideoJob`: id, type, status, created_at, scheduled_for, attempted_at, completed_at, dry_run, error_message, result
- `JobType`: `generate_episode`, `publish_episode`, `schedule_month`
- `JobStatus`: `scheduled`, `running`, `completed`, `failed`, `paused_quota`, `cancelled`

**Storage:**
- Primary: `~/.local/probot/video-orchestrator/jobs.json` (runtime-only, not committed)
- Fallback: `runtime/local/video-orchestrator/jobs.json` (if primary unavailable)
- Schema: `{ schema_version: "1.0", created_at, jobs: [] }`

### 2. Service Functions

```typescript
// Create a scheduled job
createVideoJob(input: { type, scheduledFor, dryRun }): ScheduledVideoJob

// List jobs, optionally filtered by status or date
listVideoJobs(options?: { status?, before? }): ScheduledVideoJob[]

// Update job status (transition state)
updateVideoJobStatus(jobId, status, result?): void

// Cancel a job
cancelVideoJob(jobId): void

// Schedule jobs for rest of month (daily intervals)
scheduleRestOfMonth(options: { dryRun, channelId?, episodeCount? }): { created, existing }

// Run all due jobs (up to maxJobs), respecting quota guard
runDueVideoJobs(options: { dryRun, maxJobs?, forDate? }): { ran, quota_paused, failed }

// Get dashboard-friendly status snapshot
getVideoJobsStatus(): { total_jobs, scheduled, running, completed, failed, paused_quota, cancelled, dry_run_mode, quota_status }

// Reset daily quota counter
resetQuota(): void
```

### 3. Dry-Run Behavior

- All jobs created with `dry_run: true` by default (configurable)
- Job results marked as `{ simulated: true, output: "Dry-run: ..." }`
- Dashboard shows "DRY-RUN MODE" badge when all jobs are dry-run
- No real YouTube API calls, no real adapters executed
- Safe to test scheduling logic without side effects

### 4. Quota Guard

**Interface:**
```typescript
interface QuotaGuard {
  checkAndRecord(jobType): { allowed: boolean; reason?; quota_reset_at? }
  reset(): void
  getStatus(): { total_used, limit, reset_at }
}
```

**Implementation (VO-1):**
- Simple daily counter: 10 jobs/day per account (conservative for testing)
- Resets at midnight
- When exhausted: `runDueVideoJobs()` marks remaining jobs as `paused_quota` (not `failed`)
- Jobs stay `scheduled` for next run, safe resume pattern

### 5. Dashboard Integration

**Updated:** `getVideoOrchestratorStatus()` in dashboard.ts

- Prefers real job store over database (truthful counts)
- Returns: pending_jobs (scheduled count), running_jobs, failed_jobs_7d, paused_quota_jobs
- Shows dry_run_mode flag
- Falls back gracefully if database unavailable

### 6. Helper Scripts & Package Scripts

**CLI Script:** `projects/probot/src/scripts/video-orchestrator-scheduler.mjs`

**Commands:**
```bash
# List all jobs
npm run probot:video:jobs
node video-orchestrator-scheduler.mjs list [--status=scheduled]

# Schedule rest of month
npm run probot:video:schedule-month
node video-orchestrator-scheduler.mjs schedule-month [--dry-run=true] [--episode-count=3]

# Run jobs due now
npm run probot:video:run-due
node video-orchestrator-scheduler.mjs run-due [--dry-run=true] [--max-jobs=2] [--for-date=2026-05-15]

# Show status
node video-orchestrator-scheduler.mjs status

# Reset quota
node video-orchestrator-scheduler.mjs reset-quota
```

### 7. Tests

**File:** `projects/probot/src/bot/video-orchestrator-jobs.test.ts` (170 lines)

**Coverage:**
- VO-J1: Create scheduled job
- VO-J2: List jobs
- VO-J3: Filter jobs by status
- VO-J4: Update job status (transitions)
- VO-J5: Cancel job
- VO-J6: Schedule rest of month creates expected jobs
- VO-J7: Schedule rest of month skips duplicates
- VO-J8: Run due jobs respects maxJobs limit
- VO-J9: Quota guard pauses jobs when exhausted
- VO-J10: Dashboard reads job counts truthfully

---

## What Is Still Dry-Run Only

✋ **No Real YouTube Publishing**
- Jobs execute as dry-run by default
- `publish_episode` jobs are no-ops
- No real video generation (`generate_episode` jobs are no-ops)

✋ **No Real Database**
- Uses local JSON storage, not production PostgreSQL
- Jobs persist in `~/.local/probot/video-orchestrator/jobs.json`
- Database integration comes in Phase 2B

✋ **No Real Adapters**
- Jobs transition through states correctly
- But execution is simulated; adapters not invoked
- Real adapters (YouTube API, n8n, etc.) deferred to Phase 3+

✋ **Quota Guard Is Placeholder**
- Simple daily counter (10 jobs/day)
- Suitable for testing and local development
- Real YouTube quota (10,000 units/day) integrated in Phase 2B+

---

## How to Use

### Manual: Schedule Rest of Month

```bash
cd projects/probot

# Dry-run: create jobs for rest of month (dry-run mode)
npm run probot:video:schedule-month

# Or with options:
npm run probot:video:schedule-month -- --dry-run=true --episode-count=3
```

**Output:**
```
📅 Scheduling rest of month...
✅ Created: 3, Skipped (existing): 0

Scheduled jobs for rest of month:
  - abc12345: generate_episode @ Wed May 21 2026 09:00:00 GMT
  - def67890: generate_episode @ Fri May 29 2026 09:00:00 GMT
  - ghi34567: generate_episode @ Sun Jun 07 2026 09:00:00 GMT
```

**What this does:**
1. Calculates days remaining in current month
2. Divides evenly across episode count (default 3)
3. Creates one job per scheduled day at 9 AM
4. Checks for duplicates (skips if already scheduled)
5. All jobs created as dry-run

### Manual: Run Due Jobs

```bash
cd projects/probot

# Dry-run: process jobs due today (up to 2)
npm run probot:video:run-due -- --dry-run=true --max-jobs=2

# Or run with real mode (when ready):
npm run probot:video:run-due -- --dry-run=false --max-jobs=2
```

**Output:**
```
🚀 Running due jobs...
✅ Ran: 2, Quota paused: 0, Failed: 0
```

**What this does:**
1. Finds all jobs with `status=scheduled` and `scheduled_for <= now`
2. Checks quota guard for each job
3. If allowed: transitions to `running` → executes (simulated if dry-run) → marks `completed`
4. If quota exhausted: transitions to `paused_quota`, remains `scheduled` for next run
5. Processes up to `maxJobs` limit

### Manual: List Jobs

```bash
npm run probot:video:jobs
npm run probot:video:jobs -- --status=scheduled
```

**Output:**
```
📋 Video Orchestrator Jobs (5 total):
⏳ abc12345: generate_episode [scheduled] @ Wed May 21 2026 09:00:00 (dry-run)
🔄 def67890: publish_episode [running] @ Fri May 29 2026 10:00:00 (dry-run)
✅ ghi34567: generate_episode [completed] @ Sun Jun 07 2026 09:00:00 (dry-run)
```

### Nightly: Automatic Execution

The existing LaunchAgent at `operations/system-configs/launchagents/com.office.nightly-scheduler.plist` can be updated to call:

```bash
/usr/bin/node \
  /Users/Office/Repos/stevewesthoek/brain/projects/probot/src/scripts/video-orchestrator-scheduler.mjs \
  run-due \
  --dry-run=false \
  --max-jobs=2
```

Or via npm:

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot && \
npm run probot:video:run-due -- --dry-run=false --max-jobs=2
```

**Nightly behavior:**
1. Runs once per night (e.g., 2 AM local time)
2. Processes up to 2 jobs
3. Respects quota guard (stops and reschedules if exhausted)
4. Logs results to `~/.local/probot/video-orchestrator/scheduler.log`
5. On success: jobs marked completed; next run picks up next batch
6. On quota pause: remaining jobs stay scheduled for following night

---

## Job Lifecycle

```
scheduled ──(due + quota OK)──> running ──> completed
          \
           (quota exhausted)──> paused_quota ──(next run)──> back to scheduled
                                              (manual cancel)──> cancelled
                                              (error)──> failed
```

---

## Validation

### Run Tests

```bash
cd projects/probot
npm run typecheck    # ✅ TypeScript passes
npm test             # ✅ All tests pass
npm run ci            # ✅ Full CI: typecheck + test
```

### Dry-Run Scheduling

```bash
npm run probot:video:schedule-month -- --dry-run=true --episode-count=2
# Should create 2 jobs, no side effects

npm run probot:video:run-due -- --dry-run=true --max-jobs=1
# Should process 1 job, mark completed, no YouTube API calls
```

### Dashboard Integration

```bash
curl http://127.0.0.1:7070/api/video-orchestrator/status | jq '.pending_jobs'
# Should show number of scheduled jobs (truthful count, not demo data)
```

---

## Files Changed

| File | Lines | Purpose |
|------|-------|---------|
| `projects/probot/src/bot/video-orchestrator-jobs.ts` | 430 | Job model, store, scheduler |
| `projects/probot/src/bot/video-orchestrator-jobs.test.ts` | 170 | 10 tests for VO-1 |
| `projects/probot/src/scripts/video-orchestrator-scheduler.mjs` | 120 | CLI: schedule, run, list, status |
| `projects/probot/src/bot/dashboard.ts` | +40 | Import jobs service, update status |
| `projects/probot/package.json` | +3 | Add npm scripts |
| `operations/runbooks/video-orchestrator-vo1-scheduler-foundation.md` | NEW | This doc |

---

## Next Steps (VO-2+)

### VO-2: Database + Worker
- PostgreSQL schema (jobs, videos, accounts, renders, captions)
- Worker process to execute real job types
- Real production package generation

### VO-3: Posting Adapters
- YouTube adapter (API posting)
- Manual export adapter
- Bluesky/n8n adapters

### VO-4: Multi-Account + Quota
- Cross-account scheduling
- Real YouTube API quota tracking (10,000 units/day)
- Account-specific cooldowns

### VO-5: Analytics
- Performance snapshots
- Best-performer recommendations

---

## Reference

- **Implementation plan:** `operations/runbooks/video-orchestrator-implementation-plan.md`
- **Job specs:** `operations/specs/video-orchestrator/examples/`
- **Phase roadmap:** `operations/runbooks/video-orchestrator-roadmap.md`
- **Dashboard:** `projects/probot/src/bot/dashboard.ts`
- **Account registry:** `runtime/local/video-orchestrator/account-registry.local.json`

---

## Security

✅ No secrets stored in job store (only IDs and metadata)  
✅ Quota guard prevents runaway execution  
✅ Dry-run mode prevents accidental real publishing  
✅ Local-only storage (not committed)  
✅ No external API calls in VO-1  

---

## Known Limitations

- Quota guard is placeholder (not real YouTube quota tracking)
- No real video generation or publishing
- Local JSON storage only (no distributed queue)
- No retry/backoff (Phase 2B)
- No cross-project scheduling (Phase 4+)
