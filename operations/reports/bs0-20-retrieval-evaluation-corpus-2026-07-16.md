# BS0.20 — Retrieval evaluation corpus

**Date:** 2026-07-16  
**Status:** implemented; validation passed

Created a synthetic versioned corpus (`1.0.0`) with 12 deterministic cases covering exact answers, conflicts, stale sources, forbidden and out-of-scope sources, unknowns, privacy, citation failure, contradictions, budgets, path escape, and untrusted policy-like text.

Artifacts:

- `operations/specs/retrieval-evaluation-corpus.schema.json`
- `operations/fixtures/retrieval-evaluation-corpus-v1.json`
- `tools/validate-retrieval-evaluation-corpus.mjs`
- `tools/validate-retrieval-evaluation-corpus.test.mjs`

Validation passed with `node tools/validate-retrieval-evaluation-corpus.mjs` and `node --test tools/validate-retrieval-evaluation-corpus.test.mjs`.

No personal Mind content, credentials, network access, or external data was used.
