# Mind Workflow Guide

## Daily Interface

Use `mind/home.md` and the `live/` files as the working surface:

```text
live/dashboard.md
live/tasks.md
live/projects.md
live/decisions.md
live/business.md
live/fala.md
```

## Capture

Use Save to Mind from ChatGPT, a shortcut, or any caller that posts to:

```text
POST https://n8n.prochat.tools/webhook/mind-inbox
```

The capture lands in:

```text
mind/capture/inbox/
```

Save to Mind saves the capture immediately. It does not classify the capture immediately.

## Nightly Processing

Mind Steward processes captures during the nightly local scheduler run:

```text
n8n writes capture to GitHub capture/inbox/
-> local scheduler syncs missing inbox captures
-> Mind Steward classifies captures with local AI
-> compile loop appends review suggestions to wiki/log.md
```

Automatic classification uses the AI Model Selector with:

```json
{
  "task_type": "mind_capture_classification",
  "local_only": true
}
```

## Review

Review:

```text
mind/capture/inbox/
mind/wiki/log.md
```

Promote useful material into:

```text
live/tasks.md
live/projects.md
live/decisions.md
wiki/
sources/
```

Keep raw captures intact unless you intentionally discard them.

## Working Rules

- Use `capture/inbox/` for new unsorted captures.
- Use `live/` for active work.
- Use `wiki/` for compiled durable knowledge.
- Use `sources/` for raw research, source notes, transcripts, and evidence.
- Use `archive/` for completed or inactive material.
- Do not store runtime logs, secrets, or tool output in Mind.
- Do not move, delete, archive, or bulk rewrite Mind files without explicit approval.

## Manual Commands

```bash
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.sh
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

These commands are available for verification and maintenance. The normal operating mode is nightly processing.
