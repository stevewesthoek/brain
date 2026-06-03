# Save to Mind

Save to Mind is a ChatGPT Custom GPT action that captures conversations and ideas into the Mind vault.

## Behavior

```text
ChatGPT Custom GPT
-> POST https://n8n.prochat.tools/webhook/mind-inbox
-> n8n commits Markdown to stevewesthoek/mind capture/inbox/
-> nightly local Mind Steward run classifies the capture with local AI
```

Save to Mind saves immediately. Classification is nightly only.

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
Folder:     capture/inbox/
```

## Local Classification

Mind Steward classifies captures on this computer through the AI Model Selector:

```json
{
  "task_type": "mind_capture_classification",
  "local_only": true
}
```

No hosted LLM provider is used for automatic capture classification.
