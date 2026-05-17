# Brain + Mind Roadmap Handoff — 2026-05-17

## Purpose

Restart handoff for the next conversation. This file records the verified Brain and Mind repo state after the latest BuildFlow continuation, including the committed controlled first-action execution path.

## Repos

- Brain repo: `/Users/Office/Repos/stevewesthoek/brain`
- Mind repo: `/Users/Office/Repos/stevewesthoek/mind`

## Latest pushed Brain commits from this continuation

These were committed and pushed to `origin/main`:

```text
0e1f9318 Add Brain Core model-router execution flag scaffold
b6377f3d Surface Brain Core execution flag in operator clients
6b6eba0e Document first-action execution incident response
40d7d1d8 Add gated Brain Core model-router dry-run execution
9e40c0b1 Update first-action execution status docs
```

## Current verified dirty state

Brain working tree still has unrelated local/generated state. Do not stage these unless reviewed as a separate cleanup task:

```text
 M operations/system-configs/claude/.last-cleanup
 D operations/system-configs/claude/plans/compressed-forging-sparrow.md
 D operations/system-configs/claude/plans/curious-wishing-adleman.md
 D operations/system-configs/claude/plans/foamy-moseying-shore.md
 D operations/system-configs/claude/plans/replicated-questing-dahl.md
 D operations/system-configs/claude/plans/robust-snacking-simon.md
 D operations/system-configs/claude/plans/smooth-meandering-robin.md
 D operations/system-configs/claude/plans/splendid-splashing-haven.md
 D operations/system-configs/claude/plans/twinkly-knitting-pudding.md
 D operations/system-configs/claude/plans/typed-soaring-alpaca.md
 D operations/system-configs/claude/plans/validated-tumbling-riddle.md
 D operations/system-configs/claude/plans/zesty-coalescing-popcorn.md
 M tools/firecrawl/logs/firecrawl.log
```

Mind working tree before the Mind handoff commit had:

```text
 M .obsidian/community-plugins.json
?? .obsidian/plugins/custom-sort/
?? .obsidian/plugins/ghostty-terminal/
?? .obsidian/plugins/obsidian-icon-folder/
?? MIND-OS-HANDOFF-2026-05-17-CONTINUATION.md
```

The `.obsidian` plugin/config state is local vault configuration and should not be staged automatically. The Mind continuation handoff is safe documentation and may be committed separately.

## Validation completed before the latest Brain commits

```text
Brain Core CI: passed, 52 tests
Model-router CI: passed, 8 tests
Brain Console typecheck: passed
Brain Console build: passed
ProBot typecheck: passed
Secret scans on changed files/docs: no findings
```

## Current Brain Core status

### Read-only and status endpoints

Brain Core exposes and tests the local-only API surface:

```text
GET /status
GET /sessions
GET /skills
GET /repos
GET /orchestrators
GET /capabilities
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /local-apps
GET /video/status
GET /video/queue
GET /approvals
GET /approvals/store
GET /approvals/audit
GET /runtime/reports
GET /execution/plans
GET /execution/plans/:kind
GET /execution/readiness
```

### Approval/audit persistence

Implemented and validated:

- JSON approval store via `BRAIN_CORE_APPROVAL_STORE_PATH`
- JSONL approval audit via `BRAIN_CORE_APPROVAL_AUDIT_PATH`
- request/approve/reject workflows
- runtime report summaries
- local-only request guard
- no secrets in changed files

### First-action execution state

A controlled first-action execution path now exists for exactly:

```text
scheduler-run-model-router-dry-run
```

Safety gates:

- exact action kind only
- `BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION=true`
- durable approval store available
- durable approval audit path available
- approved approval record
- exact command only: `bash tools/scripts/model-router-dry-run-report.sh`
- Brain-owned runtime output only: `runtime/local/model-router/latest.json`
- `MODEL_ROUTER_MIND_ROOT` is stripped before execution
- execution summary records `writesToMind=false` and `externalSideEffects=false`
- audit records an `executed` event only after success

Broad execution remains disabled. Brain Core is not a shell runner. No model-router write/apply path exists for Mind.

## Operator clients

### Brain Console Obsidian plugin

