# B8.1 Post-v7y Repair and v7z Readiness

**Date:** 2026-08-10
**Decision:** bounded repair validated; canonical v7z dry-run is ready for exact owner approval
**Execution authority:** none until that exact approval is supplied

## Proven `brain_f4` omission

Real isolated CBM v0.9.0 indexing against the pinned Brain source at commit
`f683edff753937944018dd00bf5494c85f62e881` proved the omission is a provider
fast-mode directory filter, not a missing source file, stale cache, or parser
failure. The fast index reported top-level `tools` in `excluded.dirs` and
contained no File or function node for
`tools/validate-deletion-readiness.mjs`. The same binary in full mode indexed
that file and its `main` function successfully.

The benchmark remains in its existing fast mode. Changing modes would alter the
resource and behavior contract and was not authorized by this tranche.

Diagnostics:

- fast-mode evidence:
  `/Users/Office/.brain/benchmark/b8-1/diagnostics/post-v7y-brain-f4-20260810/`;
- full-mode contrast:
  `/Users/Office/.brain/benchmark/b8-1/diagnostics/post-v7y-brain-f4-full-20260810/`.

## Scoring and evidence repair

Plan/executor contract `7.3.0` and evidence schema `3.2.0` now:

- count repository inventory through CBM graph File rows instead of bounded
  ranked search results;
- represent non-applicable line assertions as `null` and exclude them from the
  line-accuracy denominator;
- retrieve `json-pointer-set` values from CBM-indexed source and require exact
  set equality for a passing fixture outcome;
- derive caller and callee prediction sets from CBM `CALLS`, `USAGE`, and
  `IMPORTS` relationships, with one-to-one matching and all four
  precision/recall dimensions;
- compute caller/callee F1 only from real precision and recall evidence;
- require the applicable per-fixture CBM structural metrics and bind aggregate
  file, line, set, caller, callee, and F1 metrics back to fixture results;
- reject the consumed v7y digest as stale for any new execution.

Thresholds, source pins, subjects, partial-evidence policy, network isolation,
refresh probes, and Graphify exclusion are unchanged.

## Real-provider validation

The repaired production fixture path ran against fresh isolated CBM caches and
the pinned Brain and ProChat source archives. It was diagnostic validation, not
a canonical benchmark execution:

- `prochat_f2` passed with an inventory count of 27;
- `brain_f3` passed with the exact three-tool set and `setAccuracy=1`;
- `brain_f2` passed and emitted caller precision/recall of `1/1` and callee
  precision/recall of `0.25/1`;
- `brain_f4` failed honestly because the expected file is absent from the fast
  index, while still emitting all four structural metrics as zero.

Evidence:
`/Users/Office/.brain/benchmark/b8-1/diagnostics/post-v7y-executor-realpath-20260810/results.json`
(SHA-256
`57d9d476fbe4f928f9954f21a6b90736b8bc467ae3366277fcd980a89612f808`).
Graphify was not invoked. The complete B8.1 test group passed 191/191 under Node
v20.20.2.

## Canonical v7z dry-run

The fresh non-materializing preflight passed with zero blockers:

- plan: `operations/reports/b8-1-canonical-plan-v7z-2026-08-10.json`;
- receipt: `operations/reports/b8-1-dry-run-receipt-v7z-2026-08-10.json`;
- run ID: `b8-1-canonical-authorization-20260810-final-v7z`;
- plan SHA-256:
  `02971f6e644b004094ec6b60015ad3a5c379b63c25b14ea292ce425a5618dcbf`;
- Node: `v20.20.2`, SHA-256
  `38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`;
- subjects: `cbm,exact-source`; Graphify excluded; partial evidence accepted.

No v7z run directory exists. The plan has not been materialized or executed.
The next action requires exact owner approval of this run ID, digest, Node
identity, subject set, Graphify exclusion, and partial-evidence state.
