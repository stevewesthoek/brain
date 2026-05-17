# Unified Orchestrator Command Center — Phase 2 Execution Brief

**Date:** 2026-05-17  
**Scope:** Extend existing Brain Core with unified orchestrator registries  
**Duration:** 2-3 weeks  
**Risk Level:** Low (extend read-only APIs, preserve existing)  
**Status:** Ready to begin

---

## Mission

Extend the existing Brain Core service (running on 127.0.0.1:4877) with read-only unified orchestrator registry surfaces. Add endpoints for orchestrators, pipelines, projects/domains, and platforms. Maintain all existing endpoints and port. Update Brain Console to consume and display these new registries side-by-side with operational systems (Says the Bible, ProBot legacy, video orchestrator future).

Brain Core already exposes system health, local apps, sessions, and skill status. Phase 2 adds:
- Orchestrator registry (skills, video, design, code, research, Bible research, scheduler)
- Pipeline registries (Says the Bible operational, video orchestrator future, migration progress)
- Project/domain registries (links to pipelines and orchestrators)
- Platform registries (YouTube, Pinterest, Facebook, etc.)
- Approval queue (read-only)
- Scheduler status

---

## Non-Negotiables

1. **No side effects** — Read-only HTTP service, no writes to Mind, no direct shell execution, no mutations
2. **Localhost-only binding** — 127.0.0.1:4877 (PRESERVED), no external internet, no credential exposure
3. **Type safety** — TypeScript strict mode, Zod validation on responses, 80% test coverage minimum
4. **Says the Bible preservation** — Read-only adapter only, ProBot source is authoritative, no STB mutations
5. **Video Orchestrator awareness** — Status adapter for progress tracking, no write path enabled
6. **Graceful degradation** — If a data source is offline, return 503 or "unavailable" gracefully, never crash
7. **No decommissioning** — Nothing deleted/disabled until Brain Console section + tests + user approval

---

## Current State

### What exists
- ✅ Brain Console Obsidian plugin (MVP, connected locally via requestUrl)
- ✅ ProBot dashboard (legacy, operational, status endpoints exist)
- ✅ Says the Bible (daily production pipeline, YouTube/Pinterest/Facebook publishing)
- ✅ Video Orchestrator (design-phase ProBot artifacts, no live execution)
- ✅ Model-router (report-only dry-runs, no Mind writes yet)
- ✅ Scheduler (nightly jobs, model-router dry-run hooks exist)

### What's missing for the next implementation slice
- ❌ Brain Core read-only registry endpoints for orchestrators, pipelines, projects/domains, and platforms
- ❌ Brain Core adapters for orchestrators, pipelines, projects/domains, platforms, STB status, and video orchestrator status
- ❌ Brain Console panels consuming those new registry endpoints
- ❌ STB and video orchestrator displayed side-by-side in Brain Console with migration progress
- ❌ Agent View panels (planned for Phase 2C, not part of immediate slice)

### What we're NOT doing in Phase 1
- ❌ Brain Console UI implementation (already MVP complete, Phase 2 will consume these endpoints)
- ❌ Approval-request action execution (Phase 4+)
- ❌ Mind vault mutations (blocked until separate write/apply policy approved)
- ❌ Model-router Mind writes (blocked)
- ❌ ProBot dashboard redesign (legacy/secondary, migrating features via Brain Core)
- ❌ Decommissioning anything

---

## Immediate Target: Extend existing Brain Core (projects/brain-core/)

### Current state
- ✅ Brain Core exists at `projects/brain-core/`
- ✅ Runs on 127.0.0.1:4877 (BRAIN_CORE_PORT env var)
- ✅ Uses Node.js built-in http module (no Express)
- ✅ Has existing adapters (status, local-apps, sessions, skills, etc.)
- ✅ Has existing routes, types, security layer
- ✅ Has existing tests (jest-based)

### Files to inspect and extend

