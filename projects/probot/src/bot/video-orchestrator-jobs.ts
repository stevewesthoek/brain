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

// Export internal functions for testing
export { logSchedulerEvent, loadQuotaState, saveQuotaState, getQuotaStatePath, getSchedulerLogPath, getRuntimeDir };
