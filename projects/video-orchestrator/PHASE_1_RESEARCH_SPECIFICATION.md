# Thumbnail Studio Phase 1: Research Specification

**Date:** 2026-05-25  
**Goal:** Research thumbnail design best practices, psychology, platform requirements, and technical implementation patterns to inform brain-core Thumbnail Studio architecture  
**Method:** Multi-source investigation + NotebookLM synthesis  
**Output:** Comprehensive research synthesis + architecture recommendations

---

## Research Dimensions

### 1. YouTube Thumbnail Best Practices

**Questions:**
- What thumbnail characteristics drive highest CTR?
- YouTube's official guidelines and recommendations
- Creator community standards and case studies
- Color psychology and contrast requirements
- Text overlay best practices (font sizes, readability)
- Face detection and human psychology impact
- Aspect ratios and safe zones
- Image format and compression (JPEG quality, file size limits)

**Sources to investigate:**
- YouTube Creator Academy (official guidelines)
- YouTube Data API documentation
- TubeBuddy / VidIQ thumbnail analysis tools
- Reddit r/Creators, r/YouTubers thumbnail discussions
- Case studies: high-performing YouTube channels in Christian/educational space
- Academic research on thumbnail psychology

**Key metrics to understand:**
- CTR improvement through A/B testing
- Variance in performance by content type (narrative vs. educational)
- Seasonal/cultural factors affecting thumbnail appeal
- Consistency vs. novelty tradeoff

---

### 2. Multi-Platform Thumbnail Requirements

**Dimensions per platform:**
| Platform | Ideal Size | Format | Aspect Ratio | Special Notes |
|----------|-----------|--------|---|---|
| YouTube | 1280×720 | JPEG/PNG | 16:9 | <80KB recommended |
| TikTok | 1080×1920 | MP4 cover | 9:16 | Vertical, motion optional |
| Instagram | 1080×1080 | JPEG/PNG | 1:1 | Square, Reels use 9:16 |
| Pinterest | 1000×1500 | JPEG/PNG | 2:3 | Tall vertical, evergreen |
| Facebook | 1200×628 | JPEG/PNG | 1.91:1 | Preview image large |
| LinkedIn | 1200×627 | JPEG/PNG | 1.91:1 | Professional aesthetic |

**Questions:**
- How do thumbnails vary by platform?
- What works on YouTube vs. TikTok vs. Pinterest?
- Consistency vs. platform-specific optimization?
- Mobile-first considerations?

---

### 3. Design System & Template Patterns

**Research areas:**
- Template-based design systems (Figma, Canva)
- Component architecture (backgrounds, text layers, overlays, frames)
- Layering approach (background → scrim → text → accent)
- Design tokens (colors, typography, spacing)
- Template versioning and maintenance
- Brand consistency frameworks

**Questions:**
- How many template variations are needed?
- What template system supports rapid generation + consistency?
- How to handle brand customization per project?
- How to version and evolve templates without breaking existing outputs?

---

### 4. A/B Testing Frameworks for Thumbnails

**Research:**
- Time-slice methodology (7-day per variant)
- CTR measurement and significance
- Statistical power calculation
- Winner determination algorithms
- Multivariate testing approaches
- Tools: YouTube Analytics, TubeBuddy, custom databases

**Questions:**
- What's the minimum sample size for statistical significance?
- How long should each variant run?
- Can we automate variant selection based on CTR?
- How to track A/B results longitudinally?

---

### 5. AI/Generative Approaches

**Technologies to investigate:**
- Stable Diffusion for background generation
- DALL-E 3 for custom imagery
- Midjourney for high-quality outputs
- ComfyUI for automated image workflows
- Prompt engineering for thumbnail generation

**Questions:**
- Should we use AI-generated backgrounds or upload photos?
- Template + AI hybrid approach?
- Quality vs. generation time tradeoff?
- Cost analysis: AI generation vs. pre-made templates?

---

### 6. Technical Implementation Patterns

**Architecture considerations:**
- Pillow (PIL) for image composition
- Jinja2 for template rendering
- OpenCV for image processing
- Caching strategies (Redis, in-memory, S3)
- Variant scoring algorithms
- Performance optimization

**Questions:**
- Single-threaded vs. parallel variant generation?
- How to cache fonts and resources?
- Image optimization pipeline?
- Error handling for missing fonts/resources?

---

### 7. Yeshua Academy / Faith-Based Context

**Specific considerations:**
- Current Says the Bible thumbnail aesthetic
- Brand colors (if any exist)
- Typography preferences
- Audience expectations (faith community CTR drivers)
- Case studies from similar theology/educational channels
- Biblical/spiritual imagery considerations

**Questions:**
- What makes a faith-based thumbnail compelling?
- How does Bible study content CTR differ from entertainment?
- Brand consistency requirements?
- Color psychology in faith context?

---

## Research Outputs Required

### 1. says_the_bible_architecture_review.md
**Content:**
- Current thumbnail implementation walkthrough
- Code quality assessment
- Template system analysis
- A/B testing approach
- Integration with YouTube API
- Dependencies and risks
- Recommendation: adapt vs. rebuild

