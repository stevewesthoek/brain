# Video Orchestrator — Complete Roadmap

**Project:** Centralized video generation and distribution pipeline for multi-platform content  
**Vision:** Single source of truth for shared video processing, orchestration, and artifact generation across all project repos  
**Start Date:** 2026-05-25  
**Last Updated:** 2026-05-25  

---

## Project Timeline

### Phases Completed ✅

#### Phase 0: Job Queueing & Orchestration
**Status:** ✅ Complete (prior session)
- Redis job queue
- PostgreSQL job state tracking
- Dependency chaining (depends_on)
- Job status polling
- Job cancellation

#### Phase 1: Audio Normalization
**Status:** ✅ Complete (prior session)
- Sample rate standardization (44.1 kHz)
- Bit depth standardization (16-bit)
- Loudness normalization (−14 LUFS)
- AAC encoding @ 128 kbps

#### Phase 2: Subtitle Generation & Burn
**Status:** ✅ Complete (prior session)
- AI transcription + SRT generation
- Subtitle timing and validation
- Burn to video frames
- Timecode metadata storage

#### Phase 3: Video Composition
**Status:** ✅ Complete (prior session)
- Audio + subtitle + background composition
- H.264 MP4 rendering
- YouTube-optimized output

#### Phase 4: Shared Thumbnail Processing
**Status:** ✅ Complete (prior session)
- 3 A/B variants per thumbnail
- Shared template system
- Variant scoring (0-1 confidence)

#### Phase 5: Shared Metadata Generation
**Status:** ✅ Complete (prior session)
- All 8 platforms supported (YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest)
- Character limit enforcement per platform
- Platform-specific prompts driven by the calling repo
- Title variants for YouTube
- Hashtag generation

#### Phase 5.1: Multi-Platform Metadata (Extended)
**Status:** ✅ Complete (prior session)
- Single job generates metadata for all 8 platforms
- Prompt template per platform
- Cost optimization (batched LLM calls)

#### Phase 5.2: Multi-Platform Dispatching (n8n)
**Status:** ✅ Complete (prior session, stub implementations)
- Metadata job triggers multi_post job
- n8n webhooks for each platform
- Workflow stubs for YouTube, Facebook, TikTok, Instagram, LinkedIn, Bluesky, X, Pinterest

#### Phase 6: Multi-Platform Direct Publishing — API Server
**Status:** ✅ Complete (2026-05-25)

**API Endpoints (9 total):**
- `POST /queue/normalize` — Audio normalization
- `POST /queue/subtitle` — Subtitle generation
- `POST /queue/compose` — Video composition
- `POST /queue/thumbnail` — Thumbnail design
- `POST /queue/metadata` — Multi-platform metadata (all 8 platforms)
- `POST /queue/multi_post` — Multi-platform posting
- `GET /jobs/{job_id}` — Job status
- `GET /jobs` — List recent jobs
- `POST /jobs/{job_id}/cancel` — Job cancellation
- `GET /health` — Database connectivity
- `GET /` — API root
- `POST /webhook/completion` — Job completion callbacks

**Deliverables:**
- `api_server.py` — FastAPI REST server (447 lines, production-ready)
- `tests/test_api_server.py` — Comprehensive test suite (40+ test cases)
- `API_REFERENCE.md` — Complete API documentation with examples
- Platform validation (8 platforms enforced)
- Dependency validation (upstream jobs must exist)
- Error handling (400, 404, 503)

**Ready for:** Worker integration testing, n8n workflow configuration

---

### Phases In Progress 🟡

#### Phase 1 Research: Thumbnail Studio Investigation
**Status:** ✅ Complete (2026-05-25)

**Research Output:**
- `PHASE_1_RESEARCH_FINDINGS.md` (684 lines)
  - YouTube CTR psychology and best practices
  - Faith-based educational content specifics
  - Multi-platform technical requirements (8 platforms)
  - Design system & template patterns
  - A/B testing framework (7-day time-slice)
  - Technical implementation recommendations

