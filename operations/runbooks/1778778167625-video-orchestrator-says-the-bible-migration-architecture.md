# Video Orchestrator / Says the Bible Migration Architecture Decision

**Status:** adopted for roadmap planning  
**Decision date:** 2026-05-14  
**Current execution pause point:** VO-7BV complete; Option D not started  
**Legacy repo inspected:** `says-the-bible` read-only  
**Legacy repo mutation allowed now:** false  
**Brain repo mutation allowed now:** documentation/planning only until roadmap is updated  

## Decision

The Video Orchestrator becomes the long-term unified production house for all projects, all platforms, and all project/platform accounts.

The existing Says the Bible pipeline remains unchanged and operational while the Video Orchestrator is built beside it. The Video Orchestrator should learn from the Says the Bible pipeline and absorb its proven YouTube concepts into a modular, project-agnostic architecture, but it should not copy project-specific assumptions or mutate the Says the Bible repo during this phase.

In the future, Says the Bible should migrate onto the Video Orchestrator as one project/account configuration inside the shared orchestration system. Until then, two pipelines coexist:

1. Existing legacy pipeline: Says the Bible production pipeline.
2. New canonical pipeline: Brain / ProBot Video Orchestrator.

## Architectural rule

Do not create redundant long-term upload pipelines.

Short-term duplication is acceptable only as a controlled migration bridge. Any new upload work in Video Orchestrator must be designed as reusable platform infrastructure, not as a Says-the-Bible-specific clone.

## Legacy repo observations from read-only inspection

The Says the Bible repo contains a working YouTube-related pipeline surface, including:

- `scripts/pipeline/04-upload-youtube.mjs` — YouTube upload step.
- `scripts/pipeline/setup-youtube-auth.mjs` — YouTube OAuth setup helper.
- `scripts/pipeline/sync-youtube-db.mjs` — YouTube/DB sync utility.
- `scripts/pipeline/youtube-sync-templates.mjs` — YouTube thumbnail/template sync utility.
- `docs/features/stb-pipeline-end-to-end.md` — end-to-end pipeline documentation.
- `docs/features/pipeline-control-tower.md` — control tower documentation.
- `docs/features/pipeline.md` — pipeline documentation.
- `docs/features/social/YOUTUBE_API_INTEGRATION_STRATEGY.md` — YouTube integration strategy.
- `.env.example` — environment template surface.
- `production/output/**` — project-specific rendered output folders and YouTube metadata artifacts.

These are evidence that Says the Bible already has working YouTube operational patterns. They should inform Video Orchestrator, but the legacy repo remains unchanged.

## Target architecture

Video Orchestrator should provide one canonical pipeline with these abstractions:

### Project

A project is a production unit such as Says the Bible, Via di Eden, or another content brand.

A project can have:

- Shared render/media assets.
- Shared metadata templates.
- Multiple platforms.
- Multiple accounts per platform.
- Platform-specific schedules and limits.
- Reuse policy for generated videos, thumbnails, overlays, captions, descriptions, and metadata.

### Platform account

A platform account is one authenticated destination for one project on one platform.

Examples:

- Project: Says the Bible; Platform: YouTube; Account: main channel.
- Project: Says the Bible; Platform: Pinterest; Account: main board account.
- Project: another project; Platform: YouTube; Account: second channel.

A platform account should store safe metadata in the application database and secret references outside normal source files. The UI should present a visual account management surface.

### Credentials and OAuth

The preferred experience is true OAuth through the ProBot dashboard:

- User clicks Connect for a platform account.
- ProBot sends the user through the platform OAuth flow.
- ProBot receives the callback.
- ProBot stores token material through a secret-safe mechanism.
- The UI shows connection status without exposing raw tokens.

If a platform requires manual app/API-key creation, the UI should provide:

- A deep link to the platform developer console.
- A short checklist for what to create.
- The required redirect URI.
- Which values must be pasted into the secure UI.
- Validation status after connection.

The UI may write environment variables only through a controlled secret-management layer. It must not expose secrets in logs, docs, git, chat output, or generated artifacts.

