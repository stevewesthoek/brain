# Brain Console 2.0 Final Performance and Stability Closeout

Date: 2026-09-04  
Repository: `brain`  
Origin-main before this closeout: `3a4b3a1c399e5762a760e4bd93b6e6d4632c7aad`

## Verdict

`STABILITY_HARDENING_REQUIRED`

The warm navigation p95 gate passes, and the 30-minute production soak proves
stable service memory, zero failed network requests, successful Core recovery,
and no timer/listener growth. Strict acceptance is withheld because the live
task-detail route produced repeatable uncaught browser runtime events during
the soak. The requested `FINAL_PERFORMANCE_STABILITY_ACCEPTED` verdict is not
valid while the zero-browser-error gate is failing.

## Origin main

The source and deployed runtime were aligned at the start of the closeout:

| Item | Value |
| --- | --- |
| Source revision | `3a4b3a1c399e5762a760e4bd93b6e6d4632c7aad` |
| Runtime revision | `3a4b3a1c399e5762a760e4bd93b6e6d4632c7aad` |
| Core | `127.0.0.1:4877`, LaunchAgent, production |
| Console | `127.0.0.1:4881`, LaunchAgent, production |
| Identity state | `matching` |
| Runtime safety | read-only; no secrets exposed |

## Browser navigation

Thirty warm samples were collected for each primary transition. The overall
240-sample distribution was:

| Metric | Result |
| --- | ---: |
| Median | 48 ms |
| P90 | 60 ms |
| P95 | 61 ms |
| P99 | 77 ms |
| Worst | 435 ms |
| Routes over 500 ms | 0 |

| Transition | Median | P90 | P95 | P99 | Worst |
| --- | ---: | ---: | ---: | ---: | ---: |
| Command Center → Brain | 47 ms | 48 ms | 53 ms | 435 ms | 435 ms |
| Brain → Command Center | 48 ms | 54 ms | 54 ms | 55 ms | 55 ms |
| Brain → Active Work | 53 ms | 54 ms | 54 ms | 54 ms | 54 ms |
| Brain → Task Detail | 61 ms | 67 ms | 77 ms | 358 ms | 358 ms |
| Task Detail → Brain | 54 ms | 55 ms | 57 ms | 64 ms | 64 ms |
| Brain → Capability Routing | 47 ms | 52 ms | 53 ms | 58 ms | 58 ms |
| Brain → Quality & Safety | 47 ms | 50 ms | 53 ms | 54 ms | 54 ms |
| Brain → Continuity | 47 ms | 50 ms | 53 ms | 60 ms | 60 ms |

Before this pass the reported warm p95 was 295 ms. After removal of the
global idle prefetch flood, the measured overall warm p95 is 61 ms.

### Tail investigation

The old tail cause was broad idle prefetch: a 350 ms idle effect fetched
unrelated top-level RSC routes and chunks. That effect is removed. Current
slow-tail samples had no observed `PerformanceLongTask` over 50 ms, and the
remaining 435 ms Command Center and 358 ms task-detail samples were isolated
outliers rather than a p95 regression.

The soak found a separate correctness blocker: task-detail navigations emit a
repeatable `Runtime.exceptionThrown` event from the shared Next chunk
`4bd1b696-c023c6e3521b1417.js` at column 35055. The runtime reports only
`Uncaught` and the deployed runtime lacks the source-map WASM needed to resolve
the original source location. This requires a focused task-detail hydration/
runtime-error investigation before acceptance.

### Prefetch and idle network

The navigation shell now prefetches only `/command-center` and `/brain` at the
top level. Brain child routes prefetch only while the Brain workspace is
active or when the operator explicitly hovers/focuses a child link. A fresh
idle Command Center check observed only the relevant `/brain` prefetch and no
unrelated route cascade. A fixed transition showed no duplicate request keys.

### Task-detail loading contract

Task detail renders from the bounded task projection and does not synchronously
load context bodies, evidence bodies, raw packets, graph detail, gate receipts,
or continuity history. Context/evidence links remain references; full bodies
remain unloaded. The remaining blocker is the runtime exception described
above, not an eager detail payload.

## Browser versus Brain Console.app

These measurements are intentionally separate:

| Measurement | Result | Interpretation |
| --- | ---: | --- |
| Launcher wrapper begin → complete | ~922 ms | runtime/service reconciliation and health checks |
| Browser open request after wrapper begin | ~204 ms | `/usr/bin/open` dispatch |
| App launch → visible browser window/tab | ~1,500 ms | browser/window activation included |
| App launch → Command Center shell | ~1,500 ms | same activation-bound path; fresh data arrives later |
| In-app Command Center → Brain | 390 ms | CUA action plus accessibility state capture |
| In-app Brain → task | 488 ms | CUA action plus accessibility state capture |
| Normal browser warm route | 47–61 ms median/p95 | route/render path only |

