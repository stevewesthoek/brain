# Brain and Workbench Development Assessment

**Date:** 2026-07-15  
**Scope:** Brain Infinite Brain roadmap and implementation plan; Workbench
product roadmap, implementation cards, controlled n8n migration plan, provider
code, release tooling, and the Brain-to-Workbench MCP boundary.  
**Bridge verdict:** `RUNTIME_READY_FOR_B1_0A` — provider admitted; guarded live
B1.0a execution not started.  
**Release verdict:** implementation and release tooling are ready for an exact
release commit, but no public snapshot, tag, push, or publication was performed.

## Executive assessment

The correct ownership direction is Brain -> admitted Workbench provider, never
Workbench -> Brain feature injection. Workbench owns its product logic,
authentication, grants, command contracts, side effects, operation ledger, and
audit evidence. Brain owns whether that provider is admitted at all, the exact
tools and nested command kinds it may expose, the provider revision and file
digests, project-scoped registration generation, drift rejection, and
revocation. The MCP adapter is transport-only and does not duplicate policy.

This boundary is now implemented as a reusable provider-admission contract.
Brain admits one Workbench stdio provider with this exact surface:

- `getWorkbenchStatus`
- `readWorkbenchContext`
- `runWorkbenchCommand`, restricted to `n8n_workflow_migration`

All other Workbench MCP tools and command kinds remain outside Brain's admitted
surface. The previous B1.0a-specific MCP source remains present for evidence and
rollback compatibility but is disabled. Provider drift, an unapproved tool,
an unapproved nested command kind, an invalid grant set, an invalid credential,
or an invalid audit store fails closed.

## Brain development position

| Area | Assessed position | Incomplete or constrained work |
|---|---|---|
| Stabilization BS0.1-BS0.15 | BS0.1-BS0.9 and BS0.11-BS0.15 are complete. | BS0.10 remains blocked on the Mind M1.4 task-authority decision. |
| Stabilization BS0.16-BS0.23 | BS0.16 is the next normal Brain implementation task. | The layered conformance suite, exact-scope approval semantics, typed workers, deletion readiness, retrieval corpus/schema/core, and thin retrieval adapters remain planned. This MCP admission work supplies a concrete exact-scope pattern but does not falsely complete those broader tasks. |
| Save-to-Mind B1 | B1.0, B1.0b-d, B1.0f, and B1.5 are complete. The Workbench bridge needed by B1.0a is admitted and runtime-ready. | B1.0e remains the documented blocked outcome that led to the controlled migration. B1.0a has not run its prepare/execute/status, n8n, webhook, fixture, deployment, or rollback sequence. |
| Context Gateway B2 and evaluation B3 | Roadmap and task boundaries exist. | The B2.1-B2.8 dependency-free core and adapters and B3.1-B3.4 evaluation work remain implementation work. |
| Capability truth B4 | Capability-state and generated-manifest foundations exist through BS0.12-BS0.13. | The original B4 task sequence is not claimed complete; reconcile it with the stabilization artifacts when its lane begins. |
| Governed action B5, pilot B6, hardening B7 | Planned with explicit prerequisites. | These lanes remain substantially unimplemented and must follow their gates rather than being inferred from this bridge. |

## Workbench development position

