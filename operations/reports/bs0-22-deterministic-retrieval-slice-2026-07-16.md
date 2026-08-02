# BS0.22 — Deterministic retrieval vertical slice

**Date:** 2026-07-16  
**Status:** implemented; validation passed

Implemented an isolated read-only `projects/mind-context/` core with shared fixture loading, exact path/scope filtering, deterministic ordering, citations, hashing, freshness, authority comparison, conflicts, unknowns, exclusions, privacy, budgets, truncation, traversal/symlink safety, and untrusted-source handling.

No adapter, scheduler, MCP, API, Console, model, Mind, credential, network, or external integration was added.

Validation passed with `node --test projects/mind-context/test/retrieval-core.test.mjs` and `node --check` on the new `mind-context` implementation files.
