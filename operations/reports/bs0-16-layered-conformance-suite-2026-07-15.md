# BS0.16 Layered Conformance Suite Evidence

**Date:** 2026-07-15  
**Task:** `BS0.16 — Build the layered conformance suite`  
**Verdict:** complete  
**Scope:** deterministic Brain and targeted Mind metadata validation only

## Delivered boundary

`tools/scripts/validate-infinite-brain-conformance.mjs` composes the existing
path, contract, capability, scheduler, bridge, and safety validators and adds a
machine-checkable inventory of all canonical Brain and Mind task headings. It
reads only the canonical Mind plan and policy metadata required to validate
paths, task authority, bridge ownership, versions, and dependencies. It does
not read personal Mind content.

The suite fails closed on:

- roadmap/plan version mismatch;
- duplicate or missing canonical task IDs;
- roadmap task references absent from implementation plans;
- stale canonical success, failure, or task-authority paths;
- unsafe compatibility defaults;
- unsupported live Save-to-Mind state claims;
- an expanded Workbench tool or nested migration scope;
- ambiguous legacy MCP authority;
- provider revision or artifact-digest drift;
- a failure in any composed conformance layer.

`--inventory-json` emits the required task inventory fields: ID, title,
repository, status/state, dependencies, evidence paths, implementation paths,
validation status, blocker, and next action.

## Deliberately stale fixture

`tools/fixtures/infinite-brain-conformance/stale-metadata.json` mutates six
independent invariants: Brain plan version, roadmap task title, Mind success
intake, compatibility default safety, unsupported live deployment state, and
Workbench nested command scope. The focused test proves that every mutation
produces its exact declared error code.

## Validation

```text
node --test tools/scripts/validate-infinite-brain-conformance.test.mjs
tests=4 pass=4 fail=0

node tools/scripts/validate-infinite-brain-conformance.mjs
layers=6
commands=11
brain_tasks=67
mind_tasks=36
errors=0
network_access=false
personal_mind_content_read=false
```

All composed validators passed. The suite reports one non-failing external
truth drift: Mind `MS0.9` remains `pending` in the canonical implementation
plan while its dated evidence report says it is blocked. Mind was not modified.

## Safety result

No credential or environment file was read. No n8n request, webhook, fixture,
migration, deployment, restart, grant change, schedule change, external write,
Mind write, or Workbench write occurred. The Workbench provider-root check read
committed artifact bytes solely to verify the Brain admission digests.

## Next task

`BS0.17 — Implement exact-scope approval semantics` is now the exact next
executable repository-only Brain task. It was not started in this batch.
