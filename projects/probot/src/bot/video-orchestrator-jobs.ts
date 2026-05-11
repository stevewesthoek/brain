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
