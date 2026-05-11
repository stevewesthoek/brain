# Video Orchestrator Phase 3 — Scope Boundaries and Deferred Features

**Last Updated:** 2026-05-11  
**Phase:** 3 (Dashboard Stabilization & Local YouTube Setup)

## Completed in Phase 3

1. ✅ YouTube OAuth token exchange with Keychain-backed client secret support
2. ✅ Simplified one-click YouTube channel onboarding (no manual account entry)
3. ✅ Dashboard test fixes after UI refactor
4. ✅ Truthful account/video/job counts (read from account registry + database when available)
5. ✅ Connected Channels multi-account rendering

## Deferred to Phase 4+

### Out of Scope — Multi-Project Video Scheduling

**Why Deferred:**
- Requires cross-project task coordination
- Depends on shared scheduling database/queue
- Not necessary for local YouTube channel onboarding
- Adds significant complexity to existing account registry model

**What's Blocked:**
- Scheduling the same video to post across multiple YouTube projects simultaneously
- Batching videos for delayed/scheduled posts
- Cross-project orchestration of upload/post operations

**Next Step (Phase 4+):**
- Design multi-project task queue schema
- Add project context to account registry
- Implement task scheduling layer

### Out of Scope — Multi-Platform Simultaneous Posting

**Why Deferred:**
- Currently supports: YouTube (primary), manual fallbacks for Bluesky/Instagram
- Multi-platform posting requires separate OAuth/auth per platform
- Credential management becomes exponentially more complex
- Keychain storage is platform-agnostic but UI/dashboard only shows YouTube

**What's Blocked:**
- Posting the same video to YouTube + TikTok + Instagram simultaneously
- Platform-specific upload workflow coordination
- Cross-platform status synchronization

**Next Step (Phase 4+):**
- Add platform-specific adapters to account registry (YouTube, TikTok, Instagram, etc.)
- Extend OAuth callback to support multiple platforms
- Design multi-platform posting orchestrator

## Phase 3 Reference

**Commits:**
- Phase 1: YouTube OAuth token exchange + Keychain storage
- Phase 2: One-click channel onboarding + pending account flow
- Phase 3: Dashboard stabilization + truthful counts

**Test Coverage:**
- 104 tests passing (all D1-* suites)
- D1-N tests verify new multi-channel UI
- D1-M tests updated for UI refactor

**Roadmap Context:**
See `video-orchestrator-roadmap.md` for full Phase 4-6 vision.
