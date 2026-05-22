# AI Selector Consumer Onboarding

**Purpose**

This is the standard onboarding procedure for any new repo, service, or workflow that wants to consume the AI Model Selector.

## Required rule order

Consumers must use the selector in this order:

1. Local AI
2. Codex CLI
3. Claude via Amazon Bedrock

Consumers must not call OpenAI API or direct Anthropic API providers.

## What a consumer must provide

1. A `task_type` name that already exists in `~/.config/video-orchestrator/ai-task-types.json`, or a new task type entry that is added before use.
2. `input_token_count`
3. `urgent` flag
4. Optional `previous_failures` list when retrying after a failure
5. An execution adapter for the selected provider type
6. A failure-reporting path that calls `report_ai_failure()`
7. A success-reporting path that calls `report_ai_success()` when the job finishes successfully

## Consumer onboarding flow

1. Define the task.
2. Add or confirm the task type in `ai-task-types.json`.
3. Map the task to one of the provider capabilities.
4. Confirm the consumer can execute all provider types it may receive:
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
- [ ] Add the execution adapter for `ollama`, `codex-cli`, and `claude-bedrock`
- [ ] Wire `select_ai()` into the job path
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
