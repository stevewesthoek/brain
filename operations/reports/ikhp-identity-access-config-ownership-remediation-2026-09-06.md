# IKHP Identity & Access Configuration Ownership Remediation

**Date:** 2026-09-06
**Status:** repository implementation complete; live OAuth/account onboarding remains deferred

## Outcome

The remaining runtime-safety blocker is addressed in the Brain repository.
Configuration is now treated as a collection of semantic resources rather than
as one mutable file owned wholesale by Brain. Brain-owned isolated profile
configuration can be materialized through an ownership plan and atomic write;
unknown, external, conflicted, journal-inconsistent, or drifted resources fail
closed. The real shared/default Codex root remains observe-only for normal
Brain operations.

No OAuth token, API key, Keychain value, cookie, authentication file, state
database, WebGPT journal, or WebGPT source was changed by this remediation.
No commit, merge, push, worktree cleanup, or branch deletion was performed.

## What was unsafe before

The legacy managed-root script reasoned primarily about physical paths and the
Brain-generated subset of `config.toml`. A file could therefore contain
application-owned values that were reachable by a Brain repair operation. The
old preservation logic covered several known app-local sections, but that was
not a complete ownership boundary and did not provide a reusable plan/revision
contract.

The shared/default `~/.codex` was also too easy to confuse with an ordinary
Brain-managed profile. That is unsafe because native Codex, Codex Desktop,
WebGPT, browser/bridge state, and other consumers can share that surface.

## Implemented safety model

`tools/lib/configuration-ownership.mjs` now provides a generic, adapter-neutral
planner with the actions `preserve`, `create`, `update`, `remove`, `conflict`,
and `unknown`. A plan includes resource identity, current/desired owner,
authority reference, opaque source revision, journal state, and redacted
semantic state labels. It never returns configuration values.

Mutation is executable only when the plan is ready. The writer then:

1. re-reads the planned resource revision immediately before writing;
2. refuses if the resource changed or its physical type is unresolved;
3. validates non-secret output;
4. writes owner-only content to a same-directory temporary file;
5. atomically publishes and verifies the final artifact.

The native profile materializer uses this core and records the resulting opaque
config revision in `<profile-root>/config.toml.brain-ownership.json`. It is
create-only for an already owned artifact in this tranche; an existing config
without matching Brain ownership metadata is a conflict. Auth/runtime state is
excluded from the materializer.

## Resource boundaries

| Resource | Normal owner | Brain behavior |
| --- | --- | --- |
| Dedicated profile non-secret config artifact | Brain profile materializer | Plan, validate, atomically create, verify |
| Dedicated profile auth/session/runtime state | Codex application | Observe only; never copy or migrate |
| Shared/default `~/.codex` | Native Codex and current integrations | Observe only; generic repair/migration refused |
| WebGPT route and realtime route | WebGPT adapter/application | Preserve; recover only through WebGPT path |
| WebGPT integration journal/recovery journal | WebGPT application | Never rewrite; generic repair refused when present |
| Hook definitions and trust state | Owning application/runtime surface | Preserve unless that exact resource is governed |
| Unknown third-party config | Unknown/external | Preserve in compatibility fixtures; never claim ownership |
| Codex state database and WAL/SHM family | Codex application | Separate health/observation concern; not config repair |

The legacy script now evaluates ownership before staging generated output. It
refuses a real default-root repair/migration and refuses a target associated
with a WebGPT integration journal. Synthetic compatibility fixtures prove that
route/model selection, realtime/WebRTC routing, application/user settings,
hook trust state, and unknown third-party sections survive an unrelated Brain
repair. This preservation is not permission to mutate those resources.

## Hook assessment

The current runtime has two distinct hook-related surfaces: `~/.codex/hooks.json`
contains four lifecycle groups, while `config.toml` contains an `Interrupt`
definition and 22 hook-trust state entries. Because source ownership and live
execution authority are not fully proven by file shape alone, this remediation
does not delete or consolidate either surface. The safe result is preservation
plus a regression test proving that unrelated config repair leaves the parsed
hook trust state unchanged. A later hook-specific cleanup must first establish
canonical ownership, active execution, historical status, and rollback.

## State-database classification

The live `state_5.sqlite` is an application-owned runtime database with WAL and
SHM companions. A read-only integrity check returned `ok`, and the schema
contains the expected thread/runtime tables. Its ownership and recovery remain
separate from configuration ownership. This remediation neither rewrites nor
repairs it.

## WebGPT/Desktop acceptance

Repository and source-level WebGPT separation remains intact: the Brain
runtime-profile adapter does not target the WebGPT project or its application
home, and the WebGPT project was not modified. The existing WebGPT v5.0.3
route-level evidence remains valid from the prior acceptance run.

The current read-only WebGPT doctor reported:

- configuration valid;
- native model route installed;
- launcher, proxy, pinned tunnel binary, tunnel key custody, and tunnel health
  checks healthy;
- embedded-browser check unavailable because the current Codex task is running
  an active Codex turn;
- connector attachment cannot be proven by local checks.

Therefore desktop/WebGPT acceptance is not falsely marked complete. The
remaining check must be repeated from an independent, idle application state;
it does not justify stopping the current task or mutating OAuth/configuration.

## Verification

Passed:

- configuration ownership unit tests: 6/6;
- Codex runtime architecture tests: 31/31;
- runtime-profile tests: 12/12;
- managed-root shell tests, including shared-root and WebGPT-journal refusal;
- stop-and-repair shell tests;
- identity/access validation and tests: 9/9;
- observation/admission validation and tests: 10/10;
- governance validation and tests: 7/7;
- catalog validation and tests: 8/8;
- infrastructure health tests: 10/10;
- incident tests: 23/23;
- action tests: 37/37;
- contract registry validation;
- JavaScript/shell syntax checks and `git diff --check`.

The catalog validator still reports its pre-existing stale-provenance warnings;
those are warnings, not failures, and are unrelated to this config-ownership
remediation.

## Remaining gates

This Goal does not authorize live native OpenAI login, multi-account OAuth
admission, credential migration, Keychain value access, automatic token
refresh, keepalive traffic, or state-database recovery. The next Goal should
independently admit the first reviewed account/profile using the now-safe
dedicated-root materializer, followed by a second-account isolation test and a
read-only account/principal observation.
