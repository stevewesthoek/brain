# Plan: Add Canonical YouTube Package Metadata for AWS Video

## Context

The AWS video pipeline currently writes `publish.json` at generation time with placeholder title/description/tags derived purely from mode metadata (e.g., `[PIPELINE PROOF] My Job Title`). These fields go directly into the YouTube upload via `youtube-upload-local.sh`. The result: uploaded videos have fixture/debug titles and descriptions rather than clean, SEO-appropriate metadata.

The goal is to create a canonical `youtube-package.json` artifact written at generation time, containing a clean title derived from the topic prompt (not the raw prompt), a public-facing description (no internals), and 8–15 real SEO tags. The YouTube upload shell script will prefer `youtube-package.json` fields over `publish.json`. The Review and Publish tabs in Brain Console Center will show a YouTube Package card. The verify script will check for the file on hybrid_slideshow and hybrid_image_slideshow jobs.

## Part 1: Brain Core — `youtube-package.json` generator

### 1a. New file: `src/providers/youtube-package-builder.ts`

Create a pure helper (no AWS calls, no FS writes) that takes all generation inputs and returns a `YouTubePackage` object.

```ts
export interface YouTubePackage {
  jobId: string;
  sourcePrompt: string;          // raw topic title (before cleaning)
  generationMode: string;
  title: string;                 // cleaned, YouTube-safe, ≤100 chars
  description: string;           // public-facing, no internals, ≤5000 chars
  shortDescription: string;      // ≤150 chars, for display in console
  tags: string[];                // 8–15 lowercase, no dupes, no internals
  searchKeywords: string[];      // deduplicated superset of tags
  categoryId: string;            // always "22"
  privacyStatus: 'private';      // always "private"
  thumbnailKey: string | null;
  videoKey: string | null;
  scenePlanKey: string | null;
  narrationScriptKey: string | null;
  youtubePackageKey: string;     // "jobs/<jobId>/metadata/youtube-package.json"
  createdAt: string;
  updatedAt: string;
}

export function buildYouTubePackage(input: {
  jobId: string;
  topicTitle: string;
  topicDescription?: string | null;
  generationMode: string;
  mediaSource: string;
  videoKey?: string | null;
  thumbnailKey?: string | null;
  scenePlanKey?: string | null;
  narrationScriptKey?: string | null;
  scenePlan?: ScenePlanEntry[] | null;   // for tag extraction
}): YouTubePackage
```

**Title rules** in `buildYouTubePackage`:
- Strip prefixes: `/^(make a video (about|on|for|of)|create a video (about|on)|a video (about|on|of))\s*/i`
- Strip `[PIPELINE PROOF]` prefix always
- Title-case the result
- Trim to 100 chars max, ending at a word boundary
- Do NOT add `[PIPELINE PROOF]` for hybrid_image_slideshow_video or hybrid_slideshow_video (real generated media)
- Add `[PIPELINE PROOF]` only for modes where video is fixture: hybrid_tts_fixture_video, hybrid_storyboard_fixture_video, hybrid_scene_plan_fixture_media, fixture_assembly

**Description rules**:
- Base: "A {topic} video." expanded with scene plan summaries (up to 3 scenes, one sentence each)
- No AWS, Brain Core, fixture, pipeline, Step Functions mentions
- Keep under 5000 chars

**Tag rules**:
- Extract 2-word phrases from topic title and topic description
- Add mode-appropriate topic-level tags (e.g., "nursery", "soft toys", "warm sunlight" from the title)
- No internal words: hybrid, fixture, pipeline, brain, core, aws, polly, nova, canvas, bedrock, ffmpeg
- Lowercase, max 500 chars each, 8–15 total

### 1b. Integration point in `video-orchestrator-provider.ts`

In `generateApprovedScript`, after assets.json is written (line 3139) and before Step Functions starts (line 3144), add:

