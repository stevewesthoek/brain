# Infinite Brain Contract-Layer Separation

The machine-readable map at `infinite-brain-contract-layer-map.json` separates
Mind-owned human policy from Brain-owned executable schemas and validators.
For each family it records typed runtime configuration, deployment evidence,
observed evidence, verified evidence, compatibility paths, deprecation state,
and unresolved owner decisions.

The map is descriptive and conformance-oriented. It does not supersede Mind
policy, authorize writes or deployment, or migrate a runtime consumer.

Validate it with:

```text
node tools/validate-infinite-brain-contract-layers.mjs
node tools/validate-infinite-brain-contract-registry.mjs
```
