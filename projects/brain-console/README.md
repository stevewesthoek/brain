# Brain Console

**Status:** released; Brain Console 2.0 modernization complete; maintenance-only
**Role:** primary maintainer entry point for the Brain Console web application

The current product is **Brain Console**. Brain Console 2.0 is the completed
release baseline, not a separate product.

## Current authorities

Use these documents as the single source for each current concern:

```text
operations/specs/brain-console-product-spec.md
docs/system/brain-console-architecture.md
operations/runbooks/brain-console-operations.md
docs/system/brain-console-roadmap.md
operations/specs/brain-console-obsidian-plugin.md
```

The web Console is the live operations cockpit over Brain Core. Obsidian is the
durable knowledge and Decision Center bridge. Brain Core remains the API,
control, and safety boundary.

## Development

```bash
cd projects/brain-console
npm install
npm run dev
```

Open `http://localhost:4881` for the local development surface.

For the installed Brain Console.app, LaunchAgents, runtime identity, ports,
restart/recovery, live routes, and bridge smoke test, use the canonical
operations runbook. Do not duplicate those operational procedures here.

## Architecture and design

Read the architecture and design-system authorities before changing UI or API
contracts:

```text
docs/system/brain-console-architecture.md
docs/system/brain-console-design-system.md
```

The browser never executes shell commands; operational actions go through
Brain Core and remain explicitly gated.

## Validation

```bash
npm run typecheck
npm run build
```

Historical Phase 1 QA context remains in:

```text
operations/runbooks/brain-console-manual-qa.md
```
