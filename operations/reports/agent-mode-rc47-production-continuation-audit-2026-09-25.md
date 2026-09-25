# RC47 Production Continuation Audit — 2026-09-25

## Decision

**Prior checkpoint: INCOMPLETE — RC27 was active after the five-turn RC47 acceptance because the embedded model-access evidence expired.** The follow-on activation and current outcome are recorded below. The prior checkpoint itself made no model inference and did not change IAM or the shared StateStore.

The immediately preceding release report, `agent-mode-rc47-production-activation-evidence-2026-09-24.md`, records two failed RC47 acceptance windows and the resulting RC27 rollbacks. This continuation then found RC47 live with five subsequent completed production turns. After confirming that its embedded GLM-5 and MiniMax evidence had expired, the RC27 pointer and both RC27 launchd descriptors from the verified bundle were atomically restored. The earlier report is retained as historical evidence, not silently rewritten.

## Release and source identity

- Version: `1.0.0-rc.47`.
- Source revision: `8f4ad9683a28007888a758ea0713f8d5288f8e79` (`fix(agent-mode): keep resume denial helpers singular`).
- Package: `brain-runtime-package:sha256:0401f3ccf6f983b1b82478282c95361f918cb1234b32ebffff85dcc0cf95f2f7`.
- Release: `brain-agent-release:sha256:25986914d0ff3cbd667fb5277610b3b650757cd4a34d4522985de992bf520bd4`.
- Package verification: **PASS**, 2,567 files; manifest hash `2766bb1336ab2e52265fca51b4a649eb22b4f79c0181d1487f464a9d1afabedb`.
- Ed25519 release verification: **PASS** for the exact package, source revision, and version.
- The source revision is an ancestor of canonical remote `main` (remote head observed as `3da1efc3dd82304dcff73ef6d90bb39a1c4ccadc`). No release source commit needs integration. The release manifest still labels this release `candidate`.

## RC27 backup and rollback evidence

The retained pre-cutover bundle is:

`/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc47-go-live-precutover-20260925T085840Z`

- Rollback release: RC27, `brain-agent-release:sha256:7a792ed73e85782f56f7ca7aa1cd6a9c66249dd7ba9585c7caf5f8d55acd235b`.
- Backup: `brain-agent-backup:sha256:8000a0fe7248909e6064a90478dca10b2e92821c27e7728678c254eae64662fc`.
- Snapshot: `brain-state-snapshot:sha256:1669e937786202c78fa3487508f6f09e8a437232cfda09e91b4c901072a6a58d`; schema 11 and 58 record families.
- The retained restore-rehearsal database passed SQLite `integrity_check` (`ok`); `foreign_key_check` returned no rows. Snapshot and rehearsal files were mode `0600` when checked.
- Actual RC27 rollback after earlier failed RC47 windows is documented in the 2026-09-24 activation report. This continuation did not perform another rollback.

## Production state at prior checkpoint

The current canonical install pointer, both launchd descriptors, process arguments, and `repos` resolver identify RC27 (`6dbfee3fbfa4ac05cade1d7382502de5d3b189eb`, package `brain-runtime-package:sha256:267e41d9df24b83abd632cfc1c4dbb4c0333a2245db5cea576c7dbf776c47246`). The pointer and both descriptors are byte-identical to the RC27 backup copies. The shared StateStore was not restored or replaced.

- Core `/status`: HTTP 200, `ok: true`; Console `/agents`: HTTP 200.
- RC27 service doctor: **PASS, 22/22**, including exact package/source, descriptor bindings, launchd ownership/cardinality, and StateStore schema-11 integrity/foreign keys.
- Ten spaced post-rollback read-only samples, five seconds apart: Core, Observer, and Console each returned HTTP 200 in all ten; durable Attempt count remained 64 throughout. A separate ten-sample RC47 observation had also passed before the rollback.
- Observer scheduler state: zero configured schedules, zero pending/claimed; latest tick was `NO_ACTION`. Three historical dead letters remain visible; no scheduler mutation was made by these checks.

## Bounded production acceptance already present in durable state

Five subsequent read-only Jarvis turns were observed on 2026-09-25, after the earlier rollback. Their latest five K4 Attempts are all `completed` and use `runtime:model-gateway`:

