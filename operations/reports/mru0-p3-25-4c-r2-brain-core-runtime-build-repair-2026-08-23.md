# MRU0-P3.25.4C-R2 Brain Core Runtime and Build Repair

**Status:** ACCEPTED for local compiled projection validation

## Supported runtime

Brain Core's supported local execution path is the compiled package runtime:

```text
cd projects/brain-core
npm run build
npm start
```

Development `tsx` execution remains a development convenience only. It is not the validation runtime because it reproduced sustained CPU and filesystem-read churn on the available Node runtimes. The repository's Node/TypeScript modules are Node 20-compatible; this validation used the installed Node runtime after compilation, with no provider calls.

## Root cause and repair

`projects/brain-core/tsconfig.json` used `rootDir: src` while imported repository-level `tools/*.mjs` files were part of the TypeScript program. Declaration/JavaScript emission therefore attempted to write generated `.d.mts` output over source `.mjs` inputs, producing TS5055.

The bounded repair changes the compiler boundary to the repository root and emits into a temporary `.build` tree. `scripts/flatten-dist.mjs` copies only the compiled Brain Core source subtree into the established `dist` layout, then removes the temporary build tree. Existing source tools remain source authorities and runtime-relative Brain paths remain valid. No API, projection, authority, or safety contract changed.

## Runtime evidence

Compiled `node dist/index.js` was run from `projects/brain-core` on an isolated local port. The process remained stable at approximately 0% CPU and 82 MB RSS during validation. These routes returned HTTP 200 with bounded responses:

- `/status`
- `/health`
- `/infinite-brain/status`
- `/projections/evolution`
- `/projections/promotion`

Repeated evolution and promotion requests completed without timeout on the isolated listener. The earlier 4877 failures were contaminated by a stale listener/process; the compiled runtime was validated on an isolated port to establish process ownership.

## Validation

Passing:

- `npm run build` with TS5055 eliminated;
- `npm run typecheck`;
- focused compiled Brain Core projection, envelope, and infrastructure endpoint tests;
- repeated compiled-runtime HTTP endpoint checks;
- documentation consistency validation;
- `git diff --check`.

The broad historical `npm test` suite completed with seven unrelated environment-sensitive failures in agent orchestration, cost-summary, and local-app runtime-report tests. Projection and runtime-boundary tests remained green; no implementation code in those unrelated areas was changed.

## Safety and limitations

The runtime remains read-only for these projections. No Mind writes, Brain canonical writes, provider calls, execution authority, remediation, scheduling, or Console integration were introduced. Port ownership must still be checked before starting a local instance; validation should use an isolated port when another local service owns 4877.
