# ProChat OS — Brain Implementation Context

**Status:** execution-facing implementation context  
**Owner:** Steve Westhoek  
**Last updated:** 2026-06-01  
**Scope:** `brain` repo implementation, Brain Core, Brain Console, CLI, managed-service, and runtime documentation

## Canonical strategy pointer

This file is not the canonical ProChat OS business strategy.

There is one canonical ProChat OS strategy, and it lives in the `mind` repo. From the `brain` repo root, the sibling-repo path is:

```text
../mind/wiki/organisations/prochat/brand/prochat-os-strategy.md
```

That document defines ProChat OS as an:

```text
Agentic Workflow OS
```

The cross-repo constitution lives in the `mind` repo. From the `brain` repo root, the sibling-repo path is:

```text
../mind/wiki/system/repo-boundaries.md
```

Brain-side ProChat OS documentation must be execution-facing. It may describe what needs to be implemented, exposed, packaged, deployed, monitored, or operated. It must not redefine ProChat OS strategy, category, public positioning, or business direction.

## Working implementation summary

For implementation purposes, ProChat OS is treated in this repo as:

```text
an installable private Agentic Workflow OS runtime with memory, connectors, model routing, workflows, approvals, logs, CLI, Brain Core API surfaces, and Brain Console visibility.
```

This wording is only an implementation summary of the Mind strategy. If this file conflicts with `mind/wiki/organisations/prochat/brand/prochat-os-strategy.md`, the Mind strategy wins.

## Repo model

The private development pattern is:

```text
mind  = private Steve/business memory
brain = AI/system/runtime operating layer
```

The current private repos are paired parts of the internal operating system, but they should not be merged and should not be published as-is.

For a public or customer-facing product release, extract sanitized product code and templates. Do not publish Steve's private `mind` or `brain` repos directly.

## What belongs in `mind`

`mind` owns:

- private human memory
- business memory
- organization context
- ProChat OS business strategy
- brand direction
- public positioning
- go-to-market direction
- high-level roadmaps and phase intent
- project context and decisions
- canonical prose strategy

`mind` is also the prototype pattern for customer memory/context. That means ProChat OS learns from its structure, not that customers install Steve's private `mind` repo.

## What belongs in `brain`

`brain` owns implementation-facing and runtime-facing work:

- system rules, skills, configs, and runbooks
- Brain Core API implementation and contracts
- Brain Console implementation
- local app orchestration
- capability registries
- execution readiness surfaces
- feature implementations
- machine-readable implementation records
- operational safety boundaries
- local and cloud runtime documentation

## Brain Core implementation role

Brain Core is the local API boundary and operational source of truth for machine/session/workflow state.

Brain Core exposes JSON surfaces for:

- status
- capabilities
- sessions
- skills
- repos
- approvals
- audit surfaces
- local apps
- orchestrators
- runtime reports
- execution readiness
- safe controlled actions

Brain Core must not become a strategy document, dashboard renderer, broad shell executor, or secret exposure surface.

## Brain Console implementation role

Brain Console is the human control plane. Brain Console Center is the canonical implementation path in the `brain` repo.

Brain Console consumes Brain Core and visualizes/control surfaces through approved API endpoints. It should not read or mutate repo files directly from the browser. Brain Core remains the API boundary for operational truth, approvals, auditability, safety checks, and controlled actions.

Brain Console Center may show:

- system health
- readiness
- approvals
- local apps
- agents
- memory/status surfaces
- Video Orchestrator local lane
- Video Orchestrator cloud lane
- controlled actions where Brain Core explicitly permits them

The first Brain Console Center migration target is the AWS Video operational dashboard only. Do not migrate every legacy dashboard surface before the video workflow is proven.

Brain Console must not be treated as the product itself, and it must not duplicate canonical strategy from `mind`.

## Productization target

A sanitized public/customer product may eventually be extracted into a structure like:

```text
prochat-os/
  core/              workflow runtime and API
  memory/            customer memory/context store
  connectors/        input/output integrations
  router/            model selector and provider routing
  console/           command center and approvals
  cli/               install, configure, update, support commands
  modules/           optional workflow blocks
  docs/              public customer documentation
  examples/          sanitized examples
```

The public/customer product must not include:

- personal notes
- private business strategy not intended for customers
- secrets
- machine-local state
- private session logs
- customer data
- repo-specific credentials

## Brain-side documentation allowed here

Allowed Brain documentation:

- implementation plans
- API contracts
- CLI plans
- managed-service plans
- deployment plans
- operational runbooks
- Brain Console surface specs
- Brain Core endpoint docs
- local/cloud runtime state docs
- historical implementation records clearly marked as archived

Not allowed Brain documentation:

- competing ProChat OS strategy definitions
- alternate product categories
- duplicate public positioning canon
- copied long-form Mind strategy
- outdated strategy without archive labels or pointers

## Video Orchestrator implementation split

Video Orchestrator is a ProChat OS module with two separate execution lanes:

```text
Local Video Orchestrator
Cloud Video Orchestrator
```

Both lanes may be available in Brain Console, but they must be labeled and documented separately.

### Local Video Orchestrator

The local lane is for:

- local development
- local fixtures
- local readiness checks
- operator visibility
- safe dry-runs
- local workflow validation
- local runtime reports exposed through Brain Core

Local tooling may be used to validate concepts, but local shortcuts are not automatically the production media execution path.

### Cloud Video Orchestrator

The cloud lane is the AWS-backed media execution path for:

- generation
- rendering
- storage
- transcoding
- long-running orchestration
- cloud job state
- exported media assets

Cloud execution may involve Bedrock, Polly, Transcribe, Nova, MediaConvert, S3, Step Functions, Lambda, and related AWS infrastructure.

### Shared concepts

The two lanes may share:

- ProChat OS workflow concepts
- metadata contracts where explicitly shared
- approval gates
- template concepts
- status visibility in Brain Console
- implementation links

They must not share ambiguous documentation that hides whether a feature belongs to the local lane or the cloud lane.

## Drift rule

When documents conflict:

```text
Strategy → mind
Execution → brain
API truth → Brain Core
UI truth → Brain Console
```

Do not move, delete, or rename files for cleanup unless all references are updated and validated. Prefer pointers and archive labels over destructive restructuring.
