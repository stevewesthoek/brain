import { selectAI, TASK_TYPES } from './ai-model-selector.js';

export interface VideoOrchestratorMetadataInput {
  projectId: string;
  contentItemId: string;
  title?: string;
  description?: string;
  targetPlatforms?: Array<'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'linkedin' | 'bluesky'>;
  templateId?: string;
}

export interface VideoOrchestratorGeneratedMetadata {
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  /** @deprecated Use platforms.tiktok.description instead */
  tiktokCaption: string;
  /** @deprecated Use platforms.instagram.description instead */
  instagramCaption: string;
  hashtags: string[];
  platforms: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }>;
  source: 'ai' | 'fallback';
  provider?: string;
  model?: string;
}

// ── Raw LLM parse shape ────────────────────────────────────────────────────────

interface ParsedLLMMetadata {
  youtubeTitle?: string;
  youtubeDescription?: string;
  youtubeTags?: string[];
  tiktokCaption?: string;
  instagramCaption?: string;
  facebookPost?: string;
  linkedinPost?: string;
  blueskyPost?: string;
  hashtags?: string[];
  platforms?: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }>;
}

// ── Platform character limits ──────────────────────────────────────────────────

const PLATFORM_MAX_CHARS: Record<string, number> = {
  youtube: 5000,
  tiktok: 2200,
  instagram: 2200,
  facebook: 500,
  linkedin: 3000,
  bluesky: 300,
};

function maxCharsFor(platform: string): number {
  return PLATFORM_MAX_CHARS[platform] ?? 5000;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeTags(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 15);
}

/**
 * Truncate text to maxChars for a given platform. If already within limit,
 * returns text unchanged. Otherwise appends "..." after truncation.
 */
export function _truncateForPlatform(text: string, _platform: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

function buildFallback(input: VideoOrchestratorMetadataInput): VideoOrchestratorGeneratedMetadata {
  const baseTitle = input.title?.trim() || `Content ${input.contentItemId}`;
  const safeTitle = baseTitle.replace(/\s+/g, ' ').trim();
  const keywords = normalizeTags(input.description ?? '').slice(0, 5);
  const tags = Array.from(new Set([safeTitle, ...keywords, 'video', 'ai'])).slice(0, 10);
  const hashtags = tags.map((tag) => `#${tag.toLowerCase().replace(/[^a-z0-9]+/g, '')}`).filter((tag) => tag !== '#');

  const enabledPlatforms = input.targetPlatforms ?? ['youtube', 'tiktok', 'instagram'];

  const tiktokDesc = `${safeTitle} #shorts`.trim();
  const instagramDesc = `${safeTitle}\n\n${hashtags.slice(0, 5).join(' ')}`.trim();
  const facebookDesc = safeTitle;
  const linkedinDesc = `${safeTitle}\n\n${hashtags.slice(0, 5).join(' ')}`.trim();
  const blueskyDesc = _truncateForPlatform(safeTitle, 'bluesky', maxCharsFor('bluesky'));

  const allPlatforms: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }> = {
    youtube: { title: safeTitle, description: _truncateForPlatform(input.description?.trim() || safeTitle, 'youtube', maxCharsFor('youtube')), tags, hashtags },
    tiktok: { title: safeTitle, description: _truncateForPlatform(tiktokDesc, 'tiktok', maxCharsFor('tiktok')), tags, hashtags },
    instagram: { title: safeTitle, description: _truncateForPlatform(instagramDesc, 'instagram', maxCharsFor('instagram')), tags, hashtags },
    facebook: { title: safeTitle, description: _truncateForPlatform(facebookDesc, 'facebook', maxCharsFor('facebook')), tags, hashtags },
    linkedin: { title: safeTitle, description: _truncateForPlatform(linkedinDesc, 'linkedin', maxCharsFor('linkedin')), tags, hashtags },
    bluesky: { title: safeTitle, description: blueskyDesc, tags, hashtags },
  };

  // Only include platforms that are enabled
  const platforms: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }> = {};
  for (const platform of enabledPlatforms) {
    const entry = allPlatforms[platform];
    if (entry !== undefined) {
      platforms[platform] = entry;
    }
  }

  return {
    youtubeTitle: safeTitle,
    youtubeDescription: input.description?.trim() || `Watch ${safeTitle}.`,
    youtubeTags: tags,
    tiktokCaption: tiktokDesc,
    instagramCaption: instagramDesc,
    hashtags,
    platforms,
    source: 'fallback',
  };
}

