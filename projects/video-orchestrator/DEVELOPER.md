# Video Orchestrator — Developer Guide

Cloud execution assets live under `cloud/`. Local runtime remains external at `~/.local/video-orchestrator/`.

## Architecture Overview

**Video Orchestrator** is a distributed job-queueing system for video generation. Jobs flow through sequential stages:

```
Input (audio + background)
    ↓
normalize (audio codec/sample-rate)
    ↓
subtitle (AI generates SRT, burns to frames)
    ↓
compose (combine audio + subtitles + background → MP4)
    ↓
thumbnail (AI designs 3 variants + A/B test setup)
    ↓
metadata (platform-specific captions for all 8 platforms)
    ↓
multi_post (dispatch to n8n webhooks → platform APIs)
```

**Key principle:** Jobs have explicit `depends_on` chains. Each stage reads outputs from the prior stage.

---

## Metadata Generation — Complete Reference

### Entry Point

```python
from metadata_generator import generate_metadata

artifact = generate_metadata(
    episode_title="Genesis — Noah Builds the Ark",
    transcript_excerpt="Noah spent 120 years...",
    target_platforms=["youtube_standard", "tiktok", "facebook", "pinterest"],
    series="Old Testament",
    duration_minutes=12.5,
)
```

### Returns: MetadataArtifact

```python
{
    "status": "completed",
    "generated_by": "ai-model-selector",
    "platforms": {
        "youtube_standard": {
            "title": "Genesis — Noah Builds the Ark",
            "description": "...",  # 4800 char max
            "tags": ["Bible", "Genesis", ...],  # 15 tags max
            "chapters": [
                {"time": "0:00", "title": "Introduction"},
                ...
            ],
            "hashtags": ["#Bible", "#Genesis", ...]
        },
        "tiktok": {
            "title": "Genesis — Noah Builds the Ark",
            "description": "...",  # 2200 char max, energetic tone
            "tags": [],
            "chapters": [],
            "hashtags": []
        },
        "facebook": {
            "title": "Genesis — Noah Builds the Ark",
            "description": "...",  # 500 char max, conversational
            "tags": [],
            "chapters": [],
            "hashtags": []
        },
        "pinterest": {
            "title": "Genesis — Noah Builds the Ark",
            "description": "...",  # 500 char max, evergreen intent
            "tags": [],
            "chapters": [],
            "hashtags": []
        }
    },
    "title_variants": [
        "Genesis — Noah Builds the Ark",
        "What Noah Really Endured for 120 Years",
        "The Flood: How One Man Saved Humanity",
        ...
    ],
    "completed_at": "2026-05-25T14:22:33Z"
}
```

---

## Supported Platforms

### YouTube (`youtube_standard`, `youtube_shorts`)

**Fields generated:**
- `title` — Original episode title (not modified)
- `description` — SEO-optimized, keyword-rich, max 4800 chars
- `tags` — 15 YouTube tags, mixed broad + niche terms
- `chapters` — 3–8 chapter markers with timestamps and titles
- `hashtags` — Top 5 tags converted to hashtags

**Prompt template:** `youtube_description`
- System: SEO expert for Bible study YouTube channel
- Focus: Discoverability, CTR, faith-based value proposition
- Includes: Chapter timestamps, 3–5 keywords, call-to-action, channel link

**Process:**
1. Generate description via LLM
2. Extract tags via LLM (JSON array)
3. Generate title variants via LLM (5 alternatives)
4. Generate chapters if duration > 5 minutes

---

### TikTok (`tiktok`)

**Fields generated:**
- `title` — Original episode title
- `description` — Hook-first, energetic, max 2200 chars
- `tags`, `chapters`, `hashtags` — Empty (TikTok uses description only)

**Prompt template:** `tiktok_caption`
- System: Content strategist for Bible education
- Tone: Punchy, energetic, hook-first, bite-sized truth
- Focus: Stop the scroll, watch until end, call-to-action

**Character limit:** 2200 chars (enforced via `_truncate_to_limit()`)

**Yeshua Academy voice:** Energetic, curious seekers + believers, educational

---

### Instagram (`instagram`)

**Fields generated:**
- `title` — Original episode title
- `description` — Visually-minded, emotionally resonant, max 2200 chars
- `tags`, `chapters`, `hashtags` — Empty

**Prompt template:** `instagram_caption`
- System: Faith-content creator for YeshuaAcademy.com
- Tone: Visual language, emotional connection, authentic Bible teaching
- Focus: Real-life faith application, call-to-action

**Character limit:** 2200 chars (enforced)

