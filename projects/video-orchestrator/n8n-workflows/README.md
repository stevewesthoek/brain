# n8n Workflows — Video Orchestrator Multi-Platform Posting

Production-ready n8n workflow JSON files for posting to YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, and Pinterest.

## Files

| File | Platform | Purpose |
|------|----------|---------|
| `facebook-video-post.json` | Facebook | Post videos to Facebook pages |
| `tiktok-video-post.json` | TikTok | Post videos to TikTok accounts |
| `instagram-reels-post.json` | Instagram | Post video Reels |
| `pinterest-pin-post.json` | Pinterest | Create and post pins |

**Location:** `~/.local/video-orchestrator/n8n/workflows/`

## Quick Start

### 1. Import into n8n
```bash
# Access n8n UI at http://localhost:5005
# Click "New Workflow" → Import from file
# Select a workflow JSON file
```

### 2. Configure Credentials
- Click the workflow node that requires credentials
- Select or create the credential type for that platform
- Paste API token (get from platform developer console)

### 3. Verify Webhook Path
- Open workflow
- Click "Webhook Trigger" node
- Note the full webhook URL
- Update `~/.config/video-orchestrator/platform-specs.json` with the URL

### 4. Activate
- Click "Active: on" toggle
- Workflow is now listening for webhooks

## Workflow Architecture

All workflows follow the same pattern:

```
Webhook Trigger (receives metadata)
    ↓
Platform API Request (post video/pin)
    ↓
Error Check (if status != 200/201)
    ↓
Report Success OR Report Error
    ↓
POST back to video-orchestrator webhook completion API
```

## Integration with Video Orchestrator

### Data Flow

1. **Metadata job generates captions** (metadata_generator.py)
   - Calls AI Model Selector (Gemini → Claude → Codex)
   - Produces MetadataArtifact with all platform-specific copies

2. **Multi-post job queues n8n webhooks** (multi_post dispatcher)
   - For each platform in target_platforms list
   - Sends: jobId, platform metadata, video URL, account credentials

3. **n8n workflow processes request**
   - Receives webhook with platform metadata
   - Posts to platform API
   - Reports completion back to video-orchestrator

4. **Video orchestrator records result**
   - Stores post URL in database
   - Updates job status to "completed"
   - Logs any errors for retry

## Webhook Payloads

### Facebook
```json
{
  "jobId": "job-uuid",
  "pageId": "FACEBOOK_PAGE_ID",
  "description": "Generated post (500 char max)",
  "videoUrl": "s3://brain-media/video.mp4"
}
```

### TikTok
```json
{
  "jobId": "job-uuid",
  "videoUrl": "s3://brain-media/video.mp4",
  "description": "Generated caption (2200 char max)",
  "tikTokHandle": "@yeshuaacademy"
}
```

### Instagram
```json
{
  "jobId": "job-uuid",
  "instagramBusinessAccountId": "IG_ACCOUNT_ID",
  "videoUrl": "s3://brain-media/video.mp4",
  "description": "Generated caption (2200 char max)"
}
```

### Pinterest
```json
{
  "jobId": "job-uuid",
  "pinterestBoardId": "BOARD_ID",
  "title": "Generated title",
  "description": "Generated description (500 char max)",
  "landingUrl": "https://yeshuaacademy.com/...",
  "thumbnailUrl": "s3://brain-media/thumbnail.png"
}
```

## Completion Webhook

All workflows report back to:
```
POST http://localhost:5000/api/video-orchestrator/webhook/completion
```

**Success:**
```json
{
  "jobId": "job-uuid",
  "platform": "facebook",
  "status": "success",
  "postId": "FACEBOOK_POST_ID",
  "url": "https://facebook.com/...",
  "timestamp": "2026-05-25T14:22:33Z"
}
```

**Error:**
```json
{
  "jobId": "job-uuid",
  "platform": "facebook",
  "status": "error",
  "error": "API error message",
  "timestamp": "2026-05-25T14:22:33Z"
}
```

## Configuration

Each workflow must be configured in `~/.config/video-orchestrator/platform-specs.json`:

```json
{
  "platform": "facebook",
  "n8n_webhook_path": "video-orchestrator-post/facebook",
  "n8n_webhook_full_url": "http://localhost:5005/webhook/video-orchestrator-post/facebook",
  "adapter": "n8n",
  "adapter_status": "active"
}
```

## Testing

### Test Facebook Workflow
```bash
curl -X POST http://localhost:5005/webhook/video-orchestrator-post/facebook \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-001",
    "pageId": "YOUR_PAGE_ID",
    "description": "Test post",
    "videoUrl": "https://example.com/test.mp4"
  }'
```

Expect response:
```json
{"data": {"jobId": "test-001", "platform": "facebook", "status": "success"}}
```

## Credentials Setup

### Facebook
1. Go to Facebook App Dashboard
2. Create app (Business type)
3. Add "Pages" product
4. Generate Page Access Token
5. Required scopes: `pages_manage_posts`, `pages_read_engagement`

### TikTok
1. Register TikTok Developer account
2. Create app
3. Request OAuth 2.0 token
4. Required scopes: `video.upload`

### Instagram
1. Create Instagram Business Account
2. Link to Meta Business
3. Generate access token via Graph API
4. Required scopes: `instagram_graph_api_basic`, `instagram_graph_api_write`

### Pinterest
1. Create Pinterest Developer account
2. Create app
3. Generate OAuth token
4. Required scopes: `pins:write`, `boards:read`

## Troubleshooting

**Webhook not triggering?**
- Verify workflow "Active: on"
- Check n8n logs: `docker logs n8n`
- Test with curl (see Testing section)

**API authentication fails?**
- Verify token is not expired
- Check scopes match requirements
- Regenerate token if needed

**Missing fields?**
- Review webhook payload structure above
- Verify multi_post job sends all required fields
- Add missing fields to dispatcher if needed

## Next Steps

1. ✅ Create workflow JSON stubs (4 priority platforms)
2. ⏳ Extend `vo queue pipeline` CLI command
3. ⏳ Add Python tests for multi-platform output
4. ⏳ Verify multi_post dispatcher queues webhooks correctly
5. ⏳ Test end-to-end: video → metadata → multi-post → platform
