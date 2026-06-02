# Brain Console Web

**Status:** active primary Brain Console direction  
**Initial scope:** AWS Video operational dashboard only  
**Supersedes:** `projects/brain-console-obsidian` for new operational dashboard work

Brain Console Web is a standalone local web dashboard owned entirely by the `brain` repo.

```text
Brain Console Web → Brain Core API → runtime/job/config sources
```

It intentionally does not depend on Obsidian plugin lifecycle. Obsidian can view this web app through a web viewer, but Brain Console Web must work in a normal browser first.

## Why Brain Core is still required

Even though Brain Console Web lives in the same repo as Brain Core, the web app should still use Brain Core API instead of direct repo/file access.

Reasons:

- Brain Core is the operational source of truth.
- Browser UI must not get filesystem or shell privileges.
- API contracts make behavior testable.
- Approvals, audit, safety checks, and controlled actions stay centralized.
- Future clients can reuse the same API.

## First target: AWS Video

The first dashboard intentionally contains only AWS Video operations:

- Brain Core connection diagnostics
- pipeline status
- recent operational jobs
- selected job detail
- timeline
- artifacts
- create draft
- approve script
- request changes
- generate artifacts

There is intentionally no YouTube publish button yet.

## Run

```bash
cd projects/brain-console-web
npm run dev
```

Open:

```text
http://127.0.0.1:4880/aws-video
```

The app is dependency-free and uses a local Node static server. No `npm install` is required for the current implementation.

The local server also proxies same-origin API requests:

```text
Brain Console Web /api/* → Brain Core http://127.0.0.1:4877/api/*
```

This avoids browser CORS issues. If Brain Core is already running on port `4877`, do not start a second Brain Core process; `EADDRINUSE` means the port is already occupied.

Override the upstream Brain Core URL for the web server with:

```bash
BRAIN_CORE_URL=http://127.0.0.1:4877 npm run dev
```

## Build

```bash
npm run build
```

## Obsidian relationship

Use an Obsidian web viewer to open the local Brain Console Web URL. Do not add new operational UI work to the frozen Obsidian plugin unless explicitly requested.
