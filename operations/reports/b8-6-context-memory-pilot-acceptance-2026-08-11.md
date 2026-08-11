# B8.6 context-memory pilot acceptance — 2026-08-11

## Decision

B8.6 is accepted. The two-layer architecture is approved as the measured Brain default:

- Codebase Memory MCP `0.9.0` is the structural navigation layer;
- exact current source is authority;
- Graphify structural indexing remains frozen;
- Graphify semantic synthesis is bounded to approved Brain document scopes and is non-authoritative.

The pilot explicitly rejects blanket automatic global rollout. Additional repositories require their own admission/scope decision.

Canonical optimized evidence: `operations/reports/b8-6-context-memory-pilot-evidence-optimized.json`.

## Pilot scope

Exactly two repositories were used:

1. Brain — system repository, current pilot HEAD `ce2675a3`;
2. ProChat — normal application repository, clean HEAD `591f3e87892cd44977573fa6e5a6bdac4adac001`.

Mind and Workbench were not piloted or modified. Both pilot repositories were treated read-only; CBM state lived only in disposable caches/runtime directories.

## Acceptance result

`2/2 PASS`.

Both repositories achieved:

- structural probe hit rate: `100%`;
- exact-source fallback hit rate: `100%`;
- source HEAD unchanged;
- source worktree unchanged by pilot operations;
- no repository-local `.codebase-memory` state;
- change → full refresh → queryability → source restoration: pass;
- fresh-cache rebuild: pass and queryable;
- graceful degradation to bounded exact source: pass;
- disposable cache/runtime rollback: pass;
- repository availability after rollback: pass.

## Brain measurements

- cold full index: `6060 ms`
- cold peak RSS: `1129.02 MiB`
- cold peak CPU: `335.64%`
- initial index bytes: `135,495,680`
- incremental refresh: `2390 ms`
- refresh peak RSS: `312.86 MiB`
- refresh peak CPU: `152.30%`
- fresh-state rebuild: `5720 ms`
- rebuild peak RSS: `1579 MiB`
- rebuild peak CPU: `366.43%`
- rebuild bytes: `147,816,448`

All remained below inherited B8.1/B8.3 effective headroom limits: 27,000 ms cold/rebuild, 1843.2 MiB cold RSS, 630% cold CPU, 6750 ms refresh, 691.2 MiB refresh RSS, 270% refresh CPU, and 483,183,820.8 bytes index capacity.

## ProChat measurements

- cold full index: `830 ms`
- cold peak RSS: `258.80 MiB`
- cold peak CPU: `248.19%`
- initial index bytes: `12,746,752`
- incremental refresh: `220 ms`
- refresh peak RSS: `115.78 MiB`
- refresh peak CPU: `159.09%`
- fresh-state rebuild: `630 ms`
- rebuild peak RSS: `260.38 MiB`
- rebuild peak CPU: `339.68%`
- rebuild bytes: `13,729,792`

All inherited limits passed with substantial margin.

## Retrieval efficiency optimization

The first otherwise-passing pilot used CBM `search_code --mode full --limit 20`. That exposed an efficiency defect in pilot usage, not provider correctness: the structural navigation response included source bodies and produced an estimated `64,343` navigation tokens across the five probes, compared with `2,923` for the bounded exact-source navigation baseline. Raw baseline evidence is preserved at `operations/reports/b8-6-context-memory-pilot-evidence.json`.

B8.6 corrected the retrieval policy instead of accepting that overhead:

- initial structural `search_code` mode: `files`;
- candidate limit: `5`;
- compact metadata escalation: only when relationship metadata is needed;
- full source from structural memory: forbidden;
- exact-source read remains the final authority step.

Optimized result:

- Brain CBM navigation estimate: `222` tokens versus `2557` exact-source-navigation tokens; delta `-2335`;
- ProChat CBM navigation estimate: `175` versus `366`; delta `-191`;
- combined CBM navigation estimate: `397` versus `2923`; approximately `86.4%` less navigation context than the bounded exact-source baseline;
- compared with the initial full-source CBM baseline, estimated CBM navigation output fell from `64,343` to `397`, approximately `99.4%` lower;
- worst optimized CBM probe: `120` estimated tokens, below the hard B8.6 cap of `1000`;
- tool-call delta: `0` — both paths still require navigation plus the same final exact-source authority read.

This optimized mode is now encoded in the canonical B8.4 policy and mandatory `AGENTS.md` instructions.

## Graceful degradation and rollback

Provider-unavailable retrieval selects `bounded-exact-source-search` followed by exact-source read. Every pilot probe resolved through that fallback at `100%` accuracy.

A real CBM uninstall command was exercised in `--dry-run -n` mode and explicitly reported that no files were modified. Pilot cache/config/runtime state was then actually removed from disposable locations, after which both source repositories remained readable with unchanged HEAD/worktree snapshots.

## Graphify disablement

B8.6 added and exercised the explicit semantic kill switch `GRAPHIFY_SEMANTIC_DISABLED` / `--disabled`.

With an approved semantic document change and a fake runner supplied:

- status: `disabled`;
- runner invoked: `false`;
- staging created: `false`;
- semantic state: `stale`;
- generated-output cleanup: pass.

No external or local model API was invoked during B8.6.

## Operator burden

Observed pilot burden remained bounded:

- source repository configuration changes: `0`;
- source repository mutations: `0`;
- explicit refresh workflows exercised: `2`;
- rebuild workflows exercised: `2`;
- Graphify model invocations: `0`;
- Graphify disable controls exercised: `1`;
- uninstall dry-runs exercised: `1`;
- wider rollout requires explicit per-repository admission rather than a global switch.

## Rollout decision

`approve-architecture-reject-blanket-global-rollout`.

Brain keeps CBM as its measured structural default. The ProChat pilot proves the architecture works on a normal application repository, but that does not automatically activate ProChat or any other repository. Wider use remains opt-in and scope-bound.

## P8 exit

B8.1–B8.6 are now evidence-complete. P8 may close after final repository-wide verification, roadmap/document consistency, and local commit checks pass. No task here authorizes push or modification of finalized Mind/Workbench repositories.
