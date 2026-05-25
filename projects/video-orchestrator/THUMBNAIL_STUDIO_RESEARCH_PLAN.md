# Thumbnail Studio Research & Rebuild — Comprehensive Plan

> Historical research artifact. This document records the investigation that led to the shared Video Orchestrator boundary. It is not the canonical workflow spec; use `project-onboarding-split.md` and the current strategy/roadmap for the active split.

**Timeline:** 2026-05-25 onwards
**Goal:** Rebuild shared thumbnail processing as a modular, scalable component for Brain Core using project-repo inputs as reference only
**Approach:** Research first, understand best practices, design clean architecture, then implement

## Phase 1: Research (Week 1)

### 1.1 Says the Bible Codebase Review
**Goal:** Understand current implementation, identify what works + what's spaghetti

**Questions to answer:**
- How does Says the Bible currently design thumbnails?
- What design patterns/templates exist?
- How does it generate variants (A/B)?
- How does it interact with YouTube API?
- What's the quality level (production-ready vs. rough)?
- What dependencies does it have? (PIL, fonts, templates, etc.)
- How does it handle branding consistency?
- Is it maintainable or tightly coupled?

**Artifacts to create:**
- `says_the_bible_architecture_review.md` (10–15 pages)
- Code snippets of key functions
- Architecture diagram (current)
- Assessment: "Production quality" or "Needs rebuild"

### 1.2 Thumbnail Design Industry Best Practices
**Goal:** Research what world-class thumbnail systems look like

**Topics:**
- YouTube creator community standards (thumbnail design psychology)
- A/B testing frameworks for thumbnails
- Design system / component library approaches
- Template-based vs. generative approaches
- Performance optimization (image format, size, compression)
- Accessibility (contrast ratios, readability, color safety)
- Platform-specific considerations (YouTube 1280×720, TikTok, Instagram, etc.)

**Tools/Platforms to research:**
- YouTube Creator Studio thumbnail guidelines
- TubeBuddy / VidIQ thumbnail analysis
- Canva API (template-based design)
- Figma plugins for thumbnail generation
- AI image generation (DALL-E, Midjourney, Stable Diffusion for backgrounds)

**Deliverables:**
- `thumbnail_design_industry_standards.md` (8–10 pages)
- "Best practices" checklist
- Design system patterns (shadows, gradients, fonts, colors)

### 1.3 NotebookLM Research Synthesis
**Goal:** Create comprehensive research notebook via NotebookLM

**Input sources:**
1. Says the Bible codebase (local repo)
2. YouTube creator guidelines (web)
3. Academic papers on thumbnail CTR psychology
4. Design system documentation (Figma, shadcn)
5. This plan

**NotebookLM outputs:**
- Comprehensive research summary (Q&A mode)
- Audio podcast synthesizing findings
- Key insights spreadsheet
- Recommended architecture patterns
- Phased implementation roadmap

**Artifact:** `notebooklm_thumbnail_research_synthesis.md`

---

## Phase 2: Architecture Design (Week 2)

### 2.1 Component Architecture
**Design:**
- ThumbnailDesigner (core generator)
- TemplateLibrary (design templates)
- FontManager (typography system)
- ColorPalette (brand colors)
- VariantGenerator (A/B variants)
- ImageComposer (Pillow layer)
- ImageCache (optimization)

**Decisions:**
- Modular vs. monolithic
- Dependency injection or singletons
- Where to cache (in-memory vs. Redis vs. S3)
- Configuration format (JSON, YAML, dataclass)
- Error handling strategy

### 2.2 Data Flow Diagram
```
Input: episode_title, background_image, brand_context
  ↓
TemplateLibrary (load templates)
  ↓
ColorPalette (select colors from context)
  ↓
FontManager (resolve fonts)
  ↓
ImageComposer (render variant A)
  ↓
ImageComposer (render variant B)
  ↓
VariantGenerator (score, add metadata)
  ↓
Output: [variant_a.jpg, variant_b.jpg] + metadata
```

### 2.3 Configuration Design
```yaml
# ~/.config/video-orchestrator/thumbnail-system.yaml
design_system:
  brand: yeshua_academy
  platforms: [youtube, tiktok, instagram]
  
templates:
  bold-text:
    description: "Bold headline, high contrast"
    layers:
      - type: background
        cover_fit: true
      - type: scrim
        color: "#000000"
        opacity: 0.3
      - type: text
        variable: headline
        font: "Inter-Bold"
        size: 56
        color: "#FFFFFF"
        position: "bottom-center"
  
  minimal-curiosity:
    description: "Minimalist, question-mark style"
    layers:
      - type: background
      - type: text
        variable: headline
        font: "Inter-Regular"
        size: 48
```

### 2.4 API Contract
```python
class ThumbnailDesigner:
    def generate_variants(
        self,
        episode_title: str,
        background_image: Path,
        target_platforms: list[str],  # ["youtube", "tiktok"]
        template_ids: list[str] = None,  # ["bold-text", "minimal"]
        variant_count: int = 2,  # A/B testing
    ) -> ThumbnailArtifact:
        """Generate platform-specific thumbnails with variants."""
```

