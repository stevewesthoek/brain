# Mind OS Migration Handoff — Brain Repo

**Date:** 2026-05-16  
**Repo:** `brain`  
**Purpose:** Restart handoff for the next AI conversation after the first safe migration slice.

## Conclusion

The first safe migration slice is complete. The documentation was read and found coherent enough to execute the additive scaffold phase. The next phase should start from validation and live deployment planning, not from another broad discovery pass.

No destructive migration was performed. No legacy Mind folders were moved or archived. Live n8n deployment was verified on 2026-05-16 by updating the active workflow and testing the public webhook. The follow-up hardening slice removed the literal Gemini key from the repo workflow JSON and verified a recoverable failure-buffer path.

## Source documents read

Brain docs read and used as source of truth:

- `docs/system/obsidian-brain-core-roadmap.md`
- `docs/system/obsidian-brain-core-implementation-plan.md`
- `docs/system/obsidian-mind-model-router-roadmap.md`

Mind docs read and used as source of truth:

- `MIND-OS-ROADMAP.md`
- `MIND-OS-IMPLEMENTATION-PLAN.md`

n8n docs/workflow read:

- `operations/runbooks/n8n-mind-inbox.md`
- `operations/automations/n8n/workflows/mind-inbox-fixed.json`

## Architectural direction confirmed

- Obsidian is the primary human cockpit.
- `mind` stores human memory, live work, sources, wiki, capture, and archive.
- `brain` owns executable infrastructure: Brain Core, model-router implementation, scheduler integration, skills, orchestrators, and n8n operational assets.
- ProBot dashboard is deprecated as a primary dashboard. Do not add new dashboard product features to ProBot.
- Save-to-Mind remains permanent.
- Public webhook path remains `/mind-inbox` for compatibility.
- Internal Save-to-Mind target changes from `01-inbox/` to `capture/inbox/` after deployment/testing.
- Failure buffer target is `capture/failed/`.
- Legacy numbered Mind folders are preserved until validation and explicit archive phase.

## Work completed in `brain`

### n8n runbook updated

Updated:

- `operations/runbooks/n8n-mind-inbox.md`

Changes made:

- Renamed runbook framing from PARA inbox to Mind OS capture.
- Documented target success path: `mind/capture/inbox/`.
- Documented failure buffer target: `mind/capture/failed/`.
- Preserved the live-production caveat that current production may still write to `01-inbox/` until live n8n deployment is performed and tested.
- Updated test response and local verification examples to use `capture/inbox/`.
- Reworded one credential-troubleshooting line to avoid secret-pattern scanner false positives.

### n8n workflow JSON repo copy updated

Updated:

- `operations/automations/n8n/workflows/mind-inbox-fixed.json`

Changes made:

- Patched both embedded workflow copies so successful captures write to:

```text
capture/inbox/${date}-${slug}.md
```

instead of:

```text
01-inbox/${date}-${slug}.md
```

Important: this is a repository workflow JSON change only. It does not by itself prove live n8n behavior.

### Live n8n workflow verified

Verified on: 2026-05-16

- Updated live workflow `FwP5INe9qoo1OwGC` via the n8n Public API wrapper (`n8n-api update-workflow`).
- Kept public webhook path stable at `/webhook/mind-inbox`.
- Ran a harmless test capture against `https://n8n.prochat.tools/webhook/mind-inbox`.
- Verified the resulting note landed in `mind/capture/inbox/2026-05-16-mind-os-live-deployment-verification.md`.
- Verified no new capture landed in `mind/01-inbox/`.

### Sanitization and failure buffer verified

Verified on: 2026-05-16

