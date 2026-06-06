# Brain Repo Role

**Status:** canonical brain-side boundary document  
**Owner:** Steve Westhoek  
**Last updated:** 2026-06-01  
**Scope:** `brain` repo, Brain Core, Brain Console, local/cloud runtime implementation docs

## Canonical relationship

```text
mind documents intent.
brain operationalizes intent.
Brain Core exposes operational truth.
Brain Console visualizes and controls through Brain Core.
```

The paired repo model is:

```text
mind  = private Steve/business memory
brain = AI/system/runtime operating layer
```

The canonical cross-repo constitution lives in the `mind` repo. From the `brain` repo root, the sibling-repo path is:

```text
../mind/wiki/system/repo-boundaries.md
```

## What this repo owns

The `brain` repo owns implementation-facing and runtime-facing work:

- AI/system/runtime operating layer
- system rules, skills, configs, and runbooks
- Brain Core API implementation and contracts
- Brain Console implementation
- local app orchestration
- capability registries
- execution readiness surfaces
- feature implementations
- machine-readable implementation records
- local and cloud operational documentation
- safe controlled action contracts

## What this repo does not own

The `brain` repo does not own canonical business strategy.

It must not contain a competing ProChat OS strategy, alternate product category, or duplicate public positioning canon.

Canonical ProChat OS business strategy lives in `mind`. From the `brain` repo root, the sibling-repo path is:

```text
../mind/wiki/organisations/prochat/brand/prochat-os-strategy.md
```

That strategy defines ProChat OS as an:

```text
Agentic Workflow OS
```

Brain-side ProChat OS documentation is allowed only when it serves an execution purpose: architecture, API, CLI, deployment, operational runbook, console surface, managed-service implementation, or implementation status.

## Brain Core role

Brain Core is the local API boundary and operational source of truth for machine/session/workflow state.

Brain Core owns:

- machine-readable API contracts
- runtime state surfaces
- health and capability endpoints
- sessions, skills, repos, and local app state
- approvals and audit surfaces
- execution readiness
- safe controlled action endpoints
- JSON payloads consumed by Brain Console and other local clients

Brain Core must not own:

- canonical business strategy
- UI rendering
- brand messaging
- broad shell execution
- direct secret exposure
- uncontrolled mutation of `mind`

## Brain Console role

Brain Console is the human control plane for Steve's computer.

Brain Console Center is the primary control-plane UI in `brain`. It keeps execution inside `brain` and consumes Brain Core API surfaces for all operational state and actions.

It owns:

- dashboard visualization
- operator review surfaces
- manual refresh and observability
- approval views
- controlled buttons that call Brain Core endpoints
- shared system health and readiness views
- feature visibility for local and cloud capabilities

Brain Console consumes Brain Core. It is not the source of truth itself.

Brain Console must not own:

- canonical strategy
- source-of-truth runtime data
- direct shell execution from browser UI
- secrets
- autonomous mutation outside approved Brain Core endpoints
- duplicated strategy from `mind`
- operational dependence on native Obsidian plugin lifecycle

## ProChat OS documentation rule

There is one ProChat OS strategy, and it lives in `mind`.

Brain-side ProChat OS documents must be framed as execution documents. They may say what must be implemented, exposed, packaged, deployed, monitored, or operated. They must not redefine the business category or positioning.

When in doubt:

```text
Strategy → mind
Execution → brain
API truth → Brain Core
UI truth → Brain Console
```

## Video Orchestrator implementation split

Video Orchestrator is a ProChat OS module with two distinct execution lanes:

```text
Local Video Orchestrator
Cloud Video Orchestrator
```

They may share workflow concepts, metadata contracts, approval patterns, and Brain Console visibility. They must not be mixed as one implementation.

### Local Video Orchestrator

The local lane is for local development, fixtures, readiness, operator visibility, dry-runs, and safe local workflow testing.

Local shortcuts such as local validation tooling do not automatically become production execution paths.

### Cloud Video Orchestrator

The cloud lane is the AWS-backed media execution path for generation, rendering, storage, transcoding, and long-running orchestration.

It owns cloud execution concerns such as Bedrock, Polly, Transcribe, Nova, MediaConvert, S3, Step Functions, Lambda, and related AWS job state.

### Brain Console visibility

Both lanes may be visible in Brain Console, but every surface must clearly identify whether it represents local capability, cloud capability, or shared metadata/status.

## Anti-drift rules

- Do not duplicate `mind` strategy in `brain`.
- Do not redefine ProChat OS category in `brain`.
- Do not treat Brain Console as the product.
- Do not treat Brain Core as the product.
- Do not treat Video Orchestrator as a separate platform.
- Do not mix local and cloud Video Orchestrator docs without naming the lane.
- Do not move, delete, or rename files unless references and links are updated and validated.
- Prefer archive labels, pointers, and index files over destructive cleanup.
