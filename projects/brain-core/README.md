# Brain Core

Brain Core is the small local API boundary for the Obsidian-first operating cockpit.

## Status

Phase 1 scaffold only. The service is read-only and has no mutation endpoints.

## Goals

- Return machine/session/skill state as JSON.
- Bind to localhost by default.
- Avoid dashboard HTML.
- Avoid broad shell execution.
- Avoid secrets in responses.
- Provide a stable API for future Obsidian integration.

## Current endpoints

```text
GET /status
GET /sessions
GET /skills
GET /repos
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /local-apps
GET /video/status
GET /video/queue
GET /approvals
```

Current `/sessions` scans optional directories configured by `BRAIN_CORE_SESSION_DIRS`, `CLAUDE_PROJECTS_DIR`, `CODEX_SESSIONS_DIR`, and `GEMINI_SESSIONS_DIR`. It recursively discovers session-like files, infers the tool from names/paths, adds age and intent labels, applies simple recency/intent scoring, and returns a placeholder when no readable session directory is configured.

Current `/skills` indexes skill folders from `BRAIN_CORE_SKILLS_DIR` or the default repo-local `operations/system-configs/codex/skills` path and reports folders containing `SKILL.md` as indexed.

Current `/repos` reads `BRAIN_CORE_REPO_ALIASES` or `PROBOT_REPO_ALIASES` in `name:/absolute/path` format, reports whether each repo exists, and detects known handoff files without reading secrets or runtime logs.

Current `/scheduler/status`, `/scheduler/latest-run`, and `/scheduler/jobs` are read-only placeholders for the future Office Nightly Scheduler integration. They report disabled/placeholder state and do not inspect logs, run jobs, or mutate scheduler state.

Current `/local-apps` is a read-only placeholder list for local services that may later support approval-aware lifecycle requests.

Current `/video/status` and `/video/queue` are read-only placeholders for the future Video Orchestrator adapter. They do not inspect media folders, start renders, or upload files.

Current `/approvals` is a read-only placeholder for the future approval store adapter. Approval mutation endpoints are intentionally absent in Phase 1.

These adapters intentionally do not import ProBot dashboard code. Future slices should migrate richer read-only backend logic from ProBot without importing dashboard rendering or browser state.

## Validation

```bash
npm run typecheck
npm test
```

The Phase 1 tests cover the read-only route contract: `/status`, `/sessions`, `/skills`, GET-only behavior, and non-local request rejection.

## Local run

```bash
npm install
npm run dev
```

Default URL:

```text
http://127.0.0.1:4877/status
```

Configuration:

```text
BRAIN_CORE_HOST=127.0.0.1
BRAIN_CORE_PORT=4877
```

## Safety boundary

- Phase 1 supports `GET` only.
- Non-local requests are rejected.
- Runtime state should be returned from adapters, not duplicated into markdown.
- Mutation endpoints must wait for the approval-aware phase.