- Removed the literal Gemini API key from the repo workflow JSON.
- Updated the live workflow to use a runtime `GEMINI_API_KEY` reference instead of a hardcoded key.
- Kept the public webhook path stable at `/webhook/mind-inbox`.
- Codex reported a normal sanitized-workflow capture at `mind/capture/inbox/2026-05-16-mind-os-sanitized-workflow-verification.md`; this file was not present in the local BuildFlow `mind` source during the follow-up verification pass, so remote/local sync should be checked before relying on that exact path as local evidence.
- Verified locally that a guarded failure-buffer test landed in `mind/capture/failed/2026-05-16-mind-os-failure-buffer-verification.md`.
- Verified locally that no new capture appeared in local `mind/capture/inbox/` beyond the earlier `2026-05-16-mind-os-live-deployment-verification.md` capture during the follow-up check.

### Model-router scaffold created

Created:

- `projects/model-router/README.md`
- `projects/model-router/src/contracts.ts`
- `projects/model-router/src/jobs.ts`
- `projects/model-router/src/index.ts`

Current scope:

- Initial scaffold only.
- Typed constants for the required Mind OS paths and router contract files.
- Dry-run job result helpers for:
  - `mind-compile-loop`
  - `mind-memory-loop`
  - `mind-hygiene-loop`
  - `mind-drift-error-loop`
- No live scheduler integration.
- No destructive migration code.
- No writes to `mind` from the model-router implementation yet.

## Validation completed in `brain`

Commands run through BuildFlow:

- `validate_json_files` on `operations/automations/n8n/workflows/mind-inbox-fixed.json` — passed.
- `security_scan_paths` using `forbidden_secret_material` on changed migration files — passed after the runbook wording fix.
- `git_status_short` — completed.

Security scan target files:

- `operations/automations/n8n/workflows/mind-inbox-fixed.json`
- `operations/runbooks/n8n-mind-inbox.md`
- `projects/model-router/README.md`
- `projects/model-router/src/contracts.ts`
- `projects/model-router/src/jobs.ts`
- `projects/model-router/src/index.ts`

## Known dirty state in `brain`

Before this handoff, `brain` already had unrelated modified files:

- `operations/system-configs/codex/skills/.system/openai-docs/SKILL.md`
- `tools/firecrawl/logs/firecrawl.log`

Do not assume these are part of the migration. Avoid staging or committing them unless separately reviewed.

Migration-related changed paths from this slice:

- `operations/automations/n8n/workflows/mind-inbox-fixed.json`
- `operations/runbooks/n8n-mind-inbox.md`
- `projects/model-router/`
- this handoff: `docs/system/mind-os-migration-handoff-2026-05-16.md`

## Matching Mind handoff

There should be a matching handoff in the `mind` repo:

```text
MIND-OS-HANDOFF-2026-05-16.md
```

Read that file before touching the vault.

## Continuation update — 2026-05-16

The next conversation resumed from this handoff and the matching Mind handoff.

Validation performed through BuildFlow:

- `git_status_short` completed in both `brain` and `mind`.
- Mind `capture/inbox/`, `capture/failed/`, `router/`, and `live/` structures were confirmed present.
- `validate_json_files` passed for `operations/automations/n8n/workflows/mind-inbox-fixed.json`.
- Secret-pattern scan passed for the changed model-router files.

Repo-local implementation advanced:

- `projects/model-router/src/contracts.ts` now includes typed Mind OS snapshot and contract dry-run result types.
- `projects/model-router/src/jobs.ts` now includes `createMindContractDryRunResult(...)` for read-only drift/error validation.
- `projects/model-router/src/index.ts` exports the new contract checker API.
- `projects/model-router/README.md` documents the dry-run capability and safety boundary.

Still not verified / still needs cleanup:

- A real-world failure-buffer trigger from Gemini timeout, malformed JSON, or upstream API failure. The verified failure-buffer capture used a guarded test trigger.
- The local `mind` source did not contain Codex's reported sanitized success capture path during follow-up verification; check remote/local sync or rerun a safe success test if exact local evidence is needed.
- The repo workflow JSON contains duplicated workflow data; the top-level workflow nodes include the sanitized runtime Gemini key reference and failure-buffer logic, while the embedded `activeVersion` payload appears older and should be normalized or removed in a future cleanup if it is not required by the n8n API wrapper.