```
projects/brain-core/ (EXISTING)
  src/
    api/
      server.ts           (existing, do not modify port binding)
      routes.ts           (EXTEND with /orchestrators, /pipelines, etc.)
      types.ts            (EXTEND with Orchestrator, Pipeline, Project, Platform types)
    adapters/
      status.ts           (existing, do not modify)
      local-apps.ts       (existing, do not modify)
      sessions.ts         (existing, do not modify)
      skills.ts           (existing, do not modify)
      orchestrators.ts    (CREATE or EXTEND)
      pipelines.ts        (CREATE or EXTEND - includes STB, video, migration)
      projects.ts or domains.ts (CREATE - link to pipelines)
      platforms.ts        (CREATE - YouTube, Pinterest, Facebook, etc.)
      approvals.ts        (EXTEND if exists, else create)
      scheduler.ts        (EXTEND if exists, else create)
    security/
      localhost.ts        (existing, preserve 4877)
      redaction.ts        (existing, preserve)
    tests/
      [existing tests]    (UPDATE tests for new adapters)
  src/index.ts            (existing entry point, do not modify)
  package.json            (existing, inspect for dev dependencies)
  tsconfig.json           (existing, preserve strict mode)
```

### Endpoints to extend/add

**Existing (preserve as-is):**
```
✅ GET /status
✅ GET /local-apps
✅ GET /sessions
✅ GET /skills
✅ GET /runtime/readiness
✅ GET /execution/maintenance-previews
[other existing endpoints]
```

**To add/extend:**
```typescript
// Orchestrators registry (NEW)
GET /orchestrators → {
  name, category, status, modules[], lastRun?,
  queueCount?, errorCount?, nextTask?
}[]

GET /orchestrators/:id → full detail

// Pipelines (NEW - STB + Video + Migration unified view)
GET /pipelines → {
  name, category, status, lastRun?, queueCount?,
  failureCount?, health, metadata
}[]

GET /pipelines/:id → full detail

  // Examples:
  // - /pipelines/stb-daily-pipeline (operational, read from ProBot)
  // - /pipelines/video-orchestrator (progress tracking)
  // - /pipelines/stb-video-migration (aggregated status)

// Projects/Domains (NEW)
GET /projects → {
  name, type, status, owner, lastModified,
  linkedPipeline?, linkedOrchestrator?
}[]

// Platforms (NEW)
GET /platforms → {
  name, type, status, linkedProject?, lastActivity?
}[]

// Approvals (EXTEND if exists)
GET /approvals → {
  id, action, description, requested, expires, status
}[]
```

### Adapters to extend or create

**Existing (already present):**
1. ✅ **status.ts** — Brain Core internal state
2. ✅ **local-apps.ts** — ProBot app registry
3. ✅ **sessions.ts** — Claude session tracking
4. ✅ **skills.ts** — Skill index from `brain/ai/skills/active/`

**To create/extend (in order):**
5. **orchestrators.ts** (EXTEND if exists, else CREATE)
   - Index video, research, design, code, model-router, scheduler orchestrators
   - Read from `brain/projects/*/`, `brain/ai/skills/active/`
   - Safe, read-only, no execution

6. **pipelines.ts** (EXTEND if exists, else CREATE)
   - **STB status adapter:** Read ProBot STB operational state (read-only)
   - **Video orchestrator adapter:** Progress tracking, modules %, parity status
   - **Migration card:** Aggregate STB + video for dual visibility
   - All read-only, no mutations

7. **projects.ts or domains.ts** (CREATE)
   - Index from mind vault + project tracking
   - Link to pipelines and orchestrators
   - Safe, read-only

8. **platforms.ts** (CREATE)
   - YouTube, Pinterest, Facebook, etc.
   - Link to projects
   - Safe, read-only

9. **approvals.ts** (EXTEND if exists, else CREATE)
   - Read Brain Core approval queue (empty in Phase 2)

