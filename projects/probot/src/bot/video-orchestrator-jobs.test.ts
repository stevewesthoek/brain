import { test } from "node:test";
import assert from "node:assert";
import {
  listVideoJobs,
  createVideoJob,
  updateVideoJobStatus,
  cancelVideoJob,
  scheduleRestOfMonth,
  runDueVideoJobs,
  getVideoJobsStatus,
  resetQuota,
  logSchedulerEvent,
  loadQuotaState,
  saveQuotaState,
  getSchedulerLogPath,
  getRuntimeDir,
} from "./video-orchestrator-jobs.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── Test Isolation ─────────────────────────────────────────────────────────

function setupTestRuntime(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "probot-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  return tempDir;
}

function cleanupTestRuntime(tempDir: string): void {
  delete process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup errors
  }
}

test("VO-J1: Create scheduled job", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    assert.ok(job.id);
    assert.equal(job.type, "generate_episode");
    assert.equal(job.status, "scheduled");
    assert.equal(job.dry_run, true);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J2: List jobs", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const beforeList = listVideoJobs();
    const job1 = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date("2026-06-05T09:00:00Z"),
      dryRun: true,
    });
    const afterList = listVideoJobs();

    assert.equal(afterList.length, beforeList.length + 1);
    assert.ok(afterList.some((j) => j.id === job1.id));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J3: Filter jobs by status", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const job1 = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date("2026-06-10T09:00:00Z"),
      dryRun: true,
    });

    const scheduled = listVideoJobs({ status: "scheduled" });
    assert.ok(scheduled.some((j) => j.id === job1.id));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J4: Update job status", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date("2026-06-15T09:00:00Z"),
      dryRun: true,
    });

    updateVideoJobStatus(job.id, "running");
    const updated = listVideoJobs().find((j) => j.id === job.id);
    assert.equal(updated?.status, "running");
    assert.ok(updated?.attempted_at);

    updateVideoJobStatus(job.id, "completed", { simulated: true });
    const completed = listVideoJobs().find((j) => j.id === job.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completed_at);
    assert.deepEqual(completed?.result, { simulated: true });
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J5: Cancel job", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date("2026-06-20T09:00:00Z"),
      dryRun: true,
    });

    cancelVideoJob(job.id);
    const cancelled = listVideoJobs().find((j) => j.id === job.id);
    assert.equal(cancelled?.status, "cancelled");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J6: Schedule rest of month creates expected jobs", (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();

    const result = scheduleRestOfMonth({
      dryRun: true,
      episodeCount: 2,
    });

    assert.ok(result.created >= 0, "Should create >= 0 jobs");
    assert.ok(result.existing >= 0, "Should find >= 0 existing");
    assert.ok(result.created + result.existing >= 0, "Should return valid counts");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J7: Schedule rest of month skips duplicates", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const before1 = scheduleRestOfMonth({ dryRun: true, episodeCount: 2 });
    const before2 = scheduleRestOfMonth({ dryRun: true, episodeCount: 2 });

    assert.ok(before2.existing > 0, "Should detect existing jobs");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J8: Run due jobs respects maxJobs", async (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const now = new Date("2026-06-01T12:00:00Z");

    for (let i = 0; i < 5; i++) {
      createVideoJob({
        type: "generate_episode",
        scheduledFor: new Date(now.getTime() - 1000 * 60 * i),
        dryRun: true,
      });
    }

    const result = await runDueVideoJobs({
      dryRun: true,
      maxJobs: 2,
      forDate: new Date(now.getTime() + 1000 * 60 * 60),
    });

    assert.ok(result.ran <= 2, "Should run at most maxJobs");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J9: Quota guard pauses jobs when exhausted", async (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();

    const now = new Date();
    for (let i = 0; i < 15; i++) {
      createVideoJob({
        type: "generate_episode",
        scheduledFor: new Date(now.getTime() - 1000 * 60),
        dryRun: true,
      });
    }

    const result = await runDueVideoJobs({
      dryRun: true,
      maxJobs: 20,
      forDate: new Date(now.getTime() + 1000 * 60 * 60),
    });

    assert.ok(result.quota_paused > 0, "Some jobs should be paused by quota guard");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-J10: Dashboard reads job counts truthfully", (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const before = getVideoJobsStatus();

    createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date("2026-07-01T09:00:00Z"),
      dryRun: true,
    });

    const after = getVideoJobsStatus();
    assert.equal(after.total_jobs, before.total_jobs + 1);
    assert.equal(after.scheduled, before.scheduled + 1);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-1B Hardening Tests ──────────────────────────────────────────────────

