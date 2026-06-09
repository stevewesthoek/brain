# AI Model Selector Runtime

Canonical runtime snapshot for the local AI Model Selector service.

## Gemma 4 Local Model Support

Gemma 4 is a model family served through Ollama. Both M4 Pro and M1 nodes support selective Gemma 4 models:

**M4 Pro targets:**
- `gemma4:e4b` (4B expert-style, fast)
- `gemma4:12b` (12B, balance of speed and quality)

**M1 targets:**
- `gemma4:e4b` (4B expert-style, fits within memory constraints)
- `gemma4:12b` (conditional on available memory)

Future candidates (not in default rollout):
- `gemma4:26b` (M4 Pro only, requires dedicated headroom)
- `gemma4:31b` (M4 Pro only, requires dedicated headroom)

Install commands:

On M4 Pro:
```bash
ollama pull gemma4:e4b
ollama pull gemma4:12b
```

On M1:
```bash
ollama pull gemma4:e4b
ollama pull gemma4:12b
```

Verification:

```bash
# Check M4 Pro local models
curl -sS http://127.0.0.1:11434/api/tags | jq '.models[].name | select(. | contains("gemma4"))'

# Check M1 models from M4 Pro
curl -sS http://192.168.2.2:11434/api/tags | jq '.models[].name | select(. | contains("gemma4"))'

# Test selector routing with Gemma 4
curl -sS http://127.0.0.1:4890/health/matrix | jq '.models[] | select(.model_id | contains("gemma4"))'

# Test task-level routing
curl -sS -X POST http://127.0.0.1:4890/select \
  -H 'Content-Type: application/json' \
  -d '{"task_type":"metadata_generation","input_token_count":8000,"urgent":true,"local_only":true}'
```

The LaunchAgent in `operations/system-configs/launchagents/com.office.ai-model-selector.plist` runs:

```text
operations/system-configs/model-selector/runtime/selector_service.py
```

Runtime configuration is copied to:

```text
~/.config/video-orchestrator/
```

Committed runtime config source:

```text
operations/system-configs/model-selector/config/ai-providers.json
operations/system-configs/model-selector/config/ai-bedrock-models.json
operations/system-configs/model-selector/config/ai-task-types.json
operations/system-configs/model-selector/config/ai-selector-config.json
```

State and audit files stay local-only:

```text
~/.local/video-orchestrator/state/
~/.local/video-orchestrator/logs/
```

## Runtime Contract

The selector owns provider discovery, model availability, fallback order, circuit breakers, Bedrock access checks, and model outcome learning.

The selector also owns local resource admission for local LLM tasks. Local OpenAI-compatible providers on `localhost` are checked for macOS memory pressure, load average per CPU, loaded Ollama models, model availability, circuit state, and rate-limit state before selection. Consumers do not choose a local model directly.

Consumers use one routing endpoint:

```text
POST /select
```

Consumers report execution outcomes:

```text
POST /report-success
POST /report-failure
```

Consumers read selector status from:

```text
GET /health
GET /health/matrix
GET /health/matrix?probe=1
```

`GET /health/matrix` is the canonical health matrix for dashboards and service observability. It returns provider entries, model entries, selectable status, cached probe state, circuit state, rate-limit state, outcome counters, and pricing metadata. The default matrix is cache-backed and fast. `?probe=1` runs live model probes where supported.

Brain Core exposes the same matrix for dashboards at:

```text
GET http://127.0.0.1:4877/ai-model-selector/health-matrix
```

Brain Console consumes Brain Core. It does not probe providers directly.

## Local Resource Guard

`codebase_semantic_graph` is the Graphify semantic extraction task. It is local-only and requires `local_only=true` on `/select`.

The task prefers `qwen2.5:32b` and falls back to `qwen2.5:14b`. The 32B model is selectable only when the local burst policy passes:

```text
max_load_per_cpu <= 0.75
macOS memory_pressure free percentage >= 60
no other Ollama model is already loaded
```

The 14B fallback requires `memory_pressure` free percentage >= 30 and the same load policy. If no local model passes the guard, `/select` returns no provider and the consumer must skip or retry later.

## Bedrock Portfolio

`config/ai-bedrock-models.json` is the canonical model roster for the Bedrock value portfolio. The live copy is `~/.config/video-orchestrator/ai-bedrock-models.json`.

The selector validates each enabled Bedrock model with a tiny cached `bedrock-runtime converse` probe before selecting it. Access cache and model outcome learning are local runtime state, not committed source.

Provider configs fail closed: only `bedrock`, `cli`, `openai-compatible`, `whisper`, and `whisper-remote` provider types are accepted. Direct OpenAI/Anthropic API provider types are intentionally rejected unless a future explicit provider adapter is added. `/select` responses return routing metadata only and do not expose provider API keys.

Premium Claude fallback keeps Opus 4.6 enabled as the callable Opus-tier model. Opus 4.7 is configured as a disabled `upgrade_candidate` with a 48-hour access probe TTL; once the probe succeeds, it becomes selectable automatically and scores above Opus 4.6.

## Manual Terminal Launchers

Manual terminal selection stays at the runtime layer. The `repos` launcher offers:

```text
Claude
Codex
Gemini
```

Claude launches from `repos`, `sessions`, and the shell `claude` wrapper source `tools/scripts/claude-bedrock-env.sh` immediately before startup and pass the `haiku` alias explicitly, so stale shells or persisted Opus/Sonnet selections do not control new sessions. The Bedrock env supplies dynamic clean labels for the Claude Code `/model` picker, such as `Haiku 4.5`, `Sonnet 4.6`, and `Opus 4.6`. It does not expose Qwen, Nemotron, DeepSeek, Kimi, or gpt-oss as manual top-level choices. Those remain behind the AI Model Selector for structured app/workflow calls.

## Apply Runtime Config

```bash
cp operations/system-configs/model-selector/config/ai-providers.json ~/.config/video-orchestrator/ai-providers.json
cp operations/system-configs/model-selector/config/ai-bedrock-models.json ~/.config/video-orchestrator/ai-bedrock-models.json
cp operations/system-configs/model-selector/config/ai-task-types.json ~/.config/video-orchestrator/ai-task-types.json
cp operations/system-configs/model-selector/config/ai-selector-config.json ~/.config/video-orchestrator/ai-selector-config.json
cp operations/system-configs/launchagents/com.office.ai-model-selector.plist ~/Library/LaunchAgents/com.office.ai-model-selector.plist
launchctl stop com.office.ai-model-selector 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.office.ai-model-selector.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/com.office.ai-model-selector.plist
launchctl start com.office.ai-model-selector

# After updating config, verify the selector is running
sleep 2 && curl -sS http://127.0.0.1:4890/health
```

## Verify

```bash
curl -sS http://127.0.0.1:4890/health
curl -sS http://127.0.0.1:4890/health/matrix
curl -sS -X POST http://127.0.0.1:4890/select \
  -H 'Content-Type: application/json' \
  -d '{"task_type":"description_quality_review","input_token_count":30000,"urgent":true,"previous_failures":["ollama-m4pro","ollama-m1"]}'
curl -sS -X POST http://127.0.0.1:4890/select \
  -H 'Content-Type: application/json' \
  -d '{"task_type":"codebase_semantic_graph","input_token_count":50000,"urgent":true,"local_only":true}'
```
