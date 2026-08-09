# B8.1 Refresh-Target Repair and v7y Readiness

**Date:** 2026-08-09
**Decision:** repair validated; canonical v7y dry-run is ready for exact owner approval
**Execution authority:** none until that approval is supplied

## Proven v7x root cause

The v7x incremental-refresh harness selected the first lexicographic `.ts` or
`.js` file in each disposable source tree. That filesystem-order heuristic was
not bound to the benchmark manifest and selected files that CBM legitimately
excluded from its index for Brain and Workbench. The actual Brain target under
the v7x implementation was
`ai/skills/vendors/gstack/bin/gstack-global-discover.ts`; the earlier working
hypothesis named a different arbitrary file. Workbench selected
`apps/web/next-env.d.ts`. ProChat selected `newrelic.js`, which happened to be
indexed and therefore masked the harness defect there.

An isolated real-provider comparison proved the diagnosis. The arbitrary
Brain and Workbench targets could not expose their markers, while the first
manifest-admitted code fixtures did so under the same CBM binary, source
snapshots, cache isolation, and network-deny sandbox:

- Brain: `projects/brain-core/src/mind-paths.ts`;
- Workbench: `packages/mcp/src/configure-core.ts`;
- ProChat: `src/app/layout.tsx`.

The first diagnostic is preserved at
`/Users/Office/.brain/benchmark/b8-1/diagnostics/b8-1-target-selection-20260809-v1/results.json`
with SHA-256
`d33675ae46026e1fea32e199f35eaac6257b19d5bc468305c486c6f1e638a13e`.

## Repair contract

Plan/executor contract `7.2.0` and evidence schema `3.1.0` now:

- derive one refresh probe per repository from manifest order and an admitted
  code-file extension, never from filesystem traversal;
- reject missing, absolute, non-normalized, traversal, unsupported-extension,
  non-file, and symlink targets;
- record the repository-relative target in CBM repository metrics and require
  the evidence validator to bind it back to the manifest;
- retain exact-source typed not-applicable evidence;
- restore source bytes in all paths, reindex the restored source, and require
  the exact marker to disappear;
- include restoration reindex/query children in aggregate resource metrics;
- attempt repository refresh setup once and propagate a failed setup to the
  remaining fixtures without repeating it.

Graphify behavior, source pins, subjects, partial-evidence policy, network
isolation, and acceptance thresholds are unchanged.

## Real-provider validation

The repaired primitive ran three times for each repository against fresh copies
of the immutable v7x disposable source snapshots. All 9/9 cases passed marker
visibility, exact target binding, byte-identical target and repository
restoration, restored-index refresh, marker disappearance, attributable cache
growth, and process cleanup. No marker or CBM process remained.

Evidence:
`/Users/Office/.brain/benchmark/b8-1/diagnostics/b8-1-repaired-refresh-20260809-v4/results.json`
(SHA-256
`c51b32ea282fb3a277f46f8b901bf80ab0c0e0e16e07c79fb6f8e8de0a32d5ab`).

The diagnostic also exposes a separate acceptance risk rather than hiding it:

- Brain initial-index RSS was 426.84–553.73 MB and peaked above the 512 MB threshold;
- Brain incremental refresh was 1,250–1,370 ms, above 500 ms;
- Workbench incremental refresh was 530–630 ms, above 500 ms;
- ProChat incremental refresh was 220 ms.

These observations do not invalidate the target-selection repair. They do mean
a canonical execution may produce valid evidence that still rejects CBM on
resource thresholds.

## Canonical v7y dry-run

The fresh non-materializing preflight passed with zero blockers:

- plan: `operations/reports/b8-1-canonical-plan-v7y-2026-08-09.json`;
- receipt: `operations/reports/b8-1-dry-run-receipt-v7y-2026-08-09.json`;
- run ID: `b8-1-canonical-authorization-20260809-final-v7y`;
- plan SHA-256:
  `57156d49e4f3ab273efb791dc3e4e128a839ba10552b860ab3219ae58e8bd1d1`;
- Node: `v20.20.2`, SHA-256
  `38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`;
- subjects: `cbm,exact-source`; Graphify excluded; partial evidence accepted.

No v7y run directory exists. The plan has not been materialized or executed.
The next action requires the owner to approve this exact run ID, digest, Node
identity, subject set, Graphify exclusion, and partial-evidence state.
