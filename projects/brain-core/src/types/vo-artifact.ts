/**
 * JobArtifact — central document that travels with every video job.
 * Each module writes back to its own section; stored in task_config JSONB in Postgres.
 * Mirror of worker/artifact.py — keep in sync.
 */

export type ArtifactStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface AudioArtifact {
  status: ArtifactStatus;
  normalizedPath: string | null;
  loudnessLufs: number | null;
  peakDbfs: number | null;
  sampleRateHz: number | null;
  completedAt: string | null;
  error: string | null;
}

export interface CompositionOutput {
  path: string;
  width: number;
  height: number;
  durationSec: number;
  fileSizeBytes: number;
  codec: string;
  bitrateKbps: number;
}

export interface CompositionArtifact {
  status: ArtifactStatus;
  outputs: Record<string, CompositionOutput>;  // keyed by platform_spec_id
  completedAt: string | null;
  error: string | null;
}

export interface SubtitleArtifact {
  status: ArtifactStatus;
  model: string | null;
  srtPath: string | null;
  vttPath: string | null;
  wordCount: number | null;
  completedAt: string | null;
  error: string | null;
}

export interface ThumbnailVariant {
  id: string;           // "variant_a" | "variant_b"
  path: string;
  template: string;
  headlineText: string;
  active: boolean;
}

export interface ThumbnailArtifact {
  status: ArtifactStatus;
  variants: ThumbnailVariant[];
  abTestActive: boolean;
  completedAt: string | null;
  error: string | null;
}

export interface PlatformMetadata {
  title: string;
  description: string;
  tags: string[];
  chapters: Array<{ title: string; startSec: number }>;
  hashtags: string[];
}

export interface MetadataArtifact {
  status: ArtifactStatus;
  generatedBy: string | null;  // "gpt-4o" | "ollama" | "manual"
  platforms: Record<string, PlatformMetadata>;
  completedAt: string | null;
  error: string | null;
}

export interface PublishingResult {
  status: 'published' | 'failed' | 'manual';
  platformVideoId: string | null;
  url: string | null;
  publishedAt: string | null;
  error: string | null;
}

export interface AnalyticsSnapshot {
  fetchedAt: string;
  views: number;
  impressions: number;
  ctr: number;
  avgViewDurationSec: number;
  likes: number;
  comments: number;
}

export interface JobArtifact {
  jobId: string;
  createdAt: string;
  status: string;
  version: string;
  // Source inputs
  audioPath: string | null;
  backgroundPath: string | null;
  transcriptPath: string | null;
  durationSec: number | null;
  language: string;
  targets: string[];  // platform_spec_ids
  // Module outputs
  audio: AudioArtifact | null;
  composition: CompositionArtifact | null;
  subtitles: SubtitleArtifact | null;
  thumbnail: ThumbnailArtifact | null;
  metadata: MetadataArtifact | null;
  publishing: Record<string, PublishingResult>;
  analytics: Record<string, AnalyticsSnapshot[]>;
}

// ---------------------------------------------------------------------------
// Wire format (snake_case from Postgres JSONB) → camelCase TypeScript
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

function toCompositionOutput(r: Raw): CompositionOutput {
  return {
    path: r.path,
    width: r.width,
    height: r.height,
    durationSec: r.duration_sec,
    fileSizeBytes: r.file_size_bytes,
    codec: r.codec,
    bitrateKbps: r.bitrate_kbps,
  };
}

function toAudioArtifact(r: Raw | null): AudioArtifact | null {
  if (!r) return null;
  return {
    status: r.status,
    normalizedPath: r.normalized_path ?? null,
    loudnessLufs: r.loudness_lufs ?? null,
    peakDbfs: r.peak_dbfs ?? null,
    sampleRateHz: r.sample_rate_hz ?? null,
    completedAt: r.completed_at ?? null,
    error: r.error ?? null,
  };
}

