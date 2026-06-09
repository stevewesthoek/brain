# Infinite Brain Single-File Write Runbook

Operator procedures for controlled single-file metadata writes to the Mind repository through the Infinite Brain system.

## System Overview

**Status:** ✅ Operational (Phase AL: Single-file allowlisted test write executor)  
**Write Scope:** Single allowlisted file only — `/Users/Office/Repos/stevewesthoek/mind/system/InfiniteBrainWriteTest.md`  
**Write Mode:** Manual test write (no autonomous execution)  
**Safety Gates:** Operator approval + iOS sync safety check + rollback snapshot  
**Scope Constraints:** Single-file-only, allowlist-enforced, no multi-file writes  

---

## Brain Core Startup

**Fixed Port:** 4877  
**Required Directory:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-core`

### Clean Start (Recommended)

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run brain-core:clean-start
```

Expected output:
```
Service: brain-core
Mode: read-only
Status: OK
```

Startup time: ~10-15 seconds. The service will begin accepting connections immediately.

### Health Check

```bash
curl -s http://127.0.0.1:4877/status | jq .
```

Expected response:
```json
{
  "service": "brain-core",
  "mode": "read-only",
  "ok": true,
  "startedAt": "2026-06-08T...",
  "uptimeSeconds": ...,
  "version": "0.1.0",
  "host": "Office",
  "generationModeRuntime": "fixture"
}
```

If status check fails, wait 5 seconds and retry. If it continues to fail, check that port 4877 is not already in use.

---

## Operations: Activation Sequence

The standard activation sequence verifies the system is working correctly before and after each write.

### Step 1: Verification (Before Write)

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run ibr:verify
```

Expected output:
```
[verify] Passed: 11/11
[verify] SUCCESS
{
  "status": "verified",
  "passedCount": 11,
  "totalChecks": 11
}
```

All 11 checks must pass. See **Troubleshooting** if any check fails.

### Step 2: Rollback (Optional - Returns File to Before State)

```bash
npm run ibr:rollback
```

Rollback is safe and repeatable. It restores the allowlisted test file to its exact before state from the latest rollback snapshot.

Expected output:
```
[rollback] Restored file hash: ea94f1dfcdb9
[rollback] Verification: PASSED
[rollback] SUCCESS
```

After rollback, the test file's `status` field returns to `initial`.

### Step 3: Single-File Write Test

```bash
npm run ibr:single-file-write-test
```

This executes the controlled single-file metadata write through the Brain Core API. The operation includes:

1. Operator approval recording (name: Steve, reason: test write)
2. iOS sync safety report generation
3. Single-file metadata write to the allowlisted test file
4. Rollback snapshot creation

Expected output:
```
[write-test] SUCCESS
{
  "status": "test-write-applied",
  "wroteToMind": true,
  "modifiedMind": true,
  "testWriteApplied": true,
  "applied": false,
  "autonomousExecution": false,
  "singleFileOnly": true,
  "allowlistedOnly": true
}
```

After success, the test file's `status` field changes to `"verified"`.

### Step 4: Verification (After Write)

```bash
npm run ibr:verify
```

Re-run verification to confirm the write was applied correctly and all safety gates pass.

Expected: Same as Step 1 (11/11 checks passed).

---

## Expected Success Flags

All of the following must be `true` for a successful write operation:

| Flag | Meaning | Constraint |
|------|---------|-----------|
| `status: "test-write-applied"` | Write was applied | Required |
| `wroteToMind: true` | File was written to Mind | Required |
| `modifiedMind: true` | Mind file was changed | Required |
| `testWriteApplied: true` | Test write completed | Required |
| `applied: false` | Not a production write | Safety gate |
| `autonomousExecution: false` | No autonomous mode | Safety gate |
| `singleFileOnly: true` | Single file scope | Safety gate |
| `allowlistedOnly: true` | Allowlist enforced | Safety gate |

Verification checks (all must pass):

1. Write status is test-write-applied
2. Write report has required fields
3. Target file exists and is readable
4. Target file hash matches expected after hash
5. Rollback snapshot exists
6. Rollback snapshot has before content
7. Write report is single-file-only
8. Write report is allowlisted-only
9. No autonomous execution
10. Write is test-write only (not applied)
11. Safety flags are correct

---

## Forbidden Actions

The following actions are **not implemented** and must never be attempted:

| Action | Why It's Forbidden | Reference |
|--------|-------------------|-----------|
| Multi-file writes | Scope constraint enforced | Allowlist gate only |
| Autonomous execution | Manual operator gate only | `autonomousExecution=false` always |
| Apply button | Test write only, no production | No Apply endpoint |
| Execute button | No automatic execution | No Execute endpoint |
| Broad Mind writing | Single allowlisted file | `allowlistedOnly: true` enforced |
| Write outside allowlist | Not allowlisted | `/system/InfiniteBrainWriteTest.md` only |
| Shell execution | No subprocess spawning | TypeScript adapters only |
| Model provider calls | Deterministic, no LLM | Metadata writes only |
| Random IDs | Stable, deterministic IDs | SHA256 hashing only |

If any of these appear to be possible, **stop and investigate** — a safety constraint has been broken.

---

## Target File

**Path:** `/Users/Office/Repos/stevewesthoek/mind/system/InfiniteBrainWriteTest.md`

**Allowlist Status:** ✅ Only allowlisted Mind file  
**Write Pattern:** YAML frontmatter field update  
**Current State:** `status: "verified"` (after successful write test)  
**Before State:** `status: initial` (original)

### File Contents

```markdown
---
name: "Infinite Brain Write Test"
status: "verified"
---

