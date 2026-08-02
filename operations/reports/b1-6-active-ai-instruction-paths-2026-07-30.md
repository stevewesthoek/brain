# B1.6 — Active AI Instruction Paths

**Date:** 2026-07-30  
**Task:** B1.6 — Update active AI instruction paths  
**Repository:** Brain only  
**Branch:** `release/brain-stabilization-v1`  
**HEAD:** `61b9cfe7169ce38759a4f5b2072c1ab6b1968095`

## Authority

- Roadmap: `operations/specs/infinite-brain-runtime-roadmap.md`, Priority 1 runtime deliverables.
- Implementation plan: `operations/specs/infinite-brain-runtime-implementation-plan.md`, lines 454–460.

## Files inspected

- `operations/system-configs/claude/CLAUDE.md`
- `operations/system-configs/codex/AGENTS.md`
- `operations/system-configs/cursor/AGENTS.md`
- `operations/system-configs/gemini/GEMINI.md`
- `operations/system-configs/ide-context.md`
- `operations/system-configs/kiro/steering/brain-mind-context.md`

## Evidence

The accepted instruction paths are:

- `/Users/Office/Repos/stevewesthoek/mind/system/agent-context/AGENTS.md`
- `/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-start-here.md`
- `/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-current-context.md`
- `/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-memory-map.md`

All six scoped active Brain instruction files reference the current entrypoint paths. The scoped stale-path scan checked `mind/router`, `mind/00-memory-map`, `mind/03-`, `mind/04-`, `mind/06-`, `mind/capture/inbox`, `mind/capture/failed`, `mind/live/`, and `mind/sources/`; it returned no matches.

No instruction-file edits were required. Existing dirty, staged, and untracked work was preserved.

## Acceptance mapping

| Criterion | Result |
|---|---|
| Active Claude, Codex, Gemini, Cursor, Kiro, and IDE instruction paths use the current agent-context entrypoints | PASS — all six scoped files inspected |
| Current research/task/project path references are retained in the active instruction surface | PASS — no scoped predecessor-path matches |
| No unexplained active old path remains in the scoped scan | PASS — zero matches |
| Generated files are not edited directly | PASS — no instruction-file edits |

## Validation

- Current-path scan over the six scoped files: **PASS**; all four accepted paths found.
- Stale-path scan over the scoped active Brain instruction files: **PASS**; zero matches.
- Markdown/task-identifier review: **PASS**; B1.6 references resolve to the implementation plan and this report.
- `git diff --check`: **PASS**.

## Explicit exclusions

No Workbench Private, ProChat, Mind, Codebase Memory MCP runtime, Graphify runtime, or Orbit work was performed. B1.7 was not marked complete or started; its cross-repo verification dependency remains outside this task.
