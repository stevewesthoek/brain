# Mind Cleanup Decision Matrix

**Date:** 2026-05-18

| Category | Current state | Risk | Preferred next action | Commit strategy | Restore/delete strategy | Needs user review? | Can be automated? | Notes |
|---|---|---:|---|---|---|---|---|---|
| `.obsidian` churn | Modified tracked files | High | Inspect one file at a time | Commit only after explicit approval | Restore unless intentionally changed | Yes | No | Vault config drift is easy to overstage |
| Legacy `04-tasks` deletions | 744 deleted tracked files | High | Review deletion intent | Separate commit only if user confirms archive/move | Restore deletions if accidental | Yes | No | Do not auto-delete numbered legacy folders |
| `01-inbox/*.base` | 3 untracked files | Medium | Determine whether editor artifacts or capture exports | Commit only if intentionally generated capture artifacts | Delete if editor junk after review | Yes | No | Treat as likely accidental until proven otherwise |
| `03-projects/04-tasks/` mirror | Untracked directory tree | Medium-High | Compare against source tree | Separate commit only after mirror/import review | Remove only after explicit approval | Yes | No | Could be a duplicate project/task mirror |
| Research notes import | Untracked research tree | Medium | Review as source-ingestion | Commit separately if the import is intended | Remove only if duplicate/incorrect | Yes | Limited | Treat as content import, not cleanup |
| Unrelated theological-studies note | Modified tracked file | Low-Medium | Review content diff directly | Commit separately if intended | Restore if accidental | Yes | Limited | Small scope but still unrelated to core migration |
| Future safe Mind OS docs | Safe docs only | Low | Auto-stage explicit docs after review | Safe to commit as docs-only slice | Restore if doc diff is wrong | No, if preapproved | Yes, limited | Only category that is reasonably auto-stageable |

## Policy Notes

- Do not automate deletion of legacy numbered folders.
- Do not commit `.obsidian` churn without manual review.
- Treat research imports as a separate source-ingestion decision.
- Treat `01-inbox` base files as likely accidental/editor artifacts until reviewed.
- Treat Mind OS docs as the only safe auto-stage category when explicitly scoped.
- Use `operations/reports/mind-legacy-task-migration-options-2026-05-18.md` before making any decision about `04-tasks/**` versus `03-projects/04-tasks/**`.
- Use `operations/reports/mind-area-note-review-2026-05-18.md` as the review record for the theological-studies note.
