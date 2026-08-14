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
| Mind Steward inbox sync | `tools/scripts/mind-steward-sync-inbox.mjs` | Operator-only sync; defaults to dry-run and copies only missing `inbox/new/*.md` in explicitly approved apply mode | no in default mode |
| Mind Steward classification | `tools/scripts/mind-steward-classify-captures.sh` | Operator-only private Bedrock classifier; defaults to dry-run and apply is disabled | no |
| Mind compile loop | `tools/scripts/mind-compile-loop.sh --mode=report-only` | Emit review suggestions to scheduler output | no |
| Mind Steward dry-run report | `tools/scripts/mind-steward-dry-run-report.sh` | Write Brain runtime report for maintenance findings | no Mind writes |

## Nightly Order

```text
mind-steward-dry-run-report
-> local-apps-report
-> mind-compile-loop --mode=report-only
```

Unsafe sync, classification, and memory-refresh scheduler jobs remain quiesced.

## Private AI Requirement

Automatic capture classification must use:

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

The classifier fails closed if the exact approved Bedrock route is unavailable.

## Manual Verification

```bash
curl -fsS http://127.0.0.1:4890/health
node /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.mjs --source-root /path/to/verified/source --mind-root /Users/Office/Repos/stevewesthoek/mind --mode dry-run
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

- Do not install per-minute or nightly Mind classification jobs.
- Do not allow Codex or any other fallback for private Mind classification.
- Do not overwrite local inbox files during sync.
- Do not store secrets or runtime logs in Mind.
