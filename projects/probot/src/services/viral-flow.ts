import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Types for Viral Flow data structures
export interface ViralFlowStatus {
  activeTopics: Topic[];
  recentScripts: Script[];
  batchStatus: BatchStatus | null;
  accountCount: number;
  performanceMetrics: PerformanceSnapshot;
  lastUpdated: string;
}

export interface Topic {
  id: string;
  title: string;
  keywords: string[];
  trend_score: number;
  created_at: string;
  source: string;
}

export interface Script {
  id: string;
  topic_id: string;
  title: string;
  format: "longform" | "shortform" | "linkedin";
  estimated_duration: number;
  created_at: string;
}

export interface BatchStatus {
  batch_id: string;
  topic: string;
  stage: "discover" | "script" | "voice" | "compose" | "design" | "post";
  progress: {
    discover: StageProgress;
    script: StageProgress;
    voice: StageProgress;
    compose: StageProgress;
    design: StageProgress;
    post: StageProgress;
  };
  errors: string[];
}

export interface StageProgress {
  completed: boolean | number;
  total?: number;
  in_progress: boolean;
  timestamp?: string;
}

export interface BrainInsights {
  preferences: {
    prefers_longform: boolean | null;
    prefers_shortform: boolean | null;
    best_engagement_time: string | null;
    best_engagement_platform: string | null;
  };
  patterns: Record<string, unknown>;
  recommendations: string[];
}

export interface Account {
  id: string;
  platform: "youtube" | "tiktok" | "instagram" | "linkedin" | "facebook";
  name: string;
  status: "active" | "inactive" | "error";
  last_post: string | null;
}

export interface SeriesGroup {
  id: string;
  name: string;
  accounts: string[];
  created_at: string;
}

export interface PerformanceSnapshot {
  total_videos: number;
  total_views: number;
  avg_engagement_rate: number;
  top_videos: VideoPerformance[];
  platform_breakdown: Record<string, PlatformStats>;
  top_hooks: HookStats[];
}

export interface VideoPerformance {
  id: string;
  title: string;
  platform: string;
  views: number;
  engagement_rate: number;
  created_at: string;
}

export interface PlatformStats {
  videos: number;
  total_views: number;
  avg_engagement: number;
}

export interface HookStats {
  hook: string;
  count: number;
  avg_engagement: number;
}

// File paths
function getViralFlowDir(): string {
  return path.join(os.homedir(), ".config", "viralflow");
}

function getBrainPath(): string {
  return path.join(getViralFlowDir(), "brain.json");
}

function getAccountsPath(): string {
  return path.join(getViralFlowDir(), "accounts.json");
}

function getCheckpointPath(): string {
  return path.join(process.cwd(), ".pipeline-checkpoint.json");
}

// Readers
function readBrain(): Record<string, unknown> {
  try {
    const brainPath = getBrainPath();
    if (!fs.existsSync(brainPath)) {
      return {
        learned_insights: {},
        topics_discovered: [],
        scripts_generated: [],
        performance_metrics: [],
      };
    }
    const content = fs.readFileSync(brainPath, "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {
      learned_insights: {},
      topics_discovered: [],
      scripts_generated: [],
      performance_metrics: [],
    };
  }
}

function readAccounts(): {
  accounts: Account[];
  series: SeriesGroup[];
} {
  try {
    const accountsPath = getAccountsPath();
    if (!fs.existsSync(accountsPath)) {
      return { accounts: [], series: [] };
    }
    const content = fs.readFileSync(accountsPath, "utf8");
    return JSON.parse(content) as { accounts: Account[]; series: SeriesGroup[] };
  } catch {
    return { accounts: [], series: [] };
  }
}

