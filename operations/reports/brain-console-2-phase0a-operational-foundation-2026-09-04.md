# Brain Console 2.0 Phase 0/A Operational Foundation

**Date:** 2026-09-04
**Repository:** Brain
**Branch:** `codex/brain-console-2-phase0a-operational-foundation`
**Baseline:** `origin/main` at `33616316369bfa3c1fd1e5a346c1e8f68aa4cdac`

## Acceptance summary

Phase 0/A contract foundation: **implemented and validated**. The implementation is additive, bounded, and read-only. The live deployment was not switched, no LaunchAgent was mutated, and the Console UI was not redesigned. The code is ready to support the later Command Center consumer; the physical source/runtime migration remains an explicit operational blocker.

## 1. Baseline SHA

`origin/main` was fetched before implementation and resolved to `33616316369bfa3c1fd1e5a346c1e8f68aa4cdac`. The isolated branch started from that commit. The dirty source checkout was not used as the implementation worktree.

## 2. Dirty checkout preservation

The original checkout at `/Users/Office/Repos/stevewesthoek/brain` remained on its existing branch with its pre-existing modifications and was not reset, stashed, cleaned, or built in place. Work occurred in `/Users/Office/Repos/stevewesthoek/brain-console-2-phase0a`.

## 3. Planning authority verification

The Phase 0/A planning artifacts were absent from `origin/main`. The requested audit, product specification, and modernization roadmap were carried into the isolated branch as the docs-only authority commit `97ded52c860b764f8be629ef46b2a68257dfc30f` (`docs(console): establish Brain Console 2.0 authority`). Subsequent implementation status was recorded in those documents.

## 4. Live runtime identity findings

Read-only inspection at `2026-09-04T09:55:52+0100` found:

- Core is listening on `127.0.0.1:4877` and `GET /status` returned HTTP 200.
- Console is listening on `127.0.0.1:4881` and `/` returned HTTP 200.
- `com.office.nightly-scheduler` is loaded but not continuously running between its calendar events (`state = not running`); its 03:00 trigger is loaded, with three recorded runs and last exit code 0.
- Core, Console, and scheduler point to `/Users/Office/Repos/stevewesthoek/brain-runtime`.
- The runtime checkout is detached at `46bec0626b3d61c35f5f7da3b1a538c17978a4e2` and has local modifications/untracked runtime support files.
- The live Core returned HTTP 404 for `GET /operational-snapshot`, proving the new contract is not yet deployed there.

The earlier audit also established that the installed Mac app is an `LSUIElement` URL-launch shell, which can make a click appear to do nothing when the browser target is not surfaced. This phase records the identity and read-model contracts; it does not mutate or reinstall the app.

## 5. Source/deployment architecture decision

`brain` is the canonical source repository. A future live deployment must be a pinned, reproducible build artifact produced from `brain`, with source revision, deployment revision, build mode, and build timestamp exposed through the read-only identity contract. The legacy `brain-runtime` checkout remains unchanged and is not treated as canonical source.

## 6. Deployment identity manifest

Implemented `brain-core-deployment-identity-v1` in Core types, adapter, JSON contract, and `GET /runtime/identity`. It reports canonical source path/revision, runtime path/revision, build mode/timestamp, fixed service labels, endpoints, contract versions, and fail-closed identity state (`matching`, `stale`, `unknown`, `development`, or `unavailable`). It reads only non-secret metadata and declares `exposesSecrets: false` and `exposesEnvironmentValues: false`.

Identity tests cover matching, stale, missing metadata, unavailable metadata, and development mode. Unknown and stale identity are visible states; neither is normalized into false health.

## 7. Obsidian reconciliation

The Core adapter, plugin source, manifest-facing spec, and conformance test now use `brain-console-obsidian-widget-contract-v1`, version 1, with exactly these ten IDs:

`brain-status`, `brain-sessions`, `brain-repos`, `brain-orchestrators`, `brain-capabilities`, `brain-scheduler`, `brain-local-apps`, `brain-video`, `brain-approvals`, `brain-runtime-reports`.

The existing visible plugin remains Decision Center. The widget list is frozen for parity and future read-only cockpit expansion, not a Phase 0/A UI redesign.

## 8. Canonical state vocabulary

Implemented and shared across Core and Console:

`CURRENT`, `STALE`, `DEGRADED`, `UNAVAILABLE`, `ERROR`, `BLOCKED`, `PENDING`.

The contract also defines severity and explicit freshness/availability semantics. Unknown, missing, stale, blocked, and failed values remain distinct from current health.

## 9. Snapshot schema

Implemented Core-owned `operational-snapshot-v1` with an overall section, bounded attention, active work, activity, Brain, Computer, Scheduler, index, consumer/domain posture, identity, data-source summaries, errors, provenance, uncertainty, privacy, freshness, confidence, availability, and immutable safety flags.