| Selected model | Completed turns |
|---|---:|
| GLM-5 | 4 |
| MiniMax M2.5 | 1 |

The five roots share one durable Jarvis conversation with ten turn records. For each root, the status projection links the worker Agent to its Attempt, exposes a result/evidence reference, and contains exactly one completed user turn and one completed Jarvis turn. The four GLM turns recorded Jev fallback reasons (`REFLEX_RECOMMENDATION_NOT_ADMITTED` once and `REFLEX_LOW_CONFIDENCE` three times); the simple MiniMax greeting recorded `REFLEX_SKIPPED_SIMPLE_TURN`. No Codex runtime was selected. No raw prompts or provider output are copied into this report. These turns occurred before RC27 restoration; no production inference was made during or after rollback.

The StateStore currently has 64 Attempts total (57 completed, 5 failed, 2 paused). The historical failed GLM Attempt from the earlier RC47 window remains durable and is not erased or counted as one of these five subsequent successful turns. The earlier report attributes it to expired local access evidence before ModelGateway invocation and documents rollback to RC27 at that time.

For the five-turn acceptance, no duplicate Jarvis turn was found per root, no repository mutation through Agent Mode was observed, and no Harness, BrainNode, Workcell, or tool execution occurred. This audit itself made no model/provider inference and did not change production.

## Fresh account-bound availability read at prior checkpoint

At approximately `2026-09-25T09:27Z`, the read-only Bedrock availability API was called through the approved `ClaudeCodexProvisioner` role in `us-east-1`. No identity switch or IAM edit occurred.

- `zai.glm-5`: authorization `AUTHORIZED`; agreement, entitlement, and region availability `AVAILABLE`.
- `minimax.minimax-m2.5`: authorization `AUTHORIZED`; agreement, entitlement, and region availability `AVAILABLE`.
- No inference was performed by this check.

The RC47 Core descriptor had embedded access evidence checked at `2026-09-25T09:09:30.229Z`, with `freshUntil=2026-09-25T09:39:30.229Z` for both models. At `09:44Z` those timestamps were expired. The `09:27Z` availability read did not rewrite the descriptor or restart Core, so it did not extend runtime freshness. No post-expiry production inference was attempted. This expired evidence was the reason for restoring RC27.

## Worktree state and next gate at prior checkpoint

The pre-existing dirty worktree—including the Firecrawl log and unrelated roadmaps—was left untouched. This report is additive and is not yet committed or pushed. No force push, source rewrite, or unrelated staging occurred.

**Next required action at that checkpoint:** refresh account-bound evidence inside the RC47 Core descriptor, verify measurable headroom, and retry the separately authorized cutover. That action has since been completed as described below.

## Follow-on RC47 production activation — 2026-09-25

### Artifact and canonical-main reconciliation

The exact retained RC47 package was reverified without rebuilding:

- Candidate: `1.0.0-rc.47`, source `8f4ad9683a28007888a758ea0713f8d5288f8e79`.
- Package: `brain-runtime-package:sha256:0401f3ccf6f983b1b82478282c95361f918cb1234b32ebffff85dcc0cf95f2f7`.
- Manifest hash: `2766bb1336ab2e52265fca51b4a649eb22b4f79c0181d1487f464a9d1afabedb`; 2,567 package files.
- Release: `brain-agent-release:sha256:25986914d0ff3cbd667fb5277610b3b650757cd4a34d4522985de992bf520bd4`.
- Package verification and Ed25519 release signature verification: **PASS** for the exact expected version and source.
- After fetching `origin/main`, the exact RC47 source was confirmed an ancestor of canonical `origin/main` (`3da1efc3dd82304dcff73ef6d90bb39a1c4ccadc`). No executable source commit was missing, so no source merge or source push was necessary; no force push was used.

### Fresh RC27 rollback backup and restore proof

The fresh pre-cutover bundle is retained outside Git at:

`/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc47-go-live-precutover-20260925T0955Z.0jZN3L`

