# Phase 3: A/B Testing API Endpoints

## Overview

Time-slice A/B testing for YouTube thumbnails:
- Day 0-6: Variant A active (initial upload)
- Day 7-13: Switch to Variant B
- Compare CTR between periods
- Manual or automatic winner selection

## Endpoints

### 1. Create A/B Test

```bash
POST /api/video-orchestrator/ab-test/create
Content-Type: application/json

{
  "video_id": "job-uuid",
  "variant_a_id": "thumb-uuid-1",
  "variant_b_id": "thumb-uuid-2"
}

Response:
{
  "test_id": "test-uuid",
  "status": "pending",
  "variants": ["a", "b"],
  "created_at": "2026-05-25T14:22:33Z"
}
```

**When to call:** After thumbnail job completes and variant_a is uploaded to YouTube

**Action:** Create database entry for A/B test, link to video job

---

### 2. Record Slice A Results (Day 6)

```bash
POST /api/video-orchestrator/ab-test/{test_id}/slice-a
Content-Type: application/json

{
  "start_date": "2026-05-25",
  "end_date": "2026-05-31",
  "views": 5420,
  "clicks": 87,
  "ctr": 0.0161
}

Response:
{
  "test_id": "test-uuid",
  "slice_a": {
    "views": 5420,
    "clicks": 87,
    "ctr": 0.0161,
    "recorded_at": "2026-05-31T23:59:59Z"
  },
  "next_action": "Switch to Variant B tomorrow"
}
```

**When to call:** End of day 6 (before switching to variant B)

**Action:** Record slice_a_ctr in database. Ready to switch thumbnails.

---

### 3. Switch to Variant B (Day 7)

```bash
POST /api/video-orchestrator/ab-test/{test_id}/switch-variant
Content-Type: application/json

{
  "from": "a",
  "to": "b",
  "reason": "Day 7 time-slice switch"
}

Response:
{
  "test_id": "test-uuid",
  "variant_active": "b",
  "switched_at": "2026-06-01T00:00:00Z",
  "action": "Upload variant_b thumbnail to YouTube manually or via API"
}
```

**When to call:** Start of day 7

**Action:** Switch active variant in database. Send signal to upload variant B.

---

### 4. Record Slice B Results (Day 13)

```bash
POST /api/video-orchestrator/ab-test/{test_id}/slice-b
Content-Type: application/json

{
  "start_date": "2026-06-01",
  "end_date": "2026-06-07",
  "views": 6100,
  "clicks": 102,
  "ctr": 0.0167
}

Response:
{
  "test_id": "test-uuid",
  "slice_a": { "ctr": 0.0161, "views": 5420 },
  "slice_b": { "ctr": 0.0167, "views": 6100 },
  "auto_winner": "b",
  "difference_pct": "+0.6%",
  "margin": "5%",
  "statistical_significance": true
}
```

**When to call:** End of day 13

**Action:** Record slice_b_ctr. Auto-determine winner if difference > 5%.

---

### 5. Declare Winner (Manual Override)

```bash
POST /api/video-orchestrator/ab-test/{test_id}/declare-winner
Content-Type: application/json

{
  "winner": "a",
  "reason": "Variant A brand consistency better, even though B has higher CTR",
  "decided_by": "manual_override"
}

Response:
{
  "test_id": "test-uuid",
  "winner": "a",
  "winner_declared_at": "2026-06-08T10:15:33Z",
  "declared_by": "manual",
  "action": "Keep variant A as final thumbnail. Archive test results."
}
```

**When to call:** Anytime after both slices recorded (auto-decision on day 13, manual anytime)

**Action:** Mark test complete. Store winner in database.

---

### 6. Get Test Status

```bash
GET /api/video-orchestrator/ab-test/{test_id}

Response:
{
  "test_id": "test-uuid",
  "video_id": "job-uuid",
  "variant_a_id": "thumb-uuid-1",
  "variant_b_id": "thumb-uuid-2",
  "slice_a": {
    "start": "2026-05-25",
    "end": "2026-05-31",
    "views": 5420,
    "clicks": 87,
    "ctr": 0.0161
  },
  "slice_b": {
    "start": "2026-06-01",
    "end": "2026-06-07",
    "views": 6100,
    "clicks": 102,
    "ctr": 0.0167
  },
  "winner": "b",
  "winner_declared_at": "2026-06-08T14:22:33Z",
  "winner_declared_by": "system",
  "created_at": "2026-05-25T14:22:33Z"
}
```

