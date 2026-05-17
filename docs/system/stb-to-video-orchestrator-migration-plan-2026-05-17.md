# Says the Bible (STB) → Video Orchestrator Migration Plan

**Date:** 2026-05-17  
**Status:** Planning Phase  
**Priority:** Essential - STB is daily operational pipeline  
**Risk Level:** High - cannot break operational system  

---

## Purpose

Says the Bible (STB) is the user's current daily operational pipeline for converting Bible/faith research into published video content across YouTube, Pinterest, and Facebook.

The video orchestrator is the future canonical content pipeline architecture designed to be modular, reusable, and cleaner than STB.

**This migration plan ensures:**
- STB remains operational and unchanged during migration
- Video orchestrator is built alongside, not as blind copy
- Each module is validated before migration
- Dual-run validation before switching production
- Zero operational downtime

---

## Non-Negotiables

1. **STB remains operational** — Cannot break daily workflow
2. **No destructive changes** — STB code untouched until full parity
3. **No decommissioning** — Until explicit user approval after validation
4. **No blind copy-paste** — Rebuild as reusable video orchestrator modules
5. **Dual visibility** — Both STB and video visible in Brain Console during migration
6. **Approval before switch** — User explicitly approves production switch
7. **Rollback preservation** — STB code archived, not deleted

---

## Current STB Pipeline Inventory

### Operational Status
- **Status**: ✅ Active, daily use
- **Owner**: User (active daily operator)
- **Last Activity**: Recent (kanban shows active tasks)
- **Platform Targets**: YouTube, Pinterest, Facebook
- **User Context**: Primary faith/content production pipeline
- **Risk if broken**: Very High — halts all Says the Bible content production

### STB Architecture (Legacy)
Located in: Likely in `/Users/Office/Repos/stevewesthoek/` (not yet inventoried in detail)

**Probable components** (based on ProBot references):
- Research/intake (Bible passages, topics)
- Outline generation (structure content)
- Script generation (convert to spoken word script)
- Asset generation (visual assets, backgrounds)
- Thumbnail design (cover image)
- Video assembly (compose video from assets)
- Metadata enrichment (title, description, tags, language)
- YouTube publishing (upload, scheduling, captions)
- Pinterest publishing (pin creation, board management)
- Facebook publishing (post creation, scheduling)
- Approval/review workflow
- Archive and logging

### Known Integration Points
- **ProBot dashboard**: Can start/stop STB, see status
- **ProBot local apps**: STB configured as app (Node 20 runtime override)
- **Brain Core**: Currently no direct STB integration (planned in Phase 4)
- **Mind vault**: Links in kanban, operational notes in focus docs

---

## Video Orchestrator Current State

### Design Phase Artifacts (ProBot)
Located in: `projects/probot/src/bot/video-orchestrator-*.ts`

**Design components**:
- Account model design (YouTube, Pinterest, Facebook profiles)
- Platform policy design (YouTube API policy, publishing constraints)
- Says the Bible mapping design (legacy → future module mapping)
- Safe report generation (validation that design is safe)

**Status**: Design-only, no live execution yet

**Key insight**: ProBot has already drafted how STB maps to video orchestrator. This mapping should guide actual implementation.

### Video Orchestrator Limitations
- No live queue execution
- No stage/run tracking
- No platform publishing (design-only)
- No Brain Core integration yet
- No status surfaces for Brain Console

---

## STB → Video Orchestrator Module Map

This map guides the migration strategy. Each module is built in video orchestrator equivalent, dry-run validated, then (only after approval) switched to production.

| STB Concept | Current Location | Video Orchestrator Target Module | Status | Implementation Order | Validation |
|-----------|-----------------|--------------------------------|--------|---------------------|-----------|
| **Research → scripture intake** | App/script | bible-research orchestrator + intake-stage | 🔴 not-started | 1 | Compare passage selection |
| **Outline/structure** | App/script | script-generation stage | 🔴 not-started | 2 | Compare outline structure |
| **Script generation** | App/script | script-generation stage | 🔴 not-started | 2 | Compare script quality |
| **Asset generation** | App/script | asset-generation stage | 🔴 not-started | 3 | Compare asset metadata |
| **Thumbnail design** | App/script | design orchestrator (planned) | 🔴 blocked | 4 | Compare thumbnail output |
| **Video assembly** | App/script | video-assembly stage | 🔴 not-started | 5 | Compare video bitrate/quality |
| **Metadata enrichment** | App/script | metadata-enrichment stage | 🔴 not-started | 6 | Compare SEO metadata |
| **YouTube publishing** | App/script | platform-publish stage (youtube) | 🔴 not-started | 7 | Compare published video |
| **Pinterest publishing** | App/script | platform-publish stage (pinterest) | 🔴 not-started | 8 | Compare pin appearance |
| **Facebook publishing** | App/script | platform-publish stage (facebook) | 🔴 not-started | 9 | Compare post formatting |
| **Approval/review** | App/script | approval-gate stage | 🔴 not-started | 10 | Compare approval flow |
| **Archive/logging** | App/script | archive-logging stage | 🔴 not-started | 11 | Compare audit trail |

