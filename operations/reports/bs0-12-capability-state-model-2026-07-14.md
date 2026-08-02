# BS0.12 Capability-State Model — 2026-07-14

**Status:** complete — versioned repository model; no live state is inferred.

## Artifacts

- Schema: `operations/specs/capability-state.schema.json` (`1.0.0`)
- Model: `operations/specs/capability-state.json`
- Validator: `tools/validate-capability-state.mjs`
- Deterministic tests: `tools/validate-capability-state.test.mjs`

The model holds independent configuration, deployment, observation,
verification, and safety dimensions. It includes 16 capabilities: Brain Core
API, mutable containment, Mind Steward classification, Mind sync, compile
loop, scheduler, Save-to-Mind candidate and live deployment, n8n routing,
maintenance pilot, Graphify, Context Gateway, task synchronization, controlled
writes, approval broker, and rollback/restoration.

## Fail-closed rules

The validator rejects duplicate IDs; candidate-as-deployed claims; configured
or observed promotion without evidence; verified claims based on generated
reports; missing verified evidence; stale review dates; and unknown states
presented as success. Repository verification is explicitly separate from live
verification.

## Validation

```text
node tools/validate-capability-state.mjs -> capabilities=16, pass
node --test tools/validate-capability-state.test.mjs -> 2 passed
node tools/validate-infinite-brain-contract-registry.mjs -> pass
node tools/validate-infinite-brain-contract-layers.mjs -> pass
git diff --check -> pass
```

Mind remained unmodified; its status hash is
`4a865c3c81a14ca9319df2d67a10aa98edcc245baf41bb32a4941e1aaaf1f0dc`.
No deployment, live query, credential access, or external write occurred.

## Continuation decision

**Continue to BS0.13.** The model is evidence-backed, deterministic, and does
not grant generated output or repository configuration live authority.

## Evidence-chain repair

The bounded repair at
`operations/reports/bs0-12-capability-state-evidence-repair-2026-07-14.md`
binds every capability to registered contracts and existing implementation
paths, validates dependencies, and corrects the stale Graphify BS0.15 blocker.
