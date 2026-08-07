# B8.1 Noncanonical v7s Disposition — 2026-08-07

**Date:** 2026-08-07  
**Status:** Archived as noncanonical historical artifact  
**v7s Digest:** `90ef52be30be8db5f2df34d04ba8c07f7e16d32798f131c741d627b3f60bcc66` (marked stale)

## Summary

The v7s dry-run artifacts committed at `ad83a283` were hand-simplified and incomplete, never executable. They lacked:
- Complete `implementationIdentity` with all executor/validator hashes
- Real `sourceStateHash` (used placeholder `"treeSha-not-materialized"`)
- Only 5 checks instead of 13; missing source-state-binding
- `receiptVersion=1.0.0` instead of canonical `7.1.0`
- `executionReady=false` instead of `true`

These artifacts were committed to preserve the v7r failure record and mark it resolved, but they were never canonical CLI outputs.

## Canonical Replacement

v7t (digest `1c0892469683acba82534d3cd7c3f27aae9368a54a5a5fe49989de13aca067e4`) is the real canonical contract generated via CLI with explicit source roots:
- Full implementationIdentity with all component hashes
- Real sourceStateHash: `sha256:a0af2027907af240ffc93f12ff8fe842a5405e9b0b894055acd9ac9bc64bb643`
- All 13 checks pass, including source-state-binding
- `receiptVersion=7.1.0`, `executionReady=true`

## Immutability

v7s artifacts remain in git history and are not deleted. The digest `90ef52be...bcc66` is now marked as stale in `tools/lib/b8-1-plan-digest.mjs` to prevent any attempt to reuse them.

**Status:** Closed. v7t is sole approvable contract.
