# Obsidian Mind + Mind Steward Implementation Plan

**Date:** 2026-05-16
**Status:** ready for execution planning
**Roadmap:** `docs/system/obsidian-mind-steward-roadmap.md`

## Objective

Implement an unnumbered Obsidian-first `mind` structure maintained by a `brain`-hosted mind steward, with Save-to-Mind as the capture ingress and the Office nightly scheduler running maintenance loops exposed through Brain Core.

## Current Status

- The repo now has report-only dry-run loops, preview-policy surfaces, preview-artifact surfaces, and compact wiki-health summaries.
- `wiki/log.md` is now part of the Mind contract as an append-only maintenance ledger.
- The first write/apply boundary remains intentionally blocked until the separate policy is approved and tested.
- The next safe step is still lint/report refinement, not Mind mutation.

## Confirmed Architecture Choices

- Use clean folder names, not numeric prefixes.
- Use Obsidian manual sorting plugin for visual order.
- Keep Save-to-Mind as the permanent capture doorway.
- Keep `/webhook/mind-inbox` as the public endpoint for compatibility.
- Move the Save-to-Mind internal target from `01-inbox/` to `capture/inbox/`.
- Put mind-steward implementation in `brain/projects/mind-steward/`.
- Put mind-steward vault contract in `mind/router/`.
- Add compile, memory, hygiene, and drift/error loops to the Office nightly scheduler.
- Expose scheduler status and safe controls through Brain Core.

## 12-Step Execution Order (Phase 9B Dashboard Added)

### 1. Document the new mind architecture in brain

Create and maintain:

```text
docs/system/obsidian-mind-steward-roadmap.md
docs/system/obsidian-mind-steward-implementation-plan.md
```

Exit criteria:

- Brain docs explain the target mind structure, mind-steward placement, Save-to-Mind path, scheduler loops, and expansion rules.

### 2. Create matching migration plan in mind

Create in `mind`:

```text
MIND-OS-ROADMAP.md
MIND-OS-IMPLEMENTATION-PLAN.md
```

Exit criteria:

- Mind has human-readable migration docs visible from Obsidian.
- The docs explain what will change without requiring the user to read brain internals.

### 3. Update Save-to-Mind docs to target `capture/inbox/`

Update brain docs:

```text
operations/runbooks/n8n-mind-inbox.md
operations/integrations/save-to-mind/README.md
operations/integrations/save-to-mind/SYSTEM_PROMPT.md
operations/integrations/save-to-mind/openapi.json
```

Do not change the live n8n workflow yet.

Exit criteria:

- Docs define the new target path.
- Backward compatibility notes explain the old `01-inbox/` path.
- Failure buffer target is documented as `capture/failed/`.

### 4. Create new folders in mind beside old ones

Create:

```text
router/
capture/inbox/
capture/daily/
capture/failed/
live/
wiki/
sources/
archive/
```

Do not delete or move old PARA folders yet.

Exit criteria:

- New structure exists safely beside old structure.
- Obsidian can display the folders.
- Manual sorting plugin can order them visually.

### 5. Create router contract files

Create:

```text
router/current.md
router/map.md
router/rules.md
router/taxonomy.md
router/maintenance.md
router/mind-steward.md
```

Exit criteria:

- A model can start from `router/current.md` and `router/map.md` without loading the whole vault.
- Write rules and maintenance thresholds are explicit.

### 6. Build mind-steward project in brain

Target:

```text
brain/projects/mind-steward/
```

Initial capabilities:

```text
classify capture
normalize frontmatter
route capture
update live/tasks.md
update live/projects.md
update live/decisions.md
compile wiki page
update sources/index.md
run hygiene checks
run drift checks
produce job report
```

Exit criteria:

- CLI can run each loop in dry-run mode.
- CLI can write changes only after explicit mode/approval.
- Tests cover classification, routing, file-size limits, and no-secret safeguards.

### 7. Update n8n Save-to-Mind target path

Change live workflow output path:

```text
from: 01-inbox/
to:   capture/inbox/
```

Keep endpoint:

```text
/webhook/mind-inbox
```

Exit criteria:

- Test capture lands in `capture/inbox/`.
- Response returns new path.
- Old `01-inbox/` is no longer used by new captures.

