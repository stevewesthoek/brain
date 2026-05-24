# AI Selector Consumer Onboarding

**Purpose**

This is the standard onboarding procedure for any new repo, service, or workflow that wants to consume the AI Model Selector.

## Required rule order

Consumers must use the selector in this order:

1. Gemini free-tier for eligible non-sensitive text tasks
2. Local AI for sensitive/private/offline tasks and Gemini quota/health/quality fallback
3. Codex CLI
4. Claude via Amazon Bedrock

Consumers must not call OpenAI API or direct Anthropic API providers.

## What a consumer must provide

1. A `task_type` name that already exists in `~/.config/video-orchestrator/ai-task-types.json`, or a new task type entry that is added before use.
2. `input_token_count`
3. `urgent` flag
4. Optional `previous_failures` list when retrying after a failure
5. Optional `task_metadata` with privacy/sensitivity flags:
   - `sensitive`: true if the task involves sensitive business logic or customer data
   - `private`: true if the task is for offline or internal use only
   - `offline`: true if the task must work without external network calls
   - `external_provider_disallowed`: true if policy forbids sending data to external providers (Gemini, etc.)
   - When any flag is true, the selector skips Gemini and prefers local Ollama first
6. An execution adapter for the selected provider type
7. A failure-reporting path that calls `report_ai_failure()`
8. A success-reporting path that calls `report_ai_success()` when the job finishes successfully

## Consumer onboarding flow

1. Define the task.
2. Add or confirm the task type in `ai-task-types.json`.
3. Map the task to one of the provider capabilities.
4. Confirm the consumer can execute all provider types it may receive:
   - `gemini` or `google-ai` for Gemini free-tier text generation
   - `openai-compatible` for local Ollama
   - `cli` for Codex CLI
   - `bedrock` for Claude via Bedrock
5. Implement timeout handling using `timeout_inference_sec`.
6. Implement deferred-job handling if `select_ai()` returns `{"deferred": true, "scheduled_after": ...}`.
7. Route all AI calls through the selector client or `/select`.
8. Report failures and successes back to the selector.
9. Verify `ai-select --providers`, `ai-select --task <task_type>`, and `/health`.

## Minimum consumer contract

Every consumer must be able to:

- accept a provider id
- accept a model name
- accept a base URL or equivalent execution target
- accept a timeout
- handle defer results without marking the job failed
- log the provider and model actually used

## New repo checklist

- [ ] Add or confirm the task type in `ai-task-types.json`
- [ ] Add the execution adapter for `gemini`, `ollama`, `codex-cli`, and `claude-bedrock`
- [ ] Identify which tasks are sensitive/private/offline and set task_metadata flags accordingly
- [ ] Wire `select_ai(task_type, input_tokens, urgent, task_metadata=metadata)` into the job path
- [ ] Wire `report_ai_failure()` on error
- [ ] Wire `report_ai_success()` on success
- [ ] Handle deferred results
- [ ] Verify the selector health endpoint
- [ ] Verify the provider registry contains only the providers this repo is allowed to use

## Notes

- The selector is the routing contract.
- The consumer owns provider execution.
- The selector does not embed repo-specific business logic.
- A new repo should not hardcode provider order. It should ask the selector and execute what comes back.
- Consumers must pass privacy/sensitivity requirements into task metadata so the selector can bypass Gemini and choose local first when external execution is not allowed.
