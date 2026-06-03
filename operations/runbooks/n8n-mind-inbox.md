# n8n Save to Mind

## Purpose

Save to Mind receives captures and writes them to the Mind vault. n8n is the capture receiver and GitHub writer. Mind Steward owns classification on this computer.

## Endpoint

```text
POST https://n8n.prochat.tools/webhook/mind-inbox
```

## Live Workflow

```text
Workflow name: Save to Mind — Capture for Mind Steward
Workflow ID:   FwP5INe9qoo1OwGC
Status:        active
```

## Request

```json
{
  "source": "chatgpt",
  "title": "Capture title",
  "content": "Raw capture content",
  "type_hint": "optional hint"
}
```

`source`, `title`, and `content` are the meaningful fields. `type_hint` is stored as source context for later local classification.

## Response

```json
{
  "status": "saved",
  "result": "file_committed",
  "queued_for_classification": true,
  "classifier": "Mind Steward"
}
```

## n8n Responsibilities

n8n:

- receives the webhook payload;
- creates a Markdown capture;
- commits it to `stevewesthoek/mind` under `capture/inbox/`;
- returns a saved-and-queued response.

n8n does not call an LLM for Mind capture classification.

## Local Classification Schedule

Mind Steward classifies captures during the nightly local scheduler run. Save to Mind does not trigger immediate classification.

Nightly flow:

```text
n8n writes capture to GitHub capture/inbox/
-> mind-steward-sync-inbox.sh copies missing inbox captures into the local Mind checkout
-> mind-steward-classify-captures.sh classifies captures locally
-> mind-compile-loop.sh appends review suggestions to wiki/log.md
```

The sync step copies only missing `capture/inbox/*.md` files and does not overwrite local files.

## Local AI Contract

Mind Steward requests a local model through the AI Model Selector:

```json
{
  "task_type": "mind_capture_classification",
  "local_only": true,
  "urgent": true
}
```

The selected provider must be a local OpenAI-compatible endpoint such as Ollama.

## Capture Note Format

n8n writes queued capture notes like this:

```markdown
---
type: capture
source: "chatgpt"
status: queued
para_type: inbox
confidence: 0
signal_quality: 0
title: "Capture title"
created: "2026-06-03T12:00:00.000Z"
mind_steward_status: queued
mind_steward_local_only: true
mind_steward_task_type: mind_capture_classification
---

# Capture title

## Source
- Source: chatgpt

## Content
Raw capture content.
```

Mind Steward adds classification metadata during the nightly local run:

```yaml
mind_steward_classified: true
mind_steward_classified_at: "2026-06-03T12:05:00.000Z"
mind_steward_provider: ollama-m4pro
mind_steward_model: qwen2.5:14b
mind_steward_local_only: true
```

## Scripts

```text
brain/tools/scripts/mind-steward-sync-inbox.sh
brain/tools/scripts/mind-steward-classify-captures.sh
brain/tools/scripts/office-nightly-scheduler.sh
```

## Manual Verification

```bash
curl -fsS http://127.0.0.1:4890/health
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.sh
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

## Safety

- No hosted LLM classification in n8n.
- No paid/API-backed provider for automatic Mind capture classification.
- No secrets in workflow JSON or Mind notes.
- Runtime reports stay under `brain/runtime/local/mind-steward/`.
