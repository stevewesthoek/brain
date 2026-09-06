# Infrastructure Observation and Admission

## Purpose

Use this runbook to discover local applications, runtimes, servers, processes,
listeners, dependencies, identities, sessions, credential custody, lifecycle,
health, and isolation without turning observation into an unauthorized config
writer or secret store.

The canonical contracts are
`operations/specs/infrastructure-observation-v1.schema.json` and
`operations/specs/infrastructure-candidate-v1.schema.json`. The shared runtime
is `tools/infrastructure-catalog/observation-core.mjs`.

For the native Codex/OpenAI account, session, runtime-profile, and storage
boundary, use
`operations/specs/infrastructure-codex-account-profile-capability.md` and the
future-gated enrollment procedure at
`operations/runbooks/codex-account-profile-enrollment.md`.

## Safe diagnostic path

Run the deterministic acceptance gate first:

```bash
npm run validate:infrastructure-observation-admission
npm run test:infrastructure-observation-admission
npm run test:codex-auth-profiles
npm run check:codex-auth-profiles
```

For current local evidence, run:

```bash
node tools/observe-infrastructure.mjs
```

The live command is report-only. It uses allowlisted supported status/doctor
surfaces and local executable/listener metadata. It does not read auth files,
tokens, cookies, API keys, private keys, Keychain data, browser storage,
command arguments, or environment variables. It does not start/stop/restart
processes, log in/out, repair configuration, attach connectors, or write the
catalog.

## Contract flow

```text
discover() → observation → candidate → pure admission plan
                                      ├─ admit
                                      ├─ remain_candidate
                                      └─ reject on conflict
```

Each adapter implements:

- `discover()` — return non-secret observations and candidates;
- `observe(candidate)` — return the latest candidate evidence;
- `verifyRelationship()` — verify an ownership, route, or dependency claim.

Admission requires fresh evidence and resolved identity, environment,
ownership, custody, dependencies, health/recovery, lifecycle, isolation, and
route ownership. Unknown evidence remains an explicit backlog item. Conflict
is rejected. The plan is non-executable and contains no actual effects.

## Account and vault rules

Represent every account of the same provider with a separate opaque account
reference, credential reference, session reference, and runtime-profile
reference. Never use an email, filename, browser directory, token hash, or
process guess as a substitute for supported expected-principal evidence.

Application-managed OAuth/session state remains with the application. Brain
stores only metadata and health evidence. macOS Keychain is the current/reference
local secret-store adapter. OnePassword is a possible future adapter, not the
current Brain source of truth. No generic mechanism may extract, duplicate,
blindly refresh, or artificially keep alive credentials.

## Failure interpretation

- Provider `401 token_revoked`: classify the bound account/session as invalid
  or reauthentication-required; do not treat it as a process crash and do not
  rotate credentials automatically.
- Startup timeout: classify the affected adapter/runtime as unavailable or
  unknown; do not increase timeouts indefinitely without provider evidence.
- Connector attachment unknown: keep the runtime degraded even if its local
  route, proxy, and tunnel are healthy.
- Missing account identity: notify only at the unresolved account/profile
  level; never claim a global multi-account result.

The canonical catalog backlog currently contains 46 governance-unknown
resources. The live Codex evidence is recorded separately in
`operations/reports/ikhp-live-codex-runtime-observation-2026-09-05.md`; the
account/profile capability result is recorded in
`operations/reports/ikhp-codex-account-profile-capability-2026-09-05.md`.
