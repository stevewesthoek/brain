# Video Orchestrator — Complete Review Package

**Date:** 2026-05-08  
**Status:** Documentation Complete — Ready for ChatGPT/Codex Review  
**Architecture:** 100% Local on Mac mini M4 Pro  
**Timeline:** 6 months (May 2026 — October 2026)  
**Total Cost:** $0

---

## 📋 Files for Review

All documentation has been created and updated. Below is the complete package for ChatGPT or Codex review.

### 1. **ROADMAP** (High-Level Strategy)
**File:** `operations/runbooks/video-orchestrator-roadmap.md`

**Contents:**
- Vision: Multi-platform production studio (local-only)
- 9 core principles from industry analysis
- Phase 0-5+ summary with deliverables
- Timeline and resource allocation
- Architecture overview
- Success criteria per phase

**Key Section:** Phase Summary Table (5 pages)

**Status:** ✅ Updated (AWS removed, local-only confirmed)

---

### 2. **IMPLEMENTATION PLAN** (Detailed Tasks)
**File:** `operations/runbooks/video-orchestrator-implementation-plan.md`

**Contents:**
- Architecture diagram (Mac mini + local services)
- Phase 0-1: ✅ DONE (smart routing + 4 models)
- Phase 2: Platform/format specs JSON + account selection (3 weeks)
- Phase 3: PostgreSQL + job queue + state machine (4 weeks)
- Phase 4: Account routing + multi-account support (4 weeks)
- Phase 5: LoRA + learning loop + analytics (4 weeks)
- Detailed pseudo-code for each phase
- Test cases per phase

**Key Sections:** 
- Phase 2: `E2-platform-specs.json` schema (7 platforms)
- Phase 3: PostgreSQL schema + worker process + state machine
- Phase 4: Account registry + affinity scoring
- Phase 5: LoRA training + metrics collection

**Status:** ✅ NEW (comprehensive 50+ page implementation plan)

---

### 3. **AGNOSTICITY REVIEW** (Architecture Validation)
**File:** `operations/standards/video-orchestrator-holistic-review.md`

**Contents:**
- Three agnosticity criteria assessment:
  - Platform agnosticity: ✅ Mostly good (needs specs JSON)
  - File format agnosticity: ✅ Mostly good (needs specs JSON)
  - Account agnosticity: ❌ Incomplete (needs 3 workflow steps)
- Concrete gaps identified + solutions proposed
- Implementation roadmap aligned to Phase 2-4
- Validation checklist

**Status:** ✅ Reference document (no changes needed, AWS already removed context)

---

### 4. **LESSONS LEARNED** (Principle Extraction)
**File:** `operations/standards/video-orchestrator-lessons-learned.md`

**Contents:**
- 9 principles extracted from 5 industry repos:
  1. Multi-Agent Parallelization (Phase 0, Phase 4)
  2. UGC / Product Photography Workflow (Phase 2)
  3. Format Normalization (Phase 2-3)
  4. Job Queue + Worker Architecture (Phase 3)
  5. Dynamic Composition / Remotion (Phase 2-3 design)
  6. Persistent Lifecycle Tracking (Phase 3)
  7. Screen Recording Integration (Phase 2-3)
  8. Brand/LoRA Customization (Phase 5)
  9. Persistent Learning (Phase 5)
- Implementation patterns per principle
- Anti-patterns to avoid
- Summary adoption table

**Status:** ✅ Reference document

---

### 5. **VIDEO ORCHESTRATOR SKILL** (Workflow Definition)
**File:** `ai/skills/custom/video/SKILL.md`

**To Be Updated:**
- C0 workflow: Smart Model Selection (DONE ✅)
- C1f workflow: UGC / Product Photography (NEW in Phase 2)
- E0 workflow: Account Selection (NEW in Phase 2)
- F0 workflow: Account Distribution (NEW in Phase 4)
- F1 updates: Account validation + limit checking (NEW in Phase 4)
- C1z design: Format normalization (Phase 3)
- C1d update: Screen recording (Phase 3)

**Status:** ⏳ Needs updates after implementation plan approval

---

### 6. **DECISION LOG** (Architecture Decisions)
**File:** `operations/decision-log.md`

**To Be Updated with:**
- Entry: "2026-05-08: Local-only video orchestrator architecture"
- Decision: 100% local on Mac mini, no AWS, $0 infrastructure cost
- Context: Analysis showed Mac mini is sufficient for 50-200 videos/week; AWS costs prohibitive after grant expires
- Timeline: 6 months (May-Oct 2026)
- Rollback: Not applicable (no cloud dependencies, everything local)

**Status:** ⏳ Needs entry after approval

---

## 📊 Phase Summary

| Phase | Timeline | Focus | Deliverables | Cost |
|-------|----------|-------|--------------|------|
| **0-1** | ✅ Done | Model routing + installation | 4 local models, smart router | $0 |
| **2** | May 30-Jun 15 | Platform/format specs | JSON specs, E0 account selection, C1f UGC | $0 |
| **3** | Jun 15-Jul 15 | Job queue + lifecycle | PostgreSQL, worker, state machine, format normalization | $0 |
| **4** | Jul 15-Aug 15 | Multi-account routing | Account registry, F0/F1 workflows, affinity scoring | $0 |
| **5** | Aug 15-Sep 15 | Learning + customization | LoRA training, metrics collection, recommendations | $0 |

**Total Timeline:** 6 months  
**Total Resource:** ~40 hours Claude Code  
**Total Cost:** $0 (local infrastructure only)

---

## 🎯 Key Architecture Decisions

### Decision 1: 100% Local, No AWS
- **What:** All infrastructure runs on Mac mini M4 Pro (24GB RAM)
- **Why:** Cost ($0 vs $3,600/year), control, no cloud dependencies
- **PostgreSQL:** Docker container on Mac mini
- **Job Queue:** Local to Mac mini
- **Credentials:** OS keychain (encrypted local storage)
- **Analytics:** Local database + Python scripts

