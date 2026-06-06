/**
 * YouTube package builder — generates canonical metadata for YouTube upload.
 *
 * The package is public-facing metadata. It must not leak implementation details
 * such as AWS service names, fixture assets, or internal pipeline terminology.
 */

export interface ScenePlanScene {
  index: number;
  durationSeconds: number;
  visualPrompt: string;
  narrationText: string;
  onScreenText?: string;
}

export interface MetadataQuality {
  warnings: string[];
  titleLength: number;
  tagCount: number;
  descriptionLength: number;
  hasInternalTerms: boolean;
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
  metadataQuality?: MetadataQuality;
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

const INTERNAL_WORDS = new Set([
  'hybrid', 'fixture', 'pipeline', 'brain', 'core', 'aws', 'amazon', 'polly', 'nova', 'canvas',
  'bedrock', 'ffmpeg', 'slideshow', 'proof', 'test', 'demo', 'internal', 'development',
  'lambda', 's3', 'step', 'functions', 'mediaconvert', 'generated', 'generation',
]);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'into',
  'is', 'it', 'its', 'make', 'of', 'on', 'or', 'our', 'the', 'this', 'to', 'with', 'video',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hasInternalTerms(value: string): boolean {
  const internalPattern = /\[PIPELINE PROOF\]|AWS|Amazon|Bedrock|S3|Lambda|Step Functions|Pipeline|Fixture|Brain Core|Nova Canvas|Polly|FFmpeg/i;
  return internalPattern.test(value);
}

function stripInternalTerms(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\[PIPELINE PROOF\]/gi, '')
      .replace(/AWS|Amazon|Bedrock|S3|Lambda|Step Functions|Pipeline|Fixture|Brain Core|Nova Canvas|Polly|FFmpeg/gi, '')
      .replace(/\s+([,.!?])/g, '$1'),
  );
}

function stripPromptCommand(rawTitle: string): string {
  return normalizeWhitespace(
    rawTitle
      .replace(/^\[PIPELINE PROOF\]\s*/i, '')
      .replace(/^(please\s+)?(make|create|generate|produce)\s+(me\s+)?(a\s+)?(short\s+)?video\s+(about|on|for|of)\s+/i, '')
      .replace(/^(please\s+)?(make|create|generate|produce)\s+(a\s+)?(short\s+)?video\s*/i, '')
      .replace(/^(a\s+)?(short\s+)?video\s+(about|on|of)\s+/i, '')
      .replace(/[\s.]+$/g, ''),
  );
}