The 390–488 ms App numbers are not route-only timings: they include click
dispatch, browser activation/accessibility capture, URL update, React render,
and data-read observation. The Mac wrapper is an `LSUIElement` launcher that
opens the browser URL; it is not a native dashboard window. The installed
application and LaunchAgent were previously verified to reconnect to the live
Console. A new interactive CUA check was unavailable at the end of this pass
because macOS was locked.

## Thirty-minute production soak

The clean production soak ran from `2026-09-04T19:51:44.424Z` through
`2026-09-04T20:21:45.090Z` (30 minutes). It exercised Command Center, Brain
Overview, Active Work, task detail, context/evidence query links, Tasks &
Evidence, Quality & Safety, Continuity, and Capability Routing. The route
driver used full document navigations; repeated static asset requests are
therefore included in the request total and are not concurrent duplicate
requests.

| Time | Core RSS | Console RSS | Browser RSS | Core CPU | Requests | Failed | Browser errors | Intervals / timeouts / listeners | Heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 0m | 68.6 MB | 70.6 MB | 354.9 MB | 29.5% | 17 | 0 | 0 | 2 / 5 / 286 | 6.3 MB |
| 5m | 79.7 MB | 82.1 MB | 249.1 MB | 6.1% | 9,104 | 0 | 117 | 2 / 5 / 286 | 82.0 MB |
| 10m | 69.0 MB | 80.6 MB | 246.9 MB | 0.1% | 18,030 | 0 | 232 | 2 / 7 / 290 | 75.0 MB |
| 15m | 74.3 MB | 84.6 MB | 231.7 MB | 0.0% | 27,117 | 0 | 349 | 2 / 7 / 290 | 91.4 MB |
| 20m | 67.9 MB | 109.1 MB | 225.8 MB | 2.6% | 35,834 | 0 | 462 | 2 / 7 / 286 | 54.4 MB |
| 25m | 86.2 MB | 110.0 MB | 230.7 MB | 7.2% | 44,986 | 0 | 579 | 2 / 5 / 286 | 65.3 MB |
| 30m | 99.0 MB | 112.5 MB | 235.0 MB | 0.1% | 54,056 | 0 | 696 | 2 / 5 / 286 | unavailable |

Memory classification: `CACHE_WARMING_THEN_STABLE`. Core and Console stayed in
bounded ranges after warm-up; browser RSS fell as the initial browser process
settled. Active repeating timers and tracked listeners returned to their
baseline band; measured growth was 0. No long tasks over 50 ms were observed.

Requests per minute averaged approximately 1,802 in this aggressive full-page
driver. This is dominated by expected static asset revalidation/refetch on
each `Page.navigate`; no failed requests or concurrent duplicate request keys
were observed. The strict browser-error count was 696, all from the repeated
task-detail runtime event, so network stability does not convert this into an
acceptance pass.

## Recovery and restart

At approximately 10 minutes, Core was safely interrupted with its LaunchAgent
kickstart. The process returned and `/runtime/identity` recovered without a
browser restart; Core RSS was 69.0 MB before and 79.6 MB after recovery.

After the soak, both Core and Console were bounded-restarted. Final checks
reported one listener on each port, HTTP 200 from Console, and matching source/
deployment identity. Final listeners were Core PID 76302 on 4877 and Console
PID 76312 on 4881. LaunchAgent state was running for both services.

## Viewport

The prior real viewport QA at 1141×797 reported:

| View | Result |
| --- | --- |
| Command Center 1141×797 | NO SCROLL |
| Brain Overview 1141×797 | NO SCROLL |

## Functional non-regression

Verified regression count: 0. Contract and live checks covered Context Pack
refs, Evidence Packet refs including `NOT_PERSISTED`, stable task deep links,
composition/graph linkage, gate linkage, continuity, Capability Routing,
Attention, Active Work, Activity, and domain posture. The task-detail runtime
exception remains a release blocker, but no missing functional contract was
observed in the bounded read-only projections.

## Validation

| Check | Result |
| --- | --- |
| Core focused tests | PASS (10/10 relevant identity/reference tests) |
| Console contract tests | PASS (12/12) |
| Typecheck | PASS |
| Production build | PASS; only existing Autoprefixer warning |
| `git diff --check` | PASS |
| Browser QA | FAIL strict gate: 696 task-detail runtime exceptions in soak |
| Live deployment | PASS operationally; identity matching, ports healthy |

## Remaining blockers

1. Resolve the repeatable task-detail `Uncaught` runtime event in the deployed
   shared Next chunk, then rerun the 30-minute soak with browser errors at 0.
2. The broader legacy Operations telemetry path remains unsafe for a full
   cross-surface soak: `readCodexUsage()` recursively scans `~/.codex/sessions`
   (approximately 10 GB) synchronously and previously drove Core above 2 GB
   RSS. That path was intentionally not modified in this narrow Brain Console
   pass because the task explicitly excluded Computer/Operations/Search/
   Obsidian changes.

Until both blockers are resolved and the strict gates are rerun, the correct
status is `STABILITY_HARDENING_REQUIRED`.
