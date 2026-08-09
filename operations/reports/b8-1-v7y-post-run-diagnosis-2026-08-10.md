# B8.1 v7y Post-Run Diagnosis

**Date:** 2026-08-10
**Run ID:** `b8-1-canonical-authorization-20260809-final-v7y`
**Evidence SHA-256:** `bc6406e4f15d7c0e81d69168395a23acb9c5b062f89db10c23629ae38afc0f78`
**Decision impact:** none — the canonical v7y result remains REJECTED

## Scope

This is an additive, read-only diagnosis of the preserved v7y evidence and CBM
SQLite indexes. It did not start CBM, invoke Graphify, edit benchmark evidence,
change thresholds, repair the harness, materialize a plan, or execute a
benchmark. The v7y approval remains consumed.

## Findings

### `brain_f4` — expected file absent from the CBM index

The manifest expects `tools/validate-deletion-readiness.mjs` at source SHA-256
`414c67672696e7f546f5a86ee4fb135bb900167678884f468c70a4d8e7ba96d5`.
The preserved v7y source contains that exact 10,551-byte file and matches the
manifest hash.

The preserved Brain CBM database contains:

- zero `file_hashes` rows for that path;
- zero `nodes` rows for that path;
- 22 other nodes named `main` in other files.

The fixture queried the generic pattern `main`. Because the expected file was
not present in the persisted index, it could not be returned regardless of
ranking. The evidence proves an index-coverage miss for this fixture. It does
not prove why CBM fast indexing omitted this particular file; determining the
provider-side exclusion or parsing mechanism requires a separately authorized
runtime investigation.

### `prochat_f2` — inventory expectation scored as search-result count

The fixture asks for the repository-wide count of files named `route.ts` and
expects 27. The preserved ProChat CBM database contains:

- 27 matching `file_hashes` rows;
- nodes in 27 distinct matching file paths.

The provider's persisted inventory therefore contains all expected files.
However, the executor queries `search_code` for the pattern `route.ts` and sets
the observed count to `results.length`. That ranked search returned four rows,
which the harness compared directly with the inventory expectation of 27.

This is a scoring-contract defect. A bounded ranked search result count is not
a repository file-inventory count. The v7y `prochat_f2` failure must not be
described as proof that CBM indexed only four route files.

### Aggregate accuracy metrics are not admission-grade

The read-only audit found three additional semantic gaps:

1. `lineAccuracy` divides by all ten fixtures, while `json-pointer-set` and
   `file-name-count` fixtures hard-code `lineCorrect=false` even though no line
   assertion applies. Exact-source therefore reports 80% line accuracy despite
   passing every applicable line assertion.
2. `brain_f3` reports `result=pass` and `fileCorrect=true` while its CBM
   `setAccuracy` is 0 and `actual` is null. The algorithm-specific set result
   does not control the fixture outcome.
3. CBM `callerCalleeF1` is absent even though the acceptance table requires at
   least 0.75. The evidence schema validator accepts the omission because it
   only requires F1 when caller and callee inputs are already present.

Consequently, the structurally valid evidence file is not semantically complete
for admission, and the reported CBM file/line aggregates cannot support a
future acceptance decision without a new scoring contract. This strengthens
the rejection; it does not reinterpret the run as accepted.

### Resource failures remain independently valid

The accuracy-contract defects do not change the measured resource failures:

- Brain incremental refresh: 1,150 ms, above 500 ms;
- Workbench incremental refresh: 530 ms, above 500 ms;
- aggregate CBM peak RSS: 572.75 MB, above 512 MB.

The evidence stores peak RSS as a subject aggregate rather than attributing it
to one repository/stage, but the aggregate still exceeds the canonical limit.

## Integrity checks

Read-only SQLite inspection left the preserved databases unchanged:

- Brain database SHA-256 before/after:
  `65c82604685369180ae866b206590c5e721305d8f98b35f45c28c11940d22264`;
- ProChat database SHA-256 before/after:
  `a7fcbb2229c142041c1d583f43edbc52f662a7d2a9cab21c43518722efe02aeb`.

The canonical evidence, execution receipt, and cleanup receipt hashes remain
unchanged. No benchmark marker, `.codebase-memory/` source directory, CBM
process, or Graphify process was present after the audit.

## Required next authorization

B8.1 remains incomplete, B8.2–B8.6 remain blocked, and P8 remains 0/6
accepted. No repair or rerun is authorized.

Before any future canonical plan is prepared, the owner must separately
authorize an investigation/repair tranche that:

1. proves why `brain_f4` is omitted from the CBM fast index;
2. replaces ranked-search row counting with a valid inventory measurement or
   changes the fixture contract without weakening the intended capability;
3. scores only applicable file/line/set metrics with correct denominators and
   algorithm-specific outcome gates;
4. produces and requires CBM caller/callee F1 evidence;
5. preserves the existing thresholds, source pins, Graphify exclusion, and
   immutable v7w/v7x/v7y runs;
6. validates the repair with real isolated CBM before preparing a new unique
   plan, digest, and run ID for fresh exact owner approval.
