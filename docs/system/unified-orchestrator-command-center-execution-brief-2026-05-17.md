# Unified Orchestrator Command Center — Phase 1 Execution Brief

**Date:** 2026-05-17  
**Scope:** Brain Core Foundation (read-only APIs)  
**Duration:** 2-3 weeks  
**Risk Level:** Low (no side effects, read-only)  
**Status:** Ready to begin

---

## Mission

Build a small, testable local HTTP service (Brain Core) that returns structured machine state without becoming a dashboard. Serve as the API boundary for Obsidian Brain Console, ProBot (legacy), and future orchestrators.

Brain Core exposes:
- System health (Brain Core itself, model-router, wiki, scheduler, local apps)
- Operational pipelines (Says the Bible, video orchestrator, migration progress)
- Registries (skills, orchestrators, local apps, projects)
- Approval queues and action requests (read-only in Phase 1)
- Scheduler status and safe job triggers

---

## Non-Negotiables

1. **No side effects** — Read-only HTTP service, no writes to Mind, no direct shell execution, no mutations
2. **Localhost-only binding** — 127.0.0.1:9000, no external internet, no credential exposure
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

### What's missing
- ❌ Brain Core service (the thing we're building)
- ❌ Brain Core read-only endpoints for orchestrators, pipelines, projects
- ❌ STB status adapter (read-only integration with ProBot)
- ❌ Video Orchestrator status adapter (progress tracking)
- ❌ Migration card aggregation (STB + video dual-visibility)

### What we're NOT doing in Phase 1
- ❌ Brain Console UI implementation (already MVP complete, Phase 2 will consume these endpoints)
- ❌ Approval-request action execution (Phase 4+)
- ❌ Mind vault mutations (blocked until separate write/apply policy approved)
- ❌ Model-router Mind writes (blocked)
- ❌ ProBot dashboard redesign (legacy/secondary, migrating features via Brain Core)
- ❌ Decommissioning anything

---

## Immediate Target: Brain Core Scaffold + Phase 1 Endpoints

### Files to create

```
projects/brain-core/
  package.json
  tsconfig.json
  jest.config.js
  esbuild.config.mjs
  .npmignore
  src/
    index.ts
    api/
      server.ts
      routes.ts
      types.ts
    adapters/
      status.ts
      local-apps.ts
      sessions.ts
      skills.ts
      orchestrators.ts
      pipelines.ts
      projects.ts
      approvals.ts
      scheduler.ts
    security/
      localhost.ts
      redaction.ts
    tests/
      adapters/
        status.test.ts
        local-apps.test.ts
        [etc. per adapter]
      api/
        server.test.ts
        routes.test.ts
    fixtures/
      mock-probot-status.json
      mock-scheduler-state.json
  README.md
  RUNBOOK.md
```

### Endpoints to implement

**Core (must have):**

```typescript
// Status
GET /status → {
  ready: boolean,
  runtime: { brainCore: string, models: string[] },
  services: object[]
}

// Local apps
GET /local-apps → { name, status, port?, logs? }[]

// Sessions
GET /sessions → { id, name, date, lastStep, model }[]

// Skills
GET /skills → { name, category, status, lastRun?, queuedItems? }[]

// Orchestrators
GET /orchestrators → {
  name, category, status, modules[], lastRun?,
  queueCount?, errorCount?, nextTask?
}[]

// Pipelines (STB + Video + Migration)
GET /pipelines → {
  name, category, status, lastRun?, queueCount?,
  failureCount?, health, metadata
}[]

GET /pipelines/:id → full detail

// Projects
GET /projects → {
  name, type, status, owner, lastModified,
  linkedPipeline?, linkedOrchestrator?
}[]

// Approvals
GET /approvals → {
  id, action, description, requested, expires, status
}[]

// Scheduler
GET /scheduler/status → { lastRun, nextRun, jobs[], health }

GET /scheduler/jobs → {
  id, name, schedule, lastRun, lastStatus,
  duration, enabled
}[]

// Execution reports
GET /execution/maintenance-previews → {
  id, type, timestamp, title, status, preview
}[]

// Health/readiness
GET /runtime/readiness → {
  ready: boolean,
  checks: { name, status, message }[]
}
```

### Adapters to build (in order)

1. **status.ts** — Brain Core internal state (ready flag, version, runtime checks)
2. **local-apps.ts** — Read ProBot app registry (safe, read-only, no side effects)
3. **sessions.ts** — Read Brain Core session storage (Claude resumption tracking)
4. **skills.ts** — Read skill index from `brain/ai/skills/active/` (registry only)
5. **orchestrators.ts** — Index video, research, design, code, model-router, scheduler (registry)
6. **pipelines.ts** — **NEW: STB status adapter** (read ProBot STB operational state, read-only)
7. **pipelines.ts cont'd** — **NEW: video orchestrator adapter** (progress tracking, modules %)
8. **pipelines.ts cont'd** — **NEW: migration card** (aggregate STB + video)
9. **projects.ts** — Index from mind vault + project tracking (links to pipelines)
10. **approvals.ts** — Read Brain Core approval queue (empty in Phase 1)
11. **scheduler.ts** — Read Office nightly scheduler state (jobs, last run)

### Tests to write (80% coverage minimum)

```
Per adapter:
- Happy path (service available, returns data)
- Error case (service unavailable, graceful 503 or fallback)
- Response schema validation (Zod)
- Redaction (no credentials/secrets in output)

API/routes:
- All endpoints callable
- Error responses formatted correctly
- Localhost-only binding verified
- Rate limiting (if implemented) verified
```

### Security layer

**File:** `src/security/localhost.ts`
- Reject all non-localhost connections
- Reject connections from 0.0.0.0 or public IPs

**File:** `src/security/redaction.ts`
- Remove credentials, tokens, API keys from all responses
- Flag if PII or secret-like patterns detected
- Log (no PII) for debugging

---

## Key Decisions

### 1. STB Status Adapter
- **Source:** ProBot dashboard status endpoints (safe, read-only)
- **Not a mutation:** Only reads STB operational state from ProBot
- **Purpose:** Expose STB status in Brain Core for Brain Console visibility
- **Why:** Says the Bible is the user's daily pipeline; visibility is critical for migration planning

### 2. Video Orchestrator Adapter
- **Source:** ProBot design artifacts (video-orchestrator-*.ts) + Brain-side state files
- **Not a write path:** Tracks progress metrics only, doesn't execute video modules
- **Purpose:** Expose video orchestrator design/progress for Brain Console migration card
- **Why:** Show user migration status without revealing internal implementation

### 3. Migration Card Aggregation
- **Source:** STB + Video status adapters
- **Purpose:** Unified view of migration progress (legacy → canonical)
- **Data:** STB operational status, video modules %, parity %, next task
- **Safety:** Read-only view only, no mutations

### 4. Localhost-only binding
- **Port:** 9000 (configurable, default 9000)
- **Address:** 127.0.0.1 (localhost fallback in Brain Console client)
- **Why:** Local machine only, no network exposure, no credential risk

### 5. No execution in Phase 1
- Endpoints are read-only
- No `/actions/request` endpoint yet (Phase 4+)
- No `/scheduler/jobs/:id/request-run` yet (Phase 4+)
- All mutations blocked by design

---

## Panels and Tabs (Brain Console Integration)

**Phase 1 MVP (already exists, will consume these endpoints):**
- Overview tab (6 cards, status pills)
- Action row (refresh button)

**Phase 2A (will consume these Phase 1 endpoints):**
- Apps tab (local-apps endpoint)
- Pipelines tab (stb + video endpoints, **NEW**)
  - Says the Bible card (operational status, platforms, warning)
  - Video Orchestrator card (progress, modules, next task)
  - Migration card (progress tracking, safeguards)

**Phase 2B (will consume Phase 1 endpoints):**
- Orchestrators tab (orchestrators endpoint)

**Phase 3+ (future phases):**
- Projects tab, Approvals tab, Research tab, System tab

---

## Tests (Definition of Done)

1. ✅ `npm run typecheck` passes (TypeScript strict mode)
2. ✅ `npm run build` produces single entry point with no external dependencies except Express, zod
3. ✅ `npm run test` passes (80% coverage minimum)
4. ✅ Service starts: `npm run start` listens on 127.0.0.1:9000
5. ✅ Health check works: `curl http://localhost:9000/status` returns JSON
6. ✅ All read-only endpoints respond (or gracefully fail)
7. ✅ No secrets in responses (secret scan passes)
8. ✅ Security layer verified: non-localhost rejected
9. ✅ Redaction layer verified: credentials removed from output
10. ✅ Graceful degradation: if ProBot offline, returns 503 not crash

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

## Phase 1 Definition of Done

- ✅ Brain Core project created and builds
- ✅ All 10 read-only endpoints implemented
- ✅ All 9 adapters implemented (including STB + video status)
- ✅ Security layer (localhost-only, redaction) verified
- ✅ Tests pass (80% coverage)
- ✅ No external shell execution
- ✅ No secrets in responses
- ✅ Graceful error handling (offline services don't crash)
- ✅ Staged and committed (no uncommitted changes)
- ✅ Ready for Phase 2 (Brain Console can consume endpoints)

---

## What NOT to touch

- ❌ Say the Bible code (read-only ProBot adapter only)
- ❌ Video Orchestrator code (status tracking only, no write path)
- ❌ ProBot dashboard (legacy, unmodified in Phase 1)
- ❌ Brain Console plugin (Phase 2, will consume these endpoints)
- ❌ Mind vault (read-only project index only)
- ❌ Model-router (no changes in Phase 1)
- ❌ Scheduler (read status only, no execution)

---

## Next Task (Phase 2)

After Phase 1 completion:
1. Start Brain Core service in background
2. Update Brain Console to consume new Phase 1 endpoints
3. Add Pipelines tab with STB + video orchestrator + migration card
4. Manual test in Obsidian: verify STB and video status display correctly
5. Validate migration card shows accurate progress

---

## Rollback Plan

If Phase 1 goes wrong:
1. Brain Core is new code, no side effects → safe to delete entire `projects/brain-core/` and start over
2. All endpoints are read-only → no data loss
3. Brain Console MVP still works with fallback data (no Brain Core required)
4. ProBot dashboard remains unchanged (fallback)
5. Says the Bible remains operational (untouched)

---

## Success Criteria (User-Facing)

1. ✅ Brain Console loads faster (caches data from local Brain Core, not ProBot web service)
2. ✅ Says the Bible operational status visible in Brain Console dashboard
3. ✅ Video Orchestrator progress visible side-by-side with STB during migration
4. ✅ Migration card shows user how close we are to STB-to-video transition
5. ✅ No user-visible breaking changes (ProBot still works as fallback)
6. ✅ No production system disrupted

---

## Questions to ask before starting

1. Should Brain Core listen on port 9000 or a different port?
2. Should STB/video status be fetched from ProBot in real-time, or cached from a recent file?
3. If ProBot is offline during Brain Core startup, should we start anyway with "unavailable" states?
4. Should we add a Brain Core `/health` endpoint that can be used by supervisor/launchd for restarts?
5. Should we implement rate limiting in Phase 1 or defer to Phase 2?

---

## Approved Assumptions

- Brain Core can read ProBot status endpoints via HTTP (localhost)
- Video Orchestrator design state can be read from `projects/video-orchestrator/` if it exists
- Model-router is read-only in Phase 1 (no apply route)
- All operations are read-only (Phase 2+ will add approval-request-only actions)
- Says the Bible must never be broken or directly written to (ProBot integration is read-only)

