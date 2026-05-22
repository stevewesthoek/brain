# Video Orchestrator — Strategy

**Document type:** Architecture strategy and guardrails  
**Status:** Active  
**Last updated:** 2026-05-22  
**Platform architecture:** `brain/docs/platform-architecture.md`  
**Research validated:** NotebookLM research report `/tmp/vo-research-report.md` (2026-05-22)

---

## Purpose

The Video Orchestrator (VO) is the production system that takes source content (audio + script) and produces fully-packaged, platform-ready video posts — with thumbnails, descriptions, captions, and all metadata — and publishes them automatically across every platform.

It is not a port of the STB pipeline. It is a platform-agnostic, format-agnostic, modular production engine. The STB pipeline is a **feature reference** — it shows what the VO needs to *do*, not how to build it.

---

## Hard Guardrails

These are non-negotiable. Any implementation decision that violates a guardrail requires a strategy revision first.

1. **Platform-agnostic** — No platform name appears in module logic. Platform constraints are data (config), not code. Adding YouTube Shorts, Pinterest, or any future platform requires zero code changes — only a new record in `platforms.json`.

2. **Format-agnostic** — No aspect ratio, resolution, or codec is hardcoded. All format specs are read from config at runtime.

3. **Fully modular** — Each capability (composition, subtitles, thumbnails, SEO metadata, publishing) is an independently deployable and updatable module. Modules communicate only through the job artifact schema. No module calls another module directly.

4. **Standardized contracts** — Every module reads a job artifact JSON and writes back to its own section. The schema is the API. No out-of-band communication between modules.

5. **Normalized storage** — All output paths in the job artifact are absolute. All timestamps are ISO-8601 UTC. All module status fields use the same vocabulary: `pending | in_progress | completed | failed | skipped`.

6. **Idempotent stages** — Every module checks whether its work is already done (status: completed in the artifact) before running. Re-running a job from any stage must be safe.

7. **Observable** — Every module writes structured logs and updates the artifact status. The Brain Console shows live status for every module in every job. No black boxes.

8. **Human approval gate** — Metadata and thumbnails are never published automatically. Both must be explicitly approved in Brain Console before upload. The worker holds at `status: pending_approval` until approval is recorded. No exception.

9. **Manual fallback always exists** — Every completed job produces a self-contained Manual Fallback Package: a directory with final video files (absolute paths), SRT/VTT subtitles, and a JSON block of all platform metadata. A human can upload manually from this package with zero system involvement if all automation fails.

10. **Local AI first** — All AI generation tasks (metadata, thumbnails, summaries) route through the AI Model Selector. Local Ollama models on the Mac Mini M4 Pro and MacBook M1 are always tried first when they are capable enough for the task. Codex CLI is the second tier because it uses the ChatGPT subscription surface rather than a direct API bill. Amazon Bedrock Claude is the third tier and is used only when local AI and Codex CLI are unavailable, rate-limited, or insufficient for quality. Direct OpenAI API and direct Anthropic API calls are forbidden.

---

## What the VO Produces

For every piece of source content, the VO produces a **video package** — a job artifact (JSON) + a set of files:

| Output | Description |
|--------|-------------|
| Composed video | Audio + background image/video → video file per platform format |
| Normalized audio | Loudness-normalized audio at -14 LUFS (broadcast standard) |
| Subtitles | SRT + VTT files generated from source audio |
| Thumbnails | 1-3 design variants per platform, with text overlay |
| Metadata | Platform-specific title, description, tags, chapters |
| Manual Fallback Package | Self-contained dir: final video paths + SRT/VTT + platform metadata JSON. Human-uploadable with no system involvement. |
| Instructions package | Complete posting spec (used for n8n dispatch or manual fallback) |

---

## System Architecture

### The job artifact as the data contract

Every video job has one JSON artifact. It grows as the job progresses through stages. Every module reads the artifact, does its work, and writes back to its section. No module talks to another module — they all communicate through the artifact.

```
source audio + script
        │
        ▼
┌──────────────┐
│  Audio Norm  │  → writes artifact.audio
└──────────────┘
        │
        ▼
┌──────────────┐
│  Composition │  → writes artifact.composition (per platform format)
└──────────────┘
        │
        ▼
┌──────────────┐
│   Subtitles  │  → writes artifact.subtitles (SRT + VTT from source audio)
└──────────────┘
        │
        ▼
┌──────────────┐
│  Thumbnails  │  → writes artifact.thumbnail (variants per platform)
└──────────────┘
        │
        ▼
┌──────────────┐
│   SEO / Meta │  → writes artifact.metadata (per platform title/desc/tags)
└──────────────┘
        │
        ▼
┌──────────────┐
│  Publishing  │  → writes artifact.publishing (platform video IDs + URLs)
└──────────────┘
        │
        ▼
┌──────────────┐
│  Analytics   │  → writes artifact.analytics (nightly fetch, feedback loop)
└──────────────┘
```

### Platform specs as config