```ts
// Write youtube-package.json (canonical metadata for upload)
const youtubePackage = buildYouTubePackage({
  jobId,
  topicTitle: topic.title,
  topicDescription: (topic as Record<string,unknown>).description as string | undefined ?? null,
  generationMode: modeMetadata.generationMode,
  mediaSource: modeMetadata.mediaSource,
  videoKey: modeMetadata.videoSourceKey ?? null,
  thumbnailKey: null,  // not available yet at generation start
  scenePlanKey: scenePlanKey ?? null,
  narrationScriptKey: narrationScriptKey ?? null,
  scenePlan: parsedScenePlan ?? null,
});
const youtubePackageFileName = 'youtube-package.json';
try {
  await writeFile(
    join(metadataDir, youtubePackageFileName),
    JSON.stringify(youtubePackage, null, 2) + '\n',
    'utf-8',
  );
  await writeS3MetadataJson(jobId, youtubePackageFileName, youtubePackage as unknown as Record<string, unknown>);
} catch (err) {
  console.error(`Warning: Failed to write youtube-package.json for ${jobId}: ${err}`);
}
```

Also update `repairPublishJson` (line 1178) to read youtube-package.json and use its title/description/tags if present (prefer over mode defaults):
```ts
const youtubePackageJson = await readJobMetadataJson(jobId, 'youtube-package.json') as Record<string, unknown> | null;
// ...
title: stringValue(youtubePackageJson?.title) ?? (mediaSource === 'fixture' || ...) ? fixtureTitle(...) : stringValue(publishJson?.title) ?? script?.title ?? '',
description: stringValue(youtubePackageJson?.description) ?? stringValue(publishJson?.description) ?? '',
tags: stringArray(youtubePackageJson?.tags) ?? stringArray(publishJson?.tags),
```

### 1c. Update `publish.json` with `youtubePackageKey`

In the `publishJson` object at line 3227, add:
```ts
youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
```

### 1d. Update `repairPublishJson`

In `repairPublishJson` (lines 1178-1238), read `youtube-package.json` in the initial parallel read and prefer its fields for title/description/tags when present.

## Part 2: Shell script — `youtube-upload-local.sh`

In Step 2 (around line 235), after reading `publish.json`, try to read `youtube-package.json`:

```bash
# Try to prefer youtube-package.json fields if available
YT_PACKAGE_JSON=$(aws s3 cp "s3://$BUCKET/jobs/$JOB_ID/metadata/youtube-package.json" - --region eu-north-1 2>/dev/null || echo "")
if [ -n "$YT_PACKAGE_JSON" ]; then
  PKG_TITLE=$(echo "$YT_PACKAGE_JSON" | jq -r '.title // ""')
  PKG_DESCRIPTION=$(echo "$YT_PACKAGE_JSON" | jq -r '.description // ""')
  PKG_TAGS=$(echo "$YT_PACKAGE_JSON" | jq -r '.tags // [] | @csv')
  [ -n "$PKG_TITLE" ] && TITLE="$PKG_TITLE"
  [ -n "$PKG_DESCRIPTION" ] && DESCRIPTION="$PKG_DESCRIPTION"
  [ -n "$PKG_TAGS" ] && TAGS="$PKG_TAGS"
fi
```

Also fix the hardcoded `"tags": []` in Step 6 (line 396) to use `$TAGS` properly.

## Part 3: Brain Console Center UI

### 3a. New schema in `lib/braincore-schemas.ts`

```ts
export const youtubePackageSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  description: z.string(),
  shortDescription: z.string().optional(),
  tags: z.array(z.string()),
  categoryId: z.string().optional(),
  privacyStatus: z.string().optional(),
  videoKey: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
  scenePlanKey: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
export type YouTubePackage = z.infer<typeof youtubePackageSchema>;
```

### 3b. New Brain Core API endpoint

In `src/routes/video-orchestrator-routes.ts` (or equivalent), add:
```
GET /api/video-orchestrator/jobs/:jobId/youtube-package
```
Reads and returns `youtube-package.json` from local metadata or S3.

### 3c. Dashboard query