# Infinite Brain Write Test

This file exists only for the first controlled Infinite Brain metadata write test.
```

This file is used for testing only. Do not use it for production writes.

---

## Runtime Artifacts (Never Commit)

The following files are generated at runtime and must **never be committed to git**:

| Artifact | Location | Category | Gitignore Status |
|----------|----------|----------|------------------|
| Rollback snapshot | `runtime/local/infinite-brain/metadata-write-rollback-latest.json` | Snapshot | ✅ Ignored |
| Write report | `runtime/local/infinite-brain/metadata-writer-write-latest.json` | Report | ✅ Ignored |
| Verification report | `runtime/local/infinite-brain/metadata-write-verification-latest.json` | Report | ✅ Ignored |
| Rollback applied report | `runtime/local/infinite-brain/metadata-write-rollback-applied-latest.json` | Report | ✅ Ignored |
| Runtime cache | `projects/runtime/` | Cache | ✅ Ignored |
| Build cache | `projects/brain-console/.next/` | Cache | ✅ Ignored |

All runtime outputs are properly gitignored. Do not manually stage or commit any of these files.

---

## Troubleshooting

### Verification Fails: "No write report found"

**Cause:** Brain Core API has not run a write test yet, or the report file was deleted.

**Action:**
1. Confirm Brain Core is running: `curl -s http://127.0.0.1:4877/status`
2. Run the write test: `npm run ibr:single-file-write-test`
3. Re-run verification: `npm run ibr:verify`

### Rollback Fails: "No rollback snapshot found"

**Cause:** No write test has been run, or the snapshot was deleted.

**Action:**
1. Run the write test first: `npm run ibr:single-file-write-test`
2. Then run rollback: `npm run ibr:rollback`

### Write Test Fails: "Health check failed"

**Cause:** Brain Core is not running or not responding.

**Action:**
1. Check port 4877 is available: `lsof -i :4877`
2. Kill any existing Brain Core: `pkill -f "brain-core\|node.*index.ts"`
3. Restart clean: `npm run brain-core:clean-start`
4. Wait 10 seconds, retry

### Write Test Fails: "operator approval record failed"

**Cause:** iOS sync safety report was not generated before the write.

**Action:**
1. The write test includes approval recording and iOS sync safety generation automatically
2. If it fails, check Brain Core is responding to `/api/infinite-brain/ios-sync-safety/generate`
3. Restart and retry: `npm run brain-core:clean-start` then `npm run ibr:single-file-write-test`

### Verification Check Fails: "Rollback snapshot has before content" 

**Cause:** Rollback snapshot is malformed or was truncated.

**Action:**
1. Review rollback snapshot: `cat runtime/local/infinite-brain/metadata-write-rollback-latest.json | jq .beforeContent`
2. The snapshot should contain the full before-state file content
3. If empty or truncated, re-run the write test to regenerate: `npm run ibr:single-file-write-test`

---

## Workflow Example: Full Cycle

This is a complete example of a successful activation sequence.

```bash
# 1. Start Brain Core
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run brain-core:clean-start

# 2. Wait for startup (10-15 seconds)
# 3. Verify health
curl -s http://127.0.0.1:4877/status | jq .ok

# 4. Run initial verification
npm run ibr:verify
# Expected: 11/11 checks passed

# 5. (Optional) Rollback to before-state
npm run ibr:rollback
# Expected: File restored to status: initial

# 6. Run single-file write test
npm run ibr:single-file-write-test
# Expected: status: test-write-applied, all flags correct

# 7. Run final verification
npm run ibr:verify
# Expected: 11/11 checks passed

# 8. Confirm repository is clean
git status --short
# Expected: (blank - nothing to commit)
```

---

## What Changed and Why

This runbook documents the single-file write system that was implemented in Phase AL:

- **5e48f94a** — Added rollback and verification runners with comprehensive safety gates
- **70a0303f** — Fixed rollback restore safety reporting
- **92092c46** — Added Brain Core startup and write test runners with guarded execution

All runners are manual operator workflows. No autonomous execution has been added.

---

## Questions and Support

**Is this production-ready?**  
No. This is Phase AL: single-file allowlisted test write executor. The system is safe and working correctly, but it is for controlled testing only. No production writes are implemented.

**Can I write to other Mind files?**  
No. The allowlist enforces single-file-only writes to `/system/InfiniteBrainWriteTest.md`. Attempting to write elsewhere will fail at the allowlist gate.

**Will this autonomous commit changes to Mind?**  
No. `autonomousExecution: false` always. All writes are manual operator commands via CLI runners.

**What if I accidentally run a write with the wrong operator name?**  
The operator name is recorded in the approval record but does not prevent the write. The write is still single-file-only and allowlist-enforced. If you need to retry with a different operator name, run rollback first, then re-run the write test.

**Can I delete the rollback snapshot?**  
Yes, but rollback will fail if the snapshot is missing. Always re-run a write test before attempting rollback to ensure a fresh snapshot exists.

