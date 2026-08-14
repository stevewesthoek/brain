# AI Model Selector Runtime

Canonical configuration and runtime source for Brain's local routing service at
`127.0.0.1:4890`.

## Current text policy

- `claude-bedrock` is the primary managed text provider.
- `codex-cli` is the secondary managed text provider.
- Brain owns no always-on Ollama, MTPLX, Qwen, Gemma, Llama, or other local text
  server.
- Whisper providers remain optional media-transcription surfaces only.
- Private Mind classification is restricted to `claude-bedrock` and
  `us.anthropic.claude-sonnet-4-6`, with `private=true`, `sensitive=true`, and
  `fallback_policy=none`.
- Graphify structural navigation is retired. Its bounded semantic event gate has
  no default model and does not require a local text provider.

Historical architecture documents may describe earlier local-text experiments;
they are not current operating instructions.

## Runtime contract

Consumers request routing metadata from:

```text
POST /select
```

Consumers report execution outcomes to:

```text
POST /report-success
POST /report-failure
```

Status and model-access evidence are available from:

```text
GET /health
GET /health/matrix
GET /health/matrix?probe=1
```

The default health matrix is cache-backed. `?probe=1` may contact admitted
providers and is not a dry-run operation.

## Configuration ownership

Committed source:

```text
config/ai-providers.json
config/ai-bedrock-models.json
config/ai-task-types.json
config/ai-selector-config.json
runtime/core.py
runtime/selector_service.py
```

Generated runtime copies live under `~/.config/video-orchestrator/`. Circuit
breakers, rate limits, Bedrock access probes, learned outcomes, and audit logs
stay local-only under `~/.local/video-orchestrator/`.

No provider API keys are returned from `/select`. AWS and Codex authentication
remain in their normal local credential stores and are never committed.

## Fallback semantics

- `selector_default`: selector ranking.
- `ordered` / `ordered_then_selector_default`: prefer the declared order, then
  widen to normal selector ranking.
- `ordered_strict`: restrict selection to all declared preferred providers.
- `none`: allow only the first declared preferred provider; if unavailable,
  return no provider. Unknown policy names are rejected.

## Apply and validate

Use the workstation configuration tooling or host-activation runbook to generate
runtime copies. Do not hand-copy LaunchAgents or run `launchctl` as part of a
read-only validation.

Repository validation:

```bash
npm run validate:local-text-policy
python3 -m unittest discover -s operations/system-configs/model-selector/tests -p 'test_*.py'
```

Read-only service inspection, when the service is already running:

```bash
curl -sS http://127.0.0.1:4890/health
curl -sS http://127.0.0.1:4890/health/matrix
```

Do not start, stop, or probe a provider merely to validate repository source.
