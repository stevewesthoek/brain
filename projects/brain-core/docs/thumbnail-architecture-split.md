# Thumbnail Architecture Split: Shared Engine vs. Project Definitions

**Status:** Foundational architecture decision for Phase 3 implementation  
**Date:** 2026-05-25  
**Applies to:** All projects using brain-core Video Orchestrator thumbnail rendering

---

## Overview

The thumbnail rendering system splits responsibility between **brain-core** (shared engine) and **project repos** (editorial definitions). This prevents code duplication, maintains quality consistency, and allows projects to customize without modifying shared infrastructure.

---

## Unambiguous Boundary

### Brain-Core Owns & Maintains

**1. Rendering Engine (Python code)**
- Location: `~/.local/video-orchestrator/worker/thumbnail_designer.py` and modules
- Components:
  - `ThumbnailDesigner` — orchestrator, receives requests, routes to components
  - `TemplateLibrary` — loads and caches YAML template definitions
  - `ColorPalette` — applies color schemes to template layers
  - `FontManager` — resolves system fonts, handles caching
  - `ImageComposer` — Pillow-based rendering (pixels → JPEG/PNG/WebP)
  - `VariantGenerator` — creates 3-variant sets, scores confidence (0-1)
- Responsibility: Execute rendering logic reliably, consistently, at performance target (<2 sec/variant)

**2. Template Name Registry (discovery)**
- Location: `~/.local/video-orchestrator/config/template-registry.json` or similar
- Content: Simple list of available template names (strings)
  - Example: `["bold-text", "image-focus", "curiosity-hook", "minimal-text", "accent-bar", "badges-icons"]`
- Responsibility: Let projects discover what templates can be requested
- Updated by: Brain-core maintainers when new base templates are added

**3. Generated Artifacts (output storage)**
- Location: S3 bucket or local artifact store (controlled by brain-core)
- Content: Generated JPEG/PNG files, metadata JSON
- Responsibility: Store artifacts, enforce lifecycle (cleanup old files, expire failed attempts)
- Access: Read-only from project repos via S3 URI

**4. A/B Testing Infrastructure (database + analytics)**
- Location: `thumbnail_a_b_test_results` PostgreSQL table in brain-core DB
- Responsibility: Track variant performance, enable winner declaration, support statistical analysis
- API: `/api/video-orchestrator/thumbnails/a-b-results`, `/api/video-orchestrator/thumbnails/declare-winner`

### Project Repo Owns & Maintains

**1. Template Definitions (YAML files)**
- Location: `projects/video-generator/config/templates/` (or project-specific location)
- Content: Layer structure, text positioning, font choices, opacity, effects, conditional logic
  - Example files: `bold-text.yaml`, `image-focus.yaml`, `curiosity-hook.yaml`
  - Each file defines: layers array, text placeholders, positions, sizes, colors, effects
- Responsibility: Define visual structure for project's brand and editorial needs
- Customization: Project can create custom templates without touching brain-core
- Updated by: Project designers/editors when rebranding or adding new styles

**2. Color Scheme Definitions (JSON/YAML files)**
- Location: `projects/video-generator/config/colors/`
- Content: Mapping {scheme_name} → {hex_colors, gradients, overlays}
  - Example files: `old_testament.json`, `new_testament.json`, `default.json`
  - Each defines: primary color, accent, text, overlays, gradients
- Responsibility: Establish project's brand identity and color language
- Customization: Project can define as many schemes as needed
- Updated by: Brand/marketing team when visual identity changes

**3. Admin UI (React/TypeScript components)**
- Location: Brain Console (e.g., `projects/brain-console-obsidian/src/components/VO/ThumbnailStudioPanel.ts`)
- Responsibility: Present template choices, color schemes, title input to operators
- Features: Preview variants before approval, select winning thumbnail, edit metadata
- Customization: Project-specific workflows (e.g., "Show faith category selector before template choice")
- Updated by: Project frontend team per UX requirements

**4. Template Selection & Approval Workflow**
- Location: Project admin workflows (manual or via approval queue)
- Responsibility: Let operators choose template + color scheme + title before queuing
- Customization: Project decides approval gates, editorial rules, auto-selection logic
- Updated by: Project workflow team

**5. Template Overrides (optional, project-specific logic)**
- Location: Optional project code
- Responsibility: Apply project-specific modifications to templates at request time
  - Example: "Add a verse reference to faith-specific template"
  - Example: "Change font size based on title length"
- Customization: Project controls all override logic
- Updated by: Project developers as editorial needs evolve

---

## API Contract: Request and Response

### Request Format
Project calls brain-core `/queue/thumbnail` endpoint:

```json
POST http://localhost:4877/api/video-orchestrator/queue/thumbnail
Content-Type: application/json

{
  "episode_id": "ge-001",
  "title": "Genesis 1 — Creation",
  "background_image_url": "s3://bucket/backgrounds/genesis-1.jpg",
  "template_definition": {
    "name": "image-focus",
    "layers": [
      {
        "type": "background",
        "source": "background_image_url",
        "opacity": 1.0
      },
      {
        "type": "scrim",
        "color": "#000000",
        "opacity": 0.3
      },
      {
        "type": "text",
        "content": "title",
        "font": "Arial Bold",
        "size": 48,
        "color": "#FFFFFF",
        "position": "center",
        "margin": 20
      }
    ]
  },
  "color_scheme": {
    "primary": "#8B4513",
    "accent": "#FFD700",
    "text": "#FFFFFF",
    "scrim": "#000000"
  }
}
```