function readCheckpoint(): BatchStatus | null {
  try {
    const checkpointPath = getCheckpointPath();
    if (!fs.existsSync(checkpointPath)) {
      return null;
    }
    const content = fs.readFileSync(checkpointPath, "utf8");
    const checkpoint = JSON.parse(content) as {
      batch_id: string;
      topic: string;
      stage: string;
      progress: Record<string, StageProgress>;
      errors?: string[];
    };
    return {
      batch_id: checkpoint.batch_id,
      topic: checkpoint.topic,
      stage: checkpoint.stage as BatchStatus["stage"],
      progress: checkpoint.progress as BatchStatus["progress"],
      errors: checkpoint.errors ?? [],
    };
  } catch {
    return null;
  }
}

// Extractors
function extractRecentTopics(brain: Record<string, unknown>): Topic[] {
  const topics = (brain.topics_discovered as unknown[] | undefined) ?? [];
  return (
    Array.isArray(topics)
      ? topics
          .slice(-10)
          .reverse()
          .map((t) => {
            const topic = t as Record<string, unknown>;
            return {
              id: (topic.id as string) ?? `topic-${Date.now()}`,
              title: (topic.title as string) ?? (topic.topic as string) ?? "Untitled",
              keywords: (topic.keywords as string[]) ?? [],
              trend_score: (topic.trend_score as number) ?? (topic.score as number) ?? 0,
              created_at: (topic.created_at as string) ?? (topic.timestamp as string) ?? new Date().toISOString(),
              source: (topic.source as string) ?? "unknown",
            };
          })
      : []
  ).filter((t) => t.title);
}

function extractRecentScripts(brain: Record<string, unknown>): Script[] {
  const scripts = (brain.scripts_generated as unknown[] | undefined) ?? [];
  return (
    Array.isArray(scripts)
      ? scripts
          .slice(-10)
          .reverse()
          .map((s) => {
            const script = s as Record<string, unknown>;
            return {
              id: (script.id as string) ?? `script-${Date.now()}`,
              topic_id: (script.topic_id as string) ?? "",
              title: (script.title as string) ?? "Untitled Script",
              format: (script.format as "longform" | "shortform" | "linkedin") ?? "longform",
              estimated_duration: (script.estimated_duration as number) ?? 0,
              created_at: (script.created_at as string) ?? (script.timestamp as string) ?? new Date().toISOString(),
            };
          })
      : []
  ).filter((s) => s.topic_id);
}

function extractBrainInsights(brain: Record<string, unknown>): BrainInsights {
  const insights = (brain.learned_insights as Record<string, unknown>) ?? {};
  const audience = (insights.audience as Record<string, unknown>) ?? {};

  return {
    preferences: {
      prefers_longform: (audience.prefers_longform as boolean | null) ?? null,
      prefers_shortform: (audience.prefers_shortform as boolean | null) ?? null,
      best_engagement_time: (audience.best_engagement_time as string | null) ?? null,
      best_engagement_platform: (audience.best_engagement_platform as string | null) ?? null,
    },
    patterns: (insights.format_performance as Record<string, unknown>) ?? {},
    recommendations: [
      (audience.best_engagement_platform as string) ? `Post on ${audience.best_engagement_platform}` : null,
      (audience.prefers_shortform as boolean) ? "Focus on shortform content" : null,
      (audience.best_engagement_time as string) ? `Best engagement: ${audience.best_engagement_time}` : null,
    ].filter((r) => r !== null) as string[],
  };
}

