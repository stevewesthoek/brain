import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { VideoAnalysisResult } from './research-video.js';

const DEFAULT_RELATIVE_PATH = 'runtime/local/brain-core/video-analysis-history.json';
const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'mind'];
const MAX_HISTORY_ENTRIES = 12;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const YOUTUBE_OEMBED_CACHE = new Map<string, { title: string | null; channel: string | null }>();

export interface BrainCoreVideoAnalysisHistoryAiSummary {
  topic: string | null;
  speaker: string | null;
  keyClaims: string[];
  evidenceType: string | null;
  confidence: string | null;
  researchHooks: string[];
}

export interface BrainCoreVideoAnalysisHistoryEntry {
  id: string;
  analyzedAt: string;
  url: string;
  focus: string | null;
  ok: boolean;
  title: string | null;
  channel: string | null;
  transcript: string | null;
  humanSummary: string | null;
  aiSummary: BrainCoreVideoAnalysisHistoryAiSummary | null;
  mindPath: string | null;
  error: string | null;
  step: string | null;
  jobId?: string | null;
  sourceKind?: string | null;
  visualObservations?: Array<{
    timestamp_seconds: number;
    timestamp: string;
    label: string;
    observation: string;
    confidence?: string | number | null;
  }>;
  processing?: {
    transcript_provider: string | null;
    vision_provider: string | null;
    vision_model: string | null;
    frames_extracted: number;
    frames_sent_to_paid_vision: number;
    approximate_cost: number | null;
  } | undefined;
  warnings?: string[] | undefined;
}

export interface BrainCoreVideoAnalysisHistoryResponse {
  status: 'ok' | 'empty' | 'invalid';
  path: string;
  total: number;
  returned: number;
  entries: BrainCoreVideoAnalysisHistoryEntry[];
  latestAnalyzedAt: string | null;
  error?: string;
}

export function getDefaultVideoAnalysisHistoryPath(): string {
  return path.resolve(PACKAGE_ROOT, DEFAULT_RELATIVE_PATH);
}

