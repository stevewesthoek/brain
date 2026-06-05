/**
 * YouTube package builder — generates canonical metadata for YouTube upload
 * Called at generation time to create title, description, and tags for publishing
 */

export interface ScenePlanScene {
  index: number;
  durationSeconds: number;
  visualPrompt: string;
  narrationText: string;
  onScreenText?: string;
}

export interface YouTubePackage {
  jobId: string;
  sourcePrompt: string;
  generationMode: string;
  title: string;
  description: string;
  shortDescription: string;
  tags: string[];
  searchKeywords: string[];
  categoryId: string;
  privacyStatus: 'private';
  thumbnailKey: string | null;
  videoKey: string | null;
  scenePlanKey: string | null;
  narrationScriptKey: string | null;
  youtubePackageKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubePackageInput {
  jobId: string;
  topicTitle: string;
  topicDescription?: string | null | undefined;
  generationMode: string;
  mediaSource: string;
  videoKey?: string | null;
  thumbnailKey?: string | null;
  scenePlanKey?: string | null;
  narrationScriptKey?: string | null;
  scenePlan?: ScenePlanScene[] | null | undefined;
}

function cleanTitle(rawTitle: string): string {
  let title = rawTitle;

  // Strip common "make a video about" prefixes
  title = title.replace(/^(make a video (about|on|for|of)|create a video (about|on)|a video (about|on|of))\s*/i, '');

  // Strip [PIPELINE PROOF] prefix (will be re-added if needed)
  title = title.replace(/^\[PIPELINE PROOF\]\s*/, '');

  // Title-case: split on spaces/punctuation, capitalize each word
  title = title
    .split(/(\s+)/)
    .map((word, i) => {
      if (i % 2 === 1) return word; // preserve whitespace
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');

  // Trim to 100 chars max, break at word boundary
  if (title.length > 100) {
    title = title.substring(0, 100);
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 50) {
      title = title.substring(0, lastSpace);
    }
    title = title.trim();
  }

  return title;
}

function buildDescription(
  topicTitle: string,
  topicDescription?: string | null,
  generationMode?: string,
  scenePlan?: ScenePlanScene[] | null,
): string {
  const parts: string[] = [];

  // Base: "A {topic} video."
  if (topicTitle) {
    parts.push(`A ${topicTitle.toLowerCase()} video.`);
  }

  // Add topic description if available and doesn't mention internals
  if (topicDescription && topicDescription.length > 0) {
    const cleaned = topicDescription
      .replace(/AWS|Amazon|Bedrock|S3|Lambda|Step Functions|Pipeline|Fixture|[Bb]rain [Cc]ore/g, '')
      .trim();
    if (cleaned && cleaned.length > 10) {
      parts.push(cleaned);
    }
  }

  // Add scene narration summaries (up to 3)
  if (scenePlan && Array.isArray(scenePlan)) {
    for (let i = 0; i < Math.min(3, scenePlan.length); i++) {
      const scene = scenePlan[i];
      if (scene?.narrationText && scene.narrationText.length > 0) {
        // Truncate narration to first sentence
        const firstSentence = scene.narrationText.split(/[.!?]/)[0] || scene.narrationText;
        if (firstSentence.length > 0) {
          parts.push(`${firstSentence.trim()}.`);
        }
      }
    }
  }

  let description = parts.join(' ');

  // Ensure under 5000 chars
  if (description.length > 5000) {
    description = description.substring(0, 4950) + '…';
  }

  return description || `A video about ${topicTitle || 'a topic'}.`;
}

function extractTags(
  topicTitle: string,
  topicDescription?: string | null,
  scenePlan?: ScenePlanScene[] | null,
): string[] {
  const tags = new Set<string>();
  const internalWords = new Set([
    'hybrid', 'fixture', 'pipeline', 'brain', 'core', 'aws', 'polly', 'nova', 'canvas',
    'bedrock', 'ffmpeg', 'slideshow', 'proof', 'test', 'demo', 'internal', 'development',
  ]);

  // Extract from topic title: lowercase words, 2-word phrases
  const titleWords = topicTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  for (const word of titleWords) {
    if (!internalWords.has(word)) {
      tags.add(word);
    }
  }

  // Extract 2-word phrases from topic title
  for (let i = 0; i < titleWords.length - 1; i++) {
    const phrase = `${titleWords[i]} ${titleWords[i + 1]}`;
    if (
      phrase.length <= 50 &&
      !Array.from(internalWords).some(iw => phrase.includes(iw))
    ) {
      tags.add(phrase);
    }
  }

  // Extract from topic description
  if (topicDescription && topicDescription.length > 0) {
    const descWords = topicDescription
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && !internalWords.has(w));
    for (const word of descWords.slice(0, 10)) {
      tags.add(word);
    }
  }

  // Add scene visual prompts and narration text as tags
  if (scenePlan && Array.isArray(scenePlan)) {
    for (const scene of scenePlan.slice(0, 5)) {
      // Extract from visual prompt
      if (scene?.visualPrompt) {
        const promptWords = scene.visualPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const word of promptWords.slice(0, 3)) {
          if (!internalWords.has(word)) {
            tags.add(word);
          }
        }
      }
      // Extract from narration text
      if (scene?.narrationText) {
        const narrationWords = scene.narrationText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const word of narrationWords.slice(0, 3)) {
          if (!internalWords.has(word)) {
            tags.add(word);
          }
        }
      }
    }
  }

  // Filter to 8-15 tags, each ≤50 chars
  const tagArray = Array.from(tags)
    .filter(t => t.length <= 50)
    .sort()
    .slice(0, 15);

  // Ensure at least 8 tags; pad with generic ones if needed
  while (tagArray.length < 8) {
    const fallbacks = ['video', 'educational', 'informative', 'content', 'commentary', 'discussion', 'tutorial', 'how-to'];
    for (const fallback of fallbacks) {
      if (!tags.has(fallback) && tagArray.length < 8) {
        tagArray.push(fallback);
      }
    }
    if (tagArray.length < 8) break;
  }

  return tagArray;
}

