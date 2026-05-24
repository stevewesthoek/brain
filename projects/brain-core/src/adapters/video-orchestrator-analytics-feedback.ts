import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'video-orchestrator', 'state');
const FEEDBACK_PATH = process.env['VO_FEEDBACK_PATH'] ?? path.join(DEFAULT_STATE_DIR, 'analytics-feedback.json');

export interface PublishOutcomeRecord {
  id: string;
  projectId: string;
  packageId: string;
  contentItemId?: string;
  thumbnailVariant?: string;
  metadataVariant?: string;
  status: 'succeeded' | 'failed';
  platform?: string;
  note?: string;
  createdAt: string;
}

export interface VideoMetricsRecord {
  id: string;
  projectId: string;
  packageId: string;
  contentItemId?: string;
  thumbnailVariant?: string;
  metadataVariant?: string;
  views24h: number;
  ctr: number;
  engagementRate: number;
  createdAt: string;
}

export interface FeedbackRecommendation {
  bestThumbnailVariant?: string;
  bestMetadataVariant?: string;
  note: string;
}

export interface FeedbackStore {
  outcomes: PublishOutcomeRecord[];
  metrics: VideoMetricsRecord[];
}

export interface FeedbackSummary {
  ok: boolean;
  projectId: string;
  outcomes: PublishOutcomeRecord[];
  metrics: VideoMetricsRecord[];
  recommendation: FeedbackRecommendation;
  error?: string;
}

function ensureDir(): void {
  fs.mkdirSync(path.dirname(FEEDBACK_PATH), { recursive: true });
}

function readStore(): FeedbackStore {
  if (!fs.existsSync(FEEDBACK_PATH)) {
    return { outcomes: [], metrics: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8')) as Partial<FeedbackStore>;
    return {
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes as PublishOutcomeRecord[] : [],
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics as VideoMetricsRecord[] : [],
    };
  } catch {
    return { outcomes: [], metrics: [] };
  }
}

function writeStore(store: FeedbackStore): void {
  ensureDir();
  fs.writeFileSync(FEEDBACK_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

export function recordPublishOutcome(input: Omit<PublishOutcomeRecord, 'id' | 'createdAt'>): FeedbackSummary {
  const store = readStore();
  const record: PublishOutcomeRecord = {
    ...input,
    id: `outcome-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  store.outcomes.push(record);
  writeStore(store);
  return summarizeFeedback(input.projectId);
}

export function recordVideoMetrics(input: Omit<VideoMetricsRecord, 'id' | 'createdAt'>): FeedbackSummary {
  const store = readStore();
  const record: VideoMetricsRecord = {
    ...input,
    id: `metrics-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  store.metrics.push(record);
  writeStore(store);
  return summarizeFeedback(input.projectId);
}

export function summarizeFeedback(projectId: string): FeedbackSummary {
  const store = readStore();
  const outcomes = store.outcomes.filter((item) => item.projectId === projectId);
  const metrics = store.metrics.filter((item) => item.projectId === projectId);

  const byThumbnail = new Map<string, { ctr: number; views: number; count: number }>();
  const byMetadata = new Map<string, { ctr: number; views: number; count: number }>();

  for (const metric of metrics) {
    if (metric.thumbnailVariant) {
      const current = byThumbnail.get(metric.thumbnailVariant) ?? { ctr: 0, views: 0, count: 0 };
      current.ctr += metric.ctr;
      current.views += metric.views24h;
      current.count += 1;
      byThumbnail.set(metric.thumbnailVariant, current);
    }
    if (metric.metadataVariant) {
      const current = byMetadata.get(metric.metadataVariant) ?? { ctr: 0, views: 0, count: 0 };
      current.ctr += metric.ctr;
      current.views += metric.views24h;
      current.count += 1;
      byMetadata.set(metric.metadataVariant, current);
    }
  }

  const bestThumbnailVariant = chooseBest(byThumbnail);
  const bestMetadataVariant = chooseBest(byMetadata);

  const note = metrics.length === 0
    ? 'No metrics recorded yet. Publish a video and add 24h metrics to compare variants.'
    : `Recorded ${metrics.length} metric snapshot${metrics.length === 1 ? '' : 's'} and ${outcomes.length} outcome${outcomes.length === 1 ? '' : 's'}.`;

  const recommendation: FeedbackRecommendation = { note };
  if (bestThumbnailVariant) recommendation.bestThumbnailVariant = bestThumbnailVariant;
  if (bestMetadataVariant) recommendation.bestMetadataVariant = bestMetadataVariant;

  return {
    ok: true,
    projectId,
    outcomes,
    metrics,
    recommendation,
  };
}

function chooseBest(map: Map<string, { ctr: number; views: number; count: number }>): string | undefined {
  let bestKey: string | undefined;
  let bestScore = -Infinity;
  for (const [key, value] of map.entries()) {
    const score = value.count > 0 ? value.ctr / value.count : 0;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}