export async function readVideoAnalysisHistory(limit = MAX_HISTORY_ENTRIES): Promise<BrainCoreVideoAnalysisHistoryResponse> {
  const resolvedPath = resolveSafeStorePath(process.env.BRAIN_CORE_VIDEO_ANALYSIS_HISTORY_PATH ?? getDefaultVideoAnalysisHistoryPath());
  if (!resolvedPath) {
    return {
      status: 'invalid',
      path: DEFAULT_RELATIVE_PATH,
      total: 0,
      returned: 0,
      entries: [],
      latestAnalyzedAt: null,
      error: 'Video analysis history path is unsafe or invalid.',
    };
  }

  if (!fs.existsSync(resolvedPath)) {
    return {
      status: 'empty',
      path: relativeStorePath(resolvedPath),
      total: 0,
      returned: 0,
      entries: [],
      latestAnalyzedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as Partial<{ entries: BrainCoreVideoAnalysisHistoryEntry[] }>;
    const entries = Array.isArray(parsed.entries)
      ? (await Promise.all(parsed.entries.map(normalizeEntry).map(async (entry) => hydrateMissingMetadata(entry))))
        .filter((entry) => entry.url.length > 0 && entry.analyzedAt.length > 0)
      : [];
    const limited = entries.slice(0, normalizeLimit(limit));
    return {
      status: 'ok',
      path: relativeStorePath(resolvedPath),
      total: entries.length,
      returned: limited.length,
      entries: limited,
      latestAnalyzedAt: limited[0]?.analyzedAt ?? null,
    };
  } catch (error) {
    return {
      status: 'invalid',
      path: relativeStorePath(resolvedPath),
      total: 0,
      returned: 0,
      entries: [],
      latestAnalyzedAt: null,
      error: error instanceof Error ? error.message : 'Video analysis history could not be read safely.',
    };
  }
}

export function recordVideoAnalysisHistory(
  url: string,
  focus: string | undefined,
  result: VideoAnalysisResult,
): boolean {
  const resolvedPath = resolveSafeStorePath(process.env.BRAIN_CORE_VIDEO_ANALYSIS_HISTORY_PATH ?? getDefaultVideoAnalysisHistoryPath());
  if (!resolvedPath) {
    return false;
  }

  const current = readRawHistory(resolvedPath);
  const entry = toHistoryEntry(url, focus, result);
  const entries = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES).map(normalizeEntry);

  try {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, `${JSON.stringify({ entries }, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

function readRawHistory(resolvedPath: string): BrainCoreVideoAnalysisHistoryEntry[] {
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as Partial<{ entries: BrainCoreVideoAnalysisHistoryEntry[] }>;
    return Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : [];
  } catch {
    return [];
  }
}

function toHistoryEntry(
  url: string,
  focus: string | undefined,
  result: VideoAnalysisResult,
): BrainCoreVideoAnalysisHistoryEntry {
  return normalizeEntry({
    id: buildHistoryId(url, result.title, result.channel, result.job_id),
    analyzedAt: new Date().toISOString(),
    url,
    focus: focus?.trim() ? focus.trim() : null,
    ok: result.ok === true,
    title: result.title?.trim() || null,
    channel: result.channel?.trim() || null,
    transcript: result.transcript?.text?.trim() || result.transcript_text?.trim() || null,
    humanSummary: result.human_summary?.trim() || null,
    aiSummary: result.ai_summary
      ? {
          topic: result.ai_summary.topic?.trim() || null,
          speaker: result.ai_summary.speaker?.trim() || null,
          keyClaims: Array.isArray(result.ai_summary.key_claims) ? result.ai_summary.key_claims.filter((claim) => typeof claim === 'string' && claim.trim().length > 0) : [],
          evidenceType: result.ai_summary.evidence_type?.trim() || null,
          confidence: result.ai_summary.confidence?.trim() || null,
          researchHooks: Array.isArray(result.ai_summary.research_hooks) ? result.ai_summary.research_hooks.filter((hook) => typeof hook === 'string' && hook.trim().length > 0) : [],
        }
      : null,
    mindPath: result.mind_path?.trim() || null,
    error: result.error?.trim() || null,
    step: result.step?.trim() || null,
    jobId: result.job_id || null,
    sourceKind: result.source?.kind || null,
    visualObservations: Array.isArray(result.visual_observations)
      ? result.visual_observations.map((finding) => ({
          timestamp_seconds: finding.timestamp_seconds,
          timestamp: finding.timestamp,
          label: finding.label,
          observation: finding.observation,
          confidence: finding.confidence ?? null,
        }))
      : [],
    processing: result.processing
      ? {
          transcript_provider: result.processing.transcript_provider,
          vision_provider: result.processing.vision_provider,
          vision_model: result.processing.vision_model,
          frames_extracted: result.processing.frames_extracted,
          frames_sent_to_paid_vision: result.processing.frames_sent_to_paid_vision,
          approximate_cost: result.processing.approximate_cost,
        }
      : undefined,
    warnings: [...result.warnings],
  });
}

function normalizeEntry(entry: BrainCoreVideoAnalysisHistoryEntry): BrainCoreVideoAnalysisHistoryEntry {
  return {
    id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : buildHistoryId(entry.url, entry.title, entry.channel),
    analyzedAt: typeof entry.analyzedAt === 'string' ? entry.analyzedAt : new Date().toISOString(),
    url: typeof entry.url === 'string' ? entry.url : '',
    focus: typeof entry.focus === 'string' && entry.focus.length > 0 ? entry.focus : null,
    ok: entry.ok === true,
    title: typeof entry.title === 'string' && entry.title.length > 0 ? entry.title : null,
    channel: typeof entry.channel === 'string' && entry.channel.length > 0 ? entry.channel : null,
    transcript: typeof entry.transcript === 'string' && entry.transcript.length > 0 ? entry.transcript : null,
    humanSummary: typeof entry.humanSummary === 'string' && entry.humanSummary.length > 0 ? entry.humanSummary : null,
    aiSummary: normalizeAiSummary(entry.aiSummary),
    mindPath: typeof entry.mindPath === 'string' && entry.mindPath.length > 0 ? entry.mindPath : null,
    error: typeof entry.error === 'string' && entry.error.length > 0 ? entry.error : null,
    step: typeof entry.step === 'string' && entry.step.length > 0 ? entry.step : null,
    jobId: typeof entry.jobId === 'string' && entry.jobId.length > 0 ? entry.jobId : null,
    sourceKind: typeof entry.sourceKind === 'string' && entry.sourceKind.length > 0 ? entry.sourceKind : null,
    visualObservations: Array.isArray(entry.visualObservations)
      ? entry.visualObservations.filter((finding) => finding && typeof finding.timestamp_seconds === 'number' && typeof finding.timestamp === 'string' && typeof finding.label === 'string' && typeof finding.observation === 'string')
      : [],
    processing: entry.processing
      ? {
          transcript_provider: typeof entry.processing.transcript_provider === 'string' ? entry.processing.transcript_provider : null,
          vision_provider: typeof entry.processing.vision_provider === 'string' ? entry.processing.vision_provider : null,
          vision_model: typeof entry.processing.vision_model === 'string' ? entry.processing.vision_model : null,
          frames_extracted: typeof entry.processing.frames_extracted === 'number' ? entry.processing.frames_extracted : 0,
          frames_sent_to_paid_vision: typeof entry.processing.frames_sent_to_paid_vision === 'number' ? entry.processing.frames_sent_to_paid_vision : 0,
          approximate_cost: typeof entry.processing.approximate_cost === 'number' ? entry.processing.approximate_cost : null,
        }
      : undefined,
    warnings: Array.isArray(entry.warnings) ? entry.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
  };
}

async function hydrateMissingMetadata(entry: BrainCoreVideoAnalysisHistoryEntry): Promise<BrainCoreVideoAnalysisHistoryEntry> {
  if (entry.title && entry.channel) {
    return entry;
  }

  const hostname = (() => {
    try { return new URL(entry.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
  })();
  if (entry.sourceKind && entry.sourceKind !== 'youtube-url') return entry;
  if (hostname && hostname !== 'youtube.com' && hostname !== 'm.youtube.com' && hostname !== 'youtu.be' && !hostname.endsWith('.youtube.com')) return entry;

  const cached = YOUTUBE_OEMBED_CACHE.get(entry.url);
  if (cached) {
    return {
      ...entry,
      title: entry.title ?? cached.title,
      channel: entry.channel ?? cached.channel,
    };
  }

  const metadata = await fetchYouTubeMetadata(entry.url);
  YOUTUBE_OEMBED_CACHE.set(entry.url, metadata);

  return {
    ...entry,
    title: entry.title ?? metadata.title,
    channel: entry.channel ?? metadata.channel,
  };
}

async function fetchYouTubeMetadata(youtubeUrl: string): Promise<{ title: string | null; channel: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return { title: null, channel: null };
    }
    const data = await response.json() as { title?: unknown; author_name?: unknown };
    return {
      title: typeof data.title === 'string' && data.title.length > 0 ? data.title : null,
      channel: typeof data.author_name === 'string' && data.author_name.length > 0 ? data.author_name : null,
    };
  } catch {
    return { title: null, channel: null };
  }
}

function normalizeAiSummary(value: BrainCoreVideoAnalysisHistoryAiSummary | null | undefined): BrainCoreVideoAnalysisHistoryAiSummary | null {
  if (!value) return null;
  return {
    topic: typeof value.topic === 'string' && value.topic.length > 0 ? value.topic : null,
    speaker: typeof value.speaker === 'string' && value.speaker.length > 0 ? value.speaker : null,
    keyClaims: Array.isArray(value.keyClaims) ? value.keyClaims.filter((claim) => typeof claim === 'string' && claim.trim().length > 0) : [],
    evidenceType: typeof value.evidenceType === 'string' && value.evidenceType.length > 0 ? value.evidenceType : null,
    confidence: typeof value.confidence === 'string' && value.confidence.length > 0 ? value.confidence : null,
    researchHooks: Array.isArray(value.researchHooks) ? value.researchHooks.filter((hook) => typeof hook === 'string' && hook.trim().length > 0) : [],
  };
}

function buildHistoryId(url: string, title: string | null | undefined, channel: string | null | undefined, jobId?: string | null): string {
  const seed = jobId ? `job:${jobId}` : `${url}|${title ?? ''}|${channel ?? ''}`;
  return `video-analysis-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 20)}`;
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return MAX_HISTORY_ENTRIES;
  return Math.max(1, Math.min(MAX_HISTORY_ENTRIES, Math.floor(limit)));
}

function resolveSafeStorePath(rawPath: string): string | undefined {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (segments.some((segment) => DISALLOWED_SEGMENTS.includes(segment))) {
    return undefined;
  }
  return path.resolve(rawPath);
}

function relativeStorePath(resolvedPath: string): string {
  const root = path.resolve(PACKAGE_ROOT);
  const relative = path.relative(root, resolvedPath);
  return relative || path.basename(resolvedPath);
}
