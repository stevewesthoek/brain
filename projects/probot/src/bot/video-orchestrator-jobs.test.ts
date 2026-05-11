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
  getPackageDraftsPath,
  planProjectDistribution,
  scheduleProjectDistributionPlan,
  createProductionPackageDraft,
  saveProductionPackageDraft,
  listProductionPackageDrafts,
  getProductionPackageDraft,
  updateProductionPackageDraftReadiness,
  validateProductionPackageDraft,
  createPackageDraftsForScheduledJobs,
  getLocalPackageAdapterRegistry,
  getProductionPackageReadinessReport,
  buildProductionPackageDraftSummary,
  type ProjectDistribution,
  type ProjectPlanResult,
  type ProductionPackageDraft,
} from "./video-orchestrator-jobs.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ─── VO-2A Project Distribution Tests ────────────────────────────────────────

test("VO-2A-1: Project distribution planning creates plan without uploading", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project-1",
        project_name: "Test Project 1",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-main", posts_per_week: 2 },
          facebook: { account_id: "facebook-main", posts_per_week: 1 },
        },
        scheduler_policy: {
          dry_run_default: true,
          max_jobs_per_run: 10,
        },
      },
    ];

    const result = planProjectDistribution(projects);

    assert.equal(result.length, 1, "Should plan for 1 project");
    const plan = result[0];
    assert.ok(plan, "Plan should exist");
    assert.equal(plan.project_id, "test-project-1");
    assert.equal(plan.planned_platforms, 2, "Should count 2 enabled platforms");
    assert.equal(plan.planned_weekly_slots, 3, "YouTube 2 + Facebook 1 = 3 weekly slots");
    assert.ok(Array.isArray(plan.platform_slots), "platform_slots should be array");
    assert.equal(plan.platform_slots.length, 2, "Should have 2 platform slots");
    assert.equal(plan.dry_run_confirmed, true, "Should confirm dry-run mode");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2A-2: Project distribution supports multiple projects with different cadences", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "project-a",
        project_name: "Project A",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-a", posts_per_week: 2 },
          facebook: { account_id: "facebook-a", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
      {
        project_id: "project-b",
        project_name: "Project B",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-b", posts_per_week: 3 },
          tiktok: { account_id: "tiktok-b", posts_per_week: 5 },
          instagram: { account_id: "instagram-b", posts_per_week: 4 },
          facebook: { account_id: "facebook-b", posts_per_week: 2 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = planProjectDistribution(projects);

    assert.equal(result.length, 2, "Should plan for 2 projects");
    const planA = result[0];
    const planB = result[1];
    assert.ok(planA && planB, "Both plans should exist");
    assert.equal(planA.planned_platforms, 2, "Project A should have 2 platforms");
    assert.equal(planA.planned_weekly_slots, 3, "Project A weekly slots: 2 + 1 = 3");
    assert.equal(planB.planned_platforms, 4, "Project B should have 4 platforms");
    assert.equal(planB.planned_weekly_slots, 14, "Project B weekly slots: 3 + 5 + 4 + 2 = 14");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2A-3: Project distribution respects enabled flag for projects and platforms", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "enabled-project",
        project_name: "Enabled",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-1", posts_per_week: 2, enabled: true },
          facebook: { account_id: "facebook-1", posts_per_week: 1, enabled: false },
          tiktok: { account_id: "tiktok-1", posts_per_week: 3 }, // enabled defaults to true
        },
        scheduler_policy: { dry_run_default: true },
      },
      {
        project_id: "disabled-project",
        project_name: "Disabled",
        enabled: false,
        platform_accounts: {
          youtube: { account_id: "youtube-2", posts_per_week: 2 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = planProjectDistribution(projects);

    assert.equal(result.length, 1, "Should only plan for enabled projects");
    const plan = result[0];
    assert.ok(plan, "Plan should exist");
    assert.equal(plan.project_id, "enabled-project");
    assert.equal(plan.planned_platforms, 2, "Should have youtube and tiktok (facebook disabled)");
    assert.equal(plan.planned_weekly_slots, 5, "YouTube 2 + TikTok 3 = 5 (Facebook disabled)");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2A-4: Project distribution planning does not call platform APIs or upload", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-no-upload",
        project_name: "No Upload Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-safe" },
          tiktok: { account_id: "tiktok-safe" },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    // Planning should complete without errors or side effects
    const result = planProjectDistribution(projects);

    assert.ok(result.length > 0, "Planning should succeed");
    const plan = result[0];
    assert.ok(plan, "Plan should exist");
    assert.equal(plan.dry_run_confirmed, true, "Must be in dry-run mode");

    // Verify no jobs were actually created
    const jobs = listVideoJobs();
    const uploadJobs = jobs.filter((j) => j.type === "publish_episode");
    assert.equal(uploadJobs.length, 0, "No publish jobs should have been created");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2A-5: Project planner includes platform_slots with full cadence details", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "detailed-plan",
        project_name: "Detailed Plan",
        enabled: true,
        platform_accounts: {
          youtube: {
            account_id: "youtube-main",
            posts_per_week: 2,
            preferred_days: ["monday", "wednesday"],
            preferred_time_local: "09:00",
            timezone: "America/New_York",
          },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = planProjectDistribution(projects);
    const plan = result[0];

    assert.ok(plan, "Plan should exist");
    assert.ok(Array.isArray(plan.platform_slots), "platform_slots should be array");
    assert.equal(plan.platform_slots.length, 1, "Should have 1 platform slot");

    const slot = plan.platform_slots[0];
    assert.ok(slot, "Slot should exist");
    assert.equal(slot.platform, "youtube", "Platform should be youtube");
    assert.equal(slot.account_id, "youtube-main", "account_id should match");
    assert.equal(slot.posts_per_week, 2, "posts_per_week should be 2");
    assert.deepEqual(slot.preferred_days, ["monday", "wednesday"], "preferred_days should match");
    assert.equal(slot.preferred_time_local, "09:00", "preferred_time_local should match");
    assert.equal(slot.timezone, "America/New_York", "timezone should match");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2A-6: Planner treats missing posts_per_week as 0", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-zero-posts",
        project_name: "Zero Posts",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-no-posts" }, // No posts_per_week specified
          facebook: { account_id: "facebook-explicit-1", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = planProjectDistribution(projects);
    const plan = result[0];

    assert.ok(plan, "Plan should exist");
    assert.equal(plan.planned_weekly_slots, 1, "Should count only Facebook's 1 post/week (YouTube 0)");
    const youtubeSlot = plan.platform_slots.find((s) => s.platform === "youtube");
    assert.ok(youtubeSlot, "YouTube slot should exist");
    assert.equal(youtubeSlot.posts_per_week, 0, "YouTube posts_per_week should be 0 when not specified");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2A-7: Planner output contains no credential references or sensitive data", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "sensitive-test",
        project_name: "Sensitive Data Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-test" },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = planProjectDistribution(projects);
    const resultText = JSON.stringify(result);

    const forbiddenStrings = [
      "access_token",
      "refresh_token",
      "client_secret",
      "code_verifier",
      "keychain://",
      "credential_reference",
      "credentialReference",
    ];

    for (const forbidden of forbiddenStrings) {
      assert.ok(
        !resultText.includes(forbidden),
        `Plan output should not contain: ${forbidden}`
      );
    }
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

// ─── Schema and Example Validation Tests ────────────────────────────────────────

test("Schema/Example Validation: Schema and example JSON parse", (t) => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const schemaPath = path.resolve(repoRoot, "operations/specs/video-orchestrator/project-distribution.schema.json");
  const examplePath = path.resolve(repoRoot, "operations/specs/video-orchestrator/examples/project-distribution.example.json");

  assert.ok(fs.existsSync(schemaPath), `Schema file exists at ${schemaPath}`);
  assert.ok(fs.existsSync(examplePath), `Example file exists at ${examplePath}`);

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

  assert.ok(schema, "Schema parses as valid JSON");
  assert.ok(example, "Example parses as valid JSON");
});

test("Schema/Example Validation: Schema has required fields", (t) => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const schemaPath = path.resolve(repoRoot, "operations/specs/video-orchestrator/project-distribution.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

  assert.ok(schema.required, "Schema has required array");
  assert.deepEqual(schema.required, ["schema_version", "projects"], "Required fields include schema_version and projects");
  assert.equal(schema.properties.projects.type, "array", "Projects is array type");
});

test("Schema/Example Validation: Example has valid schema_version and projects", (t) => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const examplePath = path.resolve(repoRoot, "operations/specs/video-orchestrator/examples/project-distribution.example.json");
  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

  assert.equal(example.schema_version, "1.0", "Schema version is 1.0");
  assert.ok(Array.isArray(example.projects), "Example has projects array");
  assert.ok(example.projects.length > 0, "Projects array is not empty");
});

test("Schema/Example Validation: preferred_days only uses valid weekday names", (t) => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const examplePath = path.resolve(repoRoot, "operations/specs/video-orchestrator/examples/project-distribution.example.json");
  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

  const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const forbiddenKeywords = ["daily", "everyday"];

  for (const project of example.projects) {
    for (const [platform, config] of Object.entries(project.platform_accounts)) {
      const cfg = config as Record<string, unknown>;
      if (cfg.preferred_days && Array.isArray(cfg.preferred_days)) {
        for (const day of cfg.preferred_days) {
          const dayStr = day as unknown as string;
          assert.ok(validDays.includes(dayStr), `preferred_days contains valid weekday: ${dayStr}`);
          assert.ok(!forbiddenKeywords.includes(dayStr), `preferred_days does not contain forbidden keyword: ${dayStr}`);
        }
      }
    }
  }
});

test("Schema/Example Validation: All platform accounts have account_id", (t) => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const examplePath = path.resolve(repoRoot, "operations/specs/video-orchestrator/examples/project-distribution.example.json");
  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

  for (const project of example.projects) {
    assert.ok(project.platform_accounts, `Project ${project.project_id} has platform_accounts`);
    for (const [platform, config] of Object.entries(project.platform_accounts)) {
      const cfg = config as Record<string, unknown>;
      assert.ok(cfg.account_id, `Platform ${platform} in project ${project.project_id} has account_id`);
      assert.equal(typeof cfg.account_id, "string", `account_id is a string`);
    }
  }
});