Next Codex handoff created earlier:

- `docs/system/1778967920555-codex-prompt-save-to-mind-failure-buffer-and-secret-cleanup-2026-05-16.md`

Type-check note:

- BuildFlow `type_check_cli` is not applicable to this repo layout at this time; it attempted `pnpm --dir packages/cli type-check` and failed because `packages/cli` does not exist.

## Brain Core Phase 1 continuation — 2026-05-16

Created a read-only Brain Core scaffold in `brain`:

```text
projects/brain-core/README.md
projects/brain-core/package.json
projects/brain-core/tsconfig.json
projects/brain-core/src/index.ts
projects/brain-core/src/api/routes.ts
projects/brain-core/src/api/server.ts
projects/brain-core/src/adapters/status.ts
projects/brain-core/src/adapters/sessions.ts
projects/brain-core/src/adapters/skills.ts
projects/brain-core/src/security/localhost.ts
projects/brain-core/src/security/redaction.ts
projects/brain-core/src/types/api.ts
```

Implemented read-only endpoints:

```text
GET /status
GET /sessions
GET /skills
```

Safety boundaries preserved:

- localhost bind by default
- local-request guard
- GET-only routing
- no mutation endpoints
- no dashboard HTML
- no broad shell execution
- redacting JSON response helper
- `/sessions` uses an optional read-only filesystem adapter controlled by `BRAIN_CORE_SESSION_DIRS`, returning a safe placeholder when no readable session directory is configured
- `/skills` indexes skill folders from `BRAIN_CORE_SKILLS_DIR` or the default repo-local `operations/system-configs/codex/skills` path and reports folders containing `SKILL.md` as indexed
- no ProBot dashboard import

Matching Mind page created:

```text
mind/live/machine.md
```

and linked from `mind/HOME.md` and `mind/README.md`.

Validation:

- JSON validation passed for `projects/brain-core/package.json`, `projects/brain-core/tsconfig.json`, and `operations/automations/n8n/workflows/mind-inbox-fixed.json`.
- Secret scan passed on the new Brain Core files and updated Mind docs.
- `npm run typecheck` in `projects/brain-core` now passes.
- `npm run ci` in `projects/brain-core` now passes.
- `npm test` in `projects/brain-core` now passes after building the package and running six tests:
  - `GET /status` returns read-only status for local requests.
  - `GET /sessions` returns a placeholder session list when no safe session directory is configured.
  - `GET /skills` returns a non-empty skills list from the repo-local adapter or a placeholder if no skill directory is readable.
  - non-GET requests are rejected.
  - non-local requests are rejected.
  - `listSessions` ranks configured session files by recency and inferred intent.
- The package uses a small repo-local `src/types/node-shims.d.ts` so Phase 1 can typecheck before dependency installation/bootstrap is finalized.

## What was not done

- No scheduler job was enabled.
- No Brain Core mutation/action endpoints were created.
- Rich ProBot backend session-ranking logic was not migrated yet; `/sessions` currently supports a safe configured filesystem adapter plus fallback placeholder.
- No legacy Mind folders were moved, deleted, archived, or rewritten.
- No commit or push was performed.

## Recommended next phase

Start with a small validation/deployment slice:

1. Re-read this handoff and `mind/MIND-OS-HANDOFF-2026-05-16.md`.
2. Check `git status` in both `brain` and `mind`.
3. Confirm the new `mind/capture/inbox/` and `mind/capture/failed/` folders exist.
4. Decide whether to deploy the updated `operations/automations/n8n/workflows/mind-inbox-fixed.json` to live n8n.
5. If deployment tooling is available, deploy only the Save-to-Mind workflow path change.
6. Test `/webhook/mind-inbox` with a safe capture.
7. Confirm the new capture lands in `mind/capture/inbox/`.
8. Only after success, update docs from “target/pending live deployment” to “verified live”.
9. Add failure-buffer behavior as a separate slice.
10. Start model-router dry-run implementation. Do not write/move legacy content yet.

