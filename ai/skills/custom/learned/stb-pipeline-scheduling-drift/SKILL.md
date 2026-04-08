---
name: stb-pipeline-scheduling-drift
description: When the STB pipeline schedules new episodes for today instead of appending after the last YouTube video, it means youtubeScheduledAt is NULL in the DB — fix by running sync-youtube-db.mjs --fix first.
---

# STB Pipeline: Episodes Schedule for Wrong Dates

## The insight

`computePublishAt()` in `run.mjs` determines each episode's publish date by querying `prisma.pipelineJob.findFirst({ orderBy: { youtubeScheduledAt: desc } })`. If `youtubeScheduledAt` is NULL for all existing episodes, the query returns nothing and the function falls back to "next available 6pm from now" — causing every new episode to pile onto today's date.

`youtubeScheduledAt` is never set by the pipeline itself on existing records. It gets populated only by `sync-youtube-db.mjs --fix`, which calls `videos.list?part=status` to fetch YouTube's `status.publishAt` for each video and writes it to the DB. If that sync hasn't run, or if videos were added to YouTube before the sync fix was deployed, `youtubeScheduledAt` stays NULL.

The symptom looks like a "double booking" problem — new episodes land on dates already occupied by other videos — but the root cause is missing date data, not a duplicate-detection failure.

## When this applies

- New episodes are scheduled for today or in the near past instead of after the last video
- `computePublishAt()` log line reads: `Scheduling after last video (NNN-slug on YYYY-MM-DD)` where the date is unexpectedly recent
- Or no "Scheduling after" log line appears at all (fell through to fallback)
- `youtubeScheduledAt IS NULL` for most/all records in `saysthebible."PipelineJob"`:
  ```sql
  SELECT slug, "youtubeScheduledAt" FROM saysthebible."PipelineJob"
  WHERE "youtubeVideoId" IS NOT NULL ORDER BY slug DESC LIMIT 10;
  ```

## The approach

1. **Confirm the root cause:** Check DB — are `youtubeScheduledAt` values NULL for existing episodes?
2. **Run the sync fix** (before any pipeline batch):
   ```bash
   node --env-file .env scripts/pipeline/sync-youtube-db.mjs --fix
   ```
3. **Verify:** The sync output should say `── Fixing youtubeScheduledAt for N records ──` and list each slug with its new date.
4. **Confirm the last scheduled date** matches what's on YouTube (e.g. episode 034 on April 24).
5. **Run the batch** — `computePublishAt()` will now find the real last date and schedule correctly.

## The fix

`sync-youtube-db.mjs` fetches `status.publishAt` for all videos via:
```javascript
GET /youtube/v3/videos?part=status&id=videoId1,videoId2,...
```
and writes it to `youtubeScheduledAt` on each `PipelineJob` record. This is the fix already deployed.

If scheduling drift recurs (e.g. after adding many new videos manually to YouTube), just re-run:
```bash
node --env-file .env scripts/pipeline/sync-youtube-db.mjs --fix
```

It is idempotent — safe to run before every batch as a pre-flight step.

## Gotchas

- **The pre-flight sync in `batch-run.mjs`** runs `sync-youtube-db.mjs --fix` automatically before each batch. But if the batch is run while the DB has no `youtubeScheduledAt` values (first-time setup or after a schema reset), the pre-flight sync must succeed before any episode runs. Check pre-flight output in `/tmp/stb-pipeline-batch.log`.
- **Duplicate date conflicts**: even if scheduling is fixed, if episodes were already uploaded to the wrong dates (today's slots taken by existing videos), those uploads must be deleted before re-running. Use `--fix --delete-duplicates` on the sync script to remove the newer (wrong) uploads.
- **Daily upload limit uses `youtubePostedAt`**, not `updatedAt`. The sync script can touch `updatedAt` on records, so the limit check was previously inflated. This was fixed on 2026-04-08 in `run.mjs:checkDailyUploadLimit`.

## Context
Repo: says-the-bible  
Discovered: 2026-04-08  
Area: `scripts/pipeline/sync-youtube-db.mjs`, `scripts/pipeline/run.mjs:computePublishAt()`
