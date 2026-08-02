# B1.5 — Mind Steward package boundary

**Status:** complete (2026-07-14)  
**Decision:** outcome B — retain Mind Steward's unique local deterministic
services; use the dependency-safe Brain-owned canonical path resolver for
shared path and policy resolution. No package is deleted or moved.

## Evidence-led boundary decision

There are no imports from `projects/mind-steward/` to
`projects/brain-core/`, nor from Brain Core back to Mind Steward. Mind Steward
is a local TypeScript package with its own classifier, fixture-oriented
dry-run report, preview presentation, wiki health, maintenance-preview queue,
and CLI wrappers. Brain Core separately owns the HTTP/API surface, proposal
and approval adapters, maintenance-pilot runner, scheduler views, and
contained write boundary.

Making Mind Steward a thin Brain Core adapter (outcome A) would import the
large Brain Core dependency surface into its local CLI work, add an unnecessary
runtime/API dependency, and blur its fixture-safe report-only boundary. It is
therefore higher complexity. The duplicated responsibility is limited to path
and policy resolution; the canonical owner is already the Brain-owned
`operations/specs/infinite-brain-path-registry.json` plus
`tools/mind-canonical-path-registry.mjs`.

## Dependency graph

```text
Mind policy documents (normative meaning, read-only)
                 │
                 ▼
Brain path registry + canonical resolver (one executable owner)
       ┌─────────┴─────────┐
       ▼                   ▼
Mind Steward            Brain Core
local classifier        API / adapters / validators
reports and previews    scheduler and approval boundaries
CLI presentation        downstream API consumers
       │                   │
       └── no package imports or circular dependency ──┘
```

Mind Steward's classifier makes local model-selection requests only when the
caller runs it; the decision introduces no Brain HTTP API dependency and no
new runtime invocation. Scheduler consumers remain Brain Core / external
wrappers, while Mind Steward remains a local CLI presentation package.

## Canonical owners

| Concern | Canonical owner | Consumer boundary |
|---|---|---|
| Path resolution and path policy | Brain path registry and resolver | Both packages, beginning BS0.8/BS0.9 |
| Capture classification | Mind Steward | Brain Core normalizes review outputs only |
| Proposal generation | Brain Core adapters | Mind Steward does not select durable destinations |
| Preview / approval enforcement | Brain Core approval model; Mind Steward presents report-only previews | Existing exact-approval work remains BS0.17 |
| Report generation | Mind Steward local dry-run report; Brain Core maintenance/runtime reports | Separate schemas and consumers |
| CLI presentation | Mind Steward | No Brain Core HTTP dependency |

## Migration and deprecation plan

1. BS0.8 adds a small typed Mind Steward bridge to the existing Brain resolver
   and removes Mind Steward's active hard-coded path policy. Compatibility
   reads must remain registry-listed and read-only.
2. BS0.9 moves Brain Core consumers to the same resolver and retains only
   explicitly registered compatibility readers.
3. No service is deprecated or removed in this task. Any later retirement
   requires consumer evidence and deletion-readiness gates; B1.0a and M1.4
   remain unchanged prerequisites.

## Parity and safety evidence

```text
npm --prefix projects/mind-steward run typecheck
# pass
npm --prefix projects/brain-core run typecheck
# pass

tsx --test Mind Steward report, preview, classifier, and CLI fixtures
# 24 pass

tsx --test Brain Core mutable-capability-containment fixture
# 7 pass
```

The fixtures use temporary roots and mocked `fetch`; no Mind content, live
n8n, deployment, credential, webhook, schedule, or external endpoint was
accessed. Dry-run/report-only defaults and the explicit apply gate remain
unchanged. No circular package dependency or duplicate canonical registry was
found.

## Continuation decision

No Critical or High ownership ambiguity remains: the only shared policy is
the registry, and Brain owns its executable interpretation. **B1.5 is
complete; BS0.8 may begin.**