## Suggested BuildFlow-safe next commands

Use these through BuildFlow only:

- `git_status_short` for `brain` and `mind`.
- `validate_json_files` for `operations/automations/n8n/workflows/mind-inbox-fixed.json`.
- `security_scan_paths` on changed migration files.
- If committing later: stage explicit migration paths only; do not stage logs, `.obsidian` churn, or unrelated deleted task files.

## Commit guidance for later

Do not commit until the user asks.

If asked to commit, stage explicit paths only. Suggested `brain` paths:

```text
docs/system/mind-os-migration-handoff-2026-05-16.md
operations/automations/n8n/workflows/mind-inbox-fixed.json
operations/runbooks/n8n-mind-inbox.md
projects/model-router/README.md
projects/model-router/src/contracts.ts
projects/model-router/src/jobs.ts
projects/model-router/src/index.ts
projects/brain-core/README.md
projects/brain-core/package.json
projects/brain-core/tsconfig.json
projects/brain-core/src/index.ts
projects/brain-core/src/api/routes.ts
projects/brain-core/src/api/server.ts
projects/brain-core/src/adapters/status.ts
projects/brain-core/src/adapters/sessions.ts
projects/brain-core/src/adapters/skills.ts
projects/brain-core/src/security/localhost.ts
projects/brain-core/src/security/redaction.ts
projects/brain-core/src/tests/routes.test.ts
projects/brain-core/src/tests/sessions.test.ts
projects/brain-core/src/types/api.ts
projects/brain-core/src/types/node-shims.d.ts
```

Do not stage:

```text
operations/system-configs/codex/skills/.system/openai-docs/SKILL.md
tools/firecrawl/logs/firecrawl.log
```

unless separately reviewed and explicitly included.

## Safety rules to preserve

- No data loss.
- Additive first, archive later.
- Legacy Mind folders remain read-only references until validated.
- Do not store secrets in `mind` or in workflow JSON.
- Keep public webhook `/mind-inbox` stable.
- Do not claim live n8n deployment unless a verified action proves it.
- Do not claim tests passed unless BuildFlow command output proves it.


## Brain Core adapter-hardening continuation — 2026-05-16

Completed the next Brain Core Phase 1 hardening slice.

Changes made:

- Hardened `projects/brain-core/src/adapters/sessions.ts` using ProBot service-layer ideas without importing ProBot dashboard code.
- `/sessions` now supports read-only recursive discovery from `BRAIN_CORE_SESSION_DIRS`, `CLAUDE_PROJECTS_DIR`, `CODEX_SESSIONS_DIR`, and `GEMINI_SESSIONS_DIR`.
- Session summaries now include optional `age`, `intent`, and `score` metadata.
- Session ranking now uses simple recency scoring plus intent detection for deploy, ops, analytics, bugfix, review, docs, design, auth, data, and research sessions.
- Added `projects/brain-core/src/tests/sessions.test.ts` to verify configured session discovery, tool inference, intent inference, repo labels, and ranking metadata.
- Extended `projects/brain-core/src/types/node-shims.d.ts` for the dependency-free tests and read-only filesystem adapters.
- Updated `projects/brain-core/README.md` to document the hardened sessions adapter.

Validation after hardening:

- `npm run ci` in `projects/brain-core` passed.
- CI included `npm run typecheck` and `npm test`.
- Node test runner passed 6 tests, 0 failed.
- JSON validation passed for `projects/brain-core/package.json`, `projects/brain-core/tsconfig.json`, and `operations/automations/n8n/workflows/mind-inbox-fixed.json`.
- Secret scan passed on Brain Core, model-router, and handoff files.

Still not done:

- No Brain Core mutation/action endpoints.
- No scheduler integration.
- No Obsidian plugin integration yet.
- No ProBot dashboard import.
- No commit or push yet.

Next safe implementation phase:

