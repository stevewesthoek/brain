# Phase 4: Says the Bible Integration — Complete Plan

**Status:** Planning phase (ready to execute)  
**Date:** 2026-05-25  
**Scope:** Integrate brain-core thumbnail engine with Says the Bible pipeline  
**Principle:** Keep both repos in unison — shared features must complete in both simultaneously

---

## Integration Overview

**Says the Bible** currently has its own thumbnail rendering pipeline. **Brain-core** now has a shared thumbnail engine. Phase 4 integrates them so:

1. **Says the Bible remains the source of truth for:** editorial decisions, template definitions, color schemes, operator UX
2. **Brain-core becomes the rendering engine for:** thumbnail generation, A/B testing infrastructure, variant generation
3. **Both repos benefit from:** shared quality improvements, shared performance targets, shared A/B testing

### The Boundary (from Phase 3 docs)

| Component | Owner | Responsibility |
|-----------|-------|-----------------|
| Template YAML files | Says the Bible repo | Define layer structure, fonts, positions for project branding |
| Color scheme JSON | Says the Bible repo | Define project colors (old testament, new testament, default) |
| Admin UI | Says the Bible repo | Let operators select template, color scheme, title before queueing |
| Thumbnail rendering engine | Brain-core | Render layers with Pillow, generate variants, score confidence |
| Artifact storage | Brain-core | Store generated thumbnails, provide URLs |
| A/B testing | Brain-core | Database schema, analytics, winner determination |

---

## Architecture: Request Flow

```
[Says the Bible Admin UI]
    ↓
  Operator selects episode, template, colors, title
    ↓
[Says the Bible API Route]
    ↓
  Load template YAML from project repo
  Load color scheme JSON from project repo
  Construct API request
    ↓
[Brain-Core API Endpoint: POST /queue/thumbnail]
    ↓
  ThumbnailDesigner.design()
    - Load template definition (from request)
    - Load color scheme (from request)
    - Render 3 variants with Pillow
    - Calculate confidence scores
    - Save artifacts to S3/local
    - Return {variants: [...]}
    ↓
[Back to Says the Bible]
    ↓
  Receive 3 variant URLs + confidence scores
  Store in project artifact
  Operator approves one variant
  Queue metadata job (includes thumbnail URL)
```

---

## Integration Tasks (Sequenced)

### Phase 4A: Brain-Core API Endpoint (Brain Repo)

**Goal:** Add REST endpoint that accepts thumbnail requests  
**Impact:** Brain-core only  
**Status:** Ready (Phase 3 modules exist)

#### Task 4A-1: Add `/queue/thumbnail` REST Endpoint
- **File:** `projects/brain-core/src/api/routes.ts`
- **New endpoint:** `POST /api/video-orchestrator/queue/thumbnail`
- **Request format:** See Phase 3 docs (template_definition, color_scheme, title, background_image_url, platform)
- **Response format:** ThumbnailArtifact JSON with 3 variants
- **Error handling:** 400 (invalid platform), 503 (rendering error)

#### Task 4A-2: Integrate ThumbnailDesigner into Routes
- **Import:** `from ~/.local/video-orchestrator/worker import thumbnail_designer`
- **Error handling:** Catch rendering errors, return 503 with error message
- **Logging:** Log all requests and responses to artifact

#### Task 4A-3: Add Tests for Thumbnail Endpoint
- **File:** `projects/brain-core/tests/test_api_thumbnail_endpoint.ts`
- **Test cases:** valid request, missing fields, invalid platform, rendering success

**Verification:**
```bash
# Start brain-core
npm start  # localhost:4877

# Test endpoint
curl -X POST http://localhost:4877/api/video-orchestrator/queue/thumbnail \
  -H "Content-Type: application/json" \
  -d '{
    "episode_id": "test-001",
    "title": "Genesis Creation",
    "template_definition": {...},
    "color_scheme": {...}
  }'
```

---

### Phase 4B: Says the Bible Integration (Says the Bible Repo)

**Goal:** Update Says the Bible pipeline to call brain-core API instead of local rendering  
**Impact:** Says the Bible repo + both repos must stay in sync  
**Status:** Ready after 4A