**Architecture Decision:**
- ✅ **Rebuild Thumbnail Studio from scratch** (not adapt Says the Bible)
- **Rationale:** Brain-core requires 8-platform support, token-based design system, production-ready code quality

**Key Findings:**
- CTR drivers: facial expressions (15-30%), color/contrast (10-20%), text (10-15%), branding (5-10%), novelty (5-15%)
- Platform dimensions: YouTube 1280×720, TikTok 1080×1920, Instagram 1080×1080, Pinterest 1000×1500, etc.
- A/B testing: 7-day time-slice per variant, statistical significance at >10% CTR difference
- Tech stack: Pillow + Jinja2 + YAML (zero external dependencies)

**Ready for:** Phase 2 architecture design

#### Phase 2 Architecture: Thumbnail Studio Design
**Status:** ✅ Complete (2026-05-25)

**Architecture Deliverables:**
- `PHASE_2_ARCHITECTURE_DESIGN.md` (1157 lines)
  - 6 core component APIs (ThumbnailDesigner, TemplateLibrary, ColorPalette, FontManager, ImageComposer, VariantGenerator)
  - YAML configuration format with 7 core templates
  - Database schema for A/B test results
  - Integration points (video_worker.py, CLI)
  - Error handling strategy
  - Performance targets (<2 sec/variant, 1000 thumbnails/hour)

**Templates Designed:**
1. Bold Text — Large headline, high contrast
2. Image Focus — Large background, subtle text
3. Curiosity Hook — Partial image, question mark
4. Minimal Text — White space, elegant typography
5. Accent Bar — Horizontal color bar with text
6. Badges & Icons — Stickers, emojis, trendy elements
7. Faith Specific — Cross, scripture references

**Configuration:**
- YAML template definitions with layer support (background, scrim, text, accent, logo)
- Yeshua Academy color schemes (default, old_testament, new_testament)
- Platform-specific safe zones and dimensions
- Redis or in-memory caching

**Ready for:** Phase 3 implementation and code review

---

### Phases Planned ⏳

#### Phase 3: Thumbnail Studio Implementation (Scheduled 2026-06)
**Scope:**
- Implement core ThumbnailDesigner orchestrator
- Implement TemplateLibrary YAML loader
- Implement ImageComposer (Pillow rendering)
- Implement FontManager + ColorPalette
- Implement VariantGenerator (scoring algorithm)
- Unit tests (40+ test cases per component)
- Integration tests with video_worker.py

**Success Criteria:**
- All components working end-to-end
- <2 sec per variant generation time
- Full test coverage
- Ready for Says the Bible integration

#### Phase 3B: A/B Testing for YouTube Thumbnails (Scheduled 2026-06)
**Scope:**
- Database schema for test results
- API endpoints for test management
- 7-day time-slice implementation
- Statistical significance calculation
- Dashboard integration
- Winner determination algorithm

**Success Criteria:**
- Full A/B testing workflow functional
- Automatic winner detection
- Manual override capability
- Historical test tracking

#### Phase 4: Says the Bible Migration (Scheduled 2026-06-07+)
**Scope:**
1. **Parallel Run (Week 1):**
   - Both old and new systems generate thumbnails
   - Compare quality, generation time, CTR impact
   - Log side-by-side results
   
2. **Cut Over (Week 2):**
   - Switch metadata job to brain-core thumbnail API
   - Monitor performance and CTR
   - Have rollback plan ready
   
3. **Decommission (Week 3):**
   - Confirm stability
   - Archive old pipeline
   - Document migration process

**Success Criteria:**
- Zero downtime migration
- CTR equal or better than old system
- Cleaner, more maintainable code

---

## Component Dependencies

```
video-orchestrator/
├── Phase 0: Job Queue (Redis, PostgreSQL)
├── Phase 1: Normalize (audio codec handling)
├── Phase 2: Subtitle (AI transcription)
├── Phase 3: Compose (FFmpeg or Pillow)
├── Phase 4: Thumbnail (AI design)
│   ├─ Phase 2: Architecture Design ✅ (complete)
│   ├─ Phase 3: Implementation (planned)
│   └─ Phase 3B: A/B Testing (planned)
├── Phase 5: Metadata (AI prompts)
│   └─ 8-platform support
├── Phase 5.2: Multi-Post (n8n webhooks)
└── Phase 6: API Server ✅ (complete)
```

