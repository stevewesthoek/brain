# Infinite Brain Canonical Path Registry

`infinite-brain-path-registry.json` is Brain-owned executable metadata for
path consumers. It reflects Mind-owned path meaning; it does not replace the
Mind folder, task, generated-output, or repository-boundary contracts.

The registry distinguishes canonical paths, scoped compatibility exceptions,
historical paths, generated output, future targets, and external integration
names. Repository, deployed, observed, and verified state are separate fields.

Use only the read-only helper:

```text
node tools/mind-canonical-path-registry.mjs validate
node tools/mind-canonical-path-registry.mjs classify <path-token>
node tools/mind-canonical-path-registry.mjs resolve <canonical-path-id>
node tools/mind-canonical-path-registry.mjs deletion-prerequisites <path-token>
```

The helper does not read Mind content, environment values, credentials, or the
network. It is not yet wired into Brain Core or Mind Steward; that migration is
explicitly deferred to BS0.8–BS0.10.
