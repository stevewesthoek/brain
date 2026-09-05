# Brain Console 2.0 Search + Obsidian Integration — 2026-09-05

## Outcome

The Brain Console 2.0 bounded unified search projection and global command
palette are implemented in the feature revision
`4725383a6db079827e64d14a030546bfb2da14dc`. Core and Console were rebuilt and
deployed from the integrated source. The final documentation closeout commit is
the revision reported by `/runtime/identity` after this report is committed.

## Disk semantic verification

The live primary filesystem is APFS. `df -kP /` reported approximately 994.7 GB
volume size, 12.6 GB used, 152.6 GB available to non-root, and 8% capacity.
`diskutil info /` independently reported 12.6 GB volume-used space and confirmed
the sampled root is an APFS volume snapshot.

These values can legitimately coexist: `df` capacity percentage is based on its
used + available-to-non-root capacity, while `totalBytes` is the physical APFS
volume size. The telemetry now exposes `capacityBytes`, `percentBasis:
df-capacity`, and `availableMeaning: available-to-non-root`; the Computer card
labels the values accordingly. A regression invariant asserts the df capacity
relationship and does not compare df capacity against physical volume size.

## Search architecture

`GET /search?q=...` is the bounded `brain-unified-search-v1` Core projection.
It caches a maximum 512 metadata entries for 15 seconds and returns a maximum
32 results. The index refresh reads existing task, reference, scheduler,
runtime-report, service, local-app, capability, repository, and orchestrator
projections. Obsidian search uses a fixed registry of high-value note paths and
never crawls the vault during a query.

Supported result types are ROUTE (Console-local), TASK, EVIDENCE, CONTEXT,
CONTINUATION, REPORT, SERVICE, SCHEDULER_JOB, CONSUMER, and OBSIDIAN_NOTE. Packet
and note bodies are excluded. Freshness is explicit as CURRENT, STALE, DEGRADED,
or UNAVAILABLE; source failures are returned as partial failures.

The Console palette is local-first: route results render synchronously, indexed
Core results arrive asynchronously after a 120 ms debounce, and stale responses
are ignored by sequence. Results are deterministically ranked by exact, prefix,
title, token, and metadata matches. Recents are bounded to six destinations and
do not store full query history. The palette is read-only and cannot execute
shell commands, restart services, request scheduler runs, or mutate providers.

## Obsidian contract and evidence

Console → Obsidian uses stable `obsidian://open` links generated from the bounded
note registry. The live URI
`obsidian://open?vault=mind&file=system%2Fbrain-mind-bridge.md` was opened on the
Mac and Obsidian displayed the intended `brain-mind-bridge` note in the `mind`
vault.

Obsidian → Console source support adds stable commands for Brain Command Center,
Brain Operations, and Brain Computer, plus an in-view “Open Brain Console”
action. Plugin tests validate safe Console URL construction and the inverse
bridge. The live vault does not currently contain or enable the
`brain-console` plugin; its `.obsidian` state remains protected by the existing
installation boundary. Therefore live inverse-plugin proof is not claimed.

## Performance and stability

At the required 1141×797 viewport, Command Center and Brain had document height
equal to the viewport; Computer remained document-capped; and the palette overlay
did not increase document height. The palette opened without waiting for Core;
the automation wall-clock measurement was 97 ms (the browser round-trip includes
automation overhead). First route results were immediate. Keyboard QA passed for
⌘K, toggle, Escape, ArrowUp/ArrowDown, Enter, focus return, labelled input,
dialog semantics, and focus containment.

The ten-minute production-mode exercise issued 1,472 search and Console route
requests with zero failures, zero search/index failures, and zero steady-state
browser failures. Search latency was median 1 ms / p95 13 ms. Route latency was
median 4 ms / p95 9 ms. Core RSS ranged from 61.6 MiB to 81.6 MiB. At the final
sample Core RSS was 61.7 MiB, Console service RSS 33.4 MiB, and its Next child
RSS 66.9 MiB. Search payloads were bounded metadata responses; the live scheduler
search response was a single result with `fullScanPerQuery: false`.

Four transient browser chunk-load errors were observed only in the pre-restart
browser tab while it held HTML from the previous production build. The Console
LaunchAgent was restarted after deployment; a fresh reload then rendered cleanly
and the ten-minute steady-state exercise produced zero browser errors.

## Validation and deployment

- Brain Core tests: PASS, 1,979 tests.
- Console typecheck: PASS.
- Console production build: PASS.
- Obsidian syntax and contract tests: PASS, 8 tests.
- Console contract tests: PASS, 27 tests.
- `git diff --check`: PASS.
- Live Core `/search`, `/runtime/identity`, `/ops/system-metrics`: PASS.
- Live Console 4881: PASS.
- LaunchAgents `com.office.brain-core` and `com.office.brain-console`: running.
- Deployment identity: matching source and runtime revision.
- Dirty shared checkout: untouched.

## Remaining product gap

The reviewed Obsidian plugin source is ready, but live installation/activation
in `mind/.obsidian/plugins/` remains a separate explicit activation boundary.