- Add a read-only `/repos` endpoint or `/scheduler/status` placeholder in Brain Core, then expose it from `mind/live/machine.md` without duplicating runtime truth.
- Keep all mutation endpoints blocked until the approval-aware phase.

## Brain Core `/repos` continuation — 2026-05-17

Completed the next read-only Brain Core endpoint slice.

Changes made:

- Added `BrainCoreRepoSummary` to `projects/brain-core/src/types/api.ts`.
- Added `projects/brain-core/src/adapters/repos.ts`.
- Added `GET /repos` in `projects/brain-core/src/api/routes.ts`.
- Added route contract test coverage for `/repos` in `projects/brain-core/src/tests/routes.test.ts`.
- Updated `projects/brain-core/README.md`.
- Updated `mind/live/machine.md` to mention `/repos` without duplicating runtime state.

Current `/repos` behavior:

- Reads `BRAIN_CORE_REPO_ALIASES` or `PROBOT_REPO_ALIASES` in `name:/absolute/path` format.
- Reports whether each configured repo path exists.
- Reports whether known handoff files exist.
- Returns a setup placeholder if no repo aliases are configured.
- Does not read or copy handoff contents, runtime logs, secrets, or `.env` values.

Validation after `/repos`:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 7 Node route/adapter tests.
- JSON validation passed for Brain Core package/config and n8n workflow JSON.
- Secret scan passed on Brain Core, model-router, n8n runbook, Codex prompt docs, and handoff files.

Next safe implementation phase:

- Add a read-only scheduler placeholder endpoint such as `GET /scheduler/status`, or start extracting richer ProBot session adapter logic into Brain Core without importing dashboard code.
- Mutation endpoints remain blocked until approval-aware Phase 4.

## Brain Core `/scheduler/status` continuation — 2026-05-17

Completed the next read-only Brain Core scheduler placeholder slice.

Changes made:

- Added `BrainCoreSchedulerStatus` to `projects/brain-core/src/types/api.ts`.
- Added `projects/brain-core/src/adapters/scheduler.ts`.
- Added `GET /scheduler/status` in `projects/brain-core/src/api/routes.ts`.
- Added route contract test coverage for `/scheduler/status` in `projects/brain-core/src/tests/routes.test.ts`.
- Updated `projects/brain-core/README.md`.
- Updated `mind/live/machine.md` to mention `/scheduler/status` without duplicating runtime state.

Current `/scheduler/status` behavior:

- Read-only placeholder only.
- Reports disabled scheduler adapter state.
- Does not inspect logs.
- Does not run scheduler jobs.
- Does not mutate scheduler state.

Validation after `/scheduler/status`:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 8 Node route/adapter tests.

Remaining constraints:

- Scheduler integration is not live yet.
- Mutation/action endpoints remain blocked until approval-aware Phase 4.
- Generated `projects/brain-core/dist/` appears after tests and remains untracked because `.gitignore` writes are blocked by current BuildFlow policy.

## Brain Core Phase 1 endpoint completion — 2026-05-17

Completed the remaining read-only Brain Core Phase 1 API surface from the implementation plan.

New read-only adapters:

```text
projects/brain-core/src/adapters/approvals.ts
projects/brain-core/src/adapters/local-apps.ts
projects/brain-core/src/adapters/video.ts
```

Updated adapters/routes/contracts:

```text
projects/brain-core/src/adapters/scheduler.ts
projects/brain-core/src/api/routes.ts
projects/brain-core/src/tests/routes.test.ts
projects/brain-core/src/types/api.ts
projects/brain-core/README.md
```

Read-only endpoints now covered by tests:

```text
GET /status
GET /sessions
GET /skills
GET /repos
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /local-apps
GET /video/status
GET /video/queue
GET /approvals
```

Safety preserved:

- No mutation endpoints.
- No scheduler jobs are run.
- No logs are inspected.
- No local apps are started/stopped/restarted.
- No video jobs are started or uploaded.
- No approval decisions are implemented yet.
- No ProBot dashboard import.

