# Phase 3: A/B Testing for YouTube Thumbnails

**Status:** 🟡 In Progress — Infrastructure ready, manual workflow implemented

## Overview

Time-slice A/B testing compares two thumbnail variants over 14 days:
- **Days 0–6:** Variant A active (initial upload)
- **Days 7–13:** Variant B active (swapped manually)
- **Day 14+:** Winner declared based on CTR comparison

## How It Works

### Timeline

```
Day 0: Thumbnail job completes → 2 variants (A, B) generated
  ↓
  POST /ab-test/create → test_id created

Days 0–6: Variant A on YouTube
  ↓
  Monitor YouTube Analytics dashboard

Day 6 evening: Record Variant A CTR
  ↓
  POST /ab-test/{test_id}/slice-a → Store CTR data

Day 7 morning: Switch to Variant B
  ↓
  1. Download variant_b from S3
  2. Manually upload to YouTube Creator Studio
  3. POST /ab-test/{test_id}/switch-variant

Days 7–13: Variant B on YouTube
  ↓
  Monitor YouTube Analytics dashboard

Day 13 evening: Record Variant B CTR
  ↓
  POST /ab-test/{test_id}/slice-b
  → Auto-determine winner if difference > 5%

Day 14+: Declare winner (auto or manual)
  ↓
  POST /ab-test/{test_id}/declare-winner
  → Winner locked in, test archived
```

## API Endpoints

### 1. Create Test
```bash
POST /api/video-orchestrator/ab-test/create
{
  "video_id": "job-uuid",
  "variant_a_id": "thumb-uuid-1",
  "variant_b_id": "thumb-uuid-2"
}
```
**Response:** `{ "test_id": "test-uuid", "status": "pending" }`

### 2. Record Slice A (Day 6)
```bash
POST /api/video-orchestrator/ab-test/{test_id}/slice-a
{
  "start_date": "2026-05-25",
  "end_date": "2026-05-31",
  "views": 5420,
  "clicks": 87,
  "ctr": 0.0161
}
```

### 3. Switch Variant (Day 7)
```bash
POST /api/video-orchestrator/ab-test/{test_id}/switch-variant
{
  "from": "a",
  "to": "b",
  "reason": "Day 7 time-slice switch"
}
```

### 4. Record Slice B (Day 13)
```bash
POST /api/video-orchestrator/ab-test/{test_id}/slice-b
{
  "start_date": "2026-06-01",
  "end_date": "2026-06-07",
  "views": 6100,
  "clicks": 102,
  "ctr": 0.0167
}
```
**Response includes:** `auto_winner`, `difference_pct`, `statistical_significance`

### 5. Declare Winner (Optional Manual Override)
```bash
POST /api/video-orchestrator/ab-test/{test_id}/declare-winner
{
  "winner": "a",
  "reason": "Brand consistency preferred",
  "decided_by": "manual_override"
}
```

### 6. Get Test Status
```bash
GET /api/video-orchestrator/ab-test/{test_id}
```
**Response:** Full test status including slices, winner, and timeline

## Winner Determination

**Auto-determination criteria:**
- If `|CTR_B - CTR_A| > 5%` → Statistically significant, declare winner
- If `|CTR_B - CTR_A| ≤ 5%` → Tie (no significant difference)
- Manual override allowed anytime after both slices recorded

**Example:**
- Variant A CTR: 1.61%
- Variant B CTR: 1.67%
- Difference: +0.6% (< 5% margin)
- Result: **Tie** → User can manually override or keep Variant A

## Database Schema

```sql
CREATE TABLE a_b_test_results (
  test_id UUID PRIMARY KEY,
  video_id UUID NOT NULL,
  variant_a_id UUID NOT NULL,
  variant_b_id UUID NOT NULL,
  test_start_date DATE,
  
  -- Slice A (days 0–6)
  slice_a_start DATE, slice_a_end DATE,
  slice_a_views INT, slice_a_clicks INT, slice_a_ctr FLOAT,
  
  -- Slice B (days 7–13)
  slice_b_start DATE, slice_b_end DATE,
  slice_b_views INT, slice_b_clicks INT, slice_b_ctr FLOAT,
  
  -- Winner
  winner VARCHAR(20),  -- "a", "b", "tie", "pending"
  winner_declared_at TIMESTAMP,
  winner_declared_by VARCHAR(20),  -- "system" or "manual"
  notes TEXT,
  
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE INDEX idx_ab_test_video ON a_b_test_results(video_id);
CREATE INDEX idx_ab_test_winner ON a_b_test_results(winner);
```

