# Brain Console Web Migration

**Status:** legacy migration record, superseded by Brain Console Center  
**Owner:** Steve Westhoek  
**Decision date:** 2026-06-02  
**Superseded by:** `docs/system/brain-console-center-roadmap.md` and `docs/system/brain-console-center-implementation-plan.md`  
**Legacy value:** AWS Video feature reference for Brain Console Center

## Decision

Brain Console moves from a native Obsidian plugin to a standalone local web application owned entirely by the `brain` repo.

```text
Brain Console Web = primary control-plane UI in brain.
Brain Console Obsidian Plugin = frozen legacy/native plugin path.
Obsidian = optional viewer of the local Brain Console Web URL.
```

This keeps the repo split clean:

```text
mind  = private Steve/business memory, business context, strategy, natural-language documentation
brain = AI/system/runtime operating layer, Brain Core API, Brain Console Web, execution logic
```

`mind` does not host, implement, or operationally consume Brain Console. If Steve wants to view the console while working in Obsidian, Obsidian should open the local Brain Console Web URL through a web viewer.

## API boundary decision

Brain Console Web should still communicate through Brain Core API.

It should not directly read or mutate repo files from browser code, even though it lives in the same `brain` repo.

Reasons:

- Brain Core remains the operational source of truth.
- API contracts make UI behavior testable outside Obsidian.
- Browser code should not get filesystem or shell privileges.
- Approvals, auditing, safety checks, and controlled actions stay centralized.
- The same API can serve Brain Console Web, CLI tools, future plugins, and tests.
- Direct repo access from UI would recreate hidden coupling and make safety harder to audit.

Canonical flow:

```text
Brain Console Web → Brain Core API → runtime/job/config sources
```

Not:

```text
Brain Console Web → direct repo/file mutation
```

## Scope control

Do not port the whole Obsidian plugin at once.

The first Brain Console Web target is only:

```text
AWS Video operational dashboard
```

The goal is to create, approve, generate, inspect, and operate video jobs reliably so Steve can publish video. Other dashboard tabs can move later after the video workflow works.

## Frozen plugin policy

`projects/brain-console-obsidian` is frozen as a legacy/native plugin implementation.

Allowed there:

- critical security fixes
- build/install documentation fixes
- archival notes
- small compatibility updates when explicitly requested

Not allowed there by default:

- new operational dashboard features
- new AWS Video workflow work
- new local app control surfaces
- major UI rewrites

## Brain Console Web initial acceptance criteria

The first web dashboard must run as a normal local web app, for example:

```text
http://localhost:4880/aws-video
```

It must show:

- Brain Core connection status
- AWS Video pipeline status
- recent operational jobs from `/api/video-orchestrator/jobs/recent`
- selected job detail from `/api/video-orchestrator/jobs/{jobId}`
- timeline from `/api/video-orchestrator/jobs/{jobId}/timeline`
- create draft workflow
- approve script workflow
- generate artifacts workflow
- visible activity log and errors
- no YouTube publish button until publishing is separately approved

## Implementation location

```text
projects/brain-console-web/
```

Recommended stack:

```text
Vite + React + TypeScript
```

The web app should be intentionally small at first. Copy only the useful AWS Video concepts from the Obsidian plugin; do not copy the plugin lifecycle model.

## Future Obsidian relationship

Obsidian may show Brain Console Web through a web viewer pointed to the local URL.

Obsidian should not be required for Brain Console to function.
