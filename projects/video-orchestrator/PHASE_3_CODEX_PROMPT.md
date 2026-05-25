# Phase 3 Implementation Prompt for Codex Mini

**Project:** Video Orchestrator — Centralized video generation pipeline  
**Phase:** 3 (Thumbnail Studio Core Implementation)  
**Model:** Codex Mini  
**Date:** 2026-05-25  

---

## Context & Overview

You are implementing Phase 3 of the Video Orchestrator project. All architecture and design decisions are already made and documented. Your job is to implement the specification exactly as written.

### What is Video Orchestrator?

A centralized REST API that takes audio + background image and generates:
1. Subtitles (AI transcription)
2. Video composition (audio + subtitles + background)
3. **Thumbnails (3 A/B variants, multiple platforms)**
4. Metadata (8 platforms: YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, X, Pinterest)
5. Multi-platform posting (n8n webhooks)

All projects (Says the Bible, future projects) call brain-core via REST API instead of having their own pipeline.

### Why Phase 3?

Phases 0-6 and research/design (Phase 1R-2A) are complete. Phase 3 builds the **Thumbnail Studio module** — the component that generates platform-specific thumbnails with A/B variants.

---

## Phase 3 Scope: Thumbnail Studio Implementation

### What You're Building

6 core Python modules for multi-platform thumbnail generation:

1. **ThumbnailDesigner** (orchestrator) — Entry point
2. **TemplateLibrary** — YAML-based template loading
3. **ColorPalette** — Yeshua Academy brand colors
4. **FontManager** — Font resolution and caching
5. **ImageComposer** — Pillow-based image rendering
6. **VariantGenerator** — A/B variant creation + CTR scoring

### Complete Specification

Read: `/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/PHASE_2_ARCHITECTURE_DESIGN.md`

**This document contains:**
- All component APIs with method signatures
- Implementation pseudocode for each method
- YAML configuration schema with 7 templates
- Database schema (A/B test results)
- Integration points (video_worker.py, CLI)
- Error handling strategy
- Performance targets

**You do not need to make architecture decisions.** Everything is specified. Your job is to implement it.

---

## Execution Plan

### Step 1: Project Structure

Create the module structure:

```
~/.local/video-orchestrator/
├── thumbnail_system/
│   ├── __init__.py
│   ├── designer.py           # ThumbnailDesigner (implement from PHASE_2 spec)
│   ├── templates.py          # TemplateLibrary (implement from PHASE_2 spec)
│   ├── colors.py             # ColorPalette (implement from PHASE_2 spec)
│   ├── fonts.py              # FontManager (implement from PHASE_2 spec)
│   ├── composer.py           # ImageComposer (implement from PHASE_2 spec)
│   ├── variants.py           # VariantGenerator (implement from PHASE_2 spec)
│   ├── cache.py              # ImageCache (Redis or in-memory)
│   ├── platform_specs.py     # PlatformSpecs (platform dimensions, safe zones)
│   ├── config.py             # Configuration loading (YAML)
│   ├── artifact.py           # Data classes (ThumbnailVariant, ThumbnailArtifact)
│   ├── errors.py             # Exception classes
│   └── __tests__/
│       ├── test_designer.py
│       ├── test_templates.py
│       ├── test_composer.py
│       ├── test_variants.py
│       ├── test_integration.py
│       └── conftest.py
│
└── config/
    └── thumbnail-system.yaml  # Master YAML configuration
```

### Step 2: Data Classes (Start Here)

**File:** `thumbnail_system/artifact.py`

Implement data classes from PHASE_2_ARCHITECTURE_DESIGN.md:
- `ThumbnailVariant` (single output image)
- `ThumbnailArtifact` (complete generation result)
- `Platform` enum (8 platforms)

These are straightforward dataclasses. Use them as the foundation.

### Step 3: Configuration & Platform Specs

**Files:** `thumbnail_system/config.py`, `thumbnail_system/platform_specs.py`

Implement:
- YAML loader (parse `~/.config/video-orchestrator/thumbnail-system.yaml`)
- Platform specifications (dimensions, safe zones, file limits)
- Validation of configuration

See PHASE_2_ARCHITECTURE_DESIGN.md Section 2.1 for YAML schema.

### Step 4: Component Implementation (in order)

