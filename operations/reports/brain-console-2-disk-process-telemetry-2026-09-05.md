# Brain Console 2.0 — Disk and Process Telemetry Closeout

Date: 2026-09-05  
Repository: `brain`  
Runtime: `/Users/Office/Repos/stevewesthoek/brain-runtime`

## ORIGIN MAIN

- Before: `16c1785f1cc95a3976bb1efc32d2589bfd7b49f5`
- After: `7af5d4277235d41625bfe50afb601e6587b0f088`
- `origin/main` was pushed successfully at the after revision. Core canonical source revision, runtime deployment revision, and installed LaunchAgent metadata match.

## DISK telemetry

- Contract: `/ops/system-metrics.data.disk`, schema `machine-telemetry-v1`.
- Primary disk: `/`, `local system volume`; total `994,662,584,320` bytes, used `12,637,700,096` bytes, available `152,623,562,752` bytes.
- Current state: `CURRENT`, `8%` used; sampled `2026-09-05T08:33:17.148Z`.
- Threshold vocabulary: `DEGRADED` at `>=85%`, `ERROR` at `>=95%`; stale/unavailable remain explicit.
- Collector latency: `95 ms` for the latest combined bounded sample.
- Disk pressure and stale/unavailable states feed the existing Operational Snapshot attention model.

## PROCESSES telemetry

- Contract: `/ops/system-metrics.data.processes`.
- Count: `512` rows retained from `593` valid host processes; projection is explicitly `truncated` and bounded.
- Overview: `5` top CPU rows + `5` top RSS rows; `4` correlated Brain service rows in the live sample.
- Services: Brain Core plus three Brain Console workers were correlated. Scheduler and Obsidian remain absent when not instrumented by the host process sample; no false rows are fabricated.
- Privacy: no raw command lines, arguments, environment values, tokens, or secrets are returned. Rows contain PID, sanitized display name, optional Brain service ID, CPU, RSS, uptime, state, resource state, and sample time.
- Anomaly policy is conservative: only Brain Core RSS envelopes produce process anomalies (`>=512 MB` degraded, `>=1 GB` error); live anomaly count was `0`.

## COLLECTION

- Request-path scan: none. `/ops/system-metrics` reads the last in-memory snapshot; it does not invoke `ps` or `df`.
- Shared cache: one Core singleton shared by the system-metrics and operational-snapshot readers.
- Concurrency: refreshes deduplicate through one in-flight promise.
- Cadence: immediate startup sample plus a `10,000 ms` background interval; stale cache remains visible with explicit state.
- Sampling: fixed `execFile` calls only — `/bin/df -kP /` and `/bin/ps -axo pid=,pcpu=,rss=,etime=,state=,command=` — with a `2 s` timeout and `256 KB` output bound.
- Payload: top CPU/RSS and service projections are capped at five rows each; anomalies are capped at five; no history is retained. Latest payload was `3,674` bytes.

## COMPUTER UI

- Storage: Computer now shows primary-volume usage, used/total bytes, mount point, meter, and operational state.
- Processes: Computer shows bounded top consumers and sampled/total counts; no full process table is rendered.
- Services: Brain service rows show correlated RSS/CPU where available, with service state remaining separate from resource detail.
- 1141×797: `/computer` and `/operations` had no document scroll and zero browser errors.  
- 1512×982: `/computer` and `/operations` had no document scroll and zero browser errors.
- Screenshots: [Computer 1141×797](assets/computer-telemetry-1141x797.png), [Computer 1512×982](assets/computer-telemetry-1512x982.png), [Operations 1141×797](assets/operations-telemetry-1141x797.png), [Operations 1512×982](assets/operations-telemetry-1512x982.png).

## PERFORMANCE

- Warm route transitions: `40` samples, median `20 ms`, p95 `151 ms`, worst `238 ms`, routes over `500 ms`: `0`.
- Warm `/ops/system-metrics` fetches: median `72 ms`, p95 `108 ms`; one initial host-probe cold outlier was `7,296 ms`. The telemetry collector itself remained background/cache-only with a latest collection duration of `95 ms`.

## STABILITY

- Ten-minute soak: `2026-09-05T08:22:58.585Z` → `2026-09-05T08:33:00.651Z`.
- Requests: `6,188`; failed requests: `0`; unexpected HTTP failures: `0`; browser errors: `0`; long tasks: `0`.
- Expected optional 404 probes: `14`, matching the existing optional-endpoint contract.
- Core RSS: `170.8 MB` at start and `148.6 MB` at 10 minutes. Console RSS: `136.0 MB` → `109.3 MB`.
- Collector after soak: `81` samples, `0` failures, current disk/process state.

## VALIDATION

- Brain Core typecheck: pass.
- Brain Core full test suite: `1,976 passed, 0 failed`.
- Brain Console typecheck: pass.
- Brain Console production build: pass; only pre-existing autoprefixer compatibility warnings.
- Live `/health`: pass; Core service running under launchd.
- Live `/runtime/identity`: `matching`, canonical and deployment revision `7af5d4277235d41625bfe50afb601e6587b0f088`.
- Live `/operational-snapshot`: pass; existing scheduler/local-app/index attention remains explicit.
- Installed `com.office.brain-core` LaunchAgent was reloaded with the final matching revision. Runtime checkout commit: `bd1fddba6e8cc34507df93a37a28ac4ba50e12e4`.

## NEXT

One phase: add scheduler/Obsidian process identity adapters only when their launch/runtime contracts expose stable process ownership, then validate those correlations with the same bounded privacy and stability gates.
