// Video Orchestrator job scheduler and store
// Manages scheduled video generation and publishing jobs locally using JSON-backed persistence
// Dry-run by default; no real YouTube publishing in VO-1

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
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

// Export internal functions for testing
export { logSchedulerEvent, loadQuotaState, saveQuotaState, getQuotaStatePath, getSchedulerLogPath, getRuntimeDir, getPackageDraftsPath };