**4a. FontManager** (`fonts.py`)
- Straightforward: system font mapping, caching
- No external dependencies (use system fonts: Arial, Helvetica, Georgia)

**4b. ColorPalette** (`colors.py`)
- Load colors from YAML config
- Select colors by series (Old Testament, New Testament, default)
- Return dict of color names → hex values

**4c. TemplateLibrary** (`templates.py`)
- Load YAML templates
- Parse and validate template definitions
- Cache templates in memory
- Return parsed template structure

**4d. ImageComposer** (`composer.py`)
- Core Pillow wrapper
- Render layers: background → scrim → text → accent → logo
- Handle platform-specific resizing/cropping
- Optimize and save images per platform
- This is the most complex component

**4e. VariantGenerator** (`variants.py`)
- Create variant tweaks (color shifts, positioning)
- Implement heuristic CTR scoring (0.0-1.0)
- Sort variants by score

**4f. ThumbnailDesigner** (`designer.py`)
- Orchestrator: coordinates all components
- Implement `generate_variants()` method
- Input validation
- Error handling

### Step 5: Testing

**Write tests as you go:**

- **test_artifact.py** — Data class creation and serialization
- **test_templates.py** — YAML loading, validation, caching
- **test_colors.py** — Color palette selection
- **test_fonts.py** — Font resolution
- **test_composer.py** — Image rendering, layer composition
- **test_variants.py** — Variant generation, scoring
- **test_designer.py** — End-to-end generation
- **test_integration.py** — Full workflow with real images

**Test strategy:**
- Use real background image (provide test fixture)
- Verify output images exist and have correct dimensions
- Verify file sizes meet platform limits
- Verify variant scores are reasonable (0.0-1.0)

### Step 6: Integration with video_worker.py

**File:** `video_worker.py` (existing file, add thumbnail job handler)

Add a `ThumbnailJobHandler` class that:
- Receives a thumbnail job from the queue
- Calls `ThumbnailDesigner.generate_variants()`
- Stores variants in S3
- Updates database with artifact metadata
- Returns job completion status

See PHASE_2_ARCHITECTURE_DESIGN.md Section 4.1 for integration spec.

### Step 7: Documentation

Update:
- `DEVELOPER.md` — Add "Thumbnail Studio Implementation" section
- `FEATURES.md` — Update status (Phase 3 complete)
- Add inline code documentation (docstrings, type hints)

---

## Technical Constraints & Requirements

### Dependencies

✅ **Allowed:**
- Pillow (PIL) — Image composition
- PyYAML — YAML loading
- psycopg2 — Database queries (already used in API)
- redis (optional) — Image caching
- Python 3.10+ standard library

❌ **Not allowed:**
- External APIs (Figma, Canva, DALL-E, etc.)
- Machine learning libraries (scikit-learn, TensorFlow, etc.)
- File uploads or authentication systems

### Performance Targets

- **Generation time:** <2 seconds per variant (including I/O)
- **File size:** <80 KB YouTube, <50 KB TikTok/Instagram
- **Memory:** <100 MB per job
- **Throughput:** 1000 thumbnails/hour on single machine

### Platforms (8 Total)

```python
PLATFORMS = {
    "youtube": (1280, 720),
    "tiktok": (1080, 1920),
    "instagram": (1080, 1080),
    "facebook": (1200, 628),
    "pinterest": (1000, 1500),
    "linkedin": (1200, 627),
    "bluesky": (1200, 628),
    "x": (506, 506),  # Can be larger, but 506 is common
}
```

All dimensions and formats in PHASE_2_ARCHITECTURE_DESIGN.md Section 2.1.

### Error Handling

Implement custom exceptions in `errors.py`:
- `ThumbnailError` (base)
- `InvalidTemplateError`
- `MissingBackgroundError`
- `FontNotFoundError`
- `ConfigurationError`

Graceful degradation:
- If font unavailable, use fallback
- If cache unavailable, skip caching
- Never crash; always return meaningful error

---

## Success Criteria

### Code Quality
- ✅ All 6 components implemented from specification
- ✅ Type hints on all functions (Python 3.10+ style)
- ✅ Docstrings on all public methods
- ✅ No hardcoded values (everything via YAML config or constants)
- ✅ Clean git history (atomic commits with descriptive messages)

