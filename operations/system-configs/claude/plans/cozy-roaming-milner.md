# Plan: Hybrid Video Generation Mode

## Context

The AWS Video control plane works in fixture proof mode: it copies fixture S3 objects and runs Step Functions assembly. The `generateApprovedScript()` function has placeholder interfaces for real providers but no prompt-derived content. This chunk adds a `hybrid` generation mode that writes a deterministic scene plan and narration script from the user's prompt/script, while still using fixture audio and video for final assembly. Nothing AI or external is called. The result is honest metadata that distinguishes what is prompt-derived vs. what is still a fixture.

Current limitation: `getAwsVideoGenerationMode()` only knows `'fixture' | 'ai'`. There is no `'hybrid'` path, no `ScenePlan` type, no narration-script file, and the UI shows a single "Pipeline proof mode" banner with no mode distinction.

---

## Files to create

### 1. `projects/brain-core/src/providers/aws-video-generation-types.ts` (NEW)

Export canonical TypeScript types only — no logic, no imports from provider:

```ts
export type GenerationMode = 'fixture' | 'hybrid' | 'ai';
export type MediaSource = 'fixture' | 'hybrid' | 'ai';

export interface ScenePlanScene {
  index: number;
  durationSeconds: number;
  visualPrompt: string;
  narrationText: string;
  onScreenText?: string;
}

export interface ScenePlan {
  jobId: string;
  prompt: string;
  title: string;
  targetDurationSeconds: number;
  scenes: ScenePlanScene[];
  createdAt: string;
  providerName: string;
  deterministic: boolean;
}

export interface GenerationManifest {
  jobId: string;
  generationMode: 'fixture_assembly' | 'hybrid_scene_plan_fixture_media' | 'ai_generation';
  mediaSource: 'fixture' | 'hybrid' | 'ai';
  aiGenerated: boolean;
  scenePlanKey?: string;
  narrationScriptKey?: string;
  narrationAudioKey?: string;
  sourceVideoKey?: string;
  finalVideoKey?: string;
  thumbnailKey?: string;
  providers: {
    scenePlan?: string;
    narrationScript?: string;
    narrationAudio?: string;
    video?: string;
  };
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 2. `projects/brain-core/src/providers/aws-video-scene-planner.ts` (NEW)

`DeterministicScenePlanningProvider` class — reads script.md content, produces `ScenePlan` and narration script text. No external calls.

```ts
import type { ScenePlan, ScenePlanScene } from './aws-video-generation-types.js';
import type { ScriptMetadata } from './video-orchestrator-provider.js';

export class DeterministicScenePlanningProvider {
  readonly name = 'deterministic-local';

  generateScenePlan(jobId: string, script: ScriptMetadata, scriptContent: string): ScenePlan {
    // Extract prompt text from script content (strip markdown headings/status lines)
    // Determine scene count: <30s → 2 scenes, 30–90s → 3 scenes, >90s → 4–5 scenes
    // Split content into evenly-spaced chunks → map to ScenePlanScene[]
    // visualPrompt = "<title> — scene N: <short description>"
    // narrationText = relevant extracted sentence(s) from chunk
  }