**Yeshua Academy voice:** Authentic, emotionally resonant, visually-minded community

---

### Facebook (`facebook`)

**Fields generated:**
- `title` — Original episode title
- `description` — Conversational, personal, max 500 chars
- `tags`, `chapters`, `hashtags` — Empty

**Prompt template:** `facebook_post`
- System: Community manager for YeshuaAcademy.com
- Tone: Personal, conversational, like sharing with friends
- Focus: Discussion, engagement, thought-provoking questions

**Character limit:** 500 chars (enforced)

**Yeshua Academy voice:** Community-focused, personal, discussion-oriented

---

### LinkedIn (`linkedin`)

**Fields generated:**
- `title` — Original episode title
- `description` — Professional, thought leadership, max 3000 chars
- `tags`, `chapters`, `hashtags` — Empty

**Prompt template:** `linkedin_post`
- System: Faith-and-work content strategist
- Tone: Professional, thought leadership, faith-to-work connection
- Focus: Leadership, integrity, purpose, workplace application

**Character limit:** 3000 chars (enforced)

**Yeshua Academy voice:** Faith-driven professionals, educators, leaders

---

### Bluesky (`bluesky`)

**Fields generated:**
- `title` — Original episode title
- `description` — Intellectual, substantive, max 300 chars
- `tags`, `chapters`, `hashtags` — Empty

**Prompt template:** `bluesky_post`
- System: Faith-content creator for authentic, intellectual discourse
- Tone: Thoughtful, thread-friendly, substantive (not sensational)
- Focus: Intellectual curiosity, quality over viral hooks

**Character limit:** 300 chars (enforced) — designed for thread-starter format

**Yeshua Academy voice:** Intellectually curious, quality discourse, authentic

---

### X (Twitter) (`x`, `twitter`)

**Fields generated:**
- `title` — Original episode title
- `description` — Bold, punchy, max 280 chars
- `tags`, `chapters`, `hashtags` — Empty

**Prompt template:** `x_post`
- System: Content strategist for X, reaching believers + skeptics + curious
- Tone: Pithy, bold, one strong idea, stop the scroll
- Focus: Every character earns its place, no fluff

**Character limit:** 280 chars (enforced) — classic Twitter length

**Yeshua Academy voice:** Bold, punchy, believers + skeptics + Bible-curious

---

### Pinterest (`pinterest`)

**Fields generated:**
- `title` — Original episode title
- `description` — Evergreen search intent, max 500 chars
- `tags`, `chapters`, `hashtags` — Empty

**Prompt template:** `pinterest_pin`
- System: Visual discovery strategist for evergreen Bible learning
- Tone: Clear, encouraging, searchable, discovery-oriented
- Focus: Practical takeaways, save-worthy content, learning encouragement

**Character limit:** 500 chars (enforced)

**Yeshua Academy voice:** Evergreen learning, practical takeaways, discovery-focused

---

## Character Limits and Truncation

### Defined Limits

```python
PLATFORM_CHAR_LIMITS = {
    "youtube": None,        # No hard limit (4800 in description template)
    "tiktok": 2200,
    "instagram": 2200,
    "facebook": 500,
    "linkedin": 3000,
    "bluesky": 300,
    "x": 280,
    "pinterest": 500,
}
```

### How Truncation Works

```python
def _truncate_to_limit(text: str, platform_key: str, platform_limits: dict[str, int] | None = None) -> str:
    limits = platform_limits or _load_platform_max_descriptions()
    canonical_platform = platform_key.split("_", 1)[0]  # "youtube_standard" → "youtube"
    limit = limits.get(canonical_platform)
    configured_default = PLATFORM_CHAR_LIMITS.get(canonical_platform)
    
    # Use the smaller of: platform-specs.json max OR PLATFORM_CHAR_LIMITS
    if configured_default is not None and (limit is None or int(limit) > configured_default):
        limit = configured_default
    
    if limit is None:
        return text
    
    return _truncate_with_ellipsis(text, int(limit))

def _truncate_with_ellipsis(text: str, max_len: int) -> str:
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text
```

**Behavior:**
- Reads platform limits from `~/.config/video-orchestrator/platform-specs.json`
- Compares against `PLATFORM_CHAR_LIMITS` dict
- Uses the stricter limit
- Appends "..." if text is truncated
- Returns full text if no limit exists (YouTube)

---

## AI Model Routing

All LLM calls route through **AI Model Selector** (localhost:4890).

### How It Works