### Testing
- ✅ 40+ unit test cases (minimum)
- ✅ All components tested independently
- ✅ Integration test (end-to-end workflow)
- ✅ Test coverage >90%
- ✅ Tests pass: `pytest tests/ -v`

### Performance
- ✅ Single variant generation: <2 seconds
- ✅ File sizes meet limits
- ✅ Memory usage reasonable (<100 MB)

### Documentation
- ✅ All code has docstrings
- ✅ DEVELOPER.md updated
- ✅ FEATURES.md updated
- ✅ Inline comments for complex logic only

---

## When to Escalate to Codex Standard

Escalate if:
- ❌ Pillow rendering produces incorrect output despite following spec
- ❌ Performance dramatically misses <2 sec target (investigate why)
- ❌ Integration with video_worker.py fails for unclear reasons
- ❌ Component interfaces don't compose cleanly (suggests spec issue)
- ❌ File size optimization needed beyond basic JPEG/PNG compression

**Otherwise, stay with Mini.** The spec is clear; implementation is straightforward.

---

## Reference Documentation

**Must read before starting:**
1. `PHASE_2_ARCHITECTURE_DESIGN.md` — Complete specification (1157 lines)
   - Section 1: Component API specs (read all 6 components)
   - Section 2: YAML configuration format
   - Section 3: Database schema
   - Section 4: Integration points
   - Section 5: Error handling
   - Section 6: Performance targets

**Can reference as needed:**
2. `ROADMAP.md` — Project timeline and context
3. `README.md` — Project overview
4. `API_REFERENCE.md` — REST API (for context only)

**Don't need:**
- PHASE_1_RESEARCH_FINDINGS.md (research is done; decisions are made)
- ARCHITECTURE.md (strategic context; not needed for implementation)
- SESSION_COMPLETION_SUMMARY.md (handoff notes; FYI only)

---

## Workflow

### 1. Setup
```bash
cd ~/.local/video-orchestrator
# Module structure already exists or create it
mkdir -p thumbnail_system/__tests__
```

### 2. Implement in Order
Start with artifact.py → config.py → fonts.py → colors.py → templates.py → composer.py → variants.py → designer.py

### 3. Test as You Go
After each component, write tests. Run: `pytest thumbnail_system/__tests__/ -v`

### 4. Integration
Integrate with video_worker.py and test end-to-end.

### 5. Git Commit
Commit after each major component with descriptive message:
```bash
git add thumbnail_system/
git commit -m "Feat: Implement ThumbnailDesigner orchestrator

- Complete generate_variants() method with platform support
- Input validation and error handling
- CTR scoring implementation
- Full docstrings and type hints

Tests: 8 unit tests, 1 integration test passing"
```

### 6. Documentation
Update DEVELOPER.md and FEATURES.md when components are complete.

---

## Success = Next Phase Ready

When Phase 3 is complete, you'll have:
- ✅ Thumbnail generation working (all 8 platforms)
- ✅ <2 sec generation time verified
- ✅ 40+ tests passing
- ✅ Ready for Says the Bible integration testing
- ✅ Ready for Phase 3B (A/B testing framework)

---

## Questions You Might Have

**Q: What if YAML config doesn't exist?**  
A: Create a minimal one in `~/.config/video-orchestrator/thumbnail-system.yaml` with basic templates. See PHASE_2_ARCHITECTURE_DESIGN.md for full schema.

**Q: Should I use async/await?**  
A: No. Keep it synchronous. Fast enough for 2-sec target.

**Q: What if Pillow rendering is too slow?**  
A: Profile first. If > 2 sec, check: background image size (pre-scale?), caching (fonts?), rendering method (try different Pillow modes).

**Q: Do I need Redis for caching?**  
A: No. Start with in-memory caching. Add Redis only if needed.

**Q: How do I test without real images?**  
A: Create test fixtures: small PNG files (100×100 px) in `tests/fixtures/`. Tests use those.

---

## You Are Ready

**Everything you need is documented.** Specification is clear. No ambiguity. Implement as written.

**Start with artifact.py. Work your way to designer.py. Test after each component. Escalate only if integration breaks unexpectedly.**

Good luck! 🚀

---

**Phase 3 Prompt prepared by:** Claude Haiku 4.5  
**Date:** 2026-05-25  
**Target Model:** Codex Mini  
**Estimated Duration:** 20 hours  
**Success Criteria:** All components working, <2 sec/variant, 40+ tests passing
