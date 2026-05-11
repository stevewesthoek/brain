# VO-1B: Scheduler Foundation Hardening

**Status**: Complete (127/127 tests passing)  
**Date**: 2026-05-11  
**Commit**: (awaiting approval)

## Overview

VO-1B hardens the Video Orchestrator scheduler foundation introduced in VO-1, addressing 7 critical issues identified during ChatGPT verification:

1. ✅ CLI execution model — now properly routed through npm/tsx
2. ✅ Non-dry-run safety — blocked with honest error, not fake "Executed"
3. ✅ Paused quota resumption — jobs properly resume after quota reset
4. ✅ Quota persistence — state persisted to ~/.local/probot/video-orchestrator/quota.json
5. ✅ Error message persistence — errors properly saved to job store
6. ✅ Scheduler logging — append-only log to ~/.local/probot/video-orchestrator/scheduler.log
7. ✅ CLI argument parsing — both --key=value and --key value formats supported

---

## Execution Model

### Correct Usage (VO-1B+)

All commands use npm scripts that route through `tsx` — direct `node` execution is unsupported because the scheduler imports TypeScript files.

**From projects/probot directory or repository root:**

All commands work from either location. Root commands proxy to projects/probot via `npm --prefix`.

#### List Jobs (filter by status)

```bash
# List all jobs
npm run probot:video:jobs

# List jobs with specific status
npm run probot:video:jobs -- --status=scheduled
npm run probot:video:jobs -- --status=completed
npm run probot:video:jobs -- --status=failed
npm run probot:video:jobs -- --status=paused_quota
```

#### Status (dashboard)

```bash
# Show job status summary
npm run probot:video:status
```

#### Reset Quota

```bash
# Reset daily quota to 0
npm run probot:video:reset-quota
```

#### Schedule Rest of Month

```bash
# Schedule jobs for rest of month (dry-run mode)
npm run probot:video:schedule-month -- --dry-run=true --episode-count=2

# Schedule without dry-run (requires real adapters)
npm run probot:video:schedule-month -- --dry-run=false --episode-count=2
```

#### Run Due Jobs

```bash
# Run jobs scheduled for now (dry-run mode)
npm run probot:video:run-due -- --dry-run=true --max-jobs=5

# Run without dry-run (requires real adapters)
npm run probot:video:run-due -- --dry-run=false --max-jobs=5
```

### Argument Formats

Both formats are supported and tested:

```bash
# Format 1: --key=value
npm run probot:video:run-due -- --dry-run=true --max-jobs=2

# Format 2: --key value (space-separated)
npm run probot:video:run-due -- --dry-run true --max-jobs 2

# Mix and match
npm run probot:video:run-due -- --dry-run=true --max-jobs 2
```

### LaunchAgent Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.brain.probot-scheduler</string>
  <key>ProgramArguments</key>
  <array>
    <string>sh</string>
    <string>-c</string>
    <string>cd /Users/Office/Repos/stevewesthoek/brain/projects/probot && npm run probot:video:run-due -- --dry-run=true --max-jobs=2</string>
  </array>
  <key>StartInterval</key>
  <integer>3600</integer>
</dict>
</plist>
```

### ❌ Deprecated (VO-1)

Do NOT use:
```bash
node video-orchestrator-scheduler.mjs list  # wrong: imports .ts files
/usr/bin/node video-orchestrator-scheduler.mjs  # wrong: direct node
```

---

## Non-Dry-Run Safety

**VO-1 Behavior**: Marked jobs "completed" with fake `{ output: "Executed: ..." }`  
**VO-1B Behavior**: Blocks execution until real adapters exist

```typescript
// Before (VO-1) - UNSAFE
: { output: `Executed: ${job.type}` };  // FAKE!

