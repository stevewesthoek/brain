# Project Onboarding: Shared Brain-Core vs. Project-Specific Responsibilities

**Status:** Governance document for all project integrations  
**Date:** 2026-05-25  
**Audience:** Project architects, integration engineers

---

## Executive Summary

Brain-core provides **shared infrastructure** for video generation, orchestration, and artifact management. Projects use the API and provide **editorial definitions** (templates, colors, approval workflows). This split prevents code duplication while enabling project customization.

**Rule:** If it's shared processing logic, it lives in brain-core. If it's project-specific branding or editorial, it lives in the project repo.

---

## The Split: What Lives Where

### Brain-Core (Shared Processing)

**Video Orchestrator Pipeline**
- Normalize audio → Subtitle generation → Compose video → Render thumbnails → Generate metadata → Multi-platform posting
- All projects use the same pipeline
- Improvements to the pipeline benefit all projects
- Brain-core owns job queue, status tracking, retry logic, error recovery

**Thumbnail Rendering Engine**
- ThumbnailDesigner, TemplateLibrary, ImageComposer, VariantGenerator
- All projects render thumbnails with the same quality, performance, A/B testing infrastructure
- Brain-core owns confidence scoring, artifact storage, analytics

**Metadata Generation Engine**
- LLM prompts for all 8 platforms
- Platform-specific character limits, hashtag rules, formatting
- All projects get consistent, platform-optimized metadata
- Brain-core owns prompt routing, cost optimization, platform validation

**Admin Console (Read-Only Brain Health)**
- Brain Console VO dashboard showing job progress, worker health, approval queue
- Shows what's happening in the pipeline, not project editorial decisions
- Lets operators see overall system health, query job status, approve jobs

---

### Project Repo (Editorial & Branding)

**Thumbnail Templates & Colors**
- YAML template definitions (layer structure, positioning, fonts)
- JSON color scheme files (project brand identity)
- Project owns branding → project owns color definitions
- No project templates ever committed to brain-core

**Admin UI for Editorial Selection**
- Interface for operators to choose which template, color scheme, title to use
- Project-specific workflows (approval gates, auto-selection logic, display preferences)
- Project owns the UX for "how do we pick a thumbnail in our workflow"

**Project-Specific Metadata Prompts**
- Custom instructions for metadata generation (tone, hashtag rules, platform priorities)
- Example: "For faith-based content, add 'Bible' or 'Scripture' to YouTube title if there's room"
- Brain-core has base prompts; project can override via config

**Editorial Decisions**
- Which episodes get which template
- Manual thumbnail A/B test winner declarations (approval authority)
- Title variants that should be tried
- Platform-specific hooks (e.g., "Queue to YouTube at 6 AM, TikTok at 8 AM")

---

## The API Boundary

**Projects call brain-core via REST API:**

```
POST /queue/normalize
POST /queue/subtitle
POST /queue/compose
POST /queue/thumbnail
POST /queue/metadata
POST /queue/multi_post
GET  /jobs/{job_id}
POST /jobs/{job_id}/cancel
```

**Projects send:** Editorial metadata + template choices + content (audio, images, titles)  
**Brain-core returns:** Processed artifacts (videos, thumbnails, metadata, posting status)

**Projects never:**
- Import brain-core rendering code
- Re-implement ThumbnailDesigner
- Duplicate metadata generation logic
- Call internal brain-core services directly (always use API)

**Brain-core never:**
- Stores or knows project template files
- Hardcodes project brand colors
- Implements project approval workflows
- Knows about project-specific editorial rules

---

## Thumbnail Boundary (Detailed)

### Brain-Core Owns

1. **Rendering engine** — Python code that takes template definition + colors and renders pixels
2. **Performance** — <2 sec/variant, <80 KB file size, 1000 thumbnails/hour throughput
3. **Quality** — Pillow rendering, font caching, color space handling, JPEG optimization
4. **A/B Testing** — Database table, analytics, winner declaration, statistical significance
5. **Artifact storage** — S3 bucket, lifecycle management, access control
6. **Template registry** — List of available template names for discovery

### Project Owns

1. **Template definitions** — YAML files with layer structure, positions, fonts (project-specific customizations)
2. **Color schemes** — JSON files mapping scheme names to hex colors (brand identity)
3. **Admin UI** — React component for template selection, preview, approval
4. **Template selection logic** — Rules for which template to use (auto or manual)
5. **Template overrides** — Project-specific modifications (add verse, change accent, etc.)

---

## Migration Checklist: Onboarding a New Project

### Pre-Integration (Project Prepares)

