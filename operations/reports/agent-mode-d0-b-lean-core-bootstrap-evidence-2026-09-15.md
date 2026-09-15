# Agent Mode D0-B Lean-Core Bootstrap Evidence — 2026-09-15

## Decision

D0-B is **COMPLETE**. D0 remains **IN PROGRESS**. This slice adds a
read-only, deterministic `brain-bootstrap-plan-v1` contract and the CLI seam
`brain-agent bootstrap plan --dry-run`. It does not install, stage, launch, or
register anything.

## Reconciled starting state

- Starting HEAD: `bb37c60e feat(agent-mode): add portable runtime configuration`.
- D0-A is landed and its evidence/report, strict runtime loader, CLI validation,
  and package engine declarations are present.
- K0-K5, U0, and V0 remain closed; no BrainNode implementation was reopened.
- The protected working-tree paths were not edited, staged, or committed:
  `tools/firecrawl/logs/firecrawl.log`,
  `operations/specs/mindcontrol-product-roadmap.md`, and
  `operations/specs/nevermind-release-pipeline-roadmap.md`.

## Runtime and package contract

The observed local toolchain was Node `v25.9.0` and npm `11.12.1`. The
repository contract is Node `>=22.5.0` and npm `>=10.0.0`, declared in both
Core and Console package manifests and lockfile roots. Each package retains its
locked workflow: `npm ci`, then `npm run build`. D0-B describes those commands
as typed plan actions; it never invokes `npm ci` or package installation.

The planner supports two explicit provenance modes: source-development may
derive a local Git revision, while packaged-release requires/records supplied
release-manifest revision material. No release archive or package artifact is
invented. Optional staging is honestly **not implemented** in this slice.

## Plan contract and bounds

`projects/brain-core/src/agent-mode/bootstrap-plan.ts` defines the strongly
typed `brain-bootstrap-plan-v1` plan. It contains bounded platform/runtime
prerequisites, source provenance, installation/state layout, fixed component
manifest, package/build/smoke actions, startup commands, warnings, rollback
metadata, and service status. The component manifest is:

- required: `brain-core`, `brain-console`;
- optional: `brain-node`, `voice-stt`, `bedrock`;
- client capability: `browser-tts`;
- excluded: `personal-integrations`.

The plan has a maximum of 32 actions and 32 warnings. Core and Console are
the only package-command owners, and commands are closed to `npm ci` and
`npm run build`; no shell strings, model/provider choice, credentials,
capability grants, AWS account, BrainNode command, or personal path is plan
authority. Startup is a future Core `node dist/index.js` and Console
`npm run start` description. The service plan is explicitly
`not-installed`; registration and start are false. Rollback is
`none-for-dry-run`/no-op because no mutation occurs.

Mutable StateStore paths are separate from source and installation roots.
Critical paths are absolute or `~/`-relative, reject traversal, `.git`,
`node_modules`, and device paths; installation roots additionally reject
protected system roots. Existing targets are classified as fresh,
existing-compatible, or existing-unknown, and packaged source/install
conflicts fail closed. No overwrite is permitted.

Secret handoff is presence-only: the planner can report that externally
managed service/operator secrets are configured or missing, but never reads,
prints, persists, or places secret values in a plan. Profile/template
selection is through the existing portable runtime configuration loader.

## Determinism and side-effect audit

The plan ID is SHA-256 over canonical immutable plan material. With identical
explicit source/install/config/runtime/revision inputs, the ID and serialized
JSON are identical. The dry-run CLI was built and executed against a fake
source fixture with explicit versions; it emitted nine bounded actions and
`servicePlan.status = not-installed`, while the nonexistent installation root
remained nonexistent.

Planner inspection uses only local filesystem metadata and bounded structured
`git -C ... rev-parse HEAD` / `npm --version` probes when values are not
explicitly supplied. It performs no network request, package install, staging,
StateStore write, service registration/start, scheduler mutation, runtime
launch, BrainNode operation, Workcell operation, provider/model call, AWS,
SSH, or Tailscale action. Temporary HOME values preserve equivalent semantics;
fake installation roots and explicit source roots do not depend on repository
cwd. Relative critical paths fail closed. Existing unknown installation
markers remain byte-for-byte untouched.

## Validation

- D0-B focused planner tests: **6/6 passed**.
- D0-A portable runtime tests: **9/9 passed** before/alongside this slice.
- Core typecheck: **passed**.
- Core build: **passed**.
- CLI dry-run smoke: **passed** (version, nine actions, no target creation).
- `git diff --check`: **passed**.
- No Brain Console source changed; its existing validation surface remains
  unaffected by this Core-only implementation. Package engine metadata was
  updated for the documented shared toolchain contract.
- Full post-change Core suite: run after the scoped review/commit gate; any
  historical unrelated timing failures will be reported separately rather
  than repaired in D0-B.

## Existing Office compatibility

This is a plan-only seam. It does not inspect or alter Office services,
launchd/systemd registration, ports, AWS/Tailscale/SSH state, personal
integrations, or the existing runtime database. It therefore preserves the
Office installation while making the future target layout explicit.

## Security and scope review

The new contract has no raw environment dump, secret field, provider payload,
prompt, reasoning, runtime output, credential path, or arbitrary executable.
No installer executor, service controller, package staging, release archive,
or rollback mutator was added. The only source change outside the new planner,
CLI, manifests, tests, and D0 documentation is the D0-A-compatible strict
rejection of relative critical runtime paths.

## Remaining roadmap

D0 remains in progress because real packaging, explicit staging/install,
service registration, optional VPS/Tailscale deployment, and release/H0 gates
are not part of D0-B. The exact next bounded task is **D0-C — Portable Runtime
Packaging Contract**. It is not started automatically.