**Length:** 5–10 pages

---

### 2. thumbnail_design_best_practices.md
**Content:**
- YouTube CTR psychology summary
- Multi-platform requirements comparison
- Design system patterns (template architecture)
- A/B testing frameworks
- Technical implementation best practices
- Font licensing and compliance
- Performance optimization strategies

**Length:** 8–12 pages

---

### 3. notebooklm_thumbnail_research_synthesis.md
**Content:**
- Comprehensive Q&A mode responses
- Key findings and insights
- Recommended architecture patterns
- Decision matrix (rebuild vs. adapt)
- Phased implementation roadmap

**Artifacts from NotebookLM:**
- Podcast (audio synthesis of research)
- Interactive Q&A notebook
- Key facts spreadsheet

---

### 4. thumbnail_architecture_recommendation.md
**Content:**
- Architecture decision (modular components)
- Component diagram
- Data flow diagram
- Configuration format (YAML or JSON)
- API contract examples
- Success criteria for Phase 2–4

---

## Research Timeline

| Task | Duration | Status |
|------|----------|--------|
| 1.1 Says the Bible codebase review | 2–3 hours | ⏳ To do |
| 1.2 Industry best practices research | 2–3 hours | ⏳ To do |
| 1.3 NotebookLM synthesis | 1–2 hours | ⏳ To do |
| Review + synthesis | 1 hour | ⏳ To do |
| **Total Phase 1** | **6–9 hours** | ⏳ To do |

---

## NotebookLM Research Notebook Setup

**Notebook name:** "Thumbnail Studio for Brain-Core"

**Source documents:**
1. **YouTube Official Guidelines**
   - https://support.google.com/youtube/answer/72431
   - https://www.youtube.com/features/creator-studio
   
2. **Platform Requirements**
   - YouTube Data API documentation
   - Instagram Graph API documentation
   - TikTok API documentation
   - Pinterest API documentation

3. **Design & UX Research**
   - Figma design system documentation (best practices)
   - Color theory and psychology resources
   - Typography best practices
   - Accessibility guidelines (WCAG)

4. **A/B Testing Frameworks**
   - Statistical significance in A/B testing
   - Time-slice methodology
   - CTR measurement approaches

5. **This Document**
   - PHASE_1_RESEARCH_SPECIFICATION.md
   - THUMBNAIL_STUDIO_RESEARCH_PLAN.md

---

## Key Research Questions for NotebookLM

1. **What are the most important factors in YouTube thumbnail CTR?**
2. **How do successful theology/educational YouTube channels design thumbnails?**
3. **What's the difference between template-based and AI-generated thumbnail approaches?**
4. **What A/B testing framework minimizes time-to-winner while maintaining statistical validity?**
5. **How can a single thumbnail system support 8 platforms with different dimensions?**
6. **What font licensing considerations exist for commercial thumbnail generation?**
7. **How should a modular thumbnail system be architected for maintainability and extensibility?**
8. **What are performance benchmarks for thumbnail generation (time, file size)?**
9. **How can we implement variant scoring (CTR prediction) without machine learning?**
10. **What are industry standards for thumbnail image compression and optimization?**

---

## Decision Matrix: Rebuild vs. Adapt

After research, we'll evaluate Says the Bible implementation against brain-core requirements:

| Factor | Says the Bible | Brain-Core Requirement | Action |
|--------|---|---|---|
| **Code organization** | ? | Modular + testable | ⏳ Determine |
| **Template system** | ? | Config-driven, versioned | ⏳ Determine |
| **Platform support** | ? | 8 platforms (not just YouTube) | ⏳ Determine |
| **A/B testing** | ? | Statistical + automated | ⏳ Determine |
| **Scalability** | ? | Handles 100s jobs/day | ⏳ Determine |
| **Error handling** | ? | Graceful degradation | ⏳ Determine |
| **Performance** | ? | <2 sec/variant | ⏳ Determine |

**Decision rule:**
- If Says the Bible is production-quality in 6/7 areas → **Adapt selectively**
- If Says the Bible is poor-quality in 4+ areas → **Rebuild from scratch**

---

## Next Steps After Phase 1 Research

1. ✅ Complete this research specification
2. ⏳ Create NotebookLM research notebook
3. ⏳ Execute research (2–3 hours)
4. ⏳ Synthesize findings into architecture recommendations
5. ⏳ Present decision: rebuild vs. adapt
6. ⏳ Proceed to Phase 2 (Architecture Design)

---

## Success Criteria for Phase 1

✅ Comprehensive understanding of thumbnail CTR drivers  
✅ Clear API contract for ThumbnailDesigner  
✅ Decision made: rebuild or adapt Says the Bible code  
✅ Architecture patterns documented  
✅ Phase 2 can proceed with confidence  

---

## References

- THUMBNAIL_STUDIO_RESEARCH_PLAN.md (high-level plan)
- brain/projects/video-orchestrator/README.md (context)
- YouTube Creator Academy
- Design system documentation (Figma, shadcn/ui)
