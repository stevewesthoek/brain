# Brain Console — Obsidian Cockpit

**Role:** primary human cockpit for Brain + Mind  
**Backend:** Brain Core API  
**CLR3:** Decision Center source package implemented; live Mind installation remains separately gated

## Architecture

```text
Obsidian Brain Console plugin
        ↓
Brain Core API (headless control/safety boundary)
        ↓
Decision Core / runtime sources
```

The standalone browser Brain Console on port `4881` is an optional specialist diagnostics/operations surface. It is not the primary portal and does not own the CLR Decision Center.

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

## Installation boundary

CLR3 does **not** install this project into `mind/.obsidian/plugins/` because Mind plugin state is protected application-local state and the user explicitly prohibited Mind modification in this phase.

A later explicit installation/activation task may copy or link only the reviewed install files into the live vault. Installation does not change the canonical portal decision: Obsidian remains the primary cockpit and Brain Core remains the headless backend.

## Safety boundaries

- No secret storage.
- No generated runtime state written to Mind Markdown.
- No automatic decision action.
- No automatic proposal application.
- No broad Mind write.
- No capability execution introduced by the Decision Center.
- No dependency on the port-4881 web app.
- Brain Core offline state is rendered visibly.
