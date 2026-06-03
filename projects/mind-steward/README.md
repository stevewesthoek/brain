# Mind Steward

Mind Steward maintains the `mind` vault through local capture classification, review suggestions, and maintenance reports.

## Responsibilities

- Read and enforce the `mind/router/` contract.
- Classify new captures in `mind/capture/inbox/`.
- Use the AI Model Selector with `local_only: true` for automatic capture classification.
- Append review suggestions through the compile loop.
- Write runtime reports under `brain/runtime/local/mind-steward/`.
- Keep raw captures and source material intact.

## Save-to-Mind Flow

```text
Save to Mind
-> n8n writes Markdown to GitHub capture/inbox/
-> nightly local scheduler syncs missing inbox captures to this computer
-> Mind Steward classifies captures with local AI
-> Mind Steward appends review suggestions to wiki/log.md
```

Save to Mind does not trigger immediate classification. Classification runs during the nightly local scheduler.

## Local Classification

Mind Steward requests a local model route from:

```text
http://127.0.0.1:4890/select
```

with:

```json
{
  "task_type": "mind_capture_classification",
  "local_only": true,
  "urgent": true
}
```

The selected provider must be a local OpenAI-compatible endpoint such as Ollama.

## Scripts

```text
tools/scripts/mind-steward-sync-inbox.sh
tools/scripts/mind-steward-classify-captures.sh
tools/scripts/mind-steward-dry-run-report.sh
tools/scripts/mind-compile-loop.sh
```

`mind-steward-sync-inbox.sh` fetches `origin/main` and copies missing `capture/inbox/*.md` files into the local vault without overwriting local files.

`mind-steward-classify-captures.sh` classifies inbox captures through the AI Model Selector local-only route.

## Safety

- No hosted, CLI-backed, or paid/API-backed provider for automatic capture classification.
- No arbitrary shell execution from Mind notes.
- No secrets or runtime logs in Mind.
- Broad move/delete/archive/rewrite behavior requires an explicit approved apply path.

## Validation

```bash
npm run ci
```