10. **scheduler.ts** (EXTEND if exists, else CREATE)
    - Read Office nightly scheduler state (jobs, last run)
    - Safe, read-only

### Tests to write/extend

**Follow existing test patterns in projects/brain-core/src/tests/:**

Per new adapter:
- Happy path (service available, returns data)
- Error case (service unavailable, graceful 503 or fallback)
- Response schema validation (same as existing adapters)
- Redaction (no credentials/secrets in output, match existing patterns)

Routes tests:
- All endpoints callable (extend existing routes.test.ts)
- Error responses formatted correctly
- Localhost-only binding verified (already in place)

**Test coverage:** Match existing project standard (inspect jest.config.js and existing tests)

### Security layer (EXISTING, preserve)

**File:** `src/security/localhost.ts`
- ✅ Already rejects non-localhost connections
- ✅ Port already 4877 (do not change)

**File:** `src/security/redaction.ts`
- ✅ Already removes credentials from responses
- ✅ Inspect existing pattern and follow for new adapters

---

## Key Decisions

### 1. Extend existing Brain Core, not create new
- **Port:** 4877 (BRAIN_CORE_PORT env var, do NOT change)
- **Address:** 127.0.0.1 (existing, localhost-only binding)
- **Tech stack:** Node.js built-in http module, existing structure
- **Why:** Brain Core already exists, operational, and connected to Brain Console

### 2. STB Status Adapter
- **Source:** ProBot dashboard status endpoints (safe, read-only)
- **Not a mutation:** Only reads STB operational state from ProBot
- **Purpose:** Expose STB status in Brain Core for Brain Console visibility
- **Why:** Says the Bible is the user's daily pipeline; visibility is critical for migration planning

### 3. Video Orchestrator Adapter
- **Source:** ProBot design artifacts (video-orchestrator-*.ts) + Brain-side state files
- **Not a write path:** Tracks progress metrics only, doesn't execute video modules
- **Purpose:** Expose video orchestrator design/progress for Brain Console migration card
- **Why:** Show user migration status without revealing internal implementation

### 4. Migration Card Aggregation
- **Source:** STB + Video status adapters
- **Purpose:** Unified view of migration progress (legacy → canonical)
- **Data:** STB operational status, video modules %, parity %, next task
- **Safety:** Read-only view only, no mutations

### 5. Preserve all existing endpoints
- All current endpoints stay as-is
- New endpoints added without breaking changes
- Existing tests preserved and extended

### 6. No execution in Phase 2
- Endpoints are read-only only
- No `/actions/request` endpoint yet (Phase 7+)
- No `/scheduler/jobs/:id/request-run` yet (Phase 7+)
- All mutations blocked by design

---

## Brain Console Panels to Add (Phase 2 consumption)

**Overview Tab (MVP, already exists):**
- ✅ Status pills, 6 core cards, action row

**Phase 2 additions to Brain Console (will consume these new endpoints):**

1. **Pipelines Tab** (NEW - consumes `/pipelines`, `/pipelines/:id`)
   - Says the Bible card (operational status, platforms, warning: "no changes during migration")
   - Video Orchestrator card (progress %, modules, parity status)
   - Migration card (progress tracking, safeguards enforced)

2. **Orchestrators Tab** (NEW - consumes `/orchestrators`)
   - Model Router status
   - Video Orchestrator progress
   - Skills registry (research, design, code, Bible research)
   - Scheduler status

3. **Apps Tab** (NEW - consumes existing `/local-apps`)
   - Local app status
   - ProBot legacy status (marked deprecated)

4. **Projects/Domains Tab** (NEW - consumes `/projects`, `/platforms`)
   - Active projects
   - Linked pipelines and orchestrators
   - Platform status

**Phase 3+ (future):**
- Approvals tab, Research tab, System tab

---

## Tests (Definition of Done)

