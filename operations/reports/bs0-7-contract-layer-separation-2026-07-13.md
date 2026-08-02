# BS0.7 — Contract layer separation

**Execution date:** 2026-07-14  
**Status:** complete  
**Verdict:** PASS — the required mixed contract families now have explicit policy, schema, validator, configuration, evidence, compatibility, and unresolved-decision layers without changing Mind or runtime behavior.

## Mixed contracts separated

The machine-readable map covers automation, maintenance, Graphify,
folder/path, task authority, the Brain–Mind bridge, generated output,
capability state, and Save-to-Mind deployment status.

For every family it identifies:

- a Mind-owned normative source;
- a Brain-owned executable schema and validator;
- a typed Brain runtime-configuration source or explicit `not-applicable`;
- deployment, observed, and verified evidence as separate states;
- compatibility path IDs from the canonical path registry;
- deprecation state and any remaining human authority decision.

## Separation decisions

- Mind policy never becomes direct runtime configuration.
- Repository configuration is not deployment state; repository validation is
  not live verification.
- Save-to-Mind remains a repository candidate with B1.0a incomplete, not a
  deployed or verified workflow.
- Generated Graphify and maintenance output remains evidence/non-authoritative
  output, never normative policy.
- Compatibility entries cannot satisfy canonical write/default policy.
- The human-readable status page now points to the layer map and cannot elevate
  candidate/repository state to deployed or live verified state.

## Files changed

- `operations/specs/infinite-brain-contract-layer-map.schema.json` (new)
- `operations/specs/infinite-brain-contract-layer-map.json` (new)
- `operations/specs/infinite-brain-contract-layer-separation.md` (new)
- `tools/validate-infinite-brain-contract-layers.mjs` (new)
- `tools/validate-infinite-brain-contract-layers.test.mjs` (new)
- `operations/specs/infinite-brain-contract-registry.json`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- `operations/runbooks/infinite-brain-roadmap-status.md`
- this report

## Validation

```text
node --test tools/validate-infinite-brain-contract-layers.test.mjs
# 3 pass

node tools/validate-infinite-brain-contract-layers.mjs
# layers=pass; schema_version=1.0.0; families=9
# runtime_behavior_changed=false; mind_content_read=false; network_access=false

node tools/validate-infinite-brain-contract-registry.mjs
node tools/mind-canonical-path-registry.mjs validate
# both pass

JSON parse and git diff --check
# pass
```

Negative tests fail closed when a candidate claims deployed/verified state, a
Mind document is used as runtime configuration, a generated Brain report is
used as normative authority, a validator has contradictory ownership, observed
evidence lacks timestamp/provenance, or a canonical path is inserted into a
compatibility layer.

## Deprecation and unresolved decisions

No contract was deleted or retired. Existing documents remain in place and the
registry records that the layer map replaces no Mind policy or runtime consumer.
The missing ProChat OS strategy file, capability-state schema/generator,
Graphify profile/retention conformance, M1.4 task migration, and B1.0a live
routing verification remain explicitly unresolved or deferred.

## Safety confirmation and next task

Mind remained read-only. No runtime consumer, scheduler, workflow, deployment,
environment value, credential, external system, or generated runtime artifact
was changed. BS0.1–BS0.4 containment and B1.0a's incomplete status remain
unchanged.

P0/P1 stabilization is complete. The exact next documented task is **BS0.8 —
Migrate Mind Steward to the canonical path registry**. It was not started.

## 2026-07-14 registry-evidence reconciliation

This section records the current post-BS0.7 state without changing either
historical checkpoint. The contract registry is version `1.0.0` with **22**
entries; the canonical path registry is version `1.0.0` with **36** entries;
and the contract-layer map is schema version `1.0.0` with **9** families.

The BS0.5 report's **20** contracts is the count at that checkpoint. BS0.6
then added `canonical-path-registry`, producing its historical **21** count.
BS0.7 added `contract-layer-separation`, producing the current **22** count.
No registry semantics changed during reconciliation.

The canonical path resolver and validator is
`tools/mind-canonical-path-registry.mjs`; its focused tests are
`tools/mind-canonical-path-registry.test.mjs`. There is no
`tools/validate-infinite-brain-path-registry.mjs` file or current reference
requiring correction.

```text
node --test tools/validate-infinite-brain-contract-registry.test.mjs
# 3 pass
node tools/validate-infinite-brain-contract-registry.mjs
# registry=pass; registry_version=1.0.0; contracts=22

node --test tools/mind-canonical-path-registry.test.mjs
# 3 pass
node tools/mind-canonical-path-registry.mjs validate
# registry=pass; registry_version=1.0.0; paths=36

node --test tools/validate-infinite-brain-contract-layers.test.mjs
# 3 pass
node tools/validate-infinite-brain-contract-layers.mjs
# layers=pass; schema_version=1.0.0; families=9

# All four JSON/schema artifacts parse.
```

**Verdict:** reconciled. Historical checkpoint evidence remains accurate, and
the current registry evidence is internally consistent. B1.5 may begin.