```python
def _call_llm(prompt_key: str, variables: dict[str, str], input_tokens: int = 3000) -> str:
    prompts = _load_prompts()
    template = prompts[prompt_key]
    system_msg = template["system"]
    user_msg = template["user"].format_map(variables)
    
    # Route through AI Model Selector
    routing = select_ai("metadata_generation", input_tokens=input_tokens, urgent=False)
    provider_id = routing["provider_id"]
    
    # Call via OpenAI-compatible endpoint
    client = openai.OpenAI(
        base_url=routing["base_url"],
        api_key=routing["api_key"] or "local",
        timeout=routing.get("timeout_inference_sec", 30),
    )
    response = client.chat.completions.create(
        model=routing["model"],
        messages=[...],
        temperature=0.7,
        max_tokens=1500,
    )
    report_ai_success(provider_id)
    return response.choices[0].message.content or ""
```

**Routing logic:**
1. Call `select_ai("metadata_generation", input_tokens=3000, urgent=False)`
2. Model Selector returns: base_url, api_key, model, provider_id
3. Use OpenAI-compatible client to call the routed model
4. Report success/failure to Model Selector for learning

**Fallback chain:** Gemini Flash → Claude Sonnet → Codex → bash

---

## Adding a New Platform

### Step 1: Add to `platform-specs.json`

```json
{
  "platform": "threads",
  "description_rules": {"max_length": 500},
  "hashtag_rules": {"max_tags": 10},
  "adapter": "n8n",
  "n8n_webhook_path": "video-orchestrator-post/threads",
  "adapter_status": "manual_only"
}
```

### Step 2: Add Prompt Template to `metadata-prompts.json`

```json
{
  "threads_caption": {
    "system": "You are a content creator for Threads, Meta's text-based social network...",
    "user": "Generate a Threads post for:\n\nTitle: {episode_title}\n...\n\nRequirements:\n- Max 500 characters\n- Include 3-5 hashtags\n- Tone: conversational, engaging\n\nReturn ONLY the post text."
  }
}
```

### Step 3: Add Generator Function to `metadata_generator.py`

```python
def _generate_threads_caption(episode_title: str, transcript_excerpt: str, series: str) -> str:
    return _generate_platform_copy("threads_caption", episode_title, transcript_excerpt, series)
```

### Step 4: Add Platform Handler in `generate_metadata()`

```python
elif "threads" in platform_key:
    description = _generate_threads_caption(episode_title, transcript_excerpt, series)
    generated_by = generated_by or "ai-model-selector"
    platforms[platform_key] = PlatformMetadata(
        title=episode_title,
        description=_truncate_to_limit(description, platform_key, platform_max_desc),
        tags=[],
        chapters=[],
        hashtags=[],
    )
```

### Step 5: Add Character Limit to `PLATFORM_CHAR_LIMITS`

```python
PLATFORM_CHAR_LIMITS = {
    ...
    "threads": 500,
}
```

### Step 6: Create n8n Workflow Stub

File: `~/.local/video-orchestrator/n8n/workflows/threads-post.json`

```json
{
  "name": "Threads Video Post",
  "nodes": [
    {
      "name": "Webhook",
      "type": "webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "threads-webhook",
      "webhookPath": "video-orchestrator-post/threads"
    },
    {
      "name": "HTTP Request",
      "type": "http",
      "typeVersion": 4.1,
      "position": [450, 300],
      "parameters": {
        "method": "POST",
        "url": "https://graph.threads.net/{{$env.THREADS_API_VERSION}}/me/threads",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "threadsApi",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {"name": "media_type", "value": "TEXT"},
            {"name": "text", "value": "={{$node.Webhook.json.caption}}"}
          ]
        }
      }
    }
  ]
}
```

---

## Testing Metadata Generation

### Unit Test

```python
import pytest
from metadata_generator import generate_metadata

def test_all_platforms_generate_metadata():
    """Verify all 8 platforms produce metadata without errors."""
    platforms = ["youtube_standard", "tiktok", "instagram", "facebook", "linkedin", "bluesky", "x", "pinterest"]
    artifact = generate_metadata(
        episode_title="Test Episode",
        transcript_excerpt="Test content...",
        target_platforms=platforms,
        series="Test Series",
        duration_minutes=10.0,
    )
    
    assert artifact.status == "completed"
    assert len(artifact.platforms) == 8
    for platform in platforms:
        assert platform in artifact.platforms
        meta = artifact.platforms[platform]
        assert meta.title == "Test Episode"
        assert len(meta.description) > 0

def test_character_limits_enforced():
    """Verify truncation enforces platform character limits."""
    artifact = generate_metadata(
        episode_title="Test",
        transcript_excerpt="x" * 5000,  # Very long input
        target_platforms=["tiktok", "facebook", "x"],
        series="Test",
    )
    
    assert len(artifact.platforms["tiktok"].description) <= 2203  # 2200 + "..."
    assert len(artifact.platforms["facebook"].description) <= 503  # 500 + "..."
    assert len(artifact.platforms["x"].description) <= 283  # 280 + "..."
```

