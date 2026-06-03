# Mind Automation Schedule

## Purpose

This runbook documents the active recurring Mind jobs. Mind automation runs through the local nightly scheduler, not through per-minute cron routing jobs.

## Scheduler

```text
brain/tools/scripts/office-nightly-scheduler.sh
```

The scheduler runs on this computer after the nightly cutoff. Mind jobs are part of that scheduler chain.

## Active Mind Jobs

| Job | Script | Purpose | Writes to Mind |
|---|---|---|---|
| Mind Steward inbox sync | `tools/scripts/mind-steward-sync-inbox.sh` | Fetch `origin/main` and copy missing `capture/inbox/*.md` files into the local vault | yes, only missing inbox captures |
| Mind Steward classification | `tools/scripts/mind-steward-classify-captures.sh` | Classify inbox captures through AI Model Selector with `local_only: true` | yes, classification metadata in captures |
| Mind compile loop | `tools/scripts/mind-compile-loop.sh` | Append review suggestions to `wiki/log.md` | yes, append-only suggestions |
| Mind Steward dry-run report | `tools/scripts/mind-steward-dry-run-report.sh` | Write Brain runtime report for maintenance findings | no Mind writes |

## Nightly Order

```text
mind-steward-dry-run-report
-> memory-context-refresh
-> mind-steward-sync-inbox
-> mind-steward-classify-captures
-> mind-compile-loop
```

## Local AI Requirement

Automatic capture classification must use:

```json
{
  "task_type": "mind_capture_classification",
  "local_only": true
}
```

The selected provider must be a local OpenAI-compatible endpoint such as Ollama.

## Manual Verification

```bash
curl -fsS http://127.0.0.1:4890/health
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.sh
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

Runtime reports:

```text
brain/runtime/local/mind-steward/
```

Scheduler logs:

```text
~/Library/Logs/office-scheduler/
```

## Safety

- Do not install per-minute Mind classification jobs.
- Do not call hosted LLMs for automatic Mind capture classification.
- Do not overwrite local inbox files during sync.
- Do not store secrets or runtime logs in Mind.