In `aws-video-dashboard.tsx`, add a `useQuery` for the YouTube package when a job is selected:
```ts
const youtubePackage = useQuery({
  queryKey: ['aws-video-youtube-package', selectedJobId],
  queryFn: () => brainCoreRequest(
    `/api/video-orchestrator/jobs/${encodeURIComponent(selectedJobId)}/youtube-package`,
    youtubePackageSchema
  ),
  enabled: Boolean(selectedJobId),
});
```

### 3d. New `YouTubePackageCard` component

A compact card that shows:
- Title (full)
- Short description
- Tags as chips (up to 10)
- Privacy, Category, Video key (truncated), Thumbnail key (truncated)
- "youtube-package.json not yet generated" if null

### 3e. Placement

- **Review tab**: Render `<YouTubePackageCard>` below the existing ReviewCard
- **Publish tab**: Render `<YouTubePackageCard>` above the publish-guard block (as a pre-flight summary)

## Part 4: Verify script

In `tools/scripts/verify-aws-video-generation-mode.sh`, for both `hybrid_slideshow` and `hybrid_image_slideshow` modes (and optionally `hybrid_tts`, `hybrid_storyboard`):

After the `metadata/publish.json` check, add:
```bash
require_s3_file "$JOB_ID/metadata/youtube-package.json" "youtube-package.json"
check_json_field "$YOUTUBE_PACKAGE_JSON" ".title" "title"
check_json_field "$YOUTUBE_PACKAGE_JSON" ".description" "description"
check_json_array "$YOUTUBE_PACKAGE_JSON" ".tags" "tags"
check_json_field "$YOUTUBE_PACKAGE_JSON" ".videoKey" "videoKey"
```

## Part 5: Documentation

Update `operations/runbooks/aws-video.md` (or the relevant doc file):
- Remove "title is just the prompt" wording
- Document canonical sequence: draft → approve script → generate media (creates youtube-package.json) → review package/media → dry-run → private publish
- Document that `youtube-package.json` is the canonical source of truth for title/description/tags
- Document that `publish.json` preserves `youtubePackageKey` pointing to it

## File change list

| File | Change |
|------|--------|
| `projects/brain-core/src/providers/youtube-package-builder.ts` | **NEW** — pure builder function |
| `projects/brain-core/src/providers/video-orchestrator-provider.ts` | Add write at ~line 3140; update repairPublishJson; add youtubePackageKey to publishJson |
| `projects/video-orchestrator/cloud/scripts/youtube-upload-local.sh` | Read youtube-package.json; fix hardcoded tags[] |
| `projects/brain-console-center/lib/braincore-schemas.ts` | Add youtubePackageSchema |
| `projects/brain-console-center/components/aws-video-dashboard.tsx` | Add YouTubePackageCard, query, placement in Review + Publish tabs |
| `tools/scripts/verify-aws-video-generation-mode.sh` | Add youtube-package.json check for hybrid modes |
| `operations/runbooks/aws-video.md` (or equivalent) | Update sequence docs |

## Verification

1. `cd projects/brain-core && npm run typecheck` — no errors
2. `cd projects/brain-console-center && npm run typecheck` — no errors
3. Reset dev: `tools/scripts/brain-console-center-dev-reset.sh hybrid_image_slideshow`
4. Create fresh job: "Make a video about a cozy nursery with soft toys and warm sunlight."
5. Draft → approve → generate
6. `aws s3 cp s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/metadata/youtube-package.json - --region eu-north-1 | jq`  
   Confirm: title clean (no "[PIPELINE PROOF]" for image slideshow, no "Make a video"), description public-facing, 8-15 tags
7. In Brain Console Center → Review tab: YouTube Package card shows title/description/tags
8. In Brain Console Center → Publish tab: same card appears before dry-run buttons
9. Run dry-run — confirm logs show the clean title
10. `tools/scripts/verify-aws-video-generation-mode.sh hybrid_image_slideshow $JOB_ID` — youtube-package.json check passes