- Project exists at `projects/brain-console-obsidian/`.
- It reads Brain Core through GET helpers.
- It surfaces the model-router execution flag and readiness state.
- Typecheck/build passed.
- It is not installed into `mind/.obsidian/plugins/` by default.

### ProBot

- ProBot is a thin fallback/mobile client over Brain Core.
- Slack/Telegram text paths expose `brain ...` status aliases.
- ProBot surfaces Brain Core status, runtime reports, approvals, approval store, execution readiness, and the feature flag.
- ProBot remains GET-only for Brain Core status surfaces.

## Model-router state

Implemented and validated:

- dry-run loop planner
- stat-only Mind snapshot collector
- dry-run report script: `tools/scripts/model-router-dry-run-report.sh`
- model-router CI with 8 tests

Current invariant:

- model-router remains report-only for Mind.
- It must not write, move, delete, archive, compact, split, or rewrite Mind content until a separate write/apply policy is approved and tested.

## Mind state relevant to Brain

Mind OS structure exists and is the Obsidian cockpit:

```text
capture/
live/
router/
wiki/
sources/
archive/
```

Mind must not store:

- Brain runtime logs
- approval/audit JSONL
- model-router runtime output
- secrets
- duplicated machine runtime truth

## Key docs to read next

Brain:

```text
docs/system/brain-mind-roadmap-handoff-2026-05-17.md
docs/system/brain-mind-roadmap-agent-handoff-2026-05-17.md
docs/system/obsidian-brain-core-roadmap.md
docs/system/obsidian-brain-core-implementation-plan.md
docs/system/obsidian-mind-model-router-roadmap.md
docs/system/obsidian-mind-model-router-implementation-plan.md
operations/specs/brain-core-first-action-feature-flag.md
operations/runbooks/brain-core-approval-gates.md
operations/runbooks/brain-core-first-action-incident-response.md
operations/reports/brain-core-approval-gate-live-verification-2026-05-18.md
```

Mind:

```text
MIND-OS-HANDOFF-2026-05-17-CONTINUATION.md
MIND-OS-HANDOFF-2026-05-16.md
MIND-OS-ROADMAP.md
MIND-OS-IMPLEMENTATION-PLAN.md
```

## Recommended next tasks

1. Re-run current validation after pulling the pushed commits:

```bash
npm run --prefix projects/brain-core ci
npm run --prefix projects/model-router ci
npm run --prefix projects/probot typecheck
npm run --prefix projects/brain-console-obsidian typecheck
npm run --prefix projects/brain-console-obsidian build
```

2. Decide what to do with unrelated Brain dirty state:

```text
operations/system-configs/claude/.last-cleanup
operations/system-configs/claude/plans/*.md deletions
tools/firecrawl/logs/firecrawl.log
```

3. Decide what to do with Mind `.obsidian` plugin/config state. Review path-by-path before committing.

4. Continue the roadmap only after preserving the current boundaries:

- no Mind writes from model-router
- no broad Brain Core command runner
- no plugin install into Mind without explicit approval
- no generated runtime/log output in commits

## Copy/paste prompt for the next conversation

```text
Please continue from the Brain and Mind handoffs. First read, in brain: docs/system/brain-mind-roadmap-handoff-2026-05-17.md, docs/system/brain-mind-roadmap-agent-handoff-2026-05-17.md, operations/specs/brain-core-first-action-feature-flag.md, operations/runbooks/brain-core-approval-gates.md, and operations/runbooks/brain-core-first-action-incident-response.md. Then read, in mind: MIND-OS-HANDOFF-2026-05-17-CONTINUATION.md, MIND-OS-ROADMAP.md, and MIND-OS-IMPLEMENTATION-PLAN.md. Verify git status in both repos. Treat the latest Brain pushed commit as 9e40c0b1. Do not stage unrelated Claude plan cleanup, Firecrawl logs, or Mind .obsidian plugin/config state unless explicitly reviewed. Continue the roadmap from the documented state, preserving the safety boundaries: no broad shell runner, no model-router writes to Mind, no runtime logs/secrets in Mind, and no plugin install into Mind without approval. Validate before committing and push only reviewed, tested changes.
```