#### Task 4B-1: Create Template Definitions in Project Repo
- **Directory:** `says-the-bible/src/config/thumbnail-templates/`
- **Files:** `default.yaml`, `old_testament.yaml`, `new_testament.yaml`
- **Content:** Layer structures (background, scrim, text, accent) matching current design
- **Source:** Extract from existing `platform-text-overlays.mjs` hardcoded templates

**Example:**
```yaml
# default.yaml
name: default
layers:
  - type: background
    source: background_image_url
    opacity: 1.0
  - type: scrim
    color: "#000000"
    opacity: 0.3
  - type: text
    content: title
    font: Arial Bold
    size: 48
    color: "#FFFFFF"
    position: [640, 360]
```

#### Task 4B-2: Create Color Scheme Definitions
- **Directory:** `says-the-bible/src/config/color-schemes/`
- **Files:** `default.json`, `old_testament.json`, `new_testament.json`
- **Content:** Hex colors (primary, accent, text, scrim)

**Example:**
```json
{
  "name": "old_testament",
  "primary": "#8B4513",
  "accent": "#FFD700",
  "text": "#FFFFFF",
  "scrim": "#000000"
}
```

#### Task 4B-3: Update Pipeline to Call Brain-Core API
- **File:** `scripts/pipeline/00d-generate-thumbnail-overlay.mjs` (refactor)
- **Old behavior:** Use local ImageMagick to render overlay
- **New behavior:** 
  1. Load template YAML from `src/config/thumbnail-templates/`
  2. Load color scheme JSON from `src/config/color-schemes/`
  3. POST to `http://localhost:4877/api/video-orchestrator/queue/thumbnail`
  4. Wait for response (or async queue job ID)
  5. Receive 3 variant URLs
  6. Store in artifact
  7. Operator approves (existing flow)

#### Task 4B-4: Update Admin UI to Use Brain-Core
- **File:** `src/app/admin/(authenticated)/thumbnails/page.tsx`
- **Changes:**
  - Load available templates from `src/config/thumbnail-templates/`
  - Load available color schemes from `src/config/color-schemes/`
  - On "Generate" button: call brain-core API
  - Show 3 variants in UI
  - Operator selects one (existing approval flow)

#### Task 4B-5: Add Tests for Says the Bible Brain-Core Integration
- **File:** `tests/integration/thumbnail-brain-core.test.ts`
- **Tests:**
  - API route loads templates correctly
  - API route calls brain-core endpoint
  - Response handling and variant storage
  - Admin UI displays variants

**Verification:**
```bash
# In says-the-bible repo
npm run dev  # localhost:3000

# In another terminal, start brain-core
cd ~/Repos/stevewesthoek/brain/projects/brain-core
npm start  # localhost:4877

# Use admin panel:
# http://localhost:3000/admin/thumbnails
# Select episode → select template → click Generate
# Should see 3 variants from brain-core
```

---

### Phase 4C: Documentation Sync (Both Repos)

**Goal:** Update all references to thumbnail rendering to clarify shared vs. project ownership  
**Impact:** Both repos  
**Status:** Ready after 4B

#### Task 4C-1: Update Says the Bible Thumbnail Roadmap
- **File:** `docs/features/thumbnail-system-roadmap.md`
- **Changes:**
  - Add section: "Brain-Core Integration (Phase 4)"
  - Clarify: templates/colors are project assets, rendering is brain-core
  - Update workflow diagram to show API call
  - Update file list: remove legacy rendering code, keep admin UI

#### Task 4C-2: Create Says the Bible Integration Guide
- **New file:** `docs/guides/brain-core-thumbnail-integration.md`
- **Content:**
  - Why: shared engine improves quality, A/B testing, maintenance
  - Architecture: boundary between project and brain-core
  - Template format: YAML structure
  - Color scheme format: JSON structure
  - API contract: request/response examples
  - Fallback: what happens if brain-core is unavailable
  - Troubleshooting: common issues

#### Task 4C-3: Update Brain-Core Documentation
- **File:** `projects/brain-core/docs/project-onboarding-split.md`
- **Add section:** "Says the Bible (First Project Integration)"
- **Content:**
  - Current status: phase 4A/4B in progress
  - What Says the Bible did (templates, colors, admin UI)
  - What brain-core did (rendering engine, API)
  - API endpoint specification
  - Monitoring: how to verify sync

#### Task 4C-4: Update Both Repos' README Files
- **Brain-core:** `projects/brain-core/README.md`
  - Add: "Phase 4: Says the Bible integration complete"