// After (VO-1B) - SAFE
"Real execution is not implemented for VO-1. Run with --dry-run=true."
```

Jobs run with `--dry-run=false` are marked **failed** with honest error message, preventing data loss from fake "execution".

**Test**: `VO-1B-1: Non-dry-run job is blocked with honest error`

---

## Quota Persistence

**VO-1 Behavior**: In-memory only (resets on process restart)  
**VO-1B Behavior**: Persisted to disk with midnight reset

**Location**: `~/.local/probot/video-orchestrator/quota.json`

```json
{
  "total_used": 3,
  "reset_at": "2026-05-12T00:00:00.000Z"
}
```

**Behavior**:
- Quota limit: 10 jobs/day (conservative for VO-1)
- Incremented on each job execution (only in dry-run; non-dry-run jobs skip quota consumption)
- Auto-reset at midnight (00:00 UTC)
- Manual reset: `npm run probot:video:reset-quota`

**Tests**: `VO-1B-3`, `VO-1B-4`

---

## Paused Quota Resume

**VO-1 Behavior**: `paused_quota` jobs never resumed  
**VO-1B Behavior**: Jobs can run after quota becomes available again

**Flow**:
1. Jobs hit quota limit (10/day) → status = `paused_quota`
2. Call `resetQuota()` or midnight passes → quota becomes available
3. Next `runDueVideoJobs` call → considers both `scheduled` AND `paused_quota` due jobs
4. For each job, checks if quota allows execution
5. If quota allows, job runs (transitions to completed or failed)
6. If quota exhausted again, job remains/becomes `paused_quota`

**Key Difference from VO-1**: Paused jobs are not stuck forever. They are eligible for execution in the next run, and will execute if quota is available.

**Test**: `VO-1B-3: Paused quota jobs can resume after quota reset` verifies:
- 12 jobs scheduled, quota limit 10
- First run pauses 2 jobs
- After resetQuota(), second run executes the 2 previously paused jobs
- Specific job IDs are tracked and verified to transition from `paused_quota` to `completed`

---

## Error Message Persistence

**VO-1 Behavior**: Error set on local job object, not persisted to store  
**VO-1B Behavior**: Properly persisted to job store

```typescript
// VO-1B signature
updateVideoJobStatus(
  jobId: string,
  status: JobStatus,
  result?: { simulated?: boolean; output?: unknown },
  errorMessage?: string  // NEW
): void

// Usage
updateVideoJobStatus(job.id, "failed", result, errorMsg);
```

**Test**: `VO-1B-2: Error message is persisted correctly after job failure`

---

## Scheduler Logging

**Location**: `~/.local/probot/video-orchestrator/scheduler.log`

**Format**: Append-only, one event per line

```
[2026-05-11T12:44:38.853Z] Test event: {"key":"value"}
[2026-05-11T12:44:58.334Z] Run due completed: {"ran":0,"quota_paused":0,"failed":0}
[2026-05-11T12:45:00.123Z] Job quota paused: {"job_id":"abc12345","reason":"Quota exhausted: 10/10"}
[2026-05-11T12:45:01.234Z] Job blocked (no real executor): {"job_id":"def67890","type":"generate_episode"}
[2026-05-11T12:45:02.345Z] Quota reset
```

**Events Logged**:
- `Quota reset` — Manual or automated reset
- `Run due completed` — Summary of execution (ran, quota_paused, failed)
- `Job quota paused` — Job hit quota limit
- `Job blocked (no real executor)` — Non-dry-run job blocked
- `Job failed` — Unhandled exception during execution
- `Completed (dry-run)` — Successful dry-run completion
- `Resume paused_quota job (quota reset)` — Job resumed after quota reset

**Test**: `VO-1B-5: Scheduler log is written and contains events`

---

## CLI Argument Parsing

**Both formats supported**:

```bash
# Format 1: --key=value
npm run probot:video:run-due -- --dry-run=true --max-jobs=2

# Format 2: --key value (space-separated)
npm run probot:video:run-due -- --dry-run true --max-jobs 2