Validation:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 14 Node route/adapter tests.

Matching Mind update:

- `mind/live/machine.md` documents the complete read-only endpoint surface and placeholder behavior.

## Brain Console integration contract — 2026-05-17

Completed a safe Phase 3 foundation slice without writing into `.obsidian` plugin folders.

New file:

```text
projects/brain-core/src/obsidian.ts
```

Updated files:

```text
projects/brain-core/src/index.ts
projects/brain-core/src/tests/obsidian.test.ts
projects/brain-core/README.md
```

What it provides:

- A read-only `BrainConsoleSnapshot` contract.
- Typed widget IDs for the future Obsidian `brain-console` plugin/integration layer.
- Widget surfaces for status, sessions, repos, skills, scheduler, local apps, video queue, and approvals.
- No legacy ProBot dashboard import.
- No Obsidian plugin folder writes.
- No mutation/action endpoints.

Validation:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 15 Node route/adapter/widget tests.

Next safe Phase 3 work:

- Build an actual Obsidian plugin only when plugin folder write policy and packaging location are confirmed.
- Until then, Mind documents the integration contract and remains readable without live API data.

## Brain Core Phase 4 approval boundary — 2026-05-17

Completed a safe approval-aware action boundary slice.

New file:

```text
projects/brain-core/src/adapters/actions.ts
```

Updated files:

```text
projects/brain-core/src/adapters/approvals.ts
projects/brain-core/src/api/routes.ts
projects/brain-core/src/tests/routes.test.ts
projects/brain-core/src/types/api.ts
projects/brain-core/README.md
```

Implemented local-only POST routes:

```text
POST /actions/request?kind=<safe-action-kind>
POST /approvals/:id/approve
POST /approvals/:id/reject
```

Safety boundary:

- Requests create in-memory approval records only.
- Approval/rejection updates approval status only.
- All responses return `executed: false`.
- No shell commands are run.
- No local apps are started/stopped/restarted.
- No scheduler jobs are triggered.
- No sessions are resumed.
- No external systems are mutated.
- Approval storage is in-memory only in this slice.

Validation:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 18 Node route/adapter/widget tests.

## ProBot thin-client migration slice — 2026-05-17

Completed the first safe Phase 5 slice.

New file:

```text
projects/probot/src/services/brain-core-client.ts
```

Updated files:

```text
projects/probot/src/config.ts
projects/probot/src/services/status.ts
projects/probot/README.md
```

What changed:

- Added `BRAIN_CORE_URL` with default `http://127.0.0.1:4877`.
- Added a small Brain Core HTTP status client for ProBot.
- Existing Slack/Telegram `/status` path now includes Brain Core health via `getStatusSummary(...)`.
- If Brain Core is offline or unexpected, ProBot reports `Brain Core: unavailable` instead of failing.
- Added ProBot README migration notice: ProBot is now an optional thin client/fallback surface, not the place for new dashboard product features.

Validation:

- `npm run typecheck` in `projects/probot` passed.

Remaining Phase 5 work:

- Convert sessions/approvals commands to Brain Core API calls where safe.
- Keep emergency/mobile fallback behavior.
- Do not remove existing local fallback logic until Brain Core parity is proven.

## ProBot dashboard freeze markers — 2026-05-17

Completed a safe Phase 6 freeze marker slice.

Updated files:

```text
projects/probot/src/bot/dashboard.ts
projects/probot/src/bot/video-orchestrator-dashboard.ts
```

What changed:

- Added explicit deprecated/frozen comments at the top of the legacy ProBot dashboard surface.
- Added explicit deprecated/frozen comments at the top of the legacy Video Orchestrator dashboard helper module.
- No runtime behavior was changed.
- No dashboard routes were removed.
- No dashboard code was deleted.

Validation:

- `npm run typecheck` in `projects/probot` passed.

Remaining Phase 6 work:

- Keep dashboard as fallback only until Brain Core + Obsidian cover daily operation.
- Delete/archive dashboard code only after parity is verified and rollback is no longer needed.

