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

## Guarded Deployment Boundary

- repository target `inbox/new/`
- repository target `inbox/failed/`
- Repository controlled-migration candidate status: deployed and read back exactly.
- Historical frozen candidate status: paused; repository evidence only.
- Live deployment status: verified by guarded canonical readback on 2026-07-22.
- Live activation and schedule state: preserved unchanged; no separate mutation requested.
- B1.0a status: complete for the approved guarded deployment/readback scope.
- Any future live change requires a new approval, operation ID, confirmation, and readback sequence.
- The completion evidence did not invoke a webhook fixture and did not perform or claim a Mind write.

## Request

```json
{
  "source": "chatgpt",
  "title": "Capture title",
  "content": "Raw capture content",
  "type_hint": "optional hint"
}
```

`source`, `title`, and `content` are the meaningful fields. `type_hint` is stored
as source context for a separately invoked private Bedrock classification; it
does not schedule classification.

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
- commits successful captures to `stevewesthoek/mind` under `inbox/new/`;
- routes failed processing to `stevewesthoek/mind` under `inbox/failed/`;
- returns a saved-and-queued response.

n8n does not call an LLM for Mind capture classification.

## Private Classification Schedule

Save to Mind does not trigger classification. The active local scheduler is
report-only; classification is an explicit operator action whose apply mode
remains disabled pending approval integration.

Nightly flow:

```text
n8n writes successful captures to GitHub inbox/new/
-> optional operator-run sync can copy missing inbox captures
-> optional operator-run classifier can preview private Bedrock classification
-> nightly compile loop runs report-only
```

The sync step copies only missing `inbox/new/*.md` files and does not overwrite local files. Failed processing remains isolated under `inbox/failed/` for review.

## Private AI Contract

Mind Steward requests one exact provider/model route through the AI Model Selector:

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

The selected route must match exactly. If Bedrock is unavailable, classification
fails closed and does not fall through to Codex or another provider.

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
mind_steward_task_type: mind_capture_classification
---

# Capture title

## Source
- Source: chatgpt

## Content
Raw capture content.
```

Mind Steward adds classification metadata during the nightly run:

```yaml
mind_steward_classified: true
mind_steward_classified_at: "2026-06-03T12:05:00.000Z"
mind_steward_provider: claude-bedrock
mind_steward_model: us.anthropic.claude-sonnet-4-6
```

## Scripts

```text
brain/tools/scripts/mind-steward-sync-inbox.mjs
brain/tools/scripts/mind-steward-classify-captures.sh
brain/tools/scripts/brain-scheduler-runner.mjs
```

## Manual Verification

```bash
curl -fsS http://127.0.0.1:4890/health
node /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-sync-inbox.mjs --source-root /path/to/verified/source --mind-root /Users/Office/Repos/stevewesthoek/mind --mode dry-run
bash /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-classify-captures.sh
```

## Safety

- No hosted LLM classification in n8n.
- No paid/API-backed provider for automatic Mind capture classification.
- No secrets in workflow JSON or Mind notes.
- Runtime reports stay under `brain/runtime/local/mind-steward/`.
