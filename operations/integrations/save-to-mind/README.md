# Save to Mind

Save to Mind is a ChatGPT Custom GPT action that captures conversations and ideas into the Mind vault.

## Behavior

```text
ChatGPT Custom GPT
-> POST https://n8n.prochat.tools/webhook/mind-inbox
-> n8n commits Markdown to stevewesthoek/mind inbox/new/
-> optional operator-run Mind Steward classification uses private Bedrock
```

Save to Mind saves immediately. Classification is not scheduled; the nightly
scheduler emits report-only artifacts.

## Custom GPT Setup

In ChatGPT:

1. Open the Save to Mind Custom GPT.
2. Paste `SYSTEM_PROMPT.md` into the Instructions field.
3. Paste `openapi.json` into Actions.
4. Save the GPT.

## Action

```text
operationId: saveToMind
endpoint: POST https://n8n.prochat.tools/webhook/mind-inbox
auth: none
```

## Request

```json
{
  "source": "chatgpt",
  "title": "Short title",
  "content": "Full capture content",
  "type_hint": "optional hint"
}
```

## Response

```json
{
  "status": "saved",
  "result": "file_committed",
  "queued_for_classification": true,
  "classifier": "Mind Steward"
}
```

## Target

```text
Repository: stevewesthoek/mind
Folder:     inbox/new/
```

## Private Classification

Mind Steward requests one exact private route through the AI Model Selector:

```json
{
  "task_type": "mind_capture_classification",
  "task_metadata": {
    "private": true,
    "sensitive": true,
    "allowed_providers": ["claude-bedrock"],
    "allowed_models": ["us.anthropic.claude-sonnet-4-6"],
    "preferred_providers": ["claude-bedrock"],
    "preferred_models": ["us.anthropic.claude-sonnet-4-6"],
    "fallback_policy": "none"
  }
}
```

The private capture is sent only to the approved Anthropic model through the
existing AWS Bedrock account. The request content is placed in an owner-only
temporary JSON file, never in process arguments, and is deleted in `finally`.
If this exact route is unavailable, classification fails closed; Codex and all
other providers are forbidden fallbacks.
