# MRU0-P3.25.4C Evolution and Promotion Projection Runtime Repair

**Status:** NEEDS REPAIR

## Scope

This packet investigated the timeout behavior of:

- `GET /projections/evolution`
- `GET /projections/promotion`

The source adapter and route remain read-only derived projections. No authority, storage, workflow, or Brain Console changes were made.

## Root-cause evidence

The direct adapter invocation completes in approximately 1 ms against the current empty runtime-local state. The route unit tests also complete successfully. Runtime HTTP behavior is different: after projection traffic, the TypeScript-launched Brain Core process enters sustained approximately 99% CPU and large memory growth in the transpiler/runtime read loop. Subsequent requests intermittently time out even though the listener remains present.

The failure reproduced with:

- `npm run dev` / `tsx watch` using system Node 25.9.0;
- direct `tsx` execution;
- the bundled workspace Node 24.19.0;
- non-watch `tsx` loader execution.

The temporary esbuild bundle was not a valid replacement runtime because Brain Core has cwd-sensitive canonical path loading and the temporary bundle failed closed before serving when launched outside the expected layout.

The repository build path is independently blocked by the known TS5055 collision where TypeScript attempts to emit `.d.mts` files over source `.mjs` files under `tools/`. Generated untracked `.d.mts` artifacts from this check were removed; no user files were reset or cleaned.

## Repair performed

No application source repair was applied because the evidence does not identify a safe projection-logic defect. The bounded runtime action was to stop the stale supervised feature runtime and run the canonical main runtime; that corrected repository ownership but did not eliminate the transpiler/runtime churn.

## Validation

Passing:

- direct evolution adapter and route tests;
- Brain Core typecheck;
- focused projection/envelope tests: 12/12;
- documentation consistency validation.

Insufficient/failed:

- repeated live HTTP response-time validation for both endpoints;
- production-style `npm start`, because `npm run build` is blocked by TS5055;
- stable long-lived local Brain Core process under the available TypeScript runtime wrappers.

## Safety

Preserved:

- read-only projection behavior;
- provenance and envelope validation;
- no Mind writes;
- no Brain canonical writes;
- no automatic promotion or decisions;
- no provider calls;
- canonical main runtime ownership;
- untouched Video Orchestrator worktree.

## Next bounded action

Resolve the Brain Core local runtime/build boundary first: establish a supported Node/TypeScript execution path that does not enter the observed loader/read loop and repair the existing TS5055 build collision in a separately authorized maintenance packet. Then repeat live endpoint timing and envelope validation before Console projection integration.
