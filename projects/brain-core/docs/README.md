# Brain Core Docs Index

**Status:** active index  
**Owner:** Steve Westhoek  
**Purpose:** distinguish current Brain Core direction from historical implementation records

## Current direction

Brain Core is the local API boundary and operational source of truth for machine/session/workflow state.

It should expose safe, machine-readable JSON surfaces to Brain Console and other local clients. It should not own canonical business strategy, render the dashboard UI, expose secrets, run broad shell commands, or mutate Mind without an explicit safe policy.

Canonical repo boundaries:

```text
brain/docs/repo-role.md
mind/wiki/system/repo-boundaries.md
```

Canonical ProChat OS strategy:

```text
mind/wiki/organisations/prochat/brand/prochat-os-strategy.md
```

## Current Brain Console boundary

Brain Console is the shared human control plane. It consumes Brain Core endpoints and visualizes health, readiness, approvals, local apps, runtime reports, and feature status.

Brain Console may show project/module surfaces such as Video Orchestrator, but the global console must not become a project-specific Studio product. Project-specific or historical VO Studio-heavy docs should not be used as the active console contract unless a newer active document explicitly reinstates them.

## Video Orchestrator lanes

Video Orchestrator has two separate lanes:

```text
Local Video Orchestrator = local development/control/readiness lane.
Cloud Video Orchestrator = AWS-backed media execution lane.
```

Brain Core may expose both lanes to Brain Console, but endpoint payloads, dashboard labels, implementation plans, and runbooks must identify whether they describe local readiness/control, cloud execution, or shared metadata/status.

## Historical archive docs

The following docs are implementation records or historical snapshots. They may contain useful details, but they are not the active global Brain Console contract when they conflict with the shared-only boundary:

```text
IMPLEMENTATION-PLAN-NEXT-PHASE.md
IMPLEMENTATION-COMPLETE.md
PHASE-10-11-SUMMARY.md
```

When using historical docs:

1. preserve their information as implementation history
2. do not treat superseded VO Studio-heavy dashboard direction as current
3. prefer current README and repo-role boundaries for new work
4. update references instead of deleting archives

## Documentation policy

Do not move, delete, or rename Brain Core docs just to make the structure cleaner. Assume references, links, and handoffs may exist.

When a document is superseded, mark it as historical and point to the active source of truth.