### Response Format
Brain-core returns 3 variants with confidence scores:

```json
{
  "job_id": "thumb-ge-001-12345",
  "episode_id": "ge-001",
  "status": "complete",
  "variants": [
    {
      "variant_id": "v1",
      "url": "s3://brain-core-artifacts/thumb-ge-001-v1.jpg",
      "confidence_score": 0.87,
      "template_applied": "image-focus",
      "colors_applied": "old_testament",
      "metadata": {
        "size_bytes": 75432,
        "dimensions": "1280x720",
        "format": "jpeg"
      }
    },
    {
      "variant_id": "v2",
      "url": "s3://brain-core-artifacts/thumb-ge-001-v2.jpg",
      "confidence_score": 0.84,
      "template_applied": "image-focus",
      "colors_applied": "old_testament",
      "metadata": {
        "size_bytes": 73891,
        "dimensions": "1280x720",
        "format": "jpeg"
      }
    },
    {
      "variant_id": "v3",
      "url": "s3://brain-core-artifacts/thumb-ge-001-v3.jpg",
      "confidence_score": 0.79,
      "template_applied": "image-focus",
      "colors_applied": "old_testament",
      "metadata": {
        "size_bytes": 71244,
        "dimensions": "1280x720",
        "format": "jpeg"
      }
    }
  ]
}
```

---

## What Does NOT Cross the Boundary

**Project repo never receives or stores:**
- Rendering engine code (no duplicate ThumbnailDesigner)
- System font resolution logic (no font caching)
- Variant generation algorithm (no duplicate scoring)
- A/B testing infrastructure (no duplicate database tables)

**Brain-core never stores or knows about:**
- Template YAML/JSON files (no project branding hardcoded)
- Project-specific color schemes (no Says the Bible knowledge)
- Project admin UI workflows (no console-specific logic)
- Project editorial decisions (no approval gate rules)

---

## Integration Flow

### 1. Project Admin Selects Template
- User opens Admin Console (Brain Console VO panel)
- Selects template from dropdown: "image-focus"
- Selects color scheme: "old_testament"
- Enters title: "Genesis 1 — Creation"
- Clicks "Generate Thumbnail"

### 2. Project Repo Prepares Request
- Project code loads `config/templates/image-focus.yaml` locally
- Project code loads `config/colors/old_testament.json` locally
- Project code applies any project-specific overrides (e.g., add verse reference)
- Project code constructs API request with template_definition and color_scheme
- Project code POSTs to brain-core `/queue/thumbnail` endpoint

### 3. Brain-Core Renders
- Brain-core receives request
- TemplateLibrary loads and validates template definition
- ColorPalette applies color scheme to layers
- ImageComposer renders 3 variants with Pillow
- VariantGenerator scores each variant (0-1 confidence)
- Uploads variants to S3
- Returns response with URLs and scores

### 4. Project Admin Approves
- Project admin sees 3 variants in console
- Admin selects winner or chooses to regenerate
- Admin clicks "Approve" which queues the metadata generation job
- Metadata job includes selected thumbnail URL

---

## Verification: Why This Split Works

| Goal | How Achieved | Verification |
|------|--------------|--------------|
| No duplication | Project never copies rendering code | Project repo has no `ThumbnailDesigner` class |
| Shared quality | All projects use same rendering engine | All thumbnails use brain-core API |
| Brand independence | Projects define their own templates/colors | Template YAML files are project-specific |
| Easy onboarding | New project only needs template files | New project creates `config/templates/` folder |
| Performance | Rendering targets enforced centrally | Brain-core maintains <2 sec/variant SLA |
| Testing | A/B testing runs on shared infrastructure | All projects benefit from CTR analysis |
| Scaling | Add rendering capacity once, all projects scale | Brain-core adds CPU/memory → all projects faster |

---

## Project Onboarding Checklist

To integrate a new project with brain-core thumbnail rendering:

- [ ] 1. Create `config/templates/` directory in project repo
- [ ] 2. Define template YAML files (copy structure from PHASE_2_ARCHITECTURE_DESIGN.md)
- [ ] 3. Create `config/colors/` directory
- [ ] 4. Define color scheme JSON files (project-specific hex colors)
- [ ] 5. Build admin UI to let operators select template + color scheme
- [ ] 6. Test: call `/queue/thumbnail` API with sample request
- [ ] 7. Verify: receive 3 variants with confidence scores
- [ ] 8. Integrate: wire variant URLs into metadata generation job
- [ ] 9. A/B test: queue thumbnails, track CTR over 7-day windows
- [ ] 10. Declare winner: call `/api/video-orchestrator/thumbnails/declare-winner` after 7 days

---

## Implementation Timeline

**Phase 3: Thumbnail Engine Implementation (brain-core)**
- Deliver ThumbnailDesigner, TemplateLibrary, ColorPalette, FontManager, ImageComposer, VariantGenerator
- All tests passing, <2 sec/variant performance target met
- API contract stable and documented

**Phase 3B: A/B Testing Framework (brain-core)**
- Deliver A/B testing database schema, API endpoints, winner declaration logic
- 7-day time-slice implementation

**Phase 4: Project Integration (project repo)**
- Says the Bible: migrate to brain-core rendering
- Project defines templates, colors, approval workflow
- Parallel testing before cutover

---

## Reference

- **Full architecture:** `PHASE_2_ARCHITECTURE_DESIGN.md`
- **Onboarding guide:** `project-onboarding-split.md`
- **Strategy:** `video-orchestrator-strategy.md`
- **Roadmap:** `video-orchestrator-roadmap.md`