```json
// ~/.config/video-orchestrator/platform-specs.json
{
  "youtube_standard": {
    "container": "mp4", "video_codec": "libx264", "audio_codec": "aac",
    "width": 1920, "height": 1080, "aspect_ratio": "16:9",
    "max_duration_sec": null, "target_bitrate_kbps": 8000,
    "thumbnail": { "width": 1280, "height": 720, "format": "jpg" }
  },
  "youtube_shorts": {
    "width": 1080, "height": 1920, "aspect_ratio": "9:16",
    "max_duration_sec": 180, "target_bitrate_kbps": 4000
  },
  "instagram_reels": { ... },
  "tiktok": { ... }
}
```

---

## Modules

### 0. AI Model Selector
- Standalone Python HTTP microservice at `localhost:4890`
- All VO modules call it for every AI generation task — never call LLM APIs directly
- Provider registry: `~/.config/video-orchestrator/ai-providers.json` (config-driven, no code changes to add a provider)
- Escalation order: local Ollama M4 Pro/M1 → Codex CLI → Amazon Bedrock Claude
- Local model preference: M4 Pro prefers `qwen2.5:32b`, then `qwen2.5:14b`, then fast fallback models. M1 prefers `qwen2.5:14b`, then `llama3.1:8b`, then `llama3.2:3b`.
- Batch window (1-7 AM): strongly prefer local. Outside window: use local when quality is adequate; use Codex CLI for tasks local models cannot do reliably.
- Non-urgent tasks outside batch window can be deferred to next batch window (`scheduled_after` in job DB)
- Rate limits tracked in-memory + persisted to JSON; exponential backoff per provider
- Audit log: every selection logged to `~/.local/video-orchestrator/logs/ai-selections.jsonl`
- CLI: `ai-select --task <type>` — usable from Claude Code, Codex, Gemini, and VO worker
- **This module must exist before any AI-dependent module is built**

### 0A. Brain Agent Orchestrator
- Shared Brain Core layer above the VO and above the AI Model Selector
- Owns multi-step agent-mode planning, task decomposition, run ledger, event log, handoffs, approval gates, capability registry, and worker coordination
- Uses the AI Model Selector for every LLM execution decision; it does not duplicate model routing logic
- Uses orchestration skills as capabilities: `/code`, `/design`, `/research`, `/web`, `/video`
- Uses CLI capabilities through registered adapters and runbooks: Cloudflare, Dokploy, AWS, Azure, GCP, Hetzner, Tailscale, Stripe, n8n, GitHub, and other approved infrastructure CLIs
- Starts read-only: capability discovery, planning, run tracking, and status surfaces first. File writes, commits, pushes, deploys, DNS changes, database mutations, and credential-sensitive operations require explicit approval.
- Research basis: `agent-orchestrator-research-2026-05-22.md`

### 1. Audio Normalization
- Normalizes audio to -14 LUFS (YouTube/Spotify standard)
- Peak ceiling: -1.0 dBFS
- Output: normalized MP3/AAC at 44.1kHz
- Tool: FFmpeg `loudnorm` filter

### 2. Composition
- Composites audio track onto background (static image or looping video)
- Reads platform spec → produces one video file per target platform format
- Input: normalized audio + background asset
- Output: composed video per platform format
- Tool: FFmpeg with filtergraph per platform spec
- Optional: LoRA model generated background frames

### 3. Subtitle Generation
- Runs on source audio (not composed video) — decoupled from composition
- Produces SRT and VTT files
- Optionally burns subtitles into composed video as a separate artifact variant
- **GPU path:** `large-v3` model (FP16) — maximum accuracy, handles theological proper nouns
- **CPU path:** `distil-large-v3` with `int8` quantization — high-speed local processing without GPU
- **VAD config for Bible/oratorical content**: set `min_silence_duration_ms=3500` — dramatic pauses in narration must not be treated as stream end. Use Silero VAD.
- YouTube API cost: `captions.insert` = 400 quota units. Daily quota = 10,000 units. Night scheduler must track budget.

### 4. Thumbnail Generation
- Reads thumbnail templates (JSON design system)
- Generates background image (screenshot, model-generated, or solid)
- Composites text overlay using brand typography system
- Produces 1-3 variants per video for A/B testing
- Tool: Pillow (Python) + brand design system JSON
- A/B test: YouTube native Test and Compare (when eligible); manual rotation otherwise

### 5. SEO Metadata Generation
- Reads transcript + channel performance context
- Generates platform-specific: title, description, tags, chapters
- Respects per-platform constraints (title length, description length, hashtag rules)
- Tool: LLM via AI Model Selector — local Ollama M4/M1 first → Codex CLI → Amazon Bedrock Claude
- **Analytics-informed prompting**: before each generation, queries top 10 videos by CTR from `performance_metrics` and injects their titles as `{top_performing_titles}` into the prompt — continuous feedback loop
- **Faith-based prompt template structure**: `{series}`, `{episode_title}`, `{transcript}`, `{top_performing_titles}` → title (under 70 chars, curiosity-driven) + description (hook + chapters at top for search visibility) + 15-20 tags
- Output: stored in job artifact, manually reviewable before publishing