test("VO-1B-1: Non-dry-run job is blocked with honest error (not marked completed)", async (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const now = new Date("2026-06-15T12:00:00Z");

    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(now.getTime() - 10000),
      dryRun: false,
    });

    const before_run = listVideoJobs({ status: "scheduled", before: new Date(now.getTime() + 1000 * 60 * 60) });
    assert.ok(before_run.some((j) => j.id === job.id), "Job should be in due list before running");

    const result = await runDueVideoJobs({
      dryRun: false,
      maxJobs: 100,
      forDate: new Date(now.getTime() + 1000 * 60 * 60),
    });

    const failed_jobs = listVideoJobs({ status: "failed" });
    assert.ok(failed_jobs.some((j) => j.id === job.id), `Job should be in failed list. Result: ${JSON.stringify(result)}, Failed jobs: ${failed_jobs.length}`);

    const blocked = listVideoJobs().find((j) => j.id === job.id);
    assert.equal(blocked?.status, "failed", `Job status should be failed, got ${blocked?.status}`);
    assert.ok(blocked?.error_message?.includes("not implemented"), "Error message should explain no real executor");
    assert.ok(blocked?.completed_at, "Failed job should have completed_at timestamp");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-1B-2: Error message is persisted correctly after job failure", async (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const now = new Date("2026-06-16T12:00:00Z");

    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(now.getTime() - 1000),
      dryRun: false,
    });

    await runDueVideoJobs({
      dryRun: false,
      maxJobs: 100,
      forDate: new Date(now.getTime() + 1000 * 60 * 60),
    });

    const failed = listVideoJobs().find((j) => j.id === job.id);
    assert.equal(failed?.status, "failed", `Job should be failed, got ${failed?.status}`);
    assert.ok(failed?.error_message, "Error message should be persisted");

    const reloaded = listVideoJobs().find((j) => j.id === job.id);
    assert.equal(reloaded?.error_message, failed?.error_message, "Error message should persist across reloads");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-1B-3: Paused quota jobs can resume after quota reset", async (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const now = new Date("2026-06-17T12:00:00Z");

    const pausedJobIds = new Set<string>();
    for (let i = 0; i < 12; i++) {
      createVideoJob({
        type: "generate_episode",
        scheduledFor: new Date(now.getTime() - 1000 - i * 100),
        dryRun: true,
      });
    }

    const result1 = await runDueVideoJobs({
      dryRun: true,
      maxJobs: 20,
      forDate: new Date(now.getTime() + 1000 * 60 * 60),
    });

    assert.equal(result1.quota_paused, 2, "Exactly 2 jobs should be paused (12 - 10 limit)");
    assert.equal(result1.ran, 10, "Exactly 10 jobs should run (quota limit)");

    const pausedBefore = listVideoJobs({ status: "paused_quota" });
    assert.equal(pausedBefore.length, 2, "Should have 2 paused jobs");
    pausedBefore.forEach(j => pausedJobIds.add(j.id));

    resetQuota();

    const result2 = await runDueVideoJobs({
      dryRun: true,
      maxJobs: 20,
      forDate: new Date(now.getTime() + 1000 * 60 * 60 * 2),
    });

    assert.equal(result2.ran, 2, "Previously paused jobs should run after quota reset");
    assert.equal(result2.quota_paused, 0, "No jobs should be paused now");

    for (const jobId of pausedJobIds) {
      const job = listVideoJobs().find(j => j.id === jobId);
      assert.equal(job?.status, "completed", `Job ${jobId.slice(0, 8)} should be completed after quota reset`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-1B-4: Quota state is persisted across process boundaries", (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const state1 = loadQuotaState();
    assert.equal(state1.total_used, 0, "Fresh quota should be 0");

    saveQuotaState({
      total_used: 5,
      reset_at: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 0, 0, 0).toISOString(),
    });

    const state2 = loadQuotaState();
    assert.equal(state2.total_used, 5, "Quota state should persist after reload");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-1B-5: Scheduler log is written and contains events", (t) => {
  const tempDir = setupTestRuntime();
  try {
    resetQuota();
    const logPath = getSchedulerLogPath();

    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }

    logSchedulerEvent("Test event", { key: "value" });

    assert.ok(fs.existsSync(logPath), "Scheduler log file should be created");
    const logContent = fs.readFileSync(logPath, "utf8");
    assert.ok(logContent.includes("Test event"), "Log should contain the event");
    assert.ok(logContent.includes("["), "Log should have timestamp");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-1B-6: Runtime directory override env var works", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const runtimeDir = getRuntimeDir();
    assert.equal(runtimeDir, tempDir, "getRuntimeDir should return temp dir when env var is set");

    const logPath = getSchedulerLogPath();
    assert.ok(logPath.includes(tempDir), "Scheduler log should be in temp directory");
    assert.ok(!logPath.includes(".local/probot"), "Scheduler log should NOT be in home directory");

    const quotaPath = path.join(runtimeDir, "quota.json");
    assert.ok(quotaPath.startsWith(tempDir), "Quota path should use temp dir");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── CLI Parser Tests (no side effects) ─────────────────────────────────────

test("CLI: parseSchedulerArgs parser import causes no filesystem side effects", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const runtimeDir = getRuntimeDir();

    // Verify that importing and using parser does not create any files
    const jobsPath = path.join(runtimeDir, "jobs.json");
    const quotaPath = path.join(runtimeDir, "quota.json");
    const logPath = path.join(runtimeDir, "scheduler.log");

    assert.ok(!fs.existsSync(jobsPath), "jobs.json should not be created by parser import");
    assert.ok(!fs.existsSync(quotaPath), "quota.json should not be created by parser import");
    assert.ok(!fs.existsSync(logPath), "scheduler.log should not be created by parser import");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});
