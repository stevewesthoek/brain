# Mind Cleanup Decision Matrix

**Date:** 2026-05-18

| Category | Current state | Risk | Preferred next action | Commit strategy | Restore/delete strategy | Needs user review? | Can be automated? | Notes |
|---|---|---:|---|---|---|---|---|---|
| `.obsidian` churn | `community-plugins.json` modified; plugin folders untracked | High | Inspect one file at a time | Commit only after explicit approval of exact files | Restore unless intentionally changed | Yes | No | Vault config drift is easy to overstage |
| Legacy `04-tasks` deletions | Migrated into `03-projects/04-tasks/` | High | Review migration result | Migration completed in a single commit after parity verification | Restore via reverse migration if needed | Yes | No | Do not auto-delete numbered legacy folders |
| `01-inbox/*.base` | 3 untracked files | Medium | Determine whether editor artifacts or capture exports | Commit only if intentionally generated capture artifacts | Delete if editor junk after review | Yes | No | Treat as likely accidental until proven otherwise |
| `03-projects/04-tasks/` mirror | Untracked directory tree | Medium-High | Compare against source tree | Separate commit only after mirror/import review | Remove only after explicit approval | Yes | No | Could be a duplicate project/task mirror |
| Research notes import | Empty placeholder removed | Low | No action unless real content is later added | Commit separately only for real content | Delete empty placeholders only | Maybe | Limited | Treat as content import, not cleanup |
| Unrelated theological-studies note | Updated tracked file | Low-Medium | Review content diff directly | Commit separately if intended | Restore if accidental | Yes | Limited | Small scope but still unrelated to core migration |
| Future safe Mind OS docs | Safe docs only | Low | Auto-stage explicit docs after review | Safe to commit as docs-only slice | Restore if doc diff is wrong | No, if preapproved | Yes, limited | Only category that is reasonably auto-stageable |

## Policy Notes

- Do not automate deletion of legacy numbered folders.
- Do not commit `.obsidian` churn without manual review.
- Treat research imports as a separate source-ingestion decision.
- Treat `01-inbox` base files as likely accidental/editor artifacts until reviewed.
- Treat Mind OS docs as the only safe auto-stage category when explicitly scoped.
- Treat empty research placeholders as deletable without commit.
- Use `operations/reports/mind-legacy-task-migration-options-2026-05-18.md` as the pre-migration decision record.
- Use `operations/reports/mind-legacy-task-preservation-2026-05-18.md` as the rollback/preservation anchor.
- Use `operations/reports/mind-area-note-review-2026-05-18.md` as the review record for the theological-studies note.
- Use `operations/reports/mind-obsidian-exact-path-review-2026-05-18.md` for exact `.obsidian` path review.
- Use `operations/reports/mind-obsidian-resolution-2026-05-18.md` for the current `.obsidian` decision boundary.
- Use `operations/reports/mind-research-placeholder-resolution-2026-05-18.md` for the empty research placeholder resolution.