  generateNarrationScript(scenePlan: ScenePlan): string {
    // Format: header line, then each scene as a numbered block
    // Scene N (Xs)\nVisual: ...\nNarration: ...\n
  }
}
```

Scene extraction algorithm (deterministic, no randomness):
1. Strip markdown headings, blank lines, status boilerplate from `scriptContent`
2. Split remaining lines into N equal-length chunks (N = scene count)
3. Each chunk → `narrationText` (first sentence or truncated to 80 chars)
4. `visualPrompt` = `"${title} — scene ${index + 1} of ${scenes.length}"`
5. `durationSeconds` = `Math.floor(targetDurationSeconds / sceneCount)` with last scene getting remainder

---

## Files to modify

### 3. `projects/brain-core/src/providers/video-orchestrator-provider.ts`

**a. Imports** — add import from `./aws-video-generation-types.js`

**b. `getAwsVideoGenerationMode()`** — extend return type to `'fixture' | 'hybrid' | 'ai'`:
```ts
function getAwsVideoGenerationMode(): 'fixture' | 'hybrid' | 'ai' {
  const mode = process.env.AWS_VIDEO_GENERATION_MODE;
  if (mode === 'ai') return 'ai';
  if (mode === 'hybrid') return 'hybrid';
  return 'fixture';
}
```

**c. Add `writeS3JobFile()` helper** — general-purpose S3 write for non-metadata paths:
```ts
async function writeS3JobFile(s3Key: string, content: string): Promise<void> {
  // write to tmpfile, aws s3 cp to s3://<BUCKET>/<s3Key>
}
```

**d. `generateApprovedScript()` — add hybrid branch** after the existing mode check (currently line 1630), before directory creation:

```
if mode === 'ai' → fail loudly (update message to mention hybrid as alternative)
if mode === 'hybrid' → run hybrid path
if mode === 'fixture' → run existing fixture path (no behavior change)
```

**Hybrid path steps** (inserted before the fixture copy steps, within the same function):
1. Write initial status.json with `generationMode: 'hybrid_scene_plan_fixture_media'`, `mediaSource: 'hybrid'`
2. Write approvals.json (identical to fixture path)
3. **NEW: Generate scene plan** via `DeterministicScenePlanningProvider`
   - Read `jobs/<jobId>/scripts/script.md` (or fall back to script.title if missing)
   - Call `provider.generateScenePlan(jobId, script, scriptContent)`
   - Write `metadata/scene-plan.json` locally + `writeS3MetadataJson(jobId, 'scene-plan.json', scenePlan)`
4. **NEW: Generate narration script**
   - Call `provider.generateNarrationScript(scenePlan)`
   - Write `audio/narration-script.txt` locally + `writeS3JobFile(`jobs/${jobId}/audio/narration-script.txt`, text)`
5. Copy fixture narration audio (identical to fixture path) — label clearly as fixture
6. Copy fixture video (identical to fixture path) — label clearly as fixture
7. Preflight S3 check (identical to fixture path)
8. Write `assets.json` with extended GenerationManifest fields:
   ```json
   {
     "jobId": "...",
     "mediaSource": "hybrid",
     "generationMode": "hybrid_scene_plan_fixture_media",
     "aiGenerated": false,
     "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
     "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
     "narrationAudioSource": "fixture",
     "audioSourceKey": "jobs/test-001/audio/narration.mp3",
     "sourceVideoSource": "fixture",
     "videoSourceKey": "jobs/test-001/exports/sample-transcoded.mp4",
     "providers": {
       "scenePlan": "deterministic-local",
       "narrationScript": "deterministic-local",
       "narrationAudio": "fixture",
       "video": "fixture"
     },
     "warnings": ["Final video/audio media still uses fixture assets; scene plan and narration script are prompt-derived."],
     "narration": { "path": "jobs/<jobId>/audio/narration.mp3", "source": "fixture", "sourceKey": "..." },
     "sourceVideo": { "path": "jobs/<jobId>/video-generated/generated-001.mp4", "source": "fixture", "sourceKey": "..." },
     "createdAt": "...",
     "updatedAt": "..."
   }
   ```
9. Start Step Functions (identical to fixture path — contract unchanged: `{ jobId, videoKey, audioKey }`)
10. Update status.json with executionArn
11. Write `publish.json` with hybrid-appropriate reason:
    - `reason: 'Hybrid pipeline proof — prompt-derived scene plan and narration script; video/audio media uses fixtures'`
    - `title: fixtureTitle(script.title)` — still gets `[PIPELINE PROOF]` prefix since final media is fixture

**e. `repairPublishJson()`** — update `fixtureTitle` condition to include `'hybrid'` mediaSource:
```ts
// Before:
title: mediaSource === MEDIA_SOURCE ? fixtureTitle(...) : ...
// After:
title: (mediaSource === 'fixture' || mediaSource === 'hybrid') ? fixtureTitle(...) : ...
```

**f. `getVideoJobArtifacts()`** — after loading assets, if `assets.scenePlanKey` is present, optionally load and embed the scene plan:
```ts
if (assets && (assets as Record<string, unknown>).scenePlanKey) {
  const scenePlan = await readJobMetadataJson(jobId, 'scene-plan.json');
  if (scenePlan) return { ...mergedAssets, scenePlan, publishableAssets: resolved };
}
```

**g. AI error message** — update to mention `hybrid` as alternative:
```ts
message: 'AI video generation provider is not configured. Use AWS_VIDEO_GENERATION_MODE=hybrid for prompt-derived scene planning with fixture media, or configure a real provider.'
```

### 4. `projects/brain-console-center/components/aws-video-dashboard.tsx`

**a. Derived state additions** (lines ~253–260):
```ts
const isHybridMode = generationMode === 'hybrid_scene_plan_fixture_media';
const isFixtureMedia = mediaSource === 'fixture' || mediaSource === 'hybrid'
  || generationMode === 'fixture_assembly' || generationMode === 'hybrid_scene_plan_fixture_media';
