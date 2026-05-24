# Phase 7 Hardening: Retry Backoff + Storage Cleanup

## Context

Two open Phase 7 items remain in `video-orchestrator-roadmap.md`. Both are small, targeted improvements to production reliability and storage management. The roadmap notes "currently max_retries=3 flat" for retry, and "archive completed job output files after 30d, keep artifact forever" for storage cleanup.

---

## Task 1 — Non-blocking Job Retry with Exponential Backoff

### Problem
The Python worker already computes exponential backoff (`min(2 ** retry_count * 5, 300)`) but blocks the worker process with `time.sleep(backoff)`. During the sleep (up to 300s), no other jobs can be processed. The `scheduled_after` column already exists on the `jobs` table and the job-claim query already respects it — it just isn't used by the retry path.

### Change
**File:** `~/.local/video-orchestrator/worker/video_worker.py`

In the retry block (lines ~1149–1155), replace the `time.sleep(backoff)` with a `scheduled_after` update:

```python
# Before:
update_job(jid, job_status="pending", retry_count=retry_count)
time.sleep(backoff)

# After:
from datetime import timezone
scheduled_after = datetime.now(timezone.utc) + timedelta(seconds=backoff)
update_job(jid, job_status="pending", retry_count=retry_count, scheduled_after=scheduled_after.isoformat())
# Worker no longer sleeps — job-claim query filters scheduled_after <= NOW()
```

First verify `update_job` accepts `scheduled_after` as a keyword arg (check how the function builds the SQL). If it doesn't, add `scheduled_after` to the column whitelist.

### Verify
```bash
cd ~/.local/video-orchestrator
python -m pytest tests/test_worker.py -v
```
Add one test: a job that fails should have `scheduled_after` set and `job_status = 'pending'` on the retry path, and `status = 'dead'` on final exhaustion.

---

## Task 2 — Storage Cleanup: Extended Coverage + Automation

### Problem
`storage_cleanup.py` already handles `~/.local/video-orchestrator/data/` (compose/subtitle/thumbnail output) but misses:
- `~/.local/video-orchestrator/packages/` (post/render/lora output)
- `~/.local/video-orchestrator/output/` (CLI `vo queue render` default)
- No automatic invocation — must be run manually

### Change 1 — Extend `storage_cleanup.py`
**File:** `~/.local/video-orchestrator/scripts/storage_cleanup.py`

Add `packages/` and `output/` scanning alongside the existing `data/` scanning. The directory resolution logic stays the same — check `task_config.output_dir` first, fall back to each directory. The archive path scheme stays the same. Add a constant for `PACKAGES_DIR`:

```python
DEFAULT_PACKAGES_DIR = Path.home() / ".local/video-orchestrator/packages"
DEFAULT_OUTPUT_DIR = Path.home() / ".local/video-orchestrator/output"
```

And extend `list_cleanup_candidates()` to include job types `post`, `render`, `lora_render` whose output may land in `packages/` or `output/`.

### Change 2 — Add Brain Core storage endpoint
**New file:** `projects/brain-core/src/adapters/infra-video-orchestrator-storage-cleanup.ts`

- `readStorageStats()` — returns: directories scanned, total file count, total size bytes, oldest job age, jobs eligible for archival (>30d)
- `triggerStorageCleanup(dryRun: boolean)` — shells out to `storage_cleanup.py run [--dry-run]` and returns the result

**File:** `projects/brain-core/src/api/routes.ts`
- Add `GET /api/infra/video-orchestrator/storage-stats` — calls `readStorageStats()`
- Add `POST /api/infra/video-orchestrator/storage-cleanup` with body `{ dryRun: boolean }` — calls `triggerStorageCleanup()`

**Tests:** `projects/brain-core/src/tests/infra-video-orchestrator-storage-cleanup.test.ts`
- readStorageStats returns valid shape
- triggerStorageCleanup dry-run returns candidates without deleting

### Change 3 — Nightly scheduler automation
**File:** `~/.local/video-orchestrator/scripts/office-nightly-scheduler.sh` (or check the correct nightly scheduler path)

Add a call to `storage_cleanup.py run --days 30` to run nightly (after analytics sync, before sleep). Should respect dry-run flag or just run silently with exit code logging.

---

## Roadmap Update
**File:** `projects/brain-core/docs/video-orchestrator-roadmap.md`

Mark both Phase 7 items complete:
```markdown
- [x] Job retry with exponential backoff (non-blocking via scheduled_after)
- [x] Storage cleanup — archive completed job output files after 30d, keep artifact forever
```

---

## Sequence
1. Retry backoff: verify `update_job`, make change, add test, run worker tests
2. Storage cleanup Python extension: extend `storage_cleanup.py`, run existing cleanup tests
3. Brain Core storage endpoint: new adapter + routes, add tests
4. Nightly scheduler: add cleanup call
5. Roadmap update + doc commit
6. Run full test suite (npm test in brain-core, worker tests, typecheck)

## Verification
```bash
# Worker tests (after retry change)
cd ~/.local/video-orchestrator && python -m pytest tests/test_worker.py -v

# Brain Core (after storage endpoint)
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run typecheck && npm test

# Manual cleanup dry-run
python ~/.local/video-orchestrator/scripts/storage_cleanup.py run --dry-run --days 30
```
