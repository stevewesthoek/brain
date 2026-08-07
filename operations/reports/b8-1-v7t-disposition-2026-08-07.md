# B8.1 v7t Disposition — 2026-08-07

## Status
**STALE / NON-REUSABLE** — Historical record only. Do not execute or materialize.

## Summary
v7t (run ID: `b8-1-canonical-authorization-20260807-final-v7t`) produced valid canonical output but **violated the required Node 20 runtime binding**.

- **Plan digest:** `1c0892469683acba82534d3cd7c3f27aae9368a54a5a5fe49989de13aca067e4`
- **Generated with:** Node v25.9.0 (noncompliant)
- **Receipt version:** 7.1.0
- **All 13 checks pass** (Graphify excluded per spec)
- **Receipt status:** `executionReady=true`

## Why Superseded
The authorization framework requires explicit Node 20 binding. v7t was generated on Node 25, which violated this stop condition:

```
That v7t digest violated the required Node 20 stop condition
and must not be approved/executed.
```

This is a **runtime mismatch**, not a plan defect. The plan itself is valid and reproducible on Node 20.

## Artifacts Preserved (History)
- `b8-1-canonical-plan-v7t-2026-08-07.json` (11.8 KB)
- `b8-1-dry-run-receipt-v7t-2026-08-07.json` (4.2 KB)
- `b8-1-v7t-disposition-2026-08-07.md` (this file)

## Next Step
v7u (Node 20 binding) is canonical approvable. See `b8-1-canonical-authorization-20260807-final-v7u` in the same directory.

---
**Disposition Date:** 2026-08-07 09:15 UTC  
**Reason:** Runtime binding compliance  
**Authority:** B8.1 canonical authorization policy