function titleCase(value: string): string {
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  return value
    .split(/(\s+)/)
    .map((part, index) => {
      if (/^\s+$/.test(part)) return part;
      if (!part) return part;
      const lower = part.toLowerCase();
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.replace(/(^|[-/])([a-z0-9])/g, (_match, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`);
    })
    .join('');
}

function cleanTitle(rawTitle: string): string {
  const subject = stripPromptCommand(stripInternalTerms(rawTitle));
  const fallback = subject || 'Short Video';
  let title = titleCase(fallback);

  // YouTube title limit is 100 chars; we target 80 for safety margin
  const maxLength = 80;
  if (title.length > maxLength) {
    title = title.substring(0, maxLength);
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 40) title = title.substring(0, lastSpace);
    title = title.trim();
  }

  // Remove trailing punctuation junk
  title = title.replace(/[\s.,:;!?-]+$/, '');

  return title;
}

function cleanSentence(value: string): string | null {
  const cleaned = stripInternalTerms(value)
    .replace(/^scene\s+\d+\s*[:.-]?\s*/i, '')
    .replace(/\s+scene\s+\d+\s*$/i, '')
    .trim();

  if (cleaned.length < 8) return null;
  const sentence = cleaned.replace(/[.!?]+$/g, '');
  return `${sentence}.`;
}

function buildDescription(
  topicTitle: string,
  topicDescription?: string | null,
  _generationMode?: string,
  scenePlan?: ScenePlanScene[] | null,
): string {
  const subject = stripPromptCommand(stripInternalTerms(topicTitle));
  const titleSubject = subject ? titleCase(subject) : 'This short video';
  const parts: string[] = [`A short video about ${titleSubject}.`];

  const topicSummary = topicDescription ? cleanSentence(topicDescription) : null;
  if (topicSummary && !parts.includes(topicSummary)) {
    parts.push(topicSummary);
  }

  const sceneSummaries = new Set<string>();
  if (scenePlan && Array.isArray(scenePlan)) {
    for (const scene of scenePlan.slice(0, 3)) {
      const sentence = cleanSentence(scene?.narrationText || scene?.visualPrompt || '');
      if (sentence) sceneSummaries.add(sentence);
    }
  }

  for (const sentence of sceneSummaries) {
    if (parts.join(' ').length + sentence.length > 850) break;
    if (!parts.includes(sentence)) parts.push(sentence);
  }

  parts.push('Created as a private preview for review before public release.');

  let description = normalizeWhitespace(parts.join(' '));
  if (description.length > 1000) {
    description = `${description.substring(0, 997).trim()}…`;
  }
  return description;
}

function tokenize(value: string): string[] {
  return stripInternalTerms(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 2 && !STOP_WORDS.has(word) && !INTERNAL_WORDS.has(word));
}

function addTag(tags: Set<string>, value: string): void {
  const tag = normalizeWhitespace(value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' '));
  if (!tag || tag.length > 50) return;
  if (tag.split(/\s+/).some(word => INTERNAL_WORDS.has(word))) return;
  tags.add(tag);
}

function extractTags(
  topicTitle: string,
  topicDescription?: string | null,
  scenePlan?: ScenePlanScene[] | null,
): string[] {
  const tags = new Set<string>();
  const titleSubject = stripPromptCommand(topicTitle);
  const titleWords = tokenize(titleSubject);

  if (titleSubject) addTag(tags, titleSubject);
  for (const word of titleWords) addTag(tags, word);
  for (let i = 0; i < titleWords.length - 1; i++) {
    addTag(tags, `${titleWords[i]} ${titleWords[i + 1]}`);
  }

  if (topicDescription) {
    for (const word of tokenize(topicDescription).slice(0, 8)) addTag(tags, word);
  }

  if (scenePlan && Array.isArray(scenePlan)) {
    for (const scene of scenePlan.slice(0, 5)) {
      for (const word of tokenize(`${scene?.visualPrompt || ''} ${scene?.narrationText || ''}`).slice(0, 4)) {
        addTag(tags, word);
      }
    }
  }

  const preferred = Array.from(tags).filter(tag => tag.length <= 50);
  const fallbacks = ['short video', 'visual story', 'ai video', 'creative video', 'video preview', 'private preview'];
  for (const fallback of fallbacks) {
    if (preferred.length >= 8) break;
    if (!preferred.includes(fallback)) preferred.push(fallback);
  }

  return preferred.slice(0, 15);
}

export function buildYouTubePackage(input: YouTubePackageInput): YouTubePackage {
  const now = new Date().toISOString();
  const cleanedTitle = cleanTitle(input.topicTitle);

  // Fixture-video modes are proof assets and must be clearly labeled.
  // Generated-media modes such as hybrid_slideshow_video and hybrid_image_slideshow_video
  // must not get the [PIPELINE PROOF] prefix.
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
    ? `${description.substring(0, 147).trim()}…`
    : description;

  const tags = extractTags(input.topicTitle, input.topicDescription, input.scenePlan);
  const searchKeywords = Array.from(new Set([...tags, ...tokenize(input.topicTitle)]));

  const canonicalThumbnailKey = input.thumbnailKey ?? `jobs/${input.jobId}/exports/thumbnail-001.jpg`;

  // Compute metadata quality indicators
  // Check if source inputs contain internal terms (before cleaning)
  const sourceHasInternalTerms = hasInternalTerms(input.topicTitle) ||
    (input.topicDescription ? hasInternalTerms(input.topicDescription) : false);

  const qualityWarnings: string[] = [];
  if (hasInternalTerms(finalTitle)) qualityWarnings.push('Title contains internal terms');
  if (hasInternalTerms(description)) qualityWarnings.push('Description contains internal terms');
  if (finalTitle.length > 80) qualityWarnings.push(`Title is ${finalTitle.length} chars (target: ≤80)`);
  if (description.length > 1000) qualityWarnings.push(`Description is ${description.length} chars (target: ≤1000)`);
  if (tags.length < 8) qualityWarnings.push(`Only ${tags.length} tags (recommend: 8–15)`);
  if (tags.length > 15) qualityWarnings.push(`${tags.length} tags exceed recommended max of 15`);

  const metadataQuality: MetadataQuality = {
    warnings: qualityWarnings,
    titleLength: finalTitle.length,
    tagCount: tags.length,
    descriptionLength: description.length,
    hasInternalTerms: sourceHasInternalTerms || hasInternalTerms(finalTitle) || hasInternalTerms(description),
  };

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
    thumbnailKey: canonicalThumbnailKey,
    videoKey: input.videoKey ?? null,
    scenePlanKey: input.scenePlanKey ?? null,
    narrationScriptKey: input.narrationScriptKey ?? null,
    youtubePackageKey: `jobs/${input.jobId}/metadata/youtube-package.json`,
    createdAt: now,
    updatedAt: now,
    metadataQuality,
  };
}