**Design principles:**
- Platform-aware (1280×720 for YouTube, 1080×1080 for Instagram, etc.)
- Variant scoring (CTR likelihood estimate)
- Metadata tracking (template used, colors, fonts, etc.)
- Caching strategy (templates, fonts, AI results)

---

## Phase 3: Code Review & Decision
**Checkpoint:** 
- Is Says the Bible implementation production-quality? → **Use selectively**
- Is it spaghetti? → **Rebuild from scratch**

**Decision matrix:**
| Aspect | Says the Bible | Brain-core | Action |
|--------|---|---|---|
| Code organization | monolithic | modular | Rebuild |
| Template system | hardcoded | config-driven | Rebuild |
| A/B testing | basic | statistical | Enhance |
| Platform support | YouTube only | multi-platform | Expand |
| Performance | unknown | optimized | Rebuild |
| Maintainability | ? | clear ownership | Rebuild |

---

## Phase 4: Implementation (Week 3–4)

### 4.1 Core Modules (Week 3)
```
~/.local/video-orchestrator/
├── thumbnail_system/
│   ├── __init__.py
│   ├── designer.py          # ThumbnailDesigner class
│   ├── templates.py         # TemplateLibrary
│   ├── fonts.py             # FontManager
│   ├── colors.py            # ColorPalette
│   ├── variants.py          # VariantGenerator
│   ├── composer.py          # ImageComposer (Pillow)
│   ├── cache.py             # Caching layer
│   ├── platform_specs.py    # Platform-specific configs
│   └── config.py            # Configuration loading
```

### 4.2 Integration (Week 4)
- Wire into video_worker.py (thumbnail job)
- API endpoints for manual thumbnail generation
- CLI commands: `vo thumbnail generate --episode genesis-001 --platforms youtube,tiktok`
- Tests: `test_thumbnail_system.py`

---

## Phase 5: Validation & Migration

### 5.1 Quality Assessment
- Compare output: Says the Bible vs. brain-core
- CTR performance (if data available)
- Visual inspection (aesthetics, consistency)
- Performance metrics (generation time, file size)

### 5.2 Says the Bible Migration
- Parallel run: Both systems generate
- Compare results
- Gradual cutover

---

## Research Questions to Investigate

1. **Design Psychology:**
   - What thumbnail characteristics drive CTR? (colors, faces, text, contrast)
   - Font psychology: serif vs. sans-serif impact on CTR
   - Color theory: which colors perform best per content type

2. **Technical:**
   - How to implement variant scoring? (ML or heuristic)
   - Image optimization: JPEG quality vs. file size tradeoff
   - Font licensing: what fonts are legal to use commercially
   - Caching strategy: Redis vs. in-memory for templates

3. **Platform-specific:**
   - YouTube: 1280×720, JPEG, <80KB recommended
   - TikTok: 1080×1920 (vertical), aspect ratio flexibility
   - Instagram: 1080×1080, square format dominates
   - Pinterest: 1000×1500, tall vertical format

4. **Says the Bible:**
   - Current template system (how many templates? types?)
   - A/B test history (what works best?)
   - Performance issues (generation time, failures?)
   - Code quality (tests, documentation, maintainability?)

---

## Deliverables Timeline

| Week | Deliverable | Status |
|------|---|---|
| 1 | Research synthesis (Says the Bible + industry) | 🟡 Planned |
| 1 | NotebookLM podcast + insights | 🟡 Planned |
| 2 | Architecture design doc | 🟡 Planned |
| 2 | Code review + rebuild decision | 🟡 Planned |
| 3 | Core thumbnail_system modules | 🟡 Planned |
| 4 | Integration + API endpoints | 🟡 Planned |
| 4 | Tests + documentation | 🟡 Planned |
| 5 | Quality validation | 🟡 Planned |
| 5 | Says the Bible migration plan | 🟡 Planned |

---

## Success Criteria

✅ **Modular design:** Each component independently testable  
✅ **Configuration-driven:** No hardcoding, all via configs  
✅ **Platform-aware:** Generates correct dimensions per platform  
✅ **Variant generation:** Creates statistically scored A/B variants  
✅ **Performance:** Generation < 2 sec per variant  
✅ **Maintainability:** Clear code, comprehensive tests, documented  
✅ **Better than Says the Bible:** Production-quality, scalable  
✅ **Integration ready:** Wired into brain-core pipeline  

---

## Commands to Execute Research

```bash
# Phase 1.1: Review Says the Bible repo
cd /Users/Office/Repos/yeshuaacademy/says-the-bible
find . -name "*thumbnail*" -o -name "*design*" | head -20
grep -r "PIL\|Pillow\|Image" --include="*.py" | head -20

# Phase 1.3: Create NotebookLM research
notebooklm create \
  --name "Thumbnail Studio Research" \
  --sources \
    "/Users/Office/Repos/yeshuaacademy/says-the-bible" \
    "https://support.google.com/youtube/answer/72431" \
    "https://www.youtube.com/creator/design-guidelines" \
  --output-format "podcast,qa,spreadsheet"
```

---

## Next: Trigger Phase 1 Research

After approval:
1. Run Says the Bible codebase review
2. Create NotebookLM research notebook
3. Synthesize findings into architecture recommendations
4. Present decision: rebuild vs. adapt
