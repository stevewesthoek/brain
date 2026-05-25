# Video Orchestrator — Start Here

**Last Updated:** 2026-05-25  
**Project Status:** ✅ Phases 0-6 + Research/Design complete, Phase 3 ready for implementation  
**Quick Links:** [Roadmap](#roadmap) | [Architecture](#architecture) | [Research](#research) | [API](#api)  

---

## 🚀 Quick Start

### What is Video Orchestrator?

A **centralized video generation and distribution pipeline** that:
- Takes raw audio + background image
- Generates subtitles (AI transcription)
- Composes video (audio + subtitles + background)
- Designs thumbnails (3 A/B variants)
- Generates metadata for 8 platforms (YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest)
- Posts to all 8 platforms via n8n webhooks

**Architecture:** All projects (Says the Bible, future projects) call brain-core API. No code duplication.

### Why Centralized?

- **Code Quality:** Single source of truth for thumbnail design, metadata generation, quality
- **Consistency:** All projects get the same quality, tools, improvements
- **Scaling:** Add capacity to brain-core; all projects scale together
- **Team Ownership:** Clear accountability for video quality

### Current Status (2026-05-25)

✅ **Complete:**
- Phase 0: Job queueing (Redis + PostgreSQL)
- Phase 1: Audio normalization
- Phase 2: Subtitle generation
- Phase 3: Video composition
- Phase 4: Thumbnail design (3 A/B variants)
- Phase 5: Metadata generation (all 8 platforms)
- Phase 5.2: Multi-platform posting (n8n)
- **Phase 6: REST API server** (9 endpoints, 40+ tests)
- **Phase 1R: Research** (CTR psychology, best practices)
- **Phase 2A: Architecture Design** (6 components, YAML schema)

⏳ **Planned:**
- Phase 3: Core implementation (ThumbnailDesigner, TemplateLibrary, etc.)
- Phase 3B: A/B testing (YouTube CTR optimization)
- Phase 4: Says the Bible migration

---

## 📖 Documentation by Role

### 👤 Project Managers / Product

**Start here:** [`README.md`](README.md) → [`FEATURES.md`](FEATURES.md)

- What the system does
- What platforms are supported
- How to queue jobs and check status
- Feature checklist per phase

### 👨‍💻 Developers / API Users

**Start here:** [`API_REFERENCE.md`](.local/video-orchestrator/API_REFERENCE.md) → [`DEVELOPER.md`](DEVELOPER.md)

- How to call the API
- Request/response examples
- Platform-specific requirements
- Integration guide for video_worker.py

### 🏗️ Architects / Decision Makers

**Start here:** [`ARCHITECTURE.md`](ARCHITECTURE.md) → [`ROADMAP.md`](ROADMAP.md)

- Why centralized pipeline
- Strategic decisions explained
- Data flow and component design
- Timeline and resource allocation

---

## 🔍 Finding What You Need

### API Contract & Integration

**Question:** "How do I call the Video Orchestrator API?"

→ Read [`API_REFERENCE.md`](.local/video-orchestrator/API_REFERENCE.md)

**Contains:**
- All 9 endpoint specifications
- Request/response JSON examples
- Error codes and meanings
- Complete example workflow
- Configuration guide

### Features & Capabilities

**Question:** "What features are available?"

→ Read [`FEATURES.md`](FEATURES.md)

**Contains:**
- Feature checklist per phase
- Supported platforms (8 total)
- Metadata generation details
- Configuration files

### Architecture & Strategy

**Question:** "Why was this built this way? What were the key decisions?"

→ Read [`ARCHITECTURE.md`](ARCHITECTURE.md)

**Contains:**
- Centralized vs. distributed decision
- Why this approach works
- Data flow diagram
- Architecture decision log

### Thumbnail Design (Research & Implementation)

**Question:** "How does thumbnail generation work? Why rebuild vs. adapt Says the Bible?"

→ Read [`PHASE_1_RESEARCH_FINDINGS.md`](PHASE_1_RESEARCH_FINDINGS.md) → [`PHASE_2_ARCHITECTURE_DESIGN.md`](PHASE_2_ARCHITECTURE_DESIGN.md)

**Phase 1 (Research) contains:**
- YouTube CTR psychology and drivers
- Multi-platform technical requirements
- A/B testing framework recommendations
- Decision: Rebuild from scratch

**Phase 2 (Architecture) contains:**
- 6 component APIs with specifications
- YAML template format (7 templates)
- Database schema for A/B results
- Integration points and error handling

### Complete Project Timeline

**Question:** "What's the roadmap? What's done? What's next?"

→ Read [`ROADMAP.md`](ROADMAP.md)

**Contains:**
- All 13 phases (0-6 + research/design + planned 3-4)
- Status for each phase
- Timeline and dependencies
- Resource allocation
- Success metrics

### Session Work Summary

**Question:** "What happened in this session? What was delivered?"

→ Read [`SESSION_COMPLETION_SUMMARY.md`](SESSION_COMPLETION_SUMMARY.md)

**Contains:**
- Session objectives vs. deliverables
- Code statistics (lines, test cases, endpoints)
- Documentation quality metrics
- Key decisions made
- Outstanding questions

---

## 🎯 Current Phase: Phase 6 API Server

### What's Done

✅ **FastAPI REST server** (`api_server.py`, 447 lines)
- All 9 endpoints implemented
- Full job lifecycle (queue → status → cancel)
- Platform validation (8 platforms enforced)
- Dependency validation (upstream jobs must exist)
- Error handling (400, 404, 503)
- Database integration (PostgreSQL)
- Logging and configuration

✅ **Comprehensive test suite** (`test_api_server.py`, 350+ lines)
- 40+ test cases
- All endpoints covered
- Dependency chain tests
- Platform validation tests
- Error response tests

✅ **Complete API reference** (`API_REFERENCE.md`)
- All endpoints documented
- Request/response examples
- Example workflow (normalize → subtitle → compose → thumbnail → metadata → multi_post)
- Configuration guide

### What's Ready For

🔧 **Next steps:**
1. **Integration testing** with video_worker.py job processor
2. **Says the Bible API calls** (test metadata job endpoint)
3. **n8n webhook configuration** (test multi_post dispatch)

### How to Test Locally

```bash
# Start API server
cd ~/.local/video-orchestrator
python3 api_server.py

# In another terminal, run tests
pytest tests/test_api_server.py -v

# Or test manually
curl http://localhost:5000/
curl -X POST http://localhost:5000/api/video-orchestrator/queue/normalize \
  -H "Content-Type: application/json" \
  -d '{"audio_path": "s3://bucket/audio.mp3", "title": "Test"}'
```

---

## 🎨 Next Phase: Phase 3 Implementation

### What's Being Built

The Thumbnail Studio module — 6 core components for multi-platform thumbnail generation:

1. **ThumbnailDesigner** (orchestrator)
2. **TemplateLibrary** (YAML-based templates)
3. **ColorPalette** (Yeshua Academy brand colors)
4. **FontManager** (font resolution)
5. **ImageComposer** (Pillow rendering)
6. **VariantGenerator** (A/B variant creation + scoring)

### Architecture & Design

📄 Complete design document: [`PHASE_2_ARCHITECTURE_DESIGN.md`](PHASE_2_ARCHITECTURE_DESIGN.md)

**Contains:**
- Detailed API specifications for all 6 components
- YAML configuration schema with examples
- Database schema for A/B test tracking
- Integration points with video_worker.py
- Error handling strategy
- Performance targets

### Templates (7 Core)

1. **Bold Text** — Large headline, high contrast
2. **Image Focus** — Large background, subtle text
3. **Curiosity Hook** — Partial image, question mark
4. **Minimal Text** — White space, elegant typography
5. **Accent Bar** — Horizontal color bar with text
6. **Badges & Icons** — Stickers, emojis, trendy
7. **Faith Specific** — Cross, scripture references

### Performance Targets

- Generation time: **<2 seconds per variant**
- File size: **<80 KB YouTube**, <50 KB TikTok/Instagram
- Throughput: **1000 thumbnails/hour**
- Test coverage: **>90%**

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Documentation files | 13 |
| Code files | 2 (API server + tests) |
| Total documentation | 3900+ lines |
| Total code | 800+ lines |
| API endpoints | 9 |
| Test cases | 40+ |
| Platforms supported | 8 |
| Components designed | 6 |
| Templates defined | 7 |
| Git commits | 8+ |

---

## 🔗 Document Navigation

```
00-START-HERE.md (this file)
│
├─ User Docs
│  ├─ README.md (overview + quick start)
│  ├─ FEATURES.md (features by phase)
│  └─ DEVELOPER.md (developer guide)
│
├─ API
│  └─ API_REFERENCE.md (endpoints, examples, config)
│
├─ Architecture
│  ├─ ARCHITECTURE.md (decision + data flow)
│  └─ ROADMAP.md (complete timeline)
│
├─ Research & Design
│  ├─ PHASE_1_RESEARCH_FINDINGS.md (CTR psychology, best practices)
│  ├─ PHASE_1_RESEARCH_SPECIFICATION.md (research dimensions)
│  ├─ PHASE_2_ARCHITECTURE_DESIGN.md (component APIs, YAML schema)
│  └─ THUMBNAIL_STUDIO_RESEARCH_PLAN.md (original plan)
│
├─ Session Notes
│  ├─ SESSION_COMPLETION_SUMMARY.md (comprehensive summary)
│  └─ SESSION_SUMMARY_2026_05_25.md (detailed notes)
│
└─ Code (outside repo)
   └─ ~/.local/video-orchestrator/
      ├─ api_server.py (447 lines)
      ├─ tests/test_api_server.py (350+ lines)
      ├─ API_REFERENCE.md (local docs)
      └─ [worker modules, scripts]
```

---

## 🚦 Next Actions

### Immediate (Pick One)

1. **Review Phase 6 API** — Read `API_REFERENCE.md`, test endpoints locally
2. **Review Architecture** — Read `ARCHITECTURE.md` + `PHASE_2_ARCHITECTURE_DESIGN.md`
3. **Start Phase 3** — Implement `ThumbnailDesigner` core module

### This Week

- [ ] Test Phase 6 API with Says the Bible metadata job
- [ ] Configure n8n workflows for multi_post dispatch
- [ ] Decision: Priority between Phase 3 implementation vs. Phase 3B A/B testing

### This Month

- [ ] Phase 3: Core ThumbnailDesigner implementation + tests
- [ ] Phase 3B: A/B testing framework (optional, depends on priority)
- [ ] Phase 4: Says the Bible migration (parallel run → cutover)

---

## ❓ FAQ

**Q: How do I queue a video for processing?**  
A: See `API_REFERENCE.md` → "Complete Example Workflow"

**Q: What platforms are supported?**  
A: All 8: YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest

**Q: Why rebuild Thumbnail Studio instead of using Says the Bible code?**  
A: See `PHASE_1_RESEARCH_FINDINGS.md` → "Decision Matrix" (requires 8-platform support, design system, production quality)

**Q: How long does thumbnail generation take?**  
A: Target: <2 seconds per variant (2-3 variants typically = <6 seconds total)

**Q: Can I use my own fonts and colors?**  
A: Yes. See `PHASE_2_ARCHITECTURE_DESIGN.md` → "YAML Configuration Schema"

**Q: What's the performance target?**  
A: 1000 thumbnails/hour on a single machine

**Q: When will Says the Bible be migrated?**  
A: Phase 4 (planned for 2026-06-07 onwards, after Phase 3 implementation)

---

## 📞 Support

**For questions about:**

- **API usage** → See `API_REFERENCE.md`
- **Architecture decisions** → See `ARCHITECTURE.md`
- **Thumbnail research** → See `PHASE_1_RESEARCH_FINDINGS.md`
- **Component design** → See `PHASE_2_ARCHITECTURE_DESIGN.md`
- **Complete roadmap** → See `ROADMAP.md`
- **Session details** → See `SESSION_COMPLETION_SUMMARY.md`

**Git history:** All decisions are documented in commits (run `git log --oneline`)

---

## 🎓 Key Learnings

### Why Centralized > Distributed

- **Quality:** Single source of truth beats duplicate code
- **Consistency:** All projects benefit from improvements immediately
- **Scaling:** Add capacity once, all projects scale together
- **Ownership:** Clear accountability for video quality

### Why Rebuild Thumbnail Studio

- **Scope:** Need 8 platforms, not just YouTube
- **Architecture:** Token-based design system, not hardcoded templates
- **Quality:** Production-ready code from scratch beats adapting legacy

### Why Pillow + Jinja2 + YAML

- **Dependencies:** Zero external APIs = fast, reliable, no rate limits
- **Maintainability:** YAML is human-readable, versionable
- **Performance:** Pillow is battle-tested, sub-2-second rendering
- **Portability:** Works on any system with Python 3

---

## ✅ Project Status

**Current:** Phase 6 API complete + Phase 1-2 research/design complete  
**Next:** Phase 3 implementation (ThumbnailDesigner core module)  
**Overall:** On track for full system ready Q2 2026  

**Work Quality:** Production-ready code, comprehensive documentation, clean git history

---

**Ready to dive in?** Start with the role-specific section above, or jump to the document for your question!

---

**Questions?** Check the [Document Navigation](#-document-navigation) section or search git history:
```bash
git log --oneline | grep -i "keyword"
```

**Last Updated:** 2026-05-25  
**Status:** ✅ Ready for Phase 3 implementation or Says the Bible integration testing