Active work is bounded to eight items and includes stable task reference, owner, specialist, capability route, current stage, explicit nullable progress, next action, gate state, continuation state, timestamps, and evidence reference. No packet bodies, full logs, or unbounded histories are returned.

## 10. Data sources

The read model composes existing Core adapters for status/capabilities, deployment identity, scheduler, local apps, computer/infrastructure, Graph/index reports, Infinite Brain runtime/orchestrators, agent runs, agent events, and runtime reports. Source calls are concurrent and the snapshot remains one bounded Core request for future home consumers.

## 11. Attention contract

Attention is capped at twelve items and includes source, entity reference, observed time, freshness, severity, canonical state, explanation, safe next action, and optional receipt/evidence references. Current fixtures cover source identity uncertainty/mismatch, scheduler failures and policy blocks, stopped local apps, stale computer resources, failed backups, missing/partial index coverage, provider failures, and blocked active work.

## 12. Activity contract

Agent events are normalized into bounded activity items capped at twelve, preserving event ID, type, time, severity, domain, entity/run reference, status, summary, source, and optional receipt reference. Source failures are represented as explicit errors/attention rather than blank activity.

## 13. Active-work projection

Queued work maps to `PENDING`, running work to `CURRENT`, and blocked work to `BLOCKED`. Approval and task gate blockers are preserved. Unknown progress is `null`, and next action is explicit; the projection does not imply execution or expose executable controls.

## 14. Consumer/domain posture

The snapshot exposes a bounded consumer section for `Code`, `Research`, and `Design/Web`. Because the current Core runtime does not expose live consumer rollout health, it is explicitly `UNAVAILABLE` with uncertainty text instead of being reported current.

## 15. Index/freshness posture

Graph/index status maps to `CURRENT`, `STALE`, `DEGRADED`, or `UNAVAILABLE`; stale reports remain visible. Freshness supports `fresh`, `stale`, `unknown`, `unavailable`, and `not_instrumented`. The Console has a shared semantic state badge and age/freshness label for later Command Center use.

## 16. Partial failure

Optional source failures are captured with source/code/message, rendered as `DEGRADED` attention, and do not invalidate an otherwise current snapshot. Required source failures affect the relevant section and overall state. Tests cover provider failure, unavailable index, and mixed failure conditions.

## 17. Performance metrics

The representative live-shaped snapshot measurement completed in approximately **381.46 ms**, produced a **19,299-byte** payload, and composed **8** bounded source loaders. A fixture build measured approximately **2.42 ms**. The route/test measurements remained under one second locally. No high-frequency polling was added; the future home consumer has one shared snapshot request boundary.

## 18. Compatibility

Existing Core routes remain in place. The new identity and snapshot endpoints are additive GET routes; POST to the snapshot route is rejected. The existing projection envelope remains intact, including authority owner, provenance, freshness, confidence, uncertainty, privacy classification, availability, failure, and safety fields. The existing Console routes and Obsidian Decision Center workflow remain available.

## 19. Validation

- Core focused contract/route/projection tests: **22 passed, 0 failed**.
- Console operational snapshot schema tests: **2 passed, 0 failed**.
- Obsidian checks and widget conformance: **7 passed, 0 failed**.
- Brain Core typecheck: **passed**.
- Brain Console typecheck: **passed**.
- Brain Core production build: **passed**.
- Brain Console production build: **passed**; Next generated all 14 routes. Existing Autoprefixer warning remains about mixed `flex-end` support.
- JSON contracts and `git diff --check`: **passed**.
- Full Core suite: **1,955 passed, 6 failed**. The six failures are existing environment-sensitive orchestration/VO metadata tests and are unrelated to the Phase 0/A files; all focused Phase 0/A tests pass.

## 20. Exact remaining Phase 0 blockers

1. Reconcile and pin the live `brain-runtime` deployment to a reproducible `brain` build; no live switch was performed in this phase.
2. Inject real source/deployment revision metadata into the production service and verify `GET /runtime/identity` reports `matching`.
3. Deploy the new Core build so live `GET /operational-snapshot` is available and then verify the Console client against it.
4. Repair or replace the Mac `LSUIElement` launcher so activation produces a visible, verifiable browser/window receipt; this phase did not reinstall or mutate the app.
5. Add the future shared snapshot consumer and Command Center shell only in Phase B; this foundation intentionally does not redesign the UI.

## 21. Readiness for Command Center

The read model, identity contract, canonical state vocabulary, bounded sections, provenance/safety envelope, Console schemas/client method, freshness/state primitives, and Obsidian contract are **ready for Command Center implementation**. The Command Center itself is not implemented, and no claim is made that the live Mac dashboard is already always operational until the five blockers above are closed.