### Integration Test

```python
def test_metadata_generation_via_api():
    """Test metadata generation through job queue API."""
    response = requests.post(
        "http://localhost:5000/api/video-orchestrator/queue/metadata",
        json={
            "episodeId": "test-001",
            "taskConfig": {
                "episode_title": "Genesis — Noah",
                "transcript_excerpt": "Noah spent 120 years...",
                "target_platforms": ["youtube_standard", "pinterest"],
                "series": "Old Testament",
            }
        }
    )
    
    assert response.status_code == 200
    job_id = response.json()["jobId"]
    
    # Poll for completion
    for _ in range(60):
        result = requests.get(f"http://localhost:5000/api/video-orchestrator/jobs/{job_id}")
        if result.json()["status"] == "completed":
            artifact = result.json()["artifact"]
            assert "youtube_standard" in artifact["platforms"]
            assert "pinterest" in artifact["platforms"]
            break
        time.sleep(1)
```

---

## Configuration Files Reference

### `~/.config/video-orchestrator/platform-specs.json`

Complete platform specifications: API endpoints, capabilities, constraints.

**Structure:**
```json
{
  "platforms": [
    {
      "platform": "youtube",
      "description_rules": {"max_length": 4800},
      "hashtag_rules": {"max_tags": 15},
      "thumbnail": {"width": 1280, "height": 720, "aspect_ratio": "16:9"},
      "adapter": "n8n",
      "n8n_webhook_path": "video-orchestrator-post/youtube",
      "adapter_status": "active"
    },
    ...
  ]
}
```

### `~/.config/video-orchestrator/metadata-prompts.json`

LLM prompt templates for each platform.

**Structure:**
```json
{
  "platform_caption": {
    "system": "System prompt setting context and role...",
    "user": "User prompt template with {variables}..."
  },
  ...
}
```

### Environment Variables

```bash
PLATFORM_SPECS_PATH=~/.config/video-orchestrator/platform-specs.json
METADATA_PROMPTS_PATH=~/.config/video-orchestrator/metadata-prompts.json
VO_DB_HOST=127.0.0.1
VO_DB_PORT=5450
VO_DB_NAME=video_orchestrator
VO_DB_USER=postgres
VO_DB_PASS=postgres
```

---

## Troubleshooting

### LLM Call Fails

**Symptom:** `report_ai_failure()` logged

**Cause:** Model Selector not responding or provider API down

**Fix:**
1. Check localhost:4890: `curl http://localhost:4890/health`
2. Check logs: `tail -f ~/.local/video-orchestrator/logs/ai-selector.log`
3. Verify API keys are set in Model Selector config

### Character Limit Not Enforced

**Symptom:** Generated description exceeds platform max

**Cause:** Platform not in `PLATFORM_CHAR_LIMITS` dict or `platform-specs.json`

**Fix:**
1. Add platform to `PLATFORM_CHAR_LIMITS`
2. Run tests: `pytest test_worker.py::test_character_limits_enforced`

### Missing Platform Prompt

**Symptom:** KeyError when generating metadata

**Cause:** Prompt template missing from `metadata-prompts.json`

**Fix:**
1. Add prompt template to `metadata-prompts.json`
2. Verify key matches platform handler in `generate_metadata()`

---

## Key Files

| File | Purpose |
|------|---------|
| `metadata_generator.py` | Core metadata generation logic |
| `~/.config/video-orchestrator/platform-specs.json` | Platform capabilities + constraints |
| `~/.config/video-orchestrator/metadata-prompts.json` | LLM prompt templates (Yeshua Academy voice) |
| `~/.local/video-orchestrator/tests/test_worker.py` | Unit & integration tests |
| `~/.local/video-orchestrator/n8n/workflows/*.json` | Platform posting workflows |

---

## Next Steps

1. **Phase 6 (current):** Complete n8n workflow stubs for 4 priority platforms
2. **Phase 6:** Extend `vo queue pipeline` CLI command
3. **Phase 6:** Add comprehensive tests
4. **Phase 3:** Implement A/B testing infrastructure
5. **Rebuild Thumbnail Studio:** As modular, scalable component
