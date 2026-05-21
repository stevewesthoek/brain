import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getInfraVideoOrchestratorStatus } from './infra-video-orchestrator-status.js';

// ── Viral Flow types ──────────────────────────────────────────────────────────

export interface InfraStudioTopic {
  id: string;
  title: string;
  trendScore: number;
  source: string;
  createdAt: string;
}

export interface InfraStudioScript {
  id: string;
  title: string;
  format: string;
  estimatedDurationMinutes: number;
  createdAt: string;
}

export interface InfraStudioBatchStage {
  completed: boolean;
  inProgress: boolean;
}

export interface InfraStudioBatch {
  batchId: string;
  topic: string;
  stage: string;
  stages: Record<string, InfraStudioBatchStage>;
  errors: string[];
}

export interface InfraStudioAccount {
  id: string;
  platform: string;
  name: string;
  status: string;
  lastPost: string | null;
}

export interface InfraStudioPerformance {
  totalVideos: number;
  totalViews: number;
  avgEngagementRate: number;
  topVideos: Array<{ title: string; views: number; platform: string }>;
}

export interface InfraViralFlowSummary {
  accountCount: number;
  accounts: InfraStudioAccount[];
  activeTopicCount: number;
  recentTopics: InfraStudioTopic[];
  recentScripts: InfraStudioScript[];
  activeBatch: InfraStudioBatch | null;
  performance: InfraStudioPerformance;
  lastUpdated: string;
}

// ── Video Orchestrator types ──────────────────────────────────────────────────

export interface InfraVideoOrchestratorSummary {
  databaseStatus: string;
  totalVideos: number;
  totalAccounts: number;
  pendingJobs: number;
  runningJobs: number;
  failedJobs7d: number;
  completedPackages: number;
  completionRate: number;
  error?: string;
}

// ── Combined Studio status ────────────────────────────────────────────────────

export interface InfraStudioStatus {
  status: 'ok' | 'not-configured' | 'partial' | 'error';
  viralFlow: InfraViralFlowSummary | null;
  videoOrchestrator: InfraVideoOrchestratorSummary | null;
  error?: string;
}

// ── Viral Flow reader ─────────────────────────────────────────────────────────

function getViralFlowDir(): string {
  return path.join(os.homedir(), '.config', 'viralflow');
}

