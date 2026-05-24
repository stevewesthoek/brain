import { selectAI, TASK_TYPES } from './ai-model-selector.js';

export interface VideoOrchestratorMetadataInput {
  projectId: string;
  contentItemId: string;
  title?: string;
  description?: string;
  targetPlatforms?: Array<'youtube' | 'tiktok' | 'instagram'>;
  templateId?: string;
}

export interface VideoOrchestratorGeneratedMetadata {
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  tiktokCaption: string;
  instagramCaption: string;
  hashtags: string[];
  platforms: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }>;
  source: 'ai' | 'fallback';
  provider?: string;
  model?: string;
}

function normalizeTags(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 15);
}

function buildFallback(input: VideoOrchestratorMetadataInput): VideoOrchestratorGeneratedMetadata {
  const baseTitle = input.title?.trim() || `Content ${input.contentItemId}`;
  const safeTitle = baseTitle.replace(/\s+/g, ' ').trim();
  const keywords = normalizeTags(input.description ?? '').slice(0, 5);
  const tags = Array.from(new Set([safeTitle, ...keywords, 'video', 'ai'])).slice(0, 10);
  const hashtags = tags.map((tag) => `#${tag.toLowerCase().replace(/[^a-z0-9]+/g, '')}`).filter((tag) => tag !== '#');

  return {
    youtubeTitle: safeTitle,
    youtubeDescription: input.description?.trim() || `Watch ${safeTitle}.`,
    youtubeTags: tags,
    tiktokCaption: `${safeTitle} #shorts`.trim(),
    instagramCaption: `${safeTitle}\n\n${hashtags.slice(0, 5).join(' ')}`.trim(),
    hashtags,
    platforms: {
      youtube: { title: safeTitle, description: input.description?.trim() || safeTitle, tags, hashtags },
      tiktok: { title: safeTitle, description: `${safeTitle} #shorts`, tags, hashtags },
      instagram: { title: safeTitle, description: `${safeTitle}\n\n${hashtags.join(' ')}`.trim(), tags, hashtags },
    },
    source: 'fallback',
  };
}

export async function generateVideoOrchestratorMetadata(
  input: VideoOrchestratorMetadataInput,
): Promise<VideoOrchestratorGeneratedMetadata> {
  const prompt = [
    'Generate SEO metadata for a video package.',
    `Project ID: ${input.projectId}`,
    `Content Item ID: ${input.contentItemId}`,
    input.title ? `Title: ${input.title}` : '',
    input.description ? `Description: ${input.description}` : '',
    input.targetPlatforms?.length ? `Platforms: ${input.targetPlatforms.join(', ')}` : '',
    input.templateId ? `Template: ${input.templateId}` : '',
    'Return concise JSON with youtubeTitle, youtubeDescription, youtubeTags, tiktokCaption, instagramCaption, hashtags, and platform-specific variants.',
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

    let parsed: Partial<VideoOrchestratorGeneratedMetadata> | null = null;
    try {
      parsed = JSON.parse(raw) as Partial<VideoOrchestratorGeneratedMetadata>;
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

    const youtubeTags = Array.isArray(parsed.youtubeTags) ? parsed.youtubeTags : [];
    const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    const platforms = parsed.platforms ?? {
      youtube: { title: parsed.youtubeTitle, description: parsed.youtubeDescription, tags: youtubeTags, hashtags },
      tiktok: { title: parsed.youtubeTitle, description: parsed.tiktokCaption ?? parsed.youtubeDescription, tags: youtubeTags, hashtags },
      instagram: { title: parsed.youtubeTitle, description: parsed.instagramCaption ?? parsed.youtubeDescription, tags: youtubeTags, hashtags },
    };

    return {
      youtubeTitle: parsed.youtubeTitle,
      youtubeDescription: parsed.youtubeDescription,
      youtubeTags,
      tiktokCaption: parsed.tiktokCaption ?? parsed.youtubeDescription,
      instagramCaption: parsed.instagramCaption ?? parsed.youtubeDescription,
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
