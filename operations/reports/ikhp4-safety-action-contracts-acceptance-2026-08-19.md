# IKHP4 Safety & Action Contracts — Acceptance — 2026-08-19

## Status

IKHP4 is complete and accepted as a repository implementation on 2026-08-19.

IKHP4 provides deterministic infrastructure safety policy, typed action-plan validation, fail-closed safety evaluation, and bounded runtime receipt persistence. It does not activate infrastructure execution.

## Implemented contract

- Versioned protected-resource and mutation safety policy through the IKHP catalog.
- Versioned typed action-plan schema and deterministic intent hashing.
- Fail-closed preflight evaluation bound to exact resource IDs, revisions, health/freshness, policy catalog version, provider state, blast radius, backup/dry-run/config/rollback requirements, incidents, approvals, and provenance.
- Provider-neutral action semantics with `executionEnabled=false`, `executionPerformed=false`, and `actualEffects=[]` invariant.
- Non-secret durable receipts derived from the Packet 3 evaluator and persisted only when explicitly invoked.
- Runtime receipt state is bounded under `runtime/local/infrastructure/action-receipts.json`, written atomically with mode `0600`, count/age retention, exact action/hash/idempotency/policy/target bindings, replay dedupe, and fail-closed conflicting replay/malformed-state handling.
- Receipt persistence contains no network/provider execution capability and cannot itself perform infrastructure mutation.
- Tests and validators use temporary roots; no repository runtime receipt state was created during acceptance.

## Packet 4 implementation files

- `projects/brain-core/src/adapters/infrastructure-action-receipt-runtime.mjs`
- `projects/brain-core/src/tests/infrastructure-action-receipt-runtime.test.mjs`
- `tools/validate-infrastructure-action-receipts.mjs`
- `package.json`

Packet 3 action-contract files remain part of the accepted IKHP4 implementation:

- `operations/specs/infrastructure-action-v1.schema.json`
- `operations/fixtures/infrastructure-action-fixtures-v1.json`
- `projects/brain-core/src/adapters/infrastructure-action-safety.mjs`
- `projects/brain-core/src/tests/infrastructure-action-safety.test.mjs`
- `tools/validate-infrastructure-actions.mjs`

## Acceptance evidence

- `npm run validate:infrastructure-action-receipts` — PASS.
- `npm run test:infrastructure-action-receipts` — PASS, 12/12.
- `npm run validate:infrastructure-actions` — PASS.
- `npm run test:infrastructure-actions` — PASS, 36/36.
- `npm run validate:infrastructure-catalog` — PASS; only pre-existing stale-provenance warnings remain.
- `npm run test:infrastructure-catalog` — PASS, 8/8.
- `npm run validate:infrastructure-health` — PASS.
- `npm run test:infrastructure-health` — PASS, 10/10.
- `npm run validate:infrastructure-incidents` — PASS.
- `npm run test:infrastructure-incidents` — PASS, 23/23.
- New Packet 4 MJS syntax checks — PASS.
- All 13 changed JSON files — valid.
- `npm run validate:diff-check` — PASS.
- `forbidden_secret_material` scan over Packet 4/action-contract paths — 0 findings.
- `forbidden_secret_material` scan over the remaining reconciliation paths — 0 findings.
- `operations/accounts/azure-subscriptions-comprehensive.md:138` retains one documented pre-existing Azure CLI token-assignment lexical finding outside the subscription-rename diff; it was not rewritten.
- `runtime/local/infrastructure/` contains no receipt state in the repository after validation; tests/validator used temporary roots only.

## Boundaries preserved

No live provider call, infrastructure action execution, DNS/tunnel/server/config/firewall mutation, backup/restore operation, credential mutation, remediation, Decision Core write, Mind change, Workbench-private change, Video Orchestrator change, or Obsidian change occurred.

`operations/accounts/credentials-index.md` was not modified.

No commit or push occurred as part of IKHP4 acceptance.

## Remaining evidence conditions

The 2026-08-18 connectivity audit remains authoritative current evidence where incorporated. Deliberate UNKNOWNs and accepted/deferred risks remain evidence rather than remediation authorization, including standalone/account-wide Cloudflare Zero Trust Access inventory where credentials were insufficient, the broad tailnet wildcard Grant, untagged/user-owned AWS production nodes, stale/offline `motorola`, CloudPanel direct-public website ingress, and Supabase multi-path connectivity.