function toCompositionArtifact(r: Raw | null): CompositionArtifact | null {
  if (!r) return null;
  const outputs: Record<string, CompositionOutput> = {};
  for (const [k, v] of Object.entries(r.outputs ?? {})) {
    outputs[k] = toCompositionOutput(v as Raw);
  }
  return { status: r.status, outputs, completedAt: r.completed_at ?? null, error: r.error ?? null };
}

function toSubtitleArtifact(r: Raw | null): SubtitleArtifact | null {
  if (!r) return null;
  return {
    status: r.status,
    model: r.model ?? null,
    srtPath: r.srt_path ?? null,
    vttPath: r.vtt_path ?? null,
    wordCount: r.word_count ?? null,
    completedAt: r.completed_at ?? null,
    error: r.error ?? null,
  };
}

function toThumbnailArtifact(r: Raw | null): ThumbnailArtifact | null {
  if (!r) return null;
  const variants: ThumbnailVariant[] = (r.variants ?? []).map((v: Raw) => ({
    id: v.id,
    path: v.path,
    template: v.template,
    headlineText: v.headline_text,
    active: v.active ?? false,
  }));
  return {
    status: r.status,
    variants,
    abTestActive: r.ab_test_active ?? false,
    completedAt: r.completed_at ?? null,
    error: r.error ?? null,
  };
}

function toMetadataArtifact(r: Raw | null): MetadataArtifact | null {
  if (!r) return null;
  const platforms: Record<string, PlatformMetadata> = {};
  for (const [k, v] of Object.entries(r.platforms ?? {})) {
    const p = v as Raw;
    platforms[k] = {
      title: p.title,
      description: p.description,
      tags: p.tags ?? [],
      chapters: p.chapters ?? [],
      hashtags: p.hashtags ?? [],
    };
  }
  return {
    status: r.status,
    generatedBy: r.generated_by ?? null,
    platforms,
    completedAt: r.completed_at ?? null,
    error: r.error ?? null,
  };
}

export function jobArtifactFromWire(r: Raw): JobArtifact {
  const publishing: Record<string, PublishingResult> = {};
  for (const [k, v] of Object.entries(r.publishing ?? {})) {
    const p = v as Raw;
    publishing[k] = {
      status: p.status,
      platformVideoId: p.platform_video_id ?? null,
      url: p.url ?? null,
      publishedAt: p.published_at ?? null,
      error: p.error ?? null,
    };
  }

  const analytics: Record<string, AnalyticsSnapshot[]> = {};
  for (const [k, v] of Object.entries(r.analytics ?? {})) {
    analytics[k] = (v as Raw[]).map((s) => ({
      fetchedAt: s.fetched_at,
      views: s.views ?? 0,
      impressions: s.impressions ?? 0,
      ctr: s.ctr ?? 0,
      avgViewDurationSec: s.avg_view_duration_sec ?? 0,
      likes: s.likes ?? 0,
      comments: s.comments ?? 0,
    }));
  }

  return {
    jobId: r.job_id,
    createdAt: r.created_at,
    status: r.status,
    version: r.version ?? '1.0',
    audioPath: r.audio_path ?? null,
    backgroundPath: r.background_path ?? null,
    transcriptPath: r.transcript_path ?? null,
    durationSec: r.duration_sec ?? null,
    language: r.language ?? 'en',
    targets: r.targets ?? [],
    audio: toAudioArtifact(r.audio ?? null),
    composition: toCompositionArtifact(r.composition ?? null),
    subtitles: toSubtitleArtifact(r.subtitles ?? null),
    thumbnail: toThumbnailArtifact(r.thumbnail ?? null),
    metadata: toMetadataArtifact(r.metadata ?? null),
    publishing,
    analytics,
  };
}

export function newJobArtifact(jobId: string): JobArtifact {
  return {
    jobId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    version: '1.0',
    audioPath: null,
    backgroundPath: null,
    transcriptPath: null,
    durationSec: null,
    language: 'en',
    targets: [],
    audio: null,
    composition: null,
    subtitles: null,
    thumbnail: null,
    metadata: null,
    publishing: {},
    analytics: {},
  };
}