---

## Implementation Phases

### Stage 0: Status Only (Phase 4 Brain Console)
- Expose STB operational status in Brain Console
- Show STB pipeline as "legacy/operational"
- No modification, no execution
- Read-only visibility only

### Stage 1: Map and Document (Phase 2)
- Create detailed mapping document (table above)
- Document STB module location and behavior
- Document expected video orchestrator equivalent
- Define validation criteria for each module
- Duration: 1-2 weeks

**Deliverables**:
- Detailed STB audit (file structure, scripts, config)
- Video orchestrator module design spec
- Per-module validation checklist

### Stage 2: Read-Only Dashboard Visibility (Phase 4)
- Render STB status in Brain Console Pipelines tab
- Show queue, last run, failure state
- Show STB→video migration card
- No modification yet
- Duration: 1 week

**Deliverables**:
- Brain Console pipeline section (STB + video cards)
- Migration status card

### Stage 3: Build and Dry-Run First Module (Phase 8)
**Example: Scripture Research/Intake Module**

1. Build video orchestrator equivalent
2. Implement input from same source as STB
3. Run on test data
4. Compare output to STB output
5. If match: mark parity ✅, proceed
6. If mismatch: debug, refactor, retest
7. Duration: 2-3 weeks per module

**Validation**:
- Test input: 10 Bible passages
- Expected output: consistent with STB
- No user involvement yet

### Stage 4: Implement Remaining Modules (Phases 8-10)
- Follow same pattern for each module in order (table above)
- Dual-run: STB and video in parallel on same input
- Compare output each time
- Mark parity checkpoints
- Duration: 2-4 months total

**Checkpoints**:
- Module 1-4: Core generation (research → video file)
- Module 5: Design orchestrator integration (thumbnail)
- Module 6-9: Platform publishing
- Module 10-12: Safety/logging

### Stage 5: Integration Testing (Phase 9)
- Run full pipeline (both STB and video) on same input
- For 2 weeks: monitor output quality
- Compare metrics: success rate, processing time, platform acceptance
- No user-facing switching yet
- Duration: 2-4 weeks

### Stage 6: User Dual-Run Approval (Phase 10)
- Show user side-by-side output (STB vs video orchestrator)
- Get explicit approval to switch to video
- Document approval (timestamp, user confirmation)
- Duration: 1 week

### Stage 7: Gradual Cutover (Phase 10)
- Switch ONE platform at a time (e.g., YouTube first)
- Monitor for 1 week
- If successful: switch next platform (Pinterest)
- If problem: rollback to STB
- Duration: 3-4 weeks total

### Stage 8: Decommissioning (Post-Migration)
- After 2-4 weeks of full production on video orchestrator
- Get explicit user approval
- Archive STB code/config (not delete)
- Update documentation
- Announce ProBot → Brain Console transition complete

---

## Dual-Run Validation Strategy

### Metrics to Compare

For each module output:
1. **Correctness**: Does video orchestrator produce same/equivalent output?
2. **Quality**: Is quality comparable or better?
3. **Performance**: Is processing time acceptable?
4. **Compatibility**: Does platform accept output equally?
5. **Safety**: Are error cases handled the same?

### Test Data Sets

- **Smoke test**: 1-2 items (quick validation)
- **Regression test**: 5-10 previous STB outputs (ensure parity)
- **Edge cases**: Empty input, malformed data, very long input
- **Platform test**: Actual publish to test accounts

### Failure Handling

If video orchestrator fails on test data:
1. Analyze failure
2. Fix video orchestrator
3. Retest
4. Do not proceed to next module until fixed
5. Never decommission STB code

---

## Brain Core Integration

### Phase 4: STB Status Adapter
Create: `projects/brain-core/src/adapters/stb-pipeline.ts`

Expose (read-only):
```typescript
interface STBPipelineStatus {
  id: "stb-daily-pipeline";
  name: "Says the Bible Daily Pipeline";
  status: "operational"; // always, unless explicitly stopped
  health: "ok" | "warning" | "error";
  lastRunAt?: string;
  lastRunDuration?: number;
  queueCount: number;
  failureCount: number;
  nextItemTopic?: string;
  currentProcessing?: {
    topic: string;
    stage: string;
    progress: 0-100;
  };
  platforms: Array<{
    name: "youtube" | "pinterest" | "facebook";
    lastPublished?: string;
    failureCount: number;
  }>;
}
```

### Phase 7: Video Orchestrator Status Adapter
Create: `projects/brain-core/src/adapters/video-orchestrator-pipeline.ts`

