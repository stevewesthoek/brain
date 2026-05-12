// Video Orchestrator job scheduler and store
// Manages scheduled video generation and publishing jobs locally using JSON-backed persistence
// Dry-run by default; no real YouTube publishing in VO-1

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import os from "node:os";

// ─── Runtime Storage ────────────────────────────────────────────────────────

function getRuntimeDir(): string {
  // Test override: PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR env var
  if (process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR) {
    const dir = process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
  // Default: ~/.local/probot/video-orchestrator
  const homeDir = os.homedir();
  const dir = path.join(homeDir, ".local", "probot", "video-orchestrator");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Logging ────────────────────────────────────────────────────────────────

function getSchedulerLogPath(): string {
  return path.join(getRuntimeDir(), "scheduler.log");
}

function logSchedulerEvent(event: string, details?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const logLine = details ? `[${timestamp}] ${event}: ${JSON.stringify(details)}` : `[${timestamp}] ${event}`;
    fs.appendFileSync(getSchedulerLogPath(), logLine + "\n");
  } catch (err) {
    console.warn("Failed to write scheduler log:", err);
  }
}

// ─── Quota Persistence ──────────────────────────────────────────────────────

function getQuotaStatePath(): string {
  return path.join(getRuntimeDir(), "quota.json");
}

interface QuotaState {
  total_used: number;
  reset_at: string;
}

function loadQuotaState(): QuotaState {
  try {
    const quotaFile = getQuotaStatePath();
    if (fs.existsSync(quotaFile)) {
      const data = JSON.parse(fs.readFileSync(quotaFile, "utf8")) as QuotaState;
      const resetAt = new Date(data.reset_at);
      if (new Date() >= resetAt) {
        // Quota has expired; reset it
        return {
          total_used: 0,
          reset_at: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 0, 0, 0).toISOString(),
        };
      }
      return data;
    }
  } catch (err) {
    console.warn("Failed to load quota state:", err);
  }
  // Initialize new quota for today
  const now = new Date();
  return {
    total_used: 0,
    reset_at: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString(),
  };
}

function saveQuotaState(state: QuotaState): void {
  try {
    const quotaFile = getQuotaStatePath();
    fs.writeFileSync(quotaFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn("Failed to save quota state:", err);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobType = "generate_episode" | "publish_episode" | "schedule_month";

export type JobStatus = "scheduled" | "running" | "completed" | "failed" | "paused_quota" | "cancelled";

export interface ScheduledVideoJob {
  id: string;
  type: JobType;
  status: JobStatus;
  created_at: string;
  scheduled_for: string;
  attempted_at: string | null;
  completed_at: string | null;
  dry_run: boolean;
  error_message: string | null;
  result?: {
    simulated?: boolean;
    output?: unknown;
  };
}

export interface VideoJobsStore {
  schema_version: "1.0";
  created_at: string;
  jobs: ScheduledVideoJob[];
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quota_reset_at?: string;
}

// ─── Quota Guard ────────────────────────────────────────────────────────────

export interface QuotaGuard {
  checkAndRecord(jobType: JobType): QuotaCheckResult;
  reset(): void;
  getStatus(): { total_used: number; limit: number; reset_at: string };
}

// YouTube quota: 10,000 units/day per account (conservative estimate: ~1 unit per job)
// For VO-1, use a simple per-day counter with persistent state
class SimpleQuotaGuard implements QuotaGuard {
  private quota_limit: number = 10; // conservative for testing

  checkAndRecord(jobType: JobType): QuotaCheckResult {
    const state = loadQuotaState();
    if (new Date() >= new Date(state.reset_at)) {
      state.total_used = 0;
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      state.reset_at = next.toISOString();
      saveQuotaState(state);
    }

    if (state.total_used >= this.quota_limit) {
      return {
        allowed: false,
        reason: `Quota exhausted: ${state.total_used}/${this.quota_limit}`,
        quota_reset_at: state.reset_at,
      };
    }

    state.total_used++;
    saveQuotaState(state);
    return { allowed: true };
  }

  reset(): void {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    saveQuotaState({
      total_used: 0,
      reset_at: next.toISOString(),
    });
  }

  getStatus() {
    const state = loadQuotaState();
    return {
      total_used: state.total_used,
      limit: this.quota_limit,
      reset_at: state.reset_at,
    };
  }
}

let quotaGuard: QuotaGuard | null = null;

function getQuotaGuard(): QuotaGuard {
  if (!quotaGuard) {
    quotaGuard = new SimpleQuotaGuard();
  }
  return quotaGuard;
}

// ─── Storage ────────────────────────────────────────────────────────────────

function resolveRepoRoot(): string {
  const fileDir = path.dirname(fileURLToPath(import.meta.url));
  const botDir = fileDir;
  const srcDir = path.dirname(botDir);
  const probotDir = path.dirname(srcDir);
  const projectsDir = path.dirname(probotDir);
  const brainDir = path.dirname(projectsDir);
  return brainDir;
}

function getJobStorePaths() {
  const repoRoot = resolveRepoRoot();
  const runtimeDir = getRuntimeDir();
  const runtimePath = path.join(repoRoot, "runtime/local/video-orchestrator");

  return {
    primary: path.join(runtimeDir, "jobs.json"),
    fallback: path.join(runtimePath, "jobs.json"),
  };
}

function ensureJobStoreDir(): string {
  const paths = getJobStorePaths();
  const dir = path.dirname(paths.primary);
  fs.mkdirSync(dir, { recursive: true });
  return paths.primary;
}

function loadJobStore(): VideoJobsStore {
  const paths = getJobStorePaths();
  let storePath = paths.primary;

  if (!fs.existsSync(storePath) && fs.existsSync(paths.fallback)) {
    storePath = paths.fallback;
  }

  if (fs.existsSync(storePath)) {
    try {
      const content = fs.readFileSync(storePath, "utf8");
      return JSON.parse(content) as VideoJobsStore;
    } catch {
      // corrupt or invalid, start fresh
    }
  }

  return {
    schema_version: "1.0",
    created_at: new Date().toISOString(),
    jobs: [],
  };
}

function saveJobStore(store: VideoJobsStore): void {
  const storePath = ensureJobStoreDir();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

// ─── Job Operations ─────────────────────────────────────────────────────────

export function listVideoJobs(options?: { status?: JobStatus; before?: Date }): ScheduledVideoJob[] {
  const store = loadJobStore();
  let jobs = [...store.jobs];

  if (options?.status) {
    jobs = jobs.filter((j) => j.status === options.status);
  }

  if (options?.before) {
    jobs = jobs.filter((j) => new Date(j.scheduled_for) <= options.before!);
  }

  return jobs.sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
}

export function createVideoJob(input: { type: JobType; scheduledFor: Date; dryRun: boolean }): ScheduledVideoJob {
  const store = loadJobStore();
  const job: ScheduledVideoJob = {
    id: crypto.randomUUID(),
    type: input.type,
    status: "scheduled",
    created_at: new Date().toISOString(),
    scheduled_for: input.scheduledFor.toISOString(),
    attempted_at: null,
    completed_at: null,
    dry_run: input.dryRun,
    error_message: null,
  };

  store.jobs.push(job);
  saveJobStore(store);
  return job;
}

export function updateVideoJobStatus(
  jobId: string,
  status: JobStatus,
  result?: { simulated?: boolean; output?: unknown },
  errorMessage?: string
): void {
  const store = loadJobStore();
  const job = store.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  job.status = status;
  if (status === "running") {
    job.attempted_at = new Date().toISOString();
  }
  if (status === "completed" || status === "failed") {
    job.completed_at = new Date().toISOString();
  }
  if (result) {
    job.result = result;
  }
  if (errorMessage) {
    job.error_message = errorMessage;
  }

  saveJobStore(store);
}

export function cancelVideoJob(jobId: string): void {
  updateVideoJobStatus(jobId, "cancelled");
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

export function scheduleRestOfMonth(options: { dryRun: boolean; channelId?: string; episodeCount?: number }): {
  created: number;
  existing: number;
} {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const episodeCount = options.episodeCount ?? 3;
  const daysUntilEndOfMonth = daysInMonth - now.getDate();
  const intervalDays = Math.max(1, Math.floor(daysUntilEndOfMonth / episodeCount));

  let created = 0;
  let existing = 0;

  const store = loadJobStore();

  for (let i = 0; i < episodeCount && now.getDate() + i * intervalDays <= daysInMonth; i++) {
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + i * intervalDays);
    scheduledDate.setHours(9, 0, 0, 0); // 9 AM each day

    // Check for duplicate
    const existing_job = store.jobs.find(
      (j) =>
        j.type === "generate_episode" &&
        new Date(j.scheduled_for).toDateString() === scheduledDate.toDateString() &&
        j.status !== "cancelled"
    );

    if (existing_job) {
      existing++;
    } else {
      createVideoJob({
        type: "generate_episode",
        scheduledFor: scheduledDate,
        dryRun: options.dryRun,
      });
      created++;
    }
  }

  return { created, existing };
}

// ─── Job Execution ──────────────────────────────────────────────────────────

export interface RunDueJobsOptions {
  dryRun: boolean;
  maxJobs?: number;
  forDate?: Date;
}

export interface RunDueJobsResult {
  ran: number;
  quota_paused: number;
  failed: number;
}

export async function runDueVideoJobs(options: RunDueJobsOptions): Promise<RunDueJobsResult> {
  const now = options.forDate ?? new Date();

  // Include both scheduled and paused_quota jobs that are due
  const scheduled = listVideoJobs({ status: "scheduled", before: now });
  const pausedDue = listVideoJobs({ status: "paused_quota", before: now });
  const due = [...scheduled, ...pausedDue].sort((a, b) =>
    new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
  );

  const maxJobs = options.maxJobs ?? 5;
  const quota = getQuotaGuard();

  let ran = 0;
  let quota_paused = 0;
  let failed = 0;

  for (let i = 0; i < Math.min(due.length, maxJobs); i++) {
    const job = due[i];
    if (!job) continue;

    // Check if quota allows before running (only for dry-run to test quota logic)
    // Non-dry-run jobs are blocked anyway, so we don't consume quota for them
    if (options.dryRun) {
      const quotaCheck = quota.checkAndRecord(job.type);
      if (!quotaCheck.allowed) {
        updateVideoJobStatus(job.id, "paused_quota", undefined, `Quota exhausted: ${quotaCheck.reason}`);
        quota_paused++;
        logSchedulerEvent("Job quota paused", { job_id: job.id.slice(0, 8), reason: quotaCheck.reason });
        continue;
      }
    }

    try {
      // Transition to running
      updateVideoJobStatus(job.id, "running");

      if (options.dryRun) {
        // Dry-run: simulate execution
        const result = { simulated: true, output: `Dry-run: ${job.type} scheduled for ${job.scheduled_for}` };
        updateVideoJobStatus(job.id, "completed", result);
        logSchedulerEvent("Completed (dry-run)", { job_id: job.id.slice(0, 8), type: job.type });
        ran++;
      } else {
        // Non-dry-run: block execution until real adapters exist
        const blockReason = "Real execution is not implemented for VO-1. Run with --dry-run=true.";
        updateVideoJobStatus(job.id, "failed", {
          simulated: false,
          output: blockReason,
        }, blockReason);
        logSchedulerEvent("Job blocked (no real executor)", { job_id: job.id.slice(0, 8), type: job.type });
        failed++;
      }
    } catch (err) {
      const errorMsg = String(err);
      updateVideoJobStatus(job.id, "failed", {
        simulated: false,
        output: errorMsg,
      }, errorMsg);
      logSchedulerEvent("Job failed", { job_id: job.id.slice(0, 8), error: errorMsg });
      failed++;
    }
  }

  logSchedulerEvent("Run due completed", { ran, quota_paused, failed });
  return { ran, quota_paused, failed };
}

// ─── Dashboard Integration ──────────────────────────────────────────────────

export interface VideoJobsStatus {
  total_jobs: number;
  scheduled: number;
  running: number;
  completed: number;
  failed: number;
  paused_quota: number;
  cancelled: number;
  dry_run_mode: boolean;
  quota_status: { total_used: number; limit: number; reset_at: string };
}

export function getVideoJobsStatus(): VideoJobsStatus {
  const jobs = listVideoJobs();
  const quota = getQuotaGuard();

  return {
    total_jobs: jobs.length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    running: jobs.filter((j) => j.status === "running").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    paused_quota: jobs.filter((j) => j.status === "paused_quota").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
    dry_run_mode: jobs.length > 0 ? jobs.every((j) => j.dry_run) : false,
    quota_status: quota.getStatus(),
  };
}

export function resetQuota(): void {
  getQuotaGuard().reset();
  logSchedulerEvent("Quota reset");
}

// ─── Project Distribution (VO-2A Foundation) ────────────────────────────────

export interface ProjectDistribution {
  project_id: string;
  project_name: string;
  theme?: string;
  enabled: boolean;
  platform_accounts: Record<
    string,
    {
      account_id: string;
      posts_per_week?: number;
      preferred_days?: string[];
      preferred_time_local?: string;
      timezone?: string;
      enabled?: boolean;
    }
  >;
  scheduler_policy: {
    dry_run_default: boolean;
    max_jobs_per_run?: number;
  };
}

export interface PlatformSlot {
  platform: string;
  account_id: string;
  posts_per_week: number;
  preferred_days?: string[] | undefined;
  preferred_time_local?: string | undefined;
  timezone?: string | undefined;
}

export interface ProjectPlanResult {
  project_id: string;
  planned_platforms: number;
  planned_weekly_slots: number;
  platform_slots: PlatformSlot[];
  dry_run_confirmed: boolean;
  next_run_window: string;
}

export function planProjectDistribution(projects: ProjectDistribution[]): ProjectPlanResult[] {
  const results: ProjectPlanResult[] = [];

  for (const project of projects) {
    if (!project.enabled) continue;

    const platformSlots: PlatformSlot[] = [];
    let totalWeeklySlots = 0;

    for (const [platform, config] of Object.entries(project.platform_accounts)) {
      if (config.enabled === false) continue;

      const postsPerWeek = config.posts_per_week ?? 0;
      totalWeeklySlots += postsPerWeek;

      platformSlots.push({
        platform,
        account_id: config.account_id,
        posts_per_week: postsPerWeek,
        preferred_days: config.preferred_days,
        preferred_time_local: config.preferred_time_local,
        timezone: config.timezone,
      });
    }

    results.push({
      project_id: project.project_id,
      planned_platforms: platformSlots.length,
      planned_weekly_slots: totalWeeklySlots,
      platform_slots: platformSlots,
      dry_run_confirmed: project.scheduler_policy.dry_run_default,
      next_run_window: new Date().toISOString(),
    });

    logSchedulerEvent("Project plan generated", {
      project_id: project.project_id,
      platforms: platformSlots.length,
      weekly_slots: totalWeeklySlots,
      dry_run: project.scheduler_policy.dry_run_default,
    });
  }

  return results;
}

// ─── VO-2B: Project Distribution Dry-Run Scheduling ───────────────────────────

export interface ScheduleProjectDistributionInput {
  projects: ProjectDistribution[];
  dryRun: boolean;
  startDate?: Date;
  weeks?: number;
}

export interface ScheduleProjectDistributionResult {
  created: number;
  existing: number;
  skipped: number;
  planned: ProjectPlanResult[];
}

export function scheduleProjectDistributionPlan(input: ScheduleProjectDistributionInput): ScheduleProjectDistributionResult {
  if (!input.dryRun) {
    throw new Error("VO-2B only supports dry-run project distribution scheduling. Set dryRun to true.");
  }

  const plans = planProjectDistribution(input.projects);
  const startDate = input.startDate ?? new Date();
  const weeks = input.weeks ?? 1;

  let created = 0;
  let existing = 0;
  let skipped = 0;

  for (const plan of plans) {
    if (plan.planned_weekly_slots === 0) {
      skipped++;
      logSchedulerEvent("Project distribution skipped (no weekly slots)", {
        project_id: plan.project_id,
      });
      continue;
    }

    for (const slot of plan.platform_slots) {
      if (slot.posts_per_week === 0) continue;

      const daysInWeek = 7;
      const preferredDays = slot.preferred_days && slot.preferred_days.length > 0
        ? slot.preferred_days
        : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

      const dayToIndex = (day: string): number => {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        return days.indexOf(day.toLowerCase());
      };

      const postsPerWeek = slot.posts_per_week;
      let scheduledCount = 0;

      for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
        for (let postIndex = 0; postIndex < postsPerWeek; postIndex++) {
          // Distribute posts across preferred days
          const dayIndex = preferredDays[postIndex % preferredDays.length] ?? "monday";
          const dayOfWeekIndex = dayToIndex(dayIndex);

          const scheduledDate = new Date(startDate);
          scheduledDate.setDate(scheduledDate.getDate() + weekOffset * 7);

          // Find the next occurrence of the preferred day
          const currentDayOfWeek = scheduledDate.getDay();
          let daysUntilTarget = dayOfWeekIndex - currentDayOfWeek;
          if (daysUntilTarget < 0) {
            daysUntilTarget += 7;
          }
          if (daysUntilTarget === 0 && weekOffset > 0) {
            daysUntilTarget = 7;
          }

          scheduledDate.setDate(scheduledDate.getDate() + daysUntilTarget);

          // Apply preferred time if provided
          if (slot.preferred_time_local) {
            const timeParts = slot.preferred_time_local.split(":").map(Number);
            const hours = timeParts[0] ?? 0;
            const minutes = timeParts[1] ?? 0;
            scheduledDate.setHours(hours, minutes, 0, 0);
          }

          // Check for duplicate job
          const existingJob = listVideoJobs().find(
            (j) =>
              j.type === "publish_episode" &&
              j.scheduled_for === scheduledDate.toISOString() &&
              j.dry_run &&
              (j.result?.output as Record<string, unknown>)?.project_id === plan.project_id &&
              (j.result?.output as Record<string, unknown>)?.platform === slot.platform &&
              (j.result?.output as Record<string, unknown>)?.account_id === slot.account_id
          );

          if (existingJob) {
            existing++;
          } else {
            const job = createVideoJob({
              type: "publish_episode",
              scheduledFor: scheduledDate,
              dryRun: true,
            });

            // Attach safe project/platform metadata
            const store = loadJobStore();
            const jobToUpdate = store.jobs.find((j) => j.id === job.id);
            if (jobToUpdate) {
              jobToUpdate.result = {
                simulated: true,
                output: {
                  project_id: plan.project_id,
                  platform: slot.platform,
                  account_id: slot.account_id,
                  cadence_source: "project_distribution",
                  weekly_slots: plan.planned_weekly_slots,
                },
              };
              saveJobStore(store);
            }

            created++;
            scheduledCount++;
          }
        }
      }

      logSchedulerEvent("Project distribution jobs scheduled", {
        project_id: plan.project_id,
        platform: slot.platform,
        account_id: slot.account_id,
        posts_per_week: slot.posts_per_week,
        weeks,
        created: scheduledCount,
      });
    }
  }

  logSchedulerEvent("Project distribution scheduling complete", {
    total_planned: plans.length,
    created,
    existing,
    skipped,
  });

  return {
    created,
    existing,
    skipped,
    planned: plans,
  };
}

// Production package draft interfaces and functions (VO-2C)

export interface ProductionPackageDraft {
  package_id: string;
  video_id?: string;
  project_id: string;
  platform: string;
  account_id: string;
  source_job_id: string;
  package_state: "draft" | "ready" | "blocked" | "exported";
  dry_run: boolean;
  created_at: string;
  scheduled_for: string;
  assets: {
    video?: string;
    thumbnail?: string;
    captions: string[];
    metadata: Record<string, unknown>;
  };
  platform_target: {
    format_key: string;
    aspect_ratio: string;
    resolution: string;
    safe_zone_profile?: string;
  };
  readiness: {
    ready_to_post: boolean;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: string;
    source_manifest_path?: string;
    checksum?: string;
  };
}

export interface CreateProductionPackageDraftInput {
  job: ScheduledVideoJob;
  project_id: string;
  platform: string;
  account_id: string;
  scheduled_for: Date;
  dryRun: boolean;
  format_key?: string;
}

function sanitizeJobResultForPackageMetadata(result: unknown): Record<string, unknown> {
  // Allowlist-based sanitization: never copy sensitive fields or structures
  const forbiddenPatterns = [
    "credential_reference",
    "credentialreference",
    "credential",
    "keychain",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
    "bearer",
  ];

  const sanitized: Record<string, unknown> = {};

  // Only copy safe scalar values from result if it's an object
  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      // Reject keys with forbidden patterns (case-insensitive)
      const keyLower = key.toLowerCase();
      if (forbiddenPatterns.some((p) => keyLower.includes(p))) {
        continue;
      }

      // Only copy scalars to prevent arbitrary nested data
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        // If value is a string, also check for forbidden content (case-insensitive)
        if (typeof value === "string") {
          const valueLower = value.toLowerCase();
          if (forbiddenPatterns.some((p) => valueLower.includes(p))) {
            continue;
          }
        }
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

export function createProductionPackageDraft(input: CreateProductionPackageDraftInput): ProductionPackageDraft {
  // VO-2C only supports dry-run package drafts
  if (!input.dryRun) {
    throw new Error("VO-2C only supports dry-run production packages. Set dryRun to true.");
  }

  const packageId = `pkg-${input.job.id}`;
  const now = new Date().toISOString();
  const formatKey = input.format_key ?? "landscape_1920x1080_16x9";
  const aspectRatio = formatKey.includes("1920x1080") || formatKey.includes("16x9") ? "16:9"
    : formatKey.includes("1080x1920") || formatKey.includes("9x16") ? "9:16"
    : formatKey.includes("1080x1080") || formatKey.includes("1x1") ? "1:1"
    : "16:9";
  const resolution = formatKey.includes("1920x1080") ? "1920x1080"
    : formatKey.includes("1080x1920") ? "1080x1920"
    : formatKey.includes("1080x1080") ? "1080x1080"
    : "1920x1080";

  const blockingReasons = [
    "Media rendering is not implemented in VO-2C. Real video/thumbnail/caption rendering deferred to VO-2D.",
  ];

  const warnings = [
    "This is a metadata-only package draft. No actual media files have been rendered.",
    "Use for schema validation and planning only.",
  ];

  logSchedulerEvent("Production package draft created", {
    package_id: packageId,
    project_id: input.project_id,
    platform: input.platform,
    account_id: input.account_id,
    dry_run: input.dryRun,
  });

  return {
    package_id: packageId,
    project_id: input.project_id,
    platform: input.platform,
    account_id: input.account_id,
    source_job_id: input.job.id,
    package_state: "draft",
    dry_run: input.dryRun,
    created_at: now,
    scheduled_for: input.scheduled_for.toISOString(),
    assets: {
      captions: [],
      metadata: {
        job_type: input.job.type,
        job_status: input.job.status,
        job_dry_run: input.job.dry_run,
        job_scheduled_for: input.job.scheduled_for,
        // Sanitized job result (safe scalars only, no credentials)
        ...sanitizeJobResultForPackageMetadata(input.job.result),
      },
    },
    platform_target: {
      format_key: formatKey,
      aspect_ratio: aspectRatio,
      resolution,
      safe_zone_profile: aspectRatio === "9:16" ? "mobile_vertical" : "desktop_landscape",
    },
    readiness: {
      ready_to_post: false,
      blocking_reasons: blockingReasons,
      warnings,
    },
    provenance: {
      generated_by: "VO-2C createProductionPackageDraft",
    },
  };
}

// ─── VO-2D: Package Draft Store and Validation ──────────────────────────────

function getPackageDraftsPath(): string {
  return path.join(getRuntimeDir(), "package-drafts.json");
}

interface ProductionPackageDraftStore {
  schema_version: "1.0";
  created_at: string;
  drafts: ProductionPackageDraft[];
}

function loadPackageDrafts(): ProductionPackageDraftStore {
  try {
    const storePath = getPackageDraftsPath();
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, "utf8")) as ProductionPackageDraftStore;
      return data;
    }
  } catch (err) {
    console.warn("Failed to load package drafts:", err);
  }
  return {
    schema_version: "1.0",
    created_at: new Date().toISOString(),
    drafts: [],
  };
}

function savePackageDrafts(store: ProductionPackageDraftStore): void {
  try {
    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  } catch (err) {
    console.warn("Failed to save package drafts:", err);
  }
}

function assertProductionPackageDraftSafeForStorage(draft: ProductionPackageDraft): void {
  const forbiddenPatterns = [
    "credential_reference",
    "credentialreference",
    "keychain",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
    "bearer",
    "private_key",
    "password",
    "token",
  ];

  // Recursively inspect all keys and string values
  function checkValue(val: unknown): void {
    if (typeof val === "string") {
      const valLower = val.toLowerCase();
      for (const pattern of forbiddenPatterns) {
        if (valLower.includes(pattern)) {
          throw new Error("Package draft contains unsafe metadata and was not stored.");
        }
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        for (const pattern of forbiddenPatterns) {
          if (keyLower.includes(pattern)) {
            throw new Error("Package draft contains unsafe metadata and was not stored.");
          }
        }
        checkValue(value);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        checkValue(item);
      }
    }
  }

  checkValue(draft);
}

// ─── VO-2E: Read-Path Output Safety ────────────────────────────────────────
// Sanitize legacy/manual package-drafts.json data on read to prevent unsafe value exposure

function sanitizePackageDraftSummaryString(value: unknown, fallback: string): string {
  const forbiddenPatterns = [
    "credential_reference",
    "credentialreference",
    "keychain://",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
    "bearer ",
    "private_key",
    "password",
    "token",
  ];

  // Only convert safe scalar types to string
  if (typeof value === "string") {
    const valLower = value.toLowerCase();
    const isSuspiciouslyLong = value.length > 200;
    for (const pattern of forbiddenPatterns) {
      if (valLower.includes(pattern.toLowerCase())) {
        return fallback;
      }
    }
    if (isSuspiciouslyLong) {
      return fallback;
    }
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  // Reject objects, arrays, null, undefined
  return fallback;
}

function buildProductionPackageDraftSummary(draft: ProductionPackageDraft): {
  package_id: string;
  project_id: string;
  platform: string;
  package_state: string;
  ready_to_post: boolean;
  blocking_reasons_count: number;
  warnings_count: number;
  scheduled_for: string;
} {
  // Validate to get safe ready_to_post and counts
  const validation = validateProductionPackageDraft(draft);

  return {
    package_id: sanitizePackageDraftSummaryString(draft.package_id, "[unsafe-package-id]"),
    project_id: sanitizePackageDraftSummaryString(draft.project_id, "[unsafe-project]"),
    platform: sanitizePackageDraftSummaryString(draft.platform, "[unsafe-platform]"),
    package_state: sanitizePackageDraftSummaryString(draft.package_state, "blocked"),
    ready_to_post: validation.ready_to_post,
    blocking_reasons_count: validation.blocking_reasons.length,
    warnings_count: validation.warnings.length,
    scheduled_for: sanitizePackageDraftSummaryString(draft.scheduled_for, "[unsafe-scheduled-for]"),
  };
}

export function saveProductionPackageDraft(draft: ProductionPackageDraft): void {
  // VO-2D CRITICAL: Reject any draft marked as ready_to_post=true
  // VO-2D performs metadata-only validation without real media inspection
  if (draft.readiness.ready_to_post === true) {
    throw new Error("VO-2D package drafts cannot be stored as ready_to_post. Real media validation is deferred to VO-2E.");
  }

  // Validate draft is safe for storage before persisting
  assertProductionPackageDraftSafeForStorage(draft);

  const store = loadPackageDrafts();
  const existing = store.drafts.findIndex((d) => d.package_id === draft.package_id);
  if (existing >= 0) {
    store.drafts[existing] = draft;
  } else {
    store.drafts.push(draft);
  }
  // Sort by scheduled_for then created_at
  store.drafts.sort((a, b) => {
    const aTime = new Date(a.scheduled_for).getTime();
    const bTime = new Date(b.scheduled_for).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  savePackageDrafts(store);
}

export function listProductionPackageDrafts(options?: {
  project_id?: string;
  platform?: string;
  package_state?: string;
}): ProductionPackageDraft[] {
  const store = loadPackageDrafts();
  return store.drafts.filter((d) => {
    if (options?.project_id && d.project_id !== options.project_id) return false;
    if (options?.platform && d.platform !== options.platform) return false;
    if (options?.package_state && d.package_state !== options.package_state) return false;
    return true;
  });
}

export function getProductionPackageDraft(package_id: string): ProductionPackageDraft | null {
  const store = loadPackageDrafts();
  return store.drafts.find((d) => d.package_id === package_id) || null;
}

export function updateProductionPackageDraftReadiness(
  package_id: string,
  readiness: { ready_to_post: boolean; blocking_reasons: string[]; warnings: string[] }
): void {
  const store = loadPackageDrafts();
  const draft = store.drafts.find((d) => d.package_id === package_id);
  if (!draft) {
    throw new Error(`Package draft not found: ${package_id}`);
  }

  // VO-2D: Enforce ready_to_post false (never allow upload-ready state)
  const vo2dWarning = "VO-2D does not perform real media validation; ready_to_post remains false.";
  const warningsSet = new Set(readiness.warnings);
  warningsSet.add(vo2dWarning);

  const sanitizedReadiness = {
    ready_to_post: false,
    blocking_reasons: readiness.blocking_reasons,
    warnings: Array.from(warningsSet),
  };

  // Create updated draft with sanitized readiness
  const updatedDraft = { ...draft, readiness: sanitizedReadiness };

  // Validate entire updated draft is safe for storage (catches unsafe readiness text)
  assertProductionPackageDraftSafeForStorage(updatedDraft);

  // Apply update to store
  const draftIndex = store.drafts.findIndex((d) => d.package_id === package_id);
  if (draftIndex >= 0) {
    store.drafts[draftIndex] = updatedDraft;
  }
  savePackageDrafts(store);
}

export interface PackageValidationResult {
  ok: boolean;
  ready_to_post: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export function validateProductionPackageDraft(draft: ProductionPackageDraft): PackageValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // Check package state is valid
  if (!["draft", "ready", "blocked", "exported"].includes(draft.package_state)) {
    blockingReasons.push(`Invalid package_state: ${draft.package_state}`);
  }

  // Check platform_target has required fields
  if (!draft.platform_target?.format_key || !draft.platform_target?.aspect_ratio || !draft.platform_target?.resolution) {
    blockingReasons.push("platform_target missing required fields (format_key, aspect_ratio, resolution)");
  }

  // Check for missing video asset
  if (!draft.assets?.video) {
    blockingReasons.push("Video asset is missing.");
  }

  // Warn for missing thumbnail (conservative: warn instead of block)
  if (!draft.assets?.thumbnail) {
    warnings.push("No thumbnail asset attached.");
  }

  // Warn for missing captions
  if (!draft.assets?.captions || draft.assets.captions.length === 0) {
    warnings.push("No caption assets attached.");
  }

  // VO-2D CRITICAL: Always return ready_to_post=false
  // VO-2D performs metadata-only validation without real media inspection
  // Real media validation (FFmpeg, file validation) is deferred to VO-2E
  // Packages must never be marked upload-ready in VO-2D
  warnings.push("VO-2D does not perform real media validation; ready_to_post remains false until VO-2E validation.");

  return {
    ok: blockingReasons.length === 0,
    ready_to_post: false,
    blocking_reasons: blockingReasons.length > 0 ? blockingReasons : draft.readiness.blocking_reasons,
    warnings: warnings.length > 0 ? warnings : draft.readiness.warnings,
  };
}

export interface CreatePackageDraftsForScheduledJobsInput {
  dryRun: true;
  status?: "scheduled" | "completed";
  limit?: number;
}

export interface CreatePackageDraftsForScheduledJobsResult {
  created: number;
  existing: number;
  skipped: number;
  drafts: ProductionPackageDraft[];
}

export function createPackageDraftsForScheduledJobs(
  input: CreatePackageDraftsForScheduledJobsInput
): CreatePackageDraftsForScheduledJobsResult {
  if (!input.dryRun) {
    throw new Error("createPackageDraftsForScheduledJobs only supports dryRun=true");
  }

  // Get all jobs with specified status
  const allJobs = listVideoJobs({
    status: (input.status ?? "scheduled") as JobStatus,
  });

  // Filter to publish_episode jobs and apply limit
  const jobs = allJobs.filter((j) => j.type === "publish_episode").slice(0, input.limit ?? 50);

  const existingDrafts = new Set(listProductionPackageDrafts().map((d) => d.package_id));
  const result: CreatePackageDraftsForScheduledJobsResult = {
    created: 0,
    existing: 0,
    skipped: 0,
    drafts: [],
  };

  for (const job of jobs) {
    // Extract metadata safely from job.result.output (set by scheduleProjectDistributionPlan)
    const jobOutput = (job.result?.output as Record<string, unknown>) || {};
    const project_id = jobOutput.project_id as string;
    const platform = jobOutput.platform as string;
    const account_id = jobOutput.account_id as string;

    if (!project_id || !platform || !account_id) {
      result.skipped++;
      continue;
    }

    const packageId = `pkg-${job.id}`;
    if (existingDrafts.has(packageId)) {
      result.existing++;
      continue;
    }

    // Create draft using VO-2C function
    const draft = createProductionPackageDraft({
      job,
      project_id,
      platform,
      account_id,
      scheduled_for: new Date(job.scheduled_for),
      dryRun: true,
    });

    // Save draft
    saveProductionPackageDraft(draft);
    result.created++;
    result.drafts.push(draft);
  }

  return result;
}

// ─── VO-2E: Local Adapter Contracts ────────────────────────────────────────

export type LocalAdapterKind = "render" | "caption" | "thumbnail" | "metadata" | "manual_export";

export type LocalAdapterMode = "not_implemented" | "dry_run" | "disabled";

export interface LocalAdapterPlan {
  adapter_id: string;
  kind: LocalAdapterKind;
  dry_run: true;
  planned_outputs: string[];
  blocking_reasons: string[];
  warnings: string[];
}

export interface LocalPackageAdapter {
  kind: LocalAdapterKind;
  adapter_id: string;
  mode: LocalAdapterMode;
  validateDraft(draft: ProductionPackageDraft): PackageValidationResult;
  plan?(draft: ProductionPackageDraft): LocalAdapterPlan;
}

class NotImplementedAdapter implements LocalPackageAdapter {
  kind: LocalAdapterKind;
  adapter_id: string;
  mode: LocalAdapterMode = "not_implemented";

  constructor(kind: LocalAdapterKind, adapter_id: string) {
    this.kind = kind;
    this.adapter_id = adapter_id;
  }

  validateDraft(draft: ProductionPackageDraft): PackageValidationResult {
    const blocking = [`${this.kind} adapter is not implemented in VO-2E. Deferred to VO-2F.`];
    return {
      ok: false,
      ready_to_post: false,
      blocking_reasons: blocking,
      warnings: [`${this.kind} adapter: ${this.adapter_id}`],
    };
  }

  plan(draft: ProductionPackageDraft): LocalAdapterPlan {
    return {
      adapter_id: this.adapter_id,
      kind: this.kind,
      dry_run: true,
      planned_outputs: [],
      blocking_reasons: [`${this.kind} adapter not implemented`],
      warnings: [`${this.kind} is planned for VO-2F implementation`],
    };
  }
}

export function getLocalPackageAdapterRegistry(): Record<LocalAdapterKind, LocalPackageAdapter> {
  return {
    render: new NotImplementedAdapter("render", "local-render-v1"),
    caption: new NotImplementedAdapter("caption", "local-caption-v1"),
    thumbnail: new NotImplementedAdapter("thumbnail", "local-thumbnail-v1"),
    metadata: new NotImplementedAdapter("metadata", "local-metadata-v1"),
    manual_export: new NotImplementedAdapter("manual_export", "local-manual-export-v1"),
  };
}

// ─── VO-2E: Readiness Reporting ────────────────────────────────────────────

export interface ProductionPackageReadinessReport {
  total: number;
  by_state: Record<string, number>;
  by_platform: Record<string, number>;
  ready_to_post: number;
  blocked: number;
  warnings: number;
  drafts: Array<{
    package_id: string;
    project_id: string;
    platform: string;
    package_state: string;
    ready_to_post: boolean;
    blocking_reasons_count: number;
    warnings_count: number;
    scheduled_for: string;
  }>;
}

export function getProductionPackageReadinessReport(options?: {
  project_id?: string;
  platform?: string;
}): ProductionPackageReadinessReport {
  const allDrafts = listProductionPackageDrafts(options);

  const by_state: Record<string, number> = {};
  const by_platform: Record<string, number> = {};
  let ready_to_post = 0;
  let blocked = 0;
  let warnings = 0;

  const drafts = allDrafts.map((draft) => {
    // Build safe summary first (sanitizes all fields)
    const summary = buildProductionPackageDraftSummary(draft);

    // Count by safe summary fields (not raw draft values)
    by_state[summary.package_state] = (by_state[summary.package_state] || 0) + 1;
    by_platform[summary.platform] = (by_platform[summary.platform] || 0) + 1;

    // Use safe values from summary for counting
    if (summary.ready_to_post) {
      ready_to_post++;
    }
    if (summary.blocking_reasons_count > 0) {
      blocked++;
    }
    if (summary.warnings_count > 0) {
      warnings++;
    }

    return summary;
  });

  return {
    total: allDrafts.length,
    by_state,
    by_platform,
    ready_to_post,
    blocked,
    warnings,
    drafts,
  };
}

// ─── VO-2F: Content Brief and Media Asset Validation ───────────────────────

export type ContentType = "short_form" | "long_form" | "carousel" | "text_post" | "mixed";
export type SourceMaterialKind = "script" | "outline" | "notes" | "transcript" | "research" | "image_prompt" | "other";
export type LocalMediaAssetKind = "video" | "thumbnail" | "caption" | "metadata";

export interface ContentBriefSourceMaterial {
  material_id: string;
  kind: SourceMaterialKind;
  local_path?: string;
  summary?: string;
}

export interface ContentBriefProductionConstraints {
  language: string;
  max_duration_seconds?: number;
  aspect_ratios: string[];
  captions_required: boolean;
  thumbnail_required: boolean;
  safe_zone_profile?: string;
  brand_voice?: string;
  prohibited_claims?: string[];
  compliance_notes?: string[];
}

export interface ContentBrief {
  schema_version: "1.0";
  brief_id: string;
  project_id: string;
  title: string;
  objective: string;
  target_platforms: string[];
  content_type: ContentType;
  source_materials: ContentBriefSourceMaterial[];
  production_constraints: ContentBriefProductionConstraints;
  created_at: string;
}

export interface ContentBriefValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface LocalMediaAssetReference {
  kind: LocalMediaAssetKind;
  path: string;
  expected_format?: string;
  expected_aspect_ratio?: string;
  expected_resolution?: string;
  required: boolean;
}

export interface LocalMediaAssetValidationResult {
  ok: boolean;
  exists_checked: false;
  ready_for_render: false;
  ready_for_upload: false;
  blocking_reasons: string[];
  warnings: string[];
}

function isForbiddenStringPattern(value: string): boolean {
  const forbidden = [
    "credential_reference",
    "credentialreference",
    "keychain://",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
    "bearer",
    "private_key",
    "password",
    "token",
  ];
  const lower = value.toLowerCase();
  return forbidden.some((p) => lower.includes(p));
}

function safeValidationLabel(value: unknown, fallback: string): string {
  // Never include raw user input in validation messages
  if (typeof value !== "string") {
    return fallback;
  }
  // Reject long values (prevent token leakage)
  if (value.length > 80) {
    return fallback;
  }
  // Reject values containing forbidden patterns
  if (isForbiddenStringPattern(value)) {
    return fallback;
  }
  // Safe to include short alphanumeric values
  if (/^[a-zA-Z0-9_-]+$/.test(value)) {
    return value;
  }
  return fallback;
}

function recursivelyCheckForForbiddenPatterns(obj: unknown): string[] {
  const violations: string[] = [];

  function check(val: unknown, path: string = "root", depth: number = 0): void {
    // Limit recursion depth to prevent stack overflow from circular references
    if (depth > 100) {
      return;
    }

    if (typeof val === "string") {
      if (isForbiddenStringPattern(val)) {
        violations.push(`Forbidden pattern found at ${path}`);
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        if (isForbiddenStringPattern(k)) {
          // Do not echo the key name, only indicate a forbidden pattern was found in an object
          violations.push(`Forbidden key pattern found at ${path}`);
        }
        // Use safe path construction: "parent.field" or just increment without raw key
        const fieldPath = path === "root" ? "field" : "nested_field";
        check(v, `${path}.${fieldPath}`, depth + 1);
      }
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        check(val[i], `${path}[${i}]`, depth + 1);
      }
    }
  }

  check(obj);
  return violations;
}

export function validateContentBrief(brief: unknown): ContentBriefValidationResult {
  const blocking: string[] = [];
  const warnings: string[] = [];

  // Type guard
  if (typeof brief !== "object" || brief === null) {
    return {
      ok: false,
      blocking_reasons: ["Content brief must be an object"],
      warnings: [],
    };
  }

  const b = brief as Record<string, unknown>;

  // Required fields
  if (!b.brief_id || typeof b.brief_id !== "string") {
    blocking.push("brief_id is required and must be a string");
  }
  if (!b.project_id || typeof b.project_id !== "string") {
    blocking.push("project_id is required and must be a string");
  }
  if (!b.title || typeof b.title !== "string") {
    blocking.push("title is required and must be a string");
  }
  if (!b.objective || typeof b.objective !== "string") {
    blocking.push("objective is required and must be a string");
  }
  if (!Array.isArray(b.target_platforms) || b.target_platforms.length === 0) {
    blocking.push("target_platforms is required and must be non-empty array");
  }
  if (!b.content_type || typeof b.content_type !== "string") {
    blocking.push("content_type is required and must be a string");
  }
  if (!Array.isArray(b.source_materials)) {
    blocking.push("source_materials is required and must be an array");
  }
  if (typeof b.production_constraints !== "object" || b.production_constraints === null) {
    blocking.push("production_constraints is required and must be an object");
  }
  if (!b.created_at || typeof b.created_at !== "string") {
    blocking.push("created_at is required and must be a string (ISO 8601)");
  }

  // Schema version
  if (b.schema_version !== "1.0") {
    blocking.push("schema_version must be '1.0'");
  }

  // Validate target platforms if present and is array
  if (Array.isArray(b.target_platforms)) {
    const validPlatforms = [
      "youtube",
      "youtube_shorts",
      "tiktok",
      "instagram",
      "facebook",
      "linkedin",
      "bluesky",
      "x",
    ];
    for (let i = 0; i < b.target_platforms.length; i++) {
      const platform = b.target_platforms[i];
      if (typeof platform === "string" && !validPlatforms.includes(platform)) {
        blocking.push(`Unknown platform at target_platforms[${i}]`);
      }
    }
  }

  // Validate content_type if present
  if (typeof b.content_type === "string") {
    const validTypes = ["short_form", "long_form", "carousel", "text_post", "mixed"];
    if (!validTypes.includes(b.content_type)) {
      blocking.push("Invalid content_type");
    }
  }

  // Check source_materials for local_path issues
  if (Array.isArray(b.source_materials)) {
    for (let i = 0; i < b.source_materials.length; i++) {
      const mat = b.source_materials[i];
      if (typeof mat === "object" && mat !== null) {
        const m = mat as Record<string, unknown>;
        if (m.local_path && typeof m.local_path === "string") {
          const p = m.local_path;
          // Check for absolute paths
          if (p.startsWith("/") || p.startsWith("~")) {
            blocking.push(
              `source_materials[${i}].local_path must be relative, not absolute`
            );
          }
          // Check for URLs
          if (p.includes("://") || p.includes("http")) {
            blocking.push(
              `source_materials[${i}].local_path must be local, not a URL`
            );
          }
          // Check for traversal
          if (p.includes("..")) {
            blocking.push(
              `source_materials[${i}].local_path contains traversal (..) which is not allowed`
            );
          }
        }
      }
    }
  }

  // Check for forbidden patterns in all string values recursively
  const forbiddenViolations = recursivelyCheckForForbiddenPatterns(brief);
  blocking.push(...forbiddenViolations);

  return {
    ok: blocking.length === 0,
    blocking_reasons: blocking,
    warnings,
  };
}

export function validateLocalMediaAssetReference(
  asset: unknown
): LocalMediaAssetValidationResult {
  const blocking: string[] = [];
  const warnings: string[] = [
    "VO-2F performs shape validation only. Real media inspection is deferred to VO-3B+.",
  ];

  // Type guard
  if (typeof asset !== "object" || asset === null) {
    return {
      ok: false,
      exists_checked: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: ["Media asset must be an object"],
      warnings,
    };
  }

  const a = asset as Record<string, unknown>;

  // Required fields
  if (!a.kind || typeof a.kind !== "string") {
    blocking.push("kind is required and must be a string");
  }
  if (!a.path || typeof a.path !== "string") {
    blocking.push("path is required and must be a string");
  }
  if (typeof a.required !== "boolean") {
    blocking.push("required is required and must be a boolean");
  }

  // Validate path
  if (typeof a.path === "string") {
    const p = a.path;
    // Check for absolute paths
    if (p.startsWith("/") || p.startsWith("~")) {
      blocking.push(`path must be relative, not absolute`);
    }
    // Check for URLs
    if (p.includes("://") || p.includes("http")) {
      blocking.push(`path must be local, not a URL`);
    }
    // Check for traversal
    if (p.includes("..")) {
      blocking.push(`path contains traversal (..) which is not allowed`);
    }
  }

  // Check for forbidden patterns
  const forbiddenViolations = recursivelyCheckForForbiddenPatterns(asset);
  blocking.push(...forbiddenViolations);

  return {
    ok: blocking.length === 0,
    exists_checked: false,
    ready_for_render: false,
    ready_for_upload: false,
    blocking_reasons: blocking,
    warnings,
  };
}

export interface AttachContentBriefToDraftInput {
  draft: ProductionPackageDraft;
  brief: ContentBrief;
  dryRun: true;
}

export function attachContentBriefToPackageDraft(
  input: AttachContentBriefToDraftInput
): ProductionPackageDraft {
  // VO-2F only supports dry-run
  if (input.dryRun !== true) {
    throw new Error("VO-2F attachContentBriefToPackageDraft requires dryRun=true");
  }

  // Validate content brief
  const briefValidation = validateContentBrief(input.brief);
  if (!briefValidation.ok) {
    throw new Error(
      `Content brief validation failed: ${briefValidation.blocking_reasons.join("; ")}`
    );
  }

  // Create a copy to avoid mutation. Only store safe summary fields.
  // Do not copy: source_materials, local_path, summaries, prohibited_claims, compliance_notes
  const updated: ProductionPackageDraft = {
    ...input.draft,
    assets: {
      ...input.draft.assets,
      metadata: {
        ...input.draft.assets.metadata,
        brief_id: input.brief.brief_id,
        brief_title: input.brief.title,
        content_type: input.brief.content_type,
        target_platforms_count: input.brief.target_platforms.length,
        target_platforms: input.brief.target_platforms,
        constraints_language: input.brief.production_constraints.language,
        constraints_captions_required: input.brief.production_constraints.captions_required,
        constraints_thumbnail_required: input.brief.production_constraints.thumbnail_required,
      },
    },
  };

  // Verify the updated draft is still safe for storage
  assertProductionPackageDraftSafeForStorage(updated);

  return updated;
}

// ─── VO-3B: Local Render Planning and Production Manifest ──────────────────

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type SafeZoneProfile = "desktop_landscape" | "mobile_vertical" | "square" | "portrait";
export type RenderTargetKind = "video" | "thumbnail" | "caption" | "metadata";
export type PlanState = "draft" | "blocked" | "planned";

export interface RenderTarget {
  kind: RenderTargetKind;
  format_key: string;
  aspect_ratio: AspectRatio;
  resolution: string;
  planned_output_path: string;
  expected_bitrate_kbps?: number;
  expected_duration_seconds?: number;
  safe_zone_profile?: SafeZoneProfile;
}

export interface AssetVariant {
  format_key?: string;
  planned_output_path: string;
}

export interface CaptionVariant {
  format: "srt" | "vtt" | "json";
  planned_output_path: string;
}

export interface VideoAssetPlan {
  count: number;
  variants?: AssetVariant[];
}

export interface ThumbnailAssetPlan {
  count: number;
  variants?: AssetVariant[];
}

export interface CaptionAssetPlan {
  count: number;
  formats?: ("srt" | "vtt" | "json")[];
  variants?: CaptionVariant[];
}

export interface AssetPlan {
  video: VideoAssetPlan;
  thumbnails: ThumbnailAssetPlan;
  captions: CaptionAssetPlan;
}

export interface RenderPlanValidation {
  ready_for_render: false;
  ready_for_upload: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RenderPlanProvenance {
  generated_by: string;
  source_package_id: string;
  checksum?: string;
}

export interface RenderPlan {
  schema_version: "1.0";
  render_plan_id: string;
  package_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  plan_state: PlanState;
  created_at: string;
  render_targets: RenderTarget[];
  asset_plan: AssetPlan;
  validation: RenderPlanValidation;
  provenance: RenderPlanProvenance;
}

export interface RenderPlanValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface CreateRenderPlanInput {
  draft: ProductionPackageDraft;
  platform: string;
  dryRun: true;
}

// ─── VO-3B: Render Plan Store ───────────────────────────────────────────────

function getRenderPlansPath(): string {
  return path.join(getRuntimeDir(), "render-plans.json");
}

interface RenderPlansStore {
  schema_version: "1.0";
  created_at: string;
  plans: RenderPlan[];
}

function loadRenderPlansStore(): RenderPlansStore {
  try {
    const storePath = getRenderPlansPath();
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, "utf8")) as RenderPlansStore;
      return data;
    }
  } catch (err) {
    console.warn("Failed to load render plans store:", err);
  }
  return {
    schema_version: "1.0",
    created_at: new Date().toISOString(),
    plans: [],
  };
}

function saveRenderPlansStore(store: RenderPlansStore): void {
  try {
    // Sort plans by created_at ascending, then render_plan_id before writing
    store.plans.sort((a, b) => {
      const timeCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (timeCompare !== 0) return timeCompare;
      return a.render_plan_id.localeCompare(b.render_plan_id);
    });

    const storePath = getRenderPlansPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  } catch (err) {
    console.warn("Failed to save render plans store:", err);
  }
}

export function saveRenderPlan(renderPlan: RenderPlan): void {
  // Validate before saving
  const validation = validateRenderPlan(renderPlan);
  if (!validation.ok) {
    throw new Error(`Render plan validation failed: ${validation.blocking_reasons.join("; ")}`);
  }

  const store = loadRenderPlansStore();

  // Check if plan already exists and update or add
  const existingIndex = store.plans.findIndex((p) => p.render_plan_id === renderPlan.render_plan_id);
  if (existingIndex >= 0) {
    store.plans[existingIndex] = renderPlan;
  } else {
    store.plans.push(renderPlan);
  }

  saveRenderPlansStore(store);
  logSchedulerEvent("Saved render plan", { render_plan_id: renderPlan.render_plan_id });
}

export function loadRenderPlan(renderPlanId: string): RenderPlan | null {
  const store = loadRenderPlansStore();
  return store.plans.find((p) => p.render_plan_id === renderPlanId) ?? null;
}

export function listRenderPlans(options?: {
  package_id?: string;
  project_id?: string;
  platform?: string;
  plan_state?: string;
}): RenderPlan[] {
  const store = loadRenderPlansStore();
  let plans = [...store.plans];

  if (options?.package_id) {
    plans = plans.filter((p) => p.package_id === options.package_id);
  }
  if (options?.project_id) {
    plans = plans.filter((p) => p.project_id === options.project_id);
  }
  if (options?.platform) {
    plans = plans.filter((p) => p.platform === options.platform);
  }
  if (options?.plan_state) {
    plans = plans.filter((p) => p.plan_state === options.plan_state);
  }

  // Stable sort by created_at ascending, then render_plan_id
  plans.sort((a, b) => {
    const timeCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeCompare !== 0) return timeCompare;
    return a.render_plan_id.localeCompare(b.render_plan_id);
  });

  return plans;
}

export function deleteRenderPlan(renderPlanId: string): boolean {
  const store = loadRenderPlansStore();
  const index = store.plans.findIndex((p) => p.render_plan_id === renderPlanId);
  if (index >= 0) {
    store.plans.splice(index, 1);
    saveRenderPlansStore(store);
    logSchedulerEvent("Deleted render plan", { render_plan_id: renderPlanId });
    return true;
  }
  return false;
}

export interface RenderPlanReadinessReport {
  render_plan_id: string;
  ready_for_render: boolean;
  ready_for_upload: boolean;
  plan_state: PlanState;
  blocking_reasons: string[];
  warnings: string[];
  summary: string;
}

function sanitizeRenderPlanString(value: unknown, fallback: string): string {
  // Never include raw unsafe render plan values in reports
  if (typeof value !== "string") {
    return fallback;
  }
  // Reject long values (prevent leakage)
  if (value.length > 80) {
    return fallback;
  }
  // Reject values containing forbidden patterns
  if (isForbiddenStringPattern(value)) {
    return fallback;
  }
  // Safe to include short alphanumeric values
  if (/^[a-zA-Z0-9_:-]+$/.test(value)) {
    return value;
  }
  return fallback;
}

export interface RenderPlanSummary {
  render_plan_id: string;
  package_id: string;
  project_id: string;
  platform: string;
  plan_state: string;
  ready_for_render: boolean;
  ready_for_upload: boolean;
  blocking_reasons_count: number;
  warnings_count: number;
  created_at: string;
}

export function buildRenderPlanSummary(plan: RenderPlan): RenderPlanSummary {
  // Safely get blocking_reasons count (handle malformed validation)
  let blockingReasonsCount = 0;
  if (
    plan.validation &&
    typeof plan.validation === "object" &&
    Array.isArray(plan.validation.blocking_reasons)
  ) {
    blockingReasonsCount = plan.validation.blocking_reasons.length;
  } else if (plan.validation && typeof plan.validation === "object") {
    // Malformed: validation exists but blocking_reasons is not an array
    blockingReasonsCount = 1; // Count as at least 1 blocking reason
  }

  // Safely get warnings count (handle malformed validation)
  let warningsCount = 0;
  if (
    plan.validation &&
    typeof plan.validation === "object" &&
    Array.isArray(plan.validation.warnings)
  ) {
    warningsCount = plan.validation.warnings.length;
  }
  // If validation.warnings is malformed or missing, count as 0 warnings

  return {
    render_plan_id: sanitizeRenderPlanString(plan.render_plan_id, "[unsafe-render-plan-id]"),
    package_id: sanitizeRenderPlanString(plan.package_id, "[unsafe-package-id]"),
    project_id: sanitizeRenderPlanString(plan.project_id, "[unsafe-project]"),
    platform: sanitizeRenderPlanString(plan.platform, "[unsafe-platform]"),
    plan_state: sanitizeRenderPlanString(plan.plan_state, "blocked"),
    ready_for_render: false,
    ready_for_upload: false,
    blocking_reasons_count: blockingReasonsCount,
    warnings_count: warningsCount,
    created_at: sanitizeRenderPlanString(plan.created_at, "[unsafe-created-at]"),
  };
}

export interface AggregateRenderPlanReadinessReport {
  total: number;
  by_state: Record<string, number>;
  by_platform: Record<string, number>;
  ready_for_render: number;
  ready_for_upload: number;
  blocked: number;
  warnings: number;
  plans: RenderPlanSummary[];
}

export function getLocalRenderPlanReadinessReport(options?: {
  project_id?: string;
  platform?: string;
}): AggregateRenderPlanReadinessReport {
  const plans = listRenderPlans(options);

  // Safe aggregate counts
  const by_state: Record<string, number> = {};
  const by_platform: Record<string, number> = {};
  let blockedCount = 0;
  let warningsCount = 0;

  // Build summaries with safe values
  const summaries = plans.map((plan) => {
    const summary = buildRenderPlanSummary(plan);

    // Count by state (using sanitized state)
    by_state[summary.plan_state] = (by_state[summary.plan_state] ?? 0) + 1;

    // Count by platform (using sanitized platform)
    by_platform[summary.platform] = (by_platform[summary.platform] ?? 0) + 1;

    // Count blocked and warnings
    if (summary.plan_state === "blocked" || summary.blocking_reasons_count > 0) {
      blockedCount++;
    }
    if (summary.warnings_count > 0) {
      warningsCount++;
    }

    return summary;
  });

  return {
    total: plans.length,
    by_state,
    by_platform,
    ready_for_render: 0, // Always 0 in VO-3B (planning only)
    ready_for_upload: 0, // Always 0 in VO-3B (no upload)
    blocked: blockedCount,
    warnings: warningsCount,
    plans: summaries,
  };
}

export function generateRenderPlanReadinessReport(
  renderPlanId: string
): RenderPlanReadinessReport | null {
  const plan = loadRenderPlan(renderPlanId);
  if (!plan) {
    return null;
  }

  // Use safe summary to sanitize all values
  const summary = buildRenderPlanSummary(plan);

  // Get safe plan_state (summary.plan_state is already a safe PlanState | fallback)
  const safePlanState = (summary.plan_state as PlanState) || ("blocked" as const);

  // Build generic summary messages without echoing raw values
  let summaryText = "";
  if (safePlanState === "draft") {
    summaryText = "Plan is in draft state. Rendering is still disabled in VO-3B.";
  } else if (safePlanState === "blocked") {
    summaryText = "Plan is blocked. Review sanitized readiness counts.";
  } else if (safePlanState === "planned") {
    summaryText = "Plan is planned. Rendering is still disabled in VO-3B.";
  } else {
    summaryText = "Plan state is unknown. Rendering is still disabled in VO-3B.";
  }

  // Build blocking reasons and warnings safely (no raw echoing)
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // Add generic blocking reasons based on plan state
  if (safePlanState === "draft") {
    blockingReasons.push("Plan is in draft state");
  } else if (safePlanState === "blocked") {
    blockingReasons.push("Plan is blocked");
  }

  // Add a generic message about rendering being disabled in VO-3B
  blockingReasons.push("Real rendering not implemented in VO-3B");

  // Add generic warning if there are blocking reasons from validation
  if (summary.blocking_reasons_count > 0) {
    warnings.push("Plan has blocking issues");
  }

  // Add generic warning if there are warnings from validation
  if (summary.warnings_count > 0) {
    warnings.push("Plan has warnings");
  }

  return {
    render_plan_id: summary.render_plan_id,
    ready_for_render: false,
    ready_for_upload: false,
    plan_state: safePlanState,
    blocking_reasons: blockingReasons,
    warnings,
    summary: summaryText,
  };
}

// ─── VO-3C: Local File Existence Validation and Manifest Consistency ───────

export type LocalFileExistenceCheckMode = "disabled" | "explicit";

export interface LocalFileExistenceCheckResult {
  checked: boolean;
  exists: boolean;
  path: string;
  kind: "input" | "planned_output";
  blocking_reasons: string[];
  warnings: string[];
}

export interface ManifestConsistencyValidationResult {
  ok: boolean;
  ready_for_render: false;
  ready_for_upload: false;
  files_checked: number;
  files_missing: number;
  blocking_reasons: string[];
  warnings: string[];
}

export interface LocalValidationReportSummary {
  total: number;
  files_checked: number;
  files_missing: number;
  blocked: number;
  warnings: number;
  ready_for_render: 0;
  ready_for_upload: 0;
  plans: Array<{
    render_plan_id: string;
    files_checked: number;
    files_missing: number;
    blocking_reasons_count: number;
    warnings_count: number;
  }>;
}

export function resolveSafeLocalValidationPath(input: {
  relativePath: string;
  baseDir: string;
}): {
  ok: boolean;
  absolutePath?: string;
  blocking_reasons: string[];
} {
  const { relativePath, baseDir } = input;
  const blocking_reasons: string[] = [];

  // Validate input type
  if (typeof relativePath !== "string") {
    blocking_reasons.push("Path must be a string");
    return { ok: false, blocking_reasons };
  }

  if (!baseDir || typeof baseDir !== "string") {
    blocking_reasons.push("Base directory must be a string");
    return { ok: false, blocking_reasons };
  }

  // Block absolute paths
  if (path.isAbsolute(relativePath)) {
    blocking_reasons.push("Absolute paths are not allowed");
    return { ok: false, blocking_reasons };
  }

  // Block URLs
  if (
    relativePath.includes("://") ||
    relativePath.startsWith("http") ||
    relativePath.startsWith("https")
  ) {
    blocking_reasons.push("URLs are not allowed");
    return { ok: false, blocking_reasons };
  }

  // Block traversal attempts
  if (relativePath.includes("..")) {
    blocking_reasons.push("Path traversal is not allowed");
    return { ok: false, blocking_reasons };
  }

  // Block forbidden patterns
  if (isForbiddenStringPattern(relativePath)) {
    blocking_reasons.push("Path contains forbidden patterns");
    return { ok: false, blocking_reasons };
  }

  // Resolve within baseDir
  try {
    const absolutePath = path.resolve(path.join(baseDir, relativePath));
    const baseDirResolved = path.resolve(baseDir);

    // Verify resolved path is within baseDir
    if (!absolutePath.startsWith(baseDirResolved + path.sep) && absolutePath !== baseDirResolved) {
      blocking_reasons.push("Path escapes base directory");
      return { ok: false, blocking_reasons };
    }

    return { ok: true, absolutePath, blocking_reasons: [] };
  } catch (err) {
    blocking_reasons.push("Failed to resolve path");
    return { ok: false, blocking_reasons };
  }
}

export function validateLocalFileExistence(input: {
  relativePath: string;
  baseDir: string;
  kind: "input" | "planned_output";
  checkMode: LocalFileExistenceCheckMode;
}): LocalFileExistenceCheckResult {
  const { relativePath, baseDir, kind, checkMode } = input;

  const result: LocalFileExistenceCheckResult = {
    checked: false,
    exists: false,
    path: sanitizeRenderPlanString(relativePath, "[unsafe-path]"),
    kind,
    blocking_reasons: [],
    warnings: [],
  };

  if (checkMode === "disabled") {
    result.warnings.push("File existence check disabled");
    return result;
  }

  // Explicit check mode: validate path safety first
  const resolution = resolveSafeLocalValidationPath({
    relativePath,
    baseDir,
  });

  if (!resolution.ok) {
    result.blocking_reasons = [...resolution.blocking_reasons];
    return result;
  }

  // Safe path: check filesystem
  const absolutePath = resolution.absolutePath!;
  result.checked = true;

  try {
    result.exists = fs.existsSync(absolutePath);

    // Input files missing: blocking
    if (kind === "input" && !result.exists) {
      result.blocking_reasons.push("Input file not found");
    }

    // Planned output files missing: warning only (VO-3C does not create files)
    if (kind === "planned_output" && !result.exists) {
      result.warnings.push("Planned output file does not exist (VO-3C does not create files)");
    }
  } catch (err) {
    result.blocking_reasons.push("Failed to check file existence");
  }

  return result;
}

export function validateRenderPlanManifestConsistency(input: {
  plan: RenderPlan;
  baseDir: string;
  checkMode: LocalFileExistenceCheckMode;
}): ManifestConsistencyValidationResult {
  const { plan, baseDir, checkMode } = input;

  // First validate the plan itself
  const planValidation = validateRenderPlan(plan);

  const result: ManifestConsistencyValidationResult = {
    ok: planValidation.ok,
    ready_for_render: false,
    ready_for_upload: false,
    files_checked: 0,
    files_missing: 0,
    blocking_reasons: [...planValidation.blocking_reasons],
    warnings: [...planValidation.warnings],
  };

  if (checkMode === "disabled") {
    result.warnings.push("File existence checks disabled");
    return result;
  }

  // Explicit check mode: validate planned output paths
  if (!plan.render_targets || !Array.isArray(plan.render_targets)) {
    result.warnings.push("No render targets found");
    return result;
  }

  // Check each planned output path
  for (const target of plan.render_targets) {
    if (!target.planned_output_path) {
      result.warnings.push("Render target missing planned_output_path");
      continue;
    }

    const check = validateLocalFileExistence({
      relativePath: target.planned_output_path,
      baseDir,
      kind: "planned_output",
      checkMode: "explicit",
    });

    if (check.checked) {
      result.files_checked++;
      if (!check.exists) {
        result.files_missing++;
      }
    }

    if (check.blocking_reasons.length > 0) {
      result.blocking_reasons.push(...check.blocking_reasons);
    }

    if (check.warnings.length > 0) {
      result.warnings.push(...check.warnings);
    }
  }

  // Mark as blocked if there are blocking reasons
  if (result.blocking_reasons.length > 0) {
    result.ok = false;
  }

  return result;
}

export function getLocalRenderPlanValidationReport(input: {
  checkMode: LocalFileExistenceCheckMode;
  baseDir?: string;
  project_id?: string;
  platform?: string;
}): LocalValidationReportSummary {
  const { checkMode, baseDir: providedBaseDir, project_id, platform } = input;

  // Use provided baseDir or fallback to runtime dir
  const baseDir = providedBaseDir || getRuntimeDir();

  // Get plans with optional filters
  const filterOptions: { project_id?: string; platform?: string } = {};
  if (project_id !== undefined) filterOptions.project_id = project_id;
  if (platform !== undefined) filterOptions.platform = platform;
  const plans = listRenderPlans(filterOptions);

  let totalFilesChecked = 0;
  let totalFilesMissing = 0;
  let totalBlocked = 0;
  let totalWarnings = 0;

  const planSummaries = plans.map((plan) => {
    const manifestCheck = validateRenderPlanManifestConsistency({
      plan,
      baseDir,
      checkMode,
    });

    totalFilesChecked += manifestCheck.files_checked;
    totalFilesMissing += manifestCheck.files_missing;

    if (!manifestCheck.ok) {
      totalBlocked++;
    }

    if (manifestCheck.warnings.length > 0) {
      totalWarnings++;
    }

    return {
      render_plan_id: sanitizeRenderPlanString(plan.render_plan_id, "[unsafe-render-plan-id]"),
      files_checked: manifestCheck.files_checked,
      files_missing: manifestCheck.files_missing,
      blocking_reasons_count: manifestCheck.blocking_reasons.length,
      warnings_count: manifestCheck.warnings.length,
    };
  });

  return {
    total: plans.length,
    files_checked: totalFilesChecked,
    files_missing: totalFilesMissing,
    blocked: totalBlocked,
    warnings: totalWarnings,
    ready_for_render: 0,
    ready_for_upload: 0,
    plans: planSummaries,
  };
}

// ─── VO-3D: Manual Render Manifest Checks and Format/Platform Consistency ───

export interface RenderFormatSpecSummary {
  format_key: string;
  platform?: string;
  aspect_ratio: string;
  resolution: string;
  safe_zone_profile?: string;
  thumbnail_required?: boolean;
  captions_required?: boolean;
}

export interface RenderManifestConsistencyCheckResult {
  ok: boolean;
  ready_for_render: false;
  ready_for_upload: false;
  checked_targets: number;
  blocking_reasons: string[];
  warnings: string[];
}

export interface ManualRenderManifestCheckReport {
  total: number;
  checked_targets: number;
  blocked: number;
  warnings: number;
  ready_for_render: 0;
  ready_for_upload: 0;
  plans: Array<{
    render_plan_id: string;
    package_id: string;
    project_id: string;
    platform: string;
    plan_state: string;
    checked_targets: number;
    blocking_reasons_count: number;
    warnings_count: number;
  }>;
}

export function loadVideoOrchestratorFormatSpecs(): unknown {
  try {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, "operations/specs/video-orchestrator/format-specs.json");
    if (fs.existsSync(specPath)) {
      const raw = fs.readFileSync(specPath, "utf8");
      const specs = JSON.parse(raw);
      // Conservative shape validation
      if (specs && typeof specs === "object" && Array.isArray(specs.formats)) {
        return specs;
      }
    }
  } catch (err) {
    // Silently ignore errors; caller will handle missing specs
  }
  return undefined;
}

export function loadVideoOrchestratorPlatformSpecs(): unknown {
  try {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, "operations/specs/video-orchestrator/platform-specs.json");
    if (fs.existsSync(specPath)) {
      const raw = fs.readFileSync(specPath, "utf8");
      const specs = JSON.parse(raw);
      // Conservative shape validation
      if (specs && typeof specs === "object" && Array.isArray(specs.platforms)) {
        return specs;
      }
    }
  } catch (err) {
    // Silently ignore errors; caller will handle missing specs
  }
  return undefined;
}

export function validateRenderTargetAgainstSpecs(input: {
  target: RenderTarget;
  platform: string;
  formatSpecs?: unknown;
  platformSpecs?: unknown;
}): RenderManifestConsistencyCheckResult {
  const { target, platform, formatSpecs, platformSpecs } = input;

  const blocking_reasons: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!target.format_key || typeof target.format_key !== "string") {
    blocking_reasons.push("Target must have format_key");
  } else if (isForbiddenStringPattern(target.format_key)) {
    blocking_reasons.push("Target format_key contains forbidden patterns");
  }

  if (!target.aspect_ratio || typeof target.aspect_ratio !== "string") {
    blocking_reasons.push("Target must have aspect_ratio");
  } else if (isForbiddenStringPattern(target.aspect_ratio)) {
    blocking_reasons.push("Target aspect_ratio contains forbidden patterns");
  }

  if (!target.resolution || typeof target.resolution !== "string") {
    blocking_reasons.push("Target must have resolution");
  } else if (isForbiddenStringPattern(target.resolution)) {
    blocking_reasons.push("Target resolution contains forbidden patterns");
  }

  // Check against format specs if available
  if (formatSpecs && typeof formatSpecs === "object" && "formats" in formatSpecs) {
    const formats = (formatSpecs as any).formats;
    if (Array.isArray(formats)) {
      const matchedFormat = formats.find((f: any) => f.format_key === target.format_key);
      if (!matchedFormat) {
        warnings.push("Format key not found in local format specifications");
      } else {
        // Check aspect ratio match
        if (matchedFormat.aspect_ratio && matchedFormat.aspect_ratio !== target.aspect_ratio) {
          warnings.push("Target aspect_ratio does not match format specification");
        }
        // Check resolution match
        if (matchedFormat.resolution && matchedFormat.resolution !== target.resolution) {
          warnings.push("Target resolution does not match format specification");
        }
      }
    }
  }

  // Check against platform specs if available
  if (platformSpecs && typeof platformSpecs === "object" && "platforms" in platformSpecs) {
    const platforms = (platformSpecs as any).platforms;
    if (Array.isArray(platforms)) {
      const hasPlatform = platforms.some((p: any) => p.platform === platform);
      if (!hasPlatform) {
        warnings.push("Platform not found in local platform specifications");
      }
    }
  }

  return {
    ok: blocking_reasons.length === 0,
    ready_for_render: false,
    ready_for_upload: false,
    checked_targets: 1,
    blocking_reasons,
    warnings,
  };
}

export function validateRenderPlanAgainstLocalSpecs(input: {
  plan: RenderPlan;
  formatSpecs?: unknown;
  platformSpecs?: unknown;
}): RenderManifestConsistencyCheckResult {
  const { plan, formatSpecs, platformSpecs } = input;

  // First validate the plan itself
  const planValidation = validateRenderPlan(plan);

  const blocking_reasons = [...planValidation.blocking_reasons];
  const warnings = [...planValidation.warnings];

  let checkedTargets = 0;

  // Check each render target against specs
  if (plan.render_targets && Array.isArray(plan.render_targets)) {
    for (const target of plan.render_targets) {
      const targetCheck = validateRenderTargetAgainstSpecs({
        target,
        platform: plan.platform,
        formatSpecs,
        platformSpecs,
      });

      checkedTargets += targetCheck.checked_targets;
      blocking_reasons.push(...targetCheck.blocking_reasons);
      warnings.push(...targetCheck.warnings);
    }
  }

  // Warn if specs were not available
  if (!formatSpecs) {
    warnings.push("Format specifications not available for validation");
  }
  if (!platformSpecs) {
    warnings.push("Platform specifications not available for validation");
  }

  return {
    ok: blocking_reasons.length === 0,
    ready_for_render: false,
    ready_for_upload: false,
    checked_targets: checkedTargets,
    blocking_reasons,
    warnings,
  };
}

export function getManualRenderManifestCheckReport(input?: {
  project_id?: string;
  platform?: string;
  useLocalSpecs?: boolean;
}): ManualRenderManifestCheckReport {
  const { project_id, platform, useLocalSpecs } = input || {};

  // Load specs if requested
  const formatSpecs = useLocalSpecs ? loadVideoOrchestratorFormatSpecs() : undefined;
  const platformSpecs = useLocalSpecs ? loadVideoOrchestratorPlatformSpecs() : undefined;

  // Get plans with optional filters
  const filterOptions: { project_id?: string; platform?: string } = {};
  if (project_id !== undefined) filterOptions.project_id = project_id;
  if (platform !== undefined) filterOptions.platform = platform;
  const plans = listRenderPlans(filterOptions);

  let totalCheckedTargets = 0;
  let totalBlocked = 0;
  let totalWarnings = 0;

  const planSummaries = plans.map((plan) => {
    const manifestCheck = validateRenderPlanAgainstLocalSpecs({
      plan,
      formatSpecs,
      platformSpecs,
    });

    totalCheckedTargets += manifestCheck.checked_targets;

    if (!manifestCheck.ok) {
      totalBlocked++;
    }

    if (manifestCheck.warnings.length > 0) {
      totalWarnings++;
    }

    return {
      render_plan_id: sanitizeRenderPlanString(plan.render_plan_id, "[unsafe-render-plan-id]"),
      package_id: sanitizeRenderPlanString(plan.package_id, "[unsafe-package-id]"),
      project_id: sanitizeRenderPlanString(plan.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(plan.platform, "[unsafe-platform]"),
      plan_state: sanitizeRenderPlanString(plan.plan_state, "blocked"),
      checked_targets: manifestCheck.checked_targets,
      blocking_reasons_count: manifestCheck.blocking_reasons.length,
      warnings_count: manifestCheck.warnings.length,
    };
  });

  return {
    total: plans.length,
    checked_targets: totalCheckedTargets,
    blocked: totalBlocked,
    warnings: totalWarnings,
    ready_for_render: 0,
    ready_for_upload: 0,
    plans: planSummaries,
  };
}

export function createLocalRenderPlanFromPackageDraft(
  input: CreateRenderPlanInput
): RenderPlan {
  // VO-3B only supports dry-run
  if (input.dryRun !== true) {
    throw new Error("VO-3B createLocalRenderPlanFromPackageDraft requires dryRun=true");
  }

  // Validate draft exists
  if (!input.draft || typeof input.draft !== "object") {
    throw new Error("Package draft is required");
  }

  const draft = input.draft;

  // Draft must be dry-run
  if (draft.dry_run !== true) {
    throw new Error("VO-3B only supports dry-run package drafts");
  }

  // Draft must not be upload-ready
  if (draft.readiness?.ready_to_post === true) {
    throw new Error("VO-3B cannot create render plans from upload-ready drafts");
  }

  // Validate platform
  const validPlatforms = [
    "youtube",
    "youtube_shorts",
    "tiktok",
    "instagram",
    "facebook",
    "linkedin",
    "bluesky",
    "x",
  ];
  if (!validPlatforms.includes(input.platform)) {
    throw new Error("Platform must be valid");
  }

  // Platform must match draft platform (or document intentional override)
  if (draft.platform !== input.platform) {
    throw new Error("Render plan platform must match draft platform");
  }

  const renderPlanId = `plan-${draft.package_id}-${input.platform}`;

  // Build render targets based on platform and draft metadata
  const renderTargets: RenderTarget[] = [];

  // Video target (always required)
  renderTargets.push({
    kind: "video",
    format_key: `landscape_1920x1080_16x9`,
    aspect_ratio: "16:9",
    resolution: "1920x1080",
    planned_output_path: `renders/${draft.package_id}/video_1920x1080_h264.mp4`,
    expected_bitrate_kbps: 5000,
    expected_duration_seconds: 180,
    safe_zone_profile: "desktop_landscape",
  });

  // Thumbnail target if required
  if (draft.assets?.metadata?.thumbnail_required ?? false) {
    renderTargets.push({
      kind: "thumbnail",
      format_key: "youtube_thumbnail_1280x720",
      aspect_ratio: "16:9",
      resolution: "1280x720",
      planned_output_path: `renders/${draft.package_id}/thumbnail_1280x720.jpg`,
    });
  }

  // Caption targets if required
  if (draft.assets?.metadata?.captions_required ?? false) {
    renderTargets.push({
      kind: "caption",
      format_key: "caption_srt",
      aspect_ratio: "1:1",
      resolution: "N/A",
      planned_output_path: `renders/${draft.package_id}/captions_en.srt`,
    });
    renderTargets.push({
      kind: "caption",
      format_key: "caption_vtt",
      aspect_ratio: "1:1",
      resolution: "N/A",
      planned_output_path: `renders/${draft.package_id}/captions_en.vtt`,
    });
  }

  // Build asset plan
  const assetPlan: AssetPlan = {
    video: {
      count: 1,
      variants: [
        {
          format_key: "landscape_1920x1080_16x9",
          planned_output_path: `renders/${draft.package_id}/video_1920x1080_h264.mp4`,
        },
      ],
    },
    thumbnails: {
      count: draft.assets?.metadata?.thumbnail_required ? 1 : 0,
      variants: draft.assets?.metadata?.thumbnail_required
        ? [
            {
              planned_output_path: `renders/${draft.package_id}/thumbnail_1280x720.jpg`,
            },
          ]
        : [],
    },
    captions: {
      count: draft.assets?.metadata?.captions_required ? 2 : 0,
      formats: draft.assets?.metadata?.captions_required ? ["srt", "vtt"] : [],
      variants: draft.assets?.metadata?.captions_required
        ? [
            {
              format: "srt",
              planned_output_path: `renders/${draft.package_id}/captions_en.srt`,
            },
            {
              format: "vtt",
              planned_output_path: `renders/${draft.package_id}/captions_en.vtt`,
            },
          ]
        : [],
    },
  };

  // Create render plan
  const renderPlan: RenderPlan = {
    schema_version: "1.0",
    render_plan_id: renderPlanId,
    package_id: draft.package_id,
    project_id: draft.project_id,
    platform: input.platform,
    dry_run: true,
    plan_state: "planned",
    created_at: new Date().toISOString(),
    render_targets: renderTargets,
    asset_plan: assetPlan,
    validation: {
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: ["Real rendering not implemented in VO-3B"],
      warnings: ["Output files are placeholders only"],
    },
    provenance: {
      generated_by: "VO-3B createLocalRenderPlanFromPackageDraft",
      source_package_id: draft.package_id,
      checksum: `sha256:${crypto.randomBytes(16).toString("hex")}`,
    },
  };

  // Validate the created plan
  const validation = validateRenderPlan(renderPlan);
  if (!validation.ok) {
    throw new Error(`Created render plan validation failed: ${validation.blocking_reasons.join("; ")}`);
  }

  return renderPlan;
}

export function validateRenderPlan(plan: unknown): RenderPlanValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];

  // Type guard
  if (typeof plan !== "object" || plan === null) {
    blocking_reasons.push("Render plan must be an object");
    return { ok: false, blocking_reasons, warnings };
  }

  const p = plan as Record<string, unknown>;

  // Required fields
  if (typeof p.schema_version !== "string" || p.schema_version !== "1.0") {
    blocking_reasons.push("schema_version must be '1.0'");
  }
  if (typeof p.render_plan_id !== "string" || !/^[a-z0-9_-]+$/.test(p.render_plan_id)) {
    blocking_reasons.push("render_plan_id must be lowercase alphanumeric");
  }
  if (typeof p.package_id !== "string") {
    blocking_reasons.push("package_id is required");
  }
  if (typeof p.project_id !== "string") {
    blocking_reasons.push("project_id is required");
  }

  // Platform validation
  const validPlatforms = [
    "youtube",
    "youtube_shorts",
    "tiktok",
    "instagram",
    "facebook",
    "linkedin",
    "bluesky",
    "x",
  ];
  if (typeof p.platform !== "string" || !validPlatforms.includes(p.platform)) {
    blocking_reasons.push("platform must be valid");
  }

  // Dry run must be true
  if (p.dry_run !== true) {
    blocking_reasons.push("dry_run must be true (VO-3B is planning only)");
  }

  // Plan state validation
  const validPlanStates = ["draft", "blocked", "planned"];
  if (typeof p.plan_state !== "string" || !validPlanStates.includes(p.plan_state)) {
    blocking_reasons.push("plan_state must be 'draft', 'blocked', or 'planned'");
  } else if (p.plan_state === "draft") {
    warnings.push("Plan state is 'draft' but not yet finalized");
  }

  // created_at validation
  if (typeof p.created_at !== "string") {
    blocking_reasons.push("created_at must be ISO 8601 timestamp");
  } else {
    try {
      new Date(p.created_at);
    } catch {
      blocking_reasons.push("created_at must be valid ISO 8601 timestamp");
    }
  }

  // Render targets validation
  if (!Array.isArray(p.render_targets)) {
    blocking_reasons.push("render_targets must be an array");
  } else if (p.render_targets.length === 0) {
    blocking_reasons.push("render_targets must have at least one item");
  } else {
    for (let i = 0; i < p.render_targets.length; i++) {
      const target = p.render_targets[i];
      if (typeof target !== "object" || target === null) {
        blocking_reasons.push(`render_targets[${i}] must be an object`);
        continue;
      }
      const t = target as Record<string, unknown>;

      // Required fields
      const validKinds = ["video", "thumbnail", "caption", "metadata"];
      if (typeof t.kind !== "string" || !validKinds.includes(t.kind)) {
        blocking_reasons.push(`render_targets[${i}].kind must be valid`);
      }
      if (typeof t.format_key !== "string") {
        blocking_reasons.push(`render_targets[${i}].format_key is required`);
      }
      const validAspectRatios = ["16:9", "9:16", "1:1", "4:5"];
      if (typeof t.aspect_ratio !== "string" || !validAspectRatios.includes(t.aspect_ratio)) {
        blocking_reasons.push(`render_targets[${i}].aspect_ratio must be valid`);
      }
      if (typeof t.resolution !== "string") {
        blocking_reasons.push(`render_targets[${i}].resolution is required`);
      }
      if (typeof t.planned_output_path !== "string") {
        blocking_reasons.push(`render_targets[${i}].planned_output_path is required`);
      } else {
        // Path must be relative (no /, no .., no absolute paths)
        if (t.planned_output_path.startsWith("/")) {
          blocking_reasons.push(`render_targets[${i}].planned_output_path must be relative, not absolute`);
        }
        if (t.planned_output_path.includes("..")) {
          blocking_reasons.push(`render_targets[${i}].planned_output_path must not contain traversal (..) patterns`);
        }
        if (t.planned_output_path.includes("://") || t.planned_output_path.includes("http")) {
          blocking_reasons.push(`render_targets[${i}].planned_output_path must be local, not a URL`);
        }
        // Check for credential patterns
        if (isForbiddenStringPattern(t.planned_output_path)) {
          blocking_reasons.push(`render_targets[${i}].planned_output_path contains forbidden pattern`);
        }
      }
    }
  }

  // Asset plan validation
  if (typeof p.asset_plan !== "object" || p.asset_plan === null) {
    blocking_reasons.push("asset_plan is required");
  } else {
    const ap = p.asset_plan as Record<string, unknown>;

    // Video
    if (typeof ap.video !== "object" || ap.video === null) {
      blocking_reasons.push("asset_plan.video is required");
    } else {
      const v = ap.video as Record<string, unknown>;
      if (typeof v.count !== "number" || v.count < 1) {
        blocking_reasons.push("asset_plan.video.count must be >= 1");
      }
    }

    // Thumbnails
    if (typeof ap.thumbnails !== "object" || ap.thumbnails === null) {
      blocking_reasons.push("asset_plan.thumbnails is required");
    } else {
      const th = ap.thumbnails as Record<string, unknown>;
      if (typeof th.count !== "number" || th.count < 0) {
        blocking_reasons.push("asset_plan.thumbnails.count must be >= 0");
      }
    }

    // Captions
    if (typeof ap.captions !== "object" || ap.captions === null) {
      blocking_reasons.push("asset_plan.captions is required");
    } else {
      const c = ap.captions as Record<string, unknown>;
      if (typeof c.count !== "number" || c.count < 0) {
        blocking_reasons.push("asset_plan.captions.count must be >= 0");
      }
    }
  }

  // Validation structure
  if (typeof p.validation !== "object" || p.validation === null) {
    blocking_reasons.push("validation is required");
  } else {
    const v = p.validation as Record<string, unknown>;
    if (v.ready_for_render !== false) {
      blocking_reasons.push("validation.ready_for_render must be false (VO-3B is planning only)");
    }
    if (v.ready_for_upload !== false) {
      blocking_reasons.push("validation.ready_for_upload must be false (upload deferred to VO-3E+)");
    }
    if (!Array.isArray(v.blocking_reasons)) {
      blocking_reasons.push("validation.blocking_reasons must be an array");
    }
    if (!Array.isArray(v.warnings)) {
      blocking_reasons.push("validation.warnings must be an array");
    }
  }

  // Provenance
  if (typeof p.provenance !== "object" || p.provenance === null) {
    blocking_reasons.push("provenance is required");
  } else {
    const prov = p.provenance as Record<string, unknown>;
    if (typeof prov.generated_by !== "string") {
      blocking_reasons.push("provenance.generated_by is required");
    }
    if (typeof prov.source_package_id !== "string") {
      blocking_reasons.push("provenance.source_package_id is required");
    }
  }

  // Check for forbidden patterns in the entire structure
  const forbiddenPatternReasons = recursivelyCheckForForbiddenPatterns(p);
  blocking_reasons.push(...forbiddenPatternReasons);

  // If no blocking reasons, plan is ok
  const ok = blocking_reasons.length === 0;

  // Add blocking reason for planning only
  if (ok && p.plan_state !== "planned") {
    warnings.push("Real rendering not implemented in VO-3B");
  }

  return { ok, blocking_reasons, warnings };
}

// ─── VO-3E: Render Execution Gate and Manual Export Bundle ──────────────────

function getRenderExecutionGatesPath(): string {
  return path.join(getRuntimeDir(), "render-execution-gates.json");
}

function getManualExportBundlesPath(): string {
  return path.join(getRuntimeDir(), "manual-export-bundles.json");
}

export type RenderExecutionGateState = "blocked" | "needs_operator_approval" | "approved_for_manual_render" | "rejected";

export interface RenderExecutionGateCheck {
  check_id: string;
  kind: "render_plan_validation" | "manifest_consistency" | "local_file_existence" | "format_platform_specs" | "operator_approval";
  ok: boolean;
  blocking_reasons_count: number;
  warnings_count: number;
}

export interface RenderExecutionGate {
  gate_id: string;
  render_plan_id: string;
  package_id: string;
  project_id: string;
  platform: string;
  gate_state: RenderExecutionGateState;
  dry_run: true;
  approval_required: true;
  created_at: string;
  evaluated_at: string;
  checks: RenderExecutionGateCheck[];
  blocking_reasons: string[];
  warnings: string[];
  operator_instructions: string;
  provenance: {
    generated_by: string;
    source_plan_id: string;
    checksum: string;
  };
}

export type ManualExportBundleState = "draft" | "blocked" | "ready_for_operator_review";

export interface PlannedOutputSummary {
  output_kind: "video" | "thumbnail" | "caption" | "metadata";
  format_key: string;
  expected_relative_path_summary: string;
  required: boolean;
}

export interface ManualExportBundle {
  schema_version: "1.0";
  bundle_id: string;
  gate_id: string;
  render_plan_id: string;
  package_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  bundle_state: ManualExportBundleState;
  created_at: string;
  manifest_summary: {
    total_outputs: number;
    by_kind: Record<string, number>;
  };
  operator_checklist: string[];
  planned_outputs: PlannedOutputSummary[];
  validation: {
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: string;
    source_gate_id: string;
    checksum: string;
  };
}

// Evaluate render plan for execution gate
export function evaluateRenderExecutionGate(input: {
  plan: RenderPlan;
  checkMode: "disabled" | "explicit";
  baseDir?: string;
  useLocalSpecs?: boolean;
  dryRun: true;
}): RenderExecutionGate {
  if (!input.dryRun) {
    throw new Error("VO-3E gates only support dryRun=true");
  }

  const { plan, checkMode, baseDir, useLocalSpecs } = input;
  const gate_id = `render-gate-${crypto.randomBytes(6).toString("hex")}`;
  const checks: RenderExecutionGateCheck[] = [];
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];

  // Check 1: Render plan validation
  const planValidation = validateRenderPlan(plan);
  checks.push({
    check_id: `check-plan-${gate_id}`,
    kind: "render_plan_validation",
    ok: planValidation.ok,
    blocking_reasons_count: planValidation.blocking_reasons.length,
    warnings_count: planValidation.warnings.length,
  });
  if (!planValidation.ok) {
    blocking_reasons.push(...planValidation.blocking_reasons);
  }
  warnings.push(...planValidation.warnings);

  // Check 2: Manifest consistency
  const manifestCheck = validateRenderPlanManifestConsistency({
    plan,
    checkMode,
    baseDir: baseDir || process.cwd(),
  });
  checks.push({
    check_id: `check-manifest-${gate_id}`,
    kind: "manifest_consistency",
    ok: manifestCheck.ok,
    blocking_reasons_count: manifestCheck.blocking_reasons.length,
    warnings_count: manifestCheck.warnings.length,
  });
  if (!manifestCheck.ok) {
    blocking_reasons.push(...manifestCheck.blocking_reasons);
  }
  warnings.push(...manifestCheck.warnings);

  // Check 3: Format/platform specs
  const specsCheck = validateRenderPlanAgainstLocalSpecs({
    plan,
    formatSpecs: useLocalSpecs ? loadVideoOrchestratorFormatSpecs() : undefined,
    platformSpecs: useLocalSpecs ? loadVideoOrchestratorPlatformSpecs() : undefined,
  });
  checks.push({
    check_id: `check-specs-${gate_id}`,
    kind: "format_platform_specs",
    ok: specsCheck.ok,
    blocking_reasons_count: specsCheck.blocking_reasons.length,
    warnings_count: specsCheck.warnings.length,
  });
  if (!specsCheck.ok) {
    blocking_reasons.push(...specsCheck.blocking_reasons);
  }
  warnings.push(...specsCheck.warnings);

  // Check 4: Operator approval required (never auto-approved)
  checks.push({
    check_id: `check-approval-${gate_id}`,
    kind: "operator_approval",
    ok: false, // Always requires approval
    blocking_reasons_count: 0,
    warnings_count: 0,
  });

  const gate_state: RenderExecutionGateState =
    blocking_reasons.length > 0 ? "blocked" : "needs_operator_approval";

  return {
    gate_id,
    render_plan_id: plan.render_plan_id,
    package_id: plan.package_id,
    project_id: plan.project_id,
    platform: plan.platform,
    gate_state,
    dry_run: true,
    approval_required: true,
    created_at: new Date().toISOString(),
    evaluated_at: new Date().toISOString(),
    checks,
    blocking_reasons,
    warnings,
    operator_instructions: "Review this render gate evaluation before proceeding. All rendering must be explicitly approved.",
    provenance: {
      generated_by: "evaluateRenderExecutionGate",
      source_plan_id: plan.render_plan_id,
      checksum: `sha256:${crypto.randomBytes(16).toString("hex")}`,
    },
  };
}

interface RenderExecutionGatesStore {
  schema_version: "1.0";
  created_at: string;
  gates: RenderExecutionGate[];
}

function loadRenderExecutionGatesStore(): RenderExecutionGatesStore {
  const storePath = getRenderExecutionGatesPath();
  if (fs.existsSync(storePath)) {
    try {
      return JSON.parse(fs.readFileSync(storePath, "utf8")) as RenderExecutionGatesStore;
    } catch {
      // corrupt or invalid, start fresh
    }
  }
  return {
    schema_version: "1.0",
    created_at: new Date().toISOString(),
    gates: [],
  };
}

function saveRenderExecutionGatesStore(store: RenderExecutionGatesStore): void {
  const storePath = getRenderExecutionGatesPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function saveRenderExecutionGate(gate: RenderExecutionGate): void {
  if (!gate.dry_run) {
    throw new Error("VO-3E gates only support dry_run=true");
  }
  if (!gate.approval_required) {
    throw new Error("VO-3E gates require approval_required=true");
  }

  const store = loadRenderExecutionGatesStore();
  const idx = store.gates.findIndex(g => g.gate_id === gate.gate_id);
  if (idx >= 0) {
    store.gates[idx] = gate;
  } else {
    store.gates.push(gate);
  }
  store.gates.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.gate_id.localeCompare(b.gate_id));
  saveRenderExecutionGatesStore(store);
}

export function listRenderExecutionGates(options?: {
  render_plan_id?: string;
  project_id?: string;
  platform?: string;
  gate_state?: string;
}): RenderExecutionGate[] {
  const store = loadRenderExecutionGatesStore();
  return store.gates.filter(g => {
    if (options?.render_plan_id && g.render_plan_id !== options.render_plan_id) return false;
    if (options?.project_id && g.project_id !== options.project_id) return false;
    if (options?.platform && g.platform !== options.platform) return false;
    if (options?.gate_state && g.gate_state !== options.gate_state) return false;
    return true;
  });
}

export function getRenderExecutionGate(gate_id: string): RenderExecutionGate | null {
  const store = loadRenderExecutionGatesStore();
  return store.gates.find(g => g.gate_id === gate_id) || null;
}

// Create manual export bundle from gate
export function createManualExportBundleFromGate(input: {
  gate: RenderExecutionGate;
  plan: RenderPlan;
  dryRun: true;
}): ManualExportBundle {
  if (!input.dryRun) {
    throw new Error("VO-3E bundles only support dryRun=true");
  }
  if (!input.gate.dry_run) {
    throw new Error("VO-3E bundles require gate.dry_run=true");
  }
  if (!input.plan.dry_run) {
    throw new Error("VO-3E bundles require plan.dry_run=true");
  }

  const bundle_id = `manual-export-bundle-${crypto.randomBytes(6).toString("hex")}`;
  const bundle_state: ManualExportBundleState =
    input.gate.gate_state === "blocked" ? "blocked" : "ready_for_operator_review";

  const planned_outputs: PlannedOutputSummary[] = input.plan.render_targets.map((target, idx) => ({
    output_kind: target.kind,
    format_key: target.format_key,
    expected_relative_path_summary: `[output-${idx + 1}]`,
    required: target.kind === "video" || target.kind === "thumbnail",
  }));

  const by_kind: Record<string, number> = {};
  for (const target of input.plan.render_targets) {
    by_kind[target.kind] = (by_kind[target.kind] || 0) + 1;
  }

  return {
    schema_version: "1.0",
    bundle_id,
    gate_id: input.gate.gate_id,
    render_plan_id: input.plan.render_plan_id,
    package_id: input.plan.package_id,
    project_id: input.plan.project_id,
    platform: input.plan.platform,
    dry_run: true,
    bundle_state,
    created_at: new Date().toISOString(),
    manifest_summary: {
      total_outputs: input.plan.render_targets.length,
      by_kind,
    },
    operator_checklist: [
      "Review render plan validation results",
      "Verify all required output formats present",
      "Check file paths are safe and relative",
      "Confirm platform compatibility",
      "Approve or reject for manual rendering",
    ],
    planned_outputs,
    validation: {
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: input.gate.blocking_reasons,
      warnings: input.gate.warnings,
    },
    provenance: {
      generated_by: "createManualExportBundleFromGate",
      source_gate_id: input.gate.gate_id,
      checksum: `sha256:${crypto.randomBytes(16).toString("hex")}`,
    },
  };
}

interface ManualExportBundlesStore {
  schema_version: "1.0";
  created_at: string;
  bundles: ManualExportBundle[];
}

function loadManualExportBundlesStore(): ManualExportBundlesStore {
  const storePath = getManualExportBundlesPath();
  if (fs.existsSync(storePath)) {
    try {
      return JSON.parse(fs.readFileSync(storePath, "utf8")) as ManualExportBundlesStore;
    } catch {
      // corrupt or invalid, start fresh
    }
  }
  return {
    schema_version: "1.0",
    created_at: new Date().toISOString(),
    bundles: [],
  };
}

function saveManualExportBundlesStore(store: ManualExportBundlesStore): void {
  const storePath = getManualExportBundlesPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function saveManualExportBundle(bundle: ManualExportBundle): void {
  if (!bundle.dry_run) {
    throw new Error("VO-3E bundles only support dry_run=true");
  }
  if (bundle.validation.ready_for_render !== false) {
    throw new Error("VO-3E bundles require ready_for_render=false");
  }
  if (bundle.validation.ready_for_upload !== false) {
    throw new Error("VO-3E bundles require ready_for_upload=false");
  }

  const store = loadManualExportBundlesStore();
  const idx = store.bundles.findIndex(b => b.bundle_id === bundle.bundle_id);
  if (idx >= 0) {
    store.bundles[idx] = bundle;
  } else {
    store.bundles.push(bundle);
  }
  store.bundles.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.bundle_id.localeCompare(b.bundle_id));
  saveManualExportBundlesStore(store);
}

export function listManualExportBundles(options?: {
  project_id?: string;
  platform?: string;
  bundle_state?: string;
}): ManualExportBundle[] {
  const store = loadManualExportBundlesStore();
  return store.bundles.filter(b => {
    if (options?.project_id && b.project_id !== options.project_id) return false;
    if (options?.platform && b.platform !== options.platform) return false;
    if (options?.bundle_state && b.bundle_state !== options.bundle_state) return false;
    return true;
  });
}

export function getManualExportBundle(bundle_id: string): ManualExportBundle | null {
  const store = loadManualExportBundlesStore();
  return store.bundles.find(b => b.bundle_id === bundle_id) || null;
}

// Reports
export function getRenderExecutionGateReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  needs_operator_approval: number;
  approved_for_manual_render: number;
  rejected: number;
  gates: Array<{
    gate_id: string;
    render_plan_id: string;
    project_id: string;
    platform: string;
    gate_state: string;
    blocking_reasons_count: number;
    warnings_count: number;
  }>;
} {
  const gates = listRenderExecutionGates(options);
  const by_state: Record<string, number> = {};
  for (const gate of gates) {
    by_state[gate.gate_state] = (by_state[gate.gate_state] || 0) + 1;
  }

  return {
    total: gates.length,
    by_state,
    blocked: by_state.blocked || 0,
    needs_operator_approval: by_state.needs_operator_approval || 0,
    approved_for_manual_render: by_state.approved_for_manual_render || 0,
    rejected: by_state.rejected || 0,
    gates: gates.map(g => ({
      gate_id: g.gate_id,
      render_plan_id: sanitizeRenderPlanString(g.render_plan_id, "[unsafe-plan]"),
      project_id: sanitizeRenderPlanString(g.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(g.platform, "[unsafe-platform]"),
      gate_state: g.gate_state,
      blocking_reasons_count: g.blocking_reasons.length,
      warnings_count: g.warnings.length,
    })),
  };
}

export function getManualExportBundleReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  ready_for_render: 0;
  ready_for_upload: 0;
  bundles: Array<{
    bundle_id: string;
    render_plan_id: string;
    project_id: string;
    platform: string;
    bundle_state: string;
    blocking_reasons_count: number;
    warnings_count: number;
  }>;
} {
  const bundles = listManualExportBundles(options);
  const by_state: Record<string, number> = {};
  for (const bundle of bundles) {
    by_state[bundle.bundle_state] = (by_state[bundle.bundle_state] || 0) + 1;
  }

  return {
    total: bundles.length,
    by_state,
    blocked: by_state.blocked || 0,
    ready_for_operator_review: by_state.ready_for_operator_review || 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    bundles: bundles.map(b => ({
      bundle_id: b.bundle_id,
      render_plan_id: sanitizeRenderPlanString(b.render_plan_id, "[unsafe-plan]"),
      project_id: sanitizeRenderPlanString(b.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(b.platform, "[unsafe-platform]"),
      bundle_state: b.bundle_state,
      blocking_reasons_count: b.validation.blocking_reasons.length,
      warnings_count: b.validation.warnings.length,
    })),
  };
}

// ─── VO-3F: Operator Approval Records and Render-Readiness Freeze ──────────

export type OperatorApprovalState =
  | "draft"
  | "approved_for_manual_render"
  | "rejected"
  | "revoked";

export interface OperatorReviewSummary {
  reviewed_by_label: string;
  reviewed_at: string | undefined;
  decision_note: string | null;
  checklist_acknowledged: boolean;
  risk_acknowledgement: boolean;
}

export interface RenderReadinessFreezeSnapshot {
  frozen_at: string;
  source_gate_id: string;
  source_bundle_id: string;
  source_render_plan_id: string;
  manifest_checksum: string;
  freeze_reason: string;
  immutable_summary?: Record<string, unknown>;
}

export interface OperatorApprovalRecord {
  schema_version: "1.0";
  approval_id: string;
  gate_id: string;
  bundle_id: string;
  render_plan_id: string;
  package_id: string;
  project_id: string;
  platform: string;
  approval_state: OperatorApprovalState;
  dry_run: true;
  created_at: string;
  operator_review: OperatorReviewSummary;
  freeze_snapshot: RenderReadinessFreezeSnapshot;
  validation: {
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: string;
    source_gate_id: string;
    source_bundle_id: string;
  };
}

export interface OperatorApprovalValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

interface OperatorApprovalRecordsStore {
  records: OperatorApprovalRecord[];
}

function getOperatorApprovalRecordsPath(): string {
  return path.join(getRuntimeDir(), "operator-approval-records.json");
}

function loadOperatorApprovalRecordsStore(): OperatorApprovalRecordsStore {
  const storePath = getOperatorApprovalRecordsPath();
  if (!fs.existsSync(storePath)) {
    return { records: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    return { records: [] };
  }
}

function saveOperatorApprovalRecordsStore(store: OperatorApprovalRecordsStore): void {
  const storePath = getOperatorApprovalRecordsPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function buildRenderReadinessFreezeSnapshot(input: {
  gate: RenderExecutionGate;
  bundle: ManualExportBundle;
}): RenderReadinessFreezeSnapshot {
  const { gate, bundle } = input;

  // Build deterministic checksum from safe summary fields only
  const summaryData = {
    gate_id: gate.gate_id,
    bundle_id: bundle.bundle_id,
    render_plan_id: gate.render_plan_id,
    package_id: gate.package_id,
    project_id: gate.project_id,
    platform: gate.platform,
    manifest_total_outputs: bundle.manifest_summary.total_outputs,
    manifest_by_kind: bundle.manifest_summary.by_kind,
    created_at: new Date().toISOString(),
  };

  const summaryStr = JSON.stringify(summaryData);
  const checksum = `sha256:${crypto
    .createHash("sha256")
    .update(summaryStr)
    .digest("hex")}`;

  return {
    frozen_at: new Date().toISOString(),
    source_gate_id: gate.gate_id,
    source_bundle_id: bundle.bundle_id,
    source_render_plan_id: gate.render_plan_id,
    manifest_checksum: checksum,
    freeze_reason: "operator_approval",
    immutable_summary: {
      total_outputs: bundle.manifest_summary.total_outputs,
      by_kind: bundle.manifest_summary.by_kind,
      platform: gate.platform,
      project_id: gate.project_id,
    },
  };
}

function sanitizeApprovalLabel(label: string): string | null {
  // Allow only safe labels: alphanumeric, underscore, hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) {
    return null;
  }
  return label;
}

function sanitizeDecisionNote(note: string): string | null {
  // Reject notes that contain forbidden patterns or raw paths
  const forbiddenPatterns = [
    "credential_reference",
    "keychain://",
    "access_token",
    "refresh_token",
    "client_secret",
    "/Volumes/",
    "~/.ssh/",
    ".env",
  ];

  if (forbiddenPatterns.some(pattern => note.includes(pattern))) {
    return null;
  }

  // Reject if looks like a full path
  if (note.includes("/") && note.length > 50) {
    return null;
  }

  return note;
}

export function createOperatorApprovalRecord(input: {
  gate: RenderExecutionGate;
  bundle: ManualExportBundle;
  decision: "draft" | "approved_for_manual_render" | "rejected";
  reviewed_by_label?: string;
  decision_note?: string;
  checklist_acknowledged?: boolean;
  risk_acknowledgement?: boolean;
  dryRun: true;
}): OperatorApprovalRecord {
  if (!input.dryRun) {
    throw new Error("VO-3F approval records only support dryRun=true");
  }

  if (!input.gate.dry_run) {
    throw new Error("Gate must have dry_run=true");
  }

  if (!input.bundle.dry_run) {
    throw new Error("Bundle must have dry_run=true");
  }

  if (input.gate.gate_id !== input.bundle.gate_id) {
    throw new Error("Gate ID mismatch between gate and bundle");
  }

  if (input.gate.render_plan_id !== input.bundle.render_plan_id) {
    throw new Error("Render plan ID mismatch between gate and bundle");
  }

  if (input.gate.package_id !== input.bundle.package_id) {
    throw new Error("Package ID mismatch between gate and bundle");
  }

  // Validate decision state transitions
  if (input.decision === "approved_for_manual_render") {
    if (input.gate.gate_state !== "needs_operator_approval") {
      throw new Error("Gate must be in needs_operator_approval state for approval");
    }
    if (input.bundle.bundle_state !== "ready_for_operator_review") {
      throw new Error("Bundle must be in ready_for_operator_review state for approval");
    }
    if (!input.checklist_acknowledged) {
      throw new Error("Approval requires checklist_acknowledged=true");
    }
    if (!input.risk_acknowledgement) {
      throw new Error("Approval requires risk_acknowledgement=true");
    }
  }

  // Sanitize decision note
  let decision_note = input.decision_note || null;
  if (decision_note) {
    const sanitized = sanitizeDecisionNote(decision_note);
    if (!sanitized) {
      throw new Error("Decision note contains forbidden patterns or unsafe content");
    }
    decision_note = sanitized;
  }

  // Sanitize label
  let reviewed_by_label = input.reviewed_by_label || "operator";
  const sanitized_label = sanitizeApprovalLabel(reviewed_by_label);
  if (!sanitized_label) {
    throw new Error("Reviewed by label contains unsafe characters");
  }
  reviewed_by_label = sanitized_label;

  const approval_id = `approval-${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();

  const freeze_snapshot = buildRenderReadinessFreezeSnapshot({
    gate: input.gate,
    bundle: input.bundle,
  });

  return {
    schema_version: "1.0",
    approval_id,
    gate_id: input.gate.gate_id,
    bundle_id: input.bundle.bundle_id,
    render_plan_id: input.gate.render_plan_id,
    package_id: input.gate.package_id,
    project_id: input.gate.project_id,
    platform: input.gate.platform,
    approval_state: input.decision,
    dry_run: true,
    created_at: now,
    operator_review: {
      reviewed_by_label,
      reviewed_at: input.decision !== "draft" ? now : undefined,
      decision_note,
      checklist_acknowledged: input.checklist_acknowledged || false,
      risk_acknowledgement: input.risk_acknowledgement || false,
    },
    freeze_snapshot,
    validation: {
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: {
      generated_by: "createOperatorApprovalRecord",
      source_gate_id: input.gate.gate_id,
      source_bundle_id: input.bundle.bundle_id,
    },
  };
}

export function validateOperatorApprovalRecord(
  record: unknown
): OperatorApprovalValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];

  if (typeof record !== "object" || record === null) {
    blocking_reasons.push("Record must be an object");
    return { ok: false, blocking_reasons, warnings };
  }

  const r = record as Record<string, unknown>;

  // Check required fields
  const requiredFields = [
    "schema_version",
    "approval_id",
    "gate_id",
    "bundle_id",
    "render_plan_id",
    "package_id",
    "project_id",
    "platform",
    "approval_state",
    "dry_run",
    "created_at",
    "operator_review",
    "freeze_snapshot",
    "validation",
    "provenance",
  ];

  for (const field of requiredFields) {
    if (!(field in r)) {
      blocking_reasons.push(`Missing required field: ${field}`);
    }
  }

  // Check dry_run
  if (r.dry_run !== true) {
    blocking_reasons.push("dry_run must be true");
  }

  // Check approval_state
  const validStates = [
    "draft",
    "approved_for_manual_render",
    "rejected",
    "revoked",
  ];
  if (!validStates.includes(r.approval_state as string)) {
    blocking_reasons.push(
      `approval_state must be one of: ${validStates.join(", ")}`
    );
  }

  // Check validation flags
  const validation = r.validation as Record<string, unknown>;
  if (validation) {
    if (validation.ready_for_render !== false) {
      blocking_reasons.push("validation.ready_for_render must be false");
    }
    if (validation.ready_for_upload !== false) {
      blocking_reasons.push("validation.ready_for_upload must be false");
    }
  }

  // Scan for forbidden patterns recursively
  const forbiddenPatterns = [
    "credential_reference",
    "keychain://",
    "access_token",
    "refresh_token",
    "client_secret",
  ];

  function checkForForbidden(obj: unknown, path: string = ""): void {
    if (typeof obj === "string") {
      for (const pattern of forbiddenPatterns) {
        if (obj.includes(pattern)) {
          blocking_reasons.push(`Forbidden pattern found in ${path || "value"}`);
          return;
        }
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        // Check key
        for (const pattern of forbiddenPatterns) {
          if (key.includes(pattern)) {
            blocking_reasons.push(`Forbidden pattern in key: ${path}.${key}`);
            return;
          }
        }
        checkForForbidden(value, `${path}.${key}`);
      }
    }
  }

  checkForForbidden(record);

  // Check for execution command patterns
  const recordStr = JSON.stringify(record);
  if (
    recordStr.includes("videos.insert") ||
    recordStr.includes("youtube.videos") ||
    recordStr.includes("ffmpeg") ||
    recordStr.includes("child_process")
  ) {
    blocking_reasons.push("Record contains execution command patterns");
  }

  return {
    ok: blocking_reasons.length === 0,
    blocking_reasons,
    warnings,
  };
}

export function saveOperatorApprovalRecord(record: OperatorApprovalRecord): void {
  if (!record.dry_run) {
    throw new Error("VO-3F records only support dry_run=true");
  }

  if (record.validation.ready_for_render !== false) {
    throw new Error("Cannot save approval record with ready_for_render=true");
  }

  if (record.validation.ready_for_upload !== false) {
    throw new Error("Cannot save approval record with ready_for_upload=true");
  }

  const validation = validateOperatorApprovalRecord(record);
  if (!validation.ok) {
    throw new Error(
      `Cannot save invalid approval record: ${validation.blocking_reasons[0]}`
    );
  }

  const store = loadOperatorApprovalRecordsStore();

  // Upsert by approval_id
  const existingIndex = store.records.findIndex(
    r => r.approval_id === record.approval_id
  );
  if (existingIndex >= 0) {
    store.records[existingIndex] = record;
  } else {
    store.records.push(record);
  }

  // Sort by created_at then approval_id
  store.records.sort((a, b) => {
    const dateCompare = a.created_at.localeCompare(b.created_at);
    if (dateCompare !== 0) return dateCompare;
    return a.approval_id.localeCompare(b.approval_id);
  });

  saveOperatorApprovalRecordsStore(store);
}

export function listOperatorApprovalRecords(options?: {
  project_id?: string;
  platform?: string;
  approval_state?: string;
  gate_id?: string;
  bundle_id?: string;
}): OperatorApprovalRecord[] {
  const store = loadOperatorApprovalRecordsStore();

  return store.records.filter(record => {
    if (options?.project_id && record.project_id !== options.project_id) {
      return false;
    }
    if (options?.platform && record.platform !== options.platform) {
      return false;
    }
    if (
      options?.approval_state &&
      record.approval_state !== options.approval_state
    ) {
      return false;
    }
    if (options?.gate_id && record.gate_id !== options.gate_id) {
      return false;
    }
    if (options?.bundle_id && record.bundle_id !== options.bundle_id) {
      return false;
    }
    return true;
  });
}

export function getOperatorApprovalRecord(
  approval_id: string
): OperatorApprovalRecord | null {
  const store = loadOperatorApprovalRecordsStore();
  return store.records.find(r => r.approval_id === approval_id) || null;
}

export function revokeOperatorApprovalRecord(
  approval_id: string,
  reason: string
): OperatorApprovalRecord {
  const record = getOperatorApprovalRecord(approval_id);
  if (!record) {
    throw new Error(`Approval record not found: ${approval_id}`);
  }

  // Sanitize reason
  const sanitized_reason = sanitizeDecisionNote(reason);
  if (!sanitized_reason) {
    throw new Error("Revocation reason contains forbidden patterns or unsafe content");
  }

  record.approval_state = "revoked";
  record.operator_review.decision_note =
    `Revoked: ${sanitized_reason}`;

  saveOperatorApprovalRecord(record);
  return record;
}

export function getOperatorApprovalReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  draft: number;
  approved_for_manual_render: number;
  rejected: number;
  revoked: number;
  ready_for_render: 0;
  ready_for_upload: 0;
  approvals: Array<{
    approval_id: string;
    gate_id: string;
    bundle_id: string;
    render_plan_id: string;
    project_id: string;
    platform: string;
    approval_state: string;
    created_at: string;
    manifest_checksum_summary: string;
  }>;
} {
  const approvals = listOperatorApprovalRecords(options);
  const by_state: Record<string, number> = {};

  for (const approval of approvals) {
    by_state[approval.approval_state] =
      (by_state[approval.approval_state] || 0) + 1;
  }

  return {
    total: approvals.length,
    by_state,
    draft: by_state.draft || 0,
    approved_for_manual_render: by_state.approved_for_manual_render || 0,
    rejected: by_state.rejected || 0,
    revoked: by_state.revoked || 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    approvals: approvals.map(a => ({
      approval_id: sanitizeRenderPlanString(a.approval_id, "[unsafe-id]"),
      gate_id: sanitizeRenderPlanString(a.gate_id, "[unsafe-gate]"),
      bundle_id: sanitizeRenderPlanString(a.bundle_id, "[unsafe-bundle]"),
      render_plan_id: sanitizeRenderPlanString(
        a.render_plan_id,
        "[unsafe-plan]"
      ),
      project_id: sanitizeRenderPlanString(a.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(a.platform, "[unsafe-platform]"),
      approval_state: a.approval_state,
      created_at: a.created_at,
      manifest_checksum_summary: a.freeze_snapshot.manifest_checksum.substring(
        0,
        15
      ),
    })),
  };
}

// ─── VO-4A: Render Executor Contract and Dry-Run Render Command Manifest ────

export type RenderCommandManifestState = "draft" | "blocked" | "ready_for_operator_review";

export type RenderExecutorKind = "ffmpeg" | "local_renderer" | "manual_renderer" | "placeholder";

export interface RenderCommandSummary {
  command_id: string;
  purpose: string;
  tool_label: "ffmpeg" | "imagemagick" | "custom";
  input_summary: string;
  output_summary: string;
  arguments_summary: string;
  disabled: true;
}

export interface RenderCommandManifest {
  schema_version: "1.0";
  command_manifest_id: string;
  approval_id: string;
  gate_id: string;
  bundle_id: string;
  render_plan_id: string;
  package_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  command_state: RenderCommandManifestState;
  created_at: string;
  executor: {
    executor_id: string;
    executor_kind: RenderExecutorKind;
    execution_enabled: false;
    requires_explicit_operator_run: true;
  };
  command_plan: {
    commands: RenderCommandSummary[];
    command_count: number;
    contains_shell: false;
    execution_mode: "disabled";
  };
  planned_outputs: {
    output_count: number;
    by_kind: Record<string, number>;
    platform: string;
    project_id: string;
  };
  validation: {
    ready_for_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRenderCommandManifest";
    source_approval_id: string;
    source_gate_id: string;
    source_bundle_id: string;
  };
}

export interface RenderCommandManifestValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

// ─── VO-4B: Renderer Preflight Environment Checks ─────────────────────────

export type RendererPreflightState = "draft" | "blocked" | "checked";

export interface RendererToolCheck {
  tool_label: "ffmpeg" | "imagemagick" | "placeholder";
  expected_tool_kind: RenderExecutorKind;
  check_mode: "declared_only";
  declared_available: boolean;
  executable_invoked: false;
  version_checked: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RendererPreflight {
  schema_version: "1.0";
  preflight_id: string;
  command_manifest_id: string;
  approval_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  preflight_state: RendererPreflightState;
  created_at: string;
  tool_checks: RendererToolCheck[];
  validation: {
    ready_for_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRendererPreflight";
    source_manifest_id: string;
    source_approval_id: string;
  };
}

export interface RendererPreflightValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

interface RenderCommandManifestsStore {
  manifests: RenderCommandManifest[];
}

interface RendererPreflightsStore {
  preflights: RendererPreflight[];
}

function getRenderCommandManifestsPath(): string {
  return path.join(getRuntimeDir(), "render-command-manifests.json");
}

function loadRenderCommandManifestsStore(): RenderCommandManifestsStore {
  const storePath = getRenderCommandManifestsPath();
  if (!fs.existsSync(storePath)) {
    return { manifests: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    return { manifests: [] };
  }
}

function saveRenderCommandManifestsStore(store: RenderCommandManifestsStore): void {
  const storePath = getRenderCommandManifestsPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function createRenderCommandManifest(input: {
  approval: OperatorApprovalRecord;
  gate: RenderExecutionGate;
  bundle: ManualExportBundle;
  plan: RenderPlan;
  dryRun: true;
}): RenderCommandManifest {
  const { approval, gate, bundle, plan } = input;

  // All inputs must have dry_run=true
  if (!approval.dry_run || !gate.dry_run || !bundle.dry_run || !plan.dry_run) {
    throw new Error("createRenderCommandManifest: all inputs must have dry_run=true");
  }

  // Approval must be approved_for_manual_render
  if (approval.approval_state !== "approved_for_manual_render") {
    throw new Error(`createRenderCommandManifest: approval_state must be approved_for_manual_render, got ${approval.approval_state}`);
  }

  // IDs must match across approval/gate/bundle/plan
  if (
    approval.gate_id !== gate.gate_id ||
    approval.bundle_id !== bundle.bundle_id ||
    approval.render_plan_id !== plan.render_plan_id ||
    approval.package_id !== gate.package_id
  ) {
    throw new Error("createRenderCommandManifest: ID mismatch across approval/gate/bundle/plan");
  }

  // Safe command summaries only (no raw commands, no paths, no shell syntax)
  const commands: RenderCommandSummary[] = [
    {
      command_id: "cmd-compose",
      purpose: "Compose video assets and apply format constraints",
      tool_label: "custom",
      input_summary: "Media assets and format specification",
      output_summary: "Video in target format",
      arguments_summary: `codec=h264, bitrate=5000k, dimensions=${plan.render_targets[0]?.resolution || "1920x1080"}`,
      disabled: true,
    },
    {
      command_id: "cmd-encode",
      purpose: "Encode for platform delivery",
      tool_label: "ffmpeg",
      input_summary: "Composed video in working format",
      output_summary: "Deliverable video in platform-native format",
      arguments_summary: "preset=medium, crf=28, audio_bitrate=128k",
      disabled: true,
    },
  ];

  const outputsByKind: Record<string, number> = {
    video: 1,
  };

  const manifest: RenderCommandManifest = {
    schema_version: "1.0",
    command_manifest_id: `rcm-${crypto.randomBytes(8).toString("hex")}`,
    approval_id: approval.approval_id,
    gate_id: gate.gate_id,
    bundle_id: bundle.bundle_id,
    render_plan_id: plan.render_plan_id,
    package_id: gate.package_id,
    project_id: gate.project_id,
    platform: gate.platform,
    dry_run: true,
    command_state: "draft",
    created_at: new Date().toISOString(),
    executor: {
      executor_id: "executor-placeholder",
      executor_kind: "placeholder",
      execution_enabled: false,
      requires_explicit_operator_run: true,
    },
    command_plan: {
      commands,
      command_count: commands.length,
      contains_shell: false,
      execution_mode: "disabled",
    },
    planned_outputs: {
      output_count: 1,
      by_kind: outputsByKind,
      platform: gate.platform,
      project_id: gate.project_id,
    },
    validation: {
      ready_for_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: {
      generated_by: "createRenderCommandManifest",
      source_approval_id: approval.approval_id,
      source_gate_id: gate.gate_id,
      source_bundle_id: bundle.bundle_id,
    },
  };

  // Validate before returning
  const validation = validateRenderCommandManifest(manifest);
  if (!validation.ok) {
    manifest.command_state = "blocked";
    manifest.validation.blocking_reasons = validation.blocking_reasons;
    manifest.validation.warnings = validation.warnings;
  }

  return manifest;
}

export function validateRenderCommandManifest(manifest: unknown): RenderCommandManifestValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (typeof manifest !== "object" || manifest === null) {
    blockingReasons.push("Manifest is not an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (m.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }

  if (m.executor && typeof m.executor === "object") {
    const exec = m.executor as Record<string, unknown>;
    if (exec.execution_enabled !== false) {
      blockingReasons.push("executor.execution_enabled must be false");
    }
    if (exec.requires_explicit_operator_run !== true) {
      blockingReasons.push("executor.requires_explicit_operator_run must be true");
    }
  }

  if (m.command_plan && typeof m.command_plan === "object") {
    const plan = m.command_plan as Record<string, unknown>;
    if (plan.execution_mode !== "disabled") {
      blockingReasons.push("command_plan.execution_mode must be disabled");
    }
    if (plan.contains_shell !== false) {
      blockingReasons.push("command_plan.contains_shell must be false");
    }

    if (Array.isArray(plan.commands)) {
      for (const cmd of plan.commands) {
        if (typeof cmd === "object" && cmd !== null) {
          const c = cmd as Record<string, unknown>;
          if (c.disabled !== true) {
            blockingReasons.push("All commands must have disabled=true");
          }
        }
      }
    }
  }

  if (m.validation && typeof m.validation === "object") {
    const val = m.validation as Record<string, unknown>;
    if (val.ready_for_execution !== false) {
      blockingReasons.push("validation.ready_for_execution must be false");
    }
    if (val.ready_for_render !== false) {
      blockingReasons.push("validation.ready_for_render must be false");
    }
    if (val.ready_for_upload !== false) {
      blockingReasons.push("validation.ready_for_upload must be false");
    }
  }

  // Check for forbidden patterns without echoing them
  const manifestStr = JSON.stringify(manifest);
  const forbiddenPatterns = [
    "keychain://",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
    "credential_reference",
    "credentialReference",
  ];

  for (const pattern of forbiddenPatterns) {
    if (manifestStr.includes(pattern)) {
      blockingReasons.push("Manifest contains forbidden credential pattern");
      break;
    }
  }

  // Check for execution signatures, not tool declarations. Tool names (like "ffmpeg")
  // can appear in disabled command summaries. What we forbid is actual execution:
  // - API calls (videos.insert)
  // - Node.js execution (child_process)
  // - Actual command strings (would need to be in raw form, not in safe summaries)
  if (
    manifestStr.includes("videos.insert") ||
    manifestStr.includes("youtube.videos") ||
    manifestStr.includes("child_process")
  ) {
    blockingReasons.push("Manifest contains execution command patterns");
  }

  return {
    ok: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

export function saveRenderCommandManifest(manifest: RenderCommandManifest): void {
  if (manifest.dry_run !== true) {
    throw new Error("Cannot save render command manifest with dry_run=false");
  }

  if (manifest.executor.execution_enabled !== false) {
    throw new Error("Cannot save render command manifest with execution_enabled=true");
  }

  if (manifest.validation.ready_for_execution !== false) {
    throw new Error("Cannot save manifest with ready_for_execution=true");
  }

  if (manifest.validation.ready_for_render !== false) {
    throw new Error("Cannot save manifest with ready_for_render=true");
  }

  if (manifest.validation.ready_for_upload !== false) {
    throw new Error("Cannot save manifest with ready_for_upload=true");
  }

  const validation = validateRenderCommandManifest(manifest);
  if (!validation.ok) {
    throw new Error(`Cannot save invalid manifest: ${validation.blocking_reasons[0]}`);
  }

  const store = loadRenderCommandManifestsStore();
  const idx = store.manifests.findIndex((m) => m.command_manifest_id === manifest.command_manifest_id);

  if (idx >= 0) {
    store.manifests[idx] = manifest;
  } else {
    store.manifests.push(manifest);
  }

  // Sort by created_at then command_manifest_id
  store.manifests.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.command_manifest_id.localeCompare(b.command_manifest_id);
  });

  saveRenderCommandManifestsStore(store);
}

export function listRenderCommandManifests(options?: {
  project_id?: string;
  platform?: string;
  command_state?: string;
  approval_id?: string;
}): RenderCommandManifest[] {
  const store = loadRenderCommandManifestsStore();
  let result = [...store.manifests];

  if (options?.project_id) {
    result = result.filter((m) => m.project_id === options.project_id);
  }

  if (options?.platform) {
    result = result.filter((m) => m.platform === options.platform);
  }

  if (options?.command_state) {
    result = result.filter((m) => m.command_state === options.command_state);
  }

  if (options?.approval_id) {
    result = result.filter((m) => m.approval_id === options.approval_id);
  }

  return result;
}

export function getRenderCommandManifest(command_manifest_id: string): RenderCommandManifest | null {
  const store = loadRenderCommandManifestsStore();
  return store.manifests.find((m) => m.command_manifest_id === command_manifest_id) || null;
}

export function getRenderCommandManifestReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  ready_for_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  manifests: Array<{
    command_manifest_id: string;
    approval_id: string;
    platform: string;
    project_id: string;
    command_state: string;
    command_count: number;
  }>;
} {
  const manifests = listRenderCommandManifests(options);
  const byState: Record<string, number> = {};

  for (const m of manifests) {
    byState[m.command_state] = (byState[m.command_state] || 0) + 1;
  }

  return {
    total: manifests.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    ready_for_operator_review: byState.ready_for_operator_review || 0,
    ready_for_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    manifests: manifests.map((m) => ({
      command_manifest_id: sanitizeRenderPlanString(m.command_manifest_id, "[unsafe-id]"),
      approval_id: sanitizeRenderPlanString(m.approval_id, "[unsafe-approval]"),
      platform: sanitizeRenderPlanString(m.platform, "[unsafe-platform]"),
      project_id: sanitizeRenderPlanString(m.project_id, "[unsafe-project]"),
      command_state: m.command_state,
      command_count: m.command_plan.command_count,
    })),
  };
}

// ─── VO-4B: Renderer Preflight Functions ──────────────────────────────────

function getRendererPreflightsPath(): string {
  return path.join(getRuntimeDir(), "renderer-preflights.json");
}

function loadRendererPreflightsStore(): RendererPreflightsStore {
  const storePath = getRendererPreflightsPath();
  if (!fs.existsSync(storePath)) {
    return { preflights: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn("Failed to parse renderer preflights store:", err);
    return { preflights: [] };
  }
}

function saveRendererPreflightsStore(store: RendererPreflightsStore): void {
  const storePath = getRendererPreflightsPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function createRendererPreflight(input: {
  manifest: RenderCommandManifest;
  dryRun: true;
  checkMode: "declared_only";
}): RendererPreflight {
  if (!input.dryRun) {
    throw new Error("Renderer preflight only supports dryRun=true");
  }

  if (input.checkMode !== "declared_only") {
    throw new Error("Renderer preflight only supports checkMode=declared_only");
  }

  if (!input.manifest.dry_run) {
    throw new Error("Manifest must have dry_run=true");
  }

  if (input.manifest.executor.execution_enabled !== false) {
    throw new Error("Manifest executor.execution_enabled must be false");
  }

  if (input.manifest.command_plan.execution_mode !== "disabled") {
    throw new Error("Manifest command_plan.execution_mode must be disabled");
  }

  // Validate manifest first
  const manifestValidation = validateRenderCommandManifest(input.manifest);
  const preflight_state = manifestValidation.ok ? "checked" : "blocked";

  // Extract tool checks from command summaries (declared_only mode)
  const toolChecks: RendererToolCheck[] = [];
  const seenTools = new Set<string>();

  // Check command executor
  const executorToolLabel = input.manifest.executor.executor_kind === "ffmpeg"
    ? "ffmpeg"
    : input.manifest.executor.executor_kind === "placeholder"
    ? "placeholder"
    : "ffmpeg";

  if (!seenTools.has(executorToolLabel)) {
    toolChecks.push({
      tool_label: executorToolLabel as "ffmpeg" | "imagemagick" | "placeholder",
      expected_tool_kind: input.manifest.executor.executor_kind,
      check_mode: "declared_only",
      declared_available: input.manifest.executor.executor_kind !== "placeholder",
      executable_invoked: false,
      version_checked: false,
      blocking_reasons: [],
      warnings: [],
    });
    seenTools.add(executorToolLabel);
  }

  // Extract tool labels from command summaries
  for (const cmd of input.manifest.command_plan.commands) {
    if (!seenTools.has(cmd.tool_label)) {
      const toolLabel = (cmd.tool_label === "custom" ? "placeholder" : cmd.tool_label) as "ffmpeg" | "imagemagick" | "placeholder";
      const expectedKind: RenderExecutorKind = cmd.tool_label === "ffmpeg" ? "ffmpeg" : cmd.tool_label === "imagemagick" ? "local_renderer" : "placeholder";
      toolChecks.push({
        tool_label: toolLabel,
        expected_tool_kind: expectedKind,
        check_mode: "declared_only",
        declared_available: cmd.tool_label !== "custom",
        executable_invoked: false,
        version_checked: false,
        blocking_reasons: [],
        warnings: [],
      });
      seenTools.add(cmd.tool_label);
    }
  }

  const preflight_id = `preflight-${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();

  const preflight: RendererPreflight = {
    schema_version: "1.0",
    preflight_id,
    command_manifest_id: input.manifest.command_manifest_id,
    approval_id: input.manifest.approval_id,
    render_plan_id: input.manifest.render_plan_id,
    project_id: input.manifest.project_id,
    platform: input.manifest.platform,
    dry_run: true,
    preflight_state,
    created_at: now,
    tool_checks: toolChecks,
    validation: {
      ready_for_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: manifestValidation.blocking_reasons,
      warnings: manifestValidation.warnings,
    },
    provenance: {
      generated_by: "createRendererPreflight",
      source_manifest_id: input.manifest.command_manifest_id,
      source_approval_id: input.manifest.approval_id,
    },
  };

  // Validate before returning
  const validation = validateRendererPreflight(preflight);
  if (!validation.ok) {
    preflight.validation.blocking_reasons.push(...validation.blocking_reasons);
    preflight.validation.warnings.push(...validation.warnings);
  }

  return preflight;
}

export function validateRendererPreflight(preflight: unknown): RendererPreflightValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (typeof preflight !== "object" || preflight === null) {
    blockingReasons.push("Preflight is not an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const p = preflight as Record<string, unknown>;

  // Required fields
  if (p.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }

  if (p.validation && typeof p.validation === "object") {
    const v = p.validation as Record<string, unknown>;
    if (v.ready_for_execution !== false) {
      blockingReasons.push("validation.ready_for_execution must be false");
    }
    if (v.ready_for_render !== false) {
      blockingReasons.push("validation.ready_for_render must be false");
    }
    if (v.ready_for_upload !== false) {
      blockingReasons.push("validation.ready_for_upload must be false");
    }
  }

  // Verify tool checks have no execution
  if (Array.isArray(p.tool_checks)) {
    for (const check of p.tool_checks) {
      if (typeof check === "object" && check !== null) {
        const tc = check as Record<string, unknown>;
        if (tc.executable_invoked !== false) {
          blockingReasons.push("All tool checks must have executable_invoked=false");
        }
        if (tc.version_checked !== false) {
          blockingReasons.push("All tool checks must have version_checked=false");
        }
      }
    }
  }

  // Note: We do NOT validate blocking_reasons for forbidden patterns.
  // Blocking_reasons are copied from the manifest and may legitimately describe
  // what safety issues were found (e.g., "contains child_process reference").
  // The key validation is on the preflight's structural properties above.

  return {
    ok: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

export function saveRendererPreflight(preflight: RendererPreflight): void {
  const validation = validateRendererPreflight(preflight);
  if (!validation.ok) {
    throw new Error(`Cannot save unsafe preflight: ${validation.blocking_reasons.join("; ")}`);
  }

  if (preflight.dry_run !== true) {
    throw new Error("Preflight must have dry_run=true");
  }

  for (const check of preflight.tool_checks) {
    if (check.executable_invoked !== false) {
      throw new Error("Preflight tool check must have executable_invoked=false");
    }
    if (check.version_checked !== false) {
      throw new Error("Preflight tool check must have version_checked=false");
    }
  }

  if (preflight.validation.ready_for_execution !== false || preflight.validation.ready_for_render !== false || preflight.validation.ready_for_upload !== false) {
    throw new Error("Preflight readiness flags must be false");
  }

  const store = loadRendererPreflightsStore();
  const existingIndex = store.preflights.findIndex((p) => p.preflight_id === preflight.preflight_id);

  if (existingIndex >= 0) {
    store.preflights[existingIndex] = preflight;
  } else {
    store.preflights.push(preflight);
  }

  // Sort by created_at then preflight_id
  store.preflights.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.preflight_id.localeCompare(b.preflight_id);
  });

  saveRendererPreflightsStore(store);
}

export function listRendererPreflights(options?: {
  project_id?: string;
  platform?: string;
  preflight_state?: string;
  command_manifest_id?: string;
}): RendererPreflight[] {
  const store = loadRendererPreflightsStore();
  let result = [...store.preflights];

  if (options?.project_id) {
    result = result.filter((p) => p.project_id === options.project_id);
  }

  if (options?.platform) {
    result = result.filter((p) => p.platform === options.platform);
  }

  if (options?.preflight_state) {
    result = result.filter((p) => p.preflight_state === options.preflight_state);
  }

  if (options?.command_manifest_id) {
    result = result.filter((p) => p.command_manifest_id === options.command_manifest_id);
  }

  return result;
}

export function getRendererPreflight(preflight_id: string): RendererPreflight | null {
  const store = loadRendererPreflightsStore();
  return store.preflights.find((p) => p.preflight_id === preflight_id) || null;
}

export function getRendererPreflightReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  checked: number;
  ready_for_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  preflights: Array<{
    preflight_id: string;
    command_manifest_id: string;
    approval_id: string;
    platform: string;
    project_id: string;
    preflight_state: string;
    tool_count: number;
  }>;
} {
  const preflights = listRendererPreflights(options);
  const byState: Record<string, number> = {};

  for (const p of preflights) {
    byState[p.preflight_state] = (byState[p.preflight_state] || 0) + 1;
  }

  return {
    total: preflights.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    checked: byState.checked || 0,
    ready_for_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    preflights: preflights.map((p) => ({
      preflight_id: sanitizeRenderPlanString(p.preflight_id, "[unsafe-id]"),
      command_manifest_id: sanitizeRenderPlanString(p.command_manifest_id, "[unsafe-id]"),
      approval_id: sanitizeRenderPlanString(p.approval_id, "[unsafe-approval]"),
      platform: sanitizeRenderPlanString(p.platform, "[unsafe-platform]"),
      project_id: sanitizeRenderPlanString(p.project_id, "[unsafe-project]"),
      preflight_state: p.preflight_state,
      tool_count: p.tool_checks.length,
    })),
  };
}

// ─── VO-4C: Renderer Binary Discovery Manifests ────────────────────────────

export type RendererBinaryDiscoveryState = "draft" | "blocked" | "declared";
export type RendererBinaryDiscoveryMode = "declared_only";

export interface RendererBinaryCheck {
  tool_label: string;
  expected_tool_kind: "ffmpeg" | "imagemagick" | "placeholder" | "custom";
  binary_label: string;
  binary_path_summary: string;
  path_checked: false;
  executable_invoked: false;
  version_checked: false;
  declared_available: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RendererBinaryDiscovery {
  schema_version: "1.0";
  discovery_id: string;
  preflight_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  discovery_state: RendererBinaryDiscoveryState;
  created_at: string;
  discovery_mode: RendererBinaryDiscoveryMode;
  binary_checks: RendererBinaryCheck[];
  validation: {
    ready_for_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRendererBinaryDiscovery";
    source_preflight_id: string;
    source_manifest_id: string;
  };
}

export interface RendererBinaryDiscoveryValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

interface RendererBinaryDiscoveriesStore {
  discoveries: RendererBinaryDiscovery[];
}

function getRendererBinaryDiscoveriesPath(): string {
  return path.join(getRuntimeDir(), "renderer-binary-discoveries.json");
}

function loadRendererBinaryDiscoveriesStore(): RendererBinaryDiscoveriesStore {
  const storePath = getRendererBinaryDiscoveriesPath();
  if (!fs.existsSync(storePath)) {
    return { discoveries: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn("Failed to parse renderer binary discoveries store:", err);
    return { discoveries: [] };
  }
}

function saveRendererBinaryDiscoveriesStore(store: RendererBinaryDiscoveriesStore): void {
  const storePath = getRendererBinaryDiscoveriesPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function createRendererBinaryDiscovery(input: {
  preflight: RendererPreflight;
  dryRun: true;
  discoveryMode: "declared_only";
}): RendererBinaryDiscovery {
  if (!input.dryRun) {
    throw new Error("Binary discovery only supports dryRun=true");
  }

  if (input.discoveryMode !== "declared_only") {
    throw new Error("Binary discovery only supports discoveryMode=declared_only");
  }

  if (!input.preflight.dry_run) {
    throw new Error("Preflight must have dry_run=true");
  }

  // Verify all preflight tool checks are safe
  for (const check of input.preflight.tool_checks) {
    if (check.executable_invoked !== false) {
      throw new Error("Preflight tool check must have executable_invoked=false");
    }
    if (check.version_checked !== false) {
      throw new Error("Preflight tool check must have version_checked=false");
    }
  }

  // Derive binary checks from preflight tool labels
  // Map RenderExecutorKind to VO-4C safe subset
  const binaryChecks: RendererBinaryCheck[] = input.preflight.tool_checks.map((tc) => {
    let binaryToolKind: "ffmpeg" | "imagemagick" | "placeholder" | "custom" = "custom";
    if (tc.expected_tool_kind === "ffmpeg") {
      binaryToolKind = "ffmpeg";
    } else if (tc.expected_tool_kind === "local_renderer") {
      binaryToolKind = "imagemagick";
    } else if (tc.expected_tool_kind === "manual_renderer") {
      binaryToolKind = "placeholder";
    }
    return {
      tool_label: tc.tool_label,
      expected_tool_kind: binaryToolKind,
      binary_label: `${tc.tool_label}-binary`,
      binary_path_summary: "[not-checked]",
      path_checked: false,
      executable_invoked: false,
      version_checked: false,
      declared_available: tc.declared_available,
      blocking_reasons: [],
      warnings: [],
    };
  });

  // Validate preflight for blocking reasons
  const preflight_validation = validateRendererPreflight(input.preflight);
  const discovery_state: RendererBinaryDiscoveryState = preflight_validation.ok ? "declared" : "blocked";

  const discovery: RendererBinaryDiscovery = {
    schema_version: "1.0",
    discovery_id: `rbd-${crypto.randomBytes(8).toString("hex")}`,
    preflight_id: input.preflight.preflight_id,
    command_manifest_id: input.preflight.command_manifest_id,
    project_id: input.preflight.project_id,
    platform: input.preflight.platform,
    dry_run: true,
    discovery_state,
    created_at: new Date().toISOString(),
    discovery_mode: "declared_only",
    binary_checks: binaryChecks,
    validation: {
      ready_for_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: preflight_validation.blocking_reasons,
      warnings: preflight_validation.warnings,
    },
    provenance: {
      generated_by: "createRendererBinaryDiscovery",
      source_preflight_id: input.preflight.preflight_id,
      source_manifest_id: input.preflight.command_manifest_id,
    },
  };

  return discovery;
}

export function validateRendererBinaryDiscovery(discovery: unknown): RendererBinaryDiscoveryValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (typeof discovery !== "object" || discovery === null) {
    blockingReasons.push("Discovery must be an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const d = discovery as Record<string, unknown>;

  // Required fields
  if (d.schema_version !== "1.0") {
    blockingReasons.push("schema_version must be '1.0'");
  }
  if (d.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }
  if (d.discovery_mode !== "declared_only") {
    blockingReasons.push("discovery_mode must be 'declared_only'");
  }

  // Validation structure
  if (typeof d.validation !== "object" || d.validation === null) {
    blockingReasons.push("validation is required");
  } else {
    const v = d.validation as Record<string, unknown>;
    if (v.ready_for_execution !== false) {
      blockingReasons.push("validation.ready_for_execution must be false");
    }
    if (v.ready_for_render !== false) {
      blockingReasons.push("validation.ready_for_render must be false");
    }
    if (v.ready_for_upload !== false) {
      blockingReasons.push("validation.ready_for_upload must be false");
    }
  }

  // Binary checks validation
  if (!Array.isArray(d.binary_checks)) {
    blockingReasons.push("binary_checks must be an array");
  } else {
    for (const check of d.binary_checks) {
      if (typeof check !== "object" || check === null) continue;
      const c = check as Record<string, unknown>;
      if (c.path_checked !== false) {
        blockingReasons.push("Binary check must have path_checked=false");
      }
      if (c.executable_invoked !== false) {
        blockingReasons.push("Binary check must have executable_invoked=false");
      }
      if (c.version_checked !== false) {
        blockingReasons.push("Binary check must have version_checked=false");
      }
    }
  }

  // Check for forbidden patterns in the entire structure
  const forbiddenPatternReasons = recursivelyCheckForForbiddenPatterns(d);
  blockingReasons.push(...forbiddenPatternReasons);

  const ok = blockingReasons.length === 0;
  return { ok, blocking_reasons: blockingReasons, warnings };
}

export function saveRendererBinaryDiscovery(discovery: RendererBinaryDiscovery): void {
  if (discovery.dry_run !== true) {
    throw new Error("Cannot save binary discovery with dry_run=false");
  }

  if (discovery.discovery_mode !== "declared_only") {
    throw new Error("Cannot save binary discovery with discovery_mode other than declared_only");
  }

  for (const check of discovery.binary_checks) {
    if (check.path_checked !== false) {
      throw new Error("Cannot save discovery with path_checked=true");
    }
    if (check.executable_invoked !== false) {
      throw new Error("Cannot save discovery with executable_invoked=true");
    }
    if (check.version_checked !== false) {
      throw new Error("Cannot save discovery with version_checked=true");
    }
  }

  if (discovery.validation.ready_for_execution !== false) {
    throw new Error("Cannot save discovery with ready_for_execution=true");
  }
  if (discovery.validation.ready_for_render !== false) {
    throw new Error("Cannot save discovery with ready_for_render=true");
  }
  if (discovery.validation.ready_for_upload !== false) {
    throw new Error("Cannot save discovery with ready_for_upload=true");
  }

  const validation = validateRendererBinaryDiscovery(discovery);
  if (!validation.ok) {
    throw new Error(`Cannot save invalid discovery: ${validation.blocking_reasons[0]}`);
  }

  const store = loadRendererBinaryDiscoveriesStore();
  const idx = store.discoveries.findIndex((d) => d.discovery_id === discovery.discovery_id);

  if (idx >= 0) {
    store.discoveries[idx] = discovery;
  } else {
    store.discoveries.push(discovery);
  }

  // Sort by created_at then discovery_id for stability
  store.discoveries.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.discovery_id.localeCompare(b.discovery_id);
  });

  saveRendererBinaryDiscoveriesStore(store);
}

export function listRendererBinaryDiscoveries(options?: {
  project_id?: string;
  platform?: string;
  discovery_state?: string;
  preflight_id?: string;
  command_manifest_id?: string;
}): RendererBinaryDiscovery[] {
  const store = loadRendererBinaryDiscoveriesStore();
  return store.discoveries.filter((d) => {
    if (options?.project_id && d.project_id !== options.project_id) return false;
    if (options?.platform && d.platform !== options.platform) return false;
    if (options?.discovery_state && d.discovery_state !== options.discovery_state) return false;
    if (options?.preflight_id && d.preflight_id !== options.preflight_id) return false;
    if (options?.command_manifest_id && d.command_manifest_id !== options.command_manifest_id) return false;
    return true;
  });
}

export function getRendererBinaryDiscovery(discovery_id: string): RendererBinaryDiscovery | null {
  const store = loadRendererBinaryDiscoveriesStore();
  return store.discoveries.find((d) => d.discovery_id === discovery_id) || null;
}

export function getRendererBinaryDiscoveryReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  declared: number;
  ready_for_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  discoveries: Array<{
    discovery_id: string;
    preflight_id: string;
    command_manifest_id: string;
    platform: string;
    project_id: string;
    discovery_state: string;
    binary_count: number;
  }>;
} {
  const discoveries = listRendererBinaryDiscoveries(options);
  const byState: Record<string, number> = {};

  for (const d of discoveries) {
    byState[d.discovery_state] = (byState[d.discovery_state] || 0) + 1;
  }

  return {
    total: discoveries.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    declared: byState.declared || 0,
    ready_for_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    discoveries: discoveries.map((d) => ({
      discovery_id: sanitizeRenderPlanString(d.discovery_id, "[unsafe-id]"),
      preflight_id: sanitizeRenderPlanString(d.preflight_id, "[unsafe-id]"),
      command_manifest_id: sanitizeRenderPlanString(d.command_manifest_id, "[unsafe-id]"),
      platform: sanitizeRenderPlanString(d.platform, "[unsafe-platform]"),
      project_id: sanitizeRenderPlanString(d.project_id, "[unsafe-project]"),
      discovery_state: d.discovery_state,
      binary_count: d.binary_checks.length,
    })),
  };
}

// ─── VO-4D: Operator-Approved Renderer Version Check Plan ──────────────────────

export type RendererVersionCheckPlanState = "draft" | "blocked" | "ready_for_operator_review";
export type RendererVersionCheckMode = "planned_only";

export interface RendererVersionPlannedCheck {
  check_id: string;
  tool_label: string;
  expected_tool_kind: "ffmpeg" | "imagemagick" | "placeholder" | "custom";
  binary_label: string;
  planned_version_command_summary: string;
  execution_allowed: false;
  executable_invoked: false;
  version_checked: false;
  process_output_captured: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RendererVersionCheckPlan {
  schema_version: "1.0";
  version_check_plan_id: string;
  discovery_id: string;
  preflight_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  plan_state: RendererVersionCheckPlanState;
  created_at: string;
  approval_required: true;
  check_mode: RendererVersionCheckMode;
  planned_checks: RendererVersionPlannedCheck[];
  validation: {
    ready_for_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRendererVersionCheckPlan";
    source_discovery_id: string;
    source_preflight_id: string;
    source_manifest_id: string;
  };
}

export interface RendererVersionCheckPlanValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

interface RendererVersionCheckPlansStore {
  plans: RendererVersionCheckPlan[];
}

function getRendererVersionCheckPlansPath(): string {
  return path.join(getRuntimeDir(), "renderer-version-check-plans.json");
}

function loadRendererVersionCheckPlansStore(): RendererVersionCheckPlansStore {
  const storePath = getRendererVersionCheckPlansPath();
  if (!fs.existsSync(storePath)) {
    return { plans: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn("Failed to parse renderer version check plans store:", err);
    return { plans: [] };
  }
}

function saveRendererVersionCheckPlansStore(store: RendererVersionCheckPlansStore): void {
  const storePath = getRendererVersionCheckPlansPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function createRendererVersionCheckPlan(input: {
  discovery: RendererBinaryDiscovery;
  dryRun: true;
  checkMode: "planned_only";
}): RendererVersionCheckPlan {
  if (!input.dryRun) {
    throw new Error("Version check plan only supports dryRun=true");
  }

  if (input.checkMode !== "planned_only") {
    throw new Error("Version check plan only supports checkMode=planned_only");
  }

  if (!input.discovery.dry_run) {
    throw new Error("Discovery must have dry_run=true");
  }

  // Verify all binary checks are safe
  for (const check of input.discovery.binary_checks) {
    if (check.path_checked !== false) {
      throw new Error("Binary check must have path_checked=false");
    }
    if (check.executable_invoked !== false) {
      throw new Error("Binary check must have executable_invoked=false");
    }
    if (check.version_checked !== false) {
      throw new Error("Binary check must have version_checked=false");
    }
  }

  // Derive planned checks from binary checks
  const plannedChecks: RendererVersionPlannedCheck[] = input.discovery.binary_checks.map((bc) => ({
    check_id: `check-${crypto.randomBytes(4).toString("hex")}`,
    tool_label: bc.tool_label,
    expected_tool_kind: bc.expected_tool_kind,
    binary_label: bc.binary_label,
    planned_version_command_summary: `[would-run-${bc.expected_tool_kind}-version-if-approved]`,
    execution_allowed: false,
    executable_invoked: false,
    version_checked: false,
    process_output_captured: false,
    blocking_reasons: [],
    warnings: [],
  }));

  // Determine plan state based on discovery validation
  const plan_state: RendererVersionCheckPlanState = input.discovery.validation.blocking_reasons.length === 0
    ? "ready_for_operator_review"
    : "blocked";

  const plan: RendererVersionCheckPlan = {
    schema_version: "1.0",
    version_check_plan_id: `version-check-plan-${crypto.randomBytes(8).toString("hex")}`,
    discovery_id: input.discovery.discovery_id,
    preflight_id: input.discovery.preflight_id,
    command_manifest_id: input.discovery.command_manifest_id,
    project_id: input.discovery.project_id,
    platform: input.discovery.platform,
    dry_run: true,
    plan_state,
    created_at: new Date().toISOString(),
    approval_required: true,
    check_mode: "planned_only",
    planned_checks: plannedChecks,
    validation: {
      ready_for_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: input.discovery.validation.blocking_reasons,
      warnings: input.discovery.validation.warnings,
    },
    provenance: {
      generated_by: "createRendererVersionCheckPlan",
      source_discovery_id: input.discovery.discovery_id,
      source_preflight_id: input.discovery.preflight_id,
      source_manifest_id: input.discovery.command_manifest_id,
    },
  };

  return plan;
}

export function validateRendererVersionCheckPlan(plan: unknown): RendererVersionCheckPlanValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (typeof plan !== "object" || plan === null) {
    blockingReasons.push("Plan must be an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const p = plan as Record<string, unknown>;

  // Required fields
  if (p.schema_version !== "1.0") {
    blockingReasons.push("schema_version must be '1.0'");
  }
  if (p.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }
  if (p.approval_required !== true) {
    blockingReasons.push("approval_required must be true");
  }
  if (p.check_mode !== "planned_only") {
    blockingReasons.push("check_mode must be 'planned_only'");
  }

  // Validation structure
  if (typeof p.validation !== "object" || p.validation === null) {
    blockingReasons.push("validation is required");
  } else {
    const v = p.validation as Record<string, unknown>;
    if (v.ready_for_execution !== false) {
      blockingReasons.push("validation.ready_for_execution must be false");
    }
    if (v.ready_for_render !== false) {
      blockingReasons.push("validation.ready_for_render must be false");
    }
    if (v.ready_for_upload !== false) {
      blockingReasons.push("validation.ready_for_upload must be false");
    }
  }

  // Planned checks validation
  if (!Array.isArray(p.planned_checks)) {
    blockingReasons.push("planned_checks must be an array");
  } else {
    for (const check of p.planned_checks) {
      if (typeof check !== "object" || check === null) continue;
      const c = check as Record<string, unknown>;
      if (c.execution_allowed !== false) {
        blockingReasons.push("Planned check must have execution_allowed=false");
      }
      if (c.executable_invoked !== false) {
        blockingReasons.push("Planned check must have executable_invoked=false");
      }
      if (c.version_checked !== false) {
        blockingReasons.push("Planned check must have version_checked=false");
      }
      if (c.process_output_captured !== false) {
        blockingReasons.push("Planned check must have process_output_captured=false");
      }
    }
  }

  // Check for forbidden patterns
  const forbiddenPatternReasons = recursivelyCheckForForbiddenPatterns(p);
  blockingReasons.push(...forbiddenPatternReasons);

  const ok = blockingReasons.length === 0;
  return { ok, blocking_reasons: blockingReasons, warnings };
}

export function saveRendererVersionCheckPlan(plan: RendererVersionCheckPlan): void {
  if (plan.dry_run !== true) {
    throw new Error("Cannot save version check plan with dry_run=false");
  }

  if (plan.approval_required !== true) {
    throw new Error("Cannot save version check plan with approval_required=false");
  }

  if (plan.check_mode !== "planned_only") {
    throw new Error("Cannot save version check plan with check_mode other than planned_only");
  }

  for (const check of plan.planned_checks) {
    if (check.execution_allowed !== false) {
      throw new Error("Cannot save plan with execution_allowed=true");
    }
    if (check.executable_invoked !== false) {
      throw new Error("Cannot save plan with executable_invoked=true");
    }
    if (check.version_checked !== false) {
      throw new Error("Cannot save plan with version_checked=true");
    }
    if (check.process_output_captured !== false) {
      throw new Error("Cannot save plan with process_output_captured=true");
    }
  }

  if (plan.validation.ready_for_execution !== false) {
    throw new Error("Cannot save plan with ready_for_execution=true");
  }
  if (plan.validation.ready_for_render !== false) {
    throw new Error("Cannot save plan with ready_for_render=true");
  }
  if (plan.validation.ready_for_upload !== false) {
    throw new Error("Cannot save plan with ready_for_upload=true");
  }

  const store = loadRendererVersionCheckPlansStore();
  const existingIndex = store.plans.findIndex((p) => p.version_check_plan_id === plan.version_check_plan_id);
  if (existingIndex >= 0) {
    store.plans[existingIndex] = plan;
  } else {
    store.plans.push(plan);
  }

  store.plans.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.version_check_plan_id.localeCompare(b.version_check_plan_id);
  });

  saveRendererVersionCheckPlansStore(store);
}

export function listRendererVersionCheckPlans(options?: {
  project_id?: string;
  platform?: string;
  plan_state?: string;
  discovery_id?: string;
  preflight_id?: string;
}): RendererVersionCheckPlan[] {
  const store = loadRendererVersionCheckPlansStore();
  let result = [...store.plans];

  if (options?.project_id) {
    result = result.filter((p) => p.project_id === options.project_id);
  }

  if (options?.platform) {
    result = result.filter((p) => p.platform === options.platform);
  }

  if (options?.plan_state) {
    result = result.filter((p) => p.plan_state === options.plan_state);
  }

  if (options?.discovery_id) {
    result = result.filter((p) => p.discovery_id === options.discovery_id);
  }

  if (options?.preflight_id) {
    result = result.filter((p) => p.preflight_id === options.preflight_id);
  }

  return result;
}

export function getRendererVersionCheckPlan(version_check_plan_id: string): RendererVersionCheckPlan | null {
  const store = loadRendererVersionCheckPlansStore();
  return store.plans.find((p) => p.version_check_plan_id === version_check_plan_id) || null;
}

export function getRendererVersionCheckPlanReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  ready_for_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  plans: Array<{
    version_check_plan_id: string;
    discovery_id: string;
    preflight_id: string;
    command_manifest_id: string;
    platform: string;
    project_id: string;
    plan_state: string;
    planned_check_count: number;
  }>;
} {
  const plans = listRendererVersionCheckPlans(options);
  const byState: Record<string, number> = {};

  for (const p of plans) {
    byState[p.plan_state] = (byState[p.plan_state] || 0) + 1;
  }

  return {
    total: plans.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    ready_for_operator_review: byState.ready_for_operator_review || 0,
    ready_for_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    plans: plans.map((p) => ({
      version_check_plan_id: sanitizeRenderPlanString(p.version_check_plan_id, "[unsafe-id]"),
      discovery_id: sanitizeRenderPlanString(p.discovery_id, "[unsafe-id]"),
      preflight_id: sanitizeRenderPlanString(p.preflight_id, "[unsafe-id]"),
      command_manifest_id: sanitizeRenderPlanString(p.command_manifest_id, "[unsafe-id]"),
      platform: sanitizeRenderPlanString(p.platform, "[unsafe-platform]"),
      project_id: sanitizeRenderPlanString(p.project_id, "[unsafe-project]"),
      plan_state: p.plan_state,
      planned_check_count: p.planned_checks.length,
    })),
  };
}

// ─── VO-4E: Mock Renderer Execution Result ─────────────────────────────────

export type MockRendererExecutionResultState = "draft" | "blocked" | "mock_passed" | "mock_failed";
export type MockRendererExecutionMode = "mock_only";

export interface MockRendererExecutionCheck {
  check_id: string;
  tool_label: string;
  expected_tool_kind: string;
  simulated_result: string;
  execution_allowed: false;
  executable_invoked: false;
  version_checked: false;
  command_executed: false;
  process_output_captured: false;
  media_created: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface MockRendererExecutionOutputSummary {
  planned_output_count: number;
  actual_output_count: 0;
  output_files_created: false;
  media_files_created: false;
  output_path_summaries: string[];
}

export interface MockRendererExecutionResult {
  schema_version: "1.0";
  mock_result_id: string;
  version_check_plan_id: string;
  discovery_id: string;
  preflight_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  result_state: MockRendererExecutionResultState;
  created_at: string;
  execution_mode: MockRendererExecutionMode;
  mock_checks: MockRendererExecutionCheck[];
  output_summary: MockRendererExecutionOutputSummary;
  validation: {
    ready_for_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createMockRendererExecutionResult";
    source_plan_id: string;
    source_discovery_id: string;
    source_preflight_id: string;
    source_manifest_id: string;
  };
}

export interface MockRendererExecutionResultValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

interface MockRendererExecutionResultsStore {
  results: MockRendererExecutionResult[];
}

function getMockRendererExecutionResultsPath(): string {
  return path.join(getRuntimeDir(), "mock-renderer-execution-results.json");
}

function loadMockRendererExecutionResultsStore(): MockRendererExecutionResultsStore {
  const storePath = getMockRendererExecutionResultsPath();
  if (!fs.existsSync(storePath)) {
    return { results: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn("Failed to parse mock renderer execution results store:", err);
    return { results: [] };
  }
}

function saveMockRendererExecutionResultsStore(store: MockRendererExecutionResultsStore): void {
  const storePath = getMockRendererExecutionResultsPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function createMockRendererExecutionResult(input: {
  plan: RendererVersionCheckPlan;
  dryRun: true;
  executionMode: "mock_only";
}): MockRendererExecutionResult {
  if (!input.dryRun) {
    throw new Error("Mock execution result only supports dryRun=true");
  }

  if (input.executionMode !== "mock_only") {
    throw new Error("Mock execution result only supports executionMode=mock_only");
  }

  if (!input.plan.dry_run) {
    throw new Error("Plan must have dry_run=true");
  }

  if (input.plan.check_mode !== "planned_only") {
    throw new Error("Plan must have check_mode=planned_only");
  }

  // Verify all planned checks have correct flags
  for (const check of input.plan.planned_checks) {
    if (check.execution_allowed !== false) {
      throw new Error("Planned check must have execution_allowed=false");
    }
    if (check.executable_invoked !== false) {
      throw new Error("Planned check must have executable_invoked=false");
    }
    if (check.version_checked !== false) {
      throw new Error("Planned check must have version_checked=false");
    }
    if (check.process_output_captured !== false) {
      throw new Error("Planned check must have process_output_captured=false");
    }
  }

  // Derive mock checks from planned checks
  const mockChecks: MockRendererExecutionCheck[] = input.plan.planned_checks.map((pc) => ({
    check_id: pc.check_id,
    tool_label: pc.tool_label,
    expected_tool_kind: pc.expected_tool_kind,
    simulated_result: "[mock-pass]",
    execution_allowed: false,
    executable_invoked: false,
    version_checked: false,
    command_executed: false,
    process_output_captured: false,
    media_created: false,
    blocking_reasons: [],
    warnings: [],
  }));

  // Determine result state based on plan validation
  const result_state: MockRendererExecutionResultState = input.plan.validation.blocking_reasons.length === 0
    ? "mock_passed"
    : "blocked";

  const result: MockRendererExecutionResult = {
    schema_version: "1.0",
    mock_result_id: `mock-result-${crypto.randomBytes(8).toString("hex")}`,
    version_check_plan_id: input.plan.version_check_plan_id,
    discovery_id: input.plan.discovery_id,
    preflight_id: input.plan.preflight_id,
    command_manifest_id: input.plan.command_manifest_id,
    project_id: input.plan.project_id,
    platform: input.plan.platform,
    dry_run: true,
    result_state,
    created_at: new Date().toISOString(),
    execution_mode: "mock_only",
    mock_checks: mockChecks,
    output_summary: {
      planned_output_count: 2,
      actual_output_count: 0,
      output_files_created: false,
      media_files_created: false,
      output_path_summaries: ["[would-create-video]", "[would-create-thumbnail]"],
    },
    validation: {
      ready_for_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: input.plan.validation.blocking_reasons,
      warnings: input.plan.validation.warnings,
    },
    provenance: {
      generated_by: "createMockRendererExecutionResult",
      source_plan_id: input.plan.version_check_plan_id,
      source_discovery_id: input.plan.discovery_id,
      source_preflight_id: input.plan.preflight_id,
      source_manifest_id: input.plan.command_manifest_id,
    },
  };

  return result;
}

export function validateMockRendererExecutionResult(result: unknown): MockRendererExecutionResultValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (typeof result !== "object" || result === null) {
    blockingReasons.push("Result must be an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const r = result as Record<string, unknown>;

  // Required fields
  if (r.schema_version !== "1.0") {
    blockingReasons.push("schema_version must be '1.0'");
  }
  if (r.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }
  if (r.execution_mode !== "mock_only") {
    blockingReasons.push("execution_mode must be 'mock_only'");
  }

  // Verify all mock checks have correct flags
  if (Array.isArray(r.mock_checks)) {
    for (const check of r.mock_checks as Record<string, unknown>[]) {
      if (check.execution_allowed !== false) {
        blockingReasons.push("Mock check must have execution_allowed=false");
      }
      if (check.executable_invoked !== false) {
        blockingReasons.push("Mock check must have executable_invoked=false");
      }
      if (check.version_checked !== false) {
        blockingReasons.push("Mock check must have version_checked=false");
      }
      if (check.command_executed !== false) {
        blockingReasons.push("Mock check must have command_executed=false");
      }
      if (check.process_output_captured !== false) {
        blockingReasons.push("Mock check must have process_output_captured=false");
      }
      if (check.media_created !== false) {
        blockingReasons.push("Mock check must have media_created=false");
      }
    }
  }

  // Verify output summary
  if (typeof r.output_summary === "object" && r.output_summary !== null) {
    const out = r.output_summary as Record<string, unknown>;
    if (out.actual_output_count !== 0) {
      blockingReasons.push("actual_output_count must be 0");
    }
    if (out.output_files_created !== false) {
      blockingReasons.push("output_files_created must be false");
    }
    if (out.media_files_created !== false) {
      blockingReasons.push("media_files_created must be false");
    }
  }

  // Verify validation flags
  if (typeof r.validation === "object" && r.validation !== null) {
    const val = r.validation as Record<string, unknown>;
    if (val.ready_for_execution !== false) {
      blockingReasons.push("ready_for_execution must be false");
    }
    if (val.ready_for_render !== false) {
      blockingReasons.push("ready_for_render must be false");
    }
    if (val.ready_for_upload !== false) {
      blockingReasons.push("ready_for_upload must be false");
    }
  }

  // Forbidden patterns check
  const forbiddenPatterns = [
    "credential_reference",
    "credential_reference_id",
    "credentialReference",
    "credentialReferenceId",
    "keychain://",
    "videos.insert",
    "youtube.videos",
    "child_process",
    "execSync",
    "spawn",
    "ffmpeg -version",
    "ffprobe",
    "process.env",
    "/Users/",
    "/home/",
    "~",
  ];

  function checkValue(val: unknown): boolean {
    if (typeof val === "string") {
      for (const pattern of forbiddenPatterns) {
        if (val.includes(pattern)) {
          return true;
        }
      }
      return false;
    }
    if (typeof val === "object" && val !== null) {
      for (const key of Object.keys(val as Record<string, unknown>)) {
        if (forbiddenPatterns.includes(key)) {
          blockingReasons.push("Contains forbidden key");
          return true;
        }
        if (checkValue((val as Record<string, unknown>)[key])) {
          return true;
        }
      }
      return false;
    }
    return false;
  }

  checkValue(r);
  if (blockingReasons.length > 0 && blockingReasons[blockingReasons.length - 1] === "Contains forbidden key") {
    // Already added
  } else if (checkValue(r)) {
    blockingReasons.push("Contains forbidden patterns or values");
  }

  return {
    ok: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

export function saveMockRendererExecutionResult(result: MockRendererExecutionResult): void {
  const validation = validateMockRendererExecutionResult(result);
  if (!validation.ok) {
    throw new Error(`Cannot save result: ${validation.blocking_reasons.join(", ")}`);
  }

  // Additional safety checks before storage
  if (result.dry_run !== true) {
    throw new Error("Cannot save result with dry_run=false");
  }
  if (result.execution_mode !== "mock_only") {
    throw new Error("Cannot save result with execution_mode other than mock_only");
  }
  if (result.output_summary.actual_output_count !== 0) {
    throw new Error("Cannot save result with actual_output_count > 0");
  }
  if (result.output_summary.output_files_created !== false) {
    throw new Error("Cannot save result with output_files_created=true");
  }
  if (result.output_summary.media_files_created !== false) {
    throw new Error("Cannot save result with media_files_created=true");
  }
  if (result.validation.ready_for_execution !== false) {
    throw new Error("Cannot save result with ready_for_execution=true");
  }
  if (result.validation.ready_for_render !== false) {
    throw new Error("Cannot save result with ready_for_render=true");
  }
  if (result.validation.ready_for_upload !== false) {
    throw new Error("Cannot save result with ready_for_upload=true");
  }

  const store = loadMockRendererExecutionResultsStore();
  const existingIndex = store.results.findIndex((r) => r.mock_result_id === result.mock_result_id);
  if (existingIndex >= 0) {
    store.results[existingIndex] = result;
  } else {
    store.results.push(result);
  }

  store.results.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.mock_result_id.localeCompare(b.mock_result_id);
  });

  saveMockRendererExecutionResultsStore(store);
}

export function listMockRendererExecutionResults(options?: {
  project_id?: string;
  platform?: string;
  result_state?: string;
  version_check_plan_id?: string;
  command_manifest_id?: string;
}): MockRendererExecutionResult[] {
  const store = loadMockRendererExecutionResultsStore();
  let result = [...store.results];

  if (options?.project_id) {
    result = result.filter((r) => r.project_id === options.project_id);
  }

  if (options?.platform) {
    result = result.filter((r) => r.platform === options.platform);
  }

  if (options?.result_state) {
    result = result.filter((r) => r.result_state === options.result_state);
  }

  if (options?.version_check_plan_id) {
    result = result.filter((r) => r.version_check_plan_id === options.version_check_plan_id);
  }

  if (options?.command_manifest_id) {
    result = result.filter((r) => r.command_manifest_id === options.command_manifest_id);
  }

  return result;
}

export function getMockRendererExecutionResult(mock_result_id: string): MockRendererExecutionResult | null {
  const store = loadMockRendererExecutionResultsStore();
  return store.results.find((r) => r.mock_result_id === mock_result_id) || null;
}

export function getMockRendererExecutionResultReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  mock_passed: number;
  mock_failed: number;
  ready_for_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  actual_output_count: 0;
  media_files_created: 0;
  results: Array<{
    mock_result_id: string;
    version_check_plan_id: string;
    discovery_id: string;
    preflight_id: string;
    command_manifest_id: string;
    platform: string;
    project_id: string;
    result_state: string;
    mock_check_count: number;
  }>;
} {
  const results = listMockRendererExecutionResults(options);
  const byState: Record<string, number> = {};

  for (const r of results) {
    byState[r.result_state] = (byState[r.result_state] || 0) + 1;
  }

  return {
    total: results.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    mock_passed: byState.mock_passed || 0,
    mock_failed: byState.mock_failed || 0,
    ready_for_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    actual_output_count: 0,
    media_files_created: 0,
    results: results.map((r) => ({
      mock_result_id: sanitizeRenderPlanString(r.mock_result_id, "[unsafe-id]"),
      version_check_plan_id: sanitizeRenderPlanString(r.version_check_plan_id, "[unsafe-id]"),
      discovery_id: sanitizeRenderPlanString(r.discovery_id, "[unsafe-id]"),
      preflight_id: sanitizeRenderPlanString(r.preflight_id, "[unsafe-id]"),
      command_manifest_id: sanitizeRenderPlanString(r.command_manifest_id, "[unsafe-id]"),
      platform: sanitizeRenderPlanString(r.platform, "[unsafe-platform]"),
      project_id: sanitizeRenderPlanString(r.project_id, "[unsafe-project]"),
      result_state: r.result_state,
      mock_check_count: r.mock_checks.length,
    })),
  };
}

// ─── VO-5A: Real Renderer Execution Spike Gate ──────────────────────────

export type RealRendererExecutionGateState = "draft" | "blocked" | "ready_for_explicit_operator_approval" | "rejected";

export interface RealExecutionConstraintSummary {
  execution_enabled: false;
  child_process_allowed: false;
  ffmpeg_execution_allowed: false;
  renderer_execution_allowed: false;
  media_creation_allowed: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
  max_runtime_seconds?: number;
  allowed_output_directory_summary: string;
  allowed_tools: string[];
}

export interface RealExecutionPrecondition {
  precondition_id: string;
  kind: string;
  satisfied: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RealRendererExecutionGate {
  schema_version: "1.0";
  real_execution_gate_id: string;
  mock_result_id: string;
  version_check_plan_id: string;
  discovery_id: string;
  preflight_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  gate_state: RealRendererExecutionGateState;
  created_at: string;
  real_execution_requested: false;
  explicit_operator_approval_required: true;
  execution_constraints: RealExecutionConstraintSummary;
  required_preconditions: RealExecutionPrecondition[];
  validation: {
    ready_for_real_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealRendererExecutionGate";
    source_mock_result_id: string;
    source_version_check_plan_id: string;
    source_discovery_id: string;
    source_preflight_id: string;
    source_manifest_id: string;
  };
}

export interface RealRendererExecutionGateValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

interface RealRendererExecutionGatesStore {
  gates: RealRendererExecutionGate[];
}

function getRealRendererExecutionGatesPath(): string {
  return path.join(getRuntimeDir(), "real-renderer-execution-gates.json");
}

function loadRealRendererExecutionGatesStore(): RealRendererExecutionGatesStore {
  const storePath = getRealRendererExecutionGatesPath();
  if (!fs.existsSync(storePath)) {
    return { gates: [] };
  }
  try {
    const content = fs.readFileSync(storePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn("Failed to parse real renderer execution gates store:", err);
    return { gates: [] };
  }
}

function saveRealRendererExecutionGatesStore(store: RealRendererExecutionGatesStore): void {
  const storePath = getRealRendererExecutionGatesPath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function createRealRendererExecutionGate(input: {
  mockResult: MockRendererExecutionResult;
  dryRun: true;
  requestRealExecution: false;
}): RealRendererExecutionGate {
  if (!input.dryRun) {
    throw new Error("Real execution gate only supports dryRun=true");
  }

  if (input.requestRealExecution !== false) {
    throw new Error("Real execution gate requires requestRealExecution=false");
  }

  if (!input.mockResult.dry_run) {
    throw new Error("Mock result must have dry_run=true");
  }

  if (input.mockResult.execution_mode !== "mock_only") {
    throw new Error("Mock result must have execution_mode=mock_only");
  }

  if (input.mockResult.output_summary.actual_output_count !== 0) {
    throw new Error("Mock result must have actual_output_count=0");
  }

  if (input.mockResult.output_summary.output_files_created !== false) {
    throw new Error("Mock result must have output_files_created=false");
  }

  if (input.mockResult.output_summary.media_files_created !== false) {
    throw new Error("Mock result must have media_files_created=false");
  }

  // Verify all mock checks have correct flags
  for (const check of input.mockResult.mock_checks) {
    if (check.execution_allowed !== false) {
      throw new Error("Mock check must have execution_allowed=false");
    }
    if (check.executable_invoked !== false) {
      throw new Error("Mock check must have executable_invoked=false");
    }
    if (check.command_executed !== false) {
      throw new Error("Mock check must have command_executed=false");
    }
    if (check.version_checked !== false) {
      throw new Error("Mock check must have version_checked=false");
    }
    if (check.process_output_captured !== false) {
      throw new Error("Mock check must have process_output_captured=false");
    }
    if (check.media_created !== false) {
      throw new Error("Mock check must have media_created=false");
    }
  }

  // Build preconditions from mock result
  const preconditions: RealExecutionPrecondition[] = [
    {
      precondition_id: `precondition-${crypto.randomBytes(4).toString("hex")}`,
      kind: "mock_result_valid",
      satisfied: input.mockResult.result_state === "mock_passed",
      blocking_reasons: input.mockResult.result_state !== "mock_passed" ? ["Mock result not in mock_passed state"] : [],
      warnings: [],
    },
    {
      precondition_id: `precondition-${crypto.randomBytes(4).toString("hex")}`,
      kind: "version_checks_safe",
      satisfied: input.mockResult.mock_checks.every((c) => c.blocking_reasons.length === 0),
      blocking_reasons: input.mockResult.mock_checks.some((c) => c.blocking_reasons.length > 0)
        ? ["Mock checks have blocking reasons"]
        : [],
      warnings: [],
    },
    {
      precondition_id: `precondition-${crypto.randomBytes(4).toString("hex")}`,
      kind: "no_credentials_leaked",
      satisfied: !JSON.stringify(input.mockResult).includes("credential"),
      blocking_reasons: JSON.stringify(input.mockResult).includes("credential")
        ? ["Potential credential leak detected"]
        : [],
      warnings: [],
    },
  ];

  // Determine gate state
  const gate_state: RealRendererExecutionGateState = preconditions.every((p) => p.satisfied)
    ? "ready_for_explicit_operator_approval"
    : "blocked";

  const gate: RealRendererExecutionGate = {
    schema_version: "1.0",
    real_execution_gate_id: `real-execution-gate-${crypto.randomBytes(8).toString("hex")}`,
    mock_result_id: input.mockResult.mock_result_id,
    version_check_plan_id: input.mockResult.version_check_plan_id,
    discovery_id: input.mockResult.discovery_id,
    preflight_id: input.mockResult.preflight_id,
    command_manifest_id: input.mockResult.command_manifest_id,
    project_id: input.mockResult.project_id,
    platform: input.mockResult.platform,
    dry_run: true,
    gate_state,
    created_at: new Date().toISOString(),
    real_execution_requested: false,
    explicit_operator_approval_required: true,
    execution_constraints: {
      execution_enabled: false,
      child_process_allowed: false,
      ffmpeg_execution_allowed: false,
      renderer_execution_allowed: false,
      media_creation_allowed: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      allowed_output_directory_summary: "[not-approved-yet]",
      allowed_tools: [],
    },
    required_preconditions: preconditions,
    validation: {
      ready_for_real_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: input.mockResult.validation.blocking_reasons,
      warnings: input.mockResult.validation.warnings,
    },
    provenance: {
      generated_by: "createRealRendererExecutionGate",
      source_mock_result_id: input.mockResult.mock_result_id,
      source_version_check_plan_id: input.mockResult.version_check_plan_id,
      source_discovery_id: input.mockResult.discovery_id,
      source_preflight_id: input.mockResult.preflight_id,
      source_manifest_id: input.mockResult.command_manifest_id,
    },
  };

  return gate;
}

export function validateRealRendererExecutionGate(gate: unknown): RealRendererExecutionGateValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (typeof gate !== "object" || gate === null) {
    blockingReasons.push("Gate must be an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const g = gate as Record<string, unknown>;

  // Required fields
  if (g.schema_version !== "1.0") {
    blockingReasons.push("schema_version must be '1.0'");
  }
  if (g.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }
  if (g.real_execution_requested !== false) {
    blockingReasons.push("real_execution_requested must be false");
  }
  if (g.explicit_operator_approval_required !== true) {
    blockingReasons.push("explicit_operator_approval_required must be true");
  }

  // Verify execution constraints all disabled
  if (typeof g.execution_constraints === "object" && g.execution_constraints !== null) {
    const constraints = g.execution_constraints as Record<string, unknown>;
    if (constraints.execution_enabled !== false) blockingReasons.push("execution_enabled must be false");
    if (constraints.child_process_allowed !== false) blockingReasons.push("child_process_allowed must be false");
    if (constraints.ffmpeg_execution_allowed !== false) blockingReasons.push("ffmpeg_execution_allowed must be false");
    if (constraints.renderer_execution_allowed !== false) blockingReasons.push("renderer_execution_allowed must be false");
    if (constraints.media_creation_allowed !== false) blockingReasons.push("media_creation_allowed must be false");
    if (constraints.upload_allowed !== false) blockingReasons.push("upload_allowed must be false");
    if (constraints.platform_api_calls_allowed !== false) blockingReasons.push("platform_api_calls_allowed must be false");
    if (Array.isArray(constraints.allowed_tools) && constraints.allowed_tools.length > 0) {
      blockingReasons.push("allowed_tools must be empty");
    }
  }

  // Verify validation flags
  if (typeof g.validation === "object" && g.validation !== null) {
    const val = g.validation as Record<string, unknown>;
    if (val.ready_for_real_execution !== false) blockingReasons.push("ready_for_real_execution must be false");
    if (val.ready_for_render !== false) blockingReasons.push("ready_for_render must be false");
    if (val.ready_for_upload !== false) blockingReasons.push("ready_for_upload must be false");
  }

  // Forbidden patterns check
  const forbiddenPatterns = [
    "credential_reference",
    "credential_reference_id",
    "credentialReference",
    "credentialReferenceId",
    "keychain://",
    "videos.insert",
    "youtube.videos",
    "child_process",
    "execSync",
    "spawn",
    "ffmpeg -version",
    "ffprobe",
    "process.env",
    "/Users/",
    "/home/",
    "~",
  ];

  function checkValue(val: unknown): boolean {
    if (typeof val === "string") {
      for (const pattern of forbiddenPatterns) {
        if (val.includes(pattern)) {
          return true;
        }
      }
      return false;
    }
    if (typeof val === "object" && val !== null) {
      for (const key of Object.keys(val as Record<string, unknown>)) {
        if (forbiddenPatterns.includes(key)) {
          blockingReasons.push("Contains forbidden key");
          return true;
        }
        if (checkValue((val as Record<string, unknown>)[key])) {
          return true;
        }
      }
      return false;
    }
    return false;
  }

  checkValue(g);
  if (blockingReasons.length > 0 && blockingReasons[blockingReasons.length - 1] === "Contains forbidden key") {
    // Already added
  } else if (checkValue(g)) {
    blockingReasons.push("Contains forbidden patterns or values");
  }

  return {
    ok: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

export function saveRealRendererExecutionGate(gate: RealRendererExecutionGate): void {
  const validation = validateRealRendererExecutionGate(gate);
  if (!validation.ok) {
    throw new Error(`Cannot save gate: ${validation.blocking_reasons.join(", ")}`);
  }

  // Additional safety checks before storage
  if (gate.dry_run !== true) {
    throw new Error("Cannot save gate with dry_run=false");
  }
  if (gate.real_execution_requested !== false) {
    throw new Error("Cannot save gate with real_execution_requested=true");
  }
  if (gate.execution_constraints.execution_enabled !== false) {
    throw new Error("Cannot save gate with execution_enabled=true");
  }
  if (gate.validation.ready_for_real_execution !== false) {
    throw new Error("Cannot save gate with ready_for_real_execution=true");
  }

  const store = loadRealRendererExecutionGatesStore();
  const existingIndex = store.gates.findIndex((g) => g.real_execution_gate_id === gate.real_execution_gate_id);
  if (existingIndex >= 0) {
    store.gates[existingIndex] = gate;
  } else {
    store.gates.push(gate);
  }

  store.gates.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.real_execution_gate_id.localeCompare(b.real_execution_gate_id);
  });

  saveRealRendererExecutionGatesStore(store);
}

export function listRealRendererExecutionGates(options?: {
  project_id?: string;
  platform?: string;
  gate_state?: string;
  mock_result_id?: string;
  command_manifest_id?: string;
}): RealRendererExecutionGate[] {
  const store = loadRealRendererExecutionGatesStore();
  let result = [...store.gates];

  if (options?.project_id) {
    result = result.filter((g) => g.project_id === options.project_id);
  }

  if (options?.platform) {
    result = result.filter((g) => g.platform === options.platform);
  }

  if (options?.gate_state) {
    result = result.filter((g) => g.gate_state === options.gate_state);
  }

  if (options?.mock_result_id) {
    result = result.filter((g) => g.mock_result_id === options.mock_result_id);
  }

  if (options?.command_manifest_id) {
    result = result.filter((g) => g.command_manifest_id === options.command_manifest_id);
  }

  return result;
}

export function getRealRendererExecutionGate(real_execution_gate_id: string): RealRendererExecutionGate | null {
  const store = loadRealRendererExecutionGatesStore();
  return store.gates.find((g) => g.real_execution_gate_id === real_execution_gate_id) || null;
}

export function getRealRendererExecutionGateReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_explicit_operator_approval: number;
  rejected: number;
  ready_for_real_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  real_execution_requested: 0;
  execution_enabled: 0;
  gates: Array<{
    real_execution_gate_id: string;
    mock_result_id: string;
    version_check_plan_id: string;
    discovery_id: string;
    preflight_id: string;
    command_manifest_id: string;
    platform: string;
    project_id: string;
    gate_state: string;
    precondition_count: number;
  }>;
} {
  const gates = listRealRendererExecutionGates(options);
  const byState: Record<string, number> = {};

  for (const g of gates) {
    byState[g.gate_state] = (byState[g.gate_state] || 0) + 1;
  }

  return {
    total: gates.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    ready_for_explicit_operator_approval: byState.ready_for_explicit_operator_approval || 0,
    rejected: byState.rejected || 0,
    ready_for_real_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    real_execution_requested: 0,
    execution_enabled: 0,
    gates: gates.map((g) => ({
      real_execution_gate_id: sanitizeRenderPlanString(g.real_execution_gate_id, "[unsafe-id]"),
      mock_result_id: sanitizeRenderPlanString(g.mock_result_id, "[unsafe-id]"),
      version_check_plan_id: sanitizeRenderPlanString(g.version_check_plan_id, "[unsafe-id]"),
      discovery_id: sanitizeRenderPlanString(g.discovery_id, "[unsafe-id]"),
      preflight_id: sanitizeRenderPlanString(g.preflight_id, "[unsafe-id]"),
      command_manifest_id: sanitizeRenderPlanString(g.command_manifest_id, "[unsafe-id]"),
      platform: sanitizeRenderPlanString(g.platform, "[unsafe-platform]"),
      project_id: sanitizeRenderPlanString(g.project_id, "[unsafe-project]"),
      gate_state: g.gate_state,
      precondition_count: g.required_preconditions.length,
    })),
  };
}

// ─── VO-5B: Real Renderer Execution Approval Record ──────────────────────────

export type RealRendererExecutionApprovalState = "draft" | "rejected" | "approved_for_future_real_execution_request" | "revoked";

export interface RealRendererExecutionApprovalScope {
  scope_kind: "real_renderer_execution_spike";
  one_time_only: true;
  expires_at?: string;
  max_runtime_seconds?: number;
  max_output_files: 0;
  allowed_output_directory_summary: string;
  allowed_tools: [];
}

export interface RealRendererExecutionOperatorReview {
  reviewed_by_label: string;
  reviewed_at?: string;
  decision_note_summary?: string;
  checklist_acknowledged: boolean;
  risk_acknowledgement: boolean;
  understands_real_execution_not_enabled: boolean;
}

export interface RealRendererExecutionPermissions {
  real_execution_requested: false;
  execution_enabled: false;
  child_process_allowed: false;
  ffmpeg_execution_allowed: false;
  renderer_execution_allowed: false;
  media_creation_allowed: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
  env_access_allowed: false;
  process_output_capture_allowed: false;
}

export interface RealRendererExecutionAcknowledgement {
  acknowledgement_id: string;
  kind: string;
  acknowledged: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RealRendererExecutionApproval {
  schema_version: "1.0";
  real_execution_approval_id: string;
  real_execution_gate_id: string;
  mock_result_id: string;
  version_check_plan_id: string;
  discovery_id: string;
  preflight_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  dry_run: true;
  approval_state: RealRendererExecutionApprovalState;
  created_at: string;
  approval_scope: RealRendererExecutionApprovalScope;
  operator_review: RealRendererExecutionOperatorReview;
  execution_permissions: RealRendererExecutionPermissions;
  required_acknowledgements: RealRendererExecutionAcknowledgement[];
  validation: {
    ready_for_real_execution: false;
    ready_for_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealRendererExecutionApproval";
    source_gate_id: string;
    source_mock_result_id: string;
    source_version_check_plan_id: string;
    source_discovery_id: string;
    source_preflight_id: string;
    source_manifest_id: string;
  };
}

export interface RealRendererExecutionApprovalValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export type ControlledProductionRenderRequestState = "draft" | "blocked" | "ready_for_operator_review" | "rejected";

export type ControlledProductionRenderExecutionMode = "controlled_production_render_request";

export interface ControlledProductionScope {
  production_project_allowed: true;
  user_media_allowed: true;
  test_only: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
  automatic_execution_allowed: false;
}

export interface ControlledProductionSourceMediaPolicy {
  source_media_access_requested: true;
  source_media_mutation_allowed: false;
  allowed_source_reference_summary: string;
  source_inventory_required: true;
  source_checks_required: true;
}

export interface ControlledProductionOutputPolicy {
  output_directory_approval_required: true;
  allowed_output_directory_summary: string;
  output_file_count_limit: 1;
  overwrite_allowed: false;
  cleanup_required: true;
}

export interface ControlledProductionExecutionPermissions {
  real_execution_requested: false;
  execution_enabled: false;
  child_process_allowed: false;
  ffmpeg_execution_allowed: false;
  renderer_execution_allowed: false;
  media_creation_allowed: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
  env_access_allowed: false;
  process_output_capture_allowed: false;
}

export interface ControlledProductionRenderRequestValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface ControlledProductionRenderRequest {
  schema_version: "1.0";
  production_render_request_id: string;
  real_execution_approval_id: string;
  real_execution_gate_id: string;
  render_plan_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  request_state: ControlledProductionRenderRequestState;
  created_at: string;
  execution_mode: ControlledProductionRenderExecutionMode;
  production_scope: ControlledProductionScope;
  source_media_policy: ControlledProductionSourceMediaPolicy;
  output_policy: ControlledProductionOutputPolicy;
  execution_permissions: ControlledProductionExecutionPermissions;
  validation: {
    ready_for_production_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createControlledProductionRenderRequest";
    source_approval_id: string;
    source_gate_id: string;
    source_render_plan_id: string;
    source_manifest_id: string;
  };
}

export type SourceMediaInventoryMode = "metadata_only" | "explicit_read_only_validation";

export type SourceMediaInventoryState = "draft" | "blocked" | "checked" | "ready_for_operator_review";

export interface SourceMediaPolicy {
  source_media_access_requested: true;
  source_media_read_only: true;
  source_media_mutation_allowed: false;
  source_media_copy_allowed: false;
  source_media_transcode_allowed: false;
  render_allowed: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
}

export interface SourceMediaInventoryItem {
  source_item_id: string;
  source_kind: "video" | "image" | "audio" | "caption" | "thumbnail" | "other";
  source_reference_summary: string;
  declared_required: boolean;
  read_check_performed: boolean;
  exists?: boolean;
  file_type_summary?: string;
  byte_size?: number;
  duration_seconds?: number;
  resolution_summary?: string;
  blocking_reasons: string[];
  warnings: string[];
}

export interface SourceMediaInventoryValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface SourceMediaInventory {
  schema_version: "1.0";
  source_media_inventory_id: string;
  production_render_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  inventory_state: SourceMediaInventoryState;
  created_at: string;
  inventory_mode: SourceMediaInventoryMode;
  source_media_policy: SourceMediaPolicy;
  source_items: SourceMediaInventoryItem[];
  validation: {
    ready_for_production_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createSourceMediaInventory";
    source_production_render_request_id: string;
    source_render_plan_id: string;
  };
}

interface SourceMediaInventoriesStore {
  schema_version: "1.0";
  created_at: string;
  inventories: SourceMediaInventory[];
}

function getSourceMediaInventoriesPath(): string {
  return path.join(getRuntimeDir(), "source-media-inventories.json");
}

function loadSourceMediaInventoriesStore(): SourceMediaInventoriesStore {
  try {
    const filePath = getSourceMediaInventoriesPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as SourceMediaInventoriesStore;
    }
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), inventories: [] };
}

function saveSourceMediaInventoriesStore(store: SourceMediaInventoriesStore): void {
  const filePath = getSourceMediaInventoriesPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.inventories.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.source_media_inventory_id.localeCompare(b.source_media_inventory_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeSourceMediaSummary(reference: string, allowRelativePathSummary = true): string {
  const summarized = summarizeSourceMediaReference({ reference, allowRelativePathSummary });
  return summarized.ok ? summarized.summary : "[source-reference]";
}

interface ControlledProductionRenderRequestsStore {
  schema_version: "1.0";
  created_at: string;
  requests: ControlledProductionRenderRequest[];
}

function getControlledProductionRenderRequestsPath(): string {
  return path.join(getRuntimeDir(), "controlled-production-render-requests.json");
}

function loadControlledProductionRenderRequestsStore(): ControlledProductionRenderRequestsStore {
  try {
    const filePath = getControlledProductionRenderRequestsPath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content) as ControlledProductionRenderRequestsStore;
    }
  } catch {
    // Continue with empty store
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), requests: [] };
}

function saveControlledProductionRenderRequestsStore(store: ControlledProductionRenderRequestsStore): void {
  const filePath = getControlledProductionRenderRequestsPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  store.requests.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.production_render_request_id.localeCompare(b.production_render_request_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function validateControlledProductionRenderRequestShape(request: unknown): ControlledProductionRenderRequestValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  if (!request || typeof request !== "object") {
    return { ok: false, blocking_reasons: ["Controlled production render request must be an object"], warnings };
  }
  const r = request as Record<string, unknown>;
  const required = ["schema_version", "production_render_request_id", "real_execution_approval_id", "real_execution_gate_id", "render_plan_id", "command_manifest_id", "project_id", "platform", "request_state", "created_at", "execution_mode", "production_scope", "source_media_policy", "output_policy", "execution_permissions", "validation", "provenance"];
  for (const key of required) {
    if (!(key in r)) blockingReasons.push("Controlled production render request is missing a required field");
  }
  if (r.schema_version !== "1.0") blockingReasons.push("schema_version must be 1.0");
  if (r.execution_mode !== "controlled_production_render_request") blockingReasons.push("execution_mode must be controlled_production_render_request");
  if (!["draft", "blocked", "ready_for_operator_review", "rejected"].includes(String(r.request_state))) blockingReasons.push("request_state is invalid");
  const forbidden = recursivelyCheckForForbiddenPatterns(request);
  blockingReasons.push(...forbidden);
  const scope = r.production_scope as Record<string, unknown> | undefined;
  if (!scope || scope.production_project_allowed !== true || scope.user_media_allowed !== true || scope.test_only !== false || scope.upload_allowed !== false || scope.platform_api_calls_allowed !== false || scope.automatic_execution_allowed !== false) {
    blockingReasons.push("Production scope is unsafe");
  }
  const source = r.source_media_policy as Record<string, unknown> | undefined;
  if (!source || source.source_media_access_requested !== true || source.source_media_mutation_allowed !== false || source.source_inventory_required !== true || source.source_checks_required !== true) {
    blockingReasons.push("Source media policy is unsafe");
  }
  if (typeof source?.allowed_source_reference_summary !== "string" || source.allowed_source_reference_summary.includes("://") || source.allowed_source_reference_summary.includes("/")) {
    blockingReasons.push("Source media summary is unsafe");
  }
  const output = r.output_policy as Record<string, unknown> | undefined;
  if (!output || output.output_directory_approval_required !== true || output.overwrite_allowed !== false || output.cleanup_required !== true || output.output_file_count_limit !== 1) {
    blockingReasons.push("Output policy is unsafe");
  }
  if (typeof output?.allowed_output_directory_summary !== "string" || output.allowed_output_directory_summary !== "[not-approved]") {
    blockingReasons.push("Output directory summary is unsafe");
  }
  const perms = r.execution_permissions as Record<string, unknown> | undefined;
  if (!perms || perms.real_execution_requested !== false || perms.execution_enabled !== false || perms.child_process_allowed !== false || perms.ffmpeg_execution_allowed !== false || perms.renderer_execution_allowed !== false || perms.media_creation_allowed !== false || perms.upload_allowed !== false || perms.platform_api_calls_allowed !== false || perms.env_access_allowed !== false || perms.process_output_capture_allowed !== false) {
    blockingReasons.push("Execution permissions are unsafe");
  }
  const validation = r.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_production_render !== false || validation.ready_for_upload !== false) {
    blockingReasons.push("Validation readiness must remain false");
  }
  const requestText = JSON.stringify(request);
  const explicitForbiddenPatterns = ["process.env[", "stdout", "stderr", "videos.insert", "youtube.videos().insert", "Bearer "];
  if (typeof requestText === "string" && explicitForbiddenPatterns.some((pattern) => requestText.includes(pattern))) {
    blockingReasons.push("Request contains forbidden execution, output, or upload content");
  }
  return { ok: blockingReasons.length === 0, blocking_reasons: blockingReasons, warnings };
}

export function validateControlledProductionRenderRequest(request: unknown): ControlledProductionRenderRequestValidationResult {
  return validateControlledProductionRenderRequestShape(request);
}

export function createControlledProductionRenderRequest(input: {
  approval: RealRendererExecutionApproval;
  plan: RenderPlan;
  commandManifest: RenderCommandManifest;
  dryRun: true;
}): ControlledProductionRenderRequest {
  if (input.dryRun !== true) {
    throw new Error("createControlledProductionRenderRequest: dryRun=true required");
  }
  if (input.approval.dry_run !== true || input.approval.approval_state !== "approved_for_future_real_execution_request") {
    throw new Error("createControlledProductionRenderRequest: approval must be an approved dry-run approval");
  }
  if (input.approval.execution_permissions.real_execution_requested !== false || input.approval.execution_permissions.execution_enabled !== false || input.approval.execution_permissions.upload_allowed !== false) {
    throw new Error("createControlledProductionRenderRequest: approval execution permissions must remain false");
  }
  if (input.plan.dry_run !== true) {
    throw new Error("createControlledProductionRenderRequest: plan.dry_run=true required");
  }
  if (input.commandManifest.dry_run !== true || input.commandManifest.executor.execution_enabled !== false) {
    throw new Error("createControlledProductionRenderRequest: command manifest must be dry-run only");
  }
  if (input.approval.real_execution_gate_id !== input.commandManifest.gate_id || input.approval.command_manifest_id !== input.commandManifest.command_manifest_id || input.approval.project_id !== input.commandManifest.project_id || input.approval.platform !== input.commandManifest.platform || input.plan.render_plan_id !== input.commandManifest.render_plan_id || input.plan.project_id !== input.commandManifest.project_id || input.plan.platform !== input.commandManifest.platform) {
    throw new Error("createControlledProductionRenderRequest: IDs must match across approval, plan, and command manifest");
  }
  const request: ControlledProductionRenderRequest = {
    schema_version: "1.0",
    production_render_request_id: `production-render-request-${crypto.randomUUID()}`,
    real_execution_approval_id: input.approval.real_execution_approval_id,
    real_execution_gate_id: input.approval.real_execution_gate_id,
    render_plan_id: input.plan.render_plan_id,
    command_manifest_id: input.commandManifest.command_manifest_id,
    project_id: input.plan.project_id,
    platform: input.plan.platform,
    request_state: "ready_for_operator_review",
    created_at: new Date().toISOString(),
    execution_mode: "controlled_production_render_request",
    production_scope: {
      production_project_allowed: true,
      user_media_allowed: true,
      test_only: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      automatic_execution_allowed: false,
    },
    source_media_policy: {
      source_media_access_requested: true,
      source_media_mutation_allowed: false,
      allowed_source_reference_summary: "[source-reference-summary-only]",
      source_inventory_required: true,
      source_checks_required: true,
    },
    output_policy: {
      output_directory_approval_required: true,
      allowed_output_directory_summary: "[not-approved]",
      output_file_count_limit: 1,
      overwrite_allowed: false,
      cleanup_required: true,
    },
    execution_permissions: {
      real_execution_requested: false,
      execution_enabled: false,
      child_process_allowed: false,
      ffmpeg_execution_allowed: false,
      renderer_execution_allowed: false,
      media_creation_allowed: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      env_access_allowed: false,
      process_output_capture_allowed: false,
    },
    validation: {
      ready_for_production_render: false,
      ready_for_upload: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: {
      generated_by: "createControlledProductionRenderRequest",
      source_approval_id: input.approval.real_execution_approval_id,
      source_gate_id: input.approval.real_execution_gate_id,
      source_render_plan_id: input.plan.render_plan_id,
      source_manifest_id: input.commandManifest.command_manifest_id,
    },
  };

  const requestValidation = validateControlledProductionRenderRequest(request);
  if (!requestValidation.ok) {
    request.request_state = "blocked";
    request.validation.blocking_reasons = requestValidation.blocking_reasons;
    request.validation.warnings = requestValidation.warnings;
  }
  return request;
}

export function saveControlledProductionRenderRequest(request: ControlledProductionRenderRequest): void {
  const validation = validateControlledProductionRenderRequest(request);
  if (!validation.ok) {
    throw new Error("Unsafe controlled production render request cannot be stored.");
  }
  const store = loadControlledProductionRenderRequestsStore();
  const existingIndex = store.requests.findIndex((r) => r.production_render_request_id === request.production_render_request_id);
  if (existingIndex >= 0) store.requests[existingIndex] = request;
  else store.requests.push(request);
  saveControlledProductionRenderRequestsStore(store);
}

export function listControlledProductionRenderRequests(options?: {
  project_id?: string;
  platform?: string;
  request_state?: string;
  render_plan_id?: string;
  command_manifest_id?: string;
}): ControlledProductionRenderRequest[] {
  const store = loadControlledProductionRenderRequestsStore();
  return store.requests.filter((request) => {
    if (options?.project_id && request.project_id !== options.project_id) return false;
    if (options?.platform && request.platform !== options.platform) return false;
    if (options?.request_state && request.request_state !== options.request_state) return false;
    if (options?.render_plan_id && request.render_plan_id !== options.render_plan_id) return false;
    if (options?.command_manifest_id && request.command_manifest_id !== options.command_manifest_id) return false;
    return true;
  }).sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.production_render_request_id.localeCompare(b.production_render_request_id);
  });
}

export function getControlledProductionRenderRequest(production_render_request_id: string): ControlledProductionRenderRequest | null {
  const store = loadControlledProductionRenderRequestsStore();
  return store.requests.find((request) => request.production_render_request_id === production_render_request_id) ?? null;
}

export function getControlledProductionRenderRequestReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  rejected: number;
  ready_for_production_render: 0;
  ready_for_upload: 0;
  execution_enabled: 0;
  upload_allowed: 0;
  requests: Array<{
    production_render_request_id: string;
    project_id: string;
    platform: string;
    request_state: string;
    render_plan_id: string;
    command_manifest_id: string;
    created_at: string;
  }>;
} {
  const requests = listControlledProductionRenderRequests(options);
  const byState: Record<string, number> = {};
  for (const request of requests) {
    byState[request.request_state] = (byState[request.request_state] || 0) + 1;
  }
  return {
    total: requests.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    ready_for_operator_review: byState.ready_for_operator_review || 0,
    rejected: byState.rejected || 0,
    ready_for_production_render: 0,
    ready_for_upload: 0,
    execution_enabled: 0,
    upload_allowed: 0,
    requests: requests.map((request) => ({
      production_render_request_id: sanitizeRenderPlanString(request.production_render_request_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(request.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(request.platform, "[unsafe-platform]"),
      request_state: request.request_state,
      render_plan_id: sanitizeRenderPlanString(request.render_plan_id, "[unsafe-render-plan-id]"),
      command_manifest_id: sanitizeRenderPlanString(request.command_manifest_id, "[unsafe-command-manifest-id]"),
      created_at: request.created_at,
    })),
  };
}

export function summarizeSourceMediaReference(input: {
  reference: string;
  allowRelativePathSummary?: boolean;
}): {
  ok: boolean;
  summary: string;
  blocking_reasons: string[];
  warnings: string[];
} {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof input.reference !== "string" || input.reference.length === 0) {
    blocking_reasons.push("source reference must be a string");
    return { ok: false, summary: "[source-reference]", blocking_reasons, warnings };
  }
  const ref = input.reference.trim();
  if (isForbiddenStringPattern(ref)) {
    blocking_reasons.push("source reference contains forbidden patterns");
    return { ok: false, summary: "[source-reference]", blocking_reasons, warnings };
  }
  if (ref.includes("://") || /^https?:\/\//i.test(ref)) {
    blocking_reasons.push("source reference URLs are not allowed");
    return { ok: false, summary: "[source-reference]", blocking_reasons, warnings };
  }
  if (ref.includes("..")) {
    blocking_reasons.push("source reference traversal is not allowed");
    return { ok: false, summary: "[source-reference]", blocking_reasons, warnings };
  }
  if (path.isAbsolute(ref)) {
    blocking_reasons.push("source reference absolute paths are not allowed");
    return { ok: false, summary: "[source-reference]", blocking_reasons, warnings };
  }
  if (input.allowRelativePathSummary === false) {
    return { ok: true, summary: "[relative-source-reference]", blocking_reasons, warnings };
  }
  return { ok: true, summary: "[source-reference]", blocking_reasons, warnings };
}

function resolveSafeSourceMediaReferencePath(reference: string, baseDir: string): { ok: boolean; absolutePath?: string; blocking_reasons: string[] } {
  const summary = summarizeSourceMediaReference({ reference, allowRelativePathSummary: true });
  if (!summary.ok) {
    return { ok: false, blocking_reasons: summary.blocking_reasons };
  }
  if (path.isAbsolute(reference)) {
    return { ok: false, blocking_reasons: ["source reference absolute paths are not allowed"] };
  }
  const resolved = path.resolve(baseDir, reference);
  const safeBase = path.resolve(baseDir);
  if (!resolved.startsWith(safeBase + path.sep) && resolved !== safeBase) {
    return { ok: false, blocking_reasons: ["source reference must stay within baseDir"] };
  }
  return { ok: true, absolutePath: resolved, blocking_reasons: [] };
}

function collectDeclaredSourceReferences(renderPlan: RenderPlan): Array<{ source_kind: SourceMediaInventoryItem["source_kind"]; reference: string; declared_required: boolean }> {
  const refs: Array<{ source_kind: SourceMediaInventoryItem["source_kind"]; reference: string; declared_required: boolean }> = [];
  for (const target of renderPlan.render_targets) {
    refs.push({
      source_kind: target.kind === "thumbnail" ? "thumbnail" : target.kind === "caption" ? "caption" : target.kind === "metadata" ? "other" : "video",
      reference: target.planned_output_path || `${renderPlan.provenance.source_package_id}:${target.kind}:${target.format_key}`,
      declared_required: true,
    });
  }
  return refs;
}

export function createSourceMediaInventory(input: {
  request: ControlledProductionRenderRequest;
  renderPlan: RenderPlan;
  inventoryMode: "metadata_only" | "explicit_read_only_validation";
  baseDir?: string;
}): SourceMediaInventory {
  const requestValidation = validateControlledProductionRenderRequest(input.request);
  if (!requestValidation.ok) {
    throw new Error("createSourceMediaInventory: request must validate");
  }
  if (input.request.validation.ready_for_production_render !== false) {
    throw new Error("createSourceMediaInventory: request must not be ready for production render");
  }
  if (input.renderPlan.dry_run !== true) {
    throw new Error("createSourceMediaInventory: renderPlan.dry_run must be true");
  }
  const planValidation = validateRenderPlan(input.renderPlan);
  if (!planValidation.ok) {
    throw new Error("createSourceMediaInventory: renderPlan must validate");
  }

  const inventoryId = `source-media-inventory-${crypto.randomUUID()}`;
  const declaredRefs = collectDeclaredSourceReferences(input.renderPlan);
  const sourceItems: SourceMediaInventoryItem[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < declaredRefs.length; i += 1) {
    const ref = declaredRefs[i]!;
    const summarized = summarizeSourceMediaReference({ reference: ref.reference, allowRelativePathSummary: false });
    const item: SourceMediaInventoryItem = {
      source_item_id: `source-item-${i + 1}`,
      source_kind: ref.source_kind,
      source_reference_summary: summarized.summary,
      declared_required: ref.declared_required,
      read_check_performed: false,
      blocking_reasons: [...summarized.blocking_reasons],
      warnings: [...summarized.warnings],
    };
    if (input.inventoryMode === "explicit_read_only_validation") {
      item.read_check_performed = true;
      const baseDir = input.baseDir ?? getRuntimeDir();
      const safePath = resolveSafeSourceMediaReferencePath(ref.reference, baseDir);
      if (!safePath.ok || !safePath.absolutePath) {
        item.blocking_reasons.push(...safePath.blocking_reasons);
      } else {
        item.exists = fs.existsSync(safePath.absolutePath);
        try {
          const stat = fs.statSync(safePath.absolutePath);
          item.file_type_summary = stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
          item.byte_size = stat.size;
        } catch {
          item.blocking_reasons.push("source reference could not be stat'd safely");
        }
      }
    }
    if (item.blocking_reasons.length > 0) {
      blockers.push(...item.blocking_reasons);
    }
    sourceItems.push(item);
  }

  const inventoryState: SourceMediaInventoryState = blockers.length > 0 ? "blocked" : input.inventoryMode === "explicit_read_only_validation" ? "checked" : "ready_for_operator_review";
  if (inventoryState === "ready_for_operator_review" && input.inventoryMode === "metadata_only") {
    warnings.push("Metadata-only inventory; no filesystem checks performed.");
  }

  return {
    schema_version: "1.0",
    source_media_inventory_id: inventoryId,
    production_render_request_id: input.request.production_render_request_id,
    render_plan_id: input.renderPlan.render_plan_id,
    project_id: input.request.project_id,
    platform: input.request.platform,
    inventory_state: inventoryState,
    created_at: new Date().toISOString(),
    inventory_mode: input.inventoryMode,
    source_media_policy: {
      source_media_access_requested: true,
      source_media_read_only: true,
      source_media_mutation_allowed: false,
      source_media_copy_allowed: false,
      source_media_transcode_allowed: false,
      render_allowed: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
    },
    source_items: sourceItems,
    validation: {
      ready_for_production_render: false,
      ready_for_upload: false,
      blocking_reasons: blockers,
      warnings,
    },
    provenance: {
      generated_by: "createSourceMediaInventory",
      source_production_render_request_id: input.request.production_render_request_id,
      source_render_plan_id: input.renderPlan.render_plan_id,
    },
  };
}

export function validateSourceMediaInventory(inventory: unknown): SourceMediaInventoryValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (!inventory || typeof inventory !== "object") {
    return { ok: false, blocking_reasons: ["Source media inventory must be an object"], warnings };
  }
  const inv = inventory as Record<string, unknown>;
  const required = ["schema_version", "source_media_inventory_id", "production_render_request_id", "render_plan_id", "project_id", "platform", "inventory_state", "created_at", "inventory_mode", "source_media_policy", "source_items", "validation", "provenance"];
  for (const key of required) {
    if (!(key in inv)) blocking_reasons.push("Source media inventory is missing a required field");
  }
  if (inv.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (inv.inventory_mode !== "metadata_only" && inv.inventory_mode !== "explicit_read_only_validation") blocking_reasons.push("inventory_mode is invalid");
  if (!["draft", "blocked", "checked", "ready_for_operator_review"].includes(String(inv.inventory_state))) blocking_reasons.push("inventory_state is invalid");
  const forbidden = recursivelyCheckForForbiddenPatterns(inventory);
  blocking_reasons.push(...forbidden);
  const inventoryText = JSON.stringify(inventory);
  if (inventoryText.includes("videos.insert") || inventoryText.includes("youtube.videos().insert") || inventoryText.includes("fetch(")) {
    blocking_reasons.push("Inventory contains forbidden upload/API content");
  }
  const policy = inv.source_media_policy as Record<string, unknown> | undefined;
  if (!policy || policy.source_media_read_only !== true || policy.source_media_mutation_allowed !== false || policy.source_media_copy_allowed !== false || policy.source_media_transcode_allowed !== false || policy.render_allowed !== false || policy.upload_allowed !== false || policy.platform_api_calls_allowed !== false) {
    blocking_reasons.push("Source media policy is unsafe");
  }
  const validation = inv.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_production_render !== false || validation.ready_for_upload !== false) {
    blocking_reasons.push("Validation readiness must remain false");
  }
  const items = inv.source_items as unknown[];
  if (!Array.isArray(items)) {
    blocking_reasons.push("source_items must be an array");
  } else {
    for (const item of items) {
      if (!item || typeof item !== "object") {
        blocking_reasons.push("source item must be an object");
        continue;
      }
      const s = item as Record<string, unknown>;
      if (typeof s.source_item_id !== "string" || typeof s.source_kind !== "string" || typeof s.source_reference_summary !== "string") {
        blocking_reasons.push("source item summary is incomplete");
      }
      if (typeof s.source_reference_summary === "string" && (s.source_reference_summary.includes("://") || s.source_reference_summary.startsWith("/") || s.source_reference_summary.includes(".."))) {
        blocking_reasons.push("source item summary is unsafe");
      }
      if (s.read_check_performed !== true && s.read_check_performed !== false) {
        blocking_reasons.push("source item read_check_performed must be boolean");
      }
      if (s.exists !== undefined && typeof s.exists !== "boolean") blocking_reasons.push("source item exists must be boolean");
      if (s.file_type_summary !== undefined && typeof s.file_type_summary !== "string") blocking_reasons.push("source item file_type_summary must be a string");
      if (typeof s.file_type_summary === "string" && (s.file_type_summary.includes("raw") || s.file_type_summary.includes("data=") || s.file_type_summary.includes("payload"))) {
        blocking_reasons.push("source item file_type_summary contains unsafe media payload content");
      }
      if (s.blocking_reasons !== undefined && !Array.isArray(s.blocking_reasons)) blocking_reasons.push("source item blocking_reasons must be an array");
      if (s.warnings !== undefined && !Array.isArray(s.warnings)) blocking_reasons.push("source item warnings must be an array");
    }
  }
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function saveSourceMediaInventory(inventory: SourceMediaInventory): void {
  const validation = validateSourceMediaInventory(inventory);
  if (!validation.ok) {
    throw new Error("Unsafe source media inventory cannot be stored.");
  }
  const store = loadSourceMediaInventoriesStore();
  const existingIndex = store.inventories.findIndex((item) => item.source_media_inventory_id === inventory.source_media_inventory_id);
  if (existingIndex >= 0) store.inventories[existingIndex] = inventory;
  else store.inventories.push(inventory);
  saveSourceMediaInventoriesStore(store);
}

export function listSourceMediaInventories(options?: {
  project_id?: string;
  platform?: string;
  inventory_state?: string;
  production_render_request_id?: string;
  render_plan_id?: string;
}): SourceMediaInventory[] {
  const store = loadSourceMediaInventoriesStore();
  return store.inventories.filter((inventory) => {
    if (options?.project_id && inventory.project_id !== options.project_id) return false;
    if (options?.platform && inventory.platform !== options.platform) return false;
    if (options?.inventory_state && inventory.inventory_state !== options.inventory_state) return false;
    if (options?.production_render_request_id && inventory.production_render_request_id !== options.production_render_request_id) return false;
    if (options?.render_plan_id && inventory.render_plan_id !== options.render_plan_id) return false;
    return true;
  }).sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.source_media_inventory_id.localeCompare(b.source_media_inventory_id);
  });
}

export function getSourceMediaInventory(source_media_inventory_id: string): SourceMediaInventory | null {
  const store = loadSourceMediaInventoriesStore();
  return store.inventories.find((inventory) => inventory.source_media_inventory_id === source_media_inventory_id) ?? null;
}

export function getSourceMediaInventoryReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  checked: number;
  ready_for_operator_review: number;
  source_items_total: number;
  source_items_checked: number;
  source_items_missing: number;
  ready_for_production_render: 0;
  ready_for_upload: 0;
  inventories: Array<{
    source_media_inventory_id: string;
    project_id: string;
    platform: string;
    inventory_state: string;
    inventory_mode: string;
    source_items_total: number;
    source_items_checked: number;
    source_items_missing: number;
    created_at: string;
  }>;
} {
  const inventories = listSourceMediaInventories(options);
  const byState: Record<string, number> = {};
  let sourceItemsTotal = 0;
  let sourceItemsChecked = 0;
  let sourceItemsMissing = 0;
  for (const inventory of inventories) {
    byState[inventory.inventory_state] = (byState[inventory.inventory_state] || 0) + 1;
    sourceItemsTotal += inventory.source_items.length;
    sourceItemsChecked += inventory.source_items.filter((item) => item.read_check_performed).length;
    sourceItemsMissing += inventory.source_items.filter((item) => item.exists === false).length;
  }
  return {
    total: inventories.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    checked: byState.checked || 0,
    ready_for_operator_review: byState.ready_for_operator_review || 0,
    source_items_total: sourceItemsTotal,
    source_items_checked: sourceItemsChecked,
    source_items_missing: sourceItemsMissing,
    ready_for_production_render: 0,
    ready_for_upload: 0,
    inventories: inventories.map((inventory) => ({
      source_media_inventory_id: sanitizeRenderPlanString(inventory.source_media_inventory_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(inventory.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(inventory.platform, "[unsafe-platform]"),
      inventory_state: inventory.inventory_state,
      inventory_mode: inventory.inventory_mode,
      source_items_total: inventory.source_items.length,
      source_items_checked: inventory.source_items.filter((item) => item.read_check_performed).length,
      source_items_missing: inventory.source_items.filter((item) => item.exists === false).length,
      created_at: inventory.created_at,
    })),
  };
}

export type OutputDirectoryApprovalMode = "operator_review_only" | "explicit_write_boundary_validation";

export type OutputDirectoryApprovalState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_render_output" | "rejected" | "revoked";

export interface OutputDirectoryPolicy {
  output_directory_approval_required: true;
  output_directory_approved: boolean;
  output_write_allowed: false;
  media_creation_allowed: false;
  overwrite_allowed: false;
  cleanup_required: true;
  output_file_count_limit: 1;
  allowed_output_kinds: Array<"video" | "image" | "audio" | "caption" | "thumbnail" | "manifest">;
}

export interface OutputWriteBoundary {
  output_directory_summary: string;
  directory_exists_checked: boolean;
  directory_writable_checked: boolean;
  directory_created: false;
  raw_path_stored: false;
  allowed_relative_prefix_summary?: string;
  blocking_reasons: string[];
  warnings: string[];
}

export interface OutputDirectoryApprovalValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface OutputDirectoryApproval {
  schema_version: "1.0";
  output_directory_approval_id: string;
  production_render_request_id: string;
  source_media_inventory_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  approval_state: OutputDirectoryApprovalState;
  created_at: string;
  approval_mode: OutputDirectoryApprovalMode;
  output_policy: OutputDirectoryPolicy;
  write_boundary: OutputWriteBoundary;
  validation: {
    ready_for_production_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createOutputDirectoryApproval";
    source_production_render_request_id: string;
    source_source_media_inventory_id: string;
    source_render_plan_id: string;
  };
}

interface OutputDirectoryApprovalsStore {
  schema_version: "1.0";
  created_at: string;
  approvals: OutputDirectoryApproval[];
}

function getOutputDirectoryApprovalsPath(): string {
  return path.join(getRuntimeDir(), "output-directory-approvals.json");
}

function loadOutputDirectoryApprovalsStore(): OutputDirectoryApprovalsStore {
  try {
    const filePath = getOutputDirectoryApprovalsPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as OutputDirectoryApprovalsStore;
    }
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), approvals: [] };
}

function saveOutputDirectoryApprovalsStore(store: OutputDirectoryApprovalsStore): void {
  const filePath = getOutputDirectoryApprovalsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.approvals.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.output_directory_approval_id.localeCompare(b.output_directory_approval_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function resolveSafeOutputDirectoryPath(outputDirectory: string, baseDir?: string): { ok: boolean; absolutePath?: string; blocking_reasons: string[] } {
  const blocking_reasons: string[] = [];
  const summary = summarizeOutputDirectoryReference({ outputDirectory, allowRelativePathSummary: true });
  if (!summary.ok) {
    blocking_reasons.push(...summary.blocking_reasons);
    return { ok: false, blocking_reasons };
  }
  const raw = typeof outputDirectory === "string" ? outputDirectory.trim() : "";
  const resolvedBase = path.resolve(baseDir ?? getRuntimeDir());
  const absolutePath = path.isAbsolute(raw) ? raw : path.resolve(resolvedBase, raw);
  if (!absolutePath.startsWith(resolvedBase + path.sep) && absolutePath !== resolvedBase) {
    blocking_reasons.push("output directory must stay within the safe base directory");
    return { ok: false, blocking_reasons };
  }
  return { ok: true, absolutePath, blocking_reasons: [] };
}

export function summarizeOutputDirectoryReference(input: {
  outputDirectory: string;
  allowRelativePathSummary?: boolean;
}): {
  ok: boolean;
  summary: string;
  blocking_reasons: string[];
  warnings: string[];
} {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof input.outputDirectory !== "string" || input.outputDirectory.length === 0) {
    blocking_reasons.push("output directory must be a string");
    return { ok: false, summary: "[output-directory]", blocking_reasons, warnings };
  }
  const dir = input.outputDirectory.trim();
  if (isForbiddenStringPattern(dir)) {
    blocking_reasons.push("output directory contains forbidden patterns");
    return { ok: false, summary: "[output-directory]", blocking_reasons, warnings };
  }
  if (dir.includes("://") || /^https?:\/\//i.test(dir)) {
    blocking_reasons.push("output directory URLs are not allowed");
    return { ok: false, summary: "[output-directory]", blocking_reasons, warnings };
  }
  if (dir.includes("..")) {
    blocking_reasons.push("output directory traversal is not allowed");
    return { ok: false, summary: "[output-directory]", blocking_reasons, warnings };
  }
  if (path.isAbsolute(dir)) {
    blocking_reasons.push("output directory absolute paths are not allowed");
    return { ok: false, summary: "[output-directory]", blocking_reasons, warnings };
  }
  if (input.allowRelativePathSummary === false) {
    return { ok: true, summary: "[relative-output-directory]", blocking_reasons, warnings };
  }
  return { ok: true, summary: "[output-directory]", blocking_reasons, warnings };
}

function safeOutputDirectorySummary(outputDirectory: string): string {
  const summary = summarizeOutputDirectoryReference({ outputDirectory, allowRelativePathSummary: false });
  return summary.ok ? summary.summary : "[output-directory]";
}

export function createOutputDirectoryApproval(input: {
  request: ControlledProductionRenderRequest;
  inventory: SourceMediaInventory;
  outputDirectory: string;
  approvalMode: "operator_review_only" | "explicit_write_boundary_validation";
  baseDir?: string;
  operatorApproved?: boolean;
}): OutputDirectoryApproval {
  const requestValidation = validateControlledProductionRenderRequest(input.request);
  if (!requestValidation.ok) {
    throw new Error("createOutputDirectoryApproval: request must validate");
  }
  const inventoryValidation = validateSourceMediaInventory(input.inventory);
  if (!inventoryValidation.ok) {
    throw new Error("createOutputDirectoryApproval: inventory must validate");
  }
  if (input.request.production_render_request_id !== input.inventory.production_render_request_id || input.request.render_plan_id !== input.inventory.render_plan_id || input.request.project_id !== input.inventory.project_id || input.request.platform !== input.inventory.platform) {
    throw new Error("createOutputDirectoryApproval: request and inventory must match");
  }
  if (input.request.validation.ready_for_production_render !== false || input.inventory.validation.ready_for_production_render !== false) {
    throw new Error("createOutputDirectoryApproval: request and inventory must not be ready for production render");
  }

  const summary = summarizeOutputDirectoryReference({ outputDirectory: input.outputDirectory, allowRelativePathSummary: false });
  const blockers = [...summary.blocking_reasons];
  const warnings = [...summary.warnings];
  const approvalMode = input.approvalMode;
  let directoryExistsChecked = false;
  let directoryWritableChecked = false;

  if (approvalMode === "explicit_write_boundary_validation") {
    const resolved = resolveSafeOutputDirectoryPath(input.outputDirectory, input.baseDir);
    blockers.push(...resolved.blocking_reasons);
    if (resolved.ok && resolved.absolutePath) {
      directoryExistsChecked = true;
      directoryWritableChecked = true;
      try {
        const stat = fs.existsSync(resolved.absolutePath) ? fs.statSync(resolved.absolutePath) : null;
        if (!stat) {
          warnings.push("Output directory does not currently exist.");
        } else if (!stat.isDirectory()) {
          blockers.push("output directory must be a directory");
        } else {
          try {
            fs.accessSync(resolved.absolutePath, fs.constants.W_OK);
          } catch {
            blockers.push("output directory is not writable");
          }
        }
      } catch {
        blockers.push("output directory validation failed");
      }
    }
  }

  const operatorApproved = input.operatorApproved === true;
  const approvalState: OutputDirectoryApprovalState = blockers.length > 0 ? "blocked" : operatorApproved ? "approved_for_future_render_output" : "ready_for_operator_review";
  if (approvalState === "ready_for_operator_review") {
    warnings.push("Output directory approval pending operator review.");
  }

  return {
    schema_version: "1.0",
    output_directory_approval_id: `output-directory-approval-${crypto.randomUUID()}`,
    production_render_request_id: input.request.production_render_request_id,
    source_media_inventory_id: input.inventory.source_media_inventory_id,
    render_plan_id: input.request.render_plan_id,
    project_id: input.request.project_id,
    platform: input.request.platform,
    approval_state: approvalState,
    created_at: new Date().toISOString(),
    approval_mode: approvalMode,
    output_policy: {
      output_directory_approval_required: true,
      output_directory_approved: operatorApproved && blockers.length === 0,
      output_write_allowed: false,
      media_creation_allowed: false,
      overwrite_allowed: false,
      cleanup_required: true,
      output_file_count_limit: 1,
      allowed_output_kinds: ["video", "image", "audio", "caption", "thumbnail", "manifest"],
    },
    write_boundary: {
      output_directory_summary: safeOutputDirectorySummary(input.outputDirectory),
      directory_exists_checked: directoryExistsChecked,
      directory_writable_checked: directoryWritableChecked,
      directory_created: false,
      raw_path_stored: false,
      ...(input.approvalMode === "explicit_write_boundary_validation" && input.baseDir ? { allowed_relative_prefix_summary: "[safe-relative-prefix]" } : {}),
      blocking_reasons: blockers,
      warnings,
    },
    validation: {
      ready_for_production_render: false,
      ready_for_upload: false,
      blocking_reasons: blockers,
      warnings,
    },
    provenance: {
      generated_by: "createOutputDirectoryApproval",
      source_production_render_request_id: input.request.production_render_request_id,
      source_source_media_inventory_id: input.inventory.source_media_inventory_id,
      source_render_plan_id: input.request.render_plan_id,
    },
  };
}

export function validateOutputDirectoryApproval(approval: unknown): OutputDirectoryApprovalValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (!approval || typeof approval !== "object") {
    return { ok: false, blocking_reasons: ["Output directory approval must be an object"], warnings };
  }
  const a = approval as Record<string, unknown>;
  const required = ["schema_version", "output_directory_approval_id", "production_render_request_id", "source_media_inventory_id", "render_plan_id", "project_id", "platform", "approval_state", "created_at", "approval_mode", "output_policy", "write_boundary", "validation", "provenance"];
  for (const key of required) {
    if (!(key in a)) blocking_reasons.push("Output directory approval is missing a required field");
  }
  if (a.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (!["draft", "blocked", "ready_for_operator_review", "approved_for_future_render_output", "rejected", "revoked"].includes(String(a.approval_state))) blocking_reasons.push("approval_state is invalid");
  if (!["operator_review_only", "explicit_write_boundary_validation"].includes(String(a.approval_mode))) blocking_reasons.push("approval_mode is invalid");
  const forbidden = recursivelyCheckForForbiddenPatterns(approval);
  blocking_reasons.push(...forbidden);
  const text = JSON.stringify(approval);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("stdout") || text.includes("stderr") || text.includes("data=")) {
    blocking_reasons.push("Output directory approval contains forbidden payload content");
  }
  const policy = a.output_policy as Record<string, unknown> | undefined;
  if (!policy || policy.output_directory_approval_required !== true || typeof policy.output_directory_approved !== "boolean" || policy.output_write_allowed !== false || policy.media_creation_allowed !== false || policy.overwrite_allowed !== false || policy.cleanup_required !== true || policy.output_file_count_limit !== 1) {
    blocking_reasons.push("Output policy is unsafe");
  }
  if (!Array.isArray(policy?.allowed_output_kinds) || (policy.allowed_output_kinds as unknown[]).some((kind) => !["video", "image", "audio", "caption", "thumbnail", "manifest"].includes(String(kind)))) {
    blocking_reasons.push("Allowed output kinds are unsafe");
  }
  const boundary = a.write_boundary as Record<string, unknown> | undefined;
  if (!boundary || typeof boundary.output_directory_summary !== "string" || boundary.directory_exists_checked !== false && boundary.directory_exists_checked !== true || boundary.directory_writable_checked !== false && boundary.directory_writable_checked !== true || boundary.directory_created !== false || boundary.raw_path_stored !== false) {
    blocking_reasons.push("Write boundary is unsafe");
  }
  if (typeof boundary?.output_directory_summary === "string" && (boundary.output_directory_summary.includes("://") || boundary.output_directory_summary.startsWith("/") || boundary.output_directory_summary.includes(".."))) {
    blocking_reasons.push("Write boundary summary is unsafe");
  }
  const validation = a.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_production_render !== false || validation.ready_for_upload !== false) {
    blocking_reasons.push("Validation readiness must remain false");
  }
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function saveOutputDirectoryApproval(approval: OutputDirectoryApproval): void {
  const validation = validateOutputDirectoryApproval(approval);
  if (!validation.ok) {
    throw new Error("Unsafe output directory approval cannot be stored.");
  }
  const store = loadOutputDirectoryApprovalsStore();
  const existing = store.approvals.findIndex((item) => item.output_directory_approval_id === approval.output_directory_approval_id);
  if (existing >= 0) store.approvals[existing] = approval;
  else store.approvals.push(approval);
  saveOutputDirectoryApprovalsStore(store);
}

export function listOutputDirectoryApprovals(options?: {
  project_id?: string;
  platform?: string;
  approval_state?: string;
  production_render_request_id?: string;
  source_media_inventory_id?: string;
}): OutputDirectoryApproval[] {
  const store = loadOutputDirectoryApprovalsStore();
  return store.approvals.filter((approval) => {
    if (options?.project_id && approval.project_id !== options.project_id) return false;
    if (options?.platform && approval.platform !== options.platform) return false;
    if (options?.approval_state && approval.approval_state !== options.approval_state) return false;
    if (options?.production_render_request_id && approval.production_render_request_id !== options.production_render_request_id) return false;
    if (options?.source_media_inventory_id && approval.source_media_inventory_id !== options.source_media_inventory_id) return false;
    return true;
  }).sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.output_directory_approval_id.localeCompare(b.output_directory_approval_id);
  });
}

export function getOutputDirectoryApproval(output_directory_approval_id: string): OutputDirectoryApproval | null {
  const store = loadOutputDirectoryApprovalsStore();
  return store.approvals.find((approval) => approval.output_directory_approval_id === output_directory_approval_id) ?? null;
}

export function revokeOutputDirectoryApproval(output_directory_approval_id: string, reason: string): OutputDirectoryApproval {
  const store = loadOutputDirectoryApprovalsStore();
  const approval = store.approvals.find((item) => item.output_directory_approval_id === output_directory_approval_id);
  if (!approval) {
    throw new Error(`Output directory approval not found: ${output_directory_approval_id}`);
  }
  if (typeof reason !== "string" || reason.length === 0) {
    throw new Error("Revoke reason must be a safe string");
  }
  const summary = summarizeOutputDirectoryReference({ outputDirectory: reason, allowRelativePathSummary: false });
  if (!summary.ok) {
    throw new Error("Revoke reason contains unsafe content");
  }
  approval.approval_state = "revoked";
  approval.write_boundary.warnings = [...approval.write_boundary.warnings, "[revoked-by-operator]"];
  approval.validation.warnings = [...approval.validation.warnings, "[revoked-by-operator]"];
  saveOutputDirectoryApproval(approval);
  return approval;
}

export function getOutputDirectoryApprovalReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_future_render_output: number;
  rejected: number;
  revoked: number;
  ready_for_production_render: 0;
  ready_for_upload: 0;
  output_write_allowed: 0;
  media_creation_allowed: 0;
  approvals: Array<{
    output_directory_approval_id: string;
    approval_state: string;
    project_id: string;
    platform: string;
    output_directory_summary: string;
    created_at: string;
  }>;
} {
  const approvals = listOutputDirectoryApprovals(options);
  const byState: Record<string, number> = {};
  for (const approval of approvals) {
    byState[approval.approval_state] = (byState[approval.approval_state] || 0) + 1;
  }
  return {
    total: approvals.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    ready_for_operator_review: byState.ready_for_operator_review || 0,
    approved_for_future_render_output: byState.approved_for_future_render_output || 0,
    rejected: byState.rejected || 0,
    revoked: byState.revoked || 0,
    ready_for_production_render: 0,
    ready_for_upload: 0,
    output_write_allowed: 0,
    media_creation_allowed: 0,
    approvals: approvals.map((approval) => ({
      output_directory_approval_id: sanitizeRenderPlanString(approval.output_directory_approval_id, "[unsafe-id]"),
      approval_state: approval.approval_state,
      project_id: sanitizeRenderPlanString(approval.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(approval.platform, "[unsafe-platform]"),
      output_directory_summary: safeOutputDirectorySummary(approval.write_boundary.output_directory_summary),
      created_at: approval.created_at,
    })),
  };
}

export type FinalProductionRenderExecutionRequestState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_execution_spike" | "rejected" | "revoked";

export type FinalProductionRenderExecutionMode = "final_production_render_execution_request";

export interface FinalRenderRequiredArtifacts {
  production_render_request_validated: boolean;
  source_media_inventory_validated: boolean;
  output_directory_approval_validated: boolean;
  real_execution_approval_validated: boolean;
  command_manifest_validated: boolean;
}

export interface FinalRenderExecutionBoundary {
  real_execution_requested: false;
  execution_enabled: false;
  child_process_allowed: false;
  ffmpeg_execution_allowed: false;
  renderer_execution_allowed: false;
  source_media_read_allowed: true;
  source_media_mutation_allowed: false;
  source_media_copy_allowed: false;
  source_media_transcode_allowed: false;
  output_directory_write_allowed: false;
  media_creation_allowed: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
  env_access_allowed: false;
  process_output_capture_allowed: false;
  raw_command_storage_allowed: false;
}

export interface FinalRenderOperatorReview {
  reviewed_by_label?: string;
  checklist_acknowledged: boolean;
  risk_acknowledgement: boolean;
  understands_no_execution_enabled: boolean;
  understands_no_upload_enabled: boolean;
  decision_note_summary?: string;
}

export interface FinalProductionRenderExecutionRequestValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface FinalProductionRenderExecutionRequest {
  schema_version: "1.0";
  final_render_execution_request_id: string;
  production_render_request_id: string;
  source_media_inventory_id: string;
  output_directory_approval_id: string;
  real_execution_approval_id: string;
  command_manifest_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  request_state: FinalProductionRenderExecutionRequestState;
  created_at: string;
  execution_mode: FinalProductionRenderExecutionMode;
  required_artifacts: FinalRenderRequiredArtifacts;
  execution_boundary: FinalRenderExecutionBoundary;
  operator_review: FinalRenderOperatorReview;
  validation: {
    ready_for_production_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createFinalProductionRenderExecutionRequest";
    source_production_render_request_id: string;
    source_source_media_inventory_id: string;
    source_output_directory_approval_id: string;
    source_real_execution_approval_id: string;
    source_manifest_id: string;
  };
}

interface FinalProductionRenderExecutionRequestsStore {
  schema_version: "1.0";
  created_at: string;
  requests: FinalProductionRenderExecutionRequest[];
}

function getFinalProductionRenderExecutionRequestsPath(): string {
  return path.join(getRuntimeDir(), "final-production-render-execution-requests.json");
}

function loadFinalProductionRenderExecutionRequestsStore(): FinalProductionRenderExecutionRequestsStore {
  try {
    const filePath = getFinalProductionRenderExecutionRequestsPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as FinalProductionRenderExecutionRequestsStore;
    }
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), requests: [] };
}

function saveFinalProductionRenderExecutionRequestsStore(store: FinalProductionRenderExecutionRequestsStore): void {
  const filePath = getFinalProductionRenderExecutionRequestsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.requests.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.final_render_execution_request_id.localeCompare(b.final_render_execution_request_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeFinalReviewLabel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 80 || isForbiddenStringPattern(value) || /[:/\\]/.test(value)) return "[unsafe-review-label]";
  return /^[a-z0-9_-]+$/i.test(value) ? value : "[unsafe-review-label]";
}

function safeFinalReviewNote(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200 || isForbiddenStringPattern(value)) return "[unsafe-review-note]";
  if (value.includes("://") || value.includes("..") || path.isAbsolute(value) || value.includes("stdout") || value.includes("stderr") || value.includes("ffmpeg") || value.includes("videos.insert") || value.includes("Bearer ")) return "[unsafe-review-note]";
  return value;
}

function validateFinalProductionRenderExecutionRequestShape(request: unknown): FinalProductionRenderExecutionRequestValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (!request || typeof request !== "object") return { ok: false, blocking_reasons: ["Final production render execution request must be an object"], warnings };
  const r = request as Record<string, unknown>;
  const required = ["schema_version","final_render_execution_request_id","production_render_request_id","source_media_inventory_id","output_directory_approval_id","real_execution_approval_id","command_manifest_id","render_plan_id","project_id","platform","request_state","created_at","execution_mode","required_artifacts","execution_boundary","operator_review","validation","provenance"];
  for (const key of required) if (!(key in r)) blocking_reasons.push("Final production render execution request is missing a required field");
  if (r.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (r.execution_mode !== "final_production_render_execution_request") blocking_reasons.push("execution_mode must be final_production_render_execution_request");
  if (!["draft","blocked","ready_for_operator_review","approved_for_future_execution_spike","rejected","revoked"].includes(String(r.request_state))) blocking_reasons.push("request_state is invalid");
  const forbidden = recursivelyCheckForForbiddenPatterns(request);
  blocking_reasons.push(...forbidden);
  const text = JSON.stringify(request);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("stdout") || text.includes("stderr") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data=") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../") || text.includes("\"[]\"")) {
    blocking_reasons.push("Final request contains forbidden payload content");
  }
  const boundary = r.execution_boundary as Record<string, unknown> | undefined;
  if (!boundary || boundary.real_execution_requested !== false || boundary.execution_enabled !== false || boundary.child_process_allowed !== false || boundary.ffmpeg_execution_allowed !== false || boundary.renderer_execution_allowed !== false || boundary.source_media_read_allowed !== true || boundary.source_media_mutation_allowed !== false || boundary.source_media_copy_allowed !== false || boundary.source_media_transcode_allowed !== false || boundary.output_directory_write_allowed !== false || boundary.media_creation_allowed !== false || boundary.upload_allowed !== false || boundary.platform_api_calls_allowed !== false || boundary.env_access_allowed !== false || boundary.process_output_capture_allowed !== false || boundary.raw_command_storage_allowed !== false) {
    blocking_reasons.push("Execution boundary is unsafe");
  }
  const artifacts = r.required_artifacts as Record<string, unknown> | undefined;
  if (!artifacts || artifacts.production_render_request_validated !== true || artifacts.source_media_inventory_validated !== true || artifacts.output_directory_approval_validated !== true || artifacts.real_execution_approval_validated !== true || artifacts.command_manifest_validated !== true) blocking_reasons.push("Required artifacts are unsafe");
  const validation = r.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_production_render !== false || validation.ready_for_upload !== false) blocking_reasons.push("Validation readiness must remain false");
  const review = r.operator_review as Record<string, unknown> | undefined;
  if (!review || review.checklist_acknowledged !== false && review.checklist_acknowledged !== true || review.risk_acknowledgement !== false && review.risk_acknowledgement !== true || review.understands_no_execution_enabled !== false && review.understands_no_execution_enabled !== true || review.understands_no_upload_enabled !== false && review.understands_no_upload_enabled !== true) blocking_reasons.push("Operator review is unsafe");
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createFinalProductionRenderExecutionRequest(input: {
  productionRequest: ControlledProductionRenderRequest;
  sourceInventory: SourceMediaInventory;
  outputApproval: OutputDirectoryApproval;
  realExecutionApproval: RealRendererExecutionApproval;
  commandManifest: RenderCommandManifest;
  decision?: "draft" | "approved_for_future_execution_spike" | "rejected";
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  risk_acknowledgement?: boolean;
  understands_no_execution_enabled?: boolean;
  understands_no_upload_enabled?: boolean;
  decision_note_summary?: string;
  dryRun: true;
}): FinalProductionRenderExecutionRequest {
  if (input.dryRun !== true) throw new Error("createFinalProductionRenderExecutionRequest: dryRun=true required");
  const pr = validateControlledProductionRenderRequest(input.productionRequest);
  const inv = validateSourceMediaInventory(input.sourceInventory);
  const oa = validateOutputDirectoryApproval(input.outputApproval);
  const rea = validateRealRendererExecutionApproval(input.realExecutionApproval);
  const cm = validateRenderCommandManifest(input.commandManifest);
  if (!pr.ok) throw new Error("createFinalProductionRenderExecutionRequest: production request must validate");
  if (!inv.ok) throw new Error("createFinalProductionRenderExecutionRequest: source inventory must validate");
  if (!oa.ok) throw new Error("createFinalProductionRenderExecutionRequest: output approval must validate");
  if (!rea.ok) throw new Error("createFinalProductionRenderExecutionRequest: real execution approval must validate");
  if (!cm.ok) throw new Error("createFinalProductionRenderExecutionRequest: command manifest must validate");
  if (input.productionRequest.production_render_request_id !== input.sourceInventory.production_render_request_id || input.productionRequest.production_render_request_id !== input.outputApproval.production_render_request_id || input.productionRequest.real_execution_approval_id !== input.realExecutionApproval.real_execution_approval_id || input.productionRequest.command_manifest_id !== input.commandManifest.command_manifest_id || input.productionRequest.render_plan_id !== input.commandManifest.render_plan_id || input.sourceInventory.render_plan_id !== input.productionRequest.render_plan_id || input.productionRequest.project_id !== input.sourceInventory.project_id || input.productionRequest.platform !== input.sourceInventory.platform || input.outputApproval.project_id !== input.sourceInventory.project_id || input.outputApproval.platform !== input.sourceInventory.platform || input.realExecutionApproval.project_id !== input.sourceInventory.project_id || input.realExecutionApproval.platform !== input.sourceInventory.platform || input.commandManifest.project_id !== input.sourceInventory.project_id || input.commandManifest.platform !== input.sourceInventory.platform) {
    throw new Error("createFinalProductionRenderExecutionRequest: IDs must match across artifacts");
  }
  if (input.outputApproval.approval_state !== "approved_for_future_render_output") throw new Error("createFinalProductionRenderExecutionRequest: output approval must be approved_for_future_render_output");
  if (input.realExecutionApproval.approval_state !== "approved_for_future_real_execution_request") throw new Error("createFinalProductionRenderExecutionRequest: real execution approval must be approved_for_future_real_execution_request");
  const decision = input.decision ?? "draft";
  if (decision === "approved_for_future_execution_spike") {
    if (input.checklist_acknowledged !== true || input.risk_acknowledgement !== true || input.understands_no_execution_enabled !== true || input.understands_no_upload_enabled !== true) {
      throw new Error("createFinalProductionRenderExecutionRequest: operator acknowledgements required");
    }
  }
  const review = {
    reviewed_by_label: safeFinalReviewLabel(input.reviewed_by_label),
    checklist_acknowledged: input.checklist_acknowledged === true,
    risk_acknowledgement: input.risk_acknowledgement === true,
    understands_no_execution_enabled: input.understands_no_execution_enabled === true,
    understands_no_upload_enabled: input.understands_no_upload_enabled === true,
    ...(input.decision_note_summary ? { decision_note_summary: safeFinalReviewNote(input.decision_note_summary) } : {}),
  };
  const request: FinalProductionRenderExecutionRequest = {
    schema_version: "1.0",
    final_render_execution_request_id: `final-render-execution-request-${crypto.randomUUID()}`,
    production_render_request_id: input.productionRequest.production_render_request_id,
    source_media_inventory_id: input.sourceInventory.source_media_inventory_id,
    output_directory_approval_id: input.outputApproval.output_directory_approval_id,
    real_execution_approval_id: input.realExecutionApproval.real_execution_approval_id,
    command_manifest_id: input.commandManifest.command_manifest_id,
    render_plan_id: input.productionRequest.render_plan_id,
    project_id: input.productionRequest.project_id,
    platform: input.productionRequest.platform,
    request_state: decision,
    created_at: new Date().toISOString(),
    execution_mode: "final_production_render_execution_request",
    required_artifacts: {
      production_render_request_validated: true,
      source_media_inventory_validated: true,
      output_directory_approval_validated: true,
      real_execution_approval_validated: true,
      command_manifest_validated: true,
    },
    execution_boundary: {
      real_execution_requested: false,
      execution_enabled: false,
      child_process_allowed: false,
      ffmpeg_execution_allowed: false,
      renderer_execution_allowed: false,
      source_media_read_allowed: true,
      source_media_mutation_allowed: false,
      source_media_copy_allowed: false,
      source_media_transcode_allowed: false,
      output_directory_write_allowed: false,
      media_creation_allowed: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      env_access_allowed: false,
      process_output_capture_allowed: false,
      raw_command_storage_allowed: false,
    },
    operator_review: {
      ...review,
    },
    validation: {
      ready_for_production_render: false,
      ready_for_upload: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: {
      generated_by: "createFinalProductionRenderExecutionRequest",
      source_production_render_request_id: input.productionRequest.production_render_request_id,
      source_source_media_inventory_id: input.sourceInventory.source_media_inventory_id,
      source_output_directory_approval_id: input.outputApproval.output_directory_approval_id,
      source_real_execution_approval_id: input.realExecutionApproval.real_execution_approval_id,
      source_manifest_id: input.commandManifest.command_manifest_id,
    },
  };
  const validation = validateFinalProductionRenderExecutionRequest(request);
  if (!validation.ok) {
    throw new Error("createFinalProductionRenderExecutionRequest: request did not validate");
  }
  if (decision === "approved_for_future_execution_spike" && request.operator_review.reviewed_by_label === "[unsafe-review-label]") {
    throw new Error("createFinalProductionRenderExecutionRequest: unsafe review label rejected");
  }
  return request;
}

export function validateFinalProductionRenderExecutionRequest(request: unknown): FinalProductionRenderExecutionRequestValidationResult {
  return validateFinalProductionRenderExecutionRequestShape(request);
}

export function saveFinalProductionRenderExecutionRequest(request: FinalProductionRenderExecutionRequest): void {
  const validation = validateFinalProductionRenderExecutionRequest(request);
  if (!validation.ok) throw new Error("Unsafe final production render execution request cannot be stored.");
  const store = loadFinalProductionRenderExecutionRequestsStore();
  const existing = store.requests.findIndex((item) => item.final_render_execution_request_id === request.final_render_execution_request_id);
  if (existing >= 0) store.requests[existing] = request;
  else store.requests.push(request);
  saveFinalProductionRenderExecutionRequestsStore(store);
}

export function listFinalProductionRenderExecutionRequests(options?: {
  project_id?: string;
  platform?: string;
  request_state?: string;
  production_render_request_id?: string;
  render_plan_id?: string;
}): FinalProductionRenderExecutionRequest[] {
  const store = loadFinalProductionRenderExecutionRequestsStore();
  return store.requests.filter((request) => {
    if (options?.project_id && request.project_id !== options.project_id) return false;
    if (options?.platform && request.platform !== options.platform) return false;
    if (options?.request_state && request.request_state !== options.request_state) return false;
    if (options?.production_render_request_id && request.production_render_request_id !== options.production_render_request_id) return false;
    if (options?.render_plan_id && request.render_plan_id !== options.render_plan_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.final_render_execution_request_id.localeCompare(b.final_render_execution_request_id);
  });
}

export function getFinalProductionRenderExecutionRequest(final_render_execution_request_id: string): FinalProductionRenderExecutionRequest | null {
  const store = loadFinalProductionRenderExecutionRequestsStore();
  return store.requests.find((request) => request.final_render_execution_request_id === final_render_execution_request_id) ?? null;
}

export function revokeFinalProductionRenderExecutionRequest(final_render_execution_request_id: string, reason: string): FinalProductionRenderExecutionRequest {
  const store = loadFinalProductionRenderExecutionRequestsStore();
  const request = store.requests.find((item) => item.final_render_execution_request_id === final_render_execution_request_id);
  if (!request) throw new Error(`Final production render execution request not found: ${final_render_execution_request_id}`);
  const summary = safeFinalReviewNote(reason);
  if (summary === "[unsafe-review-note]") throw new Error("Revoke reason contains unsafe content");
  request.request_state = "revoked";
  request.operator_review = { ...request.operator_review, decision_note_summary: summary };
  request.validation.warnings = [...request.validation.warnings, "[revoked-by-operator]"];
  saveFinalProductionRenderExecutionRequest(request);
  return request;
}

export function getFinalProductionRenderExecutionRequestReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_future_execution_spike: number;
  rejected: number;
  revoked: number;
  ready_for_production_render: 0;
  ready_for_upload: 0;
  execution_enabled: 0;
  output_directory_write_allowed: 0;
  media_creation_allowed: 0;
  upload_allowed: 0;
  requests: Array<{
    final_render_execution_request_id: string;
    project_id: string;
    platform: string;
    request_state: string;
    production_render_request_id: string;
    render_plan_id: string;
    created_at: string;
  }>;
} {
  const requests = listFinalProductionRenderExecutionRequests(options);
  const byState: Record<string, number> = {};
  for (const request of requests) byState[request.request_state] = (byState[request.request_state] || 0) + 1;
  return {
    total: requests.length,
    by_state: byState,
    blocked: byState.blocked || 0,
    ready_for_operator_review: byState.ready_for_operator_review || 0,
    approved_for_future_execution_spike: byState.approved_for_future_execution_spike || 0,
    rejected: byState.rejected || 0,
    revoked: byState.revoked || 0,
    ready_for_production_render: 0,
    ready_for_upload: 0,
    execution_enabled: 0,
    output_directory_write_allowed: 0,
    media_creation_allowed: 0,
    upload_allowed: 0,
    requests: requests.map((request) => ({
      final_render_execution_request_id: sanitizeRenderPlanString(request.final_render_execution_request_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(request.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(request.platform, "[unsafe-platform]"),
      request_state: request.request_state,
      production_render_request_id: sanitizeRenderPlanString(request.production_render_request_id, "[unsafe-id]"),
      render_plan_id: sanitizeRenderPlanString(request.render_plan_id, "[unsafe-id]"),
      created_at: request.created_at,
    })),
  };
}

export type ControlledProductionRenderSpikeExecutionMode = "controlled_local_production_render_spike";

export interface ControlledProductionRenderSpikeScope {
  production_project_allowed: true;
  source_media_read_allowed: true;
  source_media_mutation_allowed: false;
  source_media_copy_allowed: false;
  source_media_transcode_allowed: false;
  output_write_allowed: true;
  media_creation_allowed: true;
  upload_allowed: false;
  platform_api_calls_allowed: false;
  max_output_files: 1;
}

export interface ControlledProductionRenderSpikePermissions {
  operator_confirmed: true;
  child_process_allowed: true;
  ffmpeg_execution_allowed: true;
  renderer_execution_allowed: false | "ffmpeg_only";
  env_access_allowed: false;
  process_output_capture_allowed: false | "redacted_summary_only";
  raw_command_storage_allowed: false;
}

export interface ControlledProductionRenderSpikeSourceSummary {
  source_item_count: number;
  source_items_used_count: number;
  raw_source_paths_stored: false;
  source_media_mutated: false;
  source_media_copied: false;
  source_media_transcoded: false;
}

export interface ControlledProductionRenderSpikeOutputSummary {
  output_directory_summary: string;
  output_file_count: number;
  output_files_created: boolean;
  media_files_created: boolean;
  output_path_summaries: string[];
  bytes_written?: number;
  duration_seconds?: number;
}

export interface ControlledProductionRenderSpikeProcessSummary {
  command_invoked: boolean;
  command_label: "ffmpeg";
  raw_command_stored: false;
  stdout_stored: false;
  stderr_stored: false;
  exit_code?: number;
  timed_out: boolean;
  runtime_ms?: number;
}

export interface ControlledProductionRenderSpikeResultValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface ControlledProductionRenderSpikeResult {
  schema_version: "1.0";
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  production_render_request_id: string;
  source_media_inventory_id: string;
  output_directory_approval_id: string;
  command_manifest_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  execution_mode: ControlledProductionRenderSpikeExecutionMode;
  created_at: string;
  completed_at?: string;
  spike_scope: ControlledProductionRenderSpikeScope;
  execution_permissions: ControlledProductionRenderSpikePermissions;
  source_summary: ControlledProductionRenderSpikeSourceSummary;
  output_summary: ControlledProductionRenderSpikeOutputSummary;
  process_summary: ControlledProductionRenderSpikeProcessSummary;
  validation: {
    spike_passed: boolean;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "runControlledLocalProductionRenderSpike";
    source_final_render_execution_request_id: string;
    source_production_render_request_id: string;
    source_source_media_inventory_id: string;
    source_output_directory_approval_id: string;
    source_manifest_id: string;
  };
}

interface ControlledProductionRenderSpikeResultsStore {
  schema_version: "1.0";
  created_at: string;
  results: ControlledProductionRenderSpikeResult[];
}

function getControlledProductionRenderSpikeResultsPath(): string {
  return path.join(getRuntimeDir(), "controlled-production-render-spike-results.json");
}

function loadControlledProductionRenderSpikeResultsStore(): ControlledProductionRenderSpikeResultsStore {
  try {
    const filePath = getControlledProductionRenderSpikeResultsPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as ControlledProductionRenderSpikeResultsStore;
    }
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), results: [] };
}

function saveControlledProductionRenderSpikeResultsStore(store: ControlledProductionRenderSpikeResultsStore): void {
  const filePath = getControlledProductionRenderSpikeResultsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.results.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.production_render_spike_result_id.localeCompare(b.production_render_spike_result_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeControlledProductionSpikeOutputDirectorySummary(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 160) return "[unsafe-output-directory]";
  const lower = value.toLowerCase();
  if (isForbiddenStringPattern(value) || lower.includes("://") || lower.startsWith("/users/") || lower.startsWith("/") || lower.includes("..") || lower.includes("stdout") || lower.includes("stderr") || lower.includes("ffmpeg") || lower.includes("videos.insert") || lower.includes("bearer ")) {
    return "[unsafe-output-directory]";
  }
  return value.startsWith("[") ? value : "[output-directory]";
}

function resolveSafeControlledProductionRenderSpikeOutputBaseDir(outputBaseDir: string): { ok: boolean; absolutePath?: string; blocking_reasons: string[] } {
  const blocking_reasons: string[] = [];
  if (typeof outputBaseDir !== "string" || outputBaseDir.length === 0) {
    blocking_reasons.push("outputBaseDir must be a string");
    return { ok: false, blocking_reasons };
  }
  if (outputBaseDir.includes("://") || outputBaseDir.startsWith("http") || outputBaseDir.startsWith("https")) {
    blocking_reasons.push("outputBaseDir URLs are not allowed");
    return { ok: false, blocking_reasons };
  }
  if (outputBaseDir.includes("..")) {
    blocking_reasons.push("outputBaseDir traversal is not allowed");
    return { ok: false, blocking_reasons };
  }
  if (isForbiddenStringPattern(outputBaseDir)) {
    blocking_reasons.push("outputBaseDir contains forbidden patterns");
    return { ok: false, blocking_reasons };
  }
  const resolved = path.isAbsolute(outputBaseDir) ? path.resolve(outputBaseDir) : path.resolve(getRuntimeDir(), outputBaseDir);
  if (!isSafeRuntimeRoot(resolved)) {
    blocking_reasons.push("outputBaseDir must be inside a safe runtime or temp directory");
    return { ok: false, blocking_reasons };
  }
  return { ok: true, absolutePath: resolved, blocking_reasons: [] };
}

function validateControlledProductionRenderSpikeResultShape(result: unknown): ControlledProductionRenderSpikeResultValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof result !== "object" || result === null) {
    return { ok: false, blocking_reasons: ["Controlled production render spike result must be an object"], warnings };
  }
  const r = result as Record<string, unknown>;
  const required = ["schema_version", "production_render_spike_result_id", "final_render_execution_request_id", "production_render_request_id", "source_media_inventory_id", "output_directory_approval_id", "command_manifest_id", "render_plan_id", "project_id", "platform", "execution_mode", "created_at", "spike_scope", "execution_permissions", "source_summary", "output_summary", "process_summary", "validation", "provenance"];
  for (const key of required) {
    if (!(key in r)) blocking_reasons.push("Controlled production render spike result is missing a required field");
  }
  if (r.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (r.execution_mode !== "controlled_local_production_render_spike") blocking_reasons.push("execution_mode must be controlled_local_production_render_spike");
  blocking_reasons.push(...recursivelyCheckForForbiddenPatterns(result));
  const text = JSON.stringify(result);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("\"stdout\":") || text.includes("\"stderr\":") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data=") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../") || text.includes("\"[]\"")) {
    blocking_reasons.push("Controlled production render spike result contains forbidden payload content");
  }
  const spikeScope = r.spike_scope as Record<string, unknown> | undefined;
  if (!spikeScope || spikeScope.production_project_allowed !== true || spikeScope.source_media_read_allowed !== true || spikeScope.source_media_mutation_allowed !== false || spikeScope.source_media_copy_allowed !== false || spikeScope.source_media_transcode_allowed !== false || spikeScope.output_write_allowed !== true || spikeScope.media_creation_allowed !== true || spikeScope.upload_allowed !== false || spikeScope.platform_api_calls_allowed !== false || spikeScope.max_output_files !== 1) {
    blocking_reasons.push("Spike scope is unsafe");
  }
  const perms = r.execution_permissions as Record<string, unknown> | undefined;
  if (!perms || perms.operator_confirmed !== true || perms.child_process_allowed !== true || perms.ffmpeg_execution_allowed !== true || (perms.renderer_execution_allowed !== false && perms.renderer_execution_allowed !== "ffmpeg_only") || perms.env_access_allowed !== false || perms.raw_command_storage_allowed !== false) {
    blocking_reasons.push("Execution permissions are unsafe");
  }
  if (!(perms?.process_output_capture_allowed === false || perms?.process_output_capture_allowed === "redacted_summary_only")) {
    blocking_reasons.push("process_output_capture_allowed must be false or redacted_summary_only");
  }
  const sourceSummary = r.source_summary as Record<string, unknown> | undefined;
  if (!sourceSummary || sourceSummary.raw_source_paths_stored !== false || sourceSummary.source_media_mutated !== false || sourceSummary.source_media_copied !== false || sourceSummary.source_media_transcoded !== false) {
    blocking_reasons.push("Source summary is unsafe");
  }
  const output = r.output_summary as Record<string, unknown> | undefined;
  if (!output) blocking_reasons.push("Output summary is required");
  if (output?.output_file_count !== undefined && typeof output.output_file_count === "number" && output.output_file_count > 1) blocking_reasons.push("output_file_count exceeds limit");
  if (output?.duration_seconds !== undefined && typeof output.duration_seconds === "number" && output.duration_seconds > 15) blocking_reasons.push("duration_seconds exceeds limit");
  if (typeof output?.output_directory_summary === "string") {
    const summary = String(output.output_directory_summary).toLowerCase();
    if (summary.includes("/users/") || summary.includes("://") || summary.includes("..") || summary.includes("stdout") || summary.includes("stderr") || summary.includes("bearer ")) {
      blocking_reasons.push("Output directory summary is unsafe");
    }
  }
  const process = r.process_summary as Record<string, unknown> | undefined;
  if (!process || process.command_invoked !== true || process.command_label !== "ffmpeg" || process.raw_command_stored !== false || process.stdout_stored !== false || process.stderr_stored !== false) {
    blocking_reasons.push("Process summary is unsafe");
  }
  if (r.validation && typeof r.validation === "object") {
    const validation = r.validation as Record<string, unknown>;
    if (validation.ready_for_upload !== false) blocking_reasons.push("ready_for_upload must be false");
  }
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function validateControlledProductionRenderSpikePermission(input: {
  finalRequest: FinalProductionRenderExecutionRequest;
  sourceInventory: SourceMediaInventory;
  outputApproval: OutputDirectoryApproval;
  dryRun: false;
  executionMode: "controlled_local_production_render_spike";
  operatorConfirmed: true;
  allowChildProcess: true;
  allowFfmpeg: true;
  allowSourceMediaRead: true;
  allowOutputWrite: true;
  allowMediaCreation: true;
  allowUpload: false;
  allowPlatformApiCalls: false;
  outputBaseDir: string;
}): ValidationResult {
  const blockingReasons: string[] = [];
  if (input.dryRun !== false) blockingReasons.push("dryRun must be false");
  if (input.executionMode !== "controlled_local_production_render_spike") blockingReasons.push("executionMode must be controlled_local_production_render_spike");
  if (input.operatorConfirmed !== true || input.allowChildProcess !== true || input.allowFfmpeg !== true || input.allowSourceMediaRead !== true || input.allowOutputWrite !== true || input.allowMediaCreation !== true || input.allowUpload !== false || input.allowPlatformApiCalls !== false) {
    blockingReasons.push("Explicit production render spike permissions are required");
  }
  const finalValidation = validateFinalProductionRenderExecutionRequest(input.finalRequest);
  if (!finalValidation.ok) blockingReasons.push("finalRequest must validate");
  if (input.finalRequest.request_state !== "approved_for_future_execution_spike") blockingReasons.push("finalRequest must be approved_for_future_execution_spike");
  if (input.finalRequest.validation.ready_for_production_render !== false || input.finalRequest.validation.ready_for_upload !== false) blockingReasons.push("finalRequest readiness must remain false");
  const inventoryValidation = validateSourceMediaInventory(input.sourceInventory);
  if (!inventoryValidation.ok) blockingReasons.push("sourceInventory must validate");
  const approvalValidation = validateOutputDirectoryApproval(input.outputApproval);
  if (!approvalValidation.ok) blockingReasons.push("outputApproval must validate");
  if (input.outputApproval.approval_state !== "approved_for_future_render_output") blockingReasons.push("outputApproval must be approved_for_future_render_output");
  if (input.outputApproval.output_policy.output_write_allowed !== false) blockingReasons.push("outputApproval must remain write-disabled");
  const resolved = resolveSafeControlledProductionRenderSpikeOutputBaseDir(input.outputBaseDir);
  blockingReasons.push(...resolved.blocking_reasons);
  const sourceItemsUsed = input.sourceInventory.source_items.filter((item) => item.read_check_performed === true && item.exists !== false);
  if (sourceItemsUsed.length === 0) blockingReasons.push("At least one read-checked source item is required");
  return { ok: blockingReasons.length === 0, blocking_reasons: blockingReasons, warnings: [] };
}

export function runControlledLocalProductionRenderSpike(input: {
  finalRequest: FinalProductionRenderExecutionRequest;
  sourceInventory: SourceMediaInventory;
  outputApproval: OutputDirectoryApproval;
  dryRun: false;
  executionMode: "controlled_local_production_render_spike";
  operatorConfirmed: true;
  allowChildProcess: true;
  allowFfmpeg: true;
  allowSourceMediaRead: true;
  allowOutputWrite: true;
  allowMediaCreation: true;
  allowUpload: false;
  allowPlatformApiCalls: false;
  outputBaseDir: string;
  timeoutMs?: number;
}): ControlledProductionRenderSpikeResult {
  const permission = validateControlledProductionRenderSpikePermission(input);
  const startedAt = Date.now();
  const baseResult = (extra?: Partial<ControlledProductionRenderSpikeResult>): ControlledProductionRenderSpikeResult => ({
    schema_version: "1.0",
    production_render_spike_result_id: `production-render-spike-${crypto.randomUUID()}`,
    final_render_execution_request_id: input.finalRequest.final_render_execution_request_id,
    production_render_request_id: input.finalRequest.production_render_request_id,
    source_media_inventory_id: input.finalRequest.source_media_inventory_id,
    output_directory_approval_id: input.finalRequest.output_directory_approval_id,
    command_manifest_id: input.finalRequest.command_manifest_id,
    render_plan_id: input.finalRequest.render_plan_id,
    project_id: input.finalRequest.project_id,
    platform: input.finalRequest.platform,
    execution_mode: "controlled_local_production_render_spike",
    created_at: new Date(startedAt).toISOString(),
    completed_at: new Date().toISOString(),
    spike_scope: {
      production_project_allowed: true,
      source_media_read_allowed: true,
      source_media_mutation_allowed: false,
      source_media_copy_allowed: false,
      source_media_transcode_allowed: false,
      output_write_allowed: true,
      media_creation_allowed: true,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      max_output_files: 1,
    },
    execution_permissions: {
      operator_confirmed: true,
      child_process_allowed: true,
      ffmpeg_execution_allowed: true,
      renderer_execution_allowed: false,
      env_access_allowed: false,
      process_output_capture_allowed: "redacted_summary_only",
      raw_command_storage_allowed: false,
    },
    source_summary: {
      source_item_count: input.sourceInventory.source_items.length,
      source_items_used_count: input.sourceInventory.source_items.filter((item) => item.read_check_performed === true && item.exists !== false).length,
      raw_source_paths_stored: false,
      source_media_mutated: false,
      source_media_copied: false,
      source_media_transcoded: false,
    },
    output_summary: {
      output_directory_summary: safeControlledProductionSpikeOutputDirectorySummary(input.outputBaseDir),
      output_file_count: 0,
      output_files_created: false,
      media_files_created: false,
      output_path_summaries: [],
      duration_seconds: 0,
    },
    process_summary: {
      command_invoked: true,
      command_label: "ffmpeg",
      raw_command_stored: false,
      stdout_stored: false,
      stderr_stored: false,
      exit_code: 1,
      timed_out: false,
      runtime_ms: 0,
    },
    validation: {
      spike_passed: false,
      ready_for_upload: false,
      blocking_reasons: permission.blocking_reasons,
      warnings: permission.warnings,
    },
    provenance: {
      generated_by: "runControlledLocalProductionRenderSpike",
      source_final_render_execution_request_id: input.finalRequest.final_render_execution_request_id,
      source_production_render_request_id: input.finalRequest.production_render_request_id,
      source_source_media_inventory_id: input.finalRequest.source_media_inventory_id,
      source_output_directory_approval_id: input.finalRequest.output_directory_approval_id,
      source_manifest_id: input.finalRequest.command_manifest_id,
    },
    ...(extra ?? {}),
    ...(extra?.validation ? { validation: { ...({
      spike_passed: false,
      ready_for_upload: false,
      blocking_reasons: permission.blocking_reasons,
      warnings: permission.warnings,
    } as ControlledProductionRenderSpikeResult["validation"]), ...extra.validation } } : {}),
  });

  if (!permission.ok) return baseResult();
  const resolvedBase = resolveSafeControlledProductionRenderSpikeOutputBaseDir(input.outputBaseDir);
  if (!resolvedBase.ok || !resolvedBase.absolutePath) {
    return baseResult({ validation: { spike_passed: false, ready_for_upload: false, blocking_reasons: resolvedBase.blocking_reasons, warnings: [] } });
  }
  const resultId = `production-render-spike-${crypto.randomUUID()}`;
  const spikeDir = path.join(resolvedBase.absolutePath, "production-render-spike", resultId);
  fs.mkdirSync(spikeDir, { recursive: true });
  const outputPath = path.join(spikeDir, "production-render-spike.png");
  const started = Date.now();
  const require = createRequire(import.meta.url);
  const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
  const ffmpegResult = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=navy:s=160x90:d=1", "-frames:v", "1", "-y", outputPath], { timeout: Math.min(input.timeoutMs ?? 15000, 15000), stdio: "ignore" });
  const runtimeMs = Date.now() - started;
  const outputExists = fs.existsSync(outputPath);
  const bytesWritten = outputExists ? fs.statSync(outputPath).size : 0;
  const sourceItemsUsedCount = input.sourceInventory.source_items.filter((item) => item.read_check_performed === true && item.exists !== false).length;
  const passed = ffmpegResult.status === 0 && outputExists && bytesWritten > 0 && sourceItemsUsedCount > 0;
  const result: ControlledProductionRenderSpikeResult = {
    schema_version: "1.0",
    production_render_spike_result_id: resultId,
    final_render_execution_request_id: input.finalRequest.final_render_execution_request_id,
    production_render_request_id: input.finalRequest.production_render_request_id,
    source_media_inventory_id: input.finalRequest.source_media_inventory_id,
    output_directory_approval_id: input.finalRequest.output_directory_approval_id,
    command_manifest_id: input.finalRequest.command_manifest_id,
    render_plan_id: input.finalRequest.render_plan_id,
    project_id: input.finalRequest.project_id,
    platform: input.finalRequest.platform,
    execution_mode: "controlled_local_production_render_spike",
    created_at: new Date(startedAt).toISOString(),
    completed_at: new Date().toISOString(),
    spike_scope: {
      production_project_allowed: true,
      source_media_read_allowed: true,
      source_media_mutation_allowed: false,
      source_media_copy_allowed: false,
      source_media_transcode_allowed: false,
      output_write_allowed: true,
      media_creation_allowed: true,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      max_output_files: 1,
    },
    execution_permissions: {
      operator_confirmed: true,
      child_process_allowed: true,
      ffmpeg_execution_allowed: true,
      renderer_execution_allowed: false,
      env_access_allowed: false,
      process_output_capture_allowed: "redacted_summary_only",
      raw_command_storage_allowed: false,
    },
    source_summary: {
      source_item_count: input.sourceInventory.source_items.length,
      source_items_used_count: sourceItemsUsedCount,
      raw_source_paths_stored: false,
      source_media_mutated: false,
      source_media_copied: false,
      source_media_transcoded: false,
    },
    output_summary: {
      output_directory_summary: `[ignored-runtime-production-dir]/production-render-spike/${resultId}`,
      output_file_count: outputExists ? 1 : 0,
      output_files_created: outputExists,
      media_files_created: outputExists,
      output_path_summaries: outputExists ? ["[production-render-spike-output]"] : [],
      ...(bytesWritten > 0 ? { bytes_written: bytesWritten } : {}),
      duration_seconds: 1,
    },
    process_summary: {
      command_invoked: true,
      command_label: "ffmpeg",
      raw_command_stored: false,
      stdout_stored: false,
      stderr_stored: false,
      exit_code: typeof ffmpegResult.status === "number" ? ffmpegResult.status : 1,
      timed_out: Boolean(ffmpegResult.error && ffmpegResult.error.name === "Error" && String(ffmpegResult.error.message).includes("timed out")),
      runtime_ms: runtimeMs,
    },
    validation: {
      spike_passed: passed,
      ready_for_upload: false,
      blocking_reasons: passed ? [] : ["Controlled production render spike did not complete successfully"],
      warnings: passed ? ["Controlled local spike completed; no upload or API calls were performed."] : ["FFmpeg unavailable or controlled spike failed."],
    },
    provenance: {
      generated_by: "runControlledLocalProductionRenderSpike",
      source_final_render_execution_request_id: input.finalRequest.final_render_execution_request_id,
      source_production_render_request_id: input.finalRequest.production_render_request_id,
      source_source_media_inventory_id: input.finalRequest.source_media_inventory_id,
      source_output_directory_approval_id: input.finalRequest.output_directory_approval_id,
      source_manifest_id: input.finalRequest.command_manifest_id,
    },
  };
  if (!validateControlledProductionRenderSpikeResult(result).ok) {
    return baseResult({ validation: { spike_passed: false, ready_for_upload: false, blocking_reasons: ["Controlled production render spike result did not validate"], warnings: [] } });
  }
  return result;
}

export function validateControlledProductionRenderSpikeResult(result: unknown): ControlledProductionRenderSpikeResultValidationResult {
  return validateControlledProductionRenderSpikeResultShape(result);
}

export function saveControlledProductionRenderSpikeResult(result: ControlledProductionRenderSpikeResult): void {
  const validation = validateControlledProductionRenderSpikeResult(result);
  if (!validation.ok) throw new Error("Unsafe controlled production render spike result cannot be stored.");
  const store = loadControlledProductionRenderSpikeResultsStore();
  const existing = store.results.findIndex((item) => item.production_render_spike_result_id === result.production_render_spike_result_id);
  if (existing >= 0) store.results[existing] = result;
  else store.results.push(result);
  saveControlledProductionRenderSpikeResultsStore(store);
}

export function listControlledProductionRenderSpikeResults(options?: {
  project_id?: string;
  platform?: string;
  execution_mode?: string;
  spike_passed?: boolean;
  final_render_execution_request_id?: string;
}): ControlledProductionRenderSpikeResult[] {
  const store = loadControlledProductionRenderSpikeResultsStore();
  return store.results.filter((result) => {
    if (options?.project_id && result.project_id !== options.project_id) return false;
    if (options?.platform && result.platform !== options.platform) return false;
    if (options?.execution_mode && result.execution_mode !== options.execution_mode) return false;
    if (typeof options?.spike_passed === "boolean" && result.validation.spike_passed !== options.spike_passed) return false;
    if (options?.final_render_execution_request_id && result.final_render_execution_request_id !== options.final_render_execution_request_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.production_render_spike_result_id.localeCompare(b.production_render_spike_result_id);
  });
}

export function getControlledProductionRenderSpikeResult(production_render_spike_result_id: string): ControlledProductionRenderSpikeResult | null {
  const store = loadControlledProductionRenderSpikeResultsStore();
  return store.results.find((result) => result.production_render_spike_result_id === production_render_spike_result_id) ?? null;
}

export function getControlledProductionRenderSpikeResultReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  passed: number;
  failed: number;
  ready_for_upload: 0;
  media_files_created: number;
  output_file_count: number;
  upload_allowed: 0;
  platform_api_calls_allowed: 0;
  results: Array<{
    production_render_spike_result_id: string;
    project_id: string;
    platform: string;
    execution_mode: string;
    spike_passed: boolean;
    output_file_count: number;
    media_files_created: boolean;
    created_at: string;
  }>;
} {
  const results = listControlledProductionRenderSpikeResults(options);
  let passed = 0;
  let mediaFilesCreated = 0;
  let outputFileCount = 0;
  const summaries = results.map((result) => {
    if (result.validation.spike_passed) passed++;
    if (result.output_summary.media_files_created) mediaFilesCreated++;
    outputFileCount += result.output_summary.output_file_count;
    return {
      production_render_spike_result_id: sanitizeRenderPlanString(result.production_render_spike_result_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(result.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(result.platform, "[unsafe-platform]"),
      execution_mode: result.execution_mode,
      spike_passed: result.validation.spike_passed,
      output_file_count: result.output_summary.output_file_count,
      media_files_created: result.output_summary.media_files_created,
      created_at: result.created_at,
    };
  });
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    ready_for_upload: 0,
    media_files_created: mediaFilesCreated,
    output_file_count: outputFileCount,
    upload_allowed: 0,
    platform_api_calls_allowed: 0,
    results: summaries,
  };
}

export type LocalOutputOperatorReviewMode = "metadata_review_only" | "operator_visual_review_record";

export type LocalOutputOperatorReviewState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_upload_design" | "rejected" | "revoked";

export interface LocalOutputArtifactSummary {
  output_file_count: number;
  media_files_created: boolean;
  raw_output_paths_stored: false;
  output_path_summaries: string[];
  output_file_accessed_for_review: boolean;
  output_file_modified: false;
  output_file_copied: false;
  output_file_moved: false;
  output_file_deleted: false;
  output_file_uploaded: false;
}

export interface LocalOutputOperatorReviewChecklist {
  reviewed_by_label?: string;
  checklist_acknowledged: boolean;
  content_quality_acknowledged: boolean;
  platform_fit_acknowledged: boolean;
  rights_and_safety_acknowledged: boolean;
  understands_no_upload_enabled: boolean;
  decision_note_summary?: string;
}

export interface LocalOutputReviewDecision {
  decision: "draft" | "approved_for_upload_design" | "rejected" | "revoked";
  decision_reasons: string[];
  blocking_reasons: string[];
  warnings: string[];
}

export interface LocalOutputOperatorReviewValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface LocalOutputOperatorReview {
  schema_version: "1.0";
  local_output_review_id: string;
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  production_render_request_id: string;
  output_directory_approval_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  review_state: LocalOutputOperatorReviewState;
  created_at: string;
  review_mode: LocalOutputOperatorReviewMode;
  output_artifact_summary: LocalOutputArtifactSummary;
  operator_review: LocalOutputOperatorReviewChecklist;
  review_decision: LocalOutputReviewDecision;
  validation: {
    ready_for_upload_design: boolean;
    ready_for_upload: false;
    upload_allowed: false;
    platform_api_calls_allowed: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createLocalOutputOperatorReview" | "revokeLocalOutputOperatorReview";
    source_production_render_spike_result_id: string;
    source_final_render_execution_request_id: string;
    source_production_render_request_id: string;
    source_output_directory_approval_id: string;
    source_manifest_id: string;
  };
}

interface LocalOutputOperatorReviewsStore {
  schema_version: "1.0";
  created_at: string;
  reviews: LocalOutputOperatorReview[];
}

function getLocalOutputOperatorReviewsPath(): string {
  return path.join(getRuntimeDir(), "local-output-operator-reviews.json");
}

function loadLocalOutputOperatorReviewsStore(): LocalOutputOperatorReviewsStore {
  try {
    const filePath = getLocalOutputOperatorReviewsPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as LocalOutputOperatorReviewsStore;
    }
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), reviews: [] };
}

function saveLocalOutputOperatorReviewsStore(store: LocalOutputOperatorReviewsStore): void {
  const filePath = getLocalOutputOperatorReviewsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.reviews.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.local_output_review_id.localeCompare(b.local_output_review_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeLocalOutputArtifactSummary(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 160) return "[unsafe-output-artifact]";
  const lower = value.toLowerCase();
  if (isForbiddenStringPattern(value) || lower.includes("://") || lower.startsWith("/users/") || lower.startsWith("/") || lower.includes("..") || lower.includes("stdout") || lower.includes("stderr") || lower.includes("ffmpeg") || lower.includes("videos.insert") || lower.includes("bearer ")) {
    return "[unsafe-output-artifact]";
  }
  return value.startsWith("[") ? value : "[output-artifact]";
}

function validateLocalOutputOperatorReviewShape(review: unknown): LocalOutputOperatorReviewValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof review !== "object" || review === null) return { ok: false, blocking_reasons: ["Local output operator review must be an object"], warnings };
  const r = review as Record<string, unknown>;
  const required = ["schema_version", "local_output_review_id", "production_render_spike_result_id", "final_render_execution_request_id", "production_render_request_id", "output_directory_approval_id", "render_plan_id", "project_id", "platform", "review_state", "created_at", "review_mode", "output_artifact_summary", "operator_review", "review_decision", "validation", "provenance"];
  for (const key of required) {
    if (!(key in r)) blocking_reasons.push("Local output operator review is missing a required field");
  }
  if (r.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (r.review_mode !== "metadata_review_only" && r.review_mode !== "operator_visual_review_record") blocking_reasons.push("review_mode is unsafe");
  if (!["draft", "blocked", "ready_for_operator_review", "approved_for_upload_design", "rejected", "revoked"].includes(String(r.review_state))) {
    blocking_reasons.push("review_state is unsafe");
  }
  blocking_reasons.push(...recursivelyCheckForForbiddenPatterns(review));
  const text = JSON.stringify(review);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("\"stdout\":") || text.includes("\"stderr\":") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data=") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../")) {
    blocking_reasons.push("Local output operator review contains forbidden payload content");
  }
  const art = r.output_artifact_summary as Record<string, unknown> | undefined;
  if (!art || art.raw_output_paths_stored !== false || art.output_file_modified !== false || art.output_file_copied !== false || art.output_file_moved !== false || art.output_file_deleted !== false || art.output_file_uploaded !== false) {
    blocking_reasons.push("Output artifact summary is unsafe");
  }
  if (typeof art?.output_file_count === "number" && art.output_file_count > 1) blocking_reasons.push("output_file_count exceeds limit");
  const reviewChecklist = r.operator_review as Record<string, unknown> | undefined;
  if (!reviewChecklist || reviewChecklist.checklist_acknowledged !== true || reviewChecklist.content_quality_acknowledged !== true || reviewChecklist.platform_fit_acknowledged !== true || reviewChecklist.rights_and_safety_acknowledged !== true || reviewChecklist.understands_no_upload_enabled !== true) {
    blocking_reasons.push("Operator review checklist is unsafe");
  }
  const decision = r.review_decision as Record<string, unknown> | undefined;
  if (!decision || !["draft", "approved_for_upload_design", "rejected", "revoked"].includes(String(decision.decision)) || decision.decision_reasons === undefined || decision.blocking_reasons === undefined || decision.warnings === undefined) {
    blocking_reasons.push("Review decision is unsafe");
  }
  const validation = r.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_upload !== false || validation.upload_allowed !== false || validation.platform_api_calls_allowed !== false) {
    blocking_reasons.push("Validation state is unsafe");
  }
  if (validation?.ready_for_upload_design !== undefined && typeof validation.ready_for_upload_design === "boolean" && validation.ready_for_upload_design === true && decision?.decision !== "approved_for_upload_design") {
    warnings.push("ready_for_upload_design is only appropriate for approved reviews");
  }
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createLocalOutputOperatorReview(input: {
  spikeResult: ControlledProductionRenderSpikeResult;
  decision?: "draft" | "approved_for_upload_design" | "rejected";
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  content_quality_acknowledged?: boolean;
  platform_fit_acknowledged?: boolean;
  rights_and_safety_acknowledged?: boolean;
  understands_no_upload_enabled?: boolean;
  decision_note_summary?: string;
  dryRun: true;
}): LocalOutputOperatorReview {
  if (input.dryRun !== true) throw new Error("dryRun must be true");
  if (!validateControlledProductionRenderSpikeResult(input.spikeResult).ok) throw new Error("spikeResult must validate");
  if (input.spikeResult.output_summary.output_file_count > 1) throw new Error("output_file_count exceeds limit");
  if (input.spikeResult.validation.ready_for_upload !== false) throw new Error("spikeResult must not be ready for upload");
  const decision = input.decision ?? "draft";
  const reviewedBy = sanitizeRenderPlanString(input.reviewed_by_label ?? "", "[unsafe-reviewer]");
  const note = sanitizeRenderPlanString(input.decision_note_summary ?? "", "[unsafe-review-note]");
  const checklist = {
    checklist_acknowledged: input.checklist_acknowledged === true,
    content_quality_acknowledged: input.content_quality_acknowledged === true,
    platform_fit_acknowledged: input.platform_fit_acknowledged === true,
    rights_and_safety_acknowledged: input.rights_and_safety_acknowledged === true,
    understands_no_upload_enabled: input.understands_no_upload_enabled === true,
    ...(note !== "" ? { decision_note_summary: note } : {}),
    ...(reviewedBy !== "" ? { reviewed_by_label: reviewedBy } : {}),
  };
  const approved = decision === "approved_for_upload_design";
  if (approved && (!input.spikeResult.validation.spike_passed || checklist.checklist_acknowledged !== true || checklist.content_quality_acknowledged !== true || checklist.platform_fit_acknowledged !== true || checklist.rights_and_safety_acknowledged !== true || checklist.understands_no_upload_enabled !== true)) {
    throw new Error("approved_for_upload_design requires safe acknowledgements");
  }
  const review: LocalOutputOperatorReview = {
    schema_version: "1.0",
    local_output_review_id: `local-output-review-${crypto.randomUUID()}`,
    production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
    final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
    production_render_request_id: input.spikeResult.production_render_request_id,
    output_directory_approval_id: input.spikeResult.output_directory_approval_id,
    render_plan_id: input.spikeResult.render_plan_id,
    project_id: input.spikeResult.project_id,
    platform: input.spikeResult.platform,
    review_state: approved ? "approved_for_upload_design" : "ready_for_operator_review",
    created_at: new Date().toISOString(),
    review_mode: "metadata_review_only",
    output_artifact_summary: {
      output_file_count: input.spikeResult.output_summary.output_file_count,
      media_files_created: input.spikeResult.output_summary.media_files_created,
      raw_output_paths_stored: false,
      output_path_summaries: input.spikeResult.output_summary.output_path_summaries.map((item) => safeControlledProductionSpikeOutputDirectorySummary(item)),
      output_file_accessed_for_review: input.spikeResult.output_summary.output_file_count > 0,
      output_file_modified: false,
      output_file_copied: false,
      output_file_moved: false,
      output_file_deleted: false,
      output_file_uploaded: false,
    },
    operator_review: checklist,
    review_decision: {
      decision,
      decision_reasons: approved ? ["Local output is safe to design an upload package for."] : [],
      blocking_reasons: approved ? [] : [],
      warnings: approved ? ["This approval does not enable upload."] : [],
    },
    validation: {
      ready_for_upload_design: approved && input.spikeResult.validation.spike_passed,
      ready_for_upload: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      blocking_reasons: [],
      warnings: approved ? ["No upload or platform API calls are enabled."] : [],
    },
    provenance: {
      generated_by: "createLocalOutputOperatorReview",
      source_production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
      source_final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
      source_production_render_request_id: input.spikeResult.production_render_request_id,
      source_output_directory_approval_id: input.spikeResult.output_directory_approval_id,
      source_manifest_id: input.spikeResult.command_manifest_id,
    },
  };
  if (!validateLocalOutputOperatorReview(review).ok) throw new Error("Unsafe local output operator review cannot be created.");
  return review;
}

export function validateLocalOutputOperatorReview(review: unknown): LocalOutputOperatorReviewValidationResult {
  return validateLocalOutputOperatorReviewShape(review);
}

export function saveLocalOutputOperatorReview(review: LocalOutputOperatorReview): void {
  const validation = validateLocalOutputOperatorReview(review);
  if (!validation.ok) throw new Error("Unsafe local output operator review cannot be stored.");
  const store = loadLocalOutputOperatorReviewsStore();
  const existing = store.reviews.findIndex((item) => item.local_output_review_id === review.local_output_review_id);
  if (existing >= 0) store.reviews[existing] = review;
  else store.reviews.push(review);
  saveLocalOutputOperatorReviewsStore(store);
}

export function listLocalOutputOperatorReviews(options?: {
  project_id?: string;
  platform?: string;
  review_state?: string;
  production_render_spike_result_id?: string;
  final_render_execution_request_id?: string;
}): LocalOutputOperatorReview[] {
  const store = loadLocalOutputOperatorReviewsStore();
  return store.reviews.filter((review) => {
    if (options?.project_id && review.project_id !== options.project_id) return false;
    if (options?.platform && review.platform !== options.platform) return false;
    if (options?.review_state && review.review_state !== options.review_state) return false;
    if (options?.production_render_spike_result_id && review.production_render_spike_result_id !== options.production_render_spike_result_id) return false;
    if (options?.final_render_execution_request_id && review.final_render_execution_request_id !== options.final_render_execution_request_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.local_output_review_id.localeCompare(b.local_output_review_id);
  });
}

export function getLocalOutputOperatorReview(local_output_review_id: string): LocalOutputOperatorReview | null {
  const store = loadLocalOutputOperatorReviewsStore();
  return store.reviews.find((review) => review.local_output_review_id === local_output_review_id) ?? null;
}

export function revokeLocalOutputOperatorReview(local_output_review_id: string, reason: string): LocalOutputOperatorReview {
  const review = getLocalOutputOperatorReview(local_output_review_id);
  if (!review) throw new Error("Local output operator review not found");
  const safeReason = sanitizeRenderPlanString(reason, "[unsafe-review-reason]");
  if (safeReason === "[unsafe-review-reason]") throw new Error("Unsafe local output operator review reason cannot be stored.");
  const revoked: LocalOutputOperatorReview = {
    ...review,
    review_state: "revoked",
    review_decision: {
      ...review.review_decision,
      decision: "revoked",
      blocking_reasons: [...review.review_decision.blocking_reasons, safeReason],
      warnings: [...review.review_decision.warnings, "Review revoked."],
    },
    provenance: {
      ...review.provenance,
      generated_by: "revokeLocalOutputOperatorReview",
    },
  };
  saveLocalOutputOperatorReview(revoked);
  return revoked;
}

export function getLocalOutputOperatorReviewReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_upload_design: number;
  rejected: number;
  revoked: number;
  ready_for_upload_design: number;
  ready_for_upload: 0;
  upload_allowed: 0;
  platform_api_calls_allowed: 0;
  reviews: Array<{
    local_output_review_id: string;
    project_id: string;
    platform: string;
    review_state: string;
    output_file_count: number;
    created_at: string;
  }>;
} {
  const reviews = listLocalOutputOperatorReviews(options);
  const byState: Record<string, number> = {};
  let blocked = 0;
  let readyForReview = 0;
  let approved = 0;
  let rejected = 0;
  let revoked = 0;
  let readyForUploadDesign = 0;
  const summaries = reviews.map((review) => {
    byState[review.review_state] = (byState[review.review_state] ?? 0) + 1;
    if (review.review_state === "blocked") blocked++;
    if (review.review_state === "ready_for_operator_review") readyForReview++;
    if (review.review_state === "approved_for_upload_design") approved++;
    if (review.review_state === "rejected") rejected++;
    if (review.review_state === "revoked") revoked++;
    if (review.validation.ready_for_upload_design) readyForUploadDesign++;
    return {
      local_output_review_id: sanitizeRenderPlanString(review.local_output_review_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(review.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(review.platform, "[unsafe-platform]"),
      review_state: review.review_state,
      output_file_count: review.output_artifact_summary.output_file_count,
      created_at: review.created_at,
    };
  });
  return {
    total: reviews.length,
    by_state: byState,
    blocked,
    ready_for_operator_review: readyForReview,
    approved_for_upload_design: approved,
    rejected,
    revoked,
    ready_for_upload_design: readyForUploadDesign,
    ready_for_upload: 0,
    upload_allowed: 0,
    platform_api_calls_allowed: 0,
    reviews: summaries,
  };
}

export type UploadPackageDesignMode = "metadata_package_design_only" | "operator_review_package_design";

export type UploadPackageDesignState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_upload_request_design" | "rejected" | "revoked";

export interface UploadPackageMediaArtifactSummary {
  output_file_count: number;
  media_files_created: boolean;
  raw_output_paths_stored: false;
  output_path_summaries: string[];
  output_file_modified: false;
  output_file_copied: false;
  output_file_moved: false;
  output_file_deleted: false;
  output_file_uploaded: false;
}

export interface UploadPackagePlatformTarget {
  platform: string;
  account_reference_summary?: string;
  channel_or_profile_reference_summary?: string;
  raw_account_ids_stored: false;
  platform_api_payload_created: false;
}

export interface UploadPackageMetadataPlan {
  title_summary: string;
  description_summary: string;
  tags_summary: string[];
  category_summary?: string;
  visibility_summary: string;
  thumbnail_summary?: string;
  metadata_payload_created: false;
  raw_platform_payload_stored: false;
}

export interface UploadPackageConstraints {
  upload_allowed: false;
  platform_api_calls_allowed: false;
  resumable_upload_allowed: false;
  direct_upload_allowed: false;
  credentials_required: false;
  credentials_accessed: false;
  token_accessed: false;
  env_access_allowed: false;
  max_upload_attempts: 0;
}

export interface UploadPackageOperatorReview {
  reviewed_by_label?: string;
  checklist_acknowledged: boolean;
  metadata_quality_acknowledged: boolean;
  platform_target_acknowledged: boolean;
  understands_no_upload_enabled: boolean;
  decision_note_summary?: string;
}

export interface UploadPackageDesignValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface UploadPackageDesign {
  schema_version: "1.0";
  upload_package_design_id: string;
  local_output_review_id: string;
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  design_state: UploadPackageDesignState;
  created_at: string;
  package_mode: UploadPackageDesignMode;
  media_artifact_summary: UploadPackageMediaArtifactSummary;
  platform_target: UploadPackagePlatformTarget;
  metadata_plan: UploadPackageMetadataPlan;
  upload_constraints: UploadPackageConstraints;
  operator_review: UploadPackageOperatorReview;
  validation: {
    ready_for_upload_request_design: boolean;
    ready_for_upload: false;
    upload_allowed: false;
    platform_api_calls_allowed: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createUploadPackageDesign" | "revokeUploadPackageDesign";
    source_local_output_review_id: string;
    source_production_render_spike_result_id: string;
    source_final_render_execution_request_id: string;
    source_render_plan_id: string;
  };
}

interface UploadPackageDesignsStore {
  schema_version: "1.0";
  created_at: string;
  designs: UploadPackageDesign[];
}

function getUploadPackageDesignsPath(): string {
  return path.join(getRuntimeDir(), "upload-package-designs.json");
}

function loadUploadPackageDesignsStore(): UploadPackageDesignsStore {
  try {
    const filePath = getUploadPackageDesignsPath();
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8")) as UploadPackageDesignsStore;
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), designs: [] };
}

function saveUploadPackageDesignsStore(store: UploadPackageDesignsStore): void {
  const filePath = getUploadPackageDesignsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.designs.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.upload_package_design_id.localeCompare(b.upload_package_design_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeUploadPackageDesignString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const lower = value.toLowerCase();
  if (value.length === 0 || value.length > 120 || isForbiddenStringPattern(value) || lower.includes("://") || lower.startsWith("/users/") || lower.startsWith("/") || lower.includes("..") || lower.includes("stdout") || lower.includes("stderr") || lower.includes("ffmpeg") || lower.includes("videos.insert") || lower.includes("bearer ")) return fallback;
  return value;
}

function looksLikeRawUploadPlatformId(value: unknown): boolean {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11,}$/.test(value) && !value.startsWith("[") && !value.endsWith("]");
}

function validateUploadPackageDesignShape(design: unknown): UploadPackageDesignValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof design !== "object" || design === null) return { ok: false, blocking_reasons: ["Upload package design must be an object"], warnings };
  const d = design as Record<string, unknown>;
  const required = ["schema_version", "upload_package_design_id", "local_output_review_id", "production_render_spike_result_id", "final_render_execution_request_id", "render_plan_id", "project_id", "platform", "design_state", "created_at", "package_mode", "media_artifact_summary", "platform_target", "metadata_plan", "upload_constraints", "operator_review", "validation", "provenance"];
  for (const key of required) if (!(key in d)) blocking_reasons.push("Upload package design is missing a required field");
  if (d.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (d.package_mode !== "metadata_package_design_only" && d.package_mode !== "operator_review_package_design") blocking_reasons.push("package_mode is unsafe");
  if (!["draft", "blocked", "ready_for_operator_review", "approved_for_upload_request_design", "rejected", "revoked"].includes(String(d.design_state))) blocking_reasons.push("design_state is unsafe");
  const allowedForbiddenKeySubstrings = new Set(["token_accessed"]);
  const scan = (value: unknown): void => {
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (isForbiddenStringPattern(value) || lower.includes("process.env") || lower.includes("stdout") || lower.includes("stderr") || lower.includes("base64,") || lower.startsWith("data:")) blocking_reasons.push("Upload package design contains unsafe string content");
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item);
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (isForbiddenStringPattern(key) && !allowedForbiddenKeySubstrings.has(key)) blocking_reasons.push("Upload package design contains unsafe key content");
        scan(nested);
      }
    }
  };
  scan(design);
  const text = JSON.stringify(design);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("\"stdout\":") || text.includes("\"stderr\":") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data=") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../")) {
    blocking_reasons.push("Upload package design contains forbidden payload content");
  }
  const media = d.media_artifact_summary as Record<string, unknown> | undefined;
  if (!media || media.raw_output_paths_stored !== false || media.output_file_modified !== false || media.output_file_copied !== false || media.output_file_moved !== false || media.output_file_deleted !== false || media.output_file_uploaded !== false) {
    blocking_reasons.push("Media artifact summary is unsafe");
  }
  if (typeof media?.output_file_count === "number" && media.output_file_count > 1) blocking_reasons.push("output_file_count exceeds limit");
  const platformTarget = d.platform_target as Record<string, unknown> | undefined;
  if (!platformTarget || platformTarget.raw_account_ids_stored !== false || platformTarget.platform_api_payload_created !== false) blocking_reasons.push("Platform target is unsafe");
  if (looksLikeRawUploadPlatformId(platformTarget?.account_reference_summary) || looksLikeRawUploadPlatformId(platformTarget?.channel_or_profile_reference_summary)) blocking_reasons.push("Platform target contains unsafe account identifiers");
  const metadataPlan = d.metadata_plan as Record<string, unknown> | undefined;
  if (!metadataPlan || metadataPlan.metadata_payload_created !== false || metadataPlan.raw_platform_payload_stored !== false) blocking_reasons.push("Metadata plan is unsafe");
  const constraints = d.upload_constraints as Record<string, unknown> | undefined;
  if (!constraints || constraints.upload_allowed !== false || constraints.platform_api_calls_allowed !== false || constraints.resumable_upload_allowed !== false || constraints.direct_upload_allowed !== false || constraints.credentials_required !== false || constraints.credentials_accessed !== false || constraints.token_accessed !== false || constraints.env_access_allowed !== false || constraints.max_upload_attempts !== 0) {
    blocking_reasons.push("Upload constraints are unsafe");
  }
  const review = d.operator_review as Record<string, unknown> | undefined;
  if (!review || review.checklist_acknowledged !== true || review.metadata_quality_acknowledged !== true || review.platform_target_acknowledged !== true || review.understands_no_upload_enabled !== true) blocking_reasons.push("Operator review is unsafe");
  const validation = d.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_upload !== false || validation.upload_allowed !== false || validation.platform_api_calls_allowed !== false) blocking_reasons.push("Validation state is unsafe");
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createUploadPackageDesign(input: {
  localOutputReview: LocalOutputOperatorReview;
  spikeResult: ControlledProductionRenderSpikeResult;
  decision?: "draft" | "approved_for_upload_request_design" | "rejected";
  platform_target_summary?: string;
  account_reference_summary?: string;
  channel_or_profile_reference_summary?: string;
  title_summary?: string;
  description_summary?: string;
  tags_summary?: string[];
  category_summary?: string;
  visibility_summary?: string;
  thumbnail_summary?: string;
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  metadata_quality_acknowledged?: boolean;
  platform_target_acknowledged?: boolean;
  understands_no_upload_enabled?: boolean;
  decision_note_summary?: string;
  dryRun: true;
}): UploadPackageDesign {
  if (input.dryRun !== true) throw new Error("dryRun must be true");
  if (!validateLocalOutputOperatorReview(input.localOutputReview).ok) throw new Error("localOutputReview must validate");
  if (!validateControlledProductionRenderSpikeResult(input.spikeResult).ok) throw new Error("spikeResult must validate");
  if (input.localOutputReview.review_state !== "approved_for_upload_design") throw new Error("localOutputReview must be approved_for_upload_design");
  if (input.localOutputReview.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.localOutputReview.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.localOutputReview.render_plan_id !== input.spikeResult.render_plan_id || input.localOutputReview.project_id !== input.spikeResult.project_id || input.localOutputReview.platform !== input.spikeResult.platform) {
    throw new Error("Upload package design IDs must match");
  }
  const decision = input.decision ?? "draft";
  const approved = decision === "approved_for_upload_request_design";
  const reviewedBy = safeUploadPackageDesignString(input.reviewed_by_label ?? "", "[unsafe-reviewer]");
  const note = safeUploadPackageDesignString(input.decision_note_summary ?? "", "[unsafe-review-note]");
  const platformTargetSummary = safeUploadPackageDesignString(input.platform_target_summary ?? "", "[platform-target]");
  const accountReferenceSummary = safeUploadPackageDesignString(input.account_reference_summary ?? "", "[account-reference]");
  const channelReferenceSummary = safeUploadPackageDesignString(input.channel_or_profile_reference_summary ?? "", "[channel-reference]");
  const titleSummary = safeUploadPackageDesignString(input.title_summary ?? "", "[title]");
  const descriptionSummary = safeUploadPackageDesignString(input.description_summary ?? "", "[description]");
  const categorySummary = input.category_summary ? safeUploadPackageDesignString(input.category_summary, "[category]") : undefined;
  const visibilitySummary = safeUploadPackageDesignString(input.visibility_summary ?? "", "[visibility]");
  const thumbnailSummary = input.thumbnail_summary ? safeUploadPackageDesignString(input.thumbnail_summary, "[thumbnail]") : undefined;
  if (approved && (!input.checklist_acknowledged || !input.metadata_quality_acknowledged || !input.platform_target_acknowledged || !input.understands_no_upload_enabled)) {
    throw new Error("approved_for_upload_request_design requires acknowledgements");
  }
  const design: UploadPackageDesign = {
    schema_version: "1.0",
    upload_package_design_id: `upload-package-design-${crypto.randomUUID()}`,
    local_output_review_id: input.localOutputReview.local_output_review_id,
    production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
    final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
    render_plan_id: input.spikeResult.render_plan_id,
    project_id: input.spikeResult.project_id,
    platform: input.spikeResult.platform,
    design_state: approved ? "approved_for_upload_request_design" : "ready_for_operator_review",
    created_at: new Date().toISOString(),
    package_mode: "metadata_package_design_only",
    media_artifact_summary: {
      output_file_count: input.spikeResult.output_summary.output_file_count,
      media_files_created: input.spikeResult.output_summary.media_files_created,
      raw_output_paths_stored: false,
      output_path_summaries: input.spikeResult.output_summary.output_path_summaries.map((item) => sanitizeRenderPlanString(item, "[unsafe-output-artifact]")),
      output_file_modified: false,
      output_file_copied: false,
      output_file_moved: false,
      output_file_deleted: false,
      output_file_uploaded: false,
    },
    platform_target: {
      platform: input.spikeResult.platform,
      ...(accountReferenceSummary !== "" ? { account_reference_summary: accountReferenceSummary } : {}),
      ...(channelReferenceSummary !== "" ? { channel_or_profile_reference_summary: channelReferenceSummary } : {}),
      raw_account_ids_stored: false,
      platform_api_payload_created: false,
    },
    metadata_plan: {
      title_summary: titleSummary || "[title]",
      description_summary: descriptionSummary || "[description]",
      tags_summary: (input.tags_summary ?? []).map((item) => safeUploadPackageDesignString(item, "[tag]")),
      ...(categorySummary ? { category_summary: categorySummary } : {}),
      visibility_summary: visibilitySummary || "[visibility]",
      ...(thumbnailSummary ? { thumbnail_summary: thumbnailSummary } : {}),
      metadata_payload_created: false,
      raw_platform_payload_stored: false,
    },
    upload_constraints: {
      upload_allowed: false,
      platform_api_calls_allowed: false,
      resumable_upload_allowed: false,
      direct_upload_allowed: false,
      credentials_required: false,
      credentials_accessed: false,
      token_accessed: false,
      env_access_allowed: false,
      max_upload_attempts: 0,
    },
    operator_review: {
      ...(reviewedBy ? { reviewed_by_label: reviewedBy } : {}),
      checklist_acknowledged: input.checklist_acknowledged === true,
      metadata_quality_acknowledged: input.metadata_quality_acknowledged === true,
      platform_target_acknowledged: input.platform_target_acknowledged === true,
      understands_no_upload_enabled: input.understands_no_upload_enabled === true,
      ...(note ? { decision_note_summary: note } : {}),
    },
    validation: {
      ready_for_upload_request_design: approved && input.localOutputReview.review_state === "approved_for_upload_design" && input.spikeResult.validation.spike_passed,
      ready_for_upload: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      blocking_reasons: [],
      warnings: approved ? ["No upload or platform API calls are enabled."] : [],
    },
    provenance: {
      generated_by: "createUploadPackageDesign",
      source_local_output_review_id: input.localOutputReview.local_output_review_id,
      source_production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
      source_final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
      source_render_plan_id: input.spikeResult.render_plan_id,
    },
  };
  if (!validateUploadPackageDesign(design).ok) throw new Error("Unsafe upload package design cannot be created.");
  return design;
}

export function validateUploadPackageDesign(design: unknown): UploadPackageDesignValidationResult {
  return validateUploadPackageDesignShape(design);
}

export function saveUploadPackageDesign(design: UploadPackageDesign): void {
  const validation = validateUploadPackageDesign(design);
  if (!validation.ok) throw new Error("Unsafe upload package design cannot be stored.");
  const store = loadUploadPackageDesignsStore();
  const existing = store.designs.findIndex((item) => item.upload_package_design_id === design.upload_package_design_id);
  if (existing >= 0) store.designs[existing] = design;
  else store.designs.push(design);
  saveUploadPackageDesignsStore(store);
}

export function listUploadPackageDesigns(options?: {
  project_id?: string;
  platform?: string;
  design_state?: string;
  local_output_review_id?: string;
  production_render_spike_result_id?: string;
}): UploadPackageDesign[] {
  const store = loadUploadPackageDesignsStore();
  return store.designs.filter((design) => {
    if (options?.project_id && design.project_id !== options.project_id) return false;
    if (options?.platform && design.platform !== options.platform) return false;
    if (options?.design_state && design.design_state !== options.design_state) return false;
    if (options?.local_output_review_id && design.local_output_review_id !== options.local_output_review_id) return false;
    if (options?.production_render_spike_result_id && design.production_render_spike_result_id !== options.production_render_spike_result_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.upload_package_design_id.localeCompare(b.upload_package_design_id);
  });
}

export function getUploadPackageDesign(upload_package_design_id: string): UploadPackageDesign | null {
  const store = loadUploadPackageDesignsStore();
  return store.designs.find((design) => design.upload_package_design_id === upload_package_design_id) ?? null;
}

export function revokeUploadPackageDesign(upload_package_design_id: string, reason: string): UploadPackageDesign {
  const design = getUploadPackageDesign(upload_package_design_id);
  if (!design) throw new Error("Upload package design not found");
  const safeReason = safeUploadPackageDesignString(reason, "[unsafe-reason]");
  if (safeReason === "[unsafe-reason]") throw new Error("Unsafe upload package design reason cannot be stored.");
  const revoked: UploadPackageDesign = {
    ...design,
    design_state: "revoked",
    validation: {
      ...design.validation,
      blocking_reasons: [...design.validation.blocking_reasons, safeReason],
      warnings: [...design.validation.warnings, "Design revoked."],
    },
    provenance: { ...design.provenance, generated_by: "revokeUploadPackageDesign" },
  };
  saveUploadPackageDesign(revoked);
  return revoked;
}

export function getUploadPackageDesignReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_upload_request_design: number;
  rejected: number;
  revoked: number;
  ready_for_upload_request_design: number;
  ready_for_upload: 0;
  upload_allowed: 0;
  platform_api_calls_allowed: 0;
  designs: Array<{
    upload_package_design_id: string;
    project_id: string;
    platform: string;
    design_state: string;
    output_file_count: number;
    created_at: string;
  }>;
} {
  const designs = listUploadPackageDesigns(options);
  const byState: Record<string, number> = {};
  let blocked = 0;
  let ready = 0;
  let approved = 0;
  let rejected = 0;
  let revoked = 0;
  let readyDesign = 0;
  const summaries = designs.map((design) => {
    byState[design.design_state] = (byState[design.design_state] ?? 0) + 1;
    if (design.design_state === "blocked") blocked++;
    if (design.design_state === "ready_for_operator_review") ready++;
    if (design.design_state === "approved_for_upload_request_design") approved++;
    if (design.design_state === "rejected") rejected++;
    if (design.design_state === "revoked") revoked++;
    if (design.validation.ready_for_upload_request_design) readyDesign++;
    return {
      upload_package_design_id: sanitizeRenderPlanString(design.upload_package_design_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(design.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(design.platform, "[unsafe-platform]"),
      design_state: design.design_state,
      output_file_count: design.media_artifact_summary.output_file_count,
      created_at: design.created_at,
    };
  });
  return {
    total: designs.length,
    by_state: byState,
    blocked,
    ready_for_operator_review: ready,
    approved_for_upload_request_design: approved,
    rejected,
    revoked,
    ready_for_upload_request_design: readyDesign,
    ready_for_upload: 0,
    upload_allowed: 0,
    platform_api_calls_allowed: 0,
    designs: summaries,
  };
}

export type PlatformUploadRequestMode = "platform_upload_request_design_only" | "operator_review_upload_request";
export type PlatformUploadRequestState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_upload_execution" | "rejected" | "revoked";

export interface PlatformUploadMediaArtifactSummary {
  output_file_count: number;
  media_files_created: boolean;
  raw_output_paths_stored: false;
  output_path_summaries: string[];
  output_file_modified: false;
  output_file_copied: false;
  output_file_moved: false;
  output_file_deleted: false;
  output_file_uploaded: false;
}

export interface PlatformUploadTarget {
  platform: string;
  account_reference_summary?: string;
  channel_or_profile_reference_summary?: string;
  raw_account_ids_stored: false;
  platform_api_payload_created: false;
  platform_endpoint_selected: false;
}

export interface PlatformUploadMetadataRequest {
  title_summary: string;
  description_summary: string;
  tags_summary: string[];
  category_summary?: string;
  visibility_summary: string;
  thumbnail_summary?: string;
  metadata_payload_created: false;
  raw_platform_payload_stored: false;
}

export interface PlatformUploadExecutionBoundary {
  upload_requested: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  platform_api_calls_allowed: false;
  resumable_upload_allowed: false;
  direct_upload_allowed: false;
  credentials_required: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_access_allowed: false;
  max_upload_attempts: 0;
  dry_run_only: true;
}

export interface PlatformUploadOperatorReview {
  reviewed_by_label?: string;
  checklist_acknowledged: boolean;
  upload_risk_acknowledged: boolean;
  platform_target_acknowledged: boolean;
  metadata_acknowledged: boolean;
  understands_no_upload_enabled: boolean;
  understands_no_credentials_accessed: boolean;
  decision_note_summary?: string;
}

export interface PlatformUploadRequestValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface PlatformUploadRequest {
  schema_version: "1.0";
  platform_upload_request_id: string;
  upload_package_design_id: string;
  local_output_review_id: string;
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  request_state: PlatformUploadRequestState;
  created_at: string;
  request_mode: PlatformUploadRequestMode;
  media_artifact_summary: PlatformUploadMediaArtifactSummary;
  platform_target: PlatformUploadTarget;
  metadata_request: PlatformUploadMetadataRequest;
  upload_execution_boundary: PlatformUploadExecutionBoundary;
  operator_review: PlatformUploadOperatorReview;
  validation: {
    ready_for_upload_execution_review: boolean;
    ready_for_upload: false;
    upload_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    token_accessed: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createPlatformUploadRequest" | "revokePlatformUploadRequest";
    source_upload_package_design_id: string;
    source_local_output_review_id: string;
    source_production_render_spike_result_id: string;
    source_final_render_execution_request_id: string;
    source_render_plan_id: string;
  };
}

interface PlatformUploadRequestsStore {
  schema_version: "1.0";
  created_at: string;
  requests: PlatformUploadRequest[];
}

function getPlatformUploadRequestsPath(): string {
  return path.join(getRuntimeDir(), "platform-upload-requests.json");
}

function loadPlatformUploadRequestsStore(): PlatformUploadRequestsStore {
  try {
    const filePath = getPlatformUploadRequestsPath();
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8")) as PlatformUploadRequestsStore;
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), requests: [] };
}

function savePlatformUploadRequestsStore(store: PlatformUploadRequestsStore): void {
  const filePath = getPlatformUploadRequestsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.requests.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.platform_upload_request_id.localeCompare(b.platform_upload_request_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safePlatformUploadRequestString(value: unknown, fallback: string): string {
  const text = safeUploadPackageDesignString(value, fallback);
  if (text === fallback) return fallback;
  const lower = text.toLowerCase();
  if (lower.includes("keychain://") || lower.includes("credential_reference") || lower.includes("access_token") || lower.includes("refresh_token") || lower.includes("client_secret") || lower.includes("code_verifier") || lower.includes("authorization_code") || lower.includes("bearer") || lower.includes("process.env") || lower.includes("stdout") || lower.includes("stderr")) return fallback;
  return text;
}

function validatePlatformUploadRequestShape(request: unknown): PlatformUploadRequestValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof request !== "object" || request === null) return { ok: false, blocking_reasons: ["Platform upload request must be an object"], warnings };
  const r = request as Record<string, unknown>;
  const required = ["schema_version", "platform_upload_request_id", "upload_package_design_id", "local_output_review_id", "production_render_spike_result_id", "final_render_execution_request_id", "render_plan_id", "project_id", "platform", "request_state", "created_at", "request_mode", "media_artifact_summary", "platform_target", "metadata_request", "upload_execution_boundary", "operator_review", "validation", "provenance"];
  for (const key of required) if (!(key in r)) blocking_reasons.push("Platform upload request is missing a required field");
  if (r.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (r.request_mode !== "platform_upload_request_design_only" && r.request_mode !== "operator_review_upload_request") blocking_reasons.push("request_mode is unsafe");
  if (!["draft", "blocked", "ready_for_operator_review", "approved_for_future_upload_execution", "rejected", "revoked"].includes(String(r.request_state))) blocking_reasons.push("request_state is unsafe");
  const scan = (value: unknown): void => {
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (isForbiddenStringPattern(value) || lower.includes("process.env") || lower.includes("stdout") || lower.includes("stderr") || lower.includes("base64,") || lower.startsWith("data:")) blocking_reasons.push("Platform upload request contains unsafe string content");
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item);
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (key !== "token_accessed" && isForbiddenStringPattern(key)) blocking_reasons.push("Platform upload request contains unsafe key content");
        scan(nested);
      }
    }
  };
  scan(request);
  const text = JSON.stringify(request);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("stdout") || text.includes("stderr") || text.includes("ffmpeg") || text.includes("Bearer ") || text.includes("data=") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../")) {
    blocking_reasons.push("Platform upload request contains forbidden payload content");
  }
  const media = r.media_artifact_summary as Record<string, unknown> | undefined;
  if (!media || media.raw_output_paths_stored !== false || media.output_file_modified !== false || media.output_file_copied !== false || media.output_file_moved !== false || media.output_file_deleted !== false || media.output_file_uploaded !== false) blocking_reasons.push("Media artifact summary is unsafe");
  const platformTarget = r.platform_target as Record<string, unknown> | undefined;
  if (!platformTarget || platformTarget.raw_account_ids_stored !== false || platformTarget.platform_api_payload_created !== false || platformTarget.platform_endpoint_selected !== false) blocking_reasons.push("Platform target is unsafe");
  if (looksLikeRawUploadPlatformId(platformTarget?.account_reference_summary) || looksLikeRawUploadPlatformId(platformTarget?.channel_or_profile_reference_summary)) blocking_reasons.push("Platform target contains unsafe account identifiers");
  const metadata = r.metadata_request as Record<string, unknown> | undefined;
  if (!metadata || metadata.metadata_payload_created !== false || metadata.raw_platform_payload_stored !== false) blocking_reasons.push("Metadata request is unsafe");
  const boundary = r.upload_execution_boundary as Record<string, unknown> | undefined;
  if (!boundary || boundary.upload_requested !== false || boundary.upload_allowed !== false || boundary.upload_execution_enabled !== false || boundary.platform_api_calls_allowed !== false || boundary.resumable_upload_allowed !== false || boundary.direct_upload_allowed !== false || boundary.credentials_required !== false || boundary.credentials_accessed !== false || boundary.token_accessed !== false || boundary.keychain_accessed !== false || boundary.env_access_allowed !== false || boundary.max_upload_attempts !== 0 || boundary.dry_run_only !== true) blocking_reasons.push("Upload execution boundary is unsafe");
  const review = r.operator_review as Record<string, unknown> | undefined;
  if (!review || review.checklist_acknowledged !== true || review.upload_risk_acknowledged !== true || review.platform_target_acknowledged !== true || review.metadata_acknowledged !== true || review.understands_no_upload_enabled !== true || review.understands_no_credentials_accessed !== true) blocking_reasons.push("Operator review is unsafe");
  const validation = r.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_upload !== false || validation.upload_allowed !== false || validation.platform_api_calls_allowed !== false || validation.credentials_accessed !== false || validation.token_accessed !== false) blocking_reasons.push("Validation state is unsafe");
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createPlatformUploadRequest(input: {
  uploadPackageDesign: UploadPackageDesign;
  localOutputReview: LocalOutputOperatorReview;
  spikeResult: ControlledProductionRenderSpikeResult;
  decision?: "draft" | "approved_for_future_upload_execution" | "rejected";
  platform_target_summary?: string;
  account_reference_summary?: string;
  channel_or_profile_reference_summary?: string;
  title_summary?: string;
  description_summary?: string;
  tags_summary?: string[];
  category_summary?: string;
  visibility_summary?: string;
  thumbnail_summary?: string;
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  upload_risk_acknowledged?: boolean;
  platform_target_acknowledged?: boolean;
  metadata_acknowledged?: boolean;
  understands_no_upload_enabled?: boolean;
  understands_no_credentials_accessed?: boolean;
  decision_note_summary?: string;
  dryRun: true;
}): PlatformUploadRequest {
  if (input.dryRun !== true) throw new Error("dryRun must be true");
  if (!validateUploadPackageDesign(input.uploadPackageDesign).ok) throw new Error("uploadPackageDesign must validate");
  if (!validateLocalOutputOperatorReview(input.localOutputReview).ok) throw new Error("localOutputReview must validate");
  if (!validateControlledProductionRenderSpikeResult(input.spikeResult).ok) throw new Error("spikeResult must validate");
  if (input.uploadPackageDesign.design_state !== "approved_for_upload_request_design") throw new Error("uploadPackageDesign must be approved_for_upload_request_design");
  if (input.uploadPackageDesign.local_output_review_id !== input.localOutputReview.local_output_review_id || input.uploadPackageDesign.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.uploadPackageDesign.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.uploadPackageDesign.render_plan_id !== input.spikeResult.render_plan_id || input.uploadPackageDesign.project_id !== input.spikeResult.project_id || input.uploadPackageDesign.platform !== input.spikeResult.platform) {
    throw new Error("Platform upload request artifacts must match");
  }
  const decision = input.decision ?? "draft";
  const approved = decision === "approved_for_future_upload_execution";
  const reviewedBy = safePlatformUploadRequestString(input.reviewed_by_label ?? "", "[unsafe-reviewer]");
  const note = safePlatformUploadRequestString(input.decision_note_summary ?? "", "[unsafe-review-note]");
  const accountReferenceSummary = safePlatformUploadRequestString(input.account_reference_summary ?? "", "[account-reference]");
  const channelReferenceSummary = safePlatformUploadRequestString(input.channel_or_profile_reference_summary ?? "", "[channel-reference]");
  const titleSummary = safePlatformUploadRequestString(input.title_summary ?? "", "[title]");
  const descriptionSummary = safePlatformUploadRequestString(input.description_summary ?? "", "[description]");
  const categorySummary = input.category_summary ? safePlatformUploadRequestString(input.category_summary, "[category]") : undefined;
  const visibilitySummary = safePlatformUploadRequestString(input.visibility_summary ?? "", "[visibility]");
  const thumbnailSummary = input.thumbnail_summary ? safePlatformUploadRequestString(input.thumbnail_summary, "[thumbnail]") : undefined;
  if (approved && (!input.checklist_acknowledged || !input.upload_risk_acknowledged || !input.platform_target_acknowledged || !input.metadata_acknowledged || !input.understands_no_upload_enabled || !input.understands_no_credentials_accessed)) {
    throw new Error("approved_for_future_upload_execution requires acknowledgements");
  }
  const request: PlatformUploadRequest = {
    schema_version: "1.0",
    platform_upload_request_id: `platform-upload-request-${crypto.randomUUID()}`,
    upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
    local_output_review_id: input.localOutputReview.local_output_review_id,
    production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
    final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
    render_plan_id: input.spikeResult.render_plan_id,
    project_id: input.spikeResult.project_id,
    platform: input.spikeResult.platform,
    request_state: approved ? "approved_for_future_upload_execution" : "ready_for_operator_review",
    created_at: new Date().toISOString(),
    request_mode: "platform_upload_request_design_only",
    media_artifact_summary: {
      output_file_count: input.spikeResult.output_summary.output_file_count,
      media_files_created: input.spikeResult.output_summary.media_files_created,
      raw_output_paths_stored: false,
      output_path_summaries: input.spikeResult.output_summary.output_path_summaries.map((item) => sanitizeRenderPlanString(item, "[unsafe-output-artifact]")),
      output_file_modified: false,
      output_file_copied: false,
      output_file_moved: false,
      output_file_deleted: false,
      output_file_uploaded: false,
    },
    platform_target: {
      platform: input.spikeResult.platform,
      ...(accountReferenceSummary !== "" ? { account_reference_summary: accountReferenceSummary } : {}),
      ...(channelReferenceSummary !== "" ? { channel_or_profile_reference_summary: channelReferenceSummary } : {}),
      raw_account_ids_stored: false,
      platform_api_payload_created: false,
      platform_endpoint_selected: false,
    },
    metadata_request: {
      title_summary: titleSummary || "[title]",
      description_summary: descriptionSummary || "[description]",
      tags_summary: (input.tags_summary ?? []).map((item) => safePlatformUploadRequestString(item, "[tag]")),
      ...(categorySummary ? { category_summary: categorySummary } : {}),
      visibility_summary: visibilitySummary || "[visibility]",
      ...(thumbnailSummary ? { thumbnail_summary: thumbnailSummary } : {}),
      metadata_payload_created: false,
      raw_platform_payload_stored: false,
    },
    upload_execution_boundary: {
      upload_requested: false,
      upload_allowed: false,
      upload_execution_enabled: false,
      platform_api_calls_allowed: false,
      resumable_upload_allowed: false,
      direct_upload_allowed: false,
      credentials_required: false,
      credentials_accessed: false,
      token_accessed: false,
      keychain_accessed: false,
      env_access_allowed: false,
      max_upload_attempts: 0,
      dry_run_only: true,
    },
    operator_review: {
      ...(reviewedBy ? { reviewed_by_label: reviewedBy } : {}),
      checklist_acknowledged: input.checklist_acknowledged === true,
      upload_risk_acknowledged: input.upload_risk_acknowledged === true,
      platform_target_acknowledged: input.platform_target_acknowledged === true,
      metadata_acknowledged: input.metadata_acknowledged === true,
      understands_no_upload_enabled: input.understands_no_upload_enabled === true,
      understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
      ...(note ? { decision_note_summary: note } : {}),
    },
    validation: {
      ready_for_upload_execution_review: approved && input.uploadPackageDesign.design_state === "approved_for_upload_request_design" && input.localOutputReview.review_state === "approved_for_upload_design" && input.spikeResult.validation.spike_passed,
      ready_for_upload: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      token_accessed: false,
      blocking_reasons: [],
      warnings: approved ? ["No upload or platform API calls are enabled."] : [],
    },
    provenance: {
      generated_by: "createPlatformUploadRequest",
      source_upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
      source_local_output_review_id: input.localOutputReview.local_output_review_id,
      source_production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
      source_final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
      source_render_plan_id: input.spikeResult.render_plan_id,
    },
  };
  if (!validatePlatformUploadRequest(request).ok) throw new Error("Unsafe platform upload request cannot be created.");
  return request;
}

export function validatePlatformUploadRequest(request: unknown): PlatformUploadRequestValidationResult {
  return validatePlatformUploadRequestShape(request);
}

interface PlatformUploadRequestsStoreSummaryItem {
  platform_upload_request_id: string;
  project_id: string;
  platform: string;
  request_state: string;
  created_at: string;
}

function safePlatformUploadRequestSummary(request: PlatformUploadRequest): PlatformUploadRequestsStoreSummaryItem {
  return {
    platform_upload_request_id: safePlatformUploadRequestString(request.platform_upload_request_id, "[unsafe-id]"),
    project_id: safePlatformUploadRequestString(request.project_id, "[unsafe-project]"),
    platform: safePlatformUploadRequestString(request.platform, "[unsafe-platform]"),
    request_state: request.request_state,
    created_at: request.created_at,
  };
}

export function savePlatformUploadRequest(request: PlatformUploadRequest): void {
  const validation = validatePlatformUploadRequest(request);
  if (!validation.ok) throw new Error("Unsafe platform upload request cannot be stored.");
  const store = loadPlatformUploadRequestsStore();
  const existing = store.requests.findIndex((item) => item.platform_upload_request_id === request.platform_upload_request_id);
  if (existing >= 0) store.requests[existing] = request;
  else store.requests.push(request);
  savePlatformUploadRequestsStore(store);
}

export function listPlatformUploadRequests(options?: { project_id?: string; platform?: string; request_state?: string; upload_package_design_id?: string; local_output_review_id?: string }): PlatformUploadRequest[] {
  const store = loadPlatformUploadRequestsStore();
  return store.requests.filter((request) => {
    if (options?.project_id && request.project_id !== options.project_id) return false;
    if (options?.platform && request.platform !== options.platform) return false;
    if (options?.request_state && request.request_state !== options.request_state) return false;
    if (options?.upload_package_design_id && request.upload_package_design_id !== options.upload_package_design_id) return false;
    if (options?.local_output_review_id && request.local_output_review_id !== options.local_output_review_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.platform_upload_request_id.localeCompare(b.platform_upload_request_id);
  });
}

export function getPlatformUploadRequest(platform_upload_request_id: string): PlatformUploadRequest | null {
  const store = loadPlatformUploadRequestsStore();
  return store.requests.find((request) => request.platform_upload_request_id === platform_upload_request_id) ?? null;
}

export function revokePlatformUploadRequest(platform_upload_request_id: string, reason: string): PlatformUploadRequest {
  const request = getPlatformUploadRequest(platform_upload_request_id);
  if (!request) throw new Error("Platform upload request not found");
  const safeReason = safePlatformUploadRequestString(reason, "[unsafe-reason]");
  if (safeReason === "[unsafe-reason]") throw new Error("Unsafe platform upload request reason cannot be stored.");
  const revoked: PlatformUploadRequest = {
    ...request,
    request_state: "revoked",
    validation: { ...request.validation, blocking_reasons: [...request.validation.blocking_reasons, safeReason], warnings: [...request.validation.warnings, "Upload request revoked."] },
    provenance: { ...request.provenance, generated_by: "revokePlatformUploadRequest" },
  };
  savePlatformUploadRequest(revoked);
  return revoked;
}

export function getPlatformUploadRequestReport(options?: { project_id?: string; platform?: string }): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_future_upload_execution: number;
  rejected: number;
  revoked: number;
  ready_for_upload_execution_review: number;
  ready_for_upload: 0;
  upload_allowed: 0;
  upload_execution_enabled: 0;
  platform_api_calls_allowed: 0;
  credentials_accessed: 0;
  token_accessed: 0;
  requests: Array<PlatformUploadRequestsStoreSummaryItem>;
} {
  const requests = listPlatformUploadRequests(options);
  const by_state: Record<string, number> = {};
  let blocked = 0;
  let ready = 0;
  let approved = 0;
  let rejected = 0;
  let revoked = 0;
  let readyReview = 0;
  const summaries = requests.map((request) => {
    by_state[request.request_state] = (by_state[request.request_state] ?? 0) + 1;
    if (request.request_state === "blocked") blocked++;
    if (request.request_state === "ready_for_operator_review") ready++;
    if (request.request_state === "approved_for_future_upload_execution") approved++;
    if (request.request_state === "rejected") rejected++;
    if (request.request_state === "revoked") revoked++;
    if (request.validation.ready_for_upload_execution_review) readyReview++;
    return safePlatformUploadRequestSummary(request);
  });
  return {
    total: summaries.length,
    by_state,
    blocked,
    ready_for_operator_review: ready,
    approved_for_future_upload_execution: approved,
    rejected,
    revoked,
    ready_for_upload_execution_review: readyReview,
    ready_for_upload: 0,
    upload_allowed: 0,
    upload_execution_enabled: 0,
    platform_api_calls_allowed: 0,
    credentials_accessed: 0,
    token_accessed: 0,
    requests: summaries,
  };
}

export type UploadExecutionApprovalMode = "upload_execution_approval_only" | "operator_review_upload_execution_approval";
export type UploadExecutionApprovalState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_upload_execution_design" | "rejected" | "revoked";

export interface UploadExecutionRequiredArtifacts {
  platform_upload_request_validated: boolean;
  upload_package_design_validated: boolean;
  local_output_review_validated: boolean;
  spike_result_validated: boolean;
}

export interface UploadExecutionBoundary {
  upload_requested: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  platform_api_calls_allowed: false;
  resumable_upload_allowed: false;
  direct_upload_allowed: false;
  credentials_required: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_access_allowed: false;
  platform_endpoint_selected: false;
  raw_platform_payload_created: false;
  max_upload_attempts: 0;
  dry_run_only: true;
}

export interface UploadExecutionOperatorReview {
  reviewed_by_label?: string;
  checklist_acknowledged: boolean;
  upload_risk_acknowledged: boolean;
  platform_request_acknowledged: boolean;
  metadata_acknowledged: boolean;
  output_review_acknowledged: boolean;
  understands_no_upload_enabled: boolean;
  understands_no_credentials_accessed: boolean;
  understands_future_separate_execution_phase_required: boolean;
  decision_note_summary?: string;
}

export interface UploadExecutionApprovalValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface UploadExecutionApproval {
  schema_version: "1.0";
  upload_execution_approval_id: string;
  platform_upload_request_id: string;
  upload_package_design_id: string;
  local_output_review_id: string;
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  approval_state: UploadExecutionApprovalState;
  created_at: string;
  approval_mode: UploadExecutionApprovalMode;
  required_artifacts: UploadExecutionRequiredArtifacts;
  upload_execution_boundary: UploadExecutionBoundary;
  operator_review: UploadExecutionOperatorReview;
  validation: {
    ready_for_upload_execution_design: boolean;
    ready_for_upload: false;
    upload_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    token_accessed: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createUploadExecutionApproval" | "revokeUploadExecutionApproval";
    source_platform_upload_request_id: string;
    source_upload_package_design_id: string;
    source_local_output_review_id: string;
    source_production_render_spike_result_id: string;
    source_final_render_execution_request_id: string;
    source_render_plan_id: string;
  };
}

interface UploadExecutionApprovalsStore {
  schema_version: "1.0";
  created_at: string;
  approvals: UploadExecutionApproval[];
}

function getUploadExecutionApprovalsPath(): string {
  return path.join(getRuntimeDir(), "upload-execution-approvals.json");
}

function loadUploadExecutionApprovalsStore(): UploadExecutionApprovalsStore {
  try {
    const filePath = getUploadExecutionApprovalsPath();
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8")) as UploadExecutionApprovalsStore;
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), approvals: [] };
}

function saveUploadExecutionApprovalsStore(store: UploadExecutionApprovalsStore): void {
  const filePath = getUploadExecutionApprovalsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.approvals.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.upload_execution_approval_id.localeCompare(b.upload_execution_approval_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeUploadExecutionApprovalString(value: unknown, fallback: string): string {
  return safePlatformUploadRequestString(value, fallback);
}

function validateUploadExecutionApprovalShape(approval: unknown): UploadExecutionApprovalValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (!approval || typeof approval !== "object") return { ok: false, blocking_reasons: ["Upload execution approval must be an object"], warnings };
  const a = approval as Record<string, unknown>;
  const required = ["schema_version","upload_execution_approval_id","platform_upload_request_id","upload_package_design_id","local_output_review_id","production_render_spike_result_id","final_render_execution_request_id","render_plan_id","project_id","platform","approval_state","created_at","approval_mode","required_artifacts","upload_execution_boundary","operator_review","validation","provenance"];
  for (const key of required) if (!(key in a)) blocking_reasons.push("Upload execution approval is missing a required field");
  if (a.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (!["draft", "blocked", "ready_for_operator_review", "approved_for_future_upload_execution_design", "rejected", "revoked"].includes(String(a.approval_state))) blocking_reasons.push("approval_state is invalid");
  if (!["upload_execution_approval_only", "operator_review_upload_execution_approval"].includes(String(a.approval_mode))) blocking_reasons.push("approval_mode is invalid");
  const text = JSON.stringify(approval);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env[") || text.includes("stdout") || text.includes("stderr") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data=") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../")) {
    blocking_reasons.push("Upload execution approval contains forbidden payload content");
  }
  const requiredArtifacts = a.required_artifacts as Record<string, unknown> | undefined;
  if (!requiredArtifacts || requiredArtifacts.platform_upload_request_validated !== true || requiredArtifacts.upload_package_design_validated !== true || requiredArtifacts.local_output_review_validated !== true || requiredArtifacts.spike_result_validated !== true) blocking_reasons.push("Required artifacts are unsafe");
  const boundary = a.upload_execution_boundary as Record<string, unknown> | undefined;
  if (!boundary || boundary.upload_requested !== false || boundary.upload_allowed !== false || boundary.upload_execution_enabled !== false || boundary.platform_api_calls_allowed !== false || boundary.resumable_upload_allowed !== false || boundary.direct_upload_allowed !== false || boundary.credentials_required !== false || boundary.credentials_accessed !== false || boundary.token_accessed !== false || boundary.keychain_accessed !== false || boundary.env_access_allowed !== false || boundary.platform_endpoint_selected !== false || boundary.raw_platform_payload_created !== false || boundary.max_upload_attempts !== 0 || boundary.dry_run_only !== true) blocking_reasons.push("Upload execution boundary is unsafe");
  const review = a.operator_review as Record<string, unknown> | undefined;
  if (!review || review.checklist_acknowledged !== true || review.upload_risk_acknowledged !== true || review.platform_request_acknowledged !== true || review.metadata_acknowledged !== true || review.output_review_acknowledged !== true || review.understands_no_upload_enabled !== true || review.understands_no_credentials_accessed !== true || review.understands_future_separate_execution_phase_required !== true) blocking_reasons.push("Operator review is unsafe");
  const validation = a.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_upload_execution_design !== false && validation.ready_for_upload_execution_design !== true || validation.ready_for_upload !== false || validation.upload_allowed !== false || validation.platform_api_calls_allowed !== false || validation.credentials_accessed !== false || validation.token_accessed !== false) blocking_reasons.push("Validation state is unsafe");
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createUploadExecutionApproval(input: {
  platformUploadRequest: PlatformUploadRequest;
  uploadPackageDesign: UploadPackageDesign;
  localOutputReview: LocalOutputOperatorReview;
  spikeResult: ControlledProductionRenderSpikeResult;
  decision?: "draft" | "approved_for_future_upload_execution_design" | "rejected";
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  upload_risk_acknowledged?: boolean;
  platform_request_acknowledged?: boolean;
  metadata_acknowledged?: boolean;
  output_review_acknowledged?: boolean;
  understands_no_upload_enabled?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_future_separate_execution_phase_required?: boolean;
  decision_note_summary?: string;
  dryRun: true;
}): UploadExecutionApproval {
  if (input.dryRun !== true) throw new Error("createUploadExecutionApproval: dryRun=true required");
  if (!validatePlatformUploadRequest(input.platformUploadRequest).ok) throw new Error("createUploadExecutionApproval: platformUploadRequest must validate");
  if (!validateUploadPackageDesign(input.uploadPackageDesign).ok) throw new Error("createUploadExecutionApproval: uploadPackageDesign must validate");
  if (!validateLocalOutputOperatorReview(input.localOutputReview).ok) throw new Error("createUploadExecutionApproval: localOutputReview must validate");
  if (!validateControlledProductionRenderSpikeResult(input.spikeResult).ok) throw new Error("createUploadExecutionApproval: spikeResult must validate");
  if (input.platformUploadRequest.request_state !== "approved_for_future_upload_execution") throw new Error("createUploadExecutionApproval: platformUploadRequest must be approved_for_future_upload_execution");
  if (input.platformUploadRequest.platform_upload_request_id !== input.platformUploadRequest.platform_upload_request_id || input.platformUploadRequest.upload_package_design_id !== input.uploadPackageDesign.upload_package_design_id || input.platformUploadRequest.local_output_review_id !== input.localOutputReview.local_output_review_id || input.platformUploadRequest.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.platformUploadRequest.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.platformUploadRequest.render_plan_id !== input.spikeResult.render_plan_id || input.platformUploadRequest.project_id !== input.spikeResult.project_id || input.platformUploadRequest.platform !== input.spikeResult.platform || input.uploadPackageDesign.project_id !== input.platformUploadRequest.project_id || input.localOutputReview.project_id !== input.platformUploadRequest.project_id || input.spikeResult.project_id !== input.platformUploadRequest.project_id) {
    throw new Error("createUploadExecutionApproval: IDs must match across artifacts");
  }
  const decision = input.decision ?? "draft";
  if (decision === "approved_for_future_upload_execution_design") {
    if (input.checklist_acknowledged !== true || input.upload_risk_acknowledged !== true || input.platform_request_acknowledged !== true || input.metadata_acknowledged !== true || input.output_review_acknowledged !== true || input.understands_no_upload_enabled !== true || input.understands_no_credentials_accessed !== true || input.understands_future_separate_execution_phase_required !== true) {
      throw new Error("createUploadExecutionApproval: acknowledgements required");
    }
  }
  const reviewedBy = safeUploadExecutionApprovalString(input.reviewed_by_label ?? "", "[unsafe-reviewer]");
  const note = safeUploadExecutionApprovalString(input.decision_note_summary ?? "", "[unsafe-review-note]");
  const request: UploadExecutionApproval = {
    schema_version: "1.0",
    upload_execution_approval_id: `upload-execution-approval-${crypto.randomUUID()}`,
    platform_upload_request_id: input.platformUploadRequest.platform_upload_request_id,
    upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
    local_output_review_id: input.localOutputReview.local_output_review_id,
    production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
    final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
    render_plan_id: input.spikeResult.render_plan_id,
    project_id: input.spikeResult.project_id,
    platform: input.spikeResult.platform,
    approval_state: decision === "approved_for_future_upload_execution_design" ? "approved_for_future_upload_execution_design" : "ready_for_operator_review",
    created_at: new Date().toISOString(),
    approval_mode: "upload_execution_approval_only",
    required_artifacts: {
      platform_upload_request_validated: true,
      upload_package_design_validated: true,
      local_output_review_validated: true,
      spike_result_validated: true,
    },
    upload_execution_boundary: {
      upload_requested: false,
      upload_allowed: false,
      upload_execution_enabled: false,
      platform_api_calls_allowed: false,
      resumable_upload_allowed: false,
      direct_upload_allowed: false,
      credentials_required: false,
      credentials_accessed: false,
      token_accessed: false,
      keychain_accessed: false,
      env_access_allowed: false,
      platform_endpoint_selected: false,
      raw_platform_payload_created: false,
      max_upload_attempts: 0,
      dry_run_only: true,
    },
    operator_review: {
      ...(reviewedBy ? { reviewed_by_label: reviewedBy } : {}),
      checklist_acknowledged: input.checklist_acknowledged === true,
      upload_risk_acknowledged: input.upload_risk_acknowledged === true,
      platform_request_acknowledged: input.platform_request_acknowledged === true,
      metadata_acknowledged: input.metadata_acknowledged === true,
      output_review_acknowledged: input.output_review_acknowledged === true,
      understands_no_upload_enabled: input.understands_no_upload_enabled === true,
      understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
      understands_future_separate_execution_phase_required: input.understands_future_separate_execution_phase_required === true,
      ...(note ? { decision_note_summary: note } : {}),
    },
    validation: {
      ready_for_upload_execution_design: decision === "approved_for_future_upload_execution_design" && input.platformUploadRequest.request_state === "approved_for_future_upload_execution",
      ready_for_upload: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      token_accessed: false,
      blocking_reasons: [],
      warnings: decision === "approved_for_future_upload_execution_design" ? ["No upload or platform API calls are enabled."] : [],
    },
    provenance: {
      generated_by: "createUploadExecutionApproval",
      source_platform_upload_request_id: input.platformUploadRequest.platform_upload_request_id,
      source_upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
      source_local_output_review_id: input.localOutputReview.local_output_review_id,
      source_production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
      source_final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
      source_render_plan_id: input.spikeResult.render_plan_id,
    },
  };
  if (!validateUploadExecutionApproval(request).ok) throw new Error("Unsafe upload execution approval cannot be created.");
  return request;
}

export function validateUploadExecutionApproval(approval: unknown): UploadExecutionApprovalValidationResult {
  return validateUploadExecutionApprovalShape(approval);
}

interface UploadExecutionApprovalsStoreSummaryItem {
  upload_execution_approval_id: string;
  project_id: string;
  platform: string;
  approval_state: string;
  created_at: string;
}

function safeUploadExecutionApprovalSummary(approval: UploadExecutionApproval): UploadExecutionApprovalsStoreSummaryItem {
  return {
    upload_execution_approval_id: safeUploadExecutionApprovalString(approval.upload_execution_approval_id, "[unsafe-id]"),
    project_id: safeUploadExecutionApprovalString(approval.project_id, "[unsafe-project]"),
    platform: safeUploadExecutionApprovalString(approval.platform, "[unsafe-platform]"),
    approval_state: approval.approval_state,
    created_at: approval.created_at,
  };
}

export function saveUploadExecutionApproval(approval: UploadExecutionApproval): void {
  const validation = validateUploadExecutionApproval(approval);
  if (!validation.ok) throw new Error("Unsafe upload execution approval cannot be stored.");
  const store = loadUploadExecutionApprovalsStore();
  const existing = store.approvals.findIndex((item) => item.upload_execution_approval_id === approval.upload_execution_approval_id);
  if (existing >= 0) store.approvals[existing] = approval;
  else store.approvals.push(approval);
  saveUploadExecutionApprovalsStore(store);
}

export function listUploadExecutionApprovals(options?: { project_id?: string; platform?: string; approval_state?: string; platform_upload_request_id?: string; upload_package_design_id?: string }): UploadExecutionApproval[] {
  const store = loadUploadExecutionApprovalsStore();
  return store.approvals.filter((approval) => {
    if (options?.project_id && approval.project_id !== options.project_id) return false;
    if (options?.platform && approval.platform !== options.platform) return false;
    if (options?.approval_state && approval.approval_state !== options.approval_state) return false;
    if (options?.platform_upload_request_id && approval.platform_upload_request_id !== options.platform_upload_request_id) return false;
    if (options?.upload_package_design_id && approval.upload_package_design_id !== options.upload_package_design_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.upload_execution_approval_id.localeCompare(b.upload_execution_approval_id);
  });
}

export function getUploadExecutionApproval(upload_execution_approval_id: string): UploadExecutionApproval | null {
  const store = loadUploadExecutionApprovalsStore();
  return store.approvals.find((approval) => approval.upload_execution_approval_id === upload_execution_approval_id) ?? null;
}

export function revokeUploadExecutionApproval(upload_execution_approval_id: string, reason: string): UploadExecutionApproval {
  const approval = getUploadExecutionApproval(upload_execution_approval_id);
  if (!approval) throw new Error("Upload execution approval not found");
  const safeReason = safeUploadExecutionApprovalString(reason, "[unsafe-reason]");
  if (safeReason === "[unsafe-reason]") throw new Error("Unsafe upload execution approval reason cannot be stored.");
  const revoked: UploadExecutionApproval = {
    ...approval,
    approval_state: "revoked",
    validation: { ...approval.validation, blocking_reasons: [...approval.validation.blocking_reasons, safeReason], warnings: [...approval.validation.warnings, "Upload execution approval revoked."] },
    provenance: { ...approval.provenance, generated_by: "revokeUploadExecutionApproval" },
  };
  saveUploadExecutionApproval(revoked);
  return revoked;
}

export function getUploadExecutionApprovalReport(options?: { project_id?: string; platform?: string }): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_future_upload_execution_design: number;
  rejected: number;
  revoked: number;
  ready_for_upload_execution_design: number;
  ready_for_upload: 0;
  upload_allowed: 0;
  upload_execution_enabled: 0;
  platform_api_calls_allowed: 0;
  credentials_accessed: 0;
  token_accessed: 0;
  approvals: Array<UploadExecutionApprovalsStoreSummaryItem>;
} {
  const approvals = listUploadExecutionApprovals(options);
  const by_state: Record<string, number> = {};
  let blocked = 0;
  let ready = 0;
  let approved = 0;
  let rejected = 0;
  let revoked = 0;
  let readyDesign = 0;
  const summaries = approvals.map((approval) => {
    by_state[approval.approval_state] = (by_state[approval.approval_state] ?? 0) + 1;
    if (approval.approval_state === "blocked") blocked++;
    if (approval.approval_state === "ready_for_operator_review") ready++;
    if (approval.approval_state === "approved_for_future_upload_execution_design") approved++;
    if (approval.approval_state === "rejected") rejected++;
    if (approval.approval_state === "revoked") revoked++;
    if (approval.validation.ready_for_upload_execution_design) readyDesign++;
    return safeUploadExecutionApprovalSummary(approval);
  });
  return {
    total: summaries.length,
    by_state,
    blocked,
    ready_for_operator_review: ready,
    approved_for_future_upload_execution_design: approved,
    rejected,
    revoked,
    ready_for_upload_execution_design: readyDesign,
    ready_for_upload: 0,
    upload_allowed: 0,
    upload_execution_enabled: 0,
    platform_api_calls_allowed: 0,
    credentials_accessed: 0,
    token_accessed: 0,
    approvals: summaries,
  };
}

export type UploadExecutionDesignMode = "dry_run_upload_execution_design_only" | "operator_review_upload_execution_design";
export type UploadExecutionDesignState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_dry_run_upload_spike" | "rejected" | "revoked";

export interface UploadExecutionDesignRequiredArtifacts {
  upload_execution_approval_validated: boolean;
  platform_upload_request_validated: boolean;
  upload_package_design_validated: boolean;
  local_output_review_validated: boolean;
  spike_result_validated: boolean;
}

export interface UploadExecutionPlan {
  upload_requested: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  dry_run_upload_spike_allowed: false;
  platform_api_calls_allowed: false;
  resumable_upload_allowed: false;
  direct_upload_allowed: false;
  max_upload_attempts: 0;
  media_file_reference_summary: string;
  metadata_reference_summary: string;
  raw_media_path_stored: false;
  raw_platform_payload_created: false;
  raw_platform_payload_stored: false;
}

export interface UploadExecutionDryRunBoundary {
  dry_run_only: true;
  network_calls_allowed: false;
  platform_api_calls_allowed: false;
  credential_access_allowed: false;
  token_access_allowed: false;
  keychain_access_allowed: false;
  env_access_allowed: false;
  upload_side_effects_allowed: false;
  external_side_effects_allowed: false;
}

export interface UploadExecutionCredentialBoundary {
  credentials_required: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_access_allowed: false;
  credential_reference_stored: false;
  token_reference_stored: false;
}

export interface UploadExecutionPlatformBoundary {
  platform_endpoint_selected: false;
  platform_api_payload_created: false;
  platform_api_payload_stored: false;
  raw_account_ids_stored: false;
  account_reference_summary?: string;
  channel_or_profile_reference_summary?: string;
}

export interface UploadExecutionDesignOperatorReview {
  reviewed_by_label?: string;
  checklist_acknowledged: boolean;
  upload_design_acknowledged: boolean;
  dry_run_boundary_acknowledged: boolean;
  credential_boundary_acknowledged: boolean;
  platform_boundary_acknowledged: boolean;
  understands_no_upload_enabled: boolean;
  understands_no_network_calls: boolean;
  understands_future_separate_real_upload_phase_required: boolean;
  decision_note_summary?: string;
}

export interface UploadExecutionDesignValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface UploadExecutionDesign {
  schema_version: "1.0";
  upload_execution_design_id: string;
  upload_execution_approval_id: string;
  platform_upload_request_id: string;
  upload_package_design_id: string;
  local_output_review_id: string;
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  design_state: UploadExecutionDesignState;
  created_at: string;
  design_mode: UploadExecutionDesignMode;
  required_artifacts: UploadExecutionDesignRequiredArtifacts;
  upload_execution_plan: UploadExecutionPlan;
  dry_run_boundary: UploadExecutionDryRunBoundary;
  credential_boundary: UploadExecutionCredentialBoundary;
  platform_boundary: UploadExecutionPlatformBoundary;
  operator_review: UploadExecutionDesignOperatorReview;
  validation: {
    ready_for_dry_run_upload_spike: boolean;
    ready_for_real_upload: false;
    upload_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    token_accessed: false;
    network_calls_allowed: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createUploadExecutionDesign" | "revokeUploadExecutionDesign";
    source_upload_execution_approval_id: string;
    source_platform_upload_request_id: string;
    source_upload_package_design_id: string;
    source_local_output_review_id: string;
    source_production_render_spike_result_id: string;
    source_final_render_execution_request_id: string;
    source_render_plan_id: string;
  };
}

interface UploadExecutionDesignsStore {
  schema_version: "1.0";
  created_at: string;
  designs: UploadExecutionDesign[];
}

function getUploadExecutionDesignsPath(): string {
  return path.join(getRuntimeDir(), "upload-execution-designs.json");
}

function loadUploadExecutionDesignsStore(): UploadExecutionDesignsStore {
  try {
    const filePath = getUploadExecutionDesignsPath();
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8")) as UploadExecutionDesignsStore;
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), designs: [] };
}

function saveUploadExecutionDesignsStore(store: UploadExecutionDesignsStore): void {
  const filePath = getUploadExecutionDesignsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.designs.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.upload_execution_design_id.localeCompare(b.upload_execution_design_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeUploadExecutionDesignString(value: unknown, fallback: string): string {
  return safeUploadExecutionApprovalString(value, fallback);
}

function safeUploadExecutionDesignPlatformSummary(value: unknown, fallback: string): string {
  const text = safeUploadExecutionDesignString(value, fallback);
  if (text === fallback) return fallback;
  if (looksLikeRawUploadPlatformId(text)) return fallback;
  return text;
}

function validateUploadExecutionDesignShape(design: unknown): UploadExecutionDesignValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof design !== "object" || design === null) return { ok: false, blocking_reasons: ["Upload execution design must be an object"], warnings };
  const d = design as Record<string, unknown>;
  const required = ["schema_version", "upload_execution_design_id", "upload_execution_approval_id", "platform_upload_request_id", "upload_package_design_id", "local_output_review_id", "production_render_spike_result_id", "final_render_execution_request_id", "render_plan_id", "project_id", "platform", "design_state", "created_at", "design_mode", "required_artifacts", "upload_execution_plan", "dry_run_boundary", "credential_boundary", "platform_boundary", "operator_review", "validation", "provenance"];
  for (const key of required) if (!(key in d)) blocking_reasons.push("Upload execution design is missing a required field");
  if (d.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (!["dry_run_upload_execution_design_only", "operator_review_upload_execution_design"].includes(String(d.design_mode))) blocking_reasons.push("design_mode is invalid");
  if (!["draft", "blocked", "ready_for_operator_review", "approved_for_future_dry_run_upload_spike", "rejected", "revoked"].includes(String(d.design_state))) blocking_reasons.push("design_state is invalid");
  const text = JSON.stringify(design);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env") || text.includes("keychain://") || text.includes("stdout") || text.includes("stderr") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data:") || text.includes("base64,") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../")) {
    blocking_reasons.push("Upload execution design contains forbidden payload content");
  }
  const requiredArtifacts = d.required_artifacts as Record<string, unknown> | undefined;
  if (!requiredArtifacts || requiredArtifacts.upload_execution_approval_validated !== true || requiredArtifacts.platform_upload_request_validated !== true || requiredArtifacts.upload_package_design_validated !== true || requiredArtifacts.local_output_review_validated !== true || requiredArtifacts.spike_result_validated !== true) blocking_reasons.push("Required artifacts are unsafe");
  const plan = d.upload_execution_plan as Record<string, unknown> | undefined;
  if (!plan || plan.upload_requested !== false || plan.upload_allowed !== false || plan.upload_execution_enabled !== false || plan.dry_run_upload_spike_allowed !== false || plan.platform_api_calls_allowed !== false || plan.resumable_upload_allowed !== false || plan.direct_upload_allowed !== false || plan.max_upload_attempts !== 0 || plan.raw_media_path_stored !== false || plan.raw_platform_payload_created !== false || plan.raw_platform_payload_stored !== false) blocking_reasons.push("Upload execution plan is unsafe");
  const dryRun = d.dry_run_boundary as Record<string, unknown> | undefined;
  if (!dryRun || dryRun.dry_run_only !== true || dryRun.network_calls_allowed !== false || dryRun.platform_api_calls_allowed !== false || dryRun.credential_access_allowed !== false || dryRun.token_access_allowed !== false || dryRun.keychain_access_allowed !== false || dryRun.env_access_allowed !== false || dryRun.upload_side_effects_allowed !== false || dryRun.external_side_effects_allowed !== false) blocking_reasons.push("Dry-run boundary is unsafe");
  const credential = d.credential_boundary as Record<string, unknown> | undefined;
  if (!credential || credential.credentials_required !== false || credential.credentials_accessed !== false || credential.token_accessed !== false || credential.keychain_accessed !== false || credential.env_access_allowed !== false || credential.credential_reference_stored !== false || credential.token_reference_stored !== false) blocking_reasons.push("Credential boundary is unsafe");
  const platform = d.platform_boundary as Record<string, unknown> | undefined;
  if (!platform || platform.platform_endpoint_selected !== false || platform.platform_api_payload_created !== false || platform.platform_api_payload_stored !== false || platform.raw_account_ids_stored !== false) blocking_reasons.push("Platform boundary is unsafe");
  if (looksLikeRawUploadPlatformId(platform?.account_reference_summary) || looksLikeRawUploadPlatformId(platform?.channel_or_profile_reference_summary)) blocking_reasons.push("Platform boundary contains unsafe account identifiers");
  const review = d.operator_review as Record<string, unknown> | undefined;
  if (!review || review.checklist_acknowledged !== true || review.upload_design_acknowledged !== true || review.dry_run_boundary_acknowledged !== true || review.credential_boundary_acknowledged !== true || review.platform_boundary_acknowledged !== true || review.understands_no_upload_enabled !== true || review.understands_no_network_calls !== true || review.understands_future_separate_real_upload_phase_required !== true) blocking_reasons.push("Operator review is unsafe");
  const validation = d.validation as Record<string, unknown> | undefined;
  if (!validation || validation.ready_for_real_upload !== false || validation.upload_allowed !== false || validation.platform_api_calls_allowed !== false || validation.credentials_accessed !== false || validation.token_accessed !== false || validation.network_calls_allowed !== false) blocking_reasons.push("Validation state is unsafe");
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createUploadExecutionDesign(input: {
  uploadExecutionApproval: UploadExecutionApproval;
  platformUploadRequest: PlatformUploadRequest;
  uploadPackageDesign: UploadPackageDesign;
  localOutputReview: LocalOutputOperatorReview;
  spikeResult: ControlledProductionRenderSpikeResult;
  decision?: "draft" | "approved_for_future_dry_run_upload_spike" | "rejected";
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  upload_design_acknowledged?: boolean;
  dry_run_boundary_acknowledged?: boolean;
  credential_boundary_acknowledged?: boolean;
  platform_boundary_acknowledged?: boolean;
  understands_no_upload_enabled?: boolean;
  understands_no_network_calls?: boolean;
  understands_future_separate_real_upload_phase_required?: boolean;
  decision_note_summary?: string;
  dryRun: true;
}): UploadExecutionDesign {
  if (input.dryRun !== true) throw new Error("createUploadExecutionDesign: dryRun=true required");
  if (!validateUploadExecutionApproval(input.uploadExecutionApproval).ok) throw new Error("createUploadExecutionDesign: uploadExecutionApproval must validate");
  if (!validatePlatformUploadRequest(input.platformUploadRequest).ok) throw new Error("createUploadExecutionDesign: platformUploadRequest must validate");
  if (!validateUploadPackageDesign(input.uploadPackageDesign).ok) throw new Error("createUploadExecutionDesign: uploadPackageDesign must validate");
  if (!validateLocalOutputOperatorReview(input.localOutputReview).ok) throw new Error("createUploadExecutionDesign: localOutputReview must validate");
  if (!validateControlledProductionRenderSpikeResult(input.spikeResult).ok) throw new Error("createUploadExecutionDesign: spikeResult must validate");
  if (input.uploadExecutionApproval.approval_state !== "approved_for_future_upload_execution_design") throw new Error("createUploadExecutionDesign: uploadExecutionApproval must be approved_for_future_upload_execution_design");
  if (input.platformUploadRequest.request_state !== "approved_for_future_upload_execution" || input.uploadPackageDesign.design_state !== "approved_for_upload_request_design" || input.localOutputReview.review_state !== "approved_for_upload_design" || input.spikeResult.validation.spike_passed !== true) throw new Error("createUploadExecutionDesign: source artifacts must be approved");
  if (input.uploadExecutionApproval.upload_execution_approval_id !== input.uploadExecutionApproval.upload_execution_approval_id || input.uploadExecutionApproval.platform_upload_request_id !== input.platformUploadRequest.platform_upload_request_id || input.uploadExecutionApproval.upload_package_design_id !== input.uploadPackageDesign.upload_package_design_id || input.uploadExecutionApproval.local_output_review_id !== input.localOutputReview.local_output_review_id || input.uploadExecutionApproval.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.uploadExecutionApproval.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.uploadExecutionApproval.render_plan_id !== input.spikeResult.render_plan_id || input.uploadExecutionApproval.project_id !== input.spikeResult.project_id || input.uploadExecutionApproval.platform !== input.spikeResult.platform || input.platformUploadRequest.upload_package_design_id !== input.uploadPackageDesign.upload_package_design_id || input.platformUploadRequest.local_output_review_id !== input.localOutputReview.local_output_review_id || input.platformUploadRequest.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.platformUploadRequest.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.platformUploadRequest.render_plan_id !== input.spikeResult.render_plan_id || input.platformUploadRequest.project_id !== input.spikeResult.project_id || input.platformUploadRequest.platform !== input.spikeResult.platform || input.uploadPackageDesign.local_output_review_id !== input.localOutputReview.local_output_review_id || input.uploadPackageDesign.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.uploadPackageDesign.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.uploadPackageDesign.render_plan_id !== input.spikeResult.render_plan_id || input.uploadPackageDesign.project_id !== input.spikeResult.project_id || input.uploadPackageDesign.platform !== input.spikeResult.platform || input.localOutputReview.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.localOutputReview.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.localOutputReview.render_plan_id !== input.spikeResult.render_plan_id || input.localOutputReview.project_id !== input.spikeResult.project_id || input.localOutputReview.platform !== input.spikeResult.platform) {
    throw new Error("createUploadExecutionDesign: artifacts must match");
  }
  const decision = input.decision ?? "draft";
  if (decision === "approved_for_future_dry_run_upload_spike") {
    if (input.checklist_acknowledged !== true || input.upload_design_acknowledged !== true || input.dry_run_boundary_acknowledged !== true || input.credential_boundary_acknowledged !== true || input.platform_boundary_acknowledged !== true || input.understands_no_upload_enabled !== true || input.understands_no_network_calls !== true || input.understands_future_separate_real_upload_phase_required !== true) {
      throw new Error("createUploadExecutionDesign: acknowledgements required");
    }
  }
  const reviewedBy = safeUploadExecutionDesignString(input.reviewed_by_label ?? "", "[unsafe-reviewer]");
  const note = safeUploadExecutionDesignString(input.decision_note_summary ?? "", "[unsafe-review-note]");
  const platformAccount = safeUploadExecutionDesignPlatformSummary(input.platformUploadRequest.platform_target.account_reference_summary ?? input.uploadPackageDesign.platform_target.account_reference_summary ?? "[account-reference]", "[account-reference]");
  const platformChannel = safeUploadExecutionDesignPlatformSummary(input.platformUploadRequest.platform_target.channel_or_profile_reference_summary ?? input.uploadPackageDesign.platform_target.channel_or_profile_reference_summary ?? "[channel-reference]", "[channel-reference]");
  const mediaSummary = safeUploadExecutionDesignString(input.spikeResult.output_summary.output_path_summaries.join(" | "), "[media-file-reference]");
  const metadataSummary = safeUploadExecutionDesignString([
    input.platformUploadRequest.metadata_request.title_summary,
    input.platformUploadRequest.metadata_request.description_summary,
    input.platformUploadRequest.metadata_request.tags_summary.join(","),
    input.platformUploadRequest.metadata_request.visibility_summary,
  ].join(" | "), "[metadata-reference]");
  const design: UploadExecutionDesign = {
    schema_version: "1.0",
    upload_execution_design_id: `upload-execution-design-${crypto.randomUUID()}`,
    upload_execution_approval_id: input.uploadExecutionApproval.upload_execution_approval_id,
    platform_upload_request_id: input.platformUploadRequest.platform_upload_request_id,
    upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
    local_output_review_id: input.localOutputReview.local_output_review_id,
    production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
    final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
    render_plan_id: input.spikeResult.render_plan_id,
    project_id: input.spikeResult.project_id,
    platform: input.spikeResult.platform,
    design_state: decision === "approved_for_future_dry_run_upload_spike" ? "approved_for_future_dry_run_upload_spike" : "ready_for_operator_review",
    created_at: new Date().toISOString(),
    design_mode: "dry_run_upload_execution_design_only",
    required_artifacts: {
      upload_execution_approval_validated: true,
      platform_upload_request_validated: true,
      upload_package_design_validated: true,
      local_output_review_validated: true,
      spike_result_validated: true,
    },
    upload_execution_plan: {
      upload_requested: false,
      upload_allowed: false,
      upload_execution_enabled: false,
      dry_run_upload_spike_allowed: false,
      platform_api_calls_allowed: false,
      resumable_upload_allowed: false,
      direct_upload_allowed: false,
      max_upload_attempts: 0,
      media_file_reference_summary: mediaSummary,
      metadata_reference_summary: metadataSummary,
      raw_media_path_stored: false,
      raw_platform_payload_created: false,
      raw_platform_payload_stored: false,
    },
    dry_run_boundary: {
      dry_run_only: true,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credential_access_allowed: false,
      token_access_allowed: false,
      keychain_access_allowed: false,
      env_access_allowed: false,
      upload_side_effects_allowed: false,
      external_side_effects_allowed: false,
    },
    credential_boundary: {
      credentials_required: false,
      credentials_accessed: false,
      token_accessed: false,
      keychain_accessed: false,
      env_access_allowed: false,
      credential_reference_stored: false,
      token_reference_stored: false,
    },
    platform_boundary: {
      platform_endpoint_selected: false,
      platform_api_payload_created: false,
      platform_api_payload_stored: false,
      raw_account_ids_stored: false,
      ...(platformAccount ? { account_reference_summary: platformAccount } : {}),
      ...(platformChannel ? { channel_or_profile_reference_summary: platformChannel } : {}),
    },
    operator_review: {
      ...(reviewedBy ? { reviewed_by_label: reviewedBy } : {}),
      checklist_acknowledged: input.checklist_acknowledged === true,
      upload_design_acknowledged: input.upload_design_acknowledged === true,
      dry_run_boundary_acknowledged: input.dry_run_boundary_acknowledged === true,
      credential_boundary_acknowledged: input.credential_boundary_acknowledged === true,
      platform_boundary_acknowledged: input.platform_boundary_acknowledged === true,
      understands_no_upload_enabled: input.understands_no_upload_enabled === true,
      understands_no_network_calls: input.understands_no_network_calls === true,
      understands_future_separate_real_upload_phase_required: input.understands_future_separate_real_upload_phase_required === true,
      ...(note ? { decision_note_summary: note } : {}),
    },
    validation: {
      ready_for_dry_run_upload_spike: decision === "approved_for_future_dry_run_upload_spike" && input.uploadExecutionApproval.approval_state === "approved_for_future_upload_execution_design" && input.platformUploadRequest.request_state === "approved_for_future_upload_execution" && input.uploadPackageDesign.design_state === "approved_for_upload_request_design" && input.localOutputReview.review_state === "approved_for_upload_design" && input.spikeResult.validation.spike_passed,
      ready_for_real_upload: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      token_accessed: false,
      network_calls_allowed: false,
      blocking_reasons: [],
      warnings: decision === "approved_for_future_dry_run_upload_spike" ? ["No upload, network, or platform API calls are enabled."] : [],
    },
    provenance: {
      generated_by: "createUploadExecutionDesign",
      source_upload_execution_approval_id: input.uploadExecutionApproval.upload_execution_approval_id,
      source_platform_upload_request_id: input.platformUploadRequest.platform_upload_request_id,
      source_upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
      source_local_output_review_id: input.localOutputReview.local_output_review_id,
      source_production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
      source_final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
      source_render_plan_id: input.spikeResult.render_plan_id,
    },
  };
  if (!validateUploadExecutionDesign(design).ok) throw new Error("Unsafe upload execution design cannot be created.");
  return design;
}

export function validateUploadExecutionDesign(design: unknown): UploadExecutionDesignValidationResult {
  return validateUploadExecutionDesignShape(design);
}

interface UploadExecutionDesignsStoreSummaryItem {
  upload_execution_design_id: string;
  project_id: string;
  platform: string;
  design_state: string;
  created_at: string;
}

function safeUploadExecutionDesignSummary(design: UploadExecutionDesign): UploadExecutionDesignsStoreSummaryItem {
  return {
    upload_execution_design_id: safeUploadExecutionDesignString(design.upload_execution_design_id, "[unsafe-id]"),
    project_id: safeUploadExecutionDesignString(design.project_id, "[unsafe-project]"),
    platform: safeUploadExecutionDesignString(design.platform, "[unsafe-platform]"),
    design_state: design.design_state,
    created_at: design.created_at,
  };
}

export function saveUploadExecutionDesign(design: UploadExecutionDesign): void {
  const validation = validateUploadExecutionDesign(design);
  if (!validation.ok) throw new Error("Unsafe upload execution design cannot be stored.");
  const store = loadUploadExecutionDesignsStore();
  const existing = store.designs.findIndex((item) => item.upload_execution_design_id === design.upload_execution_design_id);
  if (existing >= 0) store.designs[existing] = design;
  else store.designs.push(design);
  saveUploadExecutionDesignsStore(store);
}

export function listUploadExecutionDesigns(options?: { project_id?: string; platform?: string; design_state?: string; upload_execution_approval_id?: string; platform_upload_request_id?: string }): UploadExecutionDesign[] {
  const store = loadUploadExecutionDesignsStore();
  return store.designs.filter((design) => {
    if (options?.project_id && design.project_id !== options.project_id) return false;
    if (options?.platform && design.platform !== options.platform) return false;
    if (options?.design_state && design.design_state !== options.design_state) return false;
    if (options?.upload_execution_approval_id && design.upload_execution_approval_id !== options.upload_execution_approval_id) return false;
    if (options?.platform_upload_request_id && design.platform_upload_request_id !== options.platform_upload_request_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.upload_execution_design_id.localeCompare(b.upload_execution_design_id);
  });
}

export function getUploadExecutionDesign(upload_execution_design_id: string): UploadExecutionDesign | null {
  const store = loadUploadExecutionDesignsStore();
  return store.designs.find((design) => design.upload_execution_design_id === upload_execution_design_id) ?? null;
}

export function revokeUploadExecutionDesign(upload_execution_design_id: string, reason: string): UploadExecutionDesign {
  const design = getUploadExecutionDesign(upload_execution_design_id);
  if (!design) throw new Error("Upload execution design not found");
  const safeReason = safeUploadExecutionDesignString(reason, "[unsafe-reason]");
  if (safeReason === "[unsafe-reason]") throw new Error("Unsafe upload execution design reason cannot be stored.");
  const revoked: UploadExecutionDesign = {
    ...design,
    design_state: "revoked",
    validation: { ...design.validation, blocking_reasons: [...design.validation.blocking_reasons, safeReason], warnings: [...design.validation.warnings, "Upload execution design revoked."] },
    provenance: { ...design.provenance, generated_by: "revokeUploadExecutionDesign" },
  };
  saveUploadExecutionDesign(revoked);
  return revoked;
}

export function getUploadExecutionDesignReport(options?: { project_id?: string; platform?: string }): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  ready_for_operator_review: number;
  approved_for_future_dry_run_upload_spike: number;
  rejected: number;
  revoked: number;
  ready_for_dry_run_upload_spike: number;
  ready_for_real_upload: 0;
  upload_allowed: 0;
  upload_execution_enabled: 0;
  platform_api_calls_allowed: 0;
  network_calls_allowed: 0;
  credentials_accessed: 0;
  token_accessed: 0;
  designs: Array<UploadExecutionDesignsStoreSummaryItem>;
} {
  const designs = listUploadExecutionDesigns(options);
  const by_state: Record<string, number> = {};
  let blocked = 0;
  let ready = 0;
  let approved = 0;
  let rejected = 0;
  let revoked = 0;
  let readyDryRun = 0;
  const summaries = designs.map((design) => {
    by_state[design.design_state] = (by_state[design.design_state] ?? 0) + 1;
    if (design.design_state === "blocked") blocked++;
    if (design.design_state === "ready_for_operator_review") ready++;
    if (design.design_state === "approved_for_future_dry_run_upload_spike") approved++;
    if (design.design_state === "rejected") rejected++;
    if (design.design_state === "revoked") revoked++;
    if (design.validation.ready_for_dry_run_upload_spike) readyDryRun++;
    return safeUploadExecutionDesignSummary(design);
  });
  return {
    total: summaries.length,
    by_state,
    blocked,
    ready_for_operator_review: ready,
    approved_for_future_dry_run_upload_spike: approved,
    rejected,
    revoked,
    ready_for_dry_run_upload_spike: readyDryRun,
    ready_for_real_upload: 0,
    upload_allowed: 0,
    upload_execution_enabled: 0,
    platform_api_calls_allowed: 0,
    network_calls_allowed: 0,
    credentials_accessed: 0,
    token_accessed: 0,
    designs: summaries,
  };
}

export type DryRunUploadSpikeSimulationMode = "local_dry_run_upload_spike_simulation";
export type DryRunUploadSpikeSimulationState = "draft" | "blocked" | "simulated" | "failed" | "revoked";

export interface DryRunUploadSpikeRequiredArtifacts {
  upload_execution_design_validated: boolean;
  upload_execution_approval_validated: boolean;
  platform_upload_request_validated: boolean;
  upload_package_design_validated: boolean;
  local_output_review_validated: boolean;
  spike_result_validated: boolean;
}

export interface DryRunUploadSimulatedPlan {
  upload_requested: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  dry_run_upload_simulated: boolean;
  platform_api_calls_allowed: false;
  network_calls_allowed: false;
  resumable_upload_allowed: false;
  direct_upload_allowed: false;
  credentials_required: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_access_allowed: false;
  max_upload_attempts: 0;
  media_file_reference_summary: string;
  metadata_reference_summary: string;
  raw_media_path_stored: false;
  raw_platform_payload_created: false;
  raw_platform_payload_stored: false;
}

export interface DryRunUploadExecutionSummary {
  simulation_steps_total: number;
  simulation_steps_passed: number;
  simulation_steps_failed: number;
  media_file_existence_checked: false;
  media_file_read: false;
  media_file_uploaded: false;
  metadata_payload_constructed: false;
  platform_endpoint_selected: false;
  network_request_constructed: false;
  network_request_sent: false;
  response_received: false;
  raw_response_stored: false;
  warnings: string[];
  blocking_reasons: string[];
}

export interface DryRunUploadNetworkBoundary {
  network_calls_allowed: false;
  network_calls_made: false;
  platform_api_calls_allowed: false;
  platform_api_calls_made: false;
  external_side_effects_allowed: false;
  external_side_effects_observed: false;
}

export interface DryRunUploadCredentialBoundary {
  credentials_required: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_accessed: false;
  credential_reference_stored: false;
  token_reference_stored: false;
}

export interface DryRunUploadPlatformBoundary {
  platform_endpoint_selected: false;
  platform_api_payload_created: false;
  platform_api_payload_stored: false;
  raw_account_ids_stored: false;
  account_reference_summary?: string;
  channel_or_profile_reference_summary?: string;
}

export interface DryRunUploadSpikeResultValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface DryRunUploadSpikeResult {
  schema_version: "1.0";
  dry_run_upload_spike_result_id: string;
  upload_execution_design_id: string;
  upload_execution_approval_id: string;
  platform_upload_request_id: string;
  upload_package_design_id: string;
  local_output_review_id: string;
  production_render_spike_result_id: string;
  final_render_execution_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  simulation_state: DryRunUploadSpikeSimulationState;
  created_at: string;
  completed_at?: string;
  simulation_mode: DryRunUploadSpikeSimulationMode;
  required_artifacts: DryRunUploadSpikeRequiredArtifacts;
  simulated_upload_plan: DryRunUploadSimulatedPlan;
  dry_run_execution_summary: DryRunUploadExecutionSummary;
  network_boundary: DryRunUploadNetworkBoundary;
  credential_boundary: DryRunUploadCredentialBoundary;
  platform_boundary: DryRunUploadPlatformBoundary;
  validation: {
    dry_run_upload_spike_passed: boolean;
    ready_for_real_upload: false;
    upload_allowed: false;
    upload_execution_enabled: false;
    platform_api_calls_allowed: false;
    network_calls_allowed: false;
    credentials_accessed: false;
    token_accessed: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createDryRunUploadSpikeResult" | "revokeDryRunUploadSpikeResult";
    source_upload_execution_design_id: string;
    source_upload_execution_approval_id: string;
    source_platform_upload_request_id: string;
    source_upload_package_design_id: string;
    source_local_output_review_id: string;
    source_production_render_spike_result_id: string;
    source_final_render_execution_request_id: string;
    source_render_plan_id: string;
  };
}

interface DryRunUploadSpikeResultsStore {
  schema_version: "1.0";
  created_at: string;
  results: DryRunUploadSpikeResult[];
}

function getDryRunUploadSpikeResultsPath(): string {
  return path.join(getRuntimeDir(), "dry-run-upload-spike-results.json");
}

function loadDryRunUploadSpikeResultsStore(): DryRunUploadSpikeResultsStore {
  try {
    const filePath = getDryRunUploadSpikeResultsPath();
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8")) as DryRunUploadSpikeResultsStore;
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), results: [] };
}

function saveDryRunUploadSpikeResultsStore(store: DryRunUploadSpikeResultsStore): void {
  const filePath = getDryRunUploadSpikeResultsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.results.sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.dry_run_upload_spike_result_id.localeCompare(b.dry_run_upload_spike_result_id);
  });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

function safeDryRunUploadSpikeString(value: unknown, fallback: string): string {
  return safeUploadExecutionDesignString(value, fallback);
}

function validateDryRunUploadSpikeShape(result: unknown): DryRunUploadSpikeResultValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof result !== "object" || result === null) return { ok: false, blocking_reasons: ["Dry-run upload spike result must be an object"], warnings };
  const r = result as Record<string, unknown>;
  const required = ["schema_version","dry_run_upload_spike_result_id","upload_execution_design_id","upload_execution_approval_id","platform_upload_request_id","upload_package_design_id","local_output_review_id","production_render_spike_result_id","final_render_execution_request_id","render_plan_id","project_id","platform","simulation_state","created_at","simulation_mode","required_artifacts","simulated_upload_plan","dry_run_execution_summary","network_boundary","credential_boundary","platform_boundary","validation","provenance"];
  for (const key of required) if (!(key in r)) blocking_reasons.push("Dry-run upload spike result is missing a required field");
  if (r.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (r.simulation_mode !== "local_dry_run_upload_spike_simulation") blocking_reasons.push("simulation_mode is invalid");
  if (!["draft","blocked","simulated","failed","revoked"].includes(String(r.simulation_state))) blocking_reasons.push("simulation_state is invalid");
  const text = JSON.stringify(result);
  if (text.includes("videos.insert") || text.includes("youtube.videos().insert") || text.includes("fetch(") || text.includes("process.env") || text.includes("keychain://") || text.includes("stdout") || text.includes("stderr") || text.includes("ffmpeg -i") || text.includes(" -i ") || text.includes("Bearer ") || text.includes("data:") || text.includes("base64,") || text.includes("/Users/") || text.includes("https://") || text.includes("http://") || text.includes("../")) {
    blocking_reasons.push("Dry-run upload spike result contains forbidden payload content");
  }
  const requiredArtifacts = r.required_artifacts as Record<string, unknown> | undefined;
  if (!requiredArtifacts || requiredArtifacts.upload_execution_design_validated !== true || requiredArtifacts.upload_execution_approval_validated !== true || requiredArtifacts.platform_upload_request_validated !== true || requiredArtifacts.upload_package_design_validated !== true || requiredArtifacts.local_output_review_validated !== true || requiredArtifacts.spike_result_validated !== true) blocking_reasons.push("Required artifacts are unsafe");
  const plan = r.simulated_upload_plan as Record<string, unknown> | undefined;
  if (!plan || plan.upload_requested !== false || plan.upload_allowed !== false || plan.upload_execution_enabled !== false || plan.dry_run_upload_simulated !== true && plan.dry_run_upload_simulated !== false || plan.platform_api_calls_allowed !== false || plan.network_calls_allowed !== false || plan.resumable_upload_allowed !== false || plan.direct_upload_allowed !== false || plan.credentials_required !== false || plan.credentials_accessed !== false || plan.token_accessed !== false || plan.keychain_accessed !== false || plan.env_access_allowed !== false || plan.max_upload_attempts !== 0 || plan.raw_media_path_stored !== false || plan.raw_platform_payload_created !== false || plan.raw_platform_payload_stored !== false) blocking_reasons.push("Simulated upload plan is unsafe");
  const summary = r.dry_run_execution_summary as Record<string, unknown> | undefined;
  if (!summary || summary.media_file_existence_checked !== false || summary.media_file_read !== false || summary.media_file_uploaded !== false || summary.metadata_payload_constructed !== false || summary.platform_endpoint_selected !== false || summary.network_request_constructed !== false || summary.network_request_sent !== false || summary.response_received !== false || summary.raw_response_stored !== false) blocking_reasons.push("Dry-run execution summary is unsafe");
  const network = r.network_boundary as Record<string, unknown> | undefined;
  if (!network || network.network_calls_allowed !== false || network.network_calls_made !== false || network.platform_api_calls_allowed !== false || network.platform_api_calls_made !== false || network.external_side_effects_allowed !== false || network.external_side_effects_observed !== false) blocking_reasons.push("Network boundary is unsafe");
  const credential = r.credential_boundary as Record<string, unknown> | undefined;
  if (!credential || credential.credentials_required !== false || credential.credentials_accessed !== false || credential.token_accessed !== false || credential.keychain_accessed !== false || credential.env_accessed !== false || credential.credential_reference_stored !== false || credential.token_reference_stored !== false) blocking_reasons.push("Credential boundary is unsafe");
  const platform = r.platform_boundary as Record<string, unknown> | undefined;
  if (!platform || platform.platform_endpoint_selected !== false || platform.platform_api_payload_created !== false || platform.platform_api_payload_stored !== false || platform.raw_account_ids_stored !== false) blocking_reasons.push("Platform boundary is unsafe");
  if (looksLikeRawUploadPlatformId(platform?.account_reference_summary) || looksLikeRawUploadPlatformId(platform?.channel_or_profile_reference_summary)) blocking_reasons.push("Platform boundary contains unsafe account identifiers");
  const validation = r.validation as Record<string, unknown> | undefined;
  if (!validation || validation.dry_run_upload_spike_passed !== false && validation.dry_run_upload_spike_passed !== true || validation.ready_for_real_upload !== false || validation.upload_allowed !== false || validation.upload_execution_enabled !== false || validation.platform_api_calls_allowed !== false || validation.network_calls_allowed !== false || validation.credentials_accessed !== false || validation.token_accessed !== false) blocking_reasons.push("Validation state is unsafe");
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function createDryRunUploadSpikeResult(input: {
  uploadExecutionDesign: UploadExecutionDesign;
  uploadExecutionApproval: UploadExecutionApproval;
  platformUploadRequest: PlatformUploadRequest;
  uploadPackageDesign: UploadPackageDesign;
  localOutputReview: LocalOutputOperatorReview;
  spikeResult: ControlledProductionRenderSpikeResult;
  simulatePass?: boolean;
  dryRun: true;
}): DryRunUploadSpikeResult {
  if (input.dryRun !== true) throw new Error("createDryRunUploadSpikeResult: dryRun=true required");
  if (!validateUploadExecutionDesign(input.uploadExecutionDesign).ok) throw new Error("createDryRunUploadSpikeResult: uploadExecutionDesign must validate");
  if (!validateUploadExecutionApproval(input.uploadExecutionApproval).ok) throw new Error("createDryRunUploadSpikeResult: uploadExecutionApproval must validate");
  if (!validatePlatformUploadRequest(input.platformUploadRequest).ok) throw new Error("createDryRunUploadSpikeResult: platformUploadRequest must validate");
  if (!validateUploadPackageDesign(input.uploadPackageDesign).ok) throw new Error("createDryRunUploadSpikeResult: uploadPackageDesign must validate");
  if (!validateLocalOutputOperatorReview(input.localOutputReview).ok) throw new Error("createDryRunUploadSpikeResult: localOutputReview must validate");
  if (!validateControlledProductionRenderSpikeResult(input.spikeResult).ok) throw new Error("createDryRunUploadSpikeResult: spikeResult must validate");
  if (input.uploadExecutionDesign.design_state !== "approved_for_future_dry_run_upload_spike") throw new Error("createDryRunUploadSpikeResult: uploadExecutionDesign must be approved_for_future_dry_run_upload_spike");
  if (input.uploadExecutionApproval.approval_state !== "approved_for_future_upload_execution_design" || input.platformUploadRequest.request_state !== "approved_for_future_upload_execution" || input.uploadPackageDesign.design_state !== "approved_for_upload_request_design" || input.localOutputReview.review_state !== "approved_for_upload_design" || input.spikeResult.validation.spike_passed !== true) {
    throw new Error("createDryRunUploadSpikeResult: source artifacts must be approved");
  }
  if (input.uploadExecutionDesign.upload_execution_design_id !== input.uploadExecutionDesign.upload_execution_design_id || input.uploadExecutionDesign.upload_execution_approval_id !== input.uploadExecutionApproval.upload_execution_approval_id || input.uploadExecutionDesign.platform_upload_request_id !== input.platformUploadRequest.platform_upload_request_id || input.uploadExecutionDesign.upload_package_design_id !== input.uploadPackageDesign.upload_package_design_id || input.uploadExecutionDesign.local_output_review_id !== input.localOutputReview.local_output_review_id || input.uploadExecutionDesign.production_render_spike_result_id !== input.spikeResult.production_render_spike_result_id || input.uploadExecutionDesign.final_render_execution_request_id !== input.spikeResult.final_render_execution_request_id || input.uploadExecutionDesign.render_plan_id !== input.spikeResult.render_plan_id || input.uploadExecutionDesign.project_id !== input.spikeResult.project_id || input.uploadExecutionDesign.platform !== input.spikeResult.platform) {
    throw new Error("createDryRunUploadSpikeResult: artifacts must match");
  }
  const simulatePass = input.simulatePass === true;
  const dryRunPassed = simulatePass;
  const mediaSummary = safeDryRunUploadSpikeString(input.spikeResult.output_summary.output_path_summaries.join(" | "), "[media-file-reference]");
  const metadataSummary = safeDryRunUploadSpikeString([
    input.platformUploadRequest.metadata_request.title_summary,
    input.platformUploadRequest.metadata_request.description_summary,
    input.platformUploadRequest.metadata_request.tags_summary.join(","),
    input.platformUploadRequest.metadata_request.visibility_summary,
  ].join(" | "), "[metadata-reference]");
  const result: DryRunUploadSpikeResult = {
    schema_version: "1.0",
    dry_run_upload_spike_result_id: `dry-run-upload-spike-${crypto.randomUUID()}`,
    upload_execution_design_id: input.uploadExecutionDesign.upload_execution_design_id,
    upload_execution_approval_id: input.uploadExecutionApproval.upload_execution_approval_id,
    platform_upload_request_id: input.platformUploadRequest.platform_upload_request_id,
    upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
    local_output_review_id: input.localOutputReview.local_output_review_id,
    production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
    final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
    render_plan_id: input.spikeResult.render_plan_id,
    project_id: input.spikeResult.project_id,
    platform: input.spikeResult.platform,
    simulation_state: dryRunPassed ? "simulated" : "blocked",
    created_at: new Date().toISOString(),
    simulation_mode: "local_dry_run_upload_spike_simulation",
    required_artifacts: {
      upload_execution_design_validated: true,
      upload_execution_approval_validated: true,
      platform_upload_request_validated: true,
      upload_package_design_validated: true,
      local_output_review_validated: true,
      spike_result_validated: true,
    },
    simulated_upload_plan: {
      upload_requested: false,
      upload_allowed: false,
      upload_execution_enabled: false,
      dry_run_upload_simulated: dryRunPassed,
      platform_api_calls_allowed: false,
      network_calls_allowed: false,
      resumable_upload_allowed: false,
      direct_upload_allowed: false,
      credentials_required: false,
      credentials_accessed: false,
      token_accessed: false,
      keychain_accessed: false,
      env_access_allowed: false,
      max_upload_attempts: 0,
      media_file_reference_summary: mediaSummary,
      metadata_reference_summary: metadataSummary,
      raw_media_path_stored: false,
      raw_platform_payload_created: false,
      raw_platform_payload_stored: false,
    },
    dry_run_execution_summary: {
      simulation_steps_total: 5,
      simulation_steps_passed: dryRunPassed ? 5 : 0,
      simulation_steps_failed: dryRunPassed ? 0 : 5,
      media_file_existence_checked: false,
      media_file_read: false,
      media_file_uploaded: false,
      metadata_payload_constructed: false,
      platform_endpoint_selected: false,
      network_request_constructed: false,
      network_request_sent: false,
      response_received: false,
      raw_response_stored: false,
      warnings: dryRunPassed ? ["Dry-run upload workflow simulated locally with no network or credential access."] : ["Dry-run upload workflow blocked or not simulated."],
      blocking_reasons: dryRunPassed ? [] : ["Dry-run upload spike simulation did not pass."],
    },
    network_boundary: {
      network_calls_allowed: false,
      network_calls_made: false,
      platform_api_calls_allowed: false,
      platform_api_calls_made: false,
      external_side_effects_allowed: false,
      external_side_effects_observed: false,
    },
    credential_boundary: {
      credentials_required: false,
      credentials_accessed: false,
      token_accessed: false,
      keychain_accessed: false,
      env_accessed: false,
      credential_reference_stored: false,
      token_reference_stored: false,
    },
    platform_boundary: {
      platform_endpoint_selected: false,
      platform_api_payload_created: false,
      platform_api_payload_stored: false,
      raw_account_ids_stored: false,
    },
    validation: {
      dry_run_upload_spike_passed: dryRunPassed,
      ready_for_real_upload: false,
      upload_allowed: false,
      upload_execution_enabled: false,
      platform_api_calls_allowed: false,
      network_calls_allowed: false,
      credentials_accessed: false,
      token_accessed: false,
      blocking_reasons: dryRunPassed ? [] : ["Dry-run upload spike simulation blocked."],
      warnings: dryRunPassed ? ["Simulation completed locally without network or credential access."] : ["Simulation did not pass."],
    },
    provenance: {
      generated_by: "createDryRunUploadSpikeResult",
      source_upload_execution_design_id: input.uploadExecutionDesign.upload_execution_design_id,
      source_upload_execution_approval_id: input.uploadExecutionApproval.upload_execution_approval_id,
      source_platform_upload_request_id: input.platformUploadRequest.platform_upload_request_id,
      source_upload_package_design_id: input.uploadPackageDesign.upload_package_design_id,
      source_local_output_review_id: input.localOutputReview.local_output_review_id,
      source_production_render_spike_result_id: input.spikeResult.production_render_spike_result_id,
      source_final_render_execution_request_id: input.spikeResult.final_render_execution_request_id,
      source_render_plan_id: input.spikeResult.render_plan_id,
    },
  };
  if (!validateDryRunUploadSpikeResult(result).ok) throw new Error("Unsafe dry-run upload spike result cannot be created.");
  return result;
}

export function validateDryRunUploadSpikeResult(result: unknown): DryRunUploadSpikeResultValidationResult {
  return validateDryRunUploadSpikeShape(result);
}

interface DryRunUploadSpikeResultsStoreSummaryItem {
  dry_run_upload_spike_result_id: string;
  project_id: string;
  platform: string;
  simulation_state: string;
  created_at: string;
}

function safeDryRunUploadSpikeSummary(result: DryRunUploadSpikeResult): DryRunUploadSpikeResultsStoreSummaryItem {
  return {
    dry_run_upload_spike_result_id: safeDryRunUploadSpikeString(result.dry_run_upload_spike_result_id, "[unsafe-id]"),
    project_id: safeDryRunUploadSpikeString(result.project_id, "[unsafe-project]"),
    platform: safeDryRunUploadSpikeString(result.platform, "[unsafe-platform]"),
    simulation_state: result.simulation_state,
    created_at: result.created_at,
  };
}

export function saveDryRunUploadSpikeResult(result: DryRunUploadSpikeResult): void {
  const validation = validateDryRunUploadSpikeResult(result);
  if (!validation.ok) throw new Error("Unsafe dry-run upload spike result cannot be stored.");
  const store = loadDryRunUploadSpikeResultsStore();
  const existing = store.results.findIndex((item) => item.dry_run_upload_spike_result_id === result.dry_run_upload_spike_result_id);
  if (existing >= 0) store.results[existing] = result;
  else store.results.push(result);
  saveDryRunUploadSpikeResultsStore(store);
}

export function listDryRunUploadSpikeResults(options?: { project_id?: string; platform?: string; simulation_state?: string; upload_execution_design_id?: string; upload_execution_approval_id?: string }): DryRunUploadSpikeResult[] {
  const store = loadDryRunUploadSpikeResultsStore();
  return store.results.filter((result) => {
    if (options?.project_id && result.project_id !== options.project_id) return false;
    if (options?.platform && result.platform !== options.platform) return false;
    if (options?.simulation_state && result.simulation_state !== options.simulation_state) return false;
    if (options?.upload_execution_design_id && result.upload_execution_design_id !== options.upload_execution_design_id) return false;
    if (options?.upload_execution_approval_id && result.upload_execution_approval_id !== options.upload_execution_approval_id) return false;
    return true;
  }).sort((a, b) => {
    const compare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return compare !== 0 ? compare : a.dry_run_upload_spike_result_id.localeCompare(b.dry_run_upload_spike_result_id);
  });
}

export function getDryRunUploadSpikeResult(dry_run_upload_spike_result_id: string): DryRunUploadSpikeResult | null {
  const store = loadDryRunUploadSpikeResultsStore();
  return store.results.find((result) => result.dry_run_upload_spike_result_id === dry_run_upload_spike_result_id) ?? null;
}

export function revokeDryRunUploadSpikeResult(dry_run_upload_spike_result_id: string, reason: string): DryRunUploadSpikeResult {
  const result = getDryRunUploadSpikeResult(dry_run_upload_spike_result_id);
  if (!result) throw new Error("Dry-run upload spike result not found");
  const safeReason = safeDryRunUploadSpikeString(reason, "[unsafe-reason]");
  if (safeReason === "[unsafe-reason]") throw new Error("Unsafe dry-run upload spike reason cannot be stored.");
  const revoked: DryRunUploadSpikeResult = {
    ...result,
    simulation_state: "revoked",
    validation: { ...result.validation, blocking_reasons: [...result.validation.blocking_reasons, safeReason], warnings: [...result.validation.warnings, "Dry-run upload spike result revoked."] },
    provenance: { ...result.provenance, generated_by: "revokeDryRunUploadSpikeResult" },
  };
  saveDryRunUploadSpikeResult(revoked);
  return revoked;
}

export function getDryRunUploadSpikeResultReport(options?: { project_id?: string; platform?: string }): {
  total: number;
  by_state: Record<string, number>;
  blocked: number;
  simulated: number;
  failed: number;
  revoked: number;
  dry_run_upload_spike_passed: number;
  ready_for_real_upload: 0;
  upload_allowed: 0;
  upload_execution_enabled: 0;
  platform_api_calls_allowed: 0;
  network_calls_allowed: 0;
  network_calls_made: 0;
  credentials_accessed: 0;
  token_accessed: 0;
  results: Array<DryRunUploadSpikeResultsStoreSummaryItem>;
} {
  const results = listDryRunUploadSpikeResults(options);
  const by_state: Record<string, number> = {};
  let blocked = 0;
  let simulated = 0;
  let failed = 0;
  let revoked = 0;
  let passed = 0;
  const summaries = results.map((result) => {
    by_state[result.simulation_state] = (by_state[result.simulation_state] ?? 0) + 1;
    if (result.simulation_state === "blocked") blocked++;
    if (result.simulation_state === "simulated") simulated++;
    if (result.simulation_state === "failed") failed++;
    if (result.simulation_state === "revoked") revoked++;
    if (result.validation.dry_run_upload_spike_passed) passed++;
    return safeDryRunUploadSpikeSummary(result);
  });
  return {
    total: summaries.length,
    by_state,
    blocked,
    simulated,
    failed,
    revoked,
    dry_run_upload_spike_passed: passed,
    ready_for_real_upload: 0,
    upload_allowed: 0,
    upload_execution_enabled: 0,
    platform_api_calls_allowed: 0,
    network_calls_allowed: 0,
    network_calls_made: 0,
    credentials_accessed: 0,
    token_accessed: 0,
    results: summaries,
  };
}

export type TestRenderSpikeExecutionMode = "test_only_local_render_spike";

export interface TestRenderSpikeScope {
  test_only: true;
  production_project_allowed: false;
  user_media_allowed: false;
  upload_allowed: false;
  platform_api_calls_allowed: false;
}

export interface TestRenderSpikeSyntheticInput {
  input_kind: "lavfi_color" | "generated_test_pattern";
  duration_seconds: number;
  resolution: "320x240" | "160x90";
  source_is_user_media: false;
}

export interface TestRenderSpikeOutputSummary {
  output_directory_summary: string;
  output_file_count: number;
  output_files_created: boolean;
  media_files_created: boolean;
  output_path_summaries: string[];
  bytes_written?: number;
  duration_seconds: number;
}

export interface TestRenderSpikeProcessSummary {
  command_invoked: true;
  command_label: "ffmpeg";
  raw_command_stored: false;
  stdout_stored: false;
  stderr_stored: false;
  exit_code?: number;
  timed_out: boolean;
  runtime_ms?: number;
}

export interface TestRenderSpikeResultValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface ValidationResult {
  ok: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export interface TestRenderSpikeResult {
  schema_version: "1.0";
  test_render_spike_result_id: string;
  real_execution_approval_id: string;
  real_execution_gate_id: string;
  command_manifest_id: string;
  project_id: string;
  platform: string;
  execution_mode: TestRenderSpikeExecutionMode;
  created_at: string;
  completed_at?: string;
  test_scope: TestRenderSpikeScope;
  execution_permissions: {
    operator_confirmed: true;
    child_process_allowed: true;
    ffmpeg_execution_allowed: true;
    renderer_execution_allowed: false;
    media_creation_allowed: true;
    env_access_allowed: false;
    process_output_capture_allowed: false | "redacted_summary_only";
  };
  synthetic_input: TestRenderSpikeSyntheticInput;
  output_summary: TestRenderSpikeOutputSummary;
  process_summary: TestRenderSpikeProcessSummary;
  validation: {
    test_spike_passed: boolean;
    ready_for_production_render: false;
    ready_for_upload: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "runTestOnlyLocalRenderSpike";
    source_gate_id: string;
    source_approval_id: string;
    source_manifest_id: string;
  };
}

interface TestRenderSpikeResultsStore {
  schema_version: "1.0";
  created_at: string;
  results: TestRenderSpikeResult[];
}

function isSafeRuntimeRoot(candidate: string): boolean {
  const runtimeDir = path.resolve(getRuntimeDir());
  const tempRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(candidate);
  return resolved === runtimeDir || resolved.startsWith(runtimeDir + path.sep) || resolved === tempRoot || resolved.startsWith(tempRoot + path.sep);
}

function resolveSafeTestRenderSpikeOutputBaseDir(outputBaseDir: string): { ok: boolean; absolutePath?: string; blocking_reasons: string[] } {
  const blocking_reasons: string[] = [];
  if (typeof outputBaseDir !== "string" || outputBaseDir.length === 0) {
    blocking_reasons.push("outputBaseDir must be a string");
    return { ok: false, blocking_reasons };
  }
  if (outputBaseDir.includes("://") || outputBaseDir.startsWith("http") || outputBaseDir.startsWith("https")) {
    blocking_reasons.push("outputBaseDir URLs are not allowed");
    return { ok: false, blocking_reasons };
  }
  if (outputBaseDir.includes("..")) {
    blocking_reasons.push("outputBaseDir traversal is not allowed");
    return { ok: false, blocking_reasons };
  }
  if (isForbiddenStringPattern(outputBaseDir)) {
    blocking_reasons.push("outputBaseDir contains forbidden patterns");
    return { ok: false, blocking_reasons };
  }
  const resolved = path.isAbsolute(outputBaseDir) ? outputBaseDir : path.resolve(getRuntimeDir(), outputBaseDir);
  if (!isSafeRuntimeRoot(resolved)) {
    blocking_reasons.push("outputBaseDir must be inside a safe runtime or temp directory");
    return { ok: false, blocking_reasons };
  }
  return { ok: true, absolutePath: resolved, blocking_reasons: [] };
}

function getTestRenderSpikeResultsPath(): string {
  return path.join(getRuntimeDir(), "test-render-spike-results.json");
}

function loadTestRenderSpikeResultsStore(): TestRenderSpikeResultsStore {
  try {
    const storePath = getTestRenderSpikeResultsPath();
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, "utf8")) as TestRenderSpikeResultsStore;
    }
  } catch {
    // start fresh
  }
  return { schema_version: "1.0", created_at: new Date().toISOString(), results: [] };
}

function saveTestRenderSpikeResultsStore(store: TestRenderSpikeResultsStore): void {
  const storePath = getTestRenderSpikeResultsPath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  store.results.sort((a, b) => {
    const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return t !== 0 ? t : a.test_render_spike_result_id.localeCompare(b.test_render_spike_result_id);
  });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function validateTestRenderSpikeResultShape(result: unknown): TestRenderSpikeResultValidationResult {
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];
  if (typeof result !== "object" || result === null) {
    return { ok: false, blocking_reasons: ["Test render spike result must be an object"], warnings };
  }
  const r = result as Record<string, unknown>;
  const required = ["schema_version", "test_render_spike_result_id", "real_execution_approval_id", "real_execution_gate_id", "command_manifest_id", "project_id", "platform", "execution_mode", "created_at", "test_scope", "execution_permissions", "synthetic_input", "output_summary", "process_summary", "validation", "provenance"];
  for (const key of required) {
    if (!(key in r)) blocking_reasons.push("Test render spike result is missing a required field");
  }
  if (r.schema_version !== "1.0") blocking_reasons.push("schema_version must be 1.0");
  if (r.execution_mode !== "test_only_local_render_spike") blocking_reasons.push("execution_mode must be test_only_local_render_spike");
  const forbidden = recursivelyCheckForForbiddenPatterns(result);
  blocking_reasons.push(...forbidden);
  const testScope = r.test_scope as Record<string, unknown> | undefined;
  if (!testScope || testScope.test_only !== true || testScope.production_project_allowed !== false || testScope.user_media_allowed !== false || testScope.upload_allowed !== false || testScope.platform_api_calls_allowed !== false) {
    blocking_reasons.push("Test scope is unsafe");
  }
  const perms = r.execution_permissions as Record<string, unknown> | undefined;
  if (!perms || perms.operator_confirmed !== true || perms.child_process_allowed !== true || perms.ffmpeg_execution_allowed !== true || perms.renderer_execution_allowed !== false || perms.media_creation_allowed !== true || perms.env_access_allowed !== false) {
    blocking_reasons.push("Execution permissions are unsafe");
  }
  const capture = perms?.process_output_capture_allowed;
  if (!(capture === false || capture === "redacted_summary_only")) blocking_reasons.push("process_output_capture_allowed must be false or redacted_summary_only");
  const synthetic = r.synthetic_input as Record<string, unknown> | undefined;
  if (!synthetic || synthetic.source_is_user_media !== false || (synthetic.duration_seconds as number) > 3 || !["lavfi_color", "generated_test_pattern"].includes(String(synthetic.input_kind)) || !["320x240", "160x90"].includes(String(synthetic.resolution))) {
    blocking_reasons.push("Synthetic input is unsafe");
  }
  const output = r.output_summary as Record<string, any> | undefined;
  if (!output) blocking_reasons.push("Output summary is required");
  if (output?.output_file_count > 1) blocking_reasons.push("output_file_count exceeds limit");
  if (output?.duration_seconds > 3) blocking_reasons.push("duration_seconds exceeds limit");
  if (output && typeof output.output_directory_summary === "string") {
    const summary = output.output_directory_summary.toLowerCase();
    if (
      isForbiddenStringPattern(summary) ||
      summary.includes("/users/") ||
      summary.includes("/projects/") ||
      summary.includes("project-media") ||
      summary.includes("user-media") ||
      summary.includes("upload")
    ) {
      blocking_reasons.push("Output directory summary is unsafe");
    }
  }
  const process = r.process_summary as Record<string, any> | undefined;
  if (!process || process.command_invoked !== true || process.command_label !== "ffmpeg" || process.raw_command_stored !== false || process.stdout_stored !== false || process.stderr_stored !== false) {
    blocking_reasons.push("Process summary is unsafe");
  }
  if (r.validation && typeof r.validation === "object") {
    const validation = r.validation as Record<string, unknown>;
    if (validation.ready_for_production_render !== false || validation.ready_for_upload !== false) blocking_reasons.push("Ready flags must remain false");
  }
  return { ok: blocking_reasons.length === 0, blocking_reasons, warnings };
}

export function validateTestRenderSpikePermission(input: {
  approval: RealRendererExecutionApproval;
  dryRun: false;
  executionMode: "test_only_local_render_spike";
  operatorConfirmed: true;
  allowChildProcess: true;
  allowFfmpeg: true;
  allowMediaCreation: true;
  outputBaseDir: string;
}): ValidationResult {
  const blockingReasons: string[] = [];
  const approval = input.approval;
  if (approval.dry_run !== true) blockingReasons.push("Approval must be dry_run true");
  if (approval.approval_state !== "approved_for_future_real_execution_request") blockingReasons.push("Approval must be approved_for_future_real_execution_request");
  if (approval.execution_permissions.real_execution_requested !== false || approval.execution_permissions.execution_enabled !== false) blockingReasons.push("Approval must remain non-executing");
  if (input.dryRun !== false) blockingReasons.push("dryRun must be false");
  if (input.executionMode !== "test_only_local_render_spike") blockingReasons.push("executionMode must be test_only_local_render_spike");
  if (input.operatorConfirmed !== true || input.allowChildProcess !== true || input.allowFfmpeg !== true || input.allowMediaCreation !== true) blockingReasons.push("Explicit operator permissions are required");
  const resolved = resolveSafeTestRenderSpikeOutputBaseDir(input.outputBaseDir);
  blockingReasons.push(...resolved.blocking_reasons);
  return { ok: blockingReasons.length === 0, blocking_reasons: blockingReasons, warnings: [] };
}

export function runTestOnlyLocalRenderSpike(input: {
  approval: RealRendererExecutionApproval;
  dryRun: false;
  executionMode: "test_only_local_render_spike";
  operatorConfirmed: true;
  allowChildProcess: true;
  allowFfmpeg: true;
  allowMediaCreation: true;
  outputBaseDir: string;
  timeoutMs?: number;
}): TestRenderSpikeResult {
  const permission = validateTestRenderSpikePermission(input);
  if (!permission.ok) {
    return {
      schema_version: "1.0",
      test_render_spike_result_id: crypto.randomUUID(),
      real_execution_approval_id: input.approval.real_execution_approval_id,
      real_execution_gate_id: input.approval.real_execution_gate_id,
      command_manifest_id: input.approval.command_manifest_id,
      project_id: input.approval.project_id,
      platform: input.approval.platform,
      execution_mode: "test_only_local_render_spike",
      created_at: new Date().toISOString(),
      test_scope: { test_only: true, production_project_allowed: false, user_media_allowed: false, upload_allowed: false, platform_api_calls_allowed: false },
      execution_permissions: { operator_confirmed: true, child_process_allowed: true, ffmpeg_execution_allowed: true, renderer_execution_allowed: false, media_creation_allowed: true, env_access_allowed: false, process_output_capture_allowed: "redacted_summary_only" },
      synthetic_input: { input_kind: "lavfi_color", duration_seconds: 1, resolution: "160x90", source_is_user_media: false },
      output_summary: { output_directory_summary: "[blocked]", output_file_count: 0, output_files_created: false, media_files_created: false, output_path_summaries: [], duration_seconds: 0 },
      process_summary: { command_invoked: true, command_label: "ffmpeg", raw_command_stored: false, stdout_stored: false, stderr_stored: false, exit_code: 1, timed_out: false, runtime_ms: 0 },
      validation: { test_spike_passed: false, ready_for_production_render: false, ready_for_upload: false, blocking_reasons: permission.blocking_reasons, warnings: [] },
      provenance: { generated_by: "runTestOnlyLocalRenderSpike", source_gate_id: input.approval.real_execution_gate_id, source_approval_id: input.approval.real_execution_approval_id, source_manifest_id: input.approval.command_manifest_id },
    };
  }

  const resolvedBase = resolveSafeTestRenderSpikeOutputBaseDir(input.outputBaseDir);
  if (!resolvedBase.ok || !resolvedBase.absolutePath) {
    return {
      schema_version: "1.0",
      test_render_spike_result_id: crypto.randomUUID(),
      real_execution_approval_id: input.approval.real_execution_approval_id,
      real_execution_gate_id: input.approval.real_execution_gate_id,
      command_manifest_id: input.approval.command_manifest_id,
      project_id: input.approval.project_id,
      platform: input.approval.platform,
      execution_mode: "test_only_local_render_spike",
      created_at: new Date().toISOString(),
      test_scope: { test_only: true, production_project_allowed: false, user_media_allowed: false, upload_allowed: false, platform_api_calls_allowed: false },
      execution_permissions: { operator_confirmed: true, child_process_allowed: true, ffmpeg_execution_allowed: true, renderer_execution_allowed: false, media_creation_allowed: true, env_access_allowed: false, process_output_capture_allowed: "redacted_summary_only" },
      synthetic_input: { input_kind: "lavfi_color", duration_seconds: 1, resolution: "160x90", source_is_user_media: false },
      output_summary: { output_directory_summary: "[blocked]", output_file_count: 0, output_files_created: false, media_files_created: false, output_path_summaries: [], duration_seconds: 0 },
      process_summary: { command_invoked: true, command_label: "ffmpeg", raw_command_stored: false, stdout_stored: false, stderr_stored: false, exit_code: 1, timed_out: false, runtime_ms: 0 },
      validation: { test_spike_passed: false, ready_for_production_render: false, ready_for_upload: false, blocking_reasons: resolvedBase.blocking_reasons, warnings: [] },
      provenance: { generated_by: "runTestOnlyLocalRenderSpike", source_gate_id: input.approval.real_execution_gate_id, source_approval_id: input.approval.real_execution_approval_id, source_manifest_id: input.approval.command_manifest_id },
    };
  }

  const require = createRequire(import.meta.url);
  const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
  const resultId = `test-render-spike-${crypto.randomUUID()}`;
  const spikeDir = path.join(resolvedBase.absolutePath, "test-render-spike", resultId);
  fs.mkdirSync(spikeDir, { recursive: true });
  const outputPath = path.join(spikeDir, "test-pattern.png");
  const startedAt = Date.now();
  const timeoutMs = Math.min(input.timeoutMs ?? 5000, 10000);
  const ffmpegResult = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=160x90:d=1", "-frames:v", "1", "-y", outputPath],
    { timeout: timeoutMs, stdio: "ignore" }
  );
  const runtimeMs = Date.now() - startedAt;
  const outputExists = fs.existsSync(outputPath);
  const bytesWritten = outputExists ? fs.statSync(outputPath).size : 0;
  const passed = ffmpegResult.status === 0 && outputExists && bytesWritten > 0;
  const completion = new Date().toISOString();
  const safeSummary = `[ignored-runtime-test-dir]/test-render-spike/${resultId}`;
  return {
    schema_version: "1.0",
    test_render_spike_result_id: resultId,
    real_execution_approval_id: input.approval.real_execution_approval_id,
    real_execution_gate_id: input.approval.real_execution_gate_id,
    command_manifest_id: input.approval.command_manifest_id,
    project_id: input.approval.project_id,
    platform: input.approval.platform,
    execution_mode: "test_only_local_render_spike",
    created_at: new Date(startedAt).toISOString(),
    completed_at: completion,
    test_scope: { test_only: true, production_project_allowed: false, user_media_allowed: false, upload_allowed: false, platform_api_calls_allowed: false },
    execution_permissions: { operator_confirmed: true, child_process_allowed: true, ffmpeg_execution_allowed: true, renderer_execution_allowed: false, media_creation_allowed: true, env_access_allowed: false, process_output_capture_allowed: "redacted_summary_only" },
    synthetic_input: { input_kind: "lavfi_color", duration_seconds: 1, resolution: "160x90", source_is_user_media: false },
    output_summary: {
      output_directory_summary: safeSummary,
      output_file_count: outputExists ? 1 : 0,
      output_files_created: outputExists,
      media_files_created: outputExists,
      output_path_summaries: outputExists ? ["[test-output-image]"] : [],
      ...(bytesWritten > 0 ? { bytes_written: bytesWritten } : {}),
      duration_seconds: 1,
    },
    process_summary: {
      command_invoked: true,
      command_label: "ffmpeg",
      raw_command_stored: false,
      stdout_stored: false,
      stderr_stored: false,
      exit_code: typeof ffmpegResult.status === "number" ? ffmpegResult.status : 1,
      timed_out: Boolean(ffmpegResult.error && ffmpegResult.error.name === "Error" && String(ffmpegResult.error.message).includes("timed out")),
      runtime_ms: runtimeMs,
    },
    validation: {
      test_spike_passed: passed,
      ready_for_production_render: false,
      ready_for_upload: false,
      blocking_reasons: passed ? [] : ["FFmpeg test-only spike did not complete successfully"],
      warnings: passed ? ["Test-only spike; no project media touched."] : ["FFmpeg unavailable or test-only spike failed."],
    },
    provenance: {
      generated_by: "runTestOnlyLocalRenderSpike",
      source_gate_id: input.approval.real_execution_gate_id,
      source_approval_id: input.approval.real_execution_approval_id,
      source_manifest_id: input.approval.command_manifest_id,
    },
  };
}

export function validateTestRenderSpikeResult(result: unknown): TestRenderSpikeResultValidationResult {
  return validateTestRenderSpikeResultShape(result);
}

export function saveTestRenderSpikeResult(result: TestRenderSpikeResult): void {
  const validation = validateTestRenderSpikeResult(result);
  if (!validation.ok) {
    throw new Error("Unsafe test render spike result cannot be stored.");
  }
  const store = loadTestRenderSpikeResultsStore();
  const existing = store.results.findIndex((r) => r.test_render_spike_result_id === result.test_render_spike_result_id);
  if (existing >= 0) store.results[existing] = result;
  else store.results.push(result);
  saveTestRenderSpikeResultsStore(store);
}

export function listTestRenderSpikeResults(options?: {
  project_id?: string;
  platform?: string;
  execution_mode?: string;
  test_spike_passed?: boolean;
}): TestRenderSpikeResult[] {
  const store = loadTestRenderSpikeResultsStore();
  return store.results.filter((r) => {
    if (options?.project_id && r.project_id !== options.project_id) return false;
    if (options?.platform && r.platform !== options.platform) return false;
    if (options?.execution_mode && r.execution_mode !== options.execution_mode) return false;
    if (typeof options?.test_spike_passed === "boolean" && r.validation.test_spike_passed !== options.test_spike_passed) return false;
    return true;
  }).sort((a, b) => {
    const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return t !== 0 ? t : a.test_render_spike_result_id.localeCompare(b.test_render_spike_result_id);
  });
}

export function getTestRenderSpikeResult(test_render_spike_result_id: string): TestRenderSpikeResult | null {
  const store = loadTestRenderSpikeResultsStore();
  return store.results.find((r) => r.test_render_spike_result_id === test_render_spike_result_id) ?? null;
}

export function getTestRenderSpikeResultReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  passed: number;
  failed: number;
  ready_for_production_render: 0;
  ready_for_upload: 0;
  media_files_created: number;
  output_file_count: number;
  results: Array<{
    test_render_spike_result_id: string;
    project_id: string;
    platform: string;
    execution_mode: string;
    test_spike_passed: boolean;
    output_file_count: number;
    media_files_created: boolean;
    created_at: string;
  }>;
} {
  const results = listTestRenderSpikeResults(options);
  let passed = 0;
  let mediaFilesCreated = 0;
  let outputFileCount = 0;
  const summaries = results.map((r) => {
    if (r.validation.test_spike_passed) passed++;
    if (r.output_summary.media_files_created) mediaFilesCreated++;
    outputFileCount += r.output_summary.output_file_count;
    return {
      test_render_spike_result_id: sanitizeRenderPlanString(r.test_render_spike_result_id, "[unsafe-id]"),
      project_id: sanitizeRenderPlanString(r.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(r.platform, "[unsafe-platform]"),
      execution_mode: r.execution_mode,
      test_spike_passed: r.validation.test_spike_passed,
      output_file_count: r.output_summary.output_file_count,
      media_files_created: r.output_summary.media_files_created,
      created_at: r.created_at,
    };
  });
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    ready_for_production_render: 0,
    ready_for_upload: 0,
    media_files_created: mediaFilesCreated,
    output_file_count: outputFileCount,
    results: summaries,
  };
}

interface RealRendererExecutionApprovalsStore {
  approvals: RealRendererExecutionApproval[];
}

function getRealRendererExecutionApprovalsPath(): string {
  const runtimeDir = getRuntimeDir();
  return path.join(runtimeDir, "real-renderer-execution-approvals.json");
}

function loadRealRendererExecutionApprovalsStore(): RealRendererExecutionApprovalsStore {
  try {
    const filePath = getRealRendererExecutionApprovalsPath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (e) {
    // Continue with empty store
  }
  return { approvals: [] };
}

function saveRealRendererExecutionApprovalsStore(store: RealRendererExecutionApprovalsStore): void {
  const filePath = getRealRendererExecutionApprovalsPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

export function createRealRendererExecutionApproval(input: {
  gate: RealRendererExecutionGate;
  decision: "draft" | "approved_for_future_real_execution_request" | "rejected";
  reviewed_by_label?: string;
  decision_note_summary?: string;
  checklist_acknowledged?: boolean;
  risk_acknowledgement?: boolean;
  understands_real_execution_not_enabled?: boolean;
  dryRun: true;
}): RealRendererExecutionApproval {
  if (input.dryRun !== true) {
    throw new Error("dryRun=true required");
  }
  if (input.gate.dry_run !== true) {
    throw new Error("gate.dry_run=true required");
  }
  if (input.gate.real_execution_requested !== false) {
    throw new Error("gate.real_execution_requested=false required");
  }
  if (input.gate.explicit_operator_approval_required !== true) {
    throw new Error("gate.explicit_operator_approval_required=true required");
  }
  if (input.gate.validation.ready_for_real_execution !== false) {
    throw new Error("gate.validation.ready_for_real_execution=false required");
  }
  if (input.gate.validation.ready_for_render !== false) {
    throw new Error("gate.validation.ready_for_render=false required");
  }
  if (input.gate.validation.ready_for_upload !== false) {
    throw new Error("gate.validation.ready_for_upload=false required");
  }

  // Check all execution constraints are false
  for (const [key, value] of Object.entries(input.gate.execution_constraints)) {
    if (key !== "allowed_output_directory_summary" && key !== "allowed_tools" && value !== false) {
      throw new Error(`gate.execution_constraints.${key}=false required`);
    }
  }
  if (input.gate.execution_constraints.allowed_tools.length > 0) {
    throw new Error("gate.execution_constraints.allowed_tools must be empty");
  }

  // For approved decision, require all acknowledgements
  if (input.decision === "approved_for_future_real_execution_request") {
    if (input.gate.gate_state !== "ready_for_explicit_operator_approval") {
      throw new Error("gate.gate_state must be ready_for_explicit_operator_approval for approval");
    }
    if (input.checklist_acknowledged !== true) {
      throw new Error("checklist_acknowledged=true required for approval");
    }
    if (input.risk_acknowledgement !== true) {
      throw new Error("risk_acknowledgement=true required for approval");
    }
    if (input.understands_real_execution_not_enabled !== true) {
      throw new Error("understands_real_execution_not_enabled=true required for approval");
    }
  }

  // Validate reviewed_by_label if provided
  if (input.reviewed_by_label && typeof input.reviewed_by_label === "string") {
    if (!/^[a-z0-9_-]+$/.test(input.reviewed_by_label)) {
      throw new Error("reviewed_by_label must match safe pattern");
    }
  }

  // Validate decision_note_summary if provided
  if (input.decision_note_summary && typeof input.decision_note_summary === "string") {
    if (input.decision_note_summary.length > 200) {
      throw new Error("decision_note_summary must be <= 200 chars");
    }
    const forbiddenPatterns = [
      "credential_reference",
      "keychain://",
      "access_token",
      "refresh_token",
      "client_secret",
      "/usr/",
      "/bin/",
      "~/",
      "child_process",
      "spawn(",
      "execSync(",
      "ffmpeg -version",
      "ffprobe",
      "videos.insert",
      "process.env[",
    ];
    for (const pattern of forbiddenPatterns) {
      if (input.decision_note_summary.includes(pattern)) {
        throw new Error("decision_note_summary contains forbidden pattern");
      }
    }
  }

  const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const approval: RealRendererExecutionApproval = {
    schema_version: "1.0",
    real_execution_approval_id: approvalId,
    real_execution_gate_id: input.gate.real_execution_gate_id,
    mock_result_id: input.gate.mock_result_id,
    version_check_plan_id: input.gate.version_check_plan_id,
    discovery_id: input.gate.discovery_id,
    preflight_id: input.gate.preflight_id,
    command_manifest_id: input.gate.command_manifest_id,
    project_id: input.gate.project_id,
    platform: input.gate.platform,
    dry_run: true,
    approval_state: input.decision as RealRendererExecutionApprovalState,
    created_at: new Date().toISOString(),
    approval_scope: {
      scope_kind: "real_renderer_execution_spike",
      one_time_only: true,
      max_output_files: 0,
      allowed_output_directory_summary: "[not-approved-yet]",
      allowed_tools: [],
    },
    operator_review: {
      reviewed_by_label: input.reviewed_by_label || "[not-reviewed]",
      ...(input.decision !== "draft" ? { reviewed_at: new Date().toISOString() } : {}),
      ...(input.decision_note_summary ? { decision_note_summary: input.decision_note_summary } : {}),
      checklist_acknowledged: input.checklist_acknowledged ?? false,
      risk_acknowledgement: input.risk_acknowledgement ?? false,
      understands_real_execution_not_enabled: input.understands_real_execution_not_enabled ?? false,
    },
    execution_permissions: {
      real_execution_requested: false,
      execution_enabled: false,
      child_process_allowed: false,
      ffmpeg_execution_allowed: false,
      renderer_execution_allowed: false,
      media_creation_allowed: false,
      upload_allowed: false,
      platform_api_calls_allowed: false,
      env_access_allowed: false,
      process_output_capture_allowed: false,
    },
    required_acknowledgements: [
      {
        acknowledgement_id: "ack-scope-understood",
        kind: "approval_scope_understood",
        acknowledged: input.decision === "approved_for_future_real_execution_request",
        blocking_reasons: [],
        warnings: [],
      },
      {
        acknowledgement_id: "ack-risks-acknowledged",
        kind: "risks_acknowledged",
        acknowledged: input.decision === "approved_for_future_real_execution_request" && (input.risk_acknowledgement ?? false),
        blocking_reasons: [],
        warnings: [],
      },
      {
        acknowledgement_id: "ack-execution-disabled-confirmed",
        kind: "execution_disabled_confirmed",
        acknowledged: input.decision === "approved_for_future_real_execution_request" && (input.understands_real_execution_not_enabled ?? false),
        blocking_reasons: [],
        warnings: [],
      },
    ],
    validation: {
      ready_for_real_execution: false,
      ready_for_render: false,
      ready_for_upload: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: {
      generated_by: "createRealRendererExecutionApproval",
      source_gate_id: input.gate.real_execution_gate_id,
      source_mock_result_id: input.gate.mock_result_id,
      source_version_check_plan_id: input.gate.version_check_plan_id,
      source_discovery_id: input.gate.discovery_id,
      source_preflight_id: input.gate.preflight_id,
      source_manifest_id: input.gate.command_manifest_id,
    },
  };

  return approval;
}

export function validateRealRendererExecutionApproval(approval: unknown): RealRendererExecutionApprovalValidationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!approval || typeof approval !== "object") {
    blockingReasons.push("Not an object");
    return { ok: false, blocking_reasons: blockingReasons, warnings };
  }

  const a = approval as any;

  // Check required fields
  const requiredFields = [
    "schema_version",
    "real_execution_approval_id",
    "real_execution_gate_id",
    "dry_run",
    "approval_state",
    "approval_scope",
    "operator_review",
    "execution_permissions",
    "required_acknowledgements",
    "validation",
  ];
  for (const field of requiredFields) {
    if (!(field in a)) {
      blockingReasons.push(`Missing required field: ${field}`);
    }
  }

  // Check immutable constraints
  if (a.dry_run !== true) {
    blockingReasons.push("dry_run must be true");
  }
  if (a.approval_scope?.one_time_only !== true) {
    blockingReasons.push("approval_scope.one_time_only must be true");
  }
  if (a.approval_scope?.max_output_files !== 0) {
    blockingReasons.push("approval_scope.max_output_files must be 0");
  }
  if (!Array.isArray(a.approval_scope?.allowed_tools) || a.approval_scope.allowed_tools.length > 0) {
    blockingReasons.push("approval_scope.allowed_tools must be empty");
  }

  // Check execution permissions
  if (a.execution_permissions?.real_execution_requested !== false) {
    blockingReasons.push("execution_permissions.real_execution_requested must be false");
  }
  if (a.execution_permissions?.execution_enabled !== false) {
    blockingReasons.push("execution_permissions.execution_enabled must be false");
  }
  if (a.execution_permissions?.child_process_allowed !== false) {
    blockingReasons.push("execution_permissions.child_process_allowed must be false");
  }
  if (a.execution_permissions?.ffmpeg_execution_allowed !== false) {
    blockingReasons.push("execution_permissions.ffmpeg_execution_allowed must be false");
  }
  if (a.execution_permissions?.renderer_execution_allowed !== false) {
    blockingReasons.push("execution_permissions.renderer_execution_allowed must be false");
  }
  if (a.execution_permissions?.media_creation_allowed !== false) {
    blockingReasons.push("execution_permissions.media_creation_allowed must be false");
  }
  if (a.execution_permissions?.upload_allowed !== false) {
    blockingReasons.push("execution_permissions.upload_allowed must be false");
  }
  if (a.execution_permissions?.platform_api_calls_allowed !== false) {
    blockingReasons.push("execution_permissions.platform_api_calls_allowed must be false");
  }
  if (a.execution_permissions?.env_access_allowed !== false) {
    blockingReasons.push("execution_permissions.env_access_allowed must be false");
  }
  if (a.execution_permissions?.process_output_capture_allowed !== false) {
    blockingReasons.push("execution_permissions.process_output_capture_allowed must be false");
  }

  // Check validation flags
  if (a.validation?.ready_for_real_execution !== false) {
    blockingReasons.push("validation.ready_for_real_execution must be false");
  }
  if (a.validation?.ready_for_render !== false) {
    blockingReasons.push("validation.ready_for_render must be false");
  }
  if (a.validation?.ready_for_upload !== false) {
    blockingReasons.push("validation.ready_for_upload must be false");
  }

  // Check for forbidden patterns
  const forbiddenKeys = [
    "credential_reference",
    "credentialReference",
    "keychain",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
  ];

  function checkValue(obj: any): boolean {
    if (!obj || typeof obj !== "object") {
      if (typeof obj === "string") {
        const lowerStr = obj.toLowerCase();
        for (const key of forbiddenKeys) {
          if (lowerStr.includes(key.toLowerCase())) {
            return true;
          }
        }
        const patterns = [
          "/usr/",
          "/bin/",
          "/home/",
          "~/",
          "child_process(",
          "spawn(",
          "execSync(",
          "ffmpeg -version",
          "ffprobe",
          "process.env[",
          "videos.insert",
          "Bearer ",
        ];
        for (const p of patterns) {
          if (obj.includes(p)) {
            return true;
          }
        }
      }
      return false;
    }

    for (const [k, v] of Object.entries(obj)) {
      const keyLower = k.toLowerCase();
      for (const forbiddenKey of forbiddenKeys) {
        if (keyLower.includes(forbiddenKey.toLowerCase())) {
          blockingReasons.push("Contains forbidden key");
          return true;
        }
      }
      if (checkValue(v)) {
        return true;
      }
    }
    return false;
  }

  checkValue(a);
  if (blockingReasons.filter((r) => r === "Contains forbidden patterns or values").length === 0 && blockingReasons.filter((r) => r === "Contains forbidden key").length === 0) {
    if (checkValue(a)) {
      blockingReasons.push("Contains forbidden patterns or values");
    }
  }

  return {
    ok: blockingReasons.length === 0,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

export function saveRealRendererExecutionApproval(approval: RealRendererExecutionApproval): void {
  const validation = validateRealRendererExecutionApproval(approval);
  if (!validation.ok) {
    throw new Error(`Cannot save approval: ${validation.blocking_reasons.join(", ")}`);
  }

  if (approval.dry_run !== true) {
    throw new Error("Cannot save approval with dry_run=false");
  }
  if (approval.execution_permissions.real_execution_requested !== false) {
    throw new Error("Cannot save approval with real_execution_requested=true");
  }
  if (approval.execution_permissions.execution_enabled !== false) {
    throw new Error("Cannot save approval with execution_enabled=true");
  }
  if (approval.validation.ready_for_real_execution !== false) {
    throw new Error("Cannot save approval with ready_for_real_execution=true");
  }

  const store = loadRealRendererExecutionApprovalsStore();
  const existingIndex = store.approvals.findIndex((a) => a.real_execution_approval_id === approval.real_execution_approval_id);
  if (existingIndex >= 0) {
    store.approvals[existingIndex] = approval;
  } else {
    store.approvals.push(approval);
  }

  store.approvals.sort((a, b) => {
    const dateCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return dateCompare !== 0 ? dateCompare : a.real_execution_approval_id.localeCompare(b.real_execution_approval_id);
  });

  saveRealRendererExecutionApprovalsStore(store);
}

export function listRealRendererExecutionApprovals(options?: {
  project_id?: string;
  platform?: string;
  approval_state?: string;
  real_execution_gate_id?: string;
  command_manifest_id?: string;
}): RealRendererExecutionApproval[] {
  const store = loadRealRendererExecutionApprovalsStore();
  let result = [...store.approvals];

  if (options?.project_id) {
    result = result.filter((a) => a.project_id === options.project_id);
  }

  if (options?.platform) {
    result = result.filter((a) => a.platform === options.platform);
  }

  if (options?.approval_state) {
    result = result.filter((a) => a.approval_state === options.approval_state);
  }

  if (options?.real_execution_gate_id) {
    result = result.filter((a) => a.real_execution_gate_id === options.real_execution_gate_id);
  }

  if (options?.command_manifest_id) {
    result = result.filter((a) => a.command_manifest_id === options.command_manifest_id);
  }

  return result;
}

export function getRealRendererExecutionApproval(real_execution_approval_id: string): RealRendererExecutionApproval | null {
  const store = loadRealRendererExecutionApprovalsStore();
  return store.approvals.find((a) => a.real_execution_approval_id === real_execution_approval_id) || null;
}

export function revokeRealRendererExecutionApproval(real_execution_approval_id: string, reason: string): RealRendererExecutionApproval {
  const store = loadRealRendererExecutionApprovalsStore();
  const approval = store.approvals.find((a) => a.real_execution_approval_id === real_execution_approval_id);
  if (!approval) {
    throw new Error(`Approval not found: ${real_execution_approval_id}`);
  }

  // Validate reason if provided
  if (reason && typeof reason === "string") {
    if (reason.length > 200) {
      throw new Error("Revoke reason must be <= 200 chars");
    }
    const forbiddenPatterns = ["credential_reference", "keychain://", "/usr/", "/bin/", "~/", "process.env[", "access_token"];
    for (const pattern of forbiddenPatterns) {
      if (reason.includes(pattern)) {
        throw new Error("Revoke reason contains forbidden pattern");
      }
    }
  }

  approval.approval_state = "revoked";
  saveRealRendererExecutionApproval(approval);
  return approval;
}

export function getRealRendererExecutionApprovalReport(options?: {
  project_id?: string;
  platform?: string;
}): {
  total: number;
  by_state: Record<string, number>;
  draft: number;
  approved_for_future_real_execution_request: number;
  rejected: number;
  revoked: number;
  ready_for_real_execution: 0;
  ready_for_render: 0;
  ready_for_upload: 0;
  real_execution_requested: 0;
  execution_enabled: 0;
  approvals: Array<{
    real_execution_approval_id: string;
    approval_state: string;
    project_id: string;
    platform: string;
    created_at: string;
  }>;
} {
  const approvals = listRealRendererExecutionApprovals(options);
  const byState: Record<string, number> = {};

  for (const a of approvals) {
    byState[a.approval_state] = (byState[a.approval_state] || 0) + 1;
  }

  return {
    total: approvals.length,
    by_state: byState,
    draft: byState.draft || 0,
    approved_for_future_real_execution_request: byState.approved_for_future_real_execution_request || 0,
    rejected: byState.rejected || 0,
    revoked: byState.revoked || 0,
    ready_for_real_execution: 0,
    ready_for_render: 0,
    ready_for_upload: 0,
    real_execution_requested: 0,
    execution_enabled: 0,
    approvals: approvals.map((a) => ({
      real_execution_approval_id: sanitizeRenderPlanString(a.real_execution_approval_id, "[unsafe-id]"),
      approval_state: a.approval_state,
      project_id: sanitizeRenderPlanString(a.project_id, "[unsafe-project]"),
      platform: sanitizeRenderPlanString(a.platform, "[unsafe-platform]"),
      created_at: a.created_at,
    })),
  };
}

// ─── VO-3B: Compatibility Wrappers ─────────────────────────────────────────

export const saveLocalRenderPlan = saveRenderPlan;
export const getLocalRenderPlan = loadRenderPlan;
export const listLocalRenderPlans = listRenderPlans;

// Export internal functions for testing and CLI
export {
  logSchedulerEvent,
  loadQuotaState,
  saveQuotaState,
  getQuotaStatePath,
  getSchedulerLogPath,
  getRuntimeDir,
  getPackageDraftsPath,
  buildProductionPackageDraftSummary,
};