function readViralFlowBrain(): Record<string, unknown> {
  try {
    const p = path.join(getViralFlowDir(), 'brain.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readViralFlowAccounts(): { accounts: unknown[]; series: unknown[] } {
  try {
    const p = path.join(getViralFlowDir(), 'accounts.json');
    if (!fs.existsSync(p)) return { accounts: [], series: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8')) as { accounts: unknown[]; series: unknown[] };
  } catch {
    return { accounts: [], series: [] };
  }
}

function readViralFlowCheckpoint(): InfraStudioBatch | null {
  try {
    const checkpointPaths = [
      path.join(process.cwd(), '.pipeline-checkpoint.json'),
      path.join(getViralFlowDir(), '.pipeline-checkpoint.json'),
    ];
    for (const p of checkpointPaths) {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
      const progress = (raw.progress ?? {}) as Record<string, Record<string, unknown>>;
      const stages: Record<string, InfraStudioBatchStage> = {};
      for (const [k, v] of Object.entries(progress)) {
        stages[k] = {
          completed: Boolean(v.completed),
          inProgress: Boolean(v.in_progress),
        };
      }
      return {
        batchId: (raw.batch_id as string) ?? 'unknown',
        topic: (raw.topic as string) ?? 'unknown',
        stage: (raw.stage as string) ?? 'unknown',
        stages,
        errors: Array.isArray(raw.errors) ? (raw.errors as string[]) : [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

function buildViralFlowSummary(): InfraViralFlowSummary | null {
  const dir = getViralFlowDir();
  if (!fs.existsSync(dir)) return null;

  const brain = readViralFlowBrain();
  const { accounts: rawAccounts } = readViralFlowAccounts();
  const batch = readViralFlowCheckpoint();

  const accounts: InfraStudioAccount[] = (Array.isArray(rawAccounts) ? rawAccounts : []).map((a) => {
    const acc = a as Record<string, unknown>;
    return {
      id: (acc.id as string) ?? 'unknown',
      platform: (acc.platform as string) ?? 'unknown',
      name: (acc.name as string) ?? 'unknown',
      status: (acc.status as string) ?? 'unknown',
      lastPost: (acc.last_post as string | null) ?? null,
    };
  });

  const rawTopics = Array.isArray(brain.topics_discovered) ? brain.topics_discovered : [];
  const recentTopics: InfraStudioTopic[] = (rawTopics as Record<string, unknown>[])
    .slice(-10).reverse()
    .map((t) => ({
      id: (t.id as string) ?? `t-${Date.now()}`,
      title: ((t.title ?? t.topic) as string) ?? 'Untitled',
      trendScore: ((t.trend_score ?? t.score) as number) ?? 0,
      source: (t.source as string) ?? 'unknown',
      createdAt: ((t.created_at ?? t.timestamp) as string) ?? new Date().toISOString(),
    }))
    .filter((t) => t.title);

  const rawScripts = Array.isArray(brain.scripts_generated) ? brain.scripts_generated : [];
  const recentScripts: InfraStudioScript[] = (rawScripts as Record<string, unknown>[])
    .slice(-10).reverse()
    .map((s) => ({
      id: (s.id as string) ?? `s-${Date.now()}`,
      title: (s.title as string) ?? 'Untitled Script',
      format: (s.format as string) ?? 'unknown',
      estimatedDurationMinutes: (s.estimated_duration as number) ?? 0,
      createdAt: ((s.created_at ?? s.timestamp) as string) ?? new Date().toISOString(),
    }));

  const rawMetrics = (brain.performance_metrics as unknown[] | undefined) ?? [];
  const perfEntries = Array.isArray(rawMetrics) ? rawMetrics as Record<string, unknown>[] : [];
  const totalViews = perfEntries.reduce((s, m) => s + ((m.total_views as number) ?? 0), 0);
  const avgEngagement = perfEntries.length > 0
    ? perfEntries.reduce((s, m) => s + ((m.avg_engagement_rate as number) ?? 0), 0) / perfEntries.length
    : 0;

  const topVideos: Array<{ title: string; views: number; platform: string }> = perfEntries
    .flatMap((m) => Array.isArray(m.top_videos) ? m.top_videos as Record<string, unknown>[] : [])
    .map((v) => ({
      title: (v.title as string) ?? 'Unknown',
      views: (v.views as number) ?? 0,
      platform: (v.platform as string) ?? 'unknown',
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    accountCount: accounts.length,
    accounts,
    activeTopicCount: recentTopics.length,
    recentTopics,
    recentScripts,
    activeBatch: batch,
    performance: {
      totalVideos: perfEntries.reduce((s, m) => s + ((m.total_videos as number) ?? 0), 0),
      totalViews,
      avgEngagementRate: avgEngagement,
      topVideos,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// ── Video Orchestrator reader ─────────────────────────────────────────────────

async function buildVideoOrchestratorSummary(): Promise<InfraVideoOrchestratorSummary | null> {
  const status = await getInfraVideoOrchestratorStatus();
  if (!status.ok) return null;

  const total = Object.values(status.jobsByType ?? {}).reduce((s, n) => s + n, 0);

  return {
    databaseStatus: 'connected',
    totalVideos: total,
    totalAccounts: status.activeAccounts ?? 0,
    pendingJobs: status.queueDepth?.pending ?? 0,
    runningJobs: status.queueDepth?.running ?? 0,
    failedJobs7d: status.queueDepth?.failed ?? 0,
    completedPackages: status.recentPosts?.length ?? 0,
    completionRate: 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getInfraStudioStatus(): Promise<InfraStudioStatus> {
  try {
    const viralFlow = buildViralFlowSummary();
    const videoOrchestrator = await buildVideoOrchestratorSummary();

    if (!viralFlow && !videoOrchestrator) {
      return {
        status: 'not-configured',
        viralFlow: null,
        videoOrchestrator: null,
        error: 'Studio data not found. Viral Flow config expected at ~/.config/viralflow/. Video Orchestrator DB unreachable.',
      };
    }

    return {
      status: 'ok',
      viralFlow,
      videoOrchestrator,
    };
  } catch (err) {
    return {
      status: 'error',
      viralFlow: null,
      videoOrchestrator: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
