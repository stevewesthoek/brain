# AI Model Selector Runtime

Canonical runtime snapshot for the local AI Model Selector service.

The LaunchAgent in `operations/system-configs/launchagents/com.office.ai-model-selector.plist` runs:

```text
operations/system-configs/model-selector/runtime/selector_service.py
```

Runtime configuration is copied to:

```text
~/.config/video-orchestrator/
```

State and audit files stay local-only:

```text
~/.local/video-orchestrator/state/
~/.local/video-orchestrator/logs/
```

## Runtime Contract

The selector owns provider discovery, model availability, fallback order, circuit breakers, Bedrock access checks, and model outcome learning.

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

Brain Console Center consumes Brain Core. It does not probe providers directly.

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
cp operations/system-configs/launchagents/com.office.ai-model-selector.plist ~/Library/LaunchAgents/com.office.ai-model-selector.plist
launchctl stop com.office.ai-model-selector 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.office.ai-model-selector.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/com.office.ai-model-selector.plist
launchctl start com.office.ai-model-selector
```

## Verify

```bash
curl -sS http://127.0.0.1:4890/health
curl -sS http://127.0.0.1:4890/health/matrix
curl -sS -X POST http://127.0.0.1:4890/select \
  -H 'Content-Type: application/json' \
  -d '{"task_type":"description_quality_review","input_token_count":30000,"urgent":true,"previous_failures":["ollama-m4pro","ollama-m1"]}'
```
