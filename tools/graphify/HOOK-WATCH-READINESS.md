# Graphify Hook and Watch Readiness

This document explains the current state of Graphify hook and watch support and what must happen before they can be enabled.

## Current Status

**Hook and watch are DISABLED by default and remain disabled.**

This is enforced at the schema level: the Graphify profile schema requires `enabled: false` for both hook and watch fields. No profile can be created that enables them without explicit feature flag support and approval.

## Safety Model

### Schema-Level Enforcement

The profile schema (`graphify-profile.schema.json`) enforces:

```json
{
  "hooks": {
    "enabled": { "type": "boolean", "const": false },
    "postCommit": { "type": "boolean", "const": false },
    "postCheckout": { "type": "boolean", "const": false }
  },
  "watch": {
    "enabled": { "type": "boolean", "const": false }
  }
}
```

The `"const": false` constraint is immutable—profiles cannot override it without changing the schema.

### Profile Examples

All example profiles in `graphify-profile.examples.json` demonstrate disabled hooks/watch:

- `brain-runtime`: hooks disabled, watch disabled
- `mind-knowledge`: hooks disabled, watch disabled
- `code-app`: hooks disabled, watch disabled

No example enables hooks or watch.

### Feature Flags

Future hook/watch enablement will require explicit environment variables:

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_HOOKS=true
GRAPHIFY_ORCHESTRATOR_ENABLE_WATCH=true
```

These flags are separate from execution and selector resolution flags:

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true
GRAPHIFY_ORCHESTRATOR_ENABLE_SELECTOR_RESOLUTION=true
```

## When Hooks/Watch Can Be Enabled

Hook and watch execution may be considered for enablement only after:

1. **Stable manual execution**: `--operation update --execute` is tested and stable on Brain and Mind
2. **Stable scheduled execution**: Scheduler candidates run reliably with approval gates
3. **Full selector integration**: AI Model Selector is fully integrated for full/critical rebuilds
4. **Comprehensive testing**: Extensive testing on Brain-only, then Mind-only, then code-app repos
5. **Explicit user approval**: User consciously opts into hook/watch via environment variable + scheduler UI approval
6. **Rate limiting proven**: Hooks/watch do not exceed local CPU/IO capacity (max 4 runs/hour, 30s debounce minimum)
7. **Rollback procedures**: Documented procedures exist to disable hooks/watch immediately if needed

## What Hook/Watch Would Do (Future)

When eventually enabled, hooks and watch would:

- Run only `--operation update` (incremental, lightweight)
- Respect profile exclusions (no node_modules, .git, dist, build, etc.)
- Write only to `runtime/local/graphify/` (no source mutations)
- Rate-limit to max 4 runs per hour
- Debounce file changes by 30 seconds minimum
- Report status through Brain Core and Brain Console
- Never enable full or critical rebuilds automatically
- Never call AI providers directly

## Readiness Validation

Run the hook/watch readiness test to confirm the safety model:

```bash
node operations/tests/graphify-hook-watch-disabled.test.mjs
```

This test verifies:

- Schema enforces `enabled: false`
- All examples have hooks/watch disabled
- Default fields cannot be overridden by profiles

## Documentation

For more detail, see:

- `operations/specs/graphify-hook-watch-plan.md` — Full O8 planning
- `operations/specs/graphify-profile.schema.json` — Schema definition
- `operations/specs/graphify-profile.examples.json` — Example profiles

## Decision

Hook and watch are not enabled yet. They remain in the planning phase. Users should not expect hook or watch behavior to appear automatically. Any future enablement will be explicit, documented, and require multiple safety gates.