### 6. Publishing
- Reads job artifact (video paths + metadata per platform)
- Direct upload for YouTube (OAuth2 via `youtube_uploader.py`)
- n8n webhook dispatch for other platforms
- Manual fallback: generates instructions package
- Updates artifact with platform video IDs and URLs on success

### 7. Analytics Sync
- Nightly scheduler fetches analytics for all published videos
- **Preferred API:** YouTube Reporting API `jobs.reports.list()` (bulk daily export, 1 quota unit) — not per-video query (expensive). Create a reporting job once; fetch nightly CSV.
- Writes metrics back to job artifact and to `performance_metrics` Postgres table
- Feeds performance context to Metadata Generation module (`{top_performing_titles}` injection)
- **A/B winner declaration:** When a video exceeds 300 impressions threshold, compare CTR between variants; automatically set winner via `thumbnails.set` (50 quota units)
- **Data hygiene:** Purge local FFmpeg render cache for jobs older than 30 days; archive Job Artifact JSON (never delete)

---

## STB Pipeline — Feature Reference

The STB pipeline has these features the VO must eventually support:

| STB Feature | VO Module | Status |
|-------------|-----------|--------|
| Audio mixer (narration track) | Composition | ⏳ partial — normalize done, no composition |
| Thumbnail design studio | Thumbnail Generation | ❌ not built |
| Text overlay studio (5 platforms) | Thumbnail Generation | ❌ not built |
| SEO strategy / description generator | SEO Metadata | ❌ not built |
| Multi-platform thumbnail variants | Thumbnail Generation | ❌ not built |
| Subtitle/caption generation | Subtitle Generation | ❌ not built |
| YouTube direct upload (OAuth) | Publishing | ✅ done |
| n8n dispatch fallback | Publishing | ✅ done |
| Analytics feedback | Analytics Sync | ⏳ partial schema only |

**What VO does better than STB:**
- Platform-agnostic (STB is hardcoded to STB project)
- Multi-account per platform (STB is single account)
- Job queue with retry, dead-letter, and monitoring
- OAuth persistence (keychain) vs STB's session-based approach
- Brain Console visibility for every job and credential

---

## What the Brain Console Shows

The VO view in Brain Console should display, for each account:

- **Job queue** — pending, running, succeeded, failed jobs with status chips
- **Per-job module status** — which stages completed for each job (composition, subtitles, thumbnail, metadata, publishing, analytics)
- **Platform credential status** — which accounts are connected (green) vs need attention (red)
- **Analytics** — CTR, views, avg view duration for recent published videos
- **Thumbnail A/B test status** — active tests, current winner

Each module card in the VO view is independently expandable, independently updated via credBus (no full page refresh).

---

## What We Are Not Building

- A SaaS platform (no multi-tenant, no billing, no user accounts beyond Steve's accounts)
- A video editing tool (no timeline, no cuts, no effects beyond what FFmpeg filtergraph provides)
- A CMS (content lives in the project repo / vault, not in VO)
- A replacement for manual creative judgment on thumbnails and titles (VO generates candidates; human approves)

---

## YouTube API Quota Budget

Daily quota: **10,000 units**. Must never be exhausted during batch runs.

| Operation | Units | Notes |
|-----------|-------|-------|
| `videos.insert` (upload) | 1,600 | Per video upload |
| `captions.insert` | 400 | Per subtitle track |
| `thumbnails.set` | 50 | Per thumbnail set |
| `videos.update` (metadata) | 50 | Per metadata update |
| `analyticsReports.query` | 1 | Per analytics fetch |

**Batch run budget (1 video, all modules):** ~2,100 units  
**Safe daily batch capacity:** ~4 complete videos before quota exhaustion  
The night scheduler must check remaining quota before queuing API operations and defer to the next day if budget is insufficient.

---

## Platform Architecture

The VO is a consumer of the shared platform services catalog. See `brain/docs/platform-architecture.md` for the full scaffold standard that all projects inherit.

**Key principle:** The VO never owns AI routing logic. It calls `POST localhost:4890/select` for every AI task. The AI Model Selector owns: provider selection, rate limits, health checks, batch window scheduling, cost tracking, audit logging.

---

## Known Tech Debt

| Item | Location | Impact | Priority | Status |
|------|----------|--------|----------|--------|
| Platform-specific `if platform == "youtube"` in worker | `video_worker.py` | Violates Hard Guardrail #1 | Critical | ✅ Fixed 2026-05-22 |
| `scheduled_after` column missing from jobs table | Postgres schema | Cannot defer jobs to batch window | High | ✅ Fixed 2026-05-22 |
| `approval_status` column missing from jobs table | Postgres schema | No approval gate enforcement | High | ✅ Fixed 2026-05-22 |
| `performance_metrics` has no `job_id` column | Postgres schema | Analytics join requires video_id workaround | Medium | Workaround in place |
| No approval gate in current worker flow | `video_worker.py` | Metadata + thumbnails publish without human review | High | DB column added; UI approval button not yet built |
| YouTube Reporting API not yet used | `analytics_sync.py` | Using per-video queries instead of bulk daily reports | Low | Phase 5 item |
| FFmpeg render cache never purged | Worker/scheduler | Disk usage grows unbounded | Low | Phase 7 item |
