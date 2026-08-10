# B8.1 post-v7y harness repair and provider disposition

Date: 2026-08-10
Status: **bounded noncanonical repair validated; no provider currently qualifies**

## Authorization boundary

This tranche repaired and tested the B8.1 executor in Brain and evaluated CBM provider
versions in disposable state. It did not materialize or execute a canonical benchmark,
invoke Graphify, modify Mind, replace the installed CBM v0.9.0 binary, or push.

The previously prepared v7z package is now stale. Its bound executor SHA-256 is
`620fcc67f0448824a02b3066b41e226c4abe2d4fba360309eca03b549d4477ac`, while the repaired
executor SHA-256 is `ea27a452c17d61c3fa4d246559b36c3cf11c1ad3ad06ef7ee84cebeb13a99485`.
No replacement package was prepared because canonical plan work is not authorized and the
current provider still fails hard gates.

## Repaired executor defects

### Deterministic line-result selection

The executor previously selected the first search result in the expected file. Real v0.9.0
output for `MIND_TARGET_PATHS` returned an unrelated same-file function first and the exact
`Variable` result later at line 21. The executor now ranks same-file results by:

1. exact expected symbol;
2. exact provider-reported match line;
3. a node range containing the expected line;
4. the existing ±5-line tolerance;
5. same-file fallback.

Line scoring uses every reported `match_lines` entry. A broad non-symbol node range cannot
fabricate a passing line result, and file matching requires an exact relative path or a path
suffix boundary.

### Truthful structural queries

The executor previously used unlabeled target/source patterns and treated every module import
as a caller of the fixture symbol. It now:

- validates the provider node label against a fixed allowlist before Cypher interpolation;
- binds that label on the target and source node;
- uses `CALLS` for `Function`/`Method`/`Route`, `IMPORTS` for `Module`, and `USAGE` for other
  admitted structural labels;
- counts import caller evidence only when `r.local_name` equals the expected symbol;
- returns zero structural evidence when the expected symbol was not retrieved, rather than
  issuing an unbounded or guessed-label query.

```text
search_code results
        |
        v
same-file filter -> exact-symbol/line selection -> file + line evidence
                              |
                              v
                       validated node label
                              |
                              v
             labeled semantic query_graph calls
                              |
                              v
                  caller/callee set scoring
```

## Validation

- Node: v20.20.2, SHA-256
  `38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`.
- Focused executor tests: **76/76 pass**.
- Complete B8.1 test set with `--test-concurrency=1`: **288/288 pass**. A concurrent
  multi-file run first exposed an unrelated temporary-directory collision in an untouched
  manifest test (287/288); that test passed alone (38/38) and the full serial run passed.
- Test file SHA-256:
  `19b35e9728f7114f2deaa025e4dabee54f30a831ccccd21e7dd19c4682ada20c`.
- Real isolated CBM v0.9.0 validation reused the disposable Brain cache under the fixed
  network-deny sandbox; no reindex or canonical run occurred.

| Fixture | File | Line | Set | Caller P/R | Callee P/R | Outcome |
|---|---:|---:|---:|---:|---:|---|
| `brain_f1` | pass | pass | n/a | 0.20 / 1.00 | 0.00 / 0.00 | pass |
| `brain_f2` | pass | pass | n/a | 1.00 / 0.50 | 0.50 / 1.00 | pass |
| `brain_f3` | pass | n/a | 1.00 | 0.00 / 0.00 | 0.00 / 0.00 | pass |
| `brain_f4` | fail | fail | n/a | 0.00 / 0.00 | 0.00 / 0.00 | fail |

These results repair the false line failures for `brain_f1` and `brain_f2`. They do not make
the provider admissible: `brain_f4` remains omitted by fast mode, and the structural results
show that the current fixture truth sets are not exhaustive.

For example, the labeled provider query reports six real callees for
`classifyMindCaptureInbox`: `resolveMindCaptureExecutionMode`, `listCaptureFiles`,
`parseMarkdown`, `selectLocalModel`, `estimateTokens`, and `classifyWithLocalModel`. The
manifest lists only the latter three, so truthful provider output receives a callee precision
of 0.50. Likewise, several modules genuinely import `MIND_TARGET_PATHS`, while `brain_f1`
lists one expected caller. Filtering provider predictions to the manifest would hide valid
relationships and was explicitly rejected.

## Provider disposition

Installed v0.9.0 remains unchanged at SHA-256
`d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`.
Supported-control experiments and repeated disposable rehearsals show:

- fast mode omits top-level `tools`, so `brain_f4` cannot pass;
- full mode restores `brain_f4` but violates the 10-second and 512-MiB gates;
- fast-mode Brain peak RSS varied above the 512-MiB gate and refresh-to-queryability was
  approximately 1.15 seconds, above the 500-ms gate;
- `CBM_WORKERS=1` worsened peak RSS to approximately 1.05–1.14 GiB.

The official v0.9.1-rc.1 candidate was also rejected. Fast mode took 7.623 seconds but omitted
`tools` and peaked at 568.484 MiB. Full mode indexed `brain_f4` but took 10.071 seconds and
peaked at 984.563 MiB. Its stateful CLI also depends on daemon Unix-socket IPC that cannot
operate under the fixed `(deny network*)` sandbox. Full evidence is in the disposable
`provider-version-eval-main-XCpM10/evaluation-report.md` diagnostic report.

## Failure modes and coverage

| Failure mode | Test/error handling | User-visible result |
|---|---|---|
| Earlier unrelated same-file result wins | E70 regression test | Correct later symbol is selected |
| Provider line appears only in a later `match_lines` entry | E71 | Line is scored correctly |
| Broad Module range hides a missing symbol | E75 | Line remains false |
| Similar path prefix produces a false file match | E76 | No result selected |
| Provider label contains unsafe Cypher text | E74 + allowlist | Explicit structural error |
| Expected structural target is absent | E74 | Zero evidence, no guessed query |
| Unrelated imports inflate callers | E73 | Only symbol-matched imports count |

No changed path lacks both a test and explicit error handling.

## What already exists

- Existing bounded subprocess, timeout, output-limit, synthetic-HOME, and sandbox enforcement
  are reused unchanged.
- Existing `scorePredictedSet`, applicability filtering, set scoring, and evidence aggregation
  are reused unchanged.
- The provider's own `label`, `match_lines`, and semantic relationship types are consumed
  directly; no parallel parser or source-analysis substitute was introduced.

## Not in scope

- Canonical plan, digest, dry-run receipt, materialization, or execution: expressly forbidden.
- Manifest caller/callee truth-set changes: require an owner-approved fixture-semantics decision.
- Threshold changes or filtering predictions to expected values: would weaken the benchmark.
- `.cbmignore` overlay such as `!tools/`: changes the exact source/config contract and still
  does not solve RSS or refresh failures.
- Provider replacement: v0.9.1-rc.1 failed admission; installed v0.9.0 remains intact.
- Graphify, Mind, and push: excluded.

## Required owner decisions before any fresh package

1. Choose a provider/version that includes the required `tools` path in a <=10-second mode,
   stays below 512 MiB with margin, refreshes through queryability within 500 ms with margin,
   and works inside the admitted network-deny boundary.
2. Define exhaustive structural truth sets (or a different explicitly approved structural
   scoring contract) so valid additional relationships are not scored as false positives.
3. If a provider configuration overlay is desired, explicitly authorize the source/config
   contract change and a new disposable evaluation first.

Until those decisions are made and repeated disposable all-repository rehearsals pass every
gate with margin, preparing a fresh canonical dry-run authorization package would be premature.
