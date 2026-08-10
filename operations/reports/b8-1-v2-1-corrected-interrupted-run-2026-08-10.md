# B8.1 V2.1 corrected canonical run interruption — 2026-08-10

## Run identity

- Run ID: `b8-1-v2-1-corrected-20260810`
- Approved plan digest: `b0989d74accd1419802cb41712b9d52e57a1098c07dee524b193f36ebb628f02`
- Plan: `operations/reports/b8-1-v2-1-corrected-plan-2026-08-10.json`

## Disposition

The owner-authorized canonical executor was started once with the exact approved plan digest and run ID. Preflight completed successfully and materialized the canonical run directory. The synchronous Workbench command transport then cancelled the long-running process before repetition 1 completed.

Observed canonical run contents at interruption:

- `preflight-receipt.json`
- `r1/brain/`

No final canonical evidence or ACCEPTED/REJECTED disposition was produced. The run ID and approval are nevertheless consumed because the canonical run path exists and the executor's single-use contract rejects existing run paths.

This interrupted attempt MUST NOT be resumed or rerun under the same run ID. Its plan digest has been added to `KNOWN_STALE_DIGESTS`.

A fresh canonical plan/run ID may reuse the previously validated 5/5 V2.1 rehearsal only if the preparer independently confirms all bound implementation/provider/runtime identities remain current.