---

## Integration with YouTube API

### Uploading Variant B (Day 7)

YouTube doesn't support direct thumbnail switching via API without re-uploading. Options:

**Option 1: Manual Switch (Recommended for Phase 3)**
1. Day 7: Download variant_b image from S3
2. Manually upload to YouTube via Creator Studio
3. API endpoint acknowledges switch

**Option 2: YouTube API Thumbnail Update (Future)**
1. Call `youtube.videos().update()` with `snippet.thumbnails.default.url`
2. Requires credentials with `youtube.upload` scope
3. Can be automated post-Phase 3

### Fetching CTR Data (Day 6 & 13)

Use YouTube Analytics API:
```python
service.reports().query(
  ids='channel==UC....',
  start_date='2026-05-25',
  end_date='2026-05-31',
  metrics='views,subscribersGained',
  dimensions='video'
).execute()
```

Or fetch via dashboard and manually POST to `/slice-a` endpoint (Phase 3 approach).

---

## Manual Workflow (Phase 3)

```
Day 0: Thumbnail job completes
  ↓
  POST /api/video-orchestrator/ab-test/create
  → test_id created, variant_a active

Day 0-6: Variant A on YouTube
  ↓
  Monitor YouTube Analytics dashboard

Day 6 (evening): Record Slice A
  ↓
  POST /api/video-orchestrator/ab-test/{test_id}/slice-a
  → Slice A recorded (CTR: 1.61%)

Day 7 (morning): Switch to Variant B
  ↓
  1. Download variant_b from S3
  2. Upload to YouTube manually
  3. POST /api/video-orchestrator/ab-test/{test_id}/switch-variant
  → variant_b marked active

Day 7-13: Variant B on YouTube
  ↓
  Monitor YouTube Analytics dashboard

Day 13 (evening): Record Slice B & Auto-Determine Winner
  ↓
  POST /api/video-orchestrator/ab-test/{test_id}/slice-b
  → Slice B recorded (CTR: 1.67%)
  → Auto-determine: Variant B wins (+0.6%, > 5% margin)

Day 14 (optional): Manually override if needed
  ↓
  POST /api/video-orchestrator/ab-test/{test_id}/declare-winner
  → Winner locked in

Result: Variant B (or override) becomes permanent thumbnail
```

---

## Database Schema

```sql
CREATE TABLE a_b_test_results (
  test_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES jobs(job_id),
  variant_a_id UUID NOT NULL,
  variant_b_id UUID NOT NULL,
  test_start_date DATE NOT NULL,
  
  -- Slice A (days 0-6)
  slice_a_start DATE,
  slice_a_end DATE,
  slice_a_views INT,
  slice_a_clicks INT,
  slice_a_ctr FLOAT,
  
  -- Slice B (days 7-13)
  slice_b_start DATE,
  slice_b_end DATE,
  slice_b_views INT,
  slice_b_clicks INT,
  slice_b_ctr FLOAT,
  
  -- Winner determination
  winner VARCHAR(20),  -- "a", "b", "tie", "pending", "manual_override"
  winner_declared_at TIMESTAMP,
  winner_declared_by VARCHAR(20),  -- "system", "manual"
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ab_test_video ON a_b_test_results(video_id);
CREATE INDEX idx_ab_test_winner ON a_b_test_results(winner);
```

---

## Next Phase: Automation (Phase 3.5)

1. **YouTube Analytics Sync:** Automatic fetch of CTR from YouTube API (daily)
2. **Auto Determination:** System auto-determines winner on day 13, notifies user
3. **Thumbnail Upload Automation:** Auto-upload variant B on day 7 via YouTube API
4. **Reporting:** Dashboard showing all active A/B tests + results

