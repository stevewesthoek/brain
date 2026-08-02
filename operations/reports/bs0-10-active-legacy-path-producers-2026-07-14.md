# BS0.10 — Active legacy-path producer migration

**Status:** blocked (2026-07-14)  
**Boundary:** no producer was changed; stop before BS0.11.

## Prerequisite result

BS0.6–BS0.9 are complete and establish the canonical path registry, consumer
migration, and compatibility-read boundary. The conditional M1.4 prerequisite
is not met for task-producing scripts:

- Mind `M1.4 — Decide the task compatibility boundary` is **blocked**.
- `kanban.md` remains the current task authority until lossless task
  synchronization is validated.
- Mind `MS0.9` independently confirms that M1.4 remains blocked until its
  lossless migration gate passes.

No alternate task destination can be inferred from the folder registry. The
registry marks `tasks.md` and `tasks/` future-only and `kanban.md` human-only;
that is not an authorization to transform directory-based task producers into
Kanban writers.

## Producer inventory

Static inspection found executable legacy-path producers, not merely historical
documentation:

| Producer | Legacy target or behavior | Blocking reason |
|---|---|---|
| `tools/scripts/clickup-importer.py` | Creates task files under `04-tasks/{task-slug}/` | Direct task-authority mutation; M1.4 is blocked. |
| `tools/scripts/mind-kanban-syncer.py` | Reads and synchronizes task files under `04-tasks/` | A migration would change the unproven synchronization boundary. |
| `tools/scripts/mind-project-decomposer.py` | Creates task files under `04-tasks/` | Direct task-authority mutation; no canonical task-file authority exists. |
| `tools/scripts/mind-auto-router.py` | Routes between numbered inbox/project/strategy/archive roots; documents cron and GitHub API mutation | It is an unsafe scheduled/mutating producer under BS0.1–BS0.3 and requires a separately approved, report-only replacement design. |

The inventory also contains historical reports and explicit blocked-input
fixtures. Those are not producers and were not treated as migration work.

## Required resolution before retrying BS0.10

1. Complete Mind `MS0.9` and resolve M1.4 with a lossless synchronization,
   rollback, and human-approval gate.
2. Decide whether each legacy task script is retired, transformed into a
   report-only proposal producer, or migrated through the approved task gate.
3. For `mind-auto-router.py`, establish a bounded report-only worker design
   with no cron activation, GitHub mutation, or credential dependency before
   changing its path policy.
4. Re-run the producer inventory and dry-run assertions only after those
   decisions exist.

## Validation and safety

```text
Static producer inventory: pass — four executable legacy producers classified.
M1.4 / MS0.9 evidence: pass — task authority remains blocked and kanban.md is current.
No producer command, scheduler, webhook, n8n workflow, or external request was invoked.
No credential source or value was accessed.
```

Mind was inspected read-only and its worktree hash remained
`20f17fee9b212f8491b05c15c0daf2e1de94f4922f4a4658127719f55cbad652`.
No Mind content, runtime state, deployment, schedule, credential, or
compatibility path changed.

## Verdict

**BS0.10 cannot complete safely.** Migrating these producers would either
mutate unresolved human task authority or weaken existing containment. Per the
task stop condition, BS0.11–BS0.17 did not begin.