## Implementation Files

| File | Purpose |
|------|---------|
| `ab_test_manager.py` | Database operations (create, record, declare) |
| `api_endpoints_phase_3.md` | API specification and workflow |
| This file | Phase 3 overview and documentation |

**Location:** `~/.local/video-orchestrator/worker/ab_test_manager.py`

## Manual Workflow (Phase 3)

1. **After thumbnail job completes:**
   ```bash
   curl -X POST http://localhost:5000/api/video-orchestrator/ab-test/create \
     -H "Content-Type: application/json" \
     -d '{
       "video_id": "job-id",
       "variant_a_id": "variant-a-uuid",
       "variant_b_id": "variant-b-uuid"
     }'
   ```

2. **Day 6 evening (manually count from YouTube Analytics):**
   ```bash
   curl -X POST http://localhost:5000/api/video-orchestrator/ab-test/{test_id}/slice-a \
     -H "Content-Type: application/json" \
     -d '{
       "start_date": "2026-05-25",
       "end_date": "2026-05-31",
       "views": 5420,
       "clicks": 87,
       "ctr": 0.0161
     }'
   ```

3. **Day 7 morning (manually download and upload variant B):**
   - Download `variant_b.jpg` from S3
   - Go to YouTube Creator Studio
   - Upload as thumbnail for the video
   - Call switch endpoint:
   ```bash
   curl -X POST http://localhost:5000/api/video-orchestrator/ab-test/{test_id}/switch-variant \
     -H "Content-Type: application/json" \
     -d '{"from": "a", "to": "b"}'
   ```

4. **Day 13 evening (manually count from YouTube Analytics):**
   ```bash
   curl -X POST http://localhost:5000/api/video-orchestrator/ab-test/{test_id}/slice-b \
     -H "Content-Type: application/json" \
     -d '{
       "start_date": "2026-06-01",
       "end_date": "2026-06-07",
       "views": 6100,
       "clicks": 102,
       "ctr": 0.0167
     }'
   ```

5. **Day 14+ (auto or manual winner):**
   - If auto-determined: system declares winner automatically
   - If manual override needed:
   ```bash
   curl -X POST http://localhost:5000/api/video-orchestrator/ab-test/{test_id}/declare-winner \
     -H "Content-Type: application/json" \
     -d '{
       "winner": "a",
       "reason": "Brand fit better",
       "decided_by": "manual_override"
     }'
   ```

## Future Automation (Phase 3.5+)

1. **YouTube Analytics Sync:** Automatic daily CTR fetch via YouTube API
2. **Auto Determination:** System auto-determines winner on day 13
3. **Thumbnail Automation:** Auto-upload variant B on day 7 via YouTube API
4. **Notifications:** Email/Slack when action needed (day 6/13 slice recording)
5. **Dashboard:** Real-time A/B test visualization

## Integration with Video Orchestrator Pipeline

### When A/B Test Starts

```
thumbnail job
  ↓
  Generates variant_a, variant_b
  ↓
  Upload variant_a to YouTube
  ↓
  POST /ab-test/create
  ↓
  test_id created in database
```

### When Winner Declared

```
declare-winner endpoint
  ↓
  Mark test complete
  ↓
  Store winning variant ID
  ↓
  Link result to video job
  ↓
  Available for future reference (ML training, etc.)
```

## Testing

See `test_phase_3_ab_testing.py` for comprehensive test suite (created with Phase 3).

## Next Steps

- [ ] Implement API endpoints (FastAPI/Flask)
- [ ] Wire into thumbnail job workflow (auto-create test on job complete)
- [ ] Add YouTube Analytics syncing (Phase 3.5)
- [ ] Build dashboard showing active A/B tests
- [ ] Implement notification system (email on day 6/13)

