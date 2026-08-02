# BS0.10 — Legacy-path producer migration

**Status:** complete (2026-07-31)
**Boundary:** retirement guards added to all four legacy-path producers; no functional
code removed; no Mind files modified; no scheduler activated.

---

## Prerequisite resolution

| Prerequisite | Resolution |
|---|---|
| M1.4 — Decide the task compatibility boundary | Resolved 2026-07-31: `kanban.md` is sole human task authority; `tasks.md` is retired/read-only/non-authoritative; no automated write to `kanban.md` is authorized. |

With M1.4 resolved, the correct disposition for all four legacy-path producers is
**retirement with exit guard**. No migration to a new destination is authorized
because: (a) the numbered roots (`0x-*/`) are historical paths per the canonical
path registry established in BS0.6; and (b) `kanban.md` is human-only authority
and no automation-write gate exists.

---

## Producer inventory

| # | Producer | Legacy target / behavior | Action taken | Result |
|---|---|---|---|---|
| 1 | `tools/scripts/clickup-importer.py` | Creates task files under `04-tasks/{task-slug}/`; git-commits to mind repo | Retired — exit guard added at line 70 | Exits `0` with retirement notice |
| 2 | `tools/scripts/mind-kanban-syncer.py` | Reads `04-tasks/` task files and writes `kanban.md`; cron every 10 min | Retired — exit guard added at line 78 | Exits `0` with retirement notice |
| 3 | `tools/scripts/mind-project-decomposer.py` | Creates task files under `04-tasks/{project-slug}/` from AI decomposition; cron every 15 min | Retired — exit guard added at line 95 | Exits `0` with retirement notice |
| 4 | `tools/scripts/mind-auto-router.py` | Routes between `01-inbox/`, `03-projects/`, `08-archive/` via GitHub API; cron every 1 min | Retired — exit guard added at line 78 | Exits `0` with retirement notice |
| 5 | `tools/scripts/bible-studies/pipeline.mjs` | Writes transcripts to `mind/05-areas/theological-studies/dance-of-life/` | **Not a legacy producer** — target is a canonical domain path; existing report-only containment verified (exits `0` unless `--mode=apply` passed) | No change needed |

---

## Migration action per producer

All four legacy producers received an identical treatment:

1. A `RETIREMENT GUARD` block was inserted immediately after the logging setup
   and before any functional code.
2. The block unconditionally prints a retirement notice (script name, date,
   reason, report reference) and exits with code 0.
3. The guard cannot be bypassed by any flag or argument — it precedes all
   argument parsing.
4. All original functional code is preserved below the guard for historical
   reference.

Retirement notice format (identical across all four):

```
RETIRED: <script-name> is retired as of 2026-07-31.
Reason: Legacy numbered roots (0x-*/) are historical paths per the canonical
path registry. kanban.md is human-only authority per M1.4.
See operations/reports/bs0-10-legacy-producer-migration-2026-07-31.md
```

---

## Bible Studies pipeline — non-legacy producer note

`tools/scripts/bible-studies/pipeline.mjs` was reviewed during the original
BS0.10 inventory but is **not a legacy-path producer**:

- Target path: `mind/05-areas/theological-studies/dance-of-life/` — this is a
  canonical domain path under the `faith/` canonical hierarchy, not a numbered
  legacy root.
- Report-only containment: the pipeline exits 0 with a notice unless
  `--mode=apply` is explicitly passed. This containment was already in place
  before BS0.10 and requires no additional guard.
- No change was made to this script.

---

## Validation

All validation commands run from `/Users/Office/Repos/stevewesthoek/brain/`:

```text
$ python3 tools/scripts/clickup-importer.py
RETIRED: clickup-importer.py is retired as of 2026-07-31. Reason: Legacy
numbered roots (0x-*/) are historical paths per the canonical path registry.
kanban.md is human-only authority per M1.4. See operations/reports/
bs0-10-legacy-producer-migration-2026-07-31.md
exit: 0  ✓

$ python3 tools/scripts/mind-kanban-syncer.py
RETIRED: mind-kanban-syncer.py is retired as of 2026-07-31. Reason: Legacy
numbered roots (0x-*/) are historical paths per the canonical path registry.
kanban.md is human-only authority per M1.4. See operations/reports/
bs0-10-legacy-producer-migration-2026-07-31.md
exit: 0  ✓

$ python3 tools/scripts/mind-project-decomposer.py
RETIRED: mind-project-decomposer.py is retired as of 2026-07-31. Reason: Legacy
numbered roots (0x-*/) are historical paths per the canonical path registry.
kanban.md is human-only authority per M1.4. See operations/reports/
bs0-10-legacy-producer-migration-2026-07-31.md
exit: 0  ✓

$ python3 tools/scripts/mind-auto-router.py
RETIRED: mind-auto-router.py is retired as of 2026-07-31. Reason: Legacy
numbered roots (0x-*/) are historical paths per the canonical path registry.
kanban.md is human-only authority per M1.4. See operations/reports/
bs0-10-legacy-producer-migration-2026-07-31.md
exit: 0  ✓

$ bun tools/scripts/bible-studies/pipeline.mjs
bible-studies pipeline: mode=report-only; no Mind or external writes
exit: 0  ✓
```

---

## Safety

```text
Mind files modified:            none
Scheduler activated:            none
Credential accessed:            none
External request made:          none
Files deleted:                  none
Functional code removed:        none (guards inserted above existing code)
No producer command was run during this task beyond the explicit validation
dry-runs shown above.
```

No Mind content, runtime state, deployment, schedule, credential, or
compatibility path changed.