### Decision 2: 3 Agnosticity Layers
- **Platform:** JSON specs for 7 platforms (YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, X)
- **Format:** JSON specs for 9 output formats (landscape, vertical, square, etc.)
- **Account:** Account registry + routing logic (multi-account support per platform)

### Decision 3: Phased Implementation
- **Phase 2:** Specs abstraction (JSON-based, no code changes for new platforms/formats)
- **Phase 3:** Job queue + resumability (mid-pipeline recovery)
- **Phase 4:** Multi-account support (scale accounts, not infrastructure)
- **Phase 5:** Learning loop (data-driven optimization)

### Decision 4: Smart Model Routing
- **SDXL:** 95% of work (30-60s, 6-8GB VRAM)
- **Wave:** Talking heads (60-90s, 8-12GB VRAM)
- **FLUX:** Premium work (2-4min, 18-20GB VRAM, night batch only)
- **Roop:** Avatars (30-120s, 4-8GB VRAM)

---

## ✅ Validation Checklist

### Architecture Soundness
- [ ] Is 100% local architecture sufficient for 50-200 videos/week?
- [ ] Are the Phase timelines realistic (3-4 weeks per phase)?
- [ ] Is the state machine design correct for mid-pipeline recovery?
- [ ] Are there edge cases not covered?

### Agnosticity
- [ ] Are the 3 agnosticity layers (platform/format/account) complete?
- [ ] Can new platforms be added without code changes (JSON-only)?
- [ ] Can new formats be added without code changes (JSON-only)?
- [ ] Can multi-account scenarios be supported?

### Performance
- [ ] Will local Mac mini handle 50-100 videos/week sustainably?
- [ ] Is 85% CPU safe long-term? (thermal analysis: yes, ~0.5-1 year lifespan cost)
- [ ] Will job queue handle mid-pipeline resume efficiently?
- [ ] Will account routing scale to 50+ accounts across 7 platforms?

### Implementation
- [ ] Are the Phase 2-5 deliverables realistic?
- [ ] Are the resource estimates accurate (~40h Claude Code)?
- [ ] Are there dependencies between phases that could block progress?
- [ ] What's the critical path?

---

## 🔄 Critical Path

**Phase 2** is critical path (platform/format specs) — must complete before Phase 3 job queue can be fully integrated.

**Recommended Order:**
1. Phase 2 → Done by June 15
2. Phase 3 → Done by July 15 (depends on Phase 2)
3. Phase 4 → Done by August 15 (depends on Phase 3)
4. Phase 5 → Done by September 15 (depends on Phase 4)

**No parallel phases** — each depends on previous for infrastructure.

---

## 📝 Questions for Reviewer

**When reviewing, please comment on:**

1. **Architecture:**
   - Is Mac mini M4 Pro sufficient for the roadmap?
   - Should we add any local infrastructure beyond PostgreSQL?
   - Any missing pieces?

2. **Timeline:**
   - Are 3-4 weeks per phase realistic?
   - Should we adjust priorities or combine phases?
   - What's the critical path?

3. **Agnosticity:**
   - Are the 3 layers (platform/format/account) complete?
   - Any edge cases for multi-account scenarios?
   - How to handle platform API changes (rate limits, auth)?

4. **Implementation:**
   - Is the state machine design correct?
   - Are the database schemas sound?
   - Any security concerns (credential storage, etc.)?

5. **Risk:**
   - What could go wrong in each phase?
   - What's the rollback plan if Mac mini fails?
   - How to handle account credential expiry?

6. **Scope:**
   - Should we defer any Phase 5 features (LoRA, analytics)?
   - Should we add anything to Phase 2-4?
   - Is Phase 5 essential or optional?

---

## 🚀 Next Steps (After Approval)

Once you approve this plan:

1. **Commit Documentation**
   - Add entry to `decision-log.md`
   - Update `/video` SKILL.md with workflow changes

2. **Phase 2 Kickoff (June)**
   - Create `platform-specs.json`
   - Create `format-specs.json`
   - Implement E0, C1f workflows
   - Test with 7 platforms

3. **Phase 3 Kickoff (June 15)**
   - Set up PostgreSQL Docker container
   - Implement Python worker process
   - Implement state machine
   - Test job queue

4. **Phase 4 Kickoff (July 15)**
   - Create account registry
   - Implement F0, F1 workflows
   - Test multi-account posting

5. **Phase 5 Kickoff (August 15)**
   - Set up LoRA training
   - Implement metrics collection
   - Test recommendations

---

## 📦 Deliverables Summary

**For ChatGPT/Codex Review:**

```
1. operations/runbooks/video-orchestrator-roadmap.md
   └─ 6-month timeline, Phase 0-5+ overview
   
2. operations/runbooks/video-orchestrator-implementation-plan.md
   └─ 50+ page detailed implementation plan (Phases 2-5)
   
3. operations/standards/video-orchestrator-holistic-review.md
   └─ Agnosticity analysis, gaps, solutions
   
4. operations/standards/video-orchestrator-lessons-learned.md
   └─ 9 principles, implementation patterns, adoption table
   
5. ai/skills/custom/video/SKILL.md (sections to update)
   └─ Workflows: C0, C1f, E0, F0, F1, C1z, C1d
   
6. operations/decision-log.md (entry to add)
   └─ Architecture decision: 100% local, $0 cost, 6-month timeline
```

---

**STATUS: COMPLETE ✅**

All documentation prepared. No code execution. Ready for review.

When you're ready for ChatGPT/Codex to review, provide these 6 files + ask for feedback on the validation checklist above.
