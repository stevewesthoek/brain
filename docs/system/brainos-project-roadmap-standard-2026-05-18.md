# BrainOS Project Roadmap Standard

**Date:** 2026-05-18  
**Priority:** Low (foundational, non-blocking production work)  
**Status:** Standard defined, dashboard scaffold planned

---

## Purpose

Establish a unified, repo-agnostic way for every repo to track and expose:
- Project roadmap and phases
- Implementation plans
- Current task and status
- Validation evidence
- Commits and evidence
- Blockers and next steps

Enable BrainOS dashboard and BuildFlow to index and query project state without relying on implicit conventions or per-repo custom formats.

---

## Core Principle

**Repository-local files are source of truth.**

- Repos own their roadmaps, implementation plans, phases, and task state
- BrainOS indexes and visualizes read-only
- BuildFlow queries state but does not own truth
- All changes persist in Git

No hidden database-only state. No auto-commits or silent updates.

---

## Recommended Repo File Layout

Each repo may optionally include:

```
.brain/
  project-state.json          # Machine-readable status aggregator
  roadmap.md                  # Human-readable roadmap
  implementation-plan.md      # Phase-by-phase execution plan
  tasks.md                    # Active task list (optional)
  handoff.md                  # Session continuation (auto-updated by tools)

Also supported (legacy/current):
  .ai/current.md              # Session handoff (existing pattern)
  .buildflow/state.json       # BuildFlow local state (not committed)
  docs/system/*roadmap*.md    # Existing roadmap docs
  operations/runbooks/*       # Existing phase execution files
```

**Brain repo example:**
```
operations/project-state.json
docs/system/obsidian-mind-steward-roadmap.md
docs/system/unified-orchestrator-command-center-implementation-plan-2026-05-17.md
docs/system/stb-to-video-orchestrator-migration-plan-2026-05-17.md
docs/system/1779034841996-obsidian-mind-steward-handoff.md
operations/decision-log.md
operations/runbooks/
```

---

## Machine-Readable Schema: project-state.json

Minimal JSON shape for quick status queries:

```json
{
  "schema_version": "1.0",
  "repo_id": "brain",
  "repo_name": "Brain",
  "status": "active",
  "last_updated": "2026-05-18T14:32:00Z",
  "last_actor": {
    "type": "claude|codex|buildflow|ide|terminal|manual",
    "name": "Claude Code"
  },
  "projects": [
    {
      "project_id": "video-orchestrator",
      "name": "Video Orchestrator",
      "description": "Multi-platform video publishing orchestration",
      "owner": "steve",
      "current_phase": "phase-3a",
      "status": "in_progress",
      "phases": [
        {
          "phase_id": "phase-2a",
          "phase_name": "Production Package MVP",
          "status": "complete",
          "completed_date": "2026-05-08",
          "doc_file": "operations/runbooks/video-orchestrator-phase-2a-execution.md"
        },
        {
          "phase_id": "phase-3a",
          "phase_name": "STB Video Parity Infrastructure",
          "status": "in_progress",
          "started_date": "2026-05-18",
          "blocking_phase": null,
          "doc_file": "docs/system/stb-to-video-orchestrator-migration-plan-2026-05-17.md"
        }
      ],
      "next_safe_task": "Implement parity matrix adapter and routes",
      "blockers": ["Design orchestrator not yet built"],
      "roadmap_doc": "docs/system/obsidian-mind-steward-roadmap.md"
    }
  ],
  "decision_log_path": "operations/decision-log.md",
  "handoff_path": ".ai/current.md",
  "safety": {
    "is_read_only": true,
    "allows_mutations": false,
    "allows_auto_commit": false,
    "allows_decommission": false
  }
}
```

---

## Markdown Templates

### roadmap.md

```markdown
# [Project] Roadmap

**Owner:** [name]  
**Status:** [active|completed|frozen]  
**Last updated:** [date]

## Vision

[1-3 sentences describing the long-term goal]

## Phases (High-Level)

| Phase | Goal | Approx Timeline | Status |
|-------|------|-----------------|--------|
| Phase 1 | [goal] | 2026-05 | [active/complete] |
| Phase 2 | [goal] | 2026-06 | pending |

## Current Phase Detail

[Details of current phase and next steps]

## Non-Negotiables

[List of hard constraints]

## Success Criteria

[How we know roadmap succeeded]
```

### implementation-plan.md

```markdown
# [Project] Implementation Plan

**Date:** [date]  
**Status:** Ready for [phase name] execution

## Objective

[1-2 sentence statement of objective]

## Architecture Summary

[Diagram or text description of system components]

## Phases

### Phase [N]: [Name]

**Goal:** [brief goal statement]

**Tasks:**
- [ ] Task 1 description
- [ ] Task 2 description

**Exit criteria:**
- ✓ All tests passing
- ✓ No production impact
- ✓ Validation complete

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| [risk] | [mitigation] |
```

### tasks.md

```markdown
# [Project] Active Tasks

| Task ID | Title | Phase | Status | Priority | Owner | Due Date |
|---------|-------|-------|--------|----------|-------|----------|
| T001 | [title] | phase-2a | active | high | [name] | 2026-05-25 |
| T002 | [title] | phase-2a | blocked | high | [name] | 2026-05-25 |
```

---

## Who May Update State

**Authorized updaters:**
- Claude/Codex during code implementation sessions
- BuildFlow during controlled agent mode execution
- Terminal scripts with explicit commit messages
- IDE agents with approval gates
- Manual edits via Git

**Forbidden:**
- Auto-commits without human review
- Hidden database-only state changes
- Cross-repo mutations
- Unversioned updates

---

## Safety Model

- Dashboard read-only at first (no write controls)
- No cross-repo automatic writes
- No decommissioning without approval
- All changes are versioned in Git
- No credentials or secrets in `project-state.json`

---

## BrainOS Dashboard Integration

The BrainOS Projects tab will display (when implemented):

**Roadmap Overview Card:**
- Repo name and owner
- Current phase and status
- Progress percentage
- Next safe task

**Phase Timeline Card (Future):**
- Phases list with status
- Blocking relationships
- Estimated timelines

**Active Blockers Card (Future):**
- Top blockers
- Mitigation status
- Next action

All cards are read-only. No dashboard task controls until approval gates are designed and tested.

---

## Implementation Phases

| Phase | Goal | Timeline | Status |
|-------|------|----------|--------|
| **R1** | Standard defined, dashboard scaffold | 2026-05-18 | in-progress |
| **R2** | Repo indexer, Brain Core API | 2026-06 | planned |
| **R3** | BuildFlow status sync | 2026-07 | planned |
| **R4** | Optional dashboard controls (approval-gated) | 2026-08+ | planned |

---

## Priority

**LOW.** This feature:
- Does not block production pipeline work (Video Orchestrator, STB continuity, Post Orchestrator)
- Is additive and optional for each repo
- Does not require full repo scanner initially
- Can be expanded incrementally

High-priority work remains: Video Orchestrator production readiness, STB pipeline continuity, Post Orchestrator publishing.

---

## Next Steps

1. Repos define `operations/project-state.json` (optional)
2. Brain Console adds lightweight Projects tab cards
3. Brain Core adds read-only status endpoints (later)
4. BuildFlow queries state for controlled operations (later)
5. Dashboard task controls if/when approved (later)

No full scanner, no auto-indexing, no hidden state. Durable, repo-local source of truth.