| Area | Assessed position | Incomplete or constrained work |
|---|---|---|
| Product phases 1-9 | Implemented baseline with recorded tests and evidence. | A live Custom GPT acceptance test remains required before an unrestricted public-release claim. |
| Phase 10 release hardening | Engineering closure and zero-High/Critical gate are complete; the public export allowlist and verifier now include the MCP and controlled-migration dependency closure. | The dirty worktree is not an exact release commit. Snapshot generation, tag, push, and publication remain unexecuted. One accepted Moderate transitive PostCSS advisory remains documented. |
| Phases 11-17 | Roadmap and implementation cards exist. | Performance, scheduling, run metadata, workspace hardening, eventing, policy levels, and richer execution remain queued. |
| Phase 18 / R18.6 | The controlled n8n migration vertical slice and CWFM-01-CWFM-20 readiness gates are complete. Runtime verdict is `RUNTIME_READY_FOR_B1_0A`. | The live B1.0a operation is intentionally separate and unexecuted. Other Phase 18 capabilities remain governed by their own cards. |
| Phases 19-22 | Planned. | Managed capabilities, delegated subagents, governed developer loop, and the general MCP client broker remain queued. |
| Phase 23 MCP server | A narrow, authenticated, policy-preserving local stdio vertical slice is implemented and admitted by Brain. | Phase 23 is not complete. Full ordered parity, broader safe capability coverage, and the remaining R23.5 external-client parity exit condition still require later work. |
| Phase 24 | Planned. | Cross-device and managed control-plane work remains queued. |

## Defects and half-finished boundaries corrected

1. A grant file containing both valid and invalid entries could previously
   admit the valid subset. Grant loading now fails closed on any issue.
2. Brain could execute a mutable provider without a provider revision and
   content attestation. Admission now binds the Git revision and exact file
   SHA-256 digests and can validate the provider root before registration.
3. The legacy B1.0a-specific MCP remained active alongside the general
   provider. It is now disabled rather than deleted.
4. The derived MCP credential could cross the relay boundary. It is now
   direct-agent-only; relay attempts are rejected before forwarding.
5. MCP configuration backup and rollback targeted the wrong configuration
   boundary. Project configuration is now backed up and restored atomically,
   while the global configuration is asserted unchanged.
6. Public export did not contain the MCP package and its full shared dependency
   closure. The allowlist and verifier now enforce that closure.
7. MCP registration used a machine-specific Node path. Registration now
   resolves and validates the actual executable.
8. CLI migration modules imported Shared source files directly. That caused
   TypeScript to emit a second stale CLI tree that the launcher did not use.
   Imports now use `@workbench/shared`, and a structural verifier forbids the
   regression.
9. Audit corruption could be interpreted as an empty store and overwritten.
   Audit load, append, rotation, and persistence now fail closed and use atomic
   file replacement with restrictive permissions.
10. Lite source reads paid unnecessary Git-hydration cost. The bounded MCP read
    path now reuses reconciled source state and skips fresh Git metadata.

## Verification evidence

- Workbench aggregate tests, type checks, lint, MCP protocol tests, auth tests,
  controlled-migration verifiers, package-boundary verifier, public-export
  tests, and public-scope verification passed. Lint retained three documented
  React hook warnings and no new lint failure.
- Brain provider-admission unit tests, live provider-root digest validation,
  generated project-registration check, capability-state validation, contract
  registry validation, and whitespace checks passed.
- The detached Workbench runtime was restarted after the package-boundary fix
  and reported healthy agent, web, and source services at version
  `1.3.1-beta`.
- Authenticated MCP status including source state succeeded. Repeated loopback
  source-list requests completed in approximately 1-2 ms after the hydration
  correction.
- The already-running Codex task predates the generated scoped registration.
  Offline protocol tests prove the three-tool listing; a fresh Brain Codex task
  is required to prove that the desktop client loaded that registration.

## Controlled next actions

1. Open a fresh Brain Codex task and verify that the loaded Workbench provider
   lists exactly the three admitted tools and denies every other tool and
   command kind.
2. If B1.0a live execution is desired, grant separate explicit approval for the
   existing guarded prepare -> approve -> execute -> status/readback sequence.
   Do not combine that approval with release publication.
3. Create an exact Workbench release commit from an explicit allowlist, then
   generate and validate the public snapshot from that committed state.
4. Treat tag, push, and public publication as another explicit external-state
   action after the release checklist is current and passing.
5. Resume Brain at BS0.16 and Workbench at their documented ordered lanes;
   neither repository should infer broader completion from this narrow bridge.

