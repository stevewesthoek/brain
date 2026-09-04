# Brain Console 2 — Codex Usage Telemetry Memory Fix

Date: 2026-09-04  
Origin main: `2e466c899f94f1c9e7c56e0b6c8b9c86b469c2c6`  
Implementation revision: `533b0cbb9666c265d7db0c311262552e0f09a156`

## Codex usage telemetry

Root cause: `readCodexUsage()` performed a full recursive scan and retained too much file content while calculating usage windows. The live `~/.codex/sessions` tree is large enough that this path could drive Core into multi-gigabyte RSS during Operations refreshes.

Old behavior: every request could initiate or wait on an unbounded historical JSONL traversal.

New behavior:

- bounded asynchronous directory traversal and metadata index;
- bounded tail reads (`64 KiB` per file, `64 MiB` per refresh);
- bounded files/directories/depth and an `8 MiB` persistent index;
- incremental refresh keyed by file size and modification time;
- stale-while-revalidate responses with one shared in-flight refresh;
- corrupt, unreadable, and truncated inputs degrade only Codex telemetry;
- the cache contains file metadata and aggregate candidates only, never transcript bodies.

Full historical scan per request: **NO**  
Concurrent scan dedupe: **PASS**  
Cached stale-while-refresh: **PASS**

## Real session tree benchmark

Baseline tree: 849 files, 10,866,639,998 bytes (`10.87 GB`). A later live refresh observed 850 files because a new session file was created during testing; the bounded reader handled it incrementally.

| Case | HTTP behavior | Refresh behavior | Core RSS |
|---|---:|---:|---:|
| Cold | 66.6 ms initial response | 849 files inspected, 849 read, 53,279,609 bytes, 612 ms background refresh | 81.7 → 97.7 MB |
| Warm | ~42 ms | 849 inspected, 3 read, 196,608 bytes, 62 ms refresh | ~98.1 MB |

Synthetic fixture tests passed for cold/warm incremental refresh, persistent cache reuse, stale-while-revalidate, hard bounds, corrupt/unreadable isolation, and concurrent caller dedupe with one active scan.

## Memory and Operations

Core before: 82.5 MB RSS at soak start  
Core peak: 82.5 MB RSS during the 30-minute soak  
Core after: 64.1 MB RSS  
Console peak: 96.9 MB RSS  
Browser peak: 1,225.2 MB RSS at startup, declining to 515.5 MB at 30 minutes  

Telemetry-induced >500 MB Core growth: **NO**  
Telemetry-induced >1 GB Core growth: **NO**  
Memory classification: **CACHE_WARMING_THEN_STABLE**

Operations usage telemetry: **PASS**  
Endpoint blocked by scan: **NO**  
Failure isolation: **PASS**

## 30-minute production soak

Harness: `tools/brain-console-final-soak.mjs` against `http://127.0.0.1:4881`, including Command Center, Brain, task detail/context/evidence, Quality, Continuity, Capability Routing, legacy Overview, Operations telemetry, Scheduler, Local Apps, Infrastructure, Dokploy, Tunnels, and AI Models.

| Checkpoint | Core MB | Console MB | Browser MB | Requests | Unhandled failures | Browser errors | Usage state |
|---:|---:|---:|---:|---:|---:|---:|---|
| 0m | 82.5 | 88.7 | 1,225.2 | 21 | 0 | 0 | STALE / refresh in flight |
| 5m | 65.9 | 74.7 | 663.5 | 2,388 | 0 | 0 | CURRENT |
| 10m | 63.4 | 75.5 | 638.4 | 4,732 | 0 | 0 | CURRENT |
| 15m | 59.6 | 96.9 | 514.6 | 7,038 | 0 | 0 | CURRENT |
| 20m | 55.8 | 71.5 | 321.6 | 9,401 | 0 | 0 | STALE / refresh in flight |
| 25m | 60.9 | 75.2 | 489.5 | 11,753 | 0 | 0 | CURRENT |
| 30m | 64.1 | 73.8 | 515.5 | 14,151 | 0 | 0 | CURRENT |

Expected optional missing-report responses: 819 HTTP 404s across the legacy Overview page. These are the documented unavailable states for reports that have not been generated; they are separated from unhandled failures. All unhandled failures were zero.

Core interruption/recovery: **PASS** — 59.9 MB before interruption, 79.3 MB after launchd recovery.  
Console restart during final deployment: **PASS**  
Mac application launcher: **PASS** — wrapper opens the local Console URL and logs successful launch.  
Viewport QA: **PASS** at 1141×797; primary Command Center and Brain Overview surfaces showed no scroll overflow in the existing native QA evidence.

## Performance and validation

Warm navigation evidence: median 48 ms, p95 61 ms, p99 77 ms, worst route 435 ms, routes over 500 ms: 0.

- Brain Core tests: 1,971 passed, 0 failed.
- Core typecheck/build: **PASS**.
- Console typecheck/production build: **PASS**.
- 30-minute browser soak: **PASS**.
- Core/Console live health: **PASS**.
- Source/deployment identity: **PASS** at implementation revision `533b0cbb…` before publication-only report commit.
- LaunchAgent listeners: one Core listener on 4877 and one Console listener on 4881.

The legacy optional-report requests were also corrected to use their canonical `/api/infinite-brain/...` paths; missing reports remain explicit, recoverable UI states rather than silent or unhandled errors.

## Final verdict

`CODEX_USAGE_TELEMETRY_FIXED_AND_STABILITY_ACCEPTED`
