# BS0.20–BS0.22 Retrieval Foundation Batch

**Date:** 2026-07-16  
**Status:** complete  
**Repository:** Brain only

## Goal

Complete the independent retrieval-foundation chain while leaving BS0.19 blocked and stopping before BS0.23:

1. BS0.20 versioned retrieval evaluation corpus;
2. BS0.21 executable context-pack schema version 1.0;
3. BS0.22 deterministic read-only retrieval core.

## Architecture boundary

A new isolated `projects/mind-context/` core will own deterministic fixture discovery, scope policy, source ordering, citations, hashing, freshness, authority comparison, conflicts, unknowns, privacy, budgets, truncation, traversal/symlink safety, and untrusted-source handling.

Schemas and fixtures live under `operations/specs/` and `operations/fixtures/`. Validation tools live under `tools/`. No CLI, API, MCP, Console, scheduler, model, Mind, or external integration is included.

## Safety

Repository-only and fixture-only. No personal Mind content, credentials, network access, external reads/writes, deletion, n8n, webhooks, deployment, restart, grants, schedules, activation, B1.0a, B1.1, BS0.23, commit, or push.

## Planned validation

- focused corpus validator tests;
- focused context-pack validator tests;
- focused retrieval-core tests;
- JSON parsing and schema/fixture conformance;
- relevant type/syntax checks;
- capability-state and provider-admission validation;
- Infinite Brain conformance;
- Markdown/path validation;
- security scans;
- `git diff --check`;
- scoped diff and unrelated-worktree review.

## Current position

BS0.19 remains blocked by unresolved Mind M1.4 task authority. BS0.20, BS0.21, and BS0.22 are complete and validated. BS0.23 remains the next adapter-only boundary and was not started.