- **Says the Bible:** `docs/README.md`
  - Add: "Using brain-core API for thumbnail rendering"

---

## Sync Checkpoint: Both Repos Must Complete Together

### Before Phase 4A → 4B Handoff:
- [ ] Brain-core API endpoint is working
- [ ] Tests pass (4A-3)
- [ ] Brain-core documentation updated (4C-3)
- [ ] Commit to brain repo with message referencing Says the Bible integration

### Before Phase 4B → 4C Handoff:
- [ ] Says the Bible has template files
- [ ] Says the Bible has color scheme files
- [ ] Pipeline calls brain-core API successfully
- [ ] Admin UI displays variants from brain-core
- [ ] Tests pass (4B-5)
- [ ] Commit to Says the Bible repo with message referencing brain-core integration

### After Phase 4C:
- [ ] Both repos have updated documentation
- [ ] Both READMEs reflect Phase 4 completion
- [ ] Brain-core docs mention Says the Bible by name
- [ ] Says the Bible docs mention brain-core by name
- [ ] Final commits to both repos are linked (git commit message cross-reference)

---

## Fallback: Brain-Core Unavailable

If brain-core is down during a pipeline run:

**Option 1 (Preferred): Queue and Retry**
- Pipeline detects connection error
- Queues thumbnail job locally with status "pending_brain_core"
- Retries in 30 seconds
- Max 3 retries before falling back

**Option 2: Local Fallback**
- Pipeline falls back to local ImageMagick rendering
- Uses existing `platform-text-overlays.mjs` logic
- Logs warning: "Using local rendering (brain-core unavailable)"
- Variant count: 1 instead of 3 (no A/B test)

**Implementation:** Try brain-core first (happy path), catch error, fall back to Option 1 or 2

---

## A/B Testing (Post-Phase 4B)

Once brain-core rendering is live:

1. **Pipeline creates 3 variants** (from brain-core)
2. **Operator approves one** (in Says the Bible admin)
3. **Variant URL stored in artifact**
4. **After 7 days:**
   - Fetch CTR for all 3 variants from YouTube Analytics
   - Compare CTR performance
   - Call `/api/video-orchestrator/thumbnails/declare-winner` in brain-core
   - Next episode uses winning template + colors

---

## Success Criteria

✅ **Phase 4 is complete when:**
1. Brain-core API endpoint works and has tests
2. Says the Bible pipeline successfully calls brain-core API
3. Says the Bible admin UI displays 3 variants from brain-core
4. Operator can approve and store variant URL
5. Both repos have updated documentation
6. No regression: existing Says the Bible workflow still works
7. Cross-repo commits are linked with clear messages

---

## Timeline & Effort

| Phase | Task | Effort | Dependencies |
|-------|------|--------|--------------|
| 4A | Brain-core API endpoint | 2-3 hours | Phase 3 complete ✅ |
| 4B | Says the Bible integration | 3-4 hours | 4A complete |
| 4C | Documentation sync | 2 hours | 4B complete |
| **Total** | | **7-9 hours** | |

---

## Files Touched (Sync Map)

### Brain-Core Repo
- `projects/brain-core/src/api/routes.ts` — add thumbnail endpoint
- `projects/brain-core/tests/test_api_thumbnail_endpoint.ts` — add tests
- `projects/brain-core/docs/project-onboarding-split.md` — add Says the Bible section
- `projects/brain-core/README.md` — update status

### Says the Bible Repo
- `src/config/thumbnail-templates/` (NEW) — template YAML files
- `src/config/color-schemes/` (NEW) — color scheme JSON files
- `scripts/pipeline/00d-generate-thumbnail-overlay.mjs` — refactor to use API
- `src/app/admin/(authenticated)/thumbnails/page.tsx` — update UI
- `tests/integration/thumbnail-brain-core.test.ts` — add tests
- `docs/features/thumbnail-system-roadmap.md` — update
- `docs/guides/brain-core-thumbnail-integration.md` (NEW) — integration guide
- `docs/README.md` — update status

---

## Ready to Start

✅ Phase 3 implementation complete  
✅ Architecture documented  
✅ Both repos identified  
✅ Integration plan clear  
✅ Sync points defined  

**Next:** Begin Phase 4A with brain-core API endpoint
