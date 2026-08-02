# BS0.19 — Cross-repository deletion-readiness evaluation

**Status:** complete (2026-08-01, semantic prerequisite repair)
**Gate:** `node tools/validate-deletion-readiness.mjs`
**Boundary:** evaluation only — no file or folder was deleted, moved, or renamed
**Prerequisites:** BS0.6–BS0.18 complete; Mind M1.3 and M1.4 resolved (2026-07-31)

## Purpose

Prove that each legacy path in the canonical path registry has no active
producers, consumers, links/backlinks, authority dependencies, provenance
obligations, rollback requirements, or explicit approval gates that would
prevent safe deletion.

## Methodology

1. **Canonical path registry** (`operations/specs/infinite-brain-path-registry.json`) — all non-canonical, non-future-target entries evaluated.
2. **Evidence index** (`operations/specs/deletion-readiness-evidence.json`) — structured evidence per pathId; fails closed when absent.
3. **Brain source code scan** — `projects/brain-core/src/`, `projects/mind-steward/src/`, `projects/mind-context/src/`, `tools/`.
4. **Producer inventory** — four legacy producers retired by BS0.10 on 2026-07-31.
5. **Writer-audit-log** — fixture entries with `null` outcomes (all rejected).
6. **Mind read-only inspection** — task-kanban-contract, folder-contract, agent-context.

## Fail-closed invariant and verdict precedence

The validator evaluates in strict precedence order:

1. **BLOCKED conditions fire first.** Any of: active producer, active consumer,
   unresolved authority, missing provenance, missing rollback, or missing approval
   evidence in the record → BLOCKED immediately, before PARTIAL is considered.
2. **PARTIAL conditions fire second.** Any of: ambiguous consumer, pending cleanup
   task, active generator, or unverified fixture reference in the record → PARTIAL.
   A PARTIAL path is still fail-closed with respect to deletion; it is not
   deletion authorization.
3. **SAFE requires one structured positive-proof contract everywhere.** Only
   a record that passes the BLOCKED and PARTIAL checks AND provides all six
   universal proofs plus every exact `deletionPrerequisites` identifier as
   structured `{ status, evidence, appliesTo }` objects can become SAFE.
   `status` must equal `satisfied`, `evidence` must be nonblank, and `appliesTo`
   must be `global` or include the exact registry literal. `unmet`, `unresolved`,
   missing fields, scope mismatches, unknown statuses, and plain strings fail
   closed to BLOCKED.

A generic approval proof does not satisfy a named prerequisite such as
`approved-folder-cleanup`. Retirement, non-authoritative classification,
producer removal, or canonical replacement does not substitute for explicit
human deletion approval. The two PARTIAL paths (router-root, sources-root)
carry explicit partial-condition markers and remain fail-closed for deletion.

## Executable gate

The deterministic validator reads the path registry and the evidence index;
it does not read or modify any filesystem path under Mind or any production
directory.

```bash
node tools/validate-deletion-readiness.mjs
node --test tools/validate-deletion-readiness.test.mjs
```

```text
63 focused tests pass (63/63): node --test tools/validate-deletion-readiness.test.mjs → pass
node tools/validate-deletion-readiness.mjs → deletion-readiness=blocked SAFE=0 PARTIAL=2 BLOCKED=17
```

## Evaluation results (2026-08-01, Graphify evidence reconciled)

Gate output: 0 SAFE, 2 PARTIAL, 17 BLOCKED (19 non-canonical entries evaluated)

| Path ID | Literal | Registry state | Verdict | Primary reason |
|---|---|---|---|---|
| archive-root | `archive/` | historical | BLOCKED | `approved-folder-cleanup` prerequisite: no existing artifact explicitly authorizes folder deletion |
| capture-failed | `capture/failed/` | compatibility | BLOCKED | `approved-folder-cleanup` prerequisite: no existing artifact explicitly authorizes folder deletion |
| capture-inbox | `capture/inbox/` | historical | BLOCKED | `approved-folder-cleanup` prerequisite: no existing artifact explicitly authorizes folder deletion |
| graphify-compatibility-output | `graphify-out/` | compatibility | BLOCKED | Governance explicitly prohibits deletion: `graphify-transition-governance.json` retention gate uncleared; three conditions required (CBM adapter production stability ≥7 days, Mind semantic synthesis assessment, explicit Brain approval); additionally the profile catalog's `graphify-profile-conformance` prerequisite evidence has appliesTo `runtime/local/graphify/...` only — scope mismatch for `graphify-out/` |
| graphify-operational-output | `.graphify-out/` | compatibility | BLOCKED | Profile catalog governs `runtime/local/graphify/...` roots and explicitly excludes `.graphify-out/` from corpus; `graphify-profile-conformance` prerequisite evidence has appliesTo `runtime/local/graphify/...` only — scope mismatch for `.graphify-out/`; prerequisites status=unresolved |
| legacy-task-summary | `live/tasks.md` | compatibility | BLOCKED | M1.4 proves retirement and task-authority migration, but no Brain artifact records the human-approved deletion ownership or rollback expectations required by the BS0.19 prerequisite decision |
| live-root | `live/` | compatibility | BLOCKED | `approved-folder-cleanup` prerequisite: no existing artifact explicitly authorizes folder deletion |
| n8n-failed-override-name | `MIND_FAILED_PATH` | active | BLOCKED | Active deployed consumer: MIND_FAILED_PATH expression referenced in live n8n workflow (B1.0a) |
| n8n-inbox-override-name | `MIND_INBOX_PATH` | active | BLOCKED | Active deployed consumer: MIND_INBOX_PATH expression referenced in live n8n workflow (B1.0a) |
| numbered-roots | `0[1-9]-*/` | historical | BLOCKED | `approved-folder-cleanup` prerequisite: no existing artifact explicitly authorizes folder deletion |
| personal-identity-exception | `wiki/areas/personal-identity/` | compatibility | BLOCKED | Unresolved scoped authority; `Mind-authority-decision` prerequisite unmet |
| prochat-brand-exception | `wiki/organisations/prochat/brand/` | compatibility | BLOCKED | Unresolved scoped authority; `Mind-authority-decision` prerequisite unmet |
| prochat-os-strategy-missing | `wiki/organisations/prochat/brand/prochat-os-strategy.md` | compatibility | BLOCKED | normativeSourceStatus unresolved; `Mind-authority-decision` prerequisite unmet |
| prochat-playbooks-exception | `wiki/organisations/prochat/playbooks/` | compatibility | BLOCKED | Unresolved scoped authority; `Mind-authority-decision` prerequisite unmet |
| prochat-youtube-exception | `wiki/organisations/prochat/youtube/` | compatibility | BLOCKED | Unresolved scoped authority; `Mind-authority-decision` prerequisite unmet |
| router-root | `router/` | compatibility | PARTIAL | execution-plans.ts and api.ts reference router/current.md as compatibility target |
| sources-root | `sources/` | compatibility | PARTIAL | vo-studio-fixtures.ts references /sources/ as fixture audio paths; independence unverified |
| wiki-log | `wiki/log.md` | compatibility | BLOCKED | mind-contract.ts reviewSurfaces includes it; `proposal-ledger-migration` prerequisite unmet |
| wiki-root | `wiki/` | compatibility | BLOCKED | wiki-health.ts actively reads wiki/; `scoped-exception-resolution` prerequisite unmet |

