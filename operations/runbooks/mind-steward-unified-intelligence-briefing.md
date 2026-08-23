# Mind Steward Unified Intelligence Briefing

The unified intelligence briefing is a deterministic, read-only presentation of the accepted unified review inbox. It groups existing review items by explicit evidence signals; it does not infer human importance and does not create a new authority or storage system.

## Use

Call `buildUnifiedIntelligenceBriefing(projection)` from `tools/scripts/mind-steward-unified-intelligence-briefing.mjs` with the output of the unified review inbox projection. If local output is requested, `writeUnifiedIntelligenceBriefing` writes only under `runtime/local/mind-steward/unified-review/`:

- `briefing-latest.json`
- `briefing-latest.md`

The output is runtime-local and is not canonical Brain or Mind state.

## Groups

- `urgent_review`: explicit stale freshness.
- `important_review`: material Brain/Mind impact, unknown freshness, or supplied uncertainty.
- `informational`: no urgent/important/deferred/historical signal was supplied.
- `deferred`: review state is deferred.
- `historical`: review state is archived.

Each item includes its source, provenance, evidence references, confidence, freshness, uncertainty, impact indicators, and available human actions: review, accept, reject, defer, archive.

The briefing never accepts, rejects, defers, archives, promotes, executes, or writes canonical state. Human review remains the decision boundary. No scheduler, provider call, Mind mutation, or Brain canonical mutation is part of this packet.
