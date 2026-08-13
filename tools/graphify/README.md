# Graphify Tools

Brain-owned Graphify tooling under this directory follows the accepted B8.5 split:

- Codebase Memory MCP provides structural navigation when fresh.
- Exact current source is authority.
- Graphify is an optional, non-authoritative semantic projection for an explicit Brain-only document allowlist.

## Current Entrypoints

Canonical semantic gate:

```text
tools/graphify-semantic-event.mjs
```

The Office Nightly Scheduler invokes:

```text
node tools/graphify-semantic-event.mjs --mode=scheduler
```

No model runner is configured by default. An approved bounded runner must be supplied explicitly when semantic regeneration is intentionally requested.

Legacy package-script IDs are preserved for compatibility:

- `npm run graphify:brain` → bounded semantic event gate;
- `npm run graphify:mind` → fail-closed because Mind Graphify is not approved;
- `npm run graphify:brain:callflow` → fail-closed because structural Graphify is frozen;
- `npm run graphify:mind:callflow` → fail-closed.

## Retired Behavior

Do not use MTPLX, Ollama, Qwen, broad repository extraction, phased nightly graph generation, or automatic structural regeneration.

`tools/scripts/graphify-nightly.sh` is retained only as a fail-closed compatibility path and exits non-zero by design.

Historical `graphify-out/` or `.graphify-out/` artifacts may remain for history/compatibility but are stale-prone and non-authoritative. Do not regenerate them through the retired workflow.

## Scope

The semantic corpus, limits, receipts, kill switch, and safety boundaries are defined in:

```text
operations/specs/graphify-operational-profile.json
operations/specs/graphify-transition-governance.json
operations/specs/graphify-standard.md
```

Current hard rules:

- Brain-only semantic allowlist;
- no Mind ingestion;
- no automatic full-repo scans;
- no default local or cloud model runner;
- no repository writes from Graphify output;
- code-only changes do not invoke a semantic runner;
- exact source must be verified before edits or factual claims.

## Operational References

- `operations/runbooks/graphify-nightly.md`
- `operations/runbooks/graphify-quick-reference.md`
- `docs/system/graphify-context-standard.md`

Any document that instructs operators to start MTPLX/Ollama or run broad Graphify extraction is historical and must not be treated as current procedure.