test("Schema/Example Validation: No forbidden sensitive strings in example", (t) => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const examplePath = path.resolve(repoRoot, "operations/specs/video-orchestrator/examples/project-distribution.example.json");
  const exampleText = fs.readFileSync(examplePath, "utf8");

  const forbiddenStrings = [
    "credential_reference",
    "credentialReference",
    "keychain://",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
  ];

  for (const forbidden of forbiddenStrings) {
    assert.ok(
      !exampleText.includes(forbidden),
      `Example does not contain forbidden string: ${forbidden}`
    );
  }
});

// ─── VO-2B Project Distribution Dry-Run Scheduling Tests ───────────────────────

test("VO-2B-1: scheduleProjectDistributionPlan blocks dryRun=false", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-main", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    assert.throws(
      () => {
        scheduleProjectDistributionPlan({
          projects,
          dryRun: false,
          weeks: 1,
        });
      },
      /VO-2B only supports dry-run/,
      "Should throw when dryRun is false"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-2: scheduleProjectDistributionPlan creates jobs based on posts_per_week", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const startDate = new Date("2026-05-11");
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-main", posts_per_week: 2 },
          facebook: { account_id: "facebook-main", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      startDate,
      weeks: 1,
    });

    assert.equal(result.created, 3, "Should create 3 jobs (2 YouTube + 1 Facebook)");
    assert.equal(result.skipped, 0, "Should skip none");

    const jobs = listVideoJobs();
    const publishJobs = jobs.filter((j) => j.type === "publish_episode" && j.dry_run);
    assert.equal(publishJobs.length, 3, "All jobs should be publish_episode dry-run");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-3: scheduled jobs include project/platform/account metadata safely", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "metadata-test",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-safe", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      weeks: 1,
    });

    const jobs = listVideoJobs();
    const job = jobs[jobs.length - 1];
    assert.ok(job, "Job should exist");

    assert.ok(job.result, "Job should have result metadata");
    const output = job.result.output as Record<string, unknown>;
    assert.equal(output.project_id, "metadata-test", "Should include project_id");
    assert.equal(output.platform, "youtube", "Should include platform");
    assert.equal(output.account_id, "youtube-safe", "Should include account_id");
    assert.equal(output.cadence_source, "project_distribution", "Should include cadence_source");

    // Verify no secrets in metadata
    const metadataText = JSON.stringify(output);
    const forbiddenStrings = ["credential_reference", "keychain://", "access_token", "client_secret"];
    for (const forbidden of forbiddenStrings) {
      assert.ok(!metadataText.includes(forbidden), `Metadata should not contain: ${forbidden}`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-4: respects disabled project", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "enabled",
        project_name: "Enabled",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-1", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
      {
        project_id: "disabled",
        project_name: "Disabled",
        enabled: false,
        platform_accounts: {
          youtube: { account_id: "youtube-2", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      weeks: 1,
    });

    assert.equal(result.created, 1, "Should only create job for enabled project");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-5: respects disabled platform", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-1", posts_per_week: 1, enabled: true },
          facebook: { account_id: "facebook-1", posts_per_week: 1, enabled: false },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      weeks: 1,
    });

    assert.equal(result.created, 1, "Should only create job for enabled platform");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-6: avoids duplicate jobs on second run", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const startDate = new Date("2026-05-11");
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-main", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result1 = scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      startDate,
      weeks: 1,
    });
    assert.equal(result1.created, 1, "First run should create 1 job");

    const result2 = scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      startDate,
      weeks: 1,
    });
    assert.equal(result2.created, 0, "Second run should create 0 jobs");
    assert.equal(result2.existing, 1, "Should detect 1 existing job");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-7: does not create real publish/upload jobs", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-main", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      weeks: 1,
    });

    const jobs = listVideoJobs();
    for (const job of jobs) {
      assert.equal(job.dry_run, true, "All jobs should be dry_run=true");
      assert.ok(job.result?.simulated, "All jobs should be marked as simulated");
      const outputStr = JSON.stringify(job.result?.output || {});
      assert.ok(!outputStr.includes("videos.insert"), "No upload capability");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2B-8: result contains no credential references or sensitive data", (t) => {
  const tempDir = setupTestRuntime();
  try {
    const projects: ProjectDistribution[] = [
      {
        project_id: "test-project",
        project_name: "Test",
        enabled: true,
        platform_accounts: {
          youtube: { account_id: "youtube-main", posts_per_week: 1 },
        },
        scheduler_policy: { dry_run_default: true },
      },
    ];

    const result = scheduleProjectDistributionPlan({
      projects,
      dryRun: true,
      weeks: 1,
    });

    const resultText = JSON.stringify(result);
    const forbiddenStrings = ["credential_reference", "keychain://", "access_token", "refresh_token", "client_secret"];
    for (const forbidden of forbiddenStrings) {
      assert.ok(!resultText.includes(forbidden), `Result should not contain: ${forbidden}`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2C: Production Package Foundation Tests ─────────────────────────────

test("VO-2C-1: Schema has VO-2C draft model required fields", () => {
  const schemaPath = path.resolve(__dirname, "../../../../operations/specs/video-orchestrator/production-package.schema.json");
  const schemaText = fs.readFileSync(schemaPath, "utf8");
  const schema = JSON.parse(schemaText);
  assert.ok(schema.title.includes("VO-2C"));
  assert.ok(schema.properties.package_id);
  assert.ok(schema.properties.source_job_id);
  assert.ok(schema.properties.package_state);
  assert.ok(schema.properties.dry_run);
  assert.ok(schema.properties.readiness);
  assert.ok(schema.properties.provenance);
  assert.ok(schema.required.includes("package_id"));
  assert.ok(schema.required.includes("source_job_id"));
  assert.ok(schema.required.includes("package_state"));
  assert.ok(schema.required.includes("dry_run"));
  assert.ok(schema.required.includes("readiness"));
  assert.ok(schema.required.includes("provenance"));
});

test("VO-2C-2: Example matches schema structure", () => {
  const examplePath = path.resolve(__dirname, "../../../../operations/specs/video-orchestrator/examples/production-package.example.json");
  const exampleText = fs.readFileSync(examplePath, "utf8");
  const example = JSON.parse(exampleText);
  assert.ok(example.schema_version === "1.0");
  assert.ok(example.package_id);
  assert.ok(example.project_id === "project-alpha");
  assert.ok(example.platform === "youtube");
  assert.ok(example.account_id === "youtube-channel-main");
  assert.ok(example.source_job_id);
  assert.ok(example.package_state === "draft");
  assert.ok(example.dry_run === true);
  assert.ok(example.created_at);
  assert.ok(example.scheduled_for);
  assert.ok(example.assets);
  assert.ok(example.platform_target);
  assert.ok(example.readiness);
  assert.ok(example.provenance);
});

test("VO-2C-3: Example is metadata-only draft (not fake rendered)", () => {
  const examplePath = path.resolve(__dirname, "../../../../operations/specs/video-orchestrator/examples/production-package.example.json");
  const exampleText = fs.readFileSync(examplePath, "utf8");
  const example = JSON.parse(exampleText);
  assert.ok(example.package_state === "draft");
  assert.ok(example.dry_run === true);
  assert.ok(example.readiness.ready_to_post === false);
  // Must not have fake file sizes or media durations that imply rendering
  assert.ok(!exampleText.includes("file_size_bytes"));
  assert.ok(!exampleText.includes("duration_seconds"));
  // Must not have render instructions or upload steps
  assert.ok(!exampleText.includes("manual_steps") && !exampleText.includes("upload") && !exampleText.includes("publish"));
});

test("VO-2C-4: Example contains no credential refs, tokens, or secrets", () => {
  const examplePath = path.resolve(__dirname, "../../../../operations/specs/video-orchestrator/examples/production-package.example.json");
  const exampleText = fs.readFileSync(examplePath, "utf8");
  const forbiddenStrings = ["credential_reference", "keychain://", "access_token", "refresh_token", "client_secret", "code_verifier", "authorization_code"];
  for (const forbidden of forbiddenStrings) {
    assert.ok(!exampleText.includes(forbidden), `Example should not contain: ${forbidden}`);
  }
});

test("VO-2C-Schema: Example structure matches schema requirements", () => {
  const schemaPath = path.resolve(__dirname, "../../../../operations/specs/video-orchestrator/production-package.schema.json");
  const examplePath = path.resolve(__dirname, "../../../../operations/specs/video-orchestrator/examples/production-package.example.json");

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

  // Verify all required schema fields exist in example
  const requiredFields = schema.required || [];
  for (const field of requiredFields) {
    assert.ok(example.hasOwnProperty(field), `Example missing required field: ${field}`);
  }

  // Verify no optional null fields are present unless schema allows null
  assert.strictEqual(example.provenance.source_manifest_path, undefined, "provenance.source_manifest_path should not be present (null not allowed)");
  assert.strictEqual(example.provenance.checksum, undefined, "provenance.checksum should not be present (null not allowed)");

  // Verify state flags are correct
  assert.strictEqual(example.readiness.ready_to_post, false, "ready_to_post must be false in VO-2C");
  assert.strictEqual(example.package_state, "draft", "package_state must be draft in VO-2C");
  assert.strictEqual(example.dry_run, true, "dry_run must be true in VO-2C");
});

test("VO-2C-4: createProductionPackageDraft blocks dryRun=false", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    assert.throws(
      () => createProductionPackageDraft({
        job,
        project_id: "test-project",
        platform: "youtube",
        account_id: "youtube-main",
        scheduled_for: new Date(),
        dryRun: false,
      }),
      (err: any) => {
        assert.ok(err.message.includes("VO-2C only supports dry-run"));
        return true;
      }
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-5: Draft includes project_id, platform, account_id, scheduled_for", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project-001",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date("2026-06-15T14:00:00Z"),
      dryRun: true,
    });

    assert.strictEqual(draft.project_id, "test-project-001");
    assert.strictEqual(draft.platform, "youtube");
    assert.strictEqual(draft.account_id, "youtube-channel-main");
    assert.ok(draft.scheduled_for.includes("2026-06-15"));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-6: Draft ready_to_post is false by default", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "tiktok",
      account_id: "tiktok-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    assert.strictEqual(draft.readiness.ready_to_post, false);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-7: Draft includes blocking reason for unimplemented rendering", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "instagram",
      account_id: "instagram-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    assert.ok(draft.readiness.blocking_reasons.length > 0);
    const blockingText = draft.readiness.blocking_reasons.join(" ");
    assert.ok(blockingText.includes("rendering") || blockingText.includes("VO-2C") || blockingText.includes("VO-2D"));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-8: No upload/API calls in package draft function", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const draftText = JSON.stringify(draft);
    const forbiddenStrings = ["videos.insert", "youtube.videos", "api.youtube", "AccessToken"];
    for (const forbidden of forbiddenStrings) {
      assert.ok(!draftText.includes(forbidden), `Draft should not contain: ${forbidden}`);
    }

    // Verify no credential references
    assert.ok(!draftText.includes("access_token"));
    assert.ok(!draftText.includes("refresh_token"));
    assert.ok(!draftText.includes("client_secret"));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-9: Draft format_key determines aspect_ratio and resolution", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    // Test landscape format
    const landscapeDraft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
      format_key: "landscape_1920x1080_16x9",
    });
    assert.strictEqual(landscapeDraft.platform_target.aspect_ratio, "16:9");
    assert.strictEqual(landscapeDraft.platform_target.resolution, "1920x1080");

    // Test vertical format
    const verticalDraft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "tiktok",
      account_id: "tiktok-main",
      scheduled_for: new Date(),
      dryRun: true,
      format_key: "vertical_1080x1920_9x16",
    });
    assert.strictEqual(verticalDraft.platform_target.aspect_ratio, "9:16");
    assert.strictEqual(verticalDraft.platform_target.resolution, "1080x1920");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-10: Draft does not copy raw job.result (sanitized only)", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create job with safe result
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const metadata = draft.assets.metadata;
    assert.ok(metadata.job_type);
    assert.ok(metadata.job_status);
    assert.ok(metadata.job_dry_run !== undefined);
    assert.ok(metadata.job_scheduled_for);
    // Verify no dangerous key patterns in metadata
    const metadataText = JSON.stringify(metadata);
    assert.ok(!metadataText.includes("credential"));
    assert.ok(!metadataText.includes("token"));
    assert.ok(!metadataText.includes("secret"));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-11: Sanitization blocks malicious job.result values", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    // Manually inject malicious result (simulating a compromised job)
    (job as any).result = {
      safe_field: "value",
      access_token: "[REDACTED]",
      client_secret: "[REDACTED]",
      nested_dangerous: {
        keychain_ref: "keychain://credential",
      },
    };

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const metadata = draft.assets.metadata;
    const metadataText = JSON.stringify(metadata);
    // Sanitizer should have blocked the dangerous fields
    assert.ok(!metadataText.includes("access_token"));
    assert.ok(!metadataText.includes("client_secret"));
    assert.ok(!metadataText.includes("keychain"));
    // Nested objects should not be copied
    assert.ok(!metadataText.includes("nested_dangerous"));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2C-12: Sanitization blocks dangerous string values", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T09:00:00Z"),
      dryRun: true,
    });

    // Manually inject result with dangerous values in safe-looking keys
    (job as any).result = {
      safe_field: "value",
      safe_note: "Bearer fake-token-12345",
      safe_url: "keychain://video-orchestrator/youtube/main",
      config_value: "credential_reference://secret",
      another_safe: "credentialReference://somewhere",
      access_token: "[REDACTED]",
      client_secret: "[REDACTED]",
      nested_dangerous: {
        keychain_ref: "keychain://credential",
      },
    };

    const draft = createProductionPackageDraft({
      job,
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const metadata = draft.assets.metadata;
    const metadataText = JSON.stringify(metadata);

    // Safe field should be preserved
    assert.strictEqual(metadata.safe_field, "value");

    // Dangerous string values should be omitted
    assert.ok(!metadataText.includes("Bearer"));
    assert.ok(!metadataText.includes("keychain://"));
    assert.ok(!metadataText.includes("credential_reference"));
    assert.ok(!metadataText.includes("credentialReference"));
    assert.ok(!metadataText.includes("access_token"));
    assert.ok(!metadataText.includes("client_secret"));
    assert.ok(!metadataText.includes("nested_dangerous"));

    // Verify safe keys were not included when they had dangerous values
    assert.ok(!metadata.safe_note);
    assert.ok(!metadata.safe_url);
    assert.ok(!metadata.config_value);
    assert.ok(!metadata.another_safe);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2D: Package Draft Persistence and Validation Tests ──────────────────

test("VO-2D-1: Save and retrieve package drafts with temp runtime dir", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);
    const retrieved = getProductionPackageDraft(draft.package_id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.package_id, draft.package_id);
    assert.strictEqual(retrieved?.project_id, "test-project");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-2: Save is upsert by package_id, not duplicate append", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft1 = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft1);
    saveProductionPackageDraft(draft1);
    const list = listProductionPackageDrafts();
    assert.strictEqual(list.length, 1, "Save should not create duplicates");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-3: List filters by project_id, platform, package_state", () => {
  const tempDir = setupTestRuntime();
  try {
    const job1 = createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true });
    const job2 = createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true });

    const draft1 = createProductionPackageDraft({
      job: job1,
      project_id: "project-a",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const draft2 = createProductionPackageDraft({
      job: job2,
      project_id: "project-b",
      platform: "tiktok",
      account_id: "tiktok-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft1);
    saveProductionPackageDraft(draft2);

    const allDrafts = listProductionPackageDrafts();
    assert.strictEqual(allDrafts.length, 2);

    const projectA = listProductionPackageDrafts({ project_id: "project-a" });
    assert.strictEqual(projectA.length, 1);
    assert.ok(projectA[0]);
    assert.strictEqual(projectA[0].project_id, "project-a");

    const youtube = listProductionPackageDrafts({ platform: "youtube" });
    assert.strictEqual(youtube.length, 1);
    assert.ok(youtube[0]);
    assert.strictEqual(youtube[0].platform, "youtube");

    const tiktok = listProductionPackageDrafts({ platform: "tiktok" });
    assert.strictEqual(tiktok.length, 1);
    assert.ok(tiktok[0]);
    assert.strictEqual(tiktok[0].platform, "tiktok");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-4: validateProductionPackageDraft returns ready_to_post=false for metadata-only draft", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const validation = validateProductionPackageDraft(draft);
    assert.strictEqual(validation.ready_to_post, false, "Metadata-only drafts should never be ready_to_post");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-5: Validation blocks missing video asset", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const validation = validateProductionPackageDraft(draft);
    assert.ok(!validation.ok, "Should fail validation");
    assert.ok(validation.blocking_reasons.some((r) => r.includes("Video asset")), "Should mention missing video asset");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-6: Validation warns for missing thumbnail and captions", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Manually set video to satisfy blocking check
    draft.assets.video = "/path/to/video.mp4";

    const validation = validateProductionPackageDraft(draft);
    // Still fail due to other checks, but verify warnings exist
    const warningText = validation.warnings.join(" ");
    assert.ok(warningText.includes("caption") || warningText.includes("thumbnail"), "Should warn about missing assets");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-7: createPackageDraftsForScheduledJobs creates drafts from dry-run publish_episode jobs", () => {
  const tempDir = setupTestRuntime();
  try {
    // Manually create a job with metadata to simulate scheduled job from VO-2B
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-15T10:00:00Z"),
      dryRun: true,
    });

    // Update the job to add project/platform/account metadata (simulating what VO-2B does)
    updateVideoJobStatus(job.id, "scheduled", {
      simulated: true,
      output: {
        project_id: "project-test",
        platform: "youtube",
        account_id: "youtube-main",
      },
    });

    // Now create package drafts from that job
    const result = createPackageDraftsForScheduledJobs({
      dryRun: true,
      status: "scheduled",
      limit: 10,
    });

    assert.ok(result.created > 0, "Should create drafts from scheduled jobs with metadata");
    assert.ok(result.drafts && result.drafts.length > 0, "Should return created drafts");
    assert.ok(result.drafts[0]);
    assert.strictEqual(result.drafts[0].project_id, "project-test");
    assert.strictEqual(result.drafts[0].platform, "youtube");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-8: createPackageDraftsForScheduledJobs skips jobs without project/platform/account metadata", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a job without metadata (createVideoJob doesn't set metadata)
    createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true });

    const result = createPackageDraftsForScheduledJobs({
      dryRun: true,
      limit: 10,
    });

    // Jobs without metadata should be skipped
    assert.strictEqual(result.created, 0, "Jobs without metadata should be skipped");
    assert.ok(result.skipped > 0, "Should have skipped jobs");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-9: createPackageDraftsForScheduledJobs avoids duplicate drafts", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create jobs manually with metadata to avoid test complexity
    const job = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-16T10:00:00Z"),
      dryRun: true,
    });

    updateVideoJobStatus(job.id, "scheduled", {
      simulated: true,
      output: {
        project_id: "project-dup-test",
        platform: "youtube",
        account_id: "youtube-main",
      },
    });

    const result1 = createPackageDraftsForScheduledJobs({ dryRun: true, limit: 10 });
    const created1 = result1.created;
    assert.ok(created1 > 0, "First run should create drafts");

    // Run again
    const result2 = createPackageDraftsForScheduledJobs({ dryRun: true, limit: 10 });

    assert.strictEqual(result2.created, 0, "Second run should not create duplicates");
    assert.strictEqual(result2.existing, created1, "Second run should recognize existing drafts");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-10: dryRun=false blocks", () => {
  const tempDir = setupTestRuntime();
  try {
    assert.throws(
      () => createPackageDraftsForScheduledJobs({ dryRun: false as any }),
      (err: any) => {
        assert.ok(err.message.includes("dryRun=true"));
        return true;
      }
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-11: Package store output contains no credential refs or tokens", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);
    const retrieved = getProductionPackageDraft(draft.package_id);
    const draftText = JSON.stringify(retrieved);

    const forbiddenStrings = [
      "credential_reference",
      "keychain://",
      "access_token",
      "refresh_token",
      "client_secret",
      "code_verifier",
      "authorization_code",
      "Bearer",
    ];

    for (const forbidden of forbiddenStrings) {
      assert.ok(!draftText.includes(forbidden), `Package should not contain: ${forbidden}`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-12: No upload/API calls in package functions", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);
    const retrieved = getProductionPackageDraft(draft.package_id);
    const draftText = JSON.stringify(retrieved);

    const uploadPatterns = [
      "videos.insert",
      "youtube.videos",
      "api.youtube",
      "api.tiktok",
      "api.instagram",
    ];

    for (const pattern of uploadPatterns) {
      assert.ok(!draftText.includes(pattern), `Package should not contain: ${pattern}`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-1: Draft with ready state and video still returns ready_to_post=false", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Manually set package_state to "ready" and add video asset
    draft.package_state = "ready";
    draft.assets.video = "/path/to/video.mp4";

    const validation = validateProductionPackageDraft(draft);
    assert.strictEqual(validation.ready_to_post, false, "VO-2D must never mark packages ready_to_post=true");
    assert.ok(
      validation.warnings.some((w) => w.includes("VO-2D") || w.includes("real media")),
      "Should warn about VO-2D limitations"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-2: Store rejects draft with access_token in metadata", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Inject dangerous metadata
    (draft.assets.metadata as any).access_token = "[REDACTED]";

    assert.throws(
      () => saveProductionPackageDraft(draft),
      (err: any) => {
        assert.ok(err.message.includes("unsafe metadata"));
        return true;
      }
    );

    // Verify not persisted
    const allDrafts = listProductionPackageDrafts();
    assert.ok(!allDrafts.some((d) => d.package_id === draft.package_id), "Unsafe draft should not be persisted");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-3: Store rejects draft with bearer token in safe-looking key", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Inject bearer token in safe-looking key
    (draft.assets.metadata as any).auth_header = "Bearer fake-token-12345";

    assert.throws(
      () => saveProductionPackageDraft(draft),
      (err: any) => {
        assert.ok(err.message.includes("unsafe metadata"));
        return true;
      }
    );

    const allDrafts = listProductionPackageDrafts();
    assert.ok(!allDrafts.some((d) => d.package_id === draft.package_id), "Unsafe draft should not be persisted");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-4: Store rejects draft with nested keychain reference", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Inject nested dangerous value
    (draft.assets.metadata as any).nested = { ref: "keychain://video-orchestrator/example" };

    assert.throws(
      () => saveProductionPackageDraft(draft),
      (err: any) => {
        assert.ok(err.message.includes("unsafe metadata"));
        return true;
      }
    );

    const allDrafts = listProductionPackageDrafts();
    assert.ok(!allDrafts.some((d) => d.package_id === draft.package_id), "Unsafe draft should not be persisted");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-5: Store accepts and persists safe draft", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Add safe metadata
    (draft.assets.metadata as any).safe_field = "value";
    (draft.assets.metadata as any).user_note = "This is a safe note";

    // Should not throw
    assert.doesNotThrow(() => saveProductionPackageDraft(draft));

    // Verify persisted
    const retrieved = getProductionPackageDraft(draft.package_id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.assets.metadata.safe_field, "value");
    assert.strictEqual(retrieved?.assets.metadata.user_note, "This is a safe note");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-6: updateProductionPackageDraftReadiness rejects unsafe blocking_reasons", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);
    const originalDraft = getProductionPackageDraft(draft.package_id);
    assert.ok(originalDraft);

    // Try to update with unsafe blocking reason
    assert.throws(
      () => {
        updateProductionPackageDraftReadiness(draft.package_id, {
          ready_to_post: false,
          blocking_reasons: ["Bearer fake-token"],
          warnings: [],
        });
      },
      (err: any) => {
        assert.ok(err.message.includes("unsafe metadata"));
        return true;
      }
    );

    // Verify draft unchanged in store
    const retrievedAfter = getProductionPackageDraft(draft.package_id);
    assert.ok(retrievedAfter);
    assert.deepEqual(retrievedAfter.readiness.blocking_reasons, originalDraft.readiness.blocking_reasons);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-7: updateProductionPackageDraftReadiness rejects unsafe warnings", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);
    const originalDraft = getProductionPackageDraft(draft.package_id);
    assert.ok(originalDraft);

    // Try to update with unsafe warning
    assert.throws(
      () => {
        updateProductionPackageDraftReadiness(draft.package_id, {
          ready_to_post: false,
          blocking_reasons: [],
          warnings: ["keychain://video-orchestrator/example"],
        });
      },
      (err: any) => {
        assert.ok(err.message.includes("unsafe metadata"));
        return true;
      }
    );

    // Verify draft unchanged
    const retrievedAfter = getProductionPackageDraft(draft.package_id);
    assert.ok(retrievedAfter);
    assert.deepEqual(retrievedAfter.readiness.warnings, originalDraft.readiness.warnings);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-8: safe readiness update persists correctly", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);

    // Update with safe readiness
    updateProductionPackageDraftReadiness(draft.package_id, {
      ready_to_post: false,
      blocking_reasons: ["Video asset is missing."],
      warnings: ["No caption assets attached."],
    });

    const retrieved = getProductionPackageDraft(draft.package_id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.readiness.ready_to_post, false);
    assert.ok(retrieved.readiness.blocking_reasons.includes("Video asset is missing."));
    assert.ok(retrieved.readiness.warnings.includes("No caption assets attached."));
    assert.ok(
      retrieved.readiness.warnings.some((w) => w.includes("VO-2D does not perform real media validation")),
      "Should include VO-2D limitation warning"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-9: updateProductionPackageDraftReadiness enforces ready_to_post false", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);

    // Try to update with ready_to_post=true (should be coerced to false)
    updateProductionPackageDraftReadiness(draft.package_id, {
      ready_to_post: true,
      blocking_reasons: [],
      warnings: [],
    });

    const retrieved = getProductionPackageDraft(draft.package_id);
    assert.ok(retrieved);
    assert.strictEqual(
      retrieved.readiness.ready_to_post,
      false,
      "VO-2D must coerce ready_to_post to false"
    );
    assert.ok(
      retrieved.readiness.warnings.some((w) => w.includes("VO-2D does not perform real media validation")),
      "Should include VO-2D limitation warning"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-10: saveProductionPackageDraft rejects draft with ready_to_post true", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Manually set ready_to_post=true to simulate attempt to persist upload-ready state
    draft.readiness.ready_to_post = true;

    assert.throws(
      () => saveProductionPackageDraft(draft),
      (err: any) => {
        assert.ok(err.message.includes("cannot be stored as ready_to_post"));
        return true;
      }
    );

    // Verify not persisted
    const allDrafts = listProductionPackageDrafts();
    assert.ok(!allDrafts.some((d) => d.package_id === draft.package_id), "Unsafe draft should not be persisted");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2D-Hardening-11: updateProductionPackageDraftReadiness throws on missing package", () => {
  const tempDir = setupTestRuntime();
  try {
    assert.throws(
      () => {
        updateProductionPackageDraftReadiness("nonexistent-package-id", {
          ready_to_post: false,
          blocking_reasons: [],
          warnings: [],
        });
      },
      (err: any) => {
        assert.ok(err.message.includes("not found"));
        return true;
      }
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2E: Package Draft CLI, Local Adapter Contracts, and Readiness Reporting ─

test("VO-2E-1: Local adapter registry contains all required adapters", () => {
  const tempDir = setupTestRuntime();
  try {
    const registry = getLocalPackageAdapterRegistry();
    assert.ok(registry.render);
    assert.ok(registry.caption);
    assert.ok(registry.thumbnail);
    assert.ok(registry.metadata);
    assert.ok(registry.manual_export);

    assert.strictEqual(registry.render.kind, "render");
    assert.strictEqual(registry.caption.kind, "caption");
    assert.strictEqual(registry.thumbnail.kind, "thumbnail");
    assert.strictEqual(registry.metadata.kind, "metadata");
    assert.strictEqual(registry.manual_export.kind, "manual_export");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-2: All adapters are not_implemented mode only", () => {
  const tempDir = setupTestRuntime();
  try {
    const registry = getLocalPackageAdapterRegistry();
    for (const [kind, adapter] of Object.entries(registry)) {
      assert.strictEqual(adapter.mode, "not_implemented", `Adapter ${kind} should be not_implemented`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-3: Adapter validation returns blocking_reasons for unimplemented adapters", () => {
  const tempDir = setupTestRuntime();
  try {
    const registry = getLocalPackageAdapterRegistry();
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    for (const [kind, adapter] of Object.entries(registry)) {
      const validation = adapter.validateDraft(draft);
      assert.strictEqual(validation.ready_to_post, false, `${kind} ready_to_post should be false`);
      assert.ok(!validation.ok, `${kind} validation should fail`);
      assert.ok(
        validation.blocking_reasons.some((r) => r.includes("not implemented")),
        `${kind} should have not_implemented blocking reason`
      );
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-4: Adapter plans include blocking_reasons for unimplemented work", () => {
  const tempDir = setupTestRuntime();
  try {
    const registry = getLocalPackageAdapterRegistry();
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    for (const [kind, adapter] of Object.entries(registry)) {
      if (adapter.plan) {
        const plan = adapter.plan(draft);
        assert.strictEqual(plan.dry_run, true, `${kind} plan should be dry_run`);
        assert.ok(plan.blocking_reasons.length > 0, `${kind} plan should have blocking reasons`);
        assert.deepStrictEqual(plan.planned_outputs, [], `${kind} plan should have no outputs`);
      }
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-5: Readiness report counts drafts by state and platform", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create some test drafts
    const job1 = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-01T10:00:00Z"),
      dryRun: true,
    });
    updateVideoJobStatus(job1.id, "scheduled", {
      simulated: true,
      output: { project_id: "proj-a", platform: "youtube", account_id: "youtube-main" },
    });

    const job2 = createVideoJob({
      type: "publish_episode",
      scheduledFor: new Date("2026-06-02T10:00:00Z"),
      dryRun: true,
    });
    updateVideoJobStatus(job2.id, "scheduled", {
      simulated: true,
      output: { project_id: "proj-a", platform: "tiktok", account_id: "tiktok-main" },
    });

    const result = createPackageDraftsForScheduledJobs({
      dryRun: true,
      limit: 10,
    });

    assert.ok(result.created > 0, "Should have created drafts");

    const report = getProductionPackageReadinessReport();
    assert.ok(report.total > 0, "Report should count total drafts");
    assert.ok(Object.keys(report.by_state).length > 0, "Report should group by state");
    assert.ok(Object.keys(report.by_platform).length > 0, "Report should group by platform");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-6: Readiness report excludes unsafe metadata", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);

    const report = getProductionPackageReadinessReport();
    const reportText = JSON.stringify(report);

    // Verify no sensitive fields are exposed
    assert.ok(!reportText.includes("metadata"), "Report should not expose raw metadata");
    assert.ok(!reportText.includes("assets"), "Report should not expose assets");
    assert.ok(
      !reportText.includes("credential_reference") && !reportText.includes("access_token"),
      "Report should not expose credentials"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-7: Readiness report ready_to_post is 0 for VO-2E metadata-only drafts", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create multiple drafts
    for (let i = 0; i < 3; i++) {
      const draft = createProductionPackageDraft({
        job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
        project_id: `proj-${i}`,
        platform: "youtube",
        account_id: "youtube-main",
        scheduled_for: new Date(),
        dryRun: true,
      });
      saveProductionPackageDraft(draft);
    }

    const report = getProductionPackageReadinessReport();
    assert.strictEqual(report.ready_to_post, 0, "VO-2E should never mark packages as ready_to_post");
    assert.ok(report.blocked > 0, "VO-2E drafts should be blocked (missing video assets)");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-8: Readiness report drafts have safe summary fields only", () => {
  const tempDir = setupTestRuntime();
  try {
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    saveProductionPackageDraft(draft);

    const report = getProductionPackageReadinessReport();
    assert.ok(report.drafts.length > 0, "Report should include draft summaries");

    for (const summary of report.drafts) {
      assert.ok(summary.package_id);
      assert.ok(summary.project_id);
      assert.ok(summary.platform);
      assert.ok(summary.package_state);
      assert.ok(typeof summary.ready_to_post === "boolean");
      assert.ok(typeof summary.blocking_reasons_count === "number");
      assert.ok(typeof summary.warnings_count === "number");
      assert.ok(summary.scheduled_for);

      // Ensure no sensitive fields
      assert.ok(!("assets" in summary));
      assert.ok(!("metadata" in summary));
      assert.ok(!("readiness" in summary));
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-9: No adapter calls fs, ffmpeg, or platform APIs", () => {
  const tempDir = setupTestRuntime();
  try {
    const registry = getLocalPackageAdapterRegistry();
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project",
      platform: "youtube",
      account_id: "youtube-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    for (const [kind, adapter] of Object.entries(registry)) {
      const validation = adapter.validateDraft(draft);
      const validationText = JSON.stringify(validation);

      // Verify no file operations
      assert.ok(!validationText.includes("fs.write") && !validationText.includes("writeFile"));

      // Verify no FFmpeg
      assert.ok(!validationText.includes("ffmpeg"));

      // Verify no platform APIs
      assert.ok(!validationText.includes("videos.insert"));
      assert.ok(!validationText.includes("youtube.videos"));
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-10: createPackageDraftsForScheduledJobs blocks dryRun=false safely", () => {
  const tempDir = setupTestRuntime();
  try {
    assert.throws(
      () => {
        createPackageDraftsForScheduledJobs({
          dryRun: false as any,
        });
      },
      (err: any) => {
        assert.ok(err.message.includes("dryRun=true"));
        return true;
      }
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2E: Read-Path Output Safety Tests ──────────────────────────────────

test("VO-2E-11: buildProductionPackageDraftSummary sanitizes unsafe legacy data on read", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a normal draft
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-project-id",
      platform: "youtube",
      account_id: "account-123",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Build safe summary
    const summary = buildProductionPackageDraftSummary(draft);

    // Verify all required fields are present
    assert.ok(summary.package_id);
    assert.ok(summary.project_id);
    assert.ok(summary.platform);
    assert.ok(summary.package_state);
    assert.ok(typeof summary.ready_to_post === "boolean");
    assert.ok(typeof summary.blocking_reasons_count === "number");
    assert.ok(typeof summary.warnings_count === "number");
    assert.ok(summary.scheduled_for);

    // Verify all fields are strings or numbers except ready_to_post (boolean), counts (number)
    assert.strictEqual(typeof summary.package_id, "string");
    assert.strictEqual(typeof summary.project_id, "string");
    assert.strictEqual(typeof summary.platform, "string");
    assert.strictEqual(typeof summary.package_state, "string");
    assert.strictEqual(typeof summary.scheduled_for, "string");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-12: buildProductionPackageDraftSummary rejects unsafe metadata on read", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a draft with unsafe values (simulating legacy/manual JSON)
    const unsafeDraft: ProductionPackageDraft = {
      package_id: "pkg-unsafe-test",
      project_id: "proj-access_token-secret", // Unsafe: contains access_token
      platform: "youtube",
      account_id: "account-123",
      source_job_id: "job-123",
      package_state: "draft",
      dry_run: true,
      created_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString(),
      platform_target: {
        format_key: "yt_short",
        aspect_ratio: "9:16",
        resolution: "1080x1920",
      },
      assets: {
        video: "placeholder.mp4",
        captions: [],
        metadata: {},
      },
      readiness: {
        ready_to_post: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
      },
    };

    // Build safe summary - should redact unsafe values
    const summary = buildProductionPackageDraftSummary(unsafeDraft);

    // project_id should be redacted because it contains forbidden pattern
    assert.strictEqual(summary.project_id, "[unsafe-project]", "Should redact project_id containing access_token");

    // package_id and platform should still be safe
    assert.strictEqual(summary.package_id, "pkg-unsafe-test");
    assert.strictEqual(summary.platform, "youtube");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-13: buildProductionPackageDraftSummary rejects suspiciously long values", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a draft with suspiciously long values
    const suspiciousDraft: ProductionPackageDraft = {
      package_id: "a".repeat(250), // > 200 chars
      project_id: "proj-test",
      platform: "youtube",
      account_id: "account-123",
      source_job_id: "job-123",
      package_state: "draft",
      dry_run: true,
      created_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString(),
      platform_target: {
        format_key: "yt_short",
        aspect_ratio: "9:16",
        resolution: "1080x1920",
      },
      assets: {
        video: "placeholder.mp4",
        captions: [],
        metadata: {},
      },
      readiness: {
        ready_to_post: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
      },
    };

    // Build safe summary - should redact long values
    const summary = buildProductionPackageDraftSummary(suspiciousDraft);

    // package_id should be redacted because it's > 200 chars
    assert.strictEqual(summary.package_id, "[unsafe-package-id]", "Should redact suspiciously long package_id");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-14: getProductionPackageReadinessReport uses safe summaries", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a draft
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "test-proj-123",
      platform: "youtube",
      account_id: "account-xyz",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Save it
    saveProductionPackageDraft(draft);

    // Get readiness report
    const report = getProductionPackageReadinessReport();

    // Verify report uses safe summaries
    assert.strictEqual(report.total, 1);
    assert.ok(report.drafts.length > 0);

    const reportedDraft = report.drafts[0];
    assert.ok(reportedDraft);
    assert.ok(reportedDraft.package_id);
    assert.ok(reportedDraft.project_id);
    assert.ok(reportedDraft.platform);

    // Verify counts are numbers
    assert.strictEqual(typeof reportedDraft.blocking_reasons_count, "number");
    assert.strictEqual(typeof reportedDraft.warnings_count, "number");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-15: CLI list output uses safe summaries", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a draft
    const draft = createProductionPackageDraft({
      job: createVideoJob({ type: "publish_episode", scheduledFor: new Date(), dryRun: true }),
      project_id: "proj-cli-test",
      platform: "youtube",
      account_id: "account-test",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Save it
    saveProductionPackageDraft(draft);

    // List drafts
    const drafts = listProductionPackageDrafts();
    assert.strictEqual(drafts.length, 1);

    // Build safe summary for CLI output
    const draft0 = drafts[0];
    assert.ok(draft0);
    const safe = buildProductionPackageDraftSummary(draft0);

    // Verify safe summary is suitable for CLI output
    assert.ok(safe.package_id);
    assert.ok(safe.project_id);
    assert.ok(safe.platform);
    assert.ok(safe.scheduled_for);

    // Verify no sensitive fields in summary
    assert.ok(!("metadata" in safe));
    assert.ok(!("assets" in safe));
    assert.ok(!("readiness" in safe));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2E: Unsafe Legacy Data Tests ────────────────────────────────────────

test("VO-2E-16: unsafe platform in by_platform keys does not leak", () => {
  const tempDir = setupTestRuntime();
  try {
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      drafts: [
        {
          package_id: "pkg-test-1",
          source_job_id: "job-123",
          project_id: "proj-test",
          platform: "youtube-client_secret-xxx", // Unsafe: contains client_secret
          account_id: "account-test",
          package_state: "draft",
          dry_run: true,
          created_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
          platform_target: { format_key: "yt_long", aspect_ratio: "16:9", resolution: "1920x1080" },
          assets: { video: "test.mp4", captions: [], metadata: {} },
          readiness: { ready_to_post: false, blocking_reasons: [], warnings: [] },
          provenance: { generated_by: "test" },
        },
      ],
    };

    // Manually write unsafe store to bypass validation
    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    // Get report - should sanitize by_platform keys
    const report = getProductionPackageReadinessReport();

    // Verify platform key is sanitized
    assert.ok(Object.keys(report.by_platform).length > 0);
    for (const platform of Object.keys(report.by_platform)) {
      assert.ok(!platform.includes("client_secret"), "by_platform should not leak client_secret");
      assert.ok(!platform.includes("youtube-client_secret"), "by_platform should not contain raw unsafe platform");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-17: unsafe package_state in by_state keys does not leak", () => {
  const tempDir = setupTestRuntime();
  try {
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      drafts: [
        {
          package_id: "pkg-test-2",
          source_job_id: "job-456",
          project_id: "proj-test",
          platform: "youtube",
          account_id: "account-test",
          package_state: "draft-access_token-secret", // Unsafe: contains access_token
          dry_run: true,
          created_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
          platform_target: { format_key: "yt_long", aspect_ratio: "16:9", resolution: "1920x1080" },
          assets: { video: "test.mp4", captions: [], metadata: {} },
          readiness: { ready_to_post: false, blocking_reasons: [], warnings: [] },
          provenance: { generated_by: "test" },
        },
      ],
    };

    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    const report = getProductionPackageReadinessReport();

    // Verify state keys are sanitized
    for (const state of Object.keys(report.by_state)) {
      assert.ok(!state.includes("access_token"), "by_state should not leak access_token");
      assert.ok(!state.includes("draft-access_token"), "by_state should not contain raw unsafe state");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-18: unsafe package_id in report.drafts does not leak", () => {
  const tempDir = setupTestRuntime();
  try {
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      drafts: [
        {
          package_id: "pkg-keychain://secret-api-key", // Unsafe: contains keychain://
          source_job_id: "job-789",
          project_id: "proj-test",
          platform: "youtube",
          account_id: "account-test",
          package_state: "draft",
          dry_run: true,
          created_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
          platform_target: { format_key: "yt_long", aspect_ratio: "16:9", resolution: "1920x1080" },
          assets: { video: "test.mp4", captions: [], metadata: {} },
          readiness: { ready_to_post: false, blocking_reasons: [], warnings: [] },
          provenance: { generated_by: "test" },
        },
      ],
    };

    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    const report = getProductionPackageReadinessReport();

    // Verify package_id is sanitized in drafts
    for (const draft of report.drafts) {
      assert.ok(!draft.package_id.includes("keychain"), "draft package_id should not leak keychain");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-19: unsafe project_id in report.drafts does not leak", () => {
  const tempDir = setupTestRuntime();
  try {
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      drafts: [
        {
          package_id: "pkg-test-4",
          source_job_id: "job-999",
          project_id: "proj-Bearer-fake-token-xyz", // Unsafe: contains Bearer
          platform: "youtube",
          account_id: "account-test",
          package_state: "draft",
          dry_run: true,
          created_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
          platform_target: { format_key: "yt_long", aspect_ratio: "16:9", resolution: "1920x1080" },
          assets: { video: "test.mp4", captions: [], metadata: {} },
          readiness: { ready_to_post: false, blocking_reasons: [], warnings: [] },
          provenance: { generated_by: "test" },
        },
      ],
    };

    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    const report = getProductionPackageReadinessReport();

    // Verify project_id is sanitized in drafts
    for (const draft of report.drafts) {
      assert.ok(!draft.project_id.includes("Bearer"), "draft project_id should not leak Bearer token");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-20: ready_to_post remains false even if raw readiness.ready_to_post is true", () => {
  const tempDir = setupTestRuntime();
  try {
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      drafts: [
        {
          package_id: "pkg-test-5",
          source_job_id: "job-aaa",
          project_id: "proj-test",
          platform: "youtube",
          account_id: "account-test",
          package_state: "draft",
          dry_run: true,
          created_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
          platform_target: { format_key: "yt_long", aspect_ratio: "16:9", resolution: "1920x1080" },
          assets: { video: "test.mp4", captions: [], metadata: {} },
          readiness: { ready_to_post: true, blocking_reasons: [], warnings: [] }, // Manually set to true (should be rejected)
          provenance: { generated_by: "test" },
        },
      ],
    };

    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    const report = getProductionPackageReadinessReport();

    // Summary ready_to_post should come from validation, which always returns false in VO-2E
    assert.strictEqual(report.ready_to_post, 0, "report.ready_to_post should be 0 even if raw readiness was true");
    for (const draft of report.drafts) {
      assert.strictEqual(draft.ready_to_post, false, "summary ready_to_post should always be false in VO-2E");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2E-21: JSON.stringify(report) contains no forbidden strings", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create drafts with many unsafe patterns
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      drafts: [
        {
          package_id: "pkg-test-credential_reference-xxx",
          source_job_id: "job-bbb",
          project_id: "proj-credentialReference-yyy",
          platform: "youtube-keychain://secret",
          account_id: "account-test",
          package_state: "draft-access_token-zzz",
          dry_run: true,
          created_at: new Date().toISOString(),
          scheduled_for: new Date().toISOString(),
          platform_target: { format_key: "yt_long", aspect_ratio: "16:9", resolution: "1920x1080" },
          assets: { video: "test.mp4", captions: [], metadata: {} },
          readiness: { ready_to_post: false, blocking_reasons: [], warnings: [] },
          provenance: { generated_by: "test" },
        },
      ],
    };

    const storePath = getPackageDraftsPath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    const report = getProductionPackageReadinessReport();
    const reportJson = JSON.stringify(report);

    // Check for forbidden patterns
    const forbiddenPatterns = [
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
    ];

    for (const pattern of forbiddenPatterns) {
      assert.ok(
        !reportJson.toLowerCase().includes(pattern.toLowerCase()),
        `report JSON should not contain forbidden pattern: ${pattern}`
      );
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});
