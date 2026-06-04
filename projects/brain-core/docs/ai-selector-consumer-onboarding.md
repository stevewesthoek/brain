# AI Selector Consumer Contract

The AI Model Selector is the single routing authority for Brain-owned AI generation calls.

Consumers do not probe providers, rank models, read provider config files, or maintain fallback order. Consumers ask the selector for a route, execute that route, and report the outcome.

## Runtime Endpoints

Selector service:

```text
POST http://127.0.0.1:4890/select
GET  http://127.0.0.1:4890/health/matrix
POST http://127.0.0.1:4890/report-success
POST http://127.0.0.1:4890/report-failure
```

Brain Core read-only surface:

```text
GET http://127.0.0.1:4877/ai-model-selector/health-matrix
```

Brain Console Center reads the Brain Core endpoint. Automation and services that need a route call the selector directly.

## Selection Request

```json
{
  "task_type": "description_quality_review",
  "input_token_count": 30000,
  "urgent": true,
  "previous_failures": [],
  "local_only": false
}
```

`task_type` must exist in `~/.config/video-orchestrator/ai-task-types.json`.

`local_only: true` sets offline and external-provider-disallowed metadata. The selector returns only local network providers.

## Selection Response

```json
{
  "provider_id": "ollama-m4pro",
  "model": "qwen2.5:14b",
  "base_url": "http://localhost:11434/v1",
  "reason": "free; priority=2",
  "cost_estimate": 0,
  "timeout_inference_sec": 120
}
```

Consumers must use the returned provider, model, base URL, and timeout. Consumers must not substitute a different provider or model.

## Outcome Reporting

On successful completion:

```json
{
  "provider_id": "ollama-m4pro",
  "model": "qwen2.5:14b"
}
```

On failure:

```json
{
  "provider_id": "ollama-m4pro",
  "model": "qwen2.5:14b",
  "error_type": "timeout",
  "error_message": "request timed out"
}
```

Allowed `error_type` values are `rate_limit`, `timeout`, and `error`.

## Health Matrix

`GET /health/matrix` returns the selector-owned provider and model state:

- provider id and type
- model id and label
- enabled status
- selectable status
- loaded status for local providers
- cached Bedrock access status
- circuit breaker state
- rate-limit state
- model outcome counters
- cost fields for priced providers

`GET /health/matrix?probe=1` runs live probes where supported. Dashboard refreshes use the cached matrix.

Consumers use the matrix for observability only. Routing still goes through `POST /select`.

## Consumer Requirements

- Pass a valid `task_type`.
- Pass `input_token_count`.
- Set `urgent` according to job latency requirements.
- Set `local_only` when external provider use is not allowed.
- Pass `previous_failures` on retry.
- Execute the selected route exactly.
- Respect `timeout_inference_sec`.
- Handle deferred responses without marking the job failed.
- Call `/report-success` after a completed job.
- Call `/report-failure` after a failed job.
- Log `provider_id`, `model`, `reason`, and `cost_estimate`.

## Boundary

The selector owns provider health, model availability, fallback order, circuit breakers, Bedrock access cache, and outcome learning.

Brain Core exposes read-only selector state for dashboards. Brain Console Center visualizes Brain Core data. Neither Brain Core nor Brain Console Center performs provider probes or provider ranking.