export async function generateVideoOrchestratorMetadata(
  input: VideoOrchestratorMetadataInput,
): Promise<VideoOrchestratorGeneratedMetadata> {
  const enabledPlatforms = input.targetPlatforms ?? ['youtube', 'tiktok', 'instagram'];

  const prompt = [
    'Generate SEO metadata for a video package.',
    `Project ID: ${input.projectId}`,
    `Content Item ID: ${input.contentItemId}`,
    input.title ? `Title: ${input.title}` : '',
    input.description ? `Description: ${input.description}` : '',
    enabledPlatforms.length ? `Platforms: ${enabledPlatforms.join(', ')}` : '',
    input.templateId ? `Template: ${input.templateId}` : '',
    'Return concise JSON with the following fields:',
    '  youtubeTitle, youtubeDescription, youtubeTags, hashtags',
    enabledPlatforms.includes('tiktok') ? '  tiktokCaption (max 2200 chars)' : '',
    enabledPlatforms.includes('instagram') ? '  instagramCaption (max 2200 chars)' : '',
    enabledPlatforms.includes('facebook') ? '  facebookPost (max 500 chars)' : '',
    enabledPlatforms.includes('linkedin') ? '  linkedinPost (max 3000 chars)' : '',
    enabledPlatforms.includes('bluesky') ? '  blueskyPost (max 300 chars)' : '',
    'Also include a platforms record with per-platform title, description, tags, and hashtags.',
  ].filter(Boolean).join('\n');

  try {
    const selection = await selectAI(TASK_TYPES.METADATA_GENERATION, {
      inputTokens: Math.max(1, prompt.length),
      timeoutMs: 5000,
    });

    const response = await fetch(`${selection.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(selection.apiKey ? { Authorization: `Bearer ${selection.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: selection.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Metadata generation failed: ${response.status}`);
    }

    const data = await response.json() as {
      output_text?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.output_text ?? data.choices?.[0]?.message?.content ?? '';

    let parsed: ParsedLLMMetadata | null = null;
    try {
      parsed = JSON.parse(raw) as ParsedLLMMetadata;
    } catch {
      parsed = null;
    }

    if (!parsed?.youtubeTitle || !parsed?.youtubeDescription) {
      const fallback = buildFallback(input);
      return {
        ...fallback,
        source: 'ai',
        provider: selection.providerId,
        model: selection.model,
      };
    }

    const youtubeTitle = parsed.youtubeTitle;
    const youtubeDescription = parsed.youtubeDescription;
    const youtubeTags = Array.isArray(parsed.youtubeTags) ? parsed.youtubeTags : [];
    const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];

    // Build platforms record with truncation applied
    const builtPlatforms: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }> = {};

    if (enabledPlatforms.includes('youtube')) {
      builtPlatforms.youtube = {
        title: youtubeTitle,
        description: _truncateForPlatform(youtubeDescription, 'youtube', maxCharsFor('youtube')),
        tags: youtubeTags,
        hashtags,
      };
    }
    if (enabledPlatforms.includes('tiktok')) {
      const tiktokDesc = parsed.tiktokCaption ?? youtubeDescription;
      builtPlatforms.tiktok = {
        title: youtubeTitle,
        description: _truncateForPlatform(tiktokDesc, 'tiktok', maxCharsFor('tiktok')),
        tags: youtubeTags,
        hashtags,
      };
    }
    if (enabledPlatforms.includes('instagram')) {
      const instagramDesc = parsed.instagramCaption ?? youtubeDescription;
      builtPlatforms.instagram = {
        title: youtubeTitle,
        description: _truncateForPlatform(instagramDesc, 'instagram', maxCharsFor('instagram')),
        tags: youtubeTags,
        hashtags,
      };
    }
    if (enabledPlatforms.includes('facebook')) {
      const facebookDesc = parsed.facebookPost ?? youtubeDescription;
      builtPlatforms.facebook = {
        title: youtubeTitle,
        description: _truncateForPlatform(facebookDesc, 'facebook', maxCharsFor('facebook')),
        tags: youtubeTags,
        hashtags,
      };
    }
    if (enabledPlatforms.includes('linkedin')) {
      const linkedinDesc = parsed.linkedinPost ?? youtubeDescription;
      builtPlatforms.linkedin = {
        title: youtubeTitle,
        description: _truncateForPlatform(linkedinDesc, 'linkedin', maxCharsFor('linkedin')),
        tags: youtubeTags,
        hashtags,
      };
    }
    if (enabledPlatforms.includes('bluesky')) {
      const blueskyDesc = parsed.blueskyPost ?? youtubeDescription;
      builtPlatforms.bluesky = {
        title: youtubeTitle,
        description: _truncateForPlatform(blueskyDesc, 'bluesky', maxCharsFor('bluesky')),
        tags: youtubeTags,
        hashtags,
      };
    }

    // Merge with any existing parsed.platforms, preferring our built entries
    const platforms = { ...(parsed.platforms ?? {}), ...builtPlatforms };

    return {
      youtubeTitle,
      youtubeDescription,
      youtubeTags,
      tiktokCaption: parsed.tiktokCaption ?? youtubeDescription,
      instagramCaption: parsed.instagramCaption ?? youtubeDescription,
      hashtags,
      platforms,
      source: 'ai',
      provider: selection.providerId,
      model: selection.model,
    };
  } catch {
    return buildFallback(input);
  }
}
