# Mind Steward Daily Intelligence Loop

MRU0-P3.21 provides an explicit operator entrypoint over the existing P3.18 briefing, P3.19 review workflow, and P3.20 promotion artifacts. It is a read-only daily operating view, not a scheduler or new intelligence source.

## Run

From the Brain repository root:

```sh
node tools/scripts/mind-steward-daily-intelligence-loop.mjs
```

The entrypoint reads existing runtime-local artifacts when present:

- `runtime/local/mind-steward/unified-review/briefing-latest.json`
- `runtime/local/mind-steward/unified-review/workflow-latest.json`
- JSON promotion artifacts under `runtime/local/mind-steward/promotions/`

If they are absent, it reports an empty state and does not invent intelligence. Output is written only to:

- `runtime/local/mind-steward/daily-loop/latest.json`
- `runtime/local/mind-steward/daily-loop/latest.md`

## Human operating loop

1. Run the command when beginning a review session; no scheduling is enabled.
2. Review pending, stale, deferred, conflict, and accepted counts.
3. Follow each item’s source and evidence references.
4. Use the existing P3.19 workflow to record review, accept, reject, defer, or archive.
5. Use P3.20 only when an accepted item is explicitly prepared for promotion; `prepare promotion` is not execution.

The loop exposes available actions but applies none. It does not mutate Mind, Brain canonical state, provider state, or external clients.