**Critical Path:**
1. ✅ Phase 0-6 (job queue, audio, subtitle, compose, metadata, API)
2. ✅ Phase 1 Research (Thumbnail investigation)
3. ✅ Phase 2 Architecture (Thumbnail design)
4. ⏳ Phase 3 Implementation (Thumbnail code)
5. ⏳ Phase 3B A/B Testing (YouTube optimization)
6. ⏳ Phase 4 Migration (Says the Bible cutover)

---

## Current Status Summary

| Phase | Status | Deliverable | Notes |
|-------|--------|-------------|-------|
| 0 | ✅ Complete | Job queue + state management | Redis + PostgreSQL |
| 1 | ✅ Complete | Audio normalization | 44.1 kHz, 16-bit, −14 LUFS |
| 2 | ✅ Complete | Subtitle generation | AI transcription + timecode |
| 3 | ✅ Complete | Video composition | H.264 MP4 output |
| 4 | ✅ Complete | Thumbnail design | 3 A/B variants, AI hooks |
| 5 | ✅ Complete | Metadata generation | All 8 platforms |
| 5.1 | ✅ Complete | Multi-platform metadata | Single job, all platforms |
| 5.2 | ✅ Complete (stub) | n8n dispatching | Workflow stubs exist |
| **6** | **✅ Complete** | **API server** | **9 endpoints, tests, docs** |
| **1R** | **✅ Complete** | **Research synthesis** | **CTR psychology, best practices** |
| **2A** | **✅ Complete** | **Architecture design** | **6 components, YAML schema** |
| 3 | ⏳ Planned | Core implementation | ThumbnailDesigner, etc. |
| 3B | ⏳ Planned | A/B testing | YouTube CTR optimization |
| 4 | ⏳ Planned | Migration | Says the Bible cutover |

---

## Documentation Structure

### User-Facing
- `README.md` — Quick start, features overview
- `FEATURES.md` — Feature reference, supported platforms

### Developer
- `DEVELOPER.md` — Implementation guide, API contract, troubleshooting
- `API_REFERENCE.md` — Complete API documentation with examples

### Architecture & Strategy
- `ARCHITECTURE.md` — Strategic decisions, centralized vs. distributed rationale
- `ROADMAP.md` — This document, complete project timeline

### Research & Design
- `PHASE_1_RESEARCH_FINDINGS.md` — Thumbnail CTR psychology, best practices
- `PHASE_2_ARCHITECTURE_DESIGN.md` — Component APIs, YAML schema, integration

### Session Work
- `SESSION_SUMMARY_2026_05_25.md` — Detailed summary of current session

---

## Metrics & Success Criteria

### Phase 6 (API Server) ✅
- ✅ 9 endpoints implemented
- ✅ 40+ test cases pass
- ✅ Platform validation working
- ✅ Dependency validation working
- ✅ Error handling correct

### Thumbnail Studio (Phase 1-2) ✅
- ✅ Research complete (CTR psychology documented)
- ✅ Architecture designed (6 components, YAML schema)
- ✅ Decision made (rebuild vs. adapt)
- ✅ Performance targets set (<2 sec/variant)

### Thumbnail Studio (Phase 3) ⏳
- ⏳ Generation time: <2 sec per variant
- ⏳ Test coverage: >90%
- ⏳ CTR performance: ≥ old system
- ⏳ Integration: Clean video_worker.py hook-up

### Thumbnail Studio (Phase 3B) ⏳
- ⏳ A/B test duration: 7 days
- ⏳ Statistical significance: >10% CTR difference
- ⏳ Winner accuracy: >95%

### Says the Bible Migration (Phase 4) ⏳
- ⏳ Downtime: 0 minutes
- ⏳ CTR change: ≥0% (no regression)
- ⏳ Code quality: Improved