## Next roadmap stage

The authoritative implementation plan proceeds directly from IKHP4 validation to IKHP5 Unified Consumer Surfaces. IKHP5 and IKHP6 require separate owner authorization and remain unstarted. CLR5 remains unstarted and requires separate owner authorization.



## IKHP5 follow-on authorization and discovery — 2026-08-19

Owner authorization now permits IKHP5 Unified Consumer Surfaces in `brain` and requests fastest safe progress toward the verified 1.3.7 release/deployment checkpoint.

### Exact IKHP5 requirements recovered

Authoritative sources are `operations/specs/infrastructure-knowledge-health-plane-roadmap.md`, `operations/specs/infrastructure-knowledge-health-plane-implementation-plan.md`, and `operations/specs/infrastructure-knowledge-health-plane-architecture.md`.

IKHP5 must expose one canonical infrastructure identity/state model through four consumers:

1. Brain Core unified read-only `/infra/*` API (`catalog`, `topology`, `health`, `incidents`, `backups`, `credentials/status`, resource inspection/relations, doctor), while existing provider endpoints remain compatibility views where practical.
2. Context Broker source-neutral provider with descriptor-first bounded retrieval, exact resource/relationship/health expansion, citations/freshness, no raw secrets, and bounded token use.
3. `prochat infra ...` CLI plus source-neutral MCP capability descriptors using the same Brain Core/shared projection contract.
4. Existing Brain Console/Obsidian-first cockpit extended with architecture/topology, resource health, incidents, backup/restore state, credential/OAuth status/expiry, freshness/provenance, and read-only safety/receipt visibility.

Acceptance requires same canonical IDs/state across surfaces, no duplicated truth store, bounded context, no secret exposure, and visible offline/stale/UNKNOWN states. IKHP4 invariants remain `executionEnabled=false`, `executionPerformed=false`, `actualEffects=[]`.

### Implementation plan

Use one shared read projection over `operations/infrastructure/catalog/*` plus bounded derived runtime state under `runtime/local/infrastructure/`. Brain Core routes, Context Broker provider, CLI/MCP descriptors, and Brain Console consume that projection/API rather than copying catalog state. Preserve provider-specific endpoints as compatibility views. Add focused cross-surface conformance tests, then rerun IKHP1-IKHP4 regression floors and security/diff checks before status reconciliation.

### Risks and controls

- Catalog/runtime divergence: fail closed to explicit missing/invalid/UNKNOWN state; never synthesize health.
- Secret leakage: credential consumer output exposes metadata only and omits secret-store values; security scan all affected paths.
- Competing truth: no generated canonical catalog or new mutable infrastructure database; all consumers reference canonical resource IDs.
- Runtime mutation: all IKHP5 surfaces are read-only; no provider or infrastructure executor is added.
- Existing dirty worktree: preserve all accepted IKHP3/IKHP4/reconciliation changes; no broad staging/reset.
- Obsidian/console scope: extend the existing Brain Console only; no second portal and no unrelated Obsidian edits.

### 1.3.7 release discovery

Exact Brain-repository search shows the root `machine-brain` package is `1.0.0` and Brain Core/Console are `0.1.0`; no Brain `1.3.7` release target exists in the authorized source. The only meaningful release lineage found is Workbench-private `v1.3.7-beta` context compaction, referenced by `operations/specs/infinite-brain-context-learning-runtime-implementation-plan.md` as preceding queued Workbench-private `v1.3.8-beta — Source-Agnostic Context & Capability Federation`. That release target is outside the locked `brain` source and Workbench-private modification is not authorized in this IKHP5 run. IKHP5 does not depend on implementing IKHP6 or CLR5.

### Validation strategy

At minimum: shared projection/API/Context Broker/CLI/Brain Console conformance; Brain Core and Brain Console typechecks/build where bounded; catalog >=8/8, health >=10/10, incidents >=23/23, actions >=36/36, receipts >=12/12; changed JSON valid; MJS/TS syntax/type checks; `validate:diff-check`; exact `forbidden_secret_material` scans; final HEAD/status/diff; no live/provider/infrastructure mutation. If IKHP5 is fully green, stop before any Workbench-private 1.3.7 operation and provide the exact cross-repo authorization/continuation gate.
