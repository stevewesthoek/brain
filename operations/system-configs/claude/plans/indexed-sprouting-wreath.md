# I-8.3 Plan: Generate Approved Draft Video Artifacts

## Context

I-8.1 (prompt-to-draft API) is complete. I-8.3 extends the existing `generateApprovedScript` function — which currently only validates readiness and returns a stub — into a real generation trigger that: copies narration, starts the AWS Step Functions workflow, writes status/publish metadata, and returns a proper response. Phase B then surfaces a Generate Video button in Brain Console.

---

## Phase A — Brain repo generation endpoint

### Files to change

1. **`projects/brain-core/src/providers/video-orchestrator-provider.ts`**

   **Interface updates** (expand `GenerationTriggerResponse`):
   ```typescript
   export interface GenerationTriggerResponse {
     ok: true;
     jobId: string;
     generationStatus: 'complete' | 'started';
     generationStarted: boolean;         // keep for backwards compat
     executionArn?: string;
     finalVideoKey?: string;
     thumbnailKey?: string;
     publishStatus: 'pending';
     publishBlocked: true;
   }
   ```

   **New imports** at top of file:
   ```typescript
   import { mkdir, writeFile, readFile, access } from 'fs/promises';
   import { execFile } from 'node:child_process';
   import { promisify } from 'node:util';
   ```
   (Note: `writeFile`/`readFile`/`access` are already imported — only `mkdir` and `execFile`/`promisify` are new)

   **New private helpers** (added near getVideoOrchestratorRoot):
   ```typescript
   const execFileAsync = promisify(execFile);

   const AWS_REGION = 'eu-north-1';
   const S3_BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an';
   const STATE_MACHINE_ARN = 'arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev';
   const NARRATION_FIXTURE_KEY = 'jobs/test-001/audio/narration.mp3';
   ```

   **Upgrade `generateApprovedScript`** — after validations pass (line 561, current stub return), add:

   a. Write `metadata/status.json` with `{ status: "generating", currentStep: "narration_started", startedAt: new Date().toISOString() }`  
      — use `mkdir` with `{ recursive: true }` to create `metadata/` dir, then `writeFile`

   b. Copy narration from S3 fixture:
      ```typescript
      const narrationKey = `jobs/${jobId}/audio/narration.mp3`;
      await execFileAsync('aws', [
        's3', 'cp',
        `s3://${S3_BUCKET}/${NARRATION_FIXTURE_KEY}`,
        `s3://${S3_BUCKET}/${narrationKey}`,
        '--region', AWS_REGION, '--no-cli-pager'
      ]);
      ```
      On failure: return `{ ok: false, code: 'narration_failed', message: ..., jobId }`

   c. Start Step Functions execution:
      ```typescript
      const executionName = `console-gen-${jobId}-${Date.now()}`;
      const sfInput = JSON.stringify({
        jobId,
        videoKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
        audioKey: narrationKey,
      });
      const { stdout } = await execFileAsync('aws', [
        'stepfunctions', 'start-execution',
        '--state-machine-arn', STATE_MACHINE_ARN,
        '--name', executionName,
        '--input', sfInput,
        '--region', AWS_REGION,
        '--query', 'executionArn',
        '--output', 'text',
        '--no-cli-pager',
      ]);
      const executionArn = stdout.trim();
      ```
      On failure: return `{ ok: false, code: 'workflow_start_failed', message: ..., jobId }`

   d. Update `status.json` with `{ status: "generating", executionArn, currentStep: "workflow_started" }`

   e. Write `publish.json` to both `metadata/` and `publishing/`:
      ```json
      {
        "jobId": "<jobId>",
        "publishStatus": "pending",
        "publishBlocked": true,
        "reason": "Generated from approved draft — awaiting explicit publish approval",
        "createdAt": "<iso>",
        "generatedBy": "interactive-prompt",
        "platforms": { "youtube": { "status": "pending" } }
      }
      ```
      — `mkdir` recursive for `publishing/` then `writeFile` both locations

   f. Return:
      ```typescript
      return {
        ok: true,
        jobId,
        generationStatus: 'started',
        generationStarted: true,
        executionArn,
        publishStatus: 'pending',
        publishBlocked: true,
      };
      ```

2. **Create fixture job: `projects/video-orchestrator/cloud/jobs/prochat-console-gen-001/`**
   - `metadata/script.json` — approval.status: "approved", approvedBy: "Steve", channelId: "prochat", wordCount: 150
   - `metadata/topic.json` — topicId: "prochat-console-gen-001-topic", title: "Why AI Won't Replace Founders"
   - `scripts/script.md` — brief placeholder content

3. **New validation script: `projects/video-orchestrator/cloud/scripts/validate-generate-approved-draft.sh`**

   Tests (calls `http://localhost:4877`):
   - Pending script rejected → `code: script_not_approved`
   - POST generate on prochat-console-gen-001 → `ok: true`
   - Check `metadata/status.json` exists with `status: "generating"` or `status: "complete"`
   - Check `publishing/publish.json` with `publishStatus: "pending"`
   - Check `metadata/publish.json` with `publishStatus: "pending"`
   - Verify no `videoId` or `url` in publish.json (no YouTube upload)