## Summary counts

| Verdict | Count | Notes |
|---|---|---|
| SAFE | 0 | No path has the complete structured proof chain plus explicit deletion approval and rollback expectations required for SAFE |
| PARTIAL | 2 | sources-root, router-root: explicit partial-condition markers; fail-closed for deletion |
| BLOCKED | 17 | 5 missing `approved-folder-cleanup` artifacts; 2 Graphify prerequisite-scope mismatches (graphify-compatibility-output is also governance-prohibited); 1 legacy-task-summary missing human-approved deletion ownership and rollback expectations; 2 active deployed n8n consumers; 5 unresolved scoped/Mind authority; 1 active consumer (wiki-root); 1 active dependency (wiki-log) |

## n8n override metadata treatment

`n8n-inbox-override-name` and `n8n-failed-override-name` are registry entries of
type `external-integration`, `lifecycleState: active`, `deployedState: definition-deployed`.
The live n8n workflow confirmed by B1.0a actively references these environment-variable
override expressions. An uninspected runtime value does not prove absence of an active
consumer when the deployed workflow expression is verified as deployed. Both entries
are therefore BLOCKED under the `active-consumer` condition. No new verdict type was
introduced; existing contracts were not modified; the existing BLOCKED path is correct.

## Validation

```text
63 focused tests pass (63/63): node --test tools/validate-deletion-readiness.test.mjs → pass
node tools/validate-deletion-readiness.mjs → deletion-readiness=blocked SAFE=0 PARTIAL=2 BLOCKED=17
JSON parse of deletion-readiness-evidence.json → ok
```

## What is needed to reach SAFE for currently-BLOCKED paths

`approved-folder-cleanup` paths (archive-root, capture-inbox, capture-failed, live-root,
numbered-roots): an explicit human-approved folder-cleanup artifact must be created and
cited per path before the prerequisite can be satisfied. No such artifact currently exists.

`legacy-task-summary` (`live/tasks.md`): M1.4 proves retirement and task-authority
migration only. SAFE requires a Brain artifact that explicitly records human-approved
deletion ownership and deletion rollback expectations for this exact literal. Neither
artifact exists, so retirement and non-authoritative status remain insufficient.

`graphify-operational-output` (`.graphify-out/`): the profile catalog governs
`runtime/local/graphify/...` output roots and explicitly excludes `.graphify-out/`
from the corpus. The `graphify-profile-conformance` prerequisite evidence carries
`appliesTo: ["runtime/local/graphify/brain-architecture", "runtime/local/graphify/mind-knowledge"]`
— a scope mismatch for `.graphify-out/`. Status=unresolved. Reaching SAFE requires
profile evidence that affirmatively covers the `.graphify-out/` compatibility root with
status=satisfied and appliesTo containing the exact registry literal, or a revised
registry entry acknowledging that no profile governs this path and replacing the
prerequisite with one that can be satisfied.

`graphify-compatibility-output` (`graphify-out/`): same profile scope mismatch
applies (appliesTo names only `runtime/local/graphify/...` roots). Additionally,
`graphify-transition-governance.json` explicitly prohibits deletion of `graphify-out/`
until three conditions are cleared: CBM adapter verified stable in production ≥7 days,
Mind semantic synthesis value assessment documented, and explicit Brain operations
approval. The `missingApproval` evidence field correctly expresses this governance
prohibition as a BLOCKED condition. Clearing the retention gate requires all three
conditions — policy existence alone does not satisfy the gate.

n8n override entries: the live n8n workflow must be updated or retired such that neither
override expression is actively deployed, before `noActiveConsumer` can be truthfully claimed.

PARTIAL paths require the same additional cleanup tasks documented in the evidence index.

BLOCKED wiki/scoped paths require Mind-authority-decisions documented outside Brain.

## Safety

```text
No file deleted, moved, or renamed.
No Mind content modified.
No scheduler activated.
No credentials accessed.
No external action performed.
No deployment or production mutation.
```
