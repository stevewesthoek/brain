# B8.3 Context-memory freshness and repository inventory acceptance — 2026-08-11

## Decision

B8.3 is accepted for Brain. The admitted `codebase-memory-mcp 0.9.0` provider now has an explicit Brain-only repository inventory, deterministic structural scope, explicit-event full-mode refresh, freshness/source/index metadata, observable failure receipts, stale-state detection, resource gates, and exact-source fallback. Automatic/global rollout remains disabled.

## Approved inventory and scope

- approved repository: `brain` / Workbench source `brain-next`
- project name: `brain`
- Brain cache: `/Users/Office/Library/Caches/brain/codebase-memory-mcp/brain`
- not approved here: `mind`, `workbench`, `prochat`
- index mode: `full`
- persistence: `false`
- auto-index: `false`
- auto-watch: `false`
- trigger mode: explicit event only
- exact source remains authoritative whenever structural memory is unavailable or stale

The structural inventory excludes `.git`, generated/build/runtime/vendor directories, `node_modules`, `.d.ts`, generated source patterns, and symlinks. Eligible structural extensions are pinned in `operations/specs/b8-3-context-memory-freshness.json`.

## Freshness contract

Each successful refresh records:

- exact Git HEAD when available;
- deterministic structural fingerprint;
- eligible file count;
- provider SHA-256;
- project/cache identity;
- index mode and index bytes;
- last successful refresh timestamp;
- stale state and last failure.

Freshness evaluation compares the current structural fingerprint and provider identity to the last successful state. Source or provider drift marks the structural index stale immediately for policy purposes even if the persisted success record itself previously said fresh. Stale/unavailable state requires exact-source fallback.

Provider failures write timestamped JSON receipts under the Brain cache and mark state stale. Failure receipts are preserved through B8.6.

## Live Brain baseline

The corrected acceptance run refreshed the live Brain cache explicitly with the exact admitted provider:

- provider SHA-256: `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`
- provider version: `0.9.0`
- upstream revision: `b637e3330c96cfe452da623db068c241aaa3ec01`
- baseline refresh duration: `2605 ms`
- eligible structural files: `1695`
- index bytes: `117,027,438`
- state after refresh: fresh
- baseline source HEAD: `44d7c7613da921641f75d13d0a47b66af7d809ed`

The source identity additionally records the structural fingerprint, so later source changes are detected independently of commit identity.

## Five-run isolated lifecycle evidence

Evidence: `operations/reports/b8-3-context-memory-acceptance.json`

Each repetition used an isolated disposable Brain copy and isolated provider cache/config/home. Every run performed:

1. full initial index;
2. controlled structural source mutation;
3. full-mode provider refresh using the proven B8.1 incremental lifecycle;
4. marker query proving changed source became queryable;
5. source restoration;
6. restoration refresh;
7. query proving the marker disappeared;
8. cleanup of disposable source/runtime state.

Result: `5/5 PASS`.

Effective limits retain 10% headroom from B8.1:

| Metric | Effective limit | Observed max |
| --- | ---: | ---: |
| changed source → queryable refresh | 6750 ms | 2300 ms |
| refresh peak RSS | 691.2 MiB | 313.08 MiB |
| refresh peak CPU | 270% | 161.36% |
| index bytes | 483,183,820.8 | 130,056,192 |

All lifecycle/queryability/restoration gates passed in every repetition.

## Harness-failure disposition

The first acceptance attempt is preserved as `operations/reports/b8-3-context-memory-acceptance-harness-failure-2026-08-11.json`. It produced no meaningful provider metrics because the harness inherited Workbench's `CI` environment variable and the hardened B8.1 helper correctly rejected that unexpected key before indexing. The corrected harness passes only the helper's explicit environment allowlist. This was a harness-only failure; no threshold, provider, or source-safety gate failed.

## Tests and safety

Focused B8.3 unit tests cover:

- linked-worktree HEAD identity;
- Brain-only inventory;
- generated/vendor/runtime exclusions;
- deterministic structural fingerprinting;
- successful refresh state and unchanged-source skip;
- source/provider drift → stale;
- file change → refresh → queryability;
- provider failure → receipt → exact-source fallback;
- disposable source isolation and cleanup.

The B8.1 refresh primitive remains the implementation basis and is now parameterized for the canonically admitted full mode; its existing fast-mode callers remain backward compatible.

## Boundary

B8.3 does not change Mind or Workbench, does not authorize ProChat indexing, does not enable watchers or auto-index, and does not unfreeze Graphify. B8.4 may now enforce the retrieval policy that consumes this freshness state: structural memory for navigation, exact pinned source for authority.