1. ✅ `npm run typecheck` passes (TypeScript strict mode, follow existing config)
2. ✅ `npm run build` succeeds (uses existing esbuild config, no changes)
3. ✅ `npm run test` passes (existing coverage standard)
4. ✅ Service starts: `npm run start` listens on 127.0.0.1:4877 (do NOT change port)
5. ✅ Health check works: `curl http://127.0.0.1:4877/status` returns JSON
6. ✅ All read-only endpoints respond (or gracefully fail)
   - `/orchestrators`
   - `/pipelines`
   - `/pipelines/:id`
   - `/projects` or `/domains`
   - `/platforms`
7. ✅ No secrets in responses (secret scan passes)
8. ✅ Security layer verified: non-localhost rejected
9. ✅ Redaction layer verified: credentials removed from output (match existing patterns)
10. ✅ Graceful degradation: if ProBot offline, returns 503 not crash
11. ✅ All existing endpoints still work (no breaking changes)

---

## Files to inspect/change

### Reference (read-only)
- `projects/probot/src/bot/dashboard.ts` — STB status structure (don't modify)
- `projects/probot/src/services/status.ts` — ProBot status helpers (don't modify)
- `projects/video-orchestrator/` — Video design artifacts if exists (reference only)
- `projects/brain-console-obsidian/src/client.ts` — Brain Core client (already exists, no change for Phase 1)

### Endpoints (to implement)
- All new files under `projects/brain-core/src/`

### Tests (to write)
- All new test files under `projects/brain-core/src/tests/`

---

## Phase 2 Definition of Done

- ✅ All new read-only endpoints implemented and working
  - `/orchestrators`
  - `/pipelines`
  - `/pipelines/:id`
  - `/projects` (or `/domains`)
  - `/platforms`
- ✅ All new adapters created (orchestrators, pipelines, projects, platforms, etc.)
- ✅ STB status adapter reads ProBot operational state (read-only)
- ✅ Video orchestrator adapter tracks progress (read-only)
- ✅ Migration card aggregates STB + video (read-only)
- ✅ Security layer verified (localhost-only, redaction)
- ✅ Tests pass (follow existing project standard)
- ✅ No external shell execution
- ✅ No secrets in responses
- ✅ Graceful error handling (offline services don't crash)
- ✅ All existing endpoints still work (no breaking changes)
- ✅ Port remains 4877 (do NOT change)
- ✅ Staged and committed (no uncommitted changes)
- ✅ Ready for Phase 3 (Brain Console can consume endpoints)

---

## What NOT to touch

- ❌ Says the Bible code (read-only ProBot adapter only, no modifications)
- ❌ Video Orchestrator code (status tracking only, no write path)
- ❌ ProBot dashboard runtime (legacy, read operational state only)
- ❌ Brain Core port (must stay 4877)
- ❌ Brain Core server.ts or localhost.ts (preserve existing)
- ❌ Existing endpoints and routes (no breaking changes)
- ❌ Brain Console plugin code (will be updated separately to consume these endpoints)
- ❌ Mind vault (read-only project index only)
- ❌ Model-router (no changes)
- ❌ Scheduler (read status only, no execution)

---

## Next Task (Phase 3)

After Phase 2 (Brain Core extension) completion:
1. Verify Brain Core service is running on 4877
2. Update Brain Console plugin to consume new Phase 2 endpoints
3. Add Pipelines tab with STB + video orchestrator + migration card
4. Add Orchestrators tab with skill registry
5. Manual test in Obsidian: verify STB and video status display correctly side-by-side
6. Validate migration card shows accurate progress
7. Verify ProBot marked as legacy/secondary

---

## Rollback Plan

If Phase 2 goes wrong:
1. New adapters are isolated → safe to revert changes to `projects/brain-core/src/adapters/`
2. All endpoints are read-only → no data loss
3. Existing endpoints continue to work (preserved, no breaking changes)
4. Brain Console MVP still works with existing endpoints
5. ProBot dashboard remains unchanged (fallback)
6. Says the Bible remains operational (untouched, read-only adapter only)

---

## Success Criteria (User-Facing)

1. ✅ Brain Console displays Says the Bible operational status (live, read from ProBot)
2. ✅ Brain Console displays Video Orchestrator progress side-by-side with STB
3. ✅ Migration card in Brain Console shows: modules completed, parity %, progress timeline, safeguards
4. ✅ Orchestrators tab shows all skills and video orchestrator
5. ✅ ProBot marked as legacy/secondary (visible in dashboard)
6. ✅ No user-visible breaking changes (existing endpoints unchanged)
7. ✅ No production system disrupted (read-only adapters only)
8. ✅ User can see end-to-end: STB operational → video building → planned migration

---

## Agentic OS Compatibility (Phase 2C)

**Note on architecture alignment:** During Phase 2 (Brain Core read-only registries) and Phase 3 (Brain Console sections), keep types and adapters compatible with future agentic OS layer.

**Specifically:**
- Agent entities (AgentRole, AgentSkill, AgentPlan, AgentRun, AgentEvent, AgentApproval) are defined in detail in `docs/system/agentic-os-external-repo-review-2026-05-17.md`
- Brain Core endpoints are designed to support agent state persistence, run tracking, learning proposals, and approval gates (read-only in Phase 2C MVP)
- Model-router will be the first registered agent inside the agentic OS layer
- Video orchestrator, research, design, code, Bible research, and scheduler orchestrators will be registered agents
- Skill registry (Phase 2B) is distinct from agentic OS skills (they are the same data, but accessed by agents via the OS layer in Phase 2C+)
- **Do not delay Phase 2 for agentic OS implementation** — Phase 2 focuses on read-only registries; Phase 2C adds the OS state layer; Phase 2C+ adds approval gates and mutations

---

## Questions to clarify before starting

1. Should STB/video status be fetched from ProBot in real-time, or cached from a recent file?
2. If ProBot is offline during Brain Core startup, should we start anyway with "unavailable" states?
3. How should video orchestrator progress be discovered if `projects/video-orchestrator/` design artifacts exist?
4. Should project registry be sourced from `mind/` vault or separate project tracking?
5. Are there existing test patterns in `projects/brain-core/src/tests/` to follow for new adapters?
6. For agentic OS Phase 2C: Should agent run ledger be file-based (append-only JSONL) or in-memory? (Recommend file-based for durability and audit trail)

---

## Approved Assumptions

- Brain Core can read ProBot status endpoints via HTTP (localhost)
- Video Orchestrator design state can be read from `projects/video-orchestrator/` if it exists
- Model-router is read-only in Phase 1 (no apply route); will be registered as first agent in Phase 2C OS layer
- All Phase 2 operations are read-only (Phase 2C will add approval-request-only actions, Phase 3+ will add approval-gated mutations)
- Says the Bible must never be broken or directly written to (ProBot integration is read-only)
- Agentic OS layer belongs in Brain Core, not Mind (agent state, runs, approvals are operational, not durable knowledge)
- Claude Code and Codex are external agentic executors (not wrapped by Brain)
- Skills are reusable capabilities (not the OS container; agents use skills, not vice versa)

---

## Current Next Safe Implementation Slice

After Brain Console section navigation (Phase 5 complete as of 2026-05-18):

**Next slice:** Phase P1 — Post Orchestrator Read-Only Status Scaffold

**Why:** Consolidate scattered post orchestration across Proofly/Xgrow into Brain Post Orchestrator. Add read-only visibility first (no publishing, no code changes to Proofly/Xgrow).

**Scope:**
- Brain Core endpoints for post orchestrator status
- Brain Console "Posts" section showing pipeline status
- Proofly/Xgrow shown as "planning" modules
- Publishing clearly marked disabled

**See:** `docs/system/post-orchestrator-proofly-xgrow-architecture-review-2026-05-18.md` and `docs/system/obsidian-mind-model-router-roadmap.md` (Post Orchestrator Consolidation section)