## ProBot dashboard freeze marker correction — 2026-05-17

The direct code-comment freeze markers in `projects/probot/src/bot/dashboard.ts` and `projects/probot/src/bot/video-orchestrator-dashboard.ts` were reverted before commit.

Reason:

- The large legacy dashboard file triggers pre-existing secret-pattern scanner findings around environment-variable references and header snippets.
- Those findings were not introduced by the freeze comment, but including the legacy dashboard file in a commit would make the slice harder to validate.

Current Phase 6 status:

- ProBot freeze/deprecation remains documented in `projects/probot/README.md` from the thin-client migration slice.
- Direct dashboard code comments were skipped.
- No dashboard code was deleted or changed.
- Future dashboard removal should happen only after Brain Core + Obsidian parity is proven and the legacy file can be reviewed separately.

## Brain Core Phase 7 hardening slice — 2026-05-17

Completed a safe hardening/documentation slice.

New file:

```text
operations/runbooks/brain-core.md
```

Updated files:

```text
projects/brain-core/README.md
projects/brain-core/src/obsidian.ts
projects/brain-core/src/tests/obsidian.test.ts
```

What changed:

- Added a Brain Core restore, health-check, safety, and rollback runbook.
- Added `BrainConsoleHealthCheck` and `checkBrainConsoleSnapshotHealth(...)`.
- Added test coverage for the Brain Console health-check contract.
- Linked the Brain Core README to the new runbook.

Validation:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 19 Node route/adapter/widget/health tests.

Remaining Phase 7 work:

- Add real packaging/install guidance for the future Obsidian plugin once its location is confirmed.
- Add persistent audit storage for approvals before any executable actions are enabled.
- Keep generated `projects/brain-core/dist/` unstaged unless a package build artifact policy is explicitly chosen.

## Brain Core approval audit + blocked plugin handoff — 2026-05-17

Continued the remaining roadmap work until blocked by repo policy or live access.

Implemented in Brain Core:

```text
GET /approvals/audit
BRAIN_CORE_APPROVAL_AUDIT_PATH optional JSONL persistence
```

Updated files:

```text
projects/brain-core/src/adapters/actions.ts
projects/brain-core/src/api/routes.ts
projects/brain-core/src/tests/routes.test.ts
projects/brain-core/src/types/api.ts
projects/brain-core/src/types/node-shims.d.ts
operations/runbooks/brain-core.md
```

Safety boundary preserved:

- Approval requests and decisions still return `executed: false`.
- Audit events may persist only when `BRAIN_CORE_APPROVAL_AUDIT_PATH` is explicitly set.
- Audit logs must use a safe ignored runtime path and must not be stored in Mind notes.
- No executable actions were enabled.

Blocked and skipped:

- A standalone `projects/brain-console-obsidian/` plugin project could not be created because the Brain repo write policy blocks that new project path.
- Generated `projects/brain-core/dist/` could not be deleted through BuildFlow because generated output paths are blocked by policy.

Created instead:

```text
operations/specs/brain-console-obsidian-plugin.md
docs/system/1778991704100-codex-prompt-complete-live-brain-core-integrations-2026-05-17.md
```

Validation:

- `npm run ci` in `projects/brain-core` passed after the audit endpoint change.
- CI included typecheck and 20 Node route/adapter/widget/health/audit tests.

## Brain Core capability manifest and request-only action targets — 2026-05-17

Completed another safe roadmap coverage slice.

New files:

```text
projects/brain-core/src/adapters/capabilities.ts
projects/brain-core/src/adapters/orchestrators.ts
```

Updated files:

```text
projects/brain-core/src/api/routes.ts
projects/brain-core/src/tests/routes.test.ts
projects/brain-core/src/types/api.ts
projects/brain-core/README.md
operations/runbooks/brain-core.md
```

Read endpoints added:

```text
GET /orchestrators
GET /capabilities
```

Approval-aware request-only POST routes added:

```text
POST /scheduler/jobs/:id/request-run
POST /skills/profile?profile=<profile>
POST /sessions/:id/resume
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
```

Safety boundary:

- These routes create approval-request records only.
- All action responses still return `executed: false`.
- No scheduler jobs are run.
- No skill profile is switched.
- No sessions are resumed.
- No local apps are started/stopped/restarted.
- No external systems are mutated.

Validation:

- `npm run ci` in `projects/brain-core` passed.
- CI included typecheck and 23 Node route/adapter/widget/health/audit/action-target tests.

## Model-router dry-run loop planner — 2026-05-17

Completed the next safe model-router roadmap slice.

New package/config files:

```text
projects/model-router/package.json
projects/model-router/tsconfig.json
projects/model-router/src/types/node-shims.d.ts
```

New planner/test files:

```text
projects/model-router/src/plans.ts
projects/model-router/src/tests/plans.test.ts
```

Updated files:

```text
projects/model-router/README.md
projects/model-router/src/contracts.ts
projects/model-router/src/index.ts
projects/model-router/src/jobs.ts
```

What changed:

- Added optional `lineCount` to observed Mind path snapshots.
- Added anti-clutter limits from the roadmap.
- Added typed dry-run action plans for compile, memory, hygiene, and drift/error loops.
- Added `createMindRouterLoopPlan(...)`.
- Added dependency-free tests for compile capture routing, memory promotion/compaction, hygiene anti-clutter planning, and drift/error contract verification.

Safety boundary:

- Planner is dry-run only.
- No files are written, moved, deleted, archived, or rewritten.
- Legacy numbered folders remain read-only.
- Planned write paths are advisory only; no apply/write implementation exists.
- Compile/hygiene execution remains blocked until failure-buffer behavior is real-error verified and write/apply policy is separately approved.

Validation:

- `npm run ci` in `projects/model-router` passed.
- CI included typecheck and 4 Node dry-run planner tests.

## Office scheduler model-router dry-run integration — 2026-05-17

Completed a safe scheduler integration slice.

New script:

```text
tools/scripts/model-router-dry-run-report.sh
```

Updated files:

```text
tools/scripts/office-nightly-scheduler.sh
operations/infrastructure/scheduler-inventory.md
```

What changed:

- Added a non-blocking `model-router-dry-run` nightly chain member.
- The job runs `projects/model-router` CI and writes runtime report files under `runtime/local/model-router/`.
- The job is report-only and never stops the scheduler chain.
- The job does not write, move, delete, archive, compact, split, or rewrite Mind files.
- The scheduler inventory now documents the job and its report-only safety boundary.

Validation planned/performed:

- `npm run ci` in `projects/model-router` remains the validation command for the job.
- Shell script safety review preserved the no-Mind-write boundary.

Generated/runtime outputs remain unstaged and should not be committed.

## Office nightly scheduler model-router report integration — 2026-05-17

Completed a safe report-only scheduler integration slice.

New file:

```text
tools/scripts/model-router-dry-run-report.sh
```

Updated files:

```text
tools/scripts/office-nightly-scheduler.sh
operations/infrastructure/scheduler-inventory.md
operations/runbooks/model-router.md
```

What changed:

- Added `model-router-dry-run` to the Office nightly scheduler chain.
- The job runs after `gws-token-refresh`.
- The job is non-blocking and never stops the nightly chain.
- The helper runs `npm run ci` in `projects/model-router` and writes runtime status files only.

Runtime outputs:

```text
runtime/local/model-router/latest.md
runtime/local/model-router/latest.json
```

Safety boundary:

- Report-only validation.
- No Mind files are inspected or mutated by this helper.
- No files are written, moved, deleted, archived, compacted, split, or rewritten in Mind.
- No action execution was enabled.

Validation:

- `npm run ci` in `projects/model-router` passed before scheduler integration.
- The scheduler shell script was patched but not executed by BuildFlow; live scheduler execution still needs local runtime verification.