### 8. Add capture failure buffer

Add fallback behavior:

```text
Gemini/classification failure -> capture/failed/
GitHub write failure -> n8n error + retry visibility
```

Exit criteria:

- User-facing captures are not silently lost.
- Failed captures are recoverable.
- Drift/error loop reports stale failed captures.

### 9. Build daily maintenance loops in Office nightly scheduler

Add scheduler jobs after existing high-load work:

```text
mind-compile-loop
mind-memory-loop
mind-hygiene-loop
mind-drift-error-loop
```

Recommended order:

```text
1. existing heavy/media jobs
2. existing backups/cleanup
3. mind-compile-loop
4. mind-memory-loop
5. mind-hygiene-loop
6. mind-drift-error-loop
7. render scheduler report
```

Exit criteria:

- Jobs are registered in `operations/infrastructure/scheduler-inventory.md`.
- `tools/scripts/office-nightly-scheduler.sh` runs each job with timeouts and state files.
- `tools/scripts/render-office-scheduler-report.sh` includes the new job states.
- Reports are exposed by Brain Core later.

### 9A. Add LLM Wiki maintenance primitives before write/apply

Add the lean Karpathy-aligned primitives before broad Mind mutation:

```text
wiki/log.md      append-only knowledge-maintenance ledger
source trace     lightweight links from compiled claims/pages back to captures or sources
lint report      contradiction, stale-claim, orphan, missing-link, oversized-file, and failed-capture checks
```

Exit criteria:

- `wiki/log.md` is part of the target Mind contract, but not used as a Brain runtime log.
- Model-router dry-run reports can identify missing source trace, stale claims, orphan pages, and broken/missing links.
- Any future write/apply preview includes expected source-trace and rollback metadata.
- The Obsidian dashboard exposes only compact status: changed, failed, needs approval, and next action.

### 9B. Build Obsidian Command Center dashboard

Implement Brain Console Obsidian plugin dashboard as the user's primary system cockpit.