export function buildYouTubePackage(input: YouTubePackageInput): YouTubePackage {
  const now = new Date().toISOString();
  const cleanedTitle = cleanTitle(input.topicTitle);

  // Determine if this is a fixture-video mode (needs [PIPELINE PROOF])
  const isFixtureVideo =
    input.generationMode === 'hybrid_tts_fixture_video' ||
    input.generationMode === 'hybrid_storyboard_fixture_video' ||
    input.generationMode === 'hybrid_scene_plan_fixture_media' ||
    input.generationMode === 'fixture_assembly';

  const finalTitle = isFixtureVideo ? `[PIPELINE PROOF] ${cleanedTitle}` : cleanedTitle;

  const description = buildDescription(
    input.topicTitle,
    input.topicDescription,
    input.generationMode,
    input.scenePlan,
  );

  const shortDescription = description.length > 150
    ? description.substring(0, 147) + '…'
    : description;

  const tags = extractTags(input.topicTitle, input.topicDescription, input.scenePlan);
  const searchKeywords = Array.from(new Set([...tags, ...input.topicTitle.toLowerCase().split(/\s+/)]));

  return {
    jobId: input.jobId,
    sourcePrompt: input.topicTitle,
    generationMode: input.generationMode,
    title: finalTitle,
    description,
    shortDescription,
    tags,
    searchKeywords,
    categoryId: '22',
    privacyStatus: 'private',
    thumbnailKey: input.thumbnailKey ?? null,
    videoKey: input.videoKey ?? null,
    scenePlanKey: input.scenePlanKey ?? null,
    narrationScriptKey: input.narrationScriptKey ?? null,
    youtubePackageKey: `jobs/${input.jobId}/metadata/youtube-package.json`,
    createdAt: now,
    updatedAt: now,
  };
}
