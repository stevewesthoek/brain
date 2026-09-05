# Brain Console 2.0 — Computer + Operations Workspace Closeout

Date: 2026-09-04/05 (Europe/Lisbon)

## Verdict

PASS for the bounded Computer + Operations workspace scope. The live Console exposes the two canonical workspaces, keeps the primary posture visible without document scrolling at the required viewports, uses current Brain Core projections, isolates unavailable sources, and preserves legacy detail routes.

The production deployment was initially verified at `df92a78255638d58dd355a685114a299f676c6eb` (source and deployment identity matched). The final closeout deployment identity was re-verified after the closeout documentation/code commit; the exact final SHA is recorded in the acceptance message accompanying this report.

## Routes and navigation

- `/computer` — canonical host, services, local-app, resource, and port/tunnel posture.
- `/operations` — canonical scheduler, runtime, tunnel, attention, event, and bounded Codex telemetry posture.
- Legacy/detail routes remain available: `/local-apps`, `/tunnels`, `/scheduler`, `/infrastructure`, `/monitoring`, `/dokploy`.
- Navigation is grouped as Command Center, Brain, Computer, Operations, Knowledge, and Settings. Primary workspaces use client-side Next navigation and normal prefetching.

## COMPUTER

The overview shows CPU load, memory pressure, uptime, disk instrumentation state, Brain Core/Console/Scheduler service rows, current local applications, ports, and a compact tunnel reachability summary. Healthy rows recede; policy-blocked scheduler work, unknown apps, offline tunnel hostnames, and unavailable instrumentation remain visible.

Current live observations:

- Brain Core: running on `4877`, identity matching.
- Brain Console: running on `4881`.
- Scheduler: daily launchd schedule at 03:00 Europe/Lisbon; latest run successful; policy-blocked jobs remain an explicit degraded/attention condition.
- Local apps: 2 running, 2 unknown, 18 registered; no PID/uptime values are shown because the current projection does not provide them.
- CPU and memory are real Core metrics. Disk and process-level anomaly telemetry are explicitly `UNAVAILABLE`/not instrumented rather than fabricated.
- Tunnel reachability is read-only and displays counts only; credentials and secrets are not exposed.

## OPERATIONS

The overview shows the canonical operational attention model, scheduler latest/next run and counts, runtime identity, tunnel posture, recent warning/critical events, and the bounded Codex usage/index diagnostics. Detail links lead to the existing scheduler, infrastructure, tunnels, monitoring, local-app, and command-center surfaces.

The current attention model correctly reports scheduler policy blocks, stopped local apps, stale computer resource records, and unavailable index freshness. These are operational findings, not hidden by the workspace.

## Service and failure model

The workspace uses the existing operational-state vocabulary: `CURRENT`, `STALE`, `DEGRADED`, `UNAVAILABLE`, `ERROR`, `BLOCKED`, and `PENDING`. Each source is queried independently. A failed host-metrics, app-registry, identity, scheduler, tunnel, snapshot, or usage source leaves the page shell and unaffected panels usable.

Conservative resource defaults are documented in the UI: ratio values at or above 80% are `DEGRADED`, and at or above 95% are `ERROR`. These thresholds are not applied to uptime seconds. Disk/process anomalies remain an explicit instrumentation gap.

## Scheduler, tunnels, and telemetry

- Scheduler source: Core `/infra/scheduler`, backed by the typed scheduler registry and launchd projection. Latest observed run: success, 4 successful jobs, 0 failed, 0 running, 4 policy-blocked.
- Tunnel source: Core `/infra/tunnels`, 4 configured tunnels. Offline hostnames are surfaced as degraded while healthy tunnel rows remain visible.
- Codex source: Core `/ops/ai-usage-windows`, using bounded incremental metadata diagnostics; no direct session scan or transcript body retention in the Console.
- Identity source: Core `/runtime/identity`; source/deployment matching and launchagent-backed runtime were verified.

## Optional 404 cleanup

The earlier pattern produced 819 expected optional 404s during repeated use. Optional Infinite Brain probes now use a five-minute negative cache backed by session storage, so the first fresh session records only the seven observed optional paths and a reload records zero repeats. The bounded 10-minute stability run observed 14 expected optional 404 probes total across two fresh root sessions, with zero unexpected HTTP failures. Real non-optional 404s are still surfaced.

## Visual evidence

- [Computer — 1141×797](assets/computer-1141x797.png)
- [Computer — 1512×982](assets/computer-1512x982.png)
- [Operations — 1141×797](assets/operations-1141x797.png)
- [Operations — 1512×982](assets/operations-1512x982.png)

Both workspaces measured `document.scrollHeight === clientHeight` at 1141×797 and 1512×982. Internal panels remain compact and detail routes carry deeper history.

## Performance

Warm client-side route navigation was measured after priming the workspace routes with 40 transitions across Command Center, Brain, Computer, and Operations:

| Measure | Result |
| --- | ---: |
| Warm median | 64 ms |
| Warm p95 | 73 ms |
| Warm worst | 87 ms |
| Routes over 500 ms | 0 warm samples |
| Blocking navigation API requests | 0 observed; slow source requests remained background/non-blocking |

The first cold transition was intentionally excluded from the warm sample because it included initial route/chunk/data startup. The warm sequence met the accepted local-dashboard target.

## Stability

The bounded production stability run lasted 10 minutes (`23:03:58Z`–`23:14:01Z`) and exercised the existing route set plus Computer and Operations repeatedly.

- Failed requests: 0.
- Unexpected HTTP failures: 0.
- Browser exceptions/console errors: 0.
- Long tasks: 0 at checkpoints.
- Core RSS: 36.7 MB initial, 63.5 MB at 10 minutes.
- Console RSS: 112.2 MB initial, 76.5 MB at 10 minutes.
- Browser RSS: 1,162.8 MB initial, 566.5 MB at 10 minutes.
- Bounded Codex diagnostics remained error-free; the index reported 851 files inspected, 848 cached, and no isolated input errors at the 10-minute checkpoint.
- Expected optional 404s: 14 total, limited to the documented optional paths.

## Validation

- Console typecheck: PASS.
- Console production build: PASS; 25 routes generated.
- Brain Core typecheck/build and targeted route/ops/local-app tests: PASS; 213 tests, 0 failures.
- Workspace/static contract tests and `git diff --check`: PASS.
- Browser QA: PASS at 1141×797 and 1512×982; no document scrolling, no browser errors, required links present.
- Live routes `/computer` and `/operations`: HTTP 200.
- Live Core 4877 and Console 4881: running; runtime identity matching.
- Shared dirty checkout remained untouched; work was performed in the isolated closeout worktree and runtime checkout.

## Remaining gaps

Disk usage, per-process resource consumers, and PID/uptime projections are not currently provided by Brain Core, so the workspaces label those fields as unavailable rather than infer them. Scheduler policy-blocked jobs, stopped local apps, stale resource records, and unavailable index freshness remain visible attention items from the canonical model.

## Next product-completion phase

Instrument canonical disk/process telemetry in Brain Core, with bounded freshness and privacy-safe projections, then promote those fields into the existing Computer cards.
