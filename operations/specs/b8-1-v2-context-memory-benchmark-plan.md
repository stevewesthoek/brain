# B8.1 Contract V2 — Context-Memory Benchmark Plan

Status: implementation and noncanonical rehearsal only. This document grants no canonical materialization or execution authority.

## Architecture decision

P8 uses one deterministic structural-memory index per active code repository (or an operationally equivalent shared service with repository isolation). Agents use that index for navigation and relationship discovery, but exact pinned source remains authoritative before edits and authority-bearing claims. Exact-source lookup is therefore a required normal fallback, not a benchmark competitor to be eliminated. Graphify is a separate bounded semantic-analysis layer and is outside B8.1 V2.

Contract V2 adopts measured structural scope plus mandatory exact-source fallback. A provider may omit eligible files only when the omission is measured, the repository and aggregate coverage gates still pass, every affected fixture is explicitly marked fallback-required, and exact-source accuracy is 1.0. Unknown coverage and silent omission fail closed.

## Why V1 was retired

The historical contract mixed cold indexing and refresh resource peaks, tuned limits around a 512 MiB snapshot rather than the 24 GiB / 12-core host, treated provider `fast` mode as representative despite material file omissions, used semantically incomplete caller/callee truth sets, allowed nonstructural fixtures to influence structural metrics, and did not make the exact-source fallback consequence of an unindexed fixture explicit. Historical plans, approvals, and evidence remain immutable records and cannot authorize V2.

## Bound subjects and provider configuration

- Structural provider subject: Codebase Memory MCP (`cbm`).
- Baseline/fallback subject: deterministic exact-source reads.
- Candidate search bound: latest official stable plus any newer official prerelease available on 2026-08-10.
- Required provider mode: `full`; `fast` is diagnostic-only and cannot represent the architecture.
- Persistence and auto-watch: disabled for benchmark runs.
- Graphify: excluded and ineligible for B8.1 structural-provider scoring.

The canonical plan must bind the provider's stable path, resolved binary path, version, SHA-256, index mode, runtime identity, sandbox identity, profile/helper hashes, source pins, manifest/schema hashes, and implementation hashes.

## Coverage contract

Eligible structural scope is the set of regular source-code files whose extension is listed in the V2 manifest, excluding any path containing a declared excluded directory name. Tests are included. Generated, vendored, archived, dependency, build, runtime, Graphify-output, and Git trees are excluded.

For each repository, evidence records the exact eligible, indexed, unindexed, and unknown file sets and counts. Coverage is `indexed / eligible`. Per-repository coverage must be at least 0.95 and aggregate coverage at least 0.97. Unknown count must be zero. A fixture whose target file is unindexed earns no CBM structural credit and must pass through exact-source fallback at 1.0 accuracy.

Each non-count fixture also binds a lexical retrieval pattern that appears verbatim in its benchmark question. The evaluator submits that pattern once without an expected path, line, symbol answer, or expected set member. At most the first 20 ranked results are admitted; the expected file must occur inside that bound and mean reciprocal rank must be at least 0.10. Returned candidates are then scored against the answer key. Set outcomes are extracted from the retrieved indexed source and must match exactly; expected set members are never issued as provider queries. The exact-source subject independently locates the target from the same question-visible pattern before verifying authoritative content.

## Structural truth sets

Truth is derived from each exact pinned Git tree, never from provider output. The manifest declares an explicit relation kind for every applicable fixture:

- `import-consumers`: every direct importer of the target symbol; declaration-only and re-export-only uses are excluded.
- `call-sites`: every direct call site of the target symbol; its declaration and re-export-only uses are excluded.
- `no-explicit-caller`: framework or runtime entry with an exhaustive empty caller set.
- `initializer-dependencies`: imported or repository-defined symbols referenced by the initializer, including constructors; globals and local containers are excluded.
- `body-code-targets`: direct calls and uppercase JSX targets rooted in imported or repository-defined symbols; globals, platform intrinsics, lowercase JSX, and parameter methods are excluded.
- `no-callee`: an exhaustive empty callee set under this contract.

Tests participate in caller truth. Expected sets are unique and exact. Precision and recall are computed from provider-predicted sets; empty/empty is 1.0, and an empty truth with a nonempty prediction is 0. Structural metrics are not applicable to count, inventory, or set fixtures. The minimum aggregate CBM caller/callee F1 is 0.80.

## Lifecycle and resource contract

Cold start is a fresh-cache full index of one pinned repository. It must finish within 30 seconds, use no more than 1536 MiB peak RSS, and no more than 600% peak CPU. The memory ceiling is exactly one sixteenth (6.25%) of the 24 GiB host and the CPU ceiling is half of the 12 logical cores; cold indexing is bounded maintenance work and exact-source remains available while it runs. The separate rehearsal rule still requires every observed maximum to retain at least 10% headroom, so a qualifying provider must remain below 1382.4 MiB in practice.

Steady state is measured separately. An idle service, if one remains, must stay within 256 MiB RSS and 5% CPU. Incremental freshness is measured by modifying one manifest-admitted source file in a disposable export, refreshing the same project, proving the marker is queryable from that exact file, restoring the source byte-for-byte, refreshing again, and proving the marker absent. Across five independent runs, refresh p95 must be at most 5000 ms, every refresh at most 7500 ms, refresh peak RSS at most 768 MiB, and refresh peak CPU at most 300%. The five-second p95 is an architecture-level maintenance bound: refresh is local and deterministic but does not block exact-source navigation, and it remains an order of magnitude below the 30-second cold-index allowance.

Each repository index must remain at most 512 MiB and total live service RSS at most 1536 MiB. Because diagnostic repositories are evaluated sequentially, the simultaneous service ceiling is checked against the conservative sum of each repository's measured pre-stop idle RSS within the repetition. Capacity is sampled again before every repetition. Five of five independent rehearsals must pass, with the median and worst results passing and at least 10% headroom on upper-bound gates before a canonical dry run is prepared.

## Isolation contract

All IPv4, IPv6, and Unix-domain socket operations are denied by default. The sole exception is the profile-bound per-user root `/private/tmp/cbm-daemon-<uid>` needed by the official prerelease coordination daemon. Before use, the evaluator requires that root to be a real directory owned by the current UID, forces mode `0700`, and rejects symlinks. This is an explicit owner-local same-UID trust boundary: it prevents Internet, TCP loopback, and unrelated socket roots, but it is not isolation from another malicious process already running as the same OS user. The fixed profile is parameterized with `sandbox-exec -D CBM_IPC_ROOT=...`; it is never generated dynamically.

Preflight must prove all four controls on the current runtime: IPv4 loopback denied with `EPERM`/`EACCES`, IPv6 loopback denied, a Unix socket beneath the declared root allowed, and a Unix socket outside the root denied. A launch error, refusal, or timeout is not denial proof.

## Acceptance and stopping rule

Indexed fixture file accuracy must be at least 0.90, applicable line accuracy at least 0.80, set-outcome, exact-source, and fallback accuracy must equal 1.0, and caller/callee F1 must be at least 0.80. Every one of the five independent runs must pass every coverage, retrieval, isolation, lifecycle, capacity, and headroom gate with zero unknowns or blockers; pooled averages cannot hide a failed run.

Only then may the preparation tool emit a new dry-run plan with a new run ID and digest. It must not materialize sources or execute a canonical benchmark. Owner approval must name that exact run ID, plan digest, Node runtime identity, provider identity/configuration, selected subjects, Graphify exclusion, and evidence policy.
