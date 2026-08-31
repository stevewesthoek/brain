# Brain Scheduler — Historical Report Index

This index separates current operating authority from dated evidence. The
reports below are retained for auditability. Their counts, paths, and
conclusions describe the state observed at their dates and must not override
the [current production state](brain-scheduler-current-state.md), the typed
registry, or the [canonical runbook](brain-scheduler.md).

## Current authority

- [Current production state](brain-scheduler-current-state.md)
- [Canonical runbook](brain-scheduler.md)
- [Typed registry](../specs/typed-scheduler-jobs.json)
- [Lessons learned](brain-scheduler-lessons-learned.md)
- [Change checklist](brain-scheduler-change-checklist.md)
- [Troubleshooting matrix](brain-scheduler-troubleshooting.md)
- [Documentation and lessons closeout](../reports/brain-scheduler-documentation-and-lessons-closeout-2026-08-31.md)

## Dated scheduler evidence

| Date | Report | Classification | Use |
|---|---|---|---|
| 2026-07-14 | [`bs0-11-scheduler-reconciliation-2026-07-14.md`](../reports/bs0-11-scheduler-reconciliation-2026-07-14.md) | historical reconciliation | Original scheduler split/drift evidence |
| 2026-07-14 | [`bs0-14-typed-scheduler-manifests-2026-07-14.md`](../reports/bs0-14-typed-scheduler-manifests-2026-07-14.md) | historical contract work | Typed registry and manifest evidence |
| 2026-08-29 | [`brain-scheduler-acceptance-2026-08-29.md`](../reports/brain-scheduler-acceptance-2026-08-29.md) | historical acceptance | Pre-migration/legacy acceptance snapshot |
| 2026-08-29 | [`brain-scheduler-current-state-2026-08-29.md`](../reports/brain-scheduler-current-state-2026-08-29.md) | historical current-state snapshot | Mixed legacy/source state before production migration |
| 2026-08-30 | [`brain-scheduler-production-activation-2026-08-30.md`](../reports/brain-scheduler-production-activation-2026-08-30.md) | historical deployment evidence | LaunchAgent identity migration and pre-natural-run acceptance |
| 2026-08-30 | [`brain-scheduler-preflight-repair-2026-08-30.md`](../reports/brain-scheduler-preflight-repair-2026-08-30.md) | historical repair evidence | First-run blockers and bounded repairs |
| 2026-08-30 | [`brain-scheduler-google-ads-sync-review-2026-08-30.md`](../reports/brain-scheduler-google-ads-sync-review-2026-08-30.md) | historical job review | Google Ads containment decision |
| 2026-08-30 | [`brain-scheduler-google-ads-sync-closeout-2026-08-30.md`](../reports/brain-scheduler-google-ads-sync-closeout-2026-08-30.md) | historical job closeout | Google Ads final blocked state |
| 2026-08-30 | [`brain-scheduler-memory-context-refresh-review-2026-08-30.md`](../reports/brain-scheduler-memory-context-refresh-review-2026-08-30.md) | historical job review | Derived-context safety decision |
| 2026-08-30 | [`brain-scheduler-memory-context-refresh-closeout-2026-08-30.md`](../reports/brain-scheduler-memory-context-refresh-closeout-2026-08-30.md) | historical job closeout | Memory refresh final blocked state |
| 2026-08-30 | [`brain-scheduler-n8n-backup-review-2026-08-30.md`](../reports/brain-scheduler-n8n-backup-review-2026-08-30.md) | historical job review | Credential/backup safety decision |
| 2026-08-30 | [`brain-scheduler-n8n-backup-closeout-2026-08-30.md`](../reports/brain-scheduler-n8n-backup-closeout-2026-08-30.md) | historical job closeout | n8n backup final blocked state |
| 2026-08-30 | [`brain-scheduler-skill-prune-retirement-2026-08-30.md`](../reports/brain-scheduler-skill-prune-retirement-2026-08-30.md) | historical job retirement | Skill-prune retirement decision |
| 2026-08-30 | [`brain-scheduler-skill-prune-deletion-2026-08-30.md`](../reports/brain-scheduler-skill-prune-deletion-2026-08-30.md) | historical cleanup evidence | Skill-prune removal evidence |
| 2026-08-30 | [`brain-scheduler-video-storage-migration-review-2026-08-30.md`](../reports/brain-scheduler-video-storage-migration-review-2026-08-30.md) | historical job review | Storage-report migration decision |
| 2026-08-30 | [`brain-scheduler-video-storage-migration-accepted-2026-08-30.md`](../reports/brain-scheduler-video-storage-migration-accepted-2026-08-30.md) | historical job acceptance | Storage cleanup obsolete state |
| 2026-08-30 | [`brain-scheduler-obsolete-review-2026-08-30.md`](../reports/brain-scheduler-obsolete-review-2026-08-30.md) | historical job review | Retained obsolete candidates |
| 2026-08-31 | [`brain-scheduler-first-natural-run-acceptance-2026-08-31.md`](../reports/brain-scheduler-first-natural-run-acceptance-2026-08-31.md) | historical production acceptance | First natural run, containment, and provenance |
| 2026-08-31 | [`brain-scheduler-documentation-and-lessons-closeout-2026-08-31.md`](../reports/brain-scheduler-documentation-and-lessons-closeout-2026-08-31.md) | current documentation closeout | Consolidated current docs, lessons, paths, and no-loose-ends audit |

The 2026-08-31 natural-run report is the final runtime acceptance evidence.
The current-state document records the later source/runtime SHA and the
documentation-only receipt-contract correction without rewriting that report.
