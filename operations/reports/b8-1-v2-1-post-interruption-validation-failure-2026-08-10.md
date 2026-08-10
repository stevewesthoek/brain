# B8.1 V2.1 post-interruption canonical validation failure — 2026-08-10

## Run identity

- Run ID: `b8-1-v2-1-post-interruption-20260810`
- Approved plan digest: `6f78fb9714cc3254751ec260f40cd9d8a7320600758af9209526a3b5247e42d2`
- Plan: `operations/reports/b8-1-v2-1-post-interruption-plan-2026-08-10.json`

## Execution outcome

The canonical benchmark executed all five repetitions successfully under the approved Node/provider/sandbox identities. `buildGates()` produced `ACCEPTED` before evidence validation.

Canonical validation then failed pre-cleanup with these exact errors:

- run 1–5: `allGatesPassed mismatch`
- Brain/Workbench/ProChat fallback probe not bound to unindexed coverage
- `cbm:prochat_f3: invalid target rank`
- acceptance summary mismatch or gate failure
- cleanup incomplete (expected pre-cleanup state)

The failures are evidence-construction/validator-semantics defects, not provider benchmark gate failures:

1. the validator still reapplied file/line/MRR/F1 quality per repository instead of per-run aggregate semantics used by `buildGates()`;
2. fallback probes were emitted separately but not linked back to `coverageEvidence.fallbackFixtureIds`;
3. an indexed fixture missed from bounded ranked results was incorrectly required to have a non-null rank instead of contributing zero MRR.

The run ID is consumed and MUST NOT be resumed or rerun. The plan digest is in `KNOWN_STALE_DIGESTS`. The canonical run directory and its raw evidence remain preserved for historical diagnosis until a later explicit cleanup decision.