4. **Docs: `docs/releases/i-8.3-generate-approved-draft.md`**

5. **TypeScript build** — `npm run build` in brain-core, verify no errors

6. **Commit:** `feat: generate approved draft video artifacts`

---

## Phase B — Brain Console: Generate Video button

Plugin source lives at: `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/`

### Files to change

1. **New: `src/components/VO/ScriptApprovalPanel.ts`**

   Follows `ApprovalQueuePanel.ts` pattern. Shows all scripts for the selected channel (calls `GET /api/video-orchestrator/scripts/channels/{channelId}`), renders per-script rows with:
   - Title, script status badge, approval status badge
   - Generate Video button: enabled only if `approval.status === 'approved'`, disabled for pending/changes_requested
   - Click: confirmation modal ("Generate video artifacts only. This will not publish to YouTube.") → POST `/api/video-orchestrator/scripts/{jobId}/generate` → show `generationStatus`, `executionArn`

   Uses direct `fetch()` with `BASE_URL = 'http://localhost:4877'` (same pattern as all VO panels — not `client.ts`)

   No AWS imports. No S3 imports. Brain Core API only.

2. **`src/components/VO/VOShell.ts`** — add `scripts` tab button + `case 'scripts': return new ScriptApprovalPanel(...).render(container)`

3. **`src/components/VO/index.ts`** — export `ScriptApprovalPanel`

4. **Build + package + install:**
   ```bash
   cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian
   npm run build && npm run package && npm run install:active-vault
   ```

5. **New validation: `projects/video-orchestrator/cloud/scripts/validate-brain-console-generate-button.sh`**

   Static checks (no live Obsidian needed):
   - `grep -r "GenerateVideo\|generate-video\|generateVideo\|Generate Video" src/` → must find button
   - `grep -r "POST.*generate\|generate.*POST" src/` → must find API call
   - `grep -r "aws\|s3\|stepfunctions" src/components/VO/ScriptApprovalPanel.ts` → must return NOTHING
   - `grep -r "publish-button\|PublishButton\|publishVideo" src/` → must return NOTHING (no publish button added)
   - `npm run typecheck` passes

6. **Commit:** `feat: add brain console generate video action`

---

## Key reuse

- `getVideoOrchestratorRoot()` — exists at line 4, reused for all path construction
- `getJobMetadataPath(jobId, file)` — exists at line 244, reused
- `getJobPublishingPath(jobId)` — exists at line 248, returns `publishing/publish.json` path
- `isValidJobId(jobId)` — exists at line 240, already called first in `generateApprovedScript`
- `fs/promises` `writeFile`, `readFile`, `access` — already imported
- `mkdir` from `fs/promises` — add import (used in `createJobFromPrompt` via dynamic sync import — standardize to static async)
- `execFile` from `node:child_process` — new import, pattern follows `local-app-action-executor.ts`

---

## Verification

Phase A:
1. Create prochat-console-gen-001 fixture
2. POST `/api/video-orchestrator/scripts/prochat-console-gen-001/generate` → `{ ok: true, generationStatus: "started", executionArn: "...", publishStatus: "pending" }`
3. POST `/api/video-orchestrator/scripts/<pending-job>/generate` → `{ ok: false, code: "script_not_approved" }`
4. Run `validate-generate-approved-draft.sh` — all tests pass

Phase B:
1. `npm run typecheck` passes
2. Run `validate-brain-console-generate-button.sh` — all checks pass
3. Open Obsidian → Brain Console → Scripts tab → see script list
4. Generate button visible; enabled only for approved script; disabled for pending
