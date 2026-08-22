# IKHP6 Packet 1 — Automation Admission and Measurement Foundation

**Status:** accepted as an admission-only repository package on 2026-08-22
**Source:** `brain`
**Owner:** Brain
**Authorization:** documentation, contracts, fixtures, and validation evidence only

## Packet identity

- **Program:** Infrastructure Knowledge & Health Plane (IKHP)
- **Packet:** IKHP6 Packet 1
- **Name:** Automation Admission and Measurement Foundation
- **Acceptance record:** `operations/reports/ikhp6-packet1-reconciliation-2026-08-22.md`

## Objective

Establish the safety foundation for future bounded infrastructure automation without enabling execution. Packet 1 defines how an automation proposal can be described, evaluated, measured, rejected, admitted, expired, and evidenced while preserving the existing read-only and human-approval boundaries.

Packet 1 is a repository contract and evidence package. It is not an automation runtime, scheduler, provider adapter, remediation engine, or autonomous infrastructure control path.

## Deliverables

### Admission and measurement contracts

- `operations/specs/infrastructure-automation-admission-v1.schema.json`
- `operations/specs/infrastructure-automation-measurement-v1.schema.json`

The admission contract binds proposal identity, target resources, policy revision, health freshness, provenance, risk class, decision state, rollback expectation, receipt identity, and lifecycle state. The measurement contract covers the eight Packet 1 metrics: false positives, failed remediation attempts, mean time to detect, mean time to recover, backup success, restore-test success, credential-expiry warning coverage, and alert-noise reduction.

### Validators, fixtures, and tests

- `tools/validate-infrastructure-automation-admission.mjs`
- `tools/validate-infrastructure-automation-measurement.mjs`
- `operations/fixtures/infrastructure-automation-measurement-fixtures-v1.json`
- `projects/brain-core/src/tests/infrastructure-automation-measurement.test.mjs`
- `package.json` validation/test command registrations

The Packet 1 evidence floor also reuses the accepted IKHP4/IKHP5 safety surfaces:

- `tools/validate-infrastructure-actions.mjs`
- `tools/validate-infrastructure-action-receipts.mjs`
- `tools/validate-infrastructure-consumers.mjs`
- `operations/reports/ikhp4-safety-action-contracts-acceptance-2026-08-19.md`
- `operations/reports/ikhp5-unified-consumer-surfaces-acceptance-2026-08-19.md`

## Acceptance evidence

The following repository validations passed for the admission-only Packet 1 scope:

- `npm run validate:infrastructure-automation-admission` — PASS.
- `npm run validate:infrastructure-automation-measurement` — PASS; all 8 metrics covered.
- `npm run test:infrastructure-automation-measurement` — PASS, 3/3.
- `npm run validate:infrastructure-actions` and `npm run test:infrastructure-actions` — PASS, 36/36.
- `npm run validate:infrastructure-action-receipts` and `npm run test:infrastructure-action-receipts` — PASS, 12/12.
- `npm run validate:infrastructure-consumers` and `npm run test:infrastructure-consumers` — PASS, 7/7.
- Catalog regression — PASS, 8/8.
- Health regression — PASS, 10/10.
- Incident regression — PASS, 23/23.
- `npm run validate:diff-check` — PASS.

The detailed reconciliation, including the evidence-gap closure and comparison with IKHP4/IKHP5 acceptance conventions, is recorded in `operations/reports/ikhp6-packet1-reconciliation-2026-08-22.md`. Existing catalog stale-provenance warnings remain known evidence warnings and do not fail the Packet 1 contract.

## Safety boundaries

The following invariants are mandatory and remain unchanged:

```text
executionEnabled=false
executionPerformed=false
actualEffects=[]
```

Packet 1 performs no:

- provider mutation;
- infrastructure mutation;
- remediation;
- scheduling or continuous polling;
- credential creation, rotation, or mutation;
- autonomous execution;
- Decision Core write;
- live action dispatch;
- backup or restore operation.

Admission evidence describes and evaluates proposals; it does not execute them.

## Admission lifecycle

The Packet 1 proposal lifecycle is:

```text
proposed -> evaluated -> admitted
                    -> rejected
                    -> expired
```

The allowed lifecycle states are:

- `proposed` — a bounded proposal has been formed but not evaluated;
- `evaluated` — the proposal has been checked against the admission contract;
- `admitted` — the proposal satisfies the admission contract for its bounded evidence window;
- `rejected` — the proposal fails policy, evidence, freshness, provenance, or safety requirements;
- `expired` — the proposal's admission window is no longer valid.

The lifecycle explicitly excludes `executing`, `executed`, and `completed`. Those are not Packet 1 states and are not implied by admission.

## Remaining authorization boundary

IKHP6 Packet 1 acceptance does not authorize future automation execution. It does not authorize remediation, scheduling, provider mutation, credential mutation, or autonomous infrastructure changes.

Any future packet that expands beyond admission and measurement foundation requires a separate owner authorization, implementation scope, acceptance evidence, and safety review. High-risk actions remain approval-gated, and CLR5 remains separately unauthorized.

## Canonical roadmap references

- `operations/specs/infrastructure-knowledge-health-plane-roadmap.md`
- `operations/specs/infrastructure-knowledge-health-plane-implementation-plan.md`
- `operations/runbooks/infinite-brain-roadmap-status.md`
