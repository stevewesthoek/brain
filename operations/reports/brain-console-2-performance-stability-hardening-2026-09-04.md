# Brain Console 2.0 performance and stability hardening

Date: 2026-09-04

## ORIGIN MAIN

- Baseline fetched before work: `21fc85889eba8f05afe2f9bfd67e880f6d36c5a0`
- Fixed source revision: `d89fa80cfff626de5b358547bc34097349fb6178`
- The fixed revision was pushed to `origin/main` and deployed from the detached runtime checkout.

## Before/after navigation evidence

The primary regression was reproduced on the old live revision as a cold first-use Brain transition: URL change occurred quickly, but the Brain heading did not become usable for approximately 8.4–12.4 seconds. The prior accepted full-reload warm baseline was 830–953 ms. A ten-cycle client-click comparison was also captured after route cache priming; the table records median usable-heading latency for those route transitions. The fixed run contains ten samples per route.

| Route | Before median | After median | After p95 | After worst |
|---|---:|---:|---:|---:|
| Command Center → Brain | 75 ms warm; 8,436 ms cold first-use | 77 ms | 295 ms | 295 ms |
| Brain → Command Center | 53 ms | 52 ms | 57 ms | 57 ms |
| Brain → Active Work | 48 ms | 49 ms | 58 ms | 58 ms |
| Brain → Task Detail | 61 ms | 65 ms | 359 ms | 359 ms |
| Task Detail → Brain | 54 ms | 53 ms | 66 ms | 66 ms |
| Brain → Capability Routing | 48 ms | 48 ms | 54 ms | 54 ms |
| Brain → Quality/Safety | 48 ms | 48 ms | 53 ms | 53 ms |
| Brain → Continuity | 48 ms | 48 ms | 55 ms | 55 ms |

Fixed-run route medians are below the 150 ms target and all p95 values are below the 500 ms escalation threshold. The fixed first-use Brain shell no longer waits behind unrelated application prefetch work.

## PERFORMANCE ROOT CAUSE

`DashboardShell` enabled Next `Link` prefetch for every sidebar entry and also scheduled an idle `router.prefetch()` for seven unrelated application routes after 350 ms. That flooded the browser with RSC/chunk requests, competing with the first Brain transition. The router URL transition itself was fast; destination shell/data readiness was delayed by the prefetch flood.

The repair removes the global idle prefetch and disables eager prefetch for unrelated top-level routes. Command Center/Brain retain normal prefetch, Brain child routes prefetch only within the Brain workspace or on explicit hover/focus, and every internal Brain link remains a Next client-side `Link`. The shell and TanStack Query provider remain mounted at the root, so navigation keeps its cached workspace data.

## REQUESTS AND CACHING

- Target Brain transition request count: 15 total browser GETs, including route resources; seven Core projection endpoints, with zero duplicate URLs.
- Duplicate Core requests in the measured transition: 0.
- Global high-frequency polling: NO. Brain workspace refreshes at 30 seconds; shell status refreshes at 15 seconds; the global pulse strip is not mounted on Brain routes and background refetch is disabled.
- Cached revisits: PASS. The stable `['brain-workspace']` query key, 15-second stale time, 10-minute garbage-collection time, and disabled focus refetch produced immediate cached revisits without duplicate same-transition Core calls.
- Context bodies eager: NO.
- Evidence bodies eager: NO.
- Lazy detail: PASS. Task detail is a separate dynamic route; the UI loads bounded reference metadata only. Full context/evidence bodies, provider payloads, secrets, and transcripts are not requested.
- Production route chunks remained small: Brain routes are approximately 180 B (task detail 169 B) with 155 kB first-load JS; shared JS is 102 kB. No heavy detail dependency was introduced.

## PERSISTENCE

Live `NOT_PERSISTED` reason: `/agent-task-graph`, `/agent-task-state`, `/agent-executor-plan`, and `/agent-approval-gates` currently report `source=derived`, `persistence.enabled=false`, and `loadedFromDisk=false`; the task graph contains the static 0C-C through 0C-F derived projection, no canonical Context Pack or Evidence Packet refs, and zero evidence-store records. The graph's own next-safe-step says to extend the ledger with a persisted snapshot schema after the read-only graph is stable.

Producer wiring: NOT REQUIRED for this current static derived graph. The console preserves the producer contract and does not fabricate references.

Real persisted Context reference proof: NOT APPLICABLE.

Real persisted Evidence reference proof: NOT APPLICABLE.

The fixture contract still covers context-only, evidence-only, both, legacy, stale, and missing states; it is not presented as live persistence.

## STABILITY

Accelerated soak equivalent: 3 minutes at rapid route cadence, 42 complete cycles covering Command Center, Brain, Active Work, task detail, all Brain subviews, refetch/cache revisits, and task disclosure open/close.

| Checkpoint | Cycles | Core requests | Heap |
|---|---:|---:|---:|
| Start | 0 | 0 | 8.5 MB |
| 1 minute | 14 | 38 | 11.8 MB |
| 2 minutes | 28 | 75 | 11.3 MB |
| 3 minutes/end | 42 | 112 | 11.7 MB |

- Unhandled browser errors: 0.
- Unhandled API failures: 0.
- Request runaway: NO.
- Duplicate Core requests per cycle: 0.
- 39 cancelled RSC requests were normal navigation cancellations under the intentionally rapid cadence; none were Core failures, timeouts, or browser errors.
- Core-unavailable recovery: PASS. Aborted Core requests left the shell and Brain heading responsive with the existing optional-source notice; restoring Core and reloading recovered the live task graph.
- Detail/projection failure recovery: PASS. An injected 503 on a Brain projection remained a partial, responsive read-only view with affected-source handling rather than a blank route.
- Restart recovery: PASS. Both LaunchAgents were kickstarted, the launcher was run, Core and Console returned HTTP 200, and one listener was present on each port.

## MAC APP

`/Users/Office/Applications/Brain Console.app` was launched with `open` and exercised in the real Chrome app window (not only a headless test browser). The app opened the Brain Console at `/command-center`, navigated to `/brain`, opened task `0C-C`, and returned to `/brain`.

- Launch: PASS.
- Command Center → Brain: 390 ms measured app-shell transition.
- Brain → task: 488 ms measured app-shell transition.
- Task → Brain: 437 ms measured app-shell transition.

## VIEWPORT

At 1141×797, both `/command-center` and `/brain` reported document and body scroll height exactly 797 px: NO SCROLL.

## VALIDATION

- Console typecheck: PASS.
- Console production build: PASS; only existing non-blocking Autoprefixer warnings in `app/globals.css`.
- Core typecheck: PASS.
- Core agent-reference and deployment-identity tests: PASS (10/10).
- Console contract tests: PASS (12/12).
- Browser QA: PASS, including 10-cycle navigation benchmark, failure/recovery, real app exercise, and viewport checks.
- Live deployment: PASS at `d89fa80cfff626de5b358547bc34097349fb6178` before this report commit; the report-bearing revision is deployed in the final closeout step.

## VERDICT

PERFORMANCE_STABILITY_ACCEPTED
