# B8.1 v7w Marker Diagnosis

**Date:** 2026-08-09
**Rejected run:** `b8-1-canonical-authorization-20260809-final-v7w`
**Immutable evidence SHA-256:** `ff36efca08deb8e38fa126c07cb29f70112328c6f718801266e0b2fdfdd88e85`
**Disposition:** Brain harness defects repaired; v7w remains rejected and immutable

## Proven root cause

The CBM v0.9.0 provider indexed and incrementally reindexed the disposable
source correctly. Its full-mode `search_code` result returned the marker in the
exact target file under the `source` field. Brain's marker validator inspected
only a fake-adapter `text` field, so every live result failed the content check
and returned the non-diagnostic `marker not visible after reindex: unknown`.

The first post-repair real-provider proof reached the next fail-closed gate and
proved a second harness mismatch. CBM v0.9.0 ignores `XDG_CACHE_HOME` for its
index database and uses `CBM_CACHE_DIR`; the harness measured the former, so it
would have reported zero cache bytes despite successful cross-process marker
retrieval.

Neither issue is a provider indexing defect. Both are Brain-owned invocation
and result-validation defects.

## Repair

- Marker validation now accepts CBM v0.9.0's `source` field while retaining the
  existing `text` compatibility path and exact relative-file match.
- A parsed but non-matching query now returns the explicit reason
  `no exact marker match in query results`.
- Child invocations receive a harness-derived `CBM_CACHE_DIR` fixed to the
  already validated isolated cache directory. Callers cannot override it.
- Provenance records the cache-binding environment variable.
- The deterministic regression fixture now matches the live v0.9.0 result
  contract and verifies the derived cache binding.

## Isolated real-provider proof

The repaired harness ran against the pinned CBM v0.9.0 binary and the fixed
B8.1 network-deny sandbox using a disposable owner-only source, home, cache,
config, and temp tree under the approved Brain benchmark diagnostics root.

- incremental harness result: success;
- marker visible in the exact target file: true;
- initial-index, incremental-reindex, and marker-query measurements: present;
- attributable isolated cache bytes: `1802240`;
- source restored byte-for-byte: true;
- restoration verification: true;
- diagnostic tree removed: true;
- lingering CBM process: none observed;
- credentials, client registration, Graphify, canonical sources, and Mind:
  untouched.

The six focused B8.1 suites passed `269/269`. The original v7w run was not
rerun, its evidence was not modified, and its consumed approval was not reused.
A new implementation identity, run ID, dry-run plan, digest, receipt, and fresh
owner approval are required before another canonical benchmark execution.
