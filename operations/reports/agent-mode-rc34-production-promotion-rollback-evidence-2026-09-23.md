# Agent Mode RC34 Production Promotion and Rollback Evidence — 2026-09-23

## Outcome

RC34 was verified and briefly activated, but production promotion is **BLOCKED**.
The required real `repos → Auto → read-only goal` acceptance was admitted to an
Opus/Claude Code worker and failed with the durable K4 failure code
`CLAUDE_CODE_EXEC_FAILED`. The retained RC27 release was immediately restored
and re-verified. RC27 remains the active production release; RC34 is retained
only as a candidate and must not be retried until the Auto/Opus admission
discrepancy is resolved.

## Source and release identities

- Canonical `main` before the attempt: `833ce0564aa06d4f6d2f6c6ee760bcc7c568aa4d`.
- `origin/main` matched that SHA; the intended Jarvis/terminal-intake source
  commits were already integrated and pushed. No runtime source was changed in
  this promotion attempt.
- Candidate: `1.0.0-rc.34`.
- Package: `brain-runtime-package:sha256:e71b79f9a4f7eb751882282d8bdd5b54455e1a3b9699d380383c6bbb298fa9b5`.
- Release: `brain-agent-release:sha256:b1986bd3fb233191b21f58a116b434df66703ff39dbd7a6213479f8f1eb834f4`.
- Candidate source revision: `833ce0564aa06d4f6d2f6c6ee760bcc7c568aa4d`.
- Package verification: PASS, 2,567 files / 65,735,600 bytes. Ed25519 release
  verification and package/source correspondence: PASS.

## Backup and rollback

A fresh pre-cutover backup is at:

`/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc34-production-prepromotion-20260923T115059Z`

- Snapshot: `brain-state-snapshot:sha256:e456407812d27d0b47c435a1b71f23c609029278476da03813b1abf4a3f4f336`.
- Backup manifest: `brain-agent-backup:sha256:5907346944427456b6da610c4206d3399579986bf0359419163875bcdea7782c`; manifest verification: PASS, 58 record families, source schema 11.
- Isolated restore: imported to `restore-check/agent-mode.db`; SQLite
  `integrity_check` returned `ok`, `foreign_key_check` returned no violations,
  and restored Agent/Task/Run/Attempt counts matched the snapshot manifest.
- Rollback descriptors and both install records were captured before cutover.
  RC27 rollback completed successfully; no StateStore rollback/replacement was
  performed, so the failed acceptance lifecycle remains durably recorded.

## Bounded activation and acceptance

RC27 was active before cutover. Its launchd services were unloaded in order and
waited out before the RC34 descriptors were installed. RC34 Core and Console
then returned HTTP 200, scheduler returned HTTP 200, and the production service
doctor passed 22/22 checks. No schema migration was applied.

The actual repository launcher selected the installed RC34 CLI and was invoked
as `repos --model auto` for the `stevewesthoek/brain` repository. Jarvis intake
was durably accepted and displayed immediate feedback, spinner/timer, semantic
progress, and a single running-agent view. Auto selected `Opus 4.6 ·
claude-code`; the UI reported `Jev skipped`. K4 created one bounded read-only
child lifecycle, whose authoritative runtime receipt settled failed with
`CLAUDE_CODE_EXEC_FAILED`. No retry or second live request was made. No
successful assistant result was produced. This is an acceptance failure, not a
pass, and it conflicts with the explicitly unresolved/fail-closed Opus cost
gate. Opus was not manually forced and no policy bypass was intentionally
introduced by the operator. However, the observed Auto path did admit the Opus
runtime while cost/admission was declared unresolved; whether the admission
path bypassed or misapplied K4 policy remains unreconciled and must be treated
as a security blocker before any new promotion attempt.

RC27 was restored by booting out both RC34 labels, waiting for unload, restoring
the saved descriptors/install records, and bootstrapping RC27 Core then Console.
After rollback, the RC27 service doctor passed 22/22; Core, Console `/agents`,
observer, and scheduler returned HTTP 200 in 10/10 samples with stable process
IDs. StateStore integrity remained clean.

## Jev, policy, and waived gates

- Jev status reported its Keychain credential as present without exposing a
  secret; the provider network probe was not performed. The global budget
  remained $10.00/month, with $9.994733 reported remaining. This attempt made
  no Jev request (`Jev skipped`).
- No automatic Codex escalation occurred in the recorded worker lifecycle.
- The earlier RC30 economic cohort remains **NEGATIVE** (8 turns per condition,
  no Jev route changes, no Opus; net approximately `-$0.017097`).
- Human foreground resize: **WAIVED_BY_USER**, not passed.
- Full multi-route/Opus economics cohort: **WAIVED_BY_USER**, not passed. No
  additional US$1 cohort was run.
- Opus cost/admission verification: **UNRESOLVED / FAIL-CLOSED REQUIRED**.

## Decision and next action

- Active production: **RC27**.
- RC34 promotion / `GO_LIVE`: **NO — BLOCKED**.
- Rollback: **PASS**; production health after rollback: **PASS**.
- Preserve RC34 as an immutable candidate. Do not rerun the failed goal or
  perform further live calls until the Auto→Opus admission path is reconciled
  with the existing fail-closed K4 policy. Human resize and full economics
  remain waived and are not the blocker.