- [ ] 1. Create `config/templates/` directory in project repo
- [ ] 2. Define template YAML files
  - [ ] Copy structure from `brain/projects/brain-core/docs/PHASE_2_ARCHITECTURE_DESIGN.md`
  - [ ] Each template: layers array, text placeholders, positioning
  - [ ] Minimum 3 templates to start
- [ ] 3. Create `config/colors/` directory
- [ ] 4. Define color scheme JSON files (project brand hex colors)
  - [ ] Minimum 2 schemes (default, branded)
- [ ] 5. Build admin UI component for template selection
  - [ ] Dropdown for templates
  - [ ] Dropdown for color schemes
  - [ ] Text input for title
  - [ ] "Generate" button

### Integration Testing (Project Tests Against brain-core API)

- [ ] 6. Start brain-core: `npm start` at `localhost:4877`
- [ ] 7. Test: POST to `/queue/thumbnail` with sample request
  - [ ] Include full template definition + color scheme
  - [ ] Verify response includes 3 variants with URLs
  - [ ] Verify URLs are accessible (S3 or local storage)
- [ ] 8. Test: Query job status with `GET /jobs/{job_id}`
- [ ] 9. Test: Full pipeline integration
  - [ ] Queue normalize → subtitle → compose → thumbnail → metadata → multi_post
  - [ ] Verify each step completes and hands off to next

### Production Integration (Project Goes Live)

- [ ] 10. Verify approval workflow integrates with brain-core
  - [ ] Operators can see thumbnail variants in admin UI
  - [ ] Operators can select winner and queue metadata job
- [ ] 11. Wire metadata job to use thumbnail URLs from brain-core
- [ ] 12. Test: End-to-end episode with all 8 platforms
  - [ ] Queue full pipeline
  - [ ] Verify thumbnails post to YouTube, Pinterest, Facebook (priority platforms)
  - [ ] Verify metadata posts correctly
- [ ] 13. A/B test: Queue 3 episodes with different thumbnail templates
  - [ ] Run for 7 days
  - [ ] Compare CTR before and after
  - [ ] Call `/api/video-orchestrator/thumbnails/declare-winner` to record results
- [ ] 14. Monitor: Track brain-core job queue depth, latency, error rates
  - [ ] Set up alerts if latency exceeds 5 seconds
  - [ ] Set up alerts if error rate exceeds 5%

---

## Never Cross This Boundary

### Project Must Never

- Store rendering logic in project repo
- Re-implement ThumbnailDesigner class
- Duplicate metadata generation prompts (reuse brain-core endpoints)
- Modify brain-core template files (they're shared, not project-specific)
- Call internal brain-core services (always use public REST API)
- Commit project template YAML to brain-core repo

### Brain-Core Must Never

- Hardcode project-specific colors
- Store project template definitions
- Implement project approval workflows
- Know about project branding decisions
- Commit project-specific code (only shared processing logic)

---

## Verification Checklist Before Cutover

**Brain-core API is working:**
- [ ] All 9 endpoints return correct responses
- [ ] Platform validation enforces 8 platforms
- [ ] Dependency validation (thumbnail requires compose job)
- [ ] Error handling (400, 404, 503) works
- [ ] Tests: 40+ test cases all passing

**Project integration is clean:**
- [ ] Project has no duplicate rendering code
- [ ] Project config has templates and colors (no hardcoding)
- [ ] Admin UI lets operators select and approve
- [ ] Metadata job includes thumbnail URLs
- [ ] Multi-platform posting queues all 8 platforms (or subset)

**A/B testing baseline:**
- [ ] Old thumbnail method CTR recorded
- [ ] New brain-core thumbnails CTR recorded after 7 days
- [ ] Winner declared (new ≥ old)
- [ ] Ready to switch default

**Performance targets met:**
- [ ] <2 sec/variant generation time
- [ ] <80 KB file size (YouTube)
- [ ] 1000+ thumbnails/hour throughput
- [ ] Database queries < 100ms

---

## Reference

- **Detailed thumbnail architecture:** `thumbnail-architecture-split.md`
- **Full Phase 2 design:** `PHASE_2_ARCHITECTURE_DESIGN.md`
- **Strategy guardrails:** `video-orchestrator-strategy.md`
- **Roadmap:** `video-orchestrator-roadmap.md`
- **API reference:** `~/.local/video-orchestrator/API_REFERENCE.md`

---

## Contact

**Questions about the split?** See `thumbnail-architecture-split.md` for detailed explanation.  
**Questions about Phase 3 implementation?** See `video-orchestrator-implementation-plan.md`.  
**Questions about the full roadmap?** See `video-orchestrator-roadmap.md`.
