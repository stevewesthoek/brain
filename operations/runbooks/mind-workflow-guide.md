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
mind/inbox/new/
```

Save to Mind saves the capture immediately. It does not classify the capture immediately.

## Nightly Reporting

The active nightly scheduler is report-only for Mind:

```text
n8n writes captures to GitHub inbox/new/
-> local scheduler writes a Mind Steward dry-run report in Brain runtime state
-> compile loop runs report-only and writes no Mind files
```

Classification is an explicit operator action. Its default mode is dry-run and
apply remains disabled pending approval integration. When invoked, it uses:

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

## Review

Review:

```text
mind/inbox/new/
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

- Use `inbox/new/` for new unsorted captures.
- Use `live/` for active work.
- Use `wiki/` for compiled durable knowledge.
- Use `sources/` for raw research, source notes, transcripts, and evidence.
- Use `archive/` for completed or inactive material.
- Do not store runtime logs, secrets, or tool output in Mind.
- Do not move, delete, archive, or bulk rewrite Mind files without explicit approval.

## Manual Commands

```bash
node /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.mjs --source-root /path/to/verified/source --mind-root /Users/Office/Repos/stevewesthoek/mind --mode dry-run
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

These commands are available for verification and maintenance. They do not
authorize apply mode or an automatic classification schedule.
