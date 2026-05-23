# ProChat OS — Product Definition

**Status:** active product direction  
**Owner:** Steve Westhoek  
**Scope:** public product positioning for the larger brain + mind + runtime ecosystem

## One-line description

ProChat OS is a source-available operating system for AI builders who need one structured place to manage memory, agents, automations, local runtimes, SaaS operations, and managed workflows.

## Public description

ProChat OS is the structured operating layer for AI-powered software builders.

It combines a private knowledge system, an AI operations brain, local-first runtime services, workflow automation, CLI tooling, and optional managed hosting into one coherent system. It is designed for founders and operators who use AI to build software but need structure, memory, safety boundaries, repeatable workflows, and production visibility.

ProChat OS is not a literal computer operating system. It is an application and workflow operating system: the layer that connects human intent, AI agents, project memory, local machines, cloud deployments, automations, and operational dashboards.

## Product promise

AI can generate code quickly. ProChat OS gives that work an operating structure.

## Core philosophy

```text
AI builds code.
Structure ships SaaS.
ProChat OS operates the structure.
```

## What belongs inside ProChat OS

ProChat OS is the umbrella for these system layers:

| Layer | Role | Current source |
|---|---|---|
| Mind | Human memory, strategy, tasks, projects, research, decisions | `mind` repo |
| Brain | AI system rules, skills, configs, runbooks, automations, runtime docs | `brain` repo |
| Brain Core | Local API and safety boundary for machine/session/workflow state | `brain/projects/brain-core` target |
| ProBot | Slack/Telegram fallback client and reusable remote-control adapters | `brain/projects/probot` |
| Brain Console | Obsidian cockpit/plugin for human operation | planned |
| CLI tools | Install, update, inspect, route, deploy, and operate ProChat OS parts | planned |
| Managed service | Hosted or single-tenant managed ProChat OS instances | planned |

## Repository model

The current `mind` and `brain` repos are paired parts of ProChat OS, but they should not be merged.

```text
mind  = private human/business memory
brain = AI/system/runtime operating layer
```

For a public product release, extract a new sanitized repo rather than publishing the private repos directly:

```text
prochat-os/
  core/
  cli/
  api/
  adapters/
  templates/
  docs/
  examples/
```

The public repo must not include personal notes, secrets, machine-local state, private strategy, customer data, session logs, or repo-specific credentials.

## Primary audiences

1. Independent SaaS builders using AI heavily.
2. Founder-operators managing multiple small products.
3. Agencies or technical operators who want a structured local AI control plane.
4. Teams that want managed AI workflow infrastructure without building it from scratch.

## Product boundaries

ProChat OS is:

- a source-available AI operations layer
- a memory and workflow operating system
- a local-first control plane
- a CLI-driven toolkit
- a managed service opportunity
- an Obsidian-first human cockpit

ProChat OS is not:

- a bootable desktop/server OS
- a generic team chat app
- a public unrestricted agent marketplace
- a broad shell-execution bot
- a place to store secrets in Git
- an open-source project if commercial use is restricted

## Commercial model

The recommended model is source-available dual licensing:

- free non-commercial use, study, modification, and forks
- commercial use only under a paid ProChat commercial license
- paid managed single-tenant hosting
- paid implementation and support packages
- future SaaS control plane and API products

## Suggested public tagline options

- The operating system for structured AI builders.
- The AI builder OS for memory, agents, automations, and managed workflows.
- Local-first infrastructure for builders who ship with AI.
- The structured operating layer for AI-powered SaaS builders.

## Canonical naming

Use `ProChat OS` for the umbrella product. Use `ProChat` for the company/ecosystem.

Avoid describing ProChat OS as a replacement for macOS, Linux, or Windows. Use "operating system" in the product/category sense: a coordinated system for operating AI-assisted work.
