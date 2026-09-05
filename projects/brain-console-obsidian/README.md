# Brain Console — Obsidian Cockpit

**Role:** supported Obsidian knowledge and Decision Center bridge for Brain + Mind
**Backend:** Brain Core API  
**Release:** Brain Console 2.0 complete; live Mind installation verified at plugin version `0.3.0`

## Architecture

```text
Obsidian Brain Console plugin
        ↓
Brain Core API (headless control/safety boundary)
        ↓
Decision Core / runtime sources
```

The browser Brain Console on port `4881` is the live operational cockpit. This
plugin is the durable knowledge and Decision Center bridge. Brain Core remains
the sole operational API/control/safety boundary.

## Decision Center

CLR3 adds one Decision Center view backed by the existing Infinite Brain proposal/approval ledger through Brain Core:

```text
GET  /api/infinite-brain/decisions
POST /api/infinite-brain/decisions/:proposalId
POST /api/infinite-brain/decisions/notifications/poll
```

The plugin does not maintain a second decision store.

Decision actions are human-triggered only and carry the proposal hash that was rendered in the UI. Brain Core rejects stale hashes so a proposal that changed after review cannot be approved accidentally.

Decision states shown by the cockpit:

```text
pending
approved
rejected
deferred
superseded
```

`needs-review` remains an approval-ledger decision that projects back into `pending` for the human queue.

## Notifications

Context/data refresh stays manual.

Decision attention polling is separate and bounded to once every five minutes while Obsidian is running. The backend deduplicates:

- high-priority pending attention;
- transition from zero pending to pending;
- one normal-priority daily digest.

Obsidian notices are generated only from aggregate counts. Proposal titles, summaries, evidence text, and source paths are not inserted into notification payloads.

The persistent Obsidian status-bar item shows only the pending Decision Center count.

## Configuration

Settings are deliberately small:

- Brain Core base URL;
- local decision audit label;
- notification polling on/off.

Do not store credentials or other secrets in plugin settings.

Default Brain Core URL:

```text
http://127.0.0.1:4877
```

The URL is configurable so the adapter is not tied to Steve's path or host topology.

## Source files

```text
manifest.json
decision-center-core.cjs
decision-center-core.test.mjs
main.js
styles.css
```

The plugin deliberately uses a thin dependency-free JavaScript adapter. Business logic, decision authority, proposal freshness, audit state, and safety remain in Brain Core.

## Validate

```bash
npm run check
```

This runs JavaScript syntax checks and dependency-free Decision Center core tests.

## Live installation and maintenance boundary

The reviewed plugin files are installed in the canonical live vault at:

```text
/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/
```

The bounded activation is complete and the `brain-console` community-plugin
registry entry is enabled. Do not modify other Mind `.obsidian` settings,
plugins, content, or secrets as part of routine maintenance. Use the canonical
operations runbook for live verification, restart/recovery, and Console ↔
Obsidian bridge checks:

```text
operations/runbooks/brain-console-2-operations.md
```

## Safety boundaries

- No secret storage.
- No generated runtime state written to Mind Markdown.
- No automatic decision action.
- No automatic proposal application.
- No broad Mind write.
- No capability execution introduced by the Decision Center.
- No dependency on the port-4881 web app.
- Brain Core offline state is rendered visibly.