---

## Resource Allocation

**Development Time (estimated):**
- Phase 0-5: 40 hours (prior sessions)
- Phase 6: 8 hours (2026-05-25)
- Phase 1R-2A: 12 hours (2026-05-25)
- Phase 3: 20 hours (2026-06)
- Phase 3B: 8 hours (2026-06)
- Phase 4: 12 hours (2026-06-07+)

**Total estimated:** ~100 hours (2.5 weeks full-time development)

---

## Known Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Says the Bible code quality unknown | Medium | Phase 1 research provides assessment; rebuild decision made |
| A/B testing time-to-winner | Low | 7-day time-slice is industry standard |
| Performance regression | High | Phase 6 API enables parallel testing before cutover |
| Pillow rendering quality | Medium | Thorough testing of variant scores before Says the Bible migration |
| Font licensing | Low | Using system fonts (Arial, Helvetica, Georgia) — no licensing required |

---

## Next Session Priorities

### Immediate (if continuing)
1. **Phase 3 Implementation** — Start core ThumbnailDesigner module
2. **Unit tests** — Test TemplateLibrary YAML loading
3. **Integration** — Wire into video_worker.py

### Medium Term
1. **Phase 3B A/B Testing** — Database schema + API endpoints
2. **Performance tuning** — Ensure <2 sec/variant target
3. **Dashboard** — Visual thumbnail A/B test results

### Longer Term
1. **Phase 4 Migration** — Parallel run Says the Bible + brain-core
2. **Production deployment** — Full infrastructure setup
3. **Multi-project support** — Onboard second project to brain-core API

---

## Appendix: Architecture Decision Log

### Decision 1: Centralized Pipeline (Phase 0)
- **Decision:** All projects delegate to brain-core API
- **Rationale:** Code consistency, quality, scaling, team ownership
- **Alternative Rejected:** Distributed (each project has own pipeline)
- **Status:** ✅ Approved, implemented

### Decision 2: 8-Platform Support (Phase 5)
- **Decision:** Support YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest
- **Rationale:** Multi-platform distribution maximizes reach
- **Alternative Rejected:** YouTube-only
- **Status:** ✅ Implemented

### Decision 3: Template-Based Thumbnail Design (Phase 1R-2A)
- **Decision:** Rebuild Thumbnail Studio from scratch (not adapt Says the Bible)
- **Rationale:** Brain-core requires 8-platform support, token-based design, production quality
- **Alternative Rejected:** Adapt Says the Bible implementation
- **Status:** ✅ Approved

### Decision 4: Pillow + Jinja2 Stack (Phase 1R-2A)
- **Decision:** Use Pillow (PIL) + Jinja2 + YAML for thumbnail generation
- **Rationale:** Zero external dependencies, battle-tested, human-readable config
- **Alternatives Rejected:** Figma API (external dependency), Canva (paid), AI generation only (expensive)
- **Status:** ✅ Approved

### Decision 5: 7-Day A/B Testing (Phase 1R-2A)
- **Decision:** Use 7-day time-slice per variant (not simultaneous A/B)
- **Rationale:** Allows algorithm normalization, simpler implementation, industry standard
- **Alternatives Rejected:** Simultaneous A/B (complex state tracking)
- **Status:** ✅ Approved

---

## Contact & Handoff

**Owner:** Steve Westhoek  
**Primary AI Agent:** Claude Code (Haiku 4.5)  
**Documentation:** All decisions, code, tests in `/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/`  
**Git:** All work committed to main branch, clean working tree  

**For Questions:**
- Architecture: See `ARCHITECTURE.md`
- Research: See `PHASE_1_RESEARCH_FINDINGS.md`
- Design: See `PHASE_2_ARCHITECTURE_DESIGN.md`
- API: See `API_REFERENCE.md`
- Next Steps: See this `ROADMAP.md`

---

**Last Updated:** 2026-05-25  
**Status:** ✅ Phases 0-6 + 1R-2A complete, ready for Phase 3 implementation