- Backup: `brain-agent-backup:sha256:964db692fca80ad653ef0c3f8f03dfc506b0816de93c98c11182079d87aba0b9`.
- Snapshot: `brain-state-snapshot:sha256:58cf58329726f0d9bc566ca6a5b8e8c9af88ad132595ee06d94e758bebba3414`.
- Aggregate hash: `e436c9d3e190b5a5c996f5e0f19dc61d9c74f49f30fdb5f7be1a1b2b52ff79eb`; schema 11, 64 Attempts, and 58 record families.
- RC27 install pointer and Core/Console descriptors were captured before cutover and byte-matched their live copies. RC27 package and release signature verification passed.
- The snapshot was verified, imported into a fresh rehearsal database, and re-exported with identical snapshot ID and aggregate hash. Both source and rehearsal SQLite integrity checks returned `ok`; foreign-key checks returned zero violations. Backup metadata verification passed. The shared production StateStore was never replaced.
- The backup also retains the RC47 descriptors, pointer, and package/release verification metadata. The final refreshed RC47 Core descriptor is preserved there; the RC27 rollback descriptors remain the `precutover-*` files.

### Fresh access evidence and safe activation

The same approved `ClaudeCodexProvisioner` role was used; region was `us-east-1`. Read-only availability checks at `2026-09-25T10:25:07.099Z` returned `AUTHORIZED` and `AVAILABLE` agreement, entitlement, and region status for both `zai.glm-5` and `minimax.minimax-m2.5`. No identity switch, IAM edit, inference, or provider probe occurred.

Those facts were embedded in the RC47 Core launchd descriptor with `checkedAt=2026-09-25T10:25:07.099Z` and `freshUntil=2026-09-26T10:25:07.135Z`. The descriptor was linted and its account reference was not printed. This uses a 24-hour evidence window because the runtime has no shorter maximum; after expiry the runtime fails closed and the evidence must be refreshed through the approved read path.

With no active Attempts or pending scheduler events, the RC27 Core/Console labels were quiesced. The canonical install pointer and each service descriptor were atomically replaced with the retained RC47 configuration while the labels were down; then Core and Console were started. A guarded rollback handler would restore the fresh RC27 pointer/descriptors and services if startup, health, resolver, or doctor checks failed; it was not triggered.

- Canonical Brain CLI resolver selects the RC47 CLI from the exact package root.
- Core `/status`, Agent Mode observer, and Console `/agents`: HTTP 200.
- RC47 production service doctor: **PASS, 22/22**, including package/source identity, launchd bindings, and StateStore integrity.
- Exactly one Core and one Console launchd process; current package/source identities match RC47.
- StateStore schema-11 integrity: `ok`; foreign-key violations: 0.
- Scheduler: zero configured/pending/claimed schedules; latest tick `NO_ACTION`.

### Production acceptance and observation

The bounded five-turn production acceptance remains the durable acceptance for this exact package/source: four completed GLM-5 turns and one completed MiniMax M2.5 turn, linked to ten durable Jarvis user/assistant turn records. Each root has one completed user turn and one Jarvis response; no duplicate response was found. Jev recorded the expected simple-turn skip and bounded fallback reasons. No Codex escalation, Agent Mode repository mutation, Harness, BrainNode, Workcell, or tool execution was observed. These turns were completed earlier during the same RC47 production activation window; this follow-on performed **zero** new model/provider inferences.

After the final evidence refresh/Core restart, ten samples spaced two seconds apart passed: Core, observer, and Console each 10/10; Attempt count remained 64; active Attempts 0; pending/claimed scheduler events 0; uncertain dispatches remained exactly 2; Core PID remained stable at `79138`. A separate ten-sample, five-second-spaced window immediately before the evidence refresh also passed with stable Core/Console PIDs `56048`/`56059`. The two older uncertain K4 dispatches and their paused Attempts were preserved; RC47 startup did not replay them.

The five accepted turns are existing durable evidence, not new work performed during final activation. Jev status was read through the Brain bridge without an inference; the Keychain reference was present and no secret was accessed. Production was not rolled back because all final activation gates passed.

## Final status

**RC47 is PRODUCTION_ACTIVE; RC27 remains the verified ROLLBACK_TARGET.** The candidate was not rebuilt or modified, the StateStore was preserved, and the prior unrelated worktree changes were not staged or altered. The RC47 source is already present on canonical `main`; the only intended landing changes for this continuation are this scoped evidence and the production-support record. No source rewrite or force push occurred.
