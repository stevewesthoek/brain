# IKHP3 Incidents and Attention — Acceptance Evidence

**Accepted:** 2026-08-17 as a repository implementation.
**Program state:** IKHP0-IKHP3 complete; IKHP4-IKHP6 not authorized; CLR5 not authorized.

## Authority model

- IKHP1 remains canonical topology/policy authority.
- IKHP2 remains normalized read-only observation evidence.
- IKHP3 is derived incident lifecycle and attention state only.
- CLR3 Decision Core remains the human-choice workflow; IKHP3 creates no automatic Decision Core proposals and writes no Decision Core state.

## Implemented paths

```text
operations/specs/infrastructure-incident-v1.schema.json
operations/fixtures/infrastructure-incident-fixtures-v1.json
projects/brain-core/src/adapters/infrastructure-incident-engine.mjs
projects/brain-core/src/adapters/infrastructure-incident-runtime.mjs
projects/brain-core/src/adapters/infrastructure-incident-notifications.mjs
projects/brain-core/src/tests/infrastructure-incident-engine.test.mjs
tools/validate-infrastructure-incidents.mjs
package.json
```

Packet 6 additionally synchronizes the IKHP roadmap, implementation plan, and canonical live-status document.

## Incident contract and identity

The versioned incident contract is source/provider/UI neutral. It does not define a second condition-code registry. Condition codes remain strings emitted by IKHP2 and severity remains authoritative only when IKHP1 `health-policies.v1.json` contains a matching `resourceId + conditionCode` policy.

Incident fingerprints are deterministic SHA-256 derivatives of:

```text
resourceId
conditionCode
healthPolicyId (or unknown)
health-policies catalogVersion
```

Unknown policy produces `severity=unknown`, `policyAuthority=unknown`, and `healthPolicyId=null`; unknown authority is never silently treated as healthy or low severity. `affectedResourceIds` contains the direct resource only; IKHP3 does not assert blast radius.

## Incident lifecycle

The pure projector supports:

- new condition -> `opened` / `open`;
- repeated condition -> `continued`, stable identity, incremented observation count;
- fresh clean observation -> `recovered` with explicit recovery evidence;
- stale/unknown clean observation -> no recovery;
- recurrence after recovery -> `reopened` with incremented occurrence count;
- acknowledgement metadata without changing underlying incident health;
- suppression only from explicit caller input, never heuristic behavior.

The projector performs no filesystem, network, environment, provider, notification-delivery, or Decision Core calls.

## Runtime persistence

Derived incident state defaults to:

```text
runtime/local/infrastructure/incident-state.json
```

The runtime uses restrictive parent permissions, mode `0600`, temporary sibling writes, and atomic rename. Defaults are 200 incidents, 30-day historical maximum age, and 7-day recovered-history retention. Active `open` and `suppressed` incidents are never dropped solely because of age or count; if active incidents exceed the nominal count bound, all active incidents are preserved. Missing state yields an explicit empty state. Malformed/corrupt state throws and is never silently interpreted as empty/healthy.

## Attention and notification cursor

The pure attention planner provides:

- immediate attention for critical/high `opened`, `reopened`, and `recovered` transitions;
- acknowledgement suppression of attention only, with expiry restoring eligibility;
- medium/low/unknown unresolved incidents in a bounded daily digest;
- one normal digest per UTC day;
- deterministic transition dedupe;
- default `maxImmediatePerResourcePerHour=5`;
- excess immediate events deferred rather than dropped;
- unresolved incident count derived from current incident state rather than stored as separate authority;
- safe notification payload fields only: incident ID, resource ID, condition code, severity, transition, open count, and occurrence time.

Notification cursor state defaults to:

```text
runtime/local/infrastructure/incident-notification-state.json
```

It stores bounded delivery/dedupe cursor data only, not a duplicate incident store. Persistence uses restrictive parent permissions, mode `0600`, temporary write + atomic rename. Missing cursor state yields an empty cursor; malformed cursor state fails explicitly.

## Deterministic validation

Final Packet 1-5 evidence before Packet 6:

- `npm run test:infrastructure-incidents` — **PASS 23/23**;
- `npm run validate:infrastructure-incidents` — **PASS**;
- validator summary: `scenarios=8`, `policyCatalogVersion=1.0.0`, `schema=1.0.0`, `directResourceOnly=true`, `decisionCore=false`, `runtimePaths=2`;
- JSON validation for `package.json`, incident schema, and deterministic fixtures — **PASS**;
- `npm run validate:diff-check` — **PASS**;
- exact `forbidden_secret_material` scan over Packet 1-5 paths — **PASS, 0 findings**;
- no real incident/notification runtime file was created during validation.

Focused tests cover policy-backed severity, identity/dedupe, observation and occurrence counts, fresh recovery, stale/unknown fail-closed behavior, reopen, policy-catalog-version fingerprints, unknown policy, acknowledgement/expiry, immediate/recovery attention, dedupe, rate limiting/defer behavior, daily digest, safe payloads, atomic `0600` runtime writes in temporary directories, active-state retention, historical pruning, missing/corrupt state behavior, direct-resource-only impact, and absence of Decision Core integration.

## Repository-only acceptance boundary

IKHP3 completion does **not** activate:

- continuous scheduling or polling;
- live provider collection/reachability claims;
- live notification delivery channels;
- Brain Core API, CLI, MCP, or Obsidian incident UI;
- automatic Decision Core proposal creation;
- remediation or infrastructure mutation;
- server/configuration/DNS/tunnel/backup/credential mutation;
- IKHP4, IKHP5, IKHP6, or CLR5.

No Mind, Workbench-private, Video Orchestrator, or Obsidian installation changes are part of IKHP3.

## Explicit unrelated exclusions

The following concurrent work is outside IKHP3 and must not be staged or committed with this acceptance:

```text
operations/migrations/dokploy-azure-to-lightsail/phase-3e0-final-pre-cutover-readiness.md
operations/architecture/prochat-infrastructure-architecture.md
```

## Next gate

**IKHP4 remains NOT AUTHORIZED.** IKHP4 introduces infrastructure safety policy and guarded action contracts. No IKHP4 mutation semantics are implied by IKHP3 acceptance.
