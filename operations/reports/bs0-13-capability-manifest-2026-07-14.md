# BS0.13 Capability Manifest — 2026-07-14

**Status:** complete — deterministic read-only manifest generation.

## Manifest and evidence behavior

`tools/generate-capability-manifest.mjs` emits the canonical bounded JSON
manifest to stdout. This is deliberately a read-only stream, not a runtime
artifact or normative source. It consumes only the capability-state model,
contract registry, path registry, and declared repository-relative evidence;
it does not invoke validation commands, query services, read `.env`, read
credentials, invoke n8n, or run jobs.

Each entry retains independent configured, deployed, observed, verified, and
safety-contained fields; hashes present evidence; preserves missing evidence;
sorts capabilities and collections deterministically; and sets `liveState` to
`unknown`. A repository candidate can never be emitted as deployed.

## Validation

```text
node tools/generate-capability-manifest.mjs -> pass
node --test tools/generate-capability-manifest.test.mjs -> 3 passed
node tools/validate-capability-state.mjs -> pass
node tools/validate-infinite-brain-contract-registry.mjs -> pass
node tools/validate-infinite-brain-contract-layers.mjs -> pass
git diff --check -> pass
```

The tests prove identical fixtures emit identical output, a changed evidence
source changes its SHA-256, and credential-shaped evidence is rejected. Mind
was not modified (status hash:
`4a865c3c81a14ca9319df2d67a10aa98edcc245baf41bb32a4941e1aaaf1f0dc`).

## Continuation decision

**Continue to BS0.14.** The manifest is evidence-backed and bounded; it makes
no deployed, observed, verified-live, or normative-authority claim.
