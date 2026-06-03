# Mind Steward Runbook

Mind Steward is the Brain project that maintains the `mind` vault through local capture classification, review suggestions, and maintenance reports.

Implementation:

```text
/Users/Office/Repos/stevewesthoek/brain/projects/mind-steward/
```

## Operating Flow

```text
Save to Mind
-> n8n writes capture to GitHub capture/inbox/
-> nightly scheduler syncs missing inbox captures to local Mind checkout
-> Mind Steward classifies captures with local AI
-> compile loop appends review suggestions to wiki/log.md
-> Steve or an AI agent reviews and promotes useful material
```

Save to Mind saves immediately. Mind Steward classification is nightly only.

## Local AI Contract

Mind Steward requests a model through the AI Model Selector:

```json
{
  "task_type": "mind_capture_classification",
  "local_only": true,
  "urgent": true
}
```

The selected route must be a local OpenAI-compatible endpoint such as Ollama.

## Active Scripts

```text
tools/scripts/mind-steward-sync-inbox.sh
tools/scripts/mind-steward-classify-captures.sh
tools/scripts/mind-steward-dry-run-report.sh
tools/scripts/mind-compile-loop.sh
tools/scripts/office-nightly-scheduler.sh
```

## Writes

| Script | Mind write behavior |
|---|---|
| `mind-steward-sync-inbox.sh` | Copies missing `capture/inbox/*.md` files from `origin/main`; never overwrites local files |
| `mind-steward-classify-captures.sh` | Adds classification frontmatter and a Mind Steward classification section to capture notes |
| `mind-compile-loop.sh` | Appends review suggestions to `wiki/log.md` |
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
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.sh
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

## Safety

- Do not bypass the AI Model Selector for automatic capture classification.
- Do not run automatic capture classification without `local_only: true`.
- Do not use hosted or paid/API-backed providers for automatic capture classification.
- Do not overwrite local files during inbox sync.
- Do not store secrets, runtime logs, or runtime reports in Mind.
- Do not promote captures into `live/`, `wiki/`, `sources/`, or `archive/` without review.
