# ProChat OS CLI Plan

**Status:** productization plan  
**Owner:** Steve Westhoek  
**Goal:** prepare multiple focused CLIs that make ProChat OS installable, operable, and sellable quickly  
**Strategy source:** `mind/wiki/organisations/prochat/brand/prochat-os-strategy.md`

This is an execution-facing CLI plan. It must defer ProChat OS business strategy, category, positioning, and non-goals to the canonical Mind strategy.

## Product principle

Do not start with one giant CLI.

Start with one umbrella command and several focused subcommands/modules. Each part should be useful on its own and become a paid managed-service gateway later.

```text
prochat                umbrella CLI
prochat doctor         environment and dependency checks
prochat install        local install/bootstrap
prochat core           Brain Core service lifecycle
prochat mind           memory/capture/index helpers
prochat brain          skills/config/runbook helpers
prochat agent          agent/session helpers
prochat deploy         EC2/VPS deployment helpers
prochat managed        connect to paid managed service
```

## CLI packaging model

Recommended public package names:

| Package | Command | Purpose |
|---|---|---|
| `@prochat-os/cli` | `prochat` | Umbrella command and installer entrypoint. |
| `@prochat-os/core-cli` | `prochat core` | Brain Core lifecycle, status, logs, API checks. |
| `@prochat-os/mind-cli` | `prochat mind` | Capture, index, sync, safe export/import. |
| `@prochat-os/brain-cli` | `prochat brain` | Skill profiles, model routing config, runbooks. |
| `@prochat-os/agent-cli` | `prochat agent` | Claude/Codex/Gemini session discovery and handoffs. |
| `@prochat-os/deploy-cli` | `prochat deploy` | Single-tenant machine provisioning and updates. |
| `@prochat-os/managed-cli` | `prochat managed` | Login, connect, support bundle, paid service handshake. |

The public repo can start with one package and split later. The command names should be stable from day one.

## MVP command surface

### `prochat doctor`

Checks local readiness:

```bash
prochat doctor
prochat doctor --json
```

Outputs:

- OS and architecture
- Node version
- Git availability
- Obsidian vault path existence
- Brain Core port availability
- required local folders
- missing optional integrations
- redacted environment status

### `prochat install`

Local install flow:

```bash
prochat install
prochat install --profile local
prochat install --profile builder
```

Responsibilities:

- create safe config directories
- copy templates
- create `.env.example`, not real secrets
- install launch agent/system service where supported
- print next steps

### `prochat core`

Brain Core lifecycle:

```bash
prochat core start
prochat core stop
prochat core restart
prochat core status
prochat core logs
prochat core openapi
```

### `prochat mind`

Memory and knowledge system helpers:

```bash
prochat mind capture "text"
prochat mind inbox
prochat mind compile --dry-run
prochat mind export --safe
```

Rules:

- never expose secrets
- never publish private mind data by default
- safe export must strip personal/private fields

### `prochat brain`

AI operating system helpers:

```bash
prochat brain skills list
prochat brain skills activate <profile>
prochat brain models status
prochat brain runbook <name>
```

### `prochat agent`

Agent/session helpers:

```bash
prochat agent sessions
prochat agent recent
prochat agent handoff <repo>
prochat agent resume <repo>
```

### `prochat deploy`

Single-tenant deployment helpers:

```bash
prochat deploy plan aws
prochat deploy aws --region eu-west-1
prochat deploy ssh <instance>
prochat deploy update
prochat deploy backup
```

MVP should generate plans before executing infrastructure mutations.

### `prochat managed`

Paid managed service bridge:

```bash
prochat managed login
prochat managed connect
prochat managed status
prochat managed support-bundle
prochat managed disconnect
```

This CLI becomes the customer bridge to paid hosting, support, monitoring, and billing.

## Fastest selling MVP

Phase 1 should ship:

1. `prochat doctor`
2. `prochat install`
3. `prochat core status`
4. `prochat managed connect`
5. `prochat managed support-bundle`

This is enough to sell setup/support/managed pilots before the whole platform is complete.

## Safety rules

- default to read-only
- require `--yes` for destructive operations
- prefer `--dry-run` before cloud changes
- redact secrets in all output
- never read `.env` values into support bundles
- log actions, not secret content
- make JSON output available for automation

## Commercial hooks

Free non-commercial CLI features:

- install
- doctor
- local status
- non-commercial local operation

Paid/commercial features:

- managed hosting connection
- commercial updates channel
- support bundles for paying customers
- managed backup/restore
- team/user management
- hosted dashboard/API
- business/commercial use license key

## Implementation roadmap

### Phase 0 — Extract public repo

- create sanitized `prochat-os` repo
- add source-available license files
- add package skeleton
- add README and product definition

### Phase 1 — Umbrella CLI

- implement `prochat doctor`
- implement `prochat version`
- implement config path discovery
- add tests for redaction and environment checks

### Phase 2 — Local install and Brain Core

- implement `prochat install`
- implement `prochat core status`
- add service templates for macOS first
- document Linux path separately

### Phase 3 — Managed bridge

- implement `prochat managed login`
- implement `prochat managed connect`
- implement `prochat managed support-bundle`
- require commercial license for managed/commercial usage

### Phase 4 — Deploy helpers

- implement dry-run deployment plans
- add EC2/VPS single-tenant provisioning
- add backup/restore
- add monitoring hooks

## Decision

Build the umbrella CLI first, with command namespaces that let the product split into multiple packages later without breaking customer workflows.
