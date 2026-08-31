# Mind Steward Runbook

Mind Steward is the Brain project that maintains the `mind` vault through bounded capture classification, review suggestions, and maintenance reports.

Implementation:

```text
/Users/Office/Repos/stevewesthoek/brain/projects/mind-steward/
```

## Operating Flow

```text
Save to Mind
-> n8n writes capture to GitHub inbox/new/
-> optional operator-run sync copies only missing inbox captures
-> optional operator-run classifier uses private Bedrock in dry-run mode
-> nightly scheduler emits Brain-local reports only
-> Steve or an AI agent reviews and promotes useful material
```

Save to Mind saves immediately. Classification is not scheduled automatically;
the active scheduler runs report-only surfaces.

## Private AI Contract

Mind Steward requests one exact route through the AI Model Selector:

```json
{
  "task_type": "mind_capture_classification",
  "urgent": true,
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

The selected route must be the approved Bedrock model. Classification fails
closed if it is unavailable; Codex is never a fallback for private Mind content.

## Available scripts

```text
tools/scripts/mind-steward-sync-inbox.mjs
tools/scripts/mind-steward-classify-captures.sh
tools/scripts/mind-steward-dry-run-report.sh
tools/scripts/mind-compile-loop.sh
tools/scripts/brain-scheduler-runner.mjs
```

Only `mind-steward-dry-run-report.sh` and `mind-compile-loop.sh` are active
Brain Scheduler jobs. Inbox sync and capture classification are explicit
operator procedures; they are not automatic scheduler entries.

`tools/scripts/office-nightly-scheduler.sh` is retained as a compatibility
wrapper only; it is not the installed LaunchAgent target. The scheduler's
accepted current state is documented in
`operations/runbooks/brain-scheduler-current-state.md`.

## Writes

| Script | Mind write behavior |
|---|---|
| `mind-steward-sync-inbox.mjs` | Defaults to dry-run; in explicit apply mode copies only missing `inbox/new/*.md` files and never overwrites local files |
| `mind-steward-classify-captures.sh` | Defaults to dry-run; apply remains disabled until approval integration is proven |
| `mind-compile-loop.sh` | Report-only in the active scheduler; writes no Mind files |
| `mind-steward-dry-run-report.sh` | Writes Brain runtime reports only |

## Runtime Reports

```text
brain/runtime/local/mind-steward/
```

Runtime reports stay in Brain. Do not copy runtime JSON, logs, or scheduler output into Mind.

## Validation

```bash
npm run --prefix /Users/Office/Repos/stevewesthoek/brain/projects/mind-steward ci
python3 -m unittest discover -s /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/model-selector/tests
```

## Manual Verification

```bash
curl -fsS http://127.0.0.1:4890/health
node /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.mjs --source-root /path/to/verified/source --mind-root /Users/Office/Repos/stevewesthoek/mind --mode dry-run
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

## Safety

- Do not bypass the AI Model Selector for automatic capture classification.
- Do not schedule classification or enable apply implicitly.
- Do not weaken the exact Bedrock provider/model allowlists or `fallback_policy=none`.
- Do not place private capture content in process arguments.
- Do not overwrite local files during inbox sync.
- Do not store secrets, runtime logs, or runtime reports in Mind.
- Do not promote captures into `live/`, `wiki/`, `sources/`, or `archive/` without review.
