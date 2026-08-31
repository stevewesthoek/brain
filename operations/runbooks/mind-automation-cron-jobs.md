# Mind Automation Schedule

## Purpose

This runbook documents the active recurring Mind report jobs. Mind automation
runs through the canonical local Brain Scheduler, not through per-minute cron
routing jobs. The scheduler is report-only for Mind.

## Scheduler

```text
brain/tools/scripts/brain-scheduler-runner.mjs
```

The scheduler runs on this computer daily at `03:00` Europe/Lisbon. Only the
two report jobs in the table below are admitted as Mind jobs in that chain;
the operator procedures remain manual-only.

## Mind jobs and operator procedures

| Job or procedure | Script | Purpose | Scheduler admission / Mind writes |
|---|---|---|---|
| Mind Steward inbox sync | `tools/scripts/mind-steward-sync-inbox.mjs` | Operator-only sync; defaults to dry-run and copies only missing `inbox/new/*.md` in explicitly approved apply mode | Manual-only; no Mind writes in default mode |
| Mind Steward classification | `tools/scripts/mind-steward-classify-captures.sh` | Operator-only private Bedrock classifier; defaults to dry-run and apply is disabled | Manual-only; no Mind writes in default mode |
| Mind compile loop | `tools/scripts/mind-compile-loop.sh --mode=report-only` | Emit review suggestions to scheduler output | Active scheduler job; no Mind writes |
| Mind Steward dry-run report | `tools/scripts/mind-steward-dry-run-report.sh` | Write Brain runtime report for maintenance findings | Active scheduler job; no Mind writes |

## Nightly Order

```text
mind-steward-dry-run-report
-> local-apps-report
-> mind-compile-loop --mode=report-only
```

This is the Mind subset of the canonical four-job scheduler run; the video
runtime report runs in the same scheduler but is not a Mind job.

Unsafe sync, classification, and memory-refresh jobs remain quiesced. There is
no separate automatic Mind scheduler lane.

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
