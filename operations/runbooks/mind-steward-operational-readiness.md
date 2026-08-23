# Mind Steward Operational Readiness Check

MRU0-P3.23 answers whether the existing Infinite Brain review loop is available and usable. It is a read-only check over the P3.17–P3.22 contracts and runtime-local artifacts; it does not create monitoring or repair systems.

## Use

Call `buildOperationalReadiness` from `tools/scripts/mind-steward-operational-readiness.mjs` with the current briefing, workflow, calibration, and promotion artifacts. Write inspection output with `writeOperationalReadiness` under:

- `runtime/local/mind-steward/readiness/latest.json`
- `runtime/local/mind-steward/readiness/latest.md`

The report distinguishes `ready`, `ready_with_attention`, `ready_with_empty_runtime_state`, and `not_ready`. Missing runtime artifacts before first use do not invalidate installed capabilities; missing capability files or invalid JSON do.

## Recommended daily cycle

1. Run the daily intelligence loop.
2. Review pending, deferred, stale, conflict, and promotion attention items.
3. Run operational feedback calibration after real review activity.
4. Run readiness to confirm capability availability and identify blockers.
5. Follow the existing review and promotion boundaries; no action is applied by readiness.

The report lists commands, output locations, and human attention. It performs no repair, scheduling, provider call, Mind write, Brain canonical write, or automatic promotion.
