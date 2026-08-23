# MRU0-P3.25.1A Brain Console Discovery and Startup Readiness Audit

Date: 2026-08-23

Status: NEEDS REPAIR

This is a read-only discovery report. No Brain Console, Brain Core, Mind, configuration, dependency, or environment files were modified.

## A. Brain Console locations

Two existing surfaces were found:

1. **Standalone browser Brain Console:** `projects/brain-console/`
   - Next.js 15 / React 19 application.
   - This is the requested localhost surface and is documented as an optional specialist diagnostics/operations UI.
2. **Obsidian Brain Console plugin:** `projects/brain-console-obsidian/`
   - Primary human cockpit according to the standalone app README.
   - It is a separate Obsidian surface and was not changed or activated by this audit.

The standalone app is not a new dashboard system; it is the existing retained Brain Console implementation.

## B. Startup and configuration

Startup command:

```sh
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console
npm run dev
```

The package script resolves to `next dev -p 4881`.

Expected URL: `http://localhost:4881`

Brain Core dependency: `http://localhost:4877`, overridable only through the optional `NEXT_PUBLIC_BRAIN_CORE_URL` environment variable. No required secrets or environment files were identified in the app package configuration.

Dependencies are not installed in `projects/brain-console/` (`node_modules` absent). The safe startup attempt failed before application startup:

```text
sh: next: command not found
```

The typecheck attempt also failed before compilation:

```text
sh: tsc: command not found
```

No package installation was attempted.

## C. Brain Core probe

Brain Core is currently listening on `127.0.0.1:4877`.

`GET http://localhost:4877/status` returned HTTP 200 with:

```json
{
  "service": "brain-core",
  "mode": "read-only",
  "ok": true,
  "version": "0.1.0",
  "generationModeRuntime": "fixture"
}
```

Port 4881 was not listening during the audit.

## D. Existing routes and data sources

The standalone application contains routes for:

- overview;
- AI models;
- local apps;
- infrastructure;
- Dokploy;
- monitoring;
- scheduler;
- tunnels;
- video analyzer;
- AWS video;
- settings.

The package README identifies Brain Core API as the sole data source. The client defaults to `http://localhost:4877` and uses typed Zod response validation with request timeouts.

## E. Architecture alignment and drift

### Working without changes

- Existing standalone app location, package scripts, port, optional backend URL, and Brain Core API boundary are documented.
- The browser does not directly execute shell commands or read local files.
- Existing settings describe the standalone app as optional and keep the Obsidian plugin as the primary cockpit.
- Brain Core is available in read-only mode.
- Existing app routes and empty/error UI states are present in source and documentation.

### Outdated or mismatched

- The standalone app documentation describes earlier operational surfaces and does not explicitly list the current P3.17–P3.24 unified review inbox, briefing, workflow, promotion, daily loop, calibration, readiness, or learning checkpoint artifacts.
- The app’s documented data source is Brain Core API only. The current P3.17–P3.24 artifacts are runtime-local Brain files and are not directly consumed by this standalone UI.
- The standalone app cannot currently be validated visually or through route startup because dependencies are absent.

### Unknown until dependencies are restored

- Actual page rendering and route behavior on port 4881.
- Runtime response compatibility for each Brain Core endpoint.
- Whether current empty-state and stale-reference messaging remains correct in the running build.
- Whether the existing UI should expose the newer operational artifacts at all; that is a separate product/architecture decision, not a repair inferred from this audit.

## F. Discovery status

**BRAIN CONSOLE DISCOVERY STATUS: NEEDS REPAIR**

This status means local startup readiness is blocked by missing project dependencies, not that a redesign is required. No code repair is authorized by this packet.

## Recommended next bounded packet

Restore or provide the repository-approved local dependency installation for `projects/brain-console`, then run its existing `npm run typecheck`, `npm run build`, and manual localhost route checks. After that, perform a separate read-only drift decision on whether the standalone specialist surface should consume any P3.17–P3.24 artifacts through an existing Brain Core API.

Do not add a second dashboard, direct filesystem reads, a new data pipeline, or a new authority layer.
