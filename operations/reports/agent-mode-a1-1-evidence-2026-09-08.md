# Agent Mode A1.1 evidence — 2026-09-08

## Result

**A1.1 canonical provider identity migration: PASS for offline/runtime
normalization.** The generic managed Bedrock transport is now identified as
`amazon-bedrock`. Anthropic, MiniMax, and Z.ai remain model/vendor metadata;
they are not provider IDs. The retired `claude-bedrock` spelling is accepted
only at explicit compatibility boundaries and is normalized before selection,
state lookup, registry comparison, or managed execution.

No live Bedrock request, AWS access probe, credential change, host mutation,
package installation, or billable inference was performed.

## Changes

- Canonicalized `ai-providers.json`, `ai-task-types.json`, and the parity
  registry to `amazon-bedrock`.
- Added Python and TypeScript provider-identity helpers with a single bounded
  legacy alias.
- Normalized Python selector config loads, request metadata, previous failures,
  report-success/report-failure calls, registry shadow comparisons, and
  registry lifecycle lookups.
- Normalized TypeScript registry loading, provider/model reference resolution,
  selector responses, managed provider execution, managed text routing, Brain
  route types, executor plans, capability manifests, cost summaries, and
  Mind/video consumers.
- Kept the registry's provider compatibility alias explicit so migration input
  remains observable rather than silently becoming a second provider.
- Added the exact MiniMax M2.5 → GLM-5 → Claude Opus 4.6 Agent Mode ladder as
  an offline-only, non-selectable portfolio fixture with canonical Bedrock
  transport identity and explicit model/vendor metadata.

## Validation

- `node tools/validate-ai-model-registry.mjs` — pass; 4 providers, 16 models.
- `node tools/validate-local-text-inference-policy.mjs` — pass.
- `npm run typecheck` from `projects/brain-core` — pass.
- Brain Core focused route/selector/executor tests — 232 pass.
- Model-selector Python suite — 52 pass.
- Python syntax compilation for the selector runtime — pass.
- Agent Mode portfolio fixture test — pass; three exact model IDs, ordered
  worker/senior/principal roles, and `live_enabled=false`.
- Legacy provider/model request compatibility resolves to canonical output;
  current config and registry contain no generic `claude-bedrock` provider.

## Remaining A1 work

A1.1 does not authorize live access probes or model selection based on probe
side effects. A1.2 must make route selection pure and keep account/credential,
region, exact model/profile binding, and freshness evidence separate. The
fixed Agent Mode portfolio remains policy-driven and must add exact offline
route fixtures for MiniMax M2.5 → GLM-5 → Claude Opus 4.6 before live admission.