# Mix and match
npm run probot:video:run-due -- --dry-run=true --max-jobs 2
```

**Boolean handling**:
- `--flag=true` → `args.flag = true`
- `--flag=false` → `args.flag = false`
- `--flag true` → `args.flag = true`
- `--flag false` → `args.flag = false`

**Test**: `VO-1B-6: CLI arg parser supports both formats`

---

## Test Isolation

**All tests are now fully isolated from operator runtime.**

Each test:
- Sets `PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR` to a temp directory
- Creates its own jobs.json, quota.json, scheduler.log in that temp directory
- Cleans up the temp directory after completion

**Behavior**:
- Tests do not read or write to `~/.local/probot/video-orchestrator` (operator runtime is untouched)
- `getRuntimeDir()` checks env override first, then falls back to `~/.local/probot/` if not set
- Scheduler log, quota state, and job store all respect the override
- Every test (VO-J1 through VO-J10, VO-1B-1 through VO-1B-6) is wrapped with isolation

**CLI Parser Import Safety**:
- Parser helper (`video-orchestrator-scheduler-args.ts`) is pure TypeScript with no side effects
- Importing the parser does not create jobs.json, quota.json, or scheduler.log
- `scheduler.mjs` guards main() execution: only runs when executed directly, not imported
- Test verifies this: parsing args + temp dir override confirms zero filesystem mutations

**Verification**:
- Test `VO-1B-6` proves that runtime dir override works
- Test `VO-1B-4` proves quota state persists and is reloadable
- Test `VO-1B-5` proves scheduler log is created and written
- CLI parser import test proves importing/parsing creates zero filesystem artifacts

**Important**: When running tests locally, do not set `PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR`. The override is for test suite only. Operator runtime uses the default `~/.local/probot/video-orchestrator/`.

## Test Coverage

### Total Tests (127)

#### Tests (127 total)

**Existing Tests**: 110 (dashboard, local-apps, etc.)

**VO-1B Hardening Tests** (6 tests):

| Test | Purpose | Isolation |
|------|---------|-----------|
| `VO-J1–J10` | Original job management tests | All wrapped with setupTestRuntime/cleanupTestRuntime |
| `VO-1B-1` | Non-dry-run jobs blocked (not completed) | Temp dir isolated |
| `VO-1B-2` | Error messages persisted to store | Temp dir isolated |
| `VO-1B-3` | Paused quota jobs resume after reset (tracks specific job IDs) | Temp dir isolated |
| `VO-1B-4` | Quota state persists across processes | Temp dir isolated |
| `VO-1B-5` | Scheduler log created and events logged | Temp dir isolated |
| `VO-1B-6` | Runtime directory override env var works | Temp dir isolated |

**CLI Argument Parser Tests** (7 tests, all side-effect-free, fully typed):

| Test | Purpose | Type-Checked |
|------|---------|-------------|
| `CLI: parseSchedulerArgs --key=value` | Supports `--max-jobs=3` format | ✅ |
| `CLI: parseSchedulerArgs --key value` | Supports `--max-jobs 3` format | ✅ |
| `CLI: parseSchedulerArgs mixed formats` | Both formats together | ✅ |
| `CLI: parseSchedulerArgs flags without values` | Flags like `--verbose` | ✅ |
| `CLI: parseSchedulerArgs boolean strings` | Converts "true"/"false" to booleans | ✅ |
| `CLI: parser import causes no filesystem side effects` | Comprehensive temp-dir test for jobs.json/quota.json/scheduler.log | ✅ |
| `CLI: parser import causes no side effects on job/quota/log files` | Additional verification test | ✅ |

### Summary: 127 tests (110 existing + 17 new)

**Command**: `cd projects/probot && npm test`
**TypeCheck**: `npm run typecheck` (all tests included, 0 errors)

---

## Files Modified

| File | Changes |
|------|---------|
| `projects/probot/src/bot/video-orchestrator-jobs.ts` | Runtime dir override, paused job resume fix, proper error persistence |
| `projects/probot/src/bot/video-orchestrator-jobs.test.ts` | All tests wrapped with setupTestRuntime/cleanupTestRuntime for full isolation |
| `projects/probot/src/scripts/video-orchestrator-scheduler-args.ts` | NEW: TypeScript parser helper with proper types (SchedulerArgs, SchedulerArgValue) |
| `projects/probot/src/scripts/video-orchestrator-scheduler.mjs` | Imports parser from .ts, guards main() with robust import.meta + path.resolve check |
| `projects/probot/src/scripts/video-orchestrator-scheduler.test.ts` | 7 CLI parser tests with full type annotations, comprehensive side-effect verification |
| `projects/probot/tsconfig.json` | Restored to include all .ts files (no test exclusion) |
| `projects/probot/package.json` | Added explicit scripts: jobs, status, reset-quota, schedule-month, run-due |
| `package.json` | Root proxy scripts for all 5 video orchestrator commands (args forward correctly) |
| `operations/runbooks/video-orchestrator-vo1b-scheduler-hardening.md` | Updated test count (127), parser typing, comprehensive command reference, corrected troubleshooting |

---

## Safety Verification

✅ No upload capability added  
✅ No real YouTube API calls  
✅ No tokens printed or stored  
✅ No secrets in scheduler log (events redacted)  
✅ Quota limit conservative (10/day for testing)  
✅ Non-dry-run jobs safely blocked  
✅ Error messages persisted (no loss of debugging info)  

---

## Migration from VO-1 → VO-1B

**No breaking changes**. VO-1 behavior is superseded:

| Aspect | VO-1 | VO-1B |
|--------|------|-------|
| CLI | `node scheduler.mjs` (broken) | `npm run probot:video:*` (correct) |
| Non-dry-run | Fake "Executed" ❌ | Blocked + honest error ✅ |
| Paused jobs | Never resume | Auto-resume ✅ |
| Quota | In-memory | Persisted ✅ |
| Errors | Lost | Persisted ✅ |
| Logging | Not implemented | Implemented ✅ |

---

## Troubleshooting

### Quota exhausted, jobs won't run?

```bash
npm run probot:video:reset-quota
npm run probot:video:run-due -- --dry-run=true --max-jobs=5
```

### Check scheduler log

```bash
tail -50 ~/.local/probot/video-orchestrator/scheduler.log
```

### Check job status

```bash
# Show all jobs with error state
npm run probot:video:jobs -- --status=failed

# Show all jobs paused due to quota
npm run probot:video:jobs -- --status=paused_quota

# Show overall status dashboard
npm run probot:video:status
```

---

## Future Work (VO-2+)

- Real generation adapter (video synthesis, audio mixing)
- Real publishing adapter (YouTube upload with oauth)
- Per-account quota tracking
- Retry logic for transient failures
- Scheduled maintenance tasks (clean old jobs, archive logs)
