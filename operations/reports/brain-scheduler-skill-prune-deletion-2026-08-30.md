# Brain Scheduler Skill-Prune Deletion Closeout

**Date:** 2026-08-30
**Scope:** Explicit deletion of the obsolete `skill-prune` subsystem only.
**Authority:** `operations/reports/brain-scheduler-skill-prune-retirement-2026-08-30.md`

## Decision and authorization

The operator explicitly approved deletion after the retirement review classified
`skill-prune` as `OBSOLETE`, `DELETE CANDIDATE`, disabled, and non-runnable.
The replacement policy is:

> Brain skills are deliberately curated. Skills are not automatically pruned
> based on age, inactivity, or heuristic scoring. Removing a skill is an
> explicit intentional maintenance decision.

This change was performed in the isolated worktree
`/private/tmp/brain-skill-prune-deletion.hRvHiF` on branch
`codex/skill-prune-deletion-20260830`. The shared dirty Brain checkout,
`brain-console-launcher`, Mind data, and the nightly scheduler LaunchAgent were
not modified.

## 1. Source and deployment identity

| Surface | Evidence |
| --- | --- |
| `origin/main` before deletion | `d49c2938dc1ddf62006411ec65ea951061a792ec` |
| Deletion implementation commit | `8eca3686dabb7a676d8bfe6dd50fe7af1c9d76d5` |
| `origin/main` after deletion implementation | `8eca3686dabb7a676d8bfe6dd50fe7af1c9d76d5` |
| Clean live runtime at code acceptance | `/Users/Office/Repos/stevewesthoek/brain-runtime` at `8eca3686dabb7a676d8bfe6dd50fe7af1c9d76d5` |
| Brain Core process | PID `95625`, executable source from the clean runtime's `projects/brain-core/dist/index.js` |
| Console process | Existing on-demand Next.js dev server from the clean runtime; no persistent supervisor was created |

The deletion implementation was pushed normally to
`codex/skill-prune-deletion-20260830` and fast-forwarded into `origin/main`.

The installed LaunchAgent remains a separate identity issue:
`/Users/Office/Library/LaunchAgents/com.office.nightly-scheduler.plist` still
targets `/Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh`.
The clean runtime's Core evidence therefore truthfully reports
`launch.matchesSource=false`, `status=error`, and `health=failed` even though
the manifest and 16-job API payload are valid. No LaunchAgent reload, kickstart,
bootstrap, bootout, or scheduler execution was performed.

## 2. Delete manifest and result

The pre-deletion manifest was checked against the accepted retirement report.
The following current prune-exclusive paths were deleted:

- `ai/skills/custom/learned/skill-prune/SKILL.md`
- `ai/skills/prune-config.json`
- `tools/scripts/skill-prune-delete.sh`
- `tools/scripts/skill-prune-keep.sh`
- `tools/scripts/skill-prune-quarantine.sh`

These expected candidates were already absent and required no deletion:

- `tools/scripts/skill-prune-report.sh` — previously deleted historical report producer
- `ai/skills/active/skill-prune` — no active symlink existed before or after the change
- `operations/runbooks/skill-prune.md` — previously deleted historical runbook
- `runtime/local/skill-prune/` — absent from the repository source
- prune-specific canonical monolith logic — absent from the clean canonical
  `tools/scripts/office-nightly-scheduler.sh`, which is already a thin bootstrap

The canonical scheduler registry row was removed from
`operations/specs/typed-scheduler-jobs.json`. No other scheduler row or
classification was changed. The generic runner remains registry-backed and
requires no prune-specific branch.

## 3. Current documentation and command surface

Updated current documentation now states deliberate skill curation and the
absence of automated age/inactivity/heuristic pruning:

- `ai/skills/README.md`
- `docs/skills/profiles/full-current.txt`
- `operations/runbooks/skill-profile-onboarding.md`
- `operations/runbooks/brain-scheduler.md`
- `operations/specs/infinite-brain-context-learning-runtime-architecture.md`
- `projects/brain-core/README.md`

The current skill profile no longer names `skill-prune`. The default profile
still resolves exactly to the seven existing active entries. The stale
Kiro cleanup reference was removed without touching Kiro machine-local state.

## 4. Retained historical evidence

Historical evidence was deliberately retained:

- `operations/reports/brain-scheduler-skill-prune-retirement-2026-08-30.md` —
  pre-deletion authority and reference/dependency audit
- `operations/reports/brain-scheduler-acceptance-2026-08-29.md`
- `operations/reports/brain-scheduler-current-state-2026-08-29.md`
- `operations/reports/brain-scheduler-google-ads-sync-closeout-2026-08-30.md`
- `operations/reports/brain-scheduler-google-ads-sync-review-2026-08-30.md`
- `operations/reports/brain-scheduler-memory-context-refresh-closeout-2026-08-30.md`
- `operations/reports/brain-scheduler-memory-context-refresh-review-2026-08-30.md`
- `operations/reports/brain-scheduler-n8n-backup-closeout-2026-08-30.md`
- `operations/reports/brain-scheduler-n8n-backup-review-2026-08-30.md`
- `operations/reports/brain-scheduler-obsolete-review-2026-08-30.md`
- `operations/reports/brain-scheduler-video-storage-migration-accepted-2026-08-30.md`
- `operations/reports/brain-scheduler-video-storage-migration-review-2026-08-30.md`
- `operations/reports/bs0-11-scheduler-reconciliation-2026-07-14.md`
- `operations/reports/bs0-14-typed-scheduler-manifests-2026-07-14.md`
- `operations/decision-log.md:237-238` and `:250` — historical decision and
  rollback references

The machine-local metadata-only files were also left untouched:

- `/Users/Office/.local/state/office-scheduler/skill-prune.env`
- `/Users/Office/.local/state/office-scheduler/skill-prune.last`
- `/Users/Office/.local/state/office-scheduler/skill-prune.last-month`

No quarantined repository items existed, and no runtime-local prune directory
was removed.

## 5. Skill integrity

| Check | Result |
| --- | --- |
| Active skill count before | 7 |
| Active skill count after | 7 |
| Only active `skill-prune` entry removed | N/A — it was already absent before deletion |
| Unrelated skills changed | NO |
| Unrelated active symlinks changed | NO |
| Remaining active symlinks resolve | PASS — all 7 |
| Default profile exact-match check | PASS — 7 profile entries and 7 active entries |
| Active snapshot before/after | IDENTICAL |

The generic `sync-ai-skills.mjs --check` was run read-only. It remains
non-green because of pre-existing machine-local consumer state: Antigravity
points to `/Users/Office/.gemini/config/skills`, and Kiro's consumer links are
not reachable from the isolated/runtime source snapshots. No sync apply was
run and no consumer state was changed. The `full-current` profile also retains
an unrelated pre-existing duplicate `brain-nightly-scheduler-new-job`; the
removed `skill-prune` line is absent.

## 6. Scheduler inventory

| State | Jobs | ACTIVE | BLOCKED | NEEDS REVIEW | OBSOLETE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before | 17 | 4 | 10 | 0 | 3 |
| After | 16 | 4 | 10 | 0 | 2 |

The remaining obsolete jobs are exactly:

- `gemini-cleanup`
- `video-orchestrator-storage-cleanup`

All other 16 job IDs remain in their prior order and classifications.
`skill-prune` is absent from the registry, runner receipts, current tests,
current runbook, and current profile.

## 7. Live Brain Core acceptance

After the clean runtime was fast-forwarded to the deletion implementation,
Brain Core was rebuilt with `npm run build` and restarted through the existing
`npm run brain-core:restart` mechanism. The read-only live checks returned:

- `GET http://127.0.0.1:4877/health` — HTTP 200, `ok=true`, `service=brain-core`
- `GET http://127.0.0.1:4877/infra/scheduler` — HTTP 200
- manifest `valid=true`, `jobCount=16`, authority `canonical-job-registry`
- human review counts: `ACTIVE=4`, `BLOCKED=10`, `NEEDS REVIEW=0`, `OBSOLETE=2`
- `skill-prune` present: NO
- `n8n-backup`: `BLOCKED`
- `google-ads-sync`: `BLOCKED`
- `memory-context-refresh`: `BLOCKED`
- `gemini-cleanup`: `OBSOLETE`
- `video-orchestrator-storage-cleanup`: `OBSOLETE`

The API's overall `health=failed` is the expected truthful result of the
separate LaunchAgent source mismatch (`matchesSource=false`), not a registry
or deletion failure.

## 8. Console acceptance

The existing on-demand Console at `http://127.0.0.1:4881/scheduler` returned
HTTP 200. Its rendered DOM was inspected after the Core refresh and showed:

- 16 scheduler table rows
- `ACTIVE=4`, `BLOCKED=10`, `NEEDS REVIEW=0`, `OBSOLETE=2`
- `Manifest: true · 16 jobs`
- no visible `skill-prune` row or prune action
- all required retained rows present
- no unrelated row missing

## 9. Validation

Passed validations:

- `git diff --check`
- JSON registry parse and exact 16-ID comparison against the pre-deletion
  registry, proving only `skill-prune` was removed
- `node tools/validate-typed-scheduler-jobs.mjs`
  — `typed-scheduler-jobs-valid jobs=16`
- `node tools/validate-infinite-brain-scheduler-inventory.mjs`
  — `compatibility=typed-registry jobs=16`
- `node --test tools/validate-typed-scheduler-jobs.test.mjs tools/validate-infinite-brain-scheduler-inventory.test.mjs tools/scripts/brain-scheduler-runner.test.mjs`
  — 10 passed, 0 failed
- Brain Core focused tests for `infra-office-scheduler` and `infra-endpoints`
  — 42 passed, 0 failed
- Brain Core TypeScript typecheck — passed
- clean-runtime Brain Core build — passed
- `node tools/scripts/switch-skill-profile.mjs default --check` — passed
- all seven remaining active symlinks resolve to `SKILL.md`
- live Core and Console HTTP/DOM acceptance above

No scheduler job was run. Runner tests used mocked child processes; the
dry-run assertion confirmed zero child-process spawns.

## 10. Safety checklist

| Guard | Result |
| --- | --- |
| Other skills deleted | NO |
| Vendor skills deleted | NO |
| Other learned skills deleted | NO |
| Other active symlinks modified | NO |
| Generic skill-management helpers removed | NO |
| Historical scheduler reports removed | NO |
| Runtime evidence removed | NO |
| Scheduler jobs executed | NO |
| Prune scripts executed before deletion | NO |
| Quarantine operation performed | NO |
| `com.office.nightly-scheduler` modified or reloaded | NO |
| `FORCE_RUN` used against the scheduler | NO |
| Mind writes performed | NO |
| Shared dirty checkout touched | NO |
| `brain-console-launcher` touched | NO |
| Force push used | NO |

## 11. Remaining separate issue and next step

All scheduler jobs now have final human dispositions; no NEEDS REVIEW jobs
remain.

`com.office.nightly-scheduler` still uses the legacy monolith and must later be
migrated to the accepted canonical Brain Scheduler runner. That source/deployment
identity migration is a separate goal and was intentionally not performed here.

skill-prune has been removed; the curated skill system remains intact.