function extractPerformanceMetrics(brain: Record<string, unknown>): PerformanceSnapshot {
  const metrics = (brain.performance_metrics as unknown[] | undefined) ?? [];
  const metricsArray = Array.isArray(metrics) ? metrics : [];

  const validMetrics = metricsArray
    .map((m) => {
      const metric = m as Record<string, unknown>;
      return {
        id: (metric.video_id as string) ?? (metric.id as string) ?? "",
        title: (metric.title as string) ?? "Video",
        platform: (metric.platform as string) ?? "unknown",
        views: (metric.views as number) ?? 0,
        engagement_rate: (metric.engagement_rate as number) ?? 0,
        created_at: (metric.timestamp as string) ?? (metric.created_at as string) ?? new Date().toISOString(),
      };
    })
    .filter((m) => m.id && m.views > 0);

  const platformStats: Record<string, PlatformStats> = {};
  const hookMap: Map<string, { count: number; engagement: number[] }> = new Map();

  for (const metric of validMetrics) {
    if (!platformStats[metric.platform]) {
      platformStats[metric.platform] = {
        videos: 0,
        total_views: 0,
        avg_engagement: 0,
      };
    }
    platformStats[metric.platform]!.videos += 1;
    platformStats[metric.platform]!.total_views += metric.views;
    platformStats[metric.platform]!.avg_engagement =
      (platformStats[metric.platform]!.avg_engagement * (platformStats[metric.platform]!.videos - 1) +
        metric.engagement_rate) /
      platformStats[metric.platform]!.videos;
  }

  // Extract top hooks (from metrics with hook info if available)
  const topHooks: HookStats[] = [];
  if (hookMap.size > 0) {
    for (const [hook, data] of hookMap) {
      const avgEng = data.engagement.reduce((a, b) => a + b, 0) / data.engagement.length;
      topHooks.push({
        hook,
        count: data.count,
        avg_engagement: avgEng,
      });
    }
    topHooks.sort((a, b) => b.avg_engagement - a.avg_engagement);
  }

  return {
    total_videos: validMetrics.length,
    total_views: validMetrics.reduce((sum, m) => sum + m.views, 0),
    avg_engagement_rate: validMetrics.length > 0 ? validMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / validMetrics.length : 0,
    top_videos: validMetrics.slice(0, 10).sort((a, b) => b.views - a.views),
    platform_breakdown: platformStats,
    top_hooks: topHooks,
  };
}

// Main API functions
export async function getViralFlowStatus(): Promise<ViralFlowStatus> {
  const brain = readBrain();
  const { accounts } = readAccounts();
  const checkpoint = readCheckpoint();

  const topics = extractRecentTopics(brain);
  const scripts = extractRecentScripts(brain);
  const metrics = extractPerformanceMetrics(brain);

  return {
    activeTopics: topics,
    recentScripts: scripts,
    batchStatus: checkpoint,
    accountCount: accounts.length,
    performanceMetrics: metrics,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getTopics(): Promise<{ recent: Topic[]; trending: Topic[] }> {
  const brain = readBrain();
  const topics = extractRecentTopics(brain);

  // Separate trending (high score) from recent
  const trending = topics.filter((t) => t.trend_score > 70).slice(0, 5);
  const recent = topics.slice(0, 10);

  return { recent, trending };
}

export async function getBrainInsights(): Promise<BrainInsights> {
  const brain = readBrain();
  return extractBrainInsights(brain);
}

export async function getAccounts(): Promise<{ accounts: Account[]; series: SeriesGroup[] }> {
  return readAccounts();
}

export async function addAccount(account: Omit<Account, "last_post">): Promise<{ success: boolean; error?: string }> {
  try {
    const { accounts, series } = readAccounts();
    const newAccount: Account = {
      ...account,
      last_post: null,
    };
    accounts.push(newAccount);

    const accountsPath = getAccountsPath();
    fs.mkdirSync(path.dirname(accountsPath), { recursive: true });
    fs.writeFileSync(accountsPath, JSON.stringify({ accounts, series }, null, 2));

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getPerformanceMetrics(): Promise<PerformanceSnapshot> {
  const brain = readBrain();
  return extractPerformanceMetrics(brain);
}

export async function getBatchStatus(): Promise<{
  running: boolean;
  stage: string | null;
  completed: number;
  checkpoint: BatchStatus | null;
  errors: string[];
}> {
  const checkpoint = readCheckpoint();

  if (!checkpoint) {
    return {
      running: false,
      stage: null,
      completed: 0,
      checkpoint: null,
      errors: [],
    };
  }

  const completedStages = Object.values(checkpoint.progress).filter((p) => p.completed === true).length;

  return {
    running: !checkpoint.progress.post.completed,
    stage: checkpoint.stage,
    completed: completedStages,
    checkpoint,
    errors: checkpoint.errors,
  };
}
