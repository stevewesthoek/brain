# P8 context-memory efficiency and freshness closure — 2026-08-11

## Decision

P8 is complete. Canonical tasks B8.1–B8.6 are accepted 6/6, final verification passed, and the current canonical runtime roadmap has **0 remaining required tasks**.

The accepted architecture is:

- Codebase Memory MCP `0.9.0` is the bounded structural-navigation layer for explicitly admitted repositories;
- exact current source is the authority before edits, security/policy decisions, runtime/provider claims, and final factual claims;
- structural Graphify remains frozen;
- Graphify semantic synthesis is Brain-only, bounded, event-driven, non-authoritative, and disabled unless explicitly triggered within an approved scope;
- blanket automatic global rollout is rejected; additional repositories require explicit per-repository admission.

## B8.1–B8.6 acceptance chain

| Task | Result | Evidence / commit |
| --- | --- | --- |
| B8.1 | Canonical CBM benchmark accepted, 5/5 repetitions and all gates passed | `operations/reports/b8-1-v2-1-canonical-accepted-2026-08-10.md`; commit `1208f26f` |
| B8.2 | CBM `0.9.0` formally admitted `active-local` for Brain with exact provenance/tool inventory, no credentials, rollback/uninstall path | `operations/reports/b8-2-codebase-memory-admission-2026-08-11.md`; commit `44d7c761` |
| B8.3 | Brain-only inventory/freshness accepted, corrected 5/5 change→refresh→query→restore runs, stale/failure metadata and exact-source fallback | `operations/reports/b8-3-context-memory-freshness-acceptance-2026-08-11.md`; commit `3f9207a8` |
| B8.4 | Retrieval hierarchy enforced: fresh CBM navigation, exact source authority, stale/unavailable bounded exact-source fallback | `operations/reports/b8-4-agent-retrieval-policy-acceptance-2026-08-11.md`; commit `0869447c` |
| B8.5 | Legacy structural Graphify remains frozen; Brain-only bounded semantic event gate accepted with no default model runner or Mind scope | `operations/reports/b8-5-graphify-semantic-acceptance-2026-08-11.md`; commit `ce2675a3` |
| B8.6 | Read-only Brain+ProChat pilot accepted 2/2 with retrieval, freshness, rebuild, degradation, disablement, uninstall dry-run, rollback, and source-immutability gates | `operations/reports/b8-6-context-memory-pilot-acceptance-2026-08-11.md`; final closure commit pending this report |

## Optimized B8.6 pilot

Canonical optimized evidence: `operations/reports/b8-6-context-memory-pilot-evidence-optimized.json`.

Pilot repositories:

- Brain at pilot HEAD `ce2675a3`;
- ProChat at pilot HEAD `591f3e87892cd44977573fa6e5a6bdac4adac001`.

Both repositories passed:

- structural retrieval hit rate: `100%`;
- exact-source fallback hit rate: `100%`;
- inherited B8.1/B8.3 CPU/RSS/disk/latency limits;
- change → refresh → queryability → source restoration;
- fresh-cache rebuild and queryability;
- graceful degradation to bounded exact-source reads;
- disposable cache/runtime rollback;
- no repository-local `.codebase-memory` state;
- source HEAD/worktree snapshots unchanged by the pilot.

The first otherwise-passing pilot used full-source CBM search and exposed excessive navigation output. The final accepted retrieval policy uses `search_code` in `files` mode with at most five candidates, escalates to compact metadata only when needed, and forbids full-source output from structural memory.

This reduced estimated CBM navigation output from `64,343` to `397` tokens, approximately `99.4%`, while retaining `100%` probe hits. The optimized CBM navigation estimate was also approximately `86.4%` below the bounded exact-source navigation baseline. Worst optimized CBM probe output was `120` estimated tokens, below the hard B8.6 cap of `1000`.

Rollout decision: **approve architecture; reject blanket global rollout**. Additional repositories remain explicit per-repository admission decisions.

## Final verification

The final closure verification passed:

- Brain Core typecheck: pass;
- Brain Core test suite: pass;
- Mind Steward typecheck: pass;
- Mind Steward tests: `62/62` pass;
- Mind Context typecheck: pass;
- Mind Context tests: `159/159` pass;
- live Brain↔Mind cross-repo contract: pass;
- Context Gateway retrieval corpus: `12` cases pass;
- context-pack validation: pass;
- capability manifest: pass;
- capability inventory: pass, `18` capabilities;
- contract layers: pass;
- contract registry: pass, `23` contracts;
- MCP provider admission provenance: pass;
- MCP runtime-truth: pass;
- Graphify operational profile: pass;
- typed scheduler validation: pass, `17` jobs;
- scheduler inventory validation: pass, `17` jobs;
- Brain conformance: pass;
- Brain document consistency: pass;
- B8.4–B8.6 regression suite: `29/29` pass;
- changed JSON validation: pass;
- secret scan: clean;
- egress-risk scan: clean;
- `git diff --check`: clean at final pre-closure verification.

Brain conformance continues to report six non-blocking historical Mind evidence-link warnings. They predate P8 closure and are not runtime/conformance failures; the finalized Mind repository was not modified to rewrite historical evidence.

## External repository integrity

### Mind

Finalized HEAD remains:

`91ae8ce55c6daf67b728ef9b8d841504f24a97c9`

Existing user-owned `.obsidian/**` and `kanban.md` changes remain untouched. P8 made no Mind modifications.

### Workbench

Finalized HEAD remains:

`87ce34385277ce5bcbfd45266dbe2d925a536933`

Existing unrelated local work/untracked directories remain untouched. P8 made no Workbench modifications.

### ProChat

Pilot-pinned HEAD remains:

`591f3e87892cd44977573fa6e5a6bdac4adac001`

The B8.6 pilot recorded clean before/after source snapshots. Unrelated concurrent ProChat worktree edits appeared after the pilot; the three pilot probe paths remain unchanged. P8 made no ProChat modifications.

## Final boundaries

P8 completion does **not** authorize:

- blanket automatic repository rollout;
- Mind Graphify semantic ingestion;
- structural Graphify reactivation;
- broad Mind writes;
- Workbench modification;
- production deployment;
- push.

Any such action requires a separate explicit task and applicable owner authorization.

## Closure

B8.1–B8.6: **6/6 accepted**.

Remaining required canonical runtime-roadmap work: **0**.
