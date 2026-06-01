# Managed ProChat OS Plan

**Status:** execution-facing commercial rollout plan  
**Owner:** Steve Westhoek  
**Product:** ProChat OS Managed  
**Strategy source:** `mind/wiki/organisations/prochat/brand/prochat-os-strategy.md`

This is not a standalone product strategy. It is a managed-service implementation and rollout plan that must defer ProChat OS business strategy, category, positioning, and non-goals to the canonical Mind strategy.

## Goal

Create a paid managed version of ProChat OS as quickly as possible without jumping too early into high-risk multi-tenant SaaS.

## Recommended commercial sequence

```text
1. Paid setup / implementation
2. Managed single-tenant instance
3. Managed support and updates
4. Hosted control plane for fleets
5. Multi-tenant SaaS, only after hardening
```

The fastest sellable product is not a full SaaS platform. It is a managed single-tenant ProChat OS instance with setup, updates, monitoring, backups, and support.

## Product tiers

### 1. Community

Audience: personal/non-commercial users.

- source-available non-commercial license
- local install
- CLI doctor/install/status
- community docs
- no commercial use
- no managed support

### 2. Commercial Local

Audience: builders or businesses who run ProChat OS on their own machine/server.

- commercial license
- local install rights
- commercial use rights
- update channel
- basic support
- optional onboarding call

### 3. Managed Single-Tenant

Audience: serious founders, agencies, small teams.

- commercial license included
- dedicated VPS/EC2 instance
- managed setup
- managed updates
- backups
- monitoring
- support bundle workflow
- optional Slack/Telegram/Obsidian integration

### 4. Managed Team / Fleet

Audience: teams operating multiple projects or machines.

- multiple instances
- central status view
- user/team permissions
- audit logs
- backup policy
- custom integrations
- priority support

### 5. SaaS Control Plane

Audience: larger customer base after product-market proof.

- hosted web dashboard
- account/billing portal
- remote agent connections
- fleet status
- secure tunnel pattern
- centrally managed updates
- usage analytics

## Why single-tenant first

Single-tenant managed instances are the fastest path because they avoid many hard multi-tenant problems at launch:

- simpler data isolation
- simpler backups
- easier debugging
- easier customer-specific customization
- lower auth complexity
- lower blast radius
- easier enterprise story

Multi-tenant SaaS should come later, after the local API, CLI, license model, and support workflows are stable.

## Managed architecture v1

```text
Customer / Steve
  ↓ CLI login/connect
Managed control plane
  ↓ secure instance registry
Dedicated customer instance
  ├─ Brain Core API
  ├─ ProChat OS config
  ├─ optional Obsidian/Brain Console bridge
  ├─ integrations: Slack, Telegram, GitHub, Stripe, New Relic, etc.
  ├─ encrypted backups
  └─ monitoring + audit logs
```

For early pilots, the managed control plane can be manual/lightweight. Do not build a full SaaS dashboard before selling.

## Security boundaries

Managed ProChat OS must follow these rules:

- one customer per instance in v1
- no shared customer database in v1 except minimal billing/support metadata
- secrets stored outside Git
- encrypted backups
- least-privilege cloud credentials
- separate production/staging environments
- customer data export path
- customer deletion path
- audit log for support actions
- explicit approval for destructive actions

## Managed CLI relationship

The CLI is the bridge between local installs and paid managed services:

```bash
prochat managed login
prochat managed connect
prochat managed status
prochat managed support-bundle
prochat managed backup
prochat managed update
```

The managed service should not require exposing arbitrary shell access. It should use structured support bundles, API checks, logs, and explicit approvals.

## Minimal sellable managed offer

Name:

```text
Managed ProChat OS Pilot
```

Promise:

```text
We install, configure, monitor, and maintain your ProChat OS instance so your AI workflows, memory, automations, and SaaS operations run from one structured control layer.
```

Included:

- dedicated instance setup
- ProChat OS installation
- Brain Core setup
- CLI setup
- Slack/Telegram optional client setup
- Obsidian cockpit setup if applicable
- weekly update window
- monthly backup test
- support bundle workflow
- commercial license during subscription

Not included in v1:

- arbitrary custom development
- broad shell access
- unlimited integrations
- guaranteed autonomous agents
- compliance-heavy enterprise guarantees

## Pricing direction

Early pricing should be simple:

| Tier | Suggested shape |
|---|---|
| Commercial Local | yearly license + optional support |
| Managed Pilot | monthly retainer per instance |
| Managed Team | monthly base + per instance |
| Enterprise | custom |

Avoid underpricing managed support. The product handles customer infrastructure and secrets-adjacent workflows.

## Build roadmap

### Phase 0 — Offer and legal foundation

- source-available non-commercial license
- commercial license summary
- trademark policy
- public product README
- pricing/offer page draft

### Phase 1 — CLI and installability

- `prochat doctor`
- `prochat install`
- `prochat core status`
- support bundle generation
- redaction tests

### Phase 2 — Single-tenant managed pilot

- provisioning checklist
- backup/restore runbook
- update runbook
- support runbook
- customer handoff template
- instance inventory

### Phase 3 — Managed control plane

- customer instance registry
- license key validation
- remote status polling
- billing integration
- support ticket/workflow integration

### Phase 4 — Multi-tenant SaaS

Only start after:

- 3+ managed pilots
- repeatable install in under one documented flow
- stable Brain Core API
- redaction and backup workflows tested
- clear support burden understood

## Operational runbooks required before first paid managed customer

- provisioning runbook
- upgrade runbook
- backup/restore runbook
- incident runbook
- offboarding/deletion runbook
- support bundle redaction policy
- integration secrets policy

## Decision

Sell managed single-tenant ProChat OS first. Treat full SaaS as the second product, not the first product.