Expose (read-only):
```typescript
interface VideoOrchestratorStatus {
  id: "video-orchestrator";
  name: "Video Orchestrator (Future Architecture)";
  status: "partial"; // during migration
  health: "unknown";
  modulesImplemented: number; // e.g., 3/12
  parityStatus: "mapping" | "partial" | "dual-run" | "ready" | "complete";
  migrationProgress: 0-100;
  
  modules: Array<{
    name: string;
    status: "implemented" | "partial" | "planned" | "legacy";
    parityStatus?: "not-started" | "partial" | "complete";
  }>;
  
  decommissionBlocked: true; // until parity complete
  nextTask?: string; // "implement outline module"
  
  linkedLegacyPipeline?: "stb-daily-pipeline";
}
```

---

## Brain Console Visibility

### Migration Card (Pipelines Tab)

```
┌─ STB → Video Orchestrator Migration ──────────────┐
│                                                   │
│ Legacy pipeline:  STB Daily Pipeline             │
│ Target arch:      Video Orchestrator             │
│                                                   │
│ Modules completed: [████░░░░░░░░░] 40%          │
│                                                   │
│ Status: MAPPING                                  │
│  ✓ Research/intake: not-started                  │
│  ✓ Outline: not-started                          │
│  ✓ Script generation: not-started                │
│  ✓ Asset generation: not-started                 │
│  ✗ Design orchestrator: blocked (prerequisite)   │
│                                                   │
│ Parity validation: not-started                   │
│ Dual-run: not-started                            │
│ Decommission: BLOCKED until parity complete      │
│                                                   │
│ Next safe task:  [Build research module]         │
│                  [View detailed plan]            │
│                  [View STB status] [View video] │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Timeline Estimate

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| 0-1 | Inventory & docs | 2-3 weeks | None |
| 2 | STB status adapter | 1 week | Brain Core |
| 2 | Video status adapter | 1 week | Brain Core |
| 3 | Brain Console visibility | 1 week | Adapters |
| 4 | Research module (video) | 2-3 weeks | None |
| 4 | Outline module (video) | 2-3 weeks | Research |
| 4 | Script/asset modules | 4-6 weeks | Outline |
| 5 | Design orchestrator (video) | TBD | Design skill |
| 5 | Platform publishing modules | 4-6 weeks | Design |
| 6 | Approval/archive stages | 2-3 weeks | Publishing |
| 7 | Integration testing | 2-4 weeks | All modules |
| 8 | User dual-run | 1 week | Testing |
| 9 | Gradual cutover | 3-4 weeks | User approval |
| 10 | Decommissioning | 1 week | Cutover success |

**Total estimate:** 5-8 months (depends on design orchestrator availability and testing speed)

---

## Risk Mitigation

### Risk: STB Breaks During Migration
**Mitigation**: STB untouched during Phase 0-8. Only architecture reads, never writes.

### Risk: Video Orchestrator Quality Worse Than STB
**Mitigation**: Dual-run validation before any switching. Never switch if quality degraded.

### Risk: Platform Integration Failures
**Mitigation**: Test YouTube first (largest audience). If YouTube works → Pinterest → Facebook. Rollback if needed.

### Risk: User Forgets STB Exists
**Mitigation**: Dashboard clearly shows STB operational status. Decommission only with explicit approval.

### Risk: Design Orchestrator Not Ready
**Mitigation**: Design modules in video orchestrator as generic image-generation, don't wait for design skill.

### Risk: Migration Takes Too Long
**Mitigation**: Prioritize high-value modules first (research, script, assembly). Leave design/archive for later.

---

## Rollback Strategy

At any phase:
- If video module fails validation: stop, debug, retest
- If platform publishing fails: roll back to STB for that platform
- If user disapproves: freeze video orchestrator, keep STB unchanged
- Archive video development, restart later

**Preservation**:
- STB code always available
- Migration records kept
- All test outputs archived
- User approval documented

---

## Success Criteria

- ✅ STB remains operational throughout
- ✅ Each module passes dual-run validation
- ✅ No user-facing downtime
- ✅ Video orchestrator output quality ≥ STB
- ✅ All platforms publish successfully
- ✅ User explicitly approves production switch
- ✅ Migration status transparent in Brain Console
- ✅ Rollback capability preserved until decommission
- ✅ Decommissioning only after full validation

---

## References

- STB operational status: `/Users/Office/Repos/stevewesthoek/mind/KANBAN.md`
- ProBot video orchestrator design: `projects/probot/src/bot/video-orchestrator-*.ts`
- Brain Core: `projects/brain-core/src/api/routes.ts`
- Brain Console: `projects/brain-console-obsidian/src/`
- Orchestrator architecture: `docs/system/obsidian-command-center-orchestrator-architecture-2026-05-17.md`