**Visual design:**
- Dark gray-black background (#0a0e27), warm red-orange accents (#ff6b3d)
- Status strip with 6 pill indicators (Brain Core, Mind Steward, Scheduler, Save-to-Mind, Approvals, Maintenance)
- Card-based layout showing system metrics, action queues, and health status
- Monospaced system data labels; progressive disclosure (hover for detail)

**Core cards (MVP scope):**
```text
Wiki Health           mind-steward lint results (ok/warnings/errors)
Maintenance Previews  queue of proposed maintenance actions
Approvals             pending approval requests from Brain Core
Scheduler Status      nightly job queue and health
Brain Core            runtime/execution status and readiness gates
Next Safe Action      recommended action or current context
```

**Action row buttons:**
```text
Refresh             poll all Brain Core endpoints
Request Dry Run     trigger mind-steward preview
View Latest         inspect latest artifact/preview
Open Mind           navigate to mind vault in Obsidian
Open Wiki Log       jump to wiki/log.md
```

**Data sources:**
```text
Brain Core /status                        → status pills
/runtime/reports                          → wiki health card
/execution/maintenance-previews           → maintenance queue card
/approvals                                → approvals card
/scheduler/jobs                           → scheduler status card
/execution/readiness                      → brain core card + next safe action
```

**Implementation targets:**
- File: `projects/brain-console-obsidian/src/view.ts` (main dashboard)
- Styles: `projects/brain-console-obsidian/src/styles.css` (dark cockpit theme)
- Client: `projects/brain-console-obsidian/src/client.ts` (Brain Core polling)

Exit criteria:

- Dashboard renders without errors in Obsidian
- All 6 core cards display and poll their endpoints successfully
- Action buttons fire correct Brain Core requests (no mutations)
- Dark cockpit theme matches design spec
- No Mind mutations; plugin is read-only
- Type safety: all Brain Core responses match API types
- Tests verify card rendering and data handling
- Manual Obsidian testing confirms UX matches spec

### 10. Compile old PARA content into wiki/live (after dashboard stabilizes)

The mind steward should read old folders and create clean compiled pages:

```text
02-strategy/ -> wiki/organisations.md + live/decisions.md
03-projects/ -> live/projects.md
04-tasks/ -> live/tasks.md
05-areas/ -> wiki/*.md
06-resources/ -> sources/ and wiki/
08-archive/ -> archive/
```

Do not mass-delete old content during first pass.

Exit criteria:

- `HOME.md` and `TODAY.md` point to the new structure.
- Daily work is possible from `live/` and `wiki/`.
- Old folders become legacy reference only.

### 11. Archive old numbered folders after validation (post-dashboard)

Only after new structure works:

```text
01-inbox/ -> archive/old/legacy-01-inbox/
02-strategy/ -> archive/old/legacy-02-strategy/
03-projects/ -> archive/old/legacy-03-projects/
04-tasks/ -> archive/old/legacy-04-tasks/
05-areas/ -> archive/old/legacy-05-areas/
06-resources/ -> archive/old/legacy-06-resources/
07-templates/ -> archive/old/legacy-07-templates/
08-archive/ -> merge into archive/old/
```

Exit criteria:

- Save-to-Mind no longer writes to old paths.
- Obsidian dashboards no longer depend on old paths.
- Model router map no longer depends on old paths except legacy search fallback.
- Old paths can be searched but are not part of the daily surface.

## Current Status

- Steps 1 through 9A are complete at the report-only / preview-policy level.
- Preview artifact inspection is now available through Brain Core read-only endpoints.
- Step 9B (Obsidian Command Center dashboard) is the current focus — specification complete, implementation starting.
- Steps 10 and 11 remain intentionally blocked from broad Mind mutation until dashboard stabilizes.
- Next safe step: implement dashboard visual design and card rendering (Work Package C).

## Brain Core Scheduler API Additions

Add read-only first:

```text
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /scheduler/jobs/:id
```

Later controlled actions:

```text
POST /scheduler/jobs/:id/request-run
POST /scheduler/jobs/:id/request-disable
POST /scheduler/jobs/:id/request-enable
```

Rules:

- Read-only endpoints first.
- Mutations require local-only access and approvals.
- No direct shell execution from Obsidian.
- Obsidian requests actions through Brain Core.

## Scheduler Job Definitions

### mind-compile-loop

Purpose: compile captures and sources into `wiki/` and update `sources/index.md`.

Expected runtime: low to medium.

Safety: dry-run first during initial deployment.

### mind-memory-loop

Purpose: refresh `router/current.md`, `TODAY.md`, and durable memory summaries.

Expected runtime: low.

Safety: strict line limits.

### mind-hygiene-loop

Purpose: detect duplicates, oversized files, stale captures, stale tasks, broken links, and orphan notes.

Expected runtime: low.

Safety: report-only first.

### mind-drift-error-loop

Purpose: verify folder contract, Save-to-Mind path, Brain Core availability, schema consistency, and scheduler health.

Expected runtime: low.

Safety: report-only first.

## Validation Strategy

Before live path migration:

- Confirm new folders exist in mind.
- Confirm router contract files exist.
- Confirm mind-steward dry-run can read old and new structures.
- Confirm Save-to-Mind test still works with old path.

After live path migration:

- Send a Save-to-Mind test capture.
- Verify file lands in `capture/inbox/`.
- Verify mind-steward can process it.
- Verify scheduler loop reports include mind-steward jobs.
- Verify Obsidian dashboard links work.

## Rollback Strategy

Rollback path:

- Keep old folders until validation passes.
- Keep `/webhook/mind-inbox` endpoint stable.
- If new path fails, n8n can temporarily write back to `01-inbox/`.
- If mind-steward loops fail, disable only the new scheduler jobs; existing scheduler remains intact.
- Obsidian remains usable through `HOME.md` and legacy folders during migration.

## Definition of Done

The migration is complete when:

- New captures land in `capture/inbox/`.
- Failed captures land in `capture/failed/`.
- `mind/router/` is the mind-steward contract.
- `brain/projects/mind-steward/` runs compile, memory, hygiene, and drift/error loops.
- Office nightly scheduler runs the loops and reports their status.
- Brain Core exposes scheduler state.
- `mind/live/` and `mind/wiki/` are the daily surfaces.
- Old numbered folders are archived or legacy-only.
- The user can operate entirely from Obsidian without thinking about folder mechanics.
