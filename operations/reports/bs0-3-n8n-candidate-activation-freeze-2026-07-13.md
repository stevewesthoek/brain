# BS0.3 — n8n candidate activation freeze

**Execution date:** 2026-07-14  
**Status:** complete  
**Verdict:** PASS — the repository candidate is explicitly paused and cannot be represented as deployed, activated, scheduled, or verified.

## Scope and boundary

This was a repository-only containment task. It did not query n8n, invoke a
webhook, deploy a workflow, change a schedule, read credential values, alter
Mind, or create generated runtime output. The stored B1.0a rollback artifact
was used only for JSON parsing, byte count, workflow-ID metadata, and a SHA-256
integrity check; its raw content was not emitted.

## Freeze decision

| Subject | Repository state | What it does not establish |
|---|---|---|
| Save-to-Mind candidate (`FwP5INe9qoo1OwGC`) | top-level `active: false`; `candidateState.paused: true` | deployment, live activation, schedule, or live version |
| Candidate routing | static `inbox/new` success and `inbox/failed` failure paths validate | a live workflow observed either route |
| Stored B1.0a rollback artifact | JSON-valid; 26,683 bytes; SHA-256 `703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd` | current live state or a verified failure path |
| B1.0a | incomplete and postponed | authorization to activate the candidate |

The stored rollback artifact provides only partial historical evidence of a
canonical success route. It is not a current live observation. Canonical
failure-path runtime evidence remains unverified.

## Changes

- Paused the repository candidate workflow without changing its routing logic.
- Added an explicit candidate state to the topology manifest: repository
  candidate, deployment unverified, activation/schedule/live version not
  asserted, paused, and B1.0a incomplete.
- Made the candidate and topology planners static-only. Their status, deploy,
  and rollback planning modes emit no live n8n command and require separate
  approval for any live action.
- Extended the static validator and tests to fail closed if the candidate is
  activated, candidate state is missing or altered, routing regresses, or a
  planner attempts to use live n8n tooling.
- Corrected the capability status page so it reports the candidate as paused
  rather than active and identifies BS0.4 as the next P0 stabilization task.

## Files changed for BS0.3

- `operations/automations/n8n/workflows/mind-inbox-fixed.json`
- `operations/automations/n8n/save-to-mind-topology-migration.json`
- `operations/automations/n8n/validate-mind-inbox-paths.mjs`
- `operations/runbooks/n8n-mind-inbox.md`
- `operations/runbooks/infinite-brain-roadmap-status.md`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- `tools/n8n-save-to-mind-plan.mjs`
- `tools/n8n-save-to-mind-topology-plan.mjs`
- `tools/n8n-save-to-mind-plan.test.mjs`
- `tools/n8n-save-to-mind-topology-plan.test.mjs`
- `tools/n8n-save-to-mind-freeze.test.mjs` (new)

The existing BS0.1 and BS0.2 evidence was preserved. The BS0.2 report header
was reconciled separately to say that its authorized continuation completed.
Pre-existing unrelated worktree changes were not altered.

## Validation

All commands below passed on 2026-07-14.

```text
node tools/n8n-save-to-mind-freeze.test.mjs
# 2 pass

node operations/automations/n8n/validate-mind-inbox-paths.mjs
# canonical routing pass; credential_values_read=false; external_actions_performed=false

node tools/n8n-save-to-mind-plan.test.mjs
# 6 pass

node tools/n8n-save-to-mind-topology-plan.test.mjs
# 17 pass

node tools/n8n-save-to-mind-topology-plan.mjs topology-plan operations/reports/artifacts/b1-0a-live-workflow-rollback.json
# repository-candidate mode; deployed=unverified; live_commands_emitted=false;
# approval_required_for_live_action=true; network_access=false; credentials_read=false

(cd projects/brain-core && ./node_modules/.bin/tsx --test src/tests/mutable-capability-containment.test.ts src/tests/video-orchestrator-thumbnail-route.test.ts)
# 27 pass

npm --prefix projects/mind-steward run typecheck
# pass

node --test tools/scripts/mind-steward-sync-inbox.test.mjs tools/scripts/mind-compile-loop.test.mjs
# 6 pass

./projects/mind-steward/node_modules/.bin/tsx --test projects/mind-steward/src/tests/classifier-paths.test.ts projects/mind-steward/src/tests/classify-captures-cli.test.ts
# 6 pass

git diff --check
# pass
```

A focused static scan of the candidate workflow and executable planner/
validator sources found no credential-like assignments or values. The scan
never printed source values. Both changed JSON files parsed successfully.

## Remaining blockers and handoff

1. B1.0a remains incomplete: only a separately authorized live verification
   could establish deployment, activation, schedule, current version, and
   failure-route behavior.
2. The rollback artifact is integrity-checked repository evidence, not proof
   that a credential-bearing backup or live workflow can safely be restored.
3. BS0.4 must audit secret exclusion and rollback/backup provenance using
   metadata-only checks before any further runtime migration work.

**Next task:** BS0.4 — Audit credential and backup safety. No BS0.5 work is
authorized by this report.
