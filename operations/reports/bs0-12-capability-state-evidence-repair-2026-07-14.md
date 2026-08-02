# BS0.12 Capability-State Evidence Repair — 2026-07-14

**Status:** complete — bounded repair and revalidation only.

## Defects repaired

The original validator proved file existence but did not prove that a
capability’s `contractId` was registered, its implementation paths existed, or
its dependencies resolved to a capability or registered contract. This left a
broken evidence chain capable of passing validation.

The Graphify capability also retained the stale blocker `BS0.15 pending` after
BS0.15 completed. It now points to the contained Graphify profile and
validator, records `safetyState: verified`, preserves deployment/observation/
live state as `unknown`, and records the actual deferred contained-runner
blocker.

## Repair

- `tools/validate-capability-state.mjs` now binds contract IDs to the contract
  registry; validates implementation/evidence paths; validates dependencies;
  requires validation commands for verified safety; and reports
  `evidence-chain=bound` only when the complete chain passes.
- Focused tests now prove that an unregistered contract and missing
  implementation path fail closed, alongside the previous duplicate, stale,
  candidate/deployed, and generated-evidence failures.

## Revalidation

```text
node tools/validate-capability-state.mjs -> pass, evidence-chain=bound
node --test tools/validate-capability-state.test.mjs -> 2 passed
node tools/generate-capability-manifest.mjs -> pass
node --test tools/generate-capability-manifest.test.mjs -> 3 passed
node tools/validate-infinite-brain-contract-registry.mjs -> pass
node tools/validate-infinite-brain-contract-layers.mjs -> pass
git diff --check -> pass
```

Mind remained read-only and unchanged; its status hash is
`4a865c3c81a14ca9319df2d67a10aa98edcc245baf41bb32a4941e1aaaf1f0dc`.
No roadmap task was begun, and no scheduler, deployment, n8n, credential, or
external action occurred.