const scenePlanData = asRecord(artifactData?.scenePlan);
const scenePlanKey = stringField(artifactData, 'scenePlanKey');
const narrationScriptKey = stringField(artifactData, 'narrationScriptKey');
const hasScenePlan = Boolean(scenePlanKey || scenePlanData);
```

**b. New `ScenePlanCard` component** (add near `PublishDiagnosticsCard`):
```tsx
function ScenePlanCard({ artifactData }: { artifactData: Record<string, unknown> | null | undefined }) {
  const scenePlan = asRecord(artifactData?.scenePlan);
  const scenePlanKey = stringField(artifactData, 'scenePlanKey');
  const narrationScriptKey = stringField(artifactData, 'narrationScriptKey');
  const scenes = Array.isArray(scenePlan?.scenes) ? scenePlan.scenes as unknown[] : [];
  if (!scenePlanKey && !scenePlan) return null;
  return (
    <article className="card">
      <div className="card-title">Scene plan</div>
      <div className="aws-facts">
        <div><span>Scenes</span><strong>{scenes.length || '—'}</strong></div>
        <div><span>Provider</span><strong>{stringField(scenePlan, 'providerName') ?? 'deterministic-local'}</strong></div>
        <div><span>Scene plan</span><strong>{scenePlanKey ?? 'pending'}</strong></div>
        <div><span>Narration script</span><strong>{narrationScriptKey ?? 'not set'}</strong></div>
      </div>
      {scenes.slice(0, 2).map((scene, i) => {
        const s = asRecord(scene);
        return (
          <div key={i} className="compact-error">
            <strong>Scene {i + 1}</strong>
            <p>{stringField(s, 'visualPrompt') ?? '—'}</p>
          </div>
        );
      })}
    </article>
  );
}
```

**c. Overview tab** — replace current single fixture banner with mode-aware banner:
```tsx
{isHybridMode
  ? <div className="compact-error">Hybrid mode: scene plan and narration script are prompt-derived; final audio/video media still uses fixtures.</div>
  : isFixtureMedia
    ? <div className="compact-error">Pipeline proof mode: this job used fixture media, not AI-generated video.</div>
    : null}
```
Add `ScenePlanCard` after the pipeline flow card:
```tsx
{hasScenePlan ? <ScenePlanCard artifactData={artifactData} /> : null}
```

**d. Publish tab** — update fixture banner to be mode-specific:
```tsx
{isHybridMode
  ? <div className="compact-error">Hybrid mode: prompt-derived scene plan exists, but final media still uses fixture audio/video.</div>
  : isFixtureMedia
    ? <div className="compact-error">Pipeline proof mode: this job used fixture media, not AI-generated video.</div>
    : null}
```

**No schema changes needed** — `videoJobSchema` and `videoArtifactsResponseSchema` use `.passthrough()` / `z.record(z.unknown())`, so new fields flow through automatically.

### 5. `projects/brain-core/docs/aws-video-pipeline.md` (MODIFY)

Document three modes, hybrid path behavior, what hybrid does not do, canonical artifact paths, next chunk.

### 6. `projects/video-orchestrator/cloud/docs/pipeline-state.md` (MODIFY)

Same documentation update.

---

## Canonical artifact paths (document and implement against)

| Asset | Local path | S3 key |
|-------|-----------|--------|
| Script markdown | `jobs/<id>/scripts/script.md` | same |
| Scene plan | `jobs/<id>/metadata/scene-plan.json` | same |
| Narration script text | `jobs/<id>/audio/narration-script.txt` | same |
| Narration audio (fixture) | `jobs/<id>/audio/narration.mp3` | same |
| Source video (fixture) | `jobs/<id>/video-generated/generated-001.mp4` | same |
| Final assembled video | `jobs/<id>/exports/generated-001-final.mp4` | same |
| Thumbnail | `jobs/<id>/exports/thumbnail-001.jpg` | same |

**Narration script path decision:** The existing `audio/` directory is the canonical location for all narration files (`narration.mp3`, `narration-metadata.json`). The narration script text goes in `audio/narration-script.txt` — not in a new `narration/` directory.

---

## Verification

1. `cd projects/brain-core && npm run typecheck` — must pass
2. `cd projects/brain-console-center && npm run typecheck` — must pass
3. Set `AWS_VIDEO_GENERATION_MODE=hybrid`, create+approve a new ProChat job, click Generate
4. Check local: `metadata/scene-plan.json` exists with scenes array
5. Check local: `audio/narration-script.txt` exists with scene narration text
6. Check: `metadata/assets.json` has `generationMode=hybrid_scene_plan_fixture_media`, `mediaSource=hybrid`, `aiGenerated=false`, `scenePlanKey`, `narrationScriptKey`, `providers`, `warnings`
7. `curl -sS http://127.0.0.1:4877/api/video-orchestrator/jobs/<jobId>/artifacts | jq` → response includes `scenePlanKey`, `narrationScriptKey`, and `scenePlan` object
8. Brain Console Center overview tab shows hybrid banner and ScenePlanCard with scenes
9. Publish tab shows hybrid-specific warning
10. Fixture mode unchanged: re-run with `AWS_VIDEO_GENERATION_MODE=fixture` and confirm existing behavior
11. No real YouTube upload triggered

---

## What is NOT changing

- Step Functions input contract: `{ jobId, videoKey, audioKey }` — unchanged
- Fixture proof mode behavior — identical, just clearer metadata
- The fixture `[PIPELINE PROOF]` title prefix — applies to both `fixture` and `hybrid` modes
- The `audio/narration.mp3` path convention
- `writeS3MetadataJson` is reused for scene-plan.json
- No external AI/API calls in this chunk