### Media boundary clarified

A media boundary means the exact set of generated files the uploader is allowed to read.

Example:

- Allowed: `generated-assets/project-001/render-plan-abc/final-video.mp4`
- Allowed: `generated-assets/project-001/render-plan-abc/thumbnail.jpg`
- Not allowed: arbitrary filesystem reads, unrelated project folders, home directory files, `.env`, tokens, or private config.

The long-term goal is to generate media once and reuse it across many platforms when possible. Platform-specific transforms should happen only when required by format, policy, aspect ratio, duration, metadata, caption, or thumbnail constraints.

### Network/platform API boundary clarified

A network/platform API boundary means the exact external platform operation the uploader is allowed to perform.

Example for a first controlled YouTube preflight:

- Allowed later after explicit approval: verify account/channel identity using YouTube Data API.
- Allowed later after explicit approval: upload one scheduled/private test video through the YouTube API.
- Not allowed by default: arbitrary outbound requests, multi-upload loops, mass updates, deleting videos, changing unrelated metadata, or reading unrelated channel data.

### Scheduling default

The preferred default publish mode is scheduled when supported by the platform. If scheduling is not supported or not implemented safely, fallback should be private/draft where available.

For YouTube, the architecture should support scheduled publication as the preferred target, but the first implementation should begin with preflight and disabled/no-op layers before any real `videos.insert` call.

### Resume and rate-limit strategy

The Video Orchestrator should include a platform policy and resume layer:

- Per-platform posting frequency rules.
- Per-account daily/rolling quota limits.
- Backoff after rate limits.
- Resume after next scheduled job when blocked by quota/window/rate limits.
- Idempotency keys for upload attempts.
- Upload state machine: planned, preflighted, queued, uploading, uploaded, scheduled, blocked, retryable, failed, canceled.
- No duplicate upload attempts for the same render plan/account/platform unless explicitly allowed.

## Kill-switch recommendation

Even if no fancy kill switch is needed, a simple disabled-by-default gate is still necessary.

Recommended minimum:

- Global upload execution gate: default false.
- Per-project upload gate: default false.
- Per-platform account upload gate: default false.
- Per-upload operator approval/idempotency gate for the first real upload.

This is not “fancy”; it prevents accidental uploads while enabling controlled rollout.

## Single-upload recommendation

The first real upload implementation should allow at most one upload attempt for one render plan, one project, one platform, and one account.

Reason:

- YouTube uploads are externally visible and can consume quota.
- Uploads are not as easy to undo as local writes.
- A duplicate upload can create messy channel state.
- A single-upload constraint proves credentials, media boundary, metadata mapping, scheduling, idempotency, and failure handling before automation expands.

## Migration plan

### Stage 1 — Read-only legacy analysis

Inspect Says the Bible pipeline behavior and document reusable concepts.

No changes to Says the Bible.

### Stage 2 — Video Orchestrator account model design

Design project/platform/account credential records and UI surface in ProBot.

No real credentials in repo.

### Stage 3 — YouTube adapter preflight design

Design a YouTube adapter boundary that can validate account, schedule policy, media references, and metadata without uploading.

### Stage 4 — YouTube credential/media/network preflight implementation

Implement preflight helpers first. Still no upload execution.

### Stage 5 — One controlled scheduled/private upload

After explicit approval, allow one controlled YouTube upload attempt using one account and one render artifact.

### Stage 6 — Says the Bible migration bridge

Represent Says the Bible as a project configuration in Video Orchestrator. Keep the old pipeline running until parity and confidence are proven.

### Stage 7 — Cutover

Stop using the old Says the Bible upload pipeline only after the Video Orchestrator has proven successful repeated scheduled uploads and recovery behavior.

## Current execution impact

The previous implementation point was VO-7BV: disabled dry-run invocation result/review complete.

Option D is now reframed. It should not jump directly into real upload execution. It should start with:

1. Architectural migration documentation.
2. Project/platform/account credential model design.
3. YouTube adapter preflight design.
4. YouTube credential/media/network preflight helpers.
5. Only then a separately approved single controlled YouTube upload.
