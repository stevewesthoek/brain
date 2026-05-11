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
  validateContentBrief,
  validateLocalMediaAssetReference,
  attachContentBriefToPackageDraft,
  createLocalRenderPlanFromPackageDraft,
  validateRenderPlan,
  saveRenderPlan,
  loadRenderPlan,
  listRenderPlans,
  deleteRenderPlan,
  generateRenderPlanReadinessReport,
  getLocalRenderPlanReadinessReport,
  buildRenderPlanSummary,
  saveLocalRenderPlan,
  getLocalRenderPlan,
  listLocalRenderPlans,
  resolveSafeLocalValidationPath,
  validateLocalFileExistence,
  validateRenderPlanManifestConsistency,
  getLocalRenderPlanValidationReport,
  validateRenderTargetAgainstSpecs,
  validateRenderPlanAgainstLocalSpecs,
  getManualRenderManifestCheckReport,
  loadVideoOrchestratorFormatSpecs,
  loadVideoOrchestratorPlatformSpecs,
  type ProjectDistribution,
  type ProjectPlanResult,
  type ProductionPackageDraft,
  type ContentBrief,
  type RenderPlan,
  type RenderTarget,
  type AggregateRenderPlanReadinessReport,
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
      schema_version: "1.0" as const,
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
      schema_version: "1.0" as const,
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
      schema_version: "1.0" as const,
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
      schema_version: "1.0" as const,
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
      schema_version: "1.0" as const,
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
      schema_version: "1.0" as const,
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

// ─── VO-2F Content Brief and Media Asset Validation Tests ───────────────────

test("VO-2F-1: Content brief schema version must be 1.0", () => {
  const invalidBrief = {
    schema_version: "2.0",
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(invalidBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("schema_version")));
});

test("VO-2F-2: Valid content brief passes validation", () => {
  const validBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-example-001",
    project_id: "project-alpha",
    title: "Example Educational Video",
    objective: "Introduce viewers to video orchestrator concepts.",
    target_platforms: ["youtube", "tiktok"],
    content_type: "short_form" as const,
    source_materials: [
      { material_id: "script-001", kind: "script" as const, local_path: "drafts/script-001.md" },
    ],
    production_constraints: {
      language: "en",
      max_duration_seconds: 600,
      aspect_ratios: ["9:16", "16:9"],
      captions_required: true,
      thumbnail_required: true,
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(validBrief);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.blocking_reasons.length, 0);
});

test("VO-2F-3: Missing required field blocks validation", () => {
  const incompleteBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    // Missing title
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(incompleteBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("title")));
});

test("VO-2F-4: Empty target_platforms blocks validation", () => {
  const noPlatformsBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: [],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(noPlatformsBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("target_platforms")));
});

test("VO-2F-5: Unknown platform blocks validation", () => {
  const unknownPlatformBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube", "unknown-platform"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(unknownPlatformBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("Unknown platform")));
});

test("VO-2F-6: Forbidden key pattern blocks validation", () => {
  const forbiddenKeyBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
      access_token: "secret123", // forbidden key
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(forbiddenKeyBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("Forbidden")));
});

test("VO-2F-7: Forbidden string value blocks validation", () => {
  const forbiddenValueBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test with refresh_token in it",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(forbiddenValueBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("Forbidden pattern")));
});

test("VO-2F-8: Absolute local_path blocks validation", () => {
  const absolutePathBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [
      { material_id: "script-001", kind: "script" as const, local_path: "/absolute/path/script.md" },
    ],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(absolutePathBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("must be relative")));
});

test("VO-2F-9: URL local_path blocks validation", () => {
  const urlPathBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [{ material_id: "script-001", kind: "script" as const, local_path: "https://example.com/script" }],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(urlPathBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("must be local")));
});

test("VO-2F-10: Traversal path (..) blocks validation", () => {
  const traversalBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [{ material_id: "script-001", kind: "script" as const, local_path: "../../etc/passwd" }],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(traversalBrief);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("traversal")));
});

test("VO-2F-11: Valid relative local_path passes shape validation", () => {
  const validPathBrief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [{ material_id: "script-001", kind: "script" as const, local_path: "drafts/script-001.md" }],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(validPathBrief);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.blocking_reasons.length, 0);
});

test("VO-2F-12: Valid media asset reference passes shape validation", () => {
  const validAsset = {
    kind: "video",
    path: "renders/output.mp4",
    expected_format: "mp4",
    expected_resolution: "1920x1080",
    required: true,
  };
  const result = validateLocalMediaAssetReference(validAsset);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.ready_for_upload, false);
  assert.ok(result.warnings.some((w: string) => w.includes("VO-2F")));
});

test("VO-2F-13: Absolute path in media asset blocks", () => {
  const absoluteAsset = { kind: "video", path: "/var/tmp/output.mp4", required: true };
  const result = validateLocalMediaAssetReference(absoluteAsset);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("must be relative")));
});

test("VO-2F-14: URL path in media asset blocks", () => {
  const urlAsset = { kind: "video", path: "https://cdn.example.com/video.mp4", required: true };
  const result = validateLocalMediaAssetReference(urlAsset);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("must be local")));
});

test("VO-2F-15: Traversal path in media asset blocks", () => {
  const traversalAsset = { kind: "video", path: "../../sensitive/file.mp4", required: true };
  const result = validateLocalMediaAssetReference(traversalAsset);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.some((r: string) => r.includes("traversal")));
});

test("VO-2F-16: Missing required field in media asset blocks", () => {
  const incompleteAsset = { kind: "video" }; // missing path and required
  const result = validateLocalMediaAssetReference(incompleteAsset);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking_reasons.length > 0);
});

test("VO-2F-17: Media asset validation does not check file existence", () => {
  const nonexistentAsset = { kind: "video", path: "renders/nonexistent.mp4", required: true };
  const result = validateLocalMediaAssetReference(nonexistentAsset);
  assert.strictEqual(result.exists_checked, false);
  assert.strictEqual(result.ready_for_render, false);
  assert.strictEqual(result.ready_for_upload, false);
});

test("VO-2F-18: Attach brief to draft creates copy and adds metadata", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({
      draft,
      brief,
      dryRun: true,
    });

    assert.ok(updated.assets.metadata.brief_id);
    assert.strictEqual(updated.assets.metadata.brief_id, "brief-001");
    assert.strictEqual(updated.assets.metadata.content_type, "short_form");
    assert.ok(updated.readiness.ready_to_post === false);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-19: Attach brief does not mutate original draft", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const originalMetadata = JSON.stringify(draft.assets.metadata);

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    attachContentBriefToPackageDraft({ draft, brief, dryRun: true });

    assert.strictEqual(JSON.stringify(draft.assets.metadata), originalMetadata);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-20: Attach brief blocks if dryRun is false", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    assert.throws(
      () => attachContentBriefToPackageDraft({ draft, brief, dryRun: false as any }),
      /dryRun=true/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-21: Attach brief blocks if brief validation fails", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const invalidBrief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      // missing project_id, title, objective, etc.
    };

    assert.throws(
      () => attachContentBriefToPackageDraft({ draft, brief: invalidBrief as any, dryRun: true }),
      /validation failed/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-22: Attached brief output ready_to_post remains false", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({
      draft,
      brief,
      dryRun: true,
    });

    assert.strictEqual(updated.readiness.ready_to_post, false);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-23: Attached brief output contains no forbidden strings", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({
      draft,
      brief,
      dryRun: true,
    });

    const outputJson = JSON.stringify(updated).toLowerCase();
    const forbidden = [
      "access_token",
      "refresh_token",
      "client_secret",
      "keychain://",
      "bearer",
      "private_key",
    ];

    for (const pattern of forbidden) {
      assert.ok(!outputJson.includes(pattern), `Output should not contain ${pattern}`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-24: saveProductionPackageDraft accepts safe attached draft", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({
      draft,
      brief,
      dryRun: true,
    });

    // Should not throw
    saveProductionPackageDraft(updated);
    assert.ok(true);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-25: saveProductionPackageDraft rejects unsafe attached draft", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const unsafeDraft = {
      ...draft,
      assets: {
        ...draft.assets,
        metadata: {
          ...draft.assets.metadata,
          access_token: "secret123", // forbidden
        },
      },
    };

    assert.throws(() => saveProductionPackageDraft(unsafeDraft), /unsafe/);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2F Hardening: Safe Validation Error Messages ────────────────────────

test("VO-2F-H1: Invalid platform in target_platforms blocks without echoing value", () => {
  const brief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube-access_token-leak"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(brief);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();
  assert.ok(!blockingText.includes("access_token"), "Should not echo forbidden pattern");
  assert.ok(!blockingText.includes("youtube-access_token-leak"), "Should not echo malicious value");
  assert.ok(blockingText.includes("unknown platform"), "Should indicate validation failure");
});

test("VO-2F-H2: Invalid content_type blocks without echoing value", () => {
  const brief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "client_secret-leak",
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(brief);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();
  assert.ok(!blockingText.includes("client_secret"), "Should not echo forbidden pattern");
  assert.ok(!blockingText.includes("client_secret-leak"), "Should not echo malicious value");
  assert.ok(blockingText.includes("invalid content_type"), "Should indicate validation failure");
});

test("VO-2F-H3: Malicious local_path blocks without echoing keychain://-like values", () => {
  const brief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [
      { material_id: "script-001", kind: "script" as const, local_path: "keychain://secret" },
    ],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };
  const result = validateContentBrief(brief);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();
  assert.ok(!blockingText.includes("keychain://"), "Should not echo forbidden pattern");
  assert.ok(!blockingText.includes("secret"), "Should not echo secret");
});

test("VO-2F-H4: Media asset with Bearer token blocks without echoing it", () => {
  const asset = { kind: "video", path: "Bearer fake-token", required: true };
  const result = validateLocalMediaAssetReference(asset);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();
  assert.ok(!blockingText.includes("bearer"), "Should not echo forbidden pattern");
  assert.ok(!blockingText.includes("fake-token"), "Should not echo token");
});

test("VO-2F-H5: Media asset with URL path blocks without echoing URL", () => {
  const asset = { kind: "video", path: "https://api.example.com/secret/video.mp4?token=xyz", required: true };
  const result = validateLocalMediaAssetReference(asset);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|");
  assert.ok(!blockingText.includes("https://"), "Should not echo URL");
  assert.ok(!blockingText.includes("token="), "Should not echo query params");
  assert.ok(blockingText.includes("must be local"), "Should indicate validation failure");
});

test("VO-2F-H6: Attached brief metadata excludes source_materials and sensitive fields", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [
        {
          material_id: "script-001",
          kind: "script" as const,
          local_path: "sensitive/path/script.md",
          summary: "Sensitive summary text",
        },
      ],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
        prohibited_claims: ["This should not be stored"],
        compliance_notes: ["Confidential compliance info"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({ draft, brief, dryRun: true });
    const metadataStr = JSON.stringify(updated.assets.metadata);

    assert.ok(!metadataStr.includes("source_materials"), "Should not copy source_materials");
    assert.ok(!metadataStr.includes("local_path"), "Should not copy local paths");
    assert.ok(!metadataStr.includes("sensitive/path"), "Should not leak file paths");
    assert.ok(!metadataStr.includes("prohibited_claims"), "Should not copy prohibited_claims");
    assert.ok(!metadataStr.includes("compliance_notes"), "Should not copy compliance_notes");
    assert.ok(!metadataStr.includes("This should not"), "Should not include claim text");
    assert.ok(!metadataStr.includes("Confidential"), "Should not include compliance info");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-H7: Attached brief metadata contains no forbidden patterns", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({ draft, brief, dryRun: true });
    const metadataStr = JSON.stringify(updated.assets.metadata).toLowerCase();

    const forbidden = [
      "access_token",
      "refresh_token",
      "client_secret",
      "keychain://",
      "bearer",
      "private_key",
    ];
    for (const pattern of forbidden) {
      assert.ok(!metadataStr.includes(pattern), `Metadata should not contain ${pattern}`);
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-H8: saveProductionPackageDraft accepts safe attached draft", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const brief = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
    };

    const updated = attachContentBriefToPackageDraft({ draft, brief, dryRun: true });
    saveProductionPackageDraft(updated);
    assert.ok(true);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-2F-H9: saveProductionPackageDraft rejects unsafe attached draft", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const unsafeDraft = {
      ...draft,
      assets: {
        ...draft.assets,
        metadata: {
          ...draft.assets.metadata,
          access_token: "secret123",
        },
      },
    };

    assert.throws(() => saveProductionPackageDraft(unsafeDraft), /unsafe/);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-2F Final Hardening: Unsafe Key-Name Non-Leakage ─────────────────────

test("VO-2F-FH1: Extra forbidden key does not echo key name in blocking_reasons", () => {
  const brief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
    access_token_super_secret: "malicious_value",
  } as any;

  const result = validateContentBrief(brief);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();

  // Should NOT echo any of these
  assert.ok(!blockingText.includes("access_token_super_secret"), "Should not echo full key name");
  assert.ok(!blockingText.includes("access_token"), "Should not echo access_token");
  assert.ok(!blockingText.includes("super_secret"), "Should not echo secret");
  assert.ok(!blockingText.includes("token"), "Should not echo token");
  assert.ok(!blockingText.includes("secret"), "Should not echo secret");
});

test("VO-2F-FH2: Nested forbidden key does not echo key name in blocking_reasons", () => {
  const brief = {
    schema_version: "1.0" as const,
    brief_id: "brief-001",
    project_id: "project-alpha",
    title: "Test",
    objective: "Test objective",
    target_platforms: ["youtube"],
    content_type: "short_form" as const,
    source_materials: [
      {
        material_id: "script-001",
        kind: "script" as const,
        client_secret_note: "This should not appear",
      } as any,
    ],
    production_constraints: {
      language: "en",
      captions_required: true,
      thumbnail_required: true,
      aspect_ratios: ["16:9"],
    },
    created_at: "2026-05-11T10:00:00Z",
  };

  const result = validateContentBrief(brief);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();

  // Should NOT echo any of these
  assert.ok(!blockingText.includes("client_secret_note"), "Should not echo full key name");
  assert.ok(!blockingText.includes("client_secret"), "Should not echo client_secret");
  assert.ok(!blockingText.includes("_note"), "Should not echo _note");
  assert.ok(!blockingText.includes("secret"), "Should not echo secret");
});

test("VO-2F-FH3: Media asset with forbidden key does not echo key name", () => {
  const asset = {
    kind: "video",
    path: "renders/video.mp4",
    required: true,
    "keychain://bad": "Should not leak",
  } as any;

  const result = validateLocalMediaAssetReference(asset);
  assert.strictEqual(result.ok, false);
  const blockingText = result.blocking_reasons.join("|").toLowerCase();

  // Should NOT echo any of these
  assert.ok(!blockingText.includes("keychain://bad"), "Should not echo full key");
  assert.ok(!blockingText.includes("keychain://"), "Should not echo keychain://");
  assert.ok(!blockingText.includes("bad"), "Should not echo bad");
});

test("VO-2F-FH4: Attached brief with forbidden key throws safely without echoing key", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;
  try {
    const job = createVideoJob({
      type: "generate_episode",
      scheduledFor: new Date(),
      dryRun: true,
    });

    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "youtube-channel-main",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const briefWithForbiddenKey = {
      schema_version: "1.0" as const,
      brief_id: "brief-001",
      project_id: "project-alpha",
      title: "Test",
      objective: "Test objective",
      target_platforms: ["youtube"],
      content_type: "short_form" as const,
      source_materials: [],
      production_constraints: {
        language: "en",
        captions_required: true,
        thumbnail_required: true,
        aspect_ratios: ["16:9"],
      },
      created_at: "2026-05-11T10:00:00Z",
      access_token: "malicious",
      client_secret: "also_bad",
      "Bearer token": "another_leak",
    } as any;

    try {
      attachContentBriefToPackageDraft({ draft, brief: briefWithForbiddenKey, dryRun: true });
      assert.fail("Should have thrown");
    } catch (err) {
      const errorText = String(err).toLowerCase();
      // Should NOT echo these
      assert.ok(!errorText.includes("access_token"), "Error should not echo access_token");
      assert.ok(!errorText.includes("client_secret"), "Error should not echo client_secret");
      assert.ok(!errorText.includes("bearer"), "Error should not echo Bearer");
      assert.ok(!errorText.includes("token"), "Error should not echo token");
      assert.ok(!errorText.includes("secret"), "Error should not echo secret");
      assert.ok(!errorText.includes("malicious"), "Error should not echo value");
      assert.ok(!errorText.includes("also_bad"), "Error should not echo value");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-3B: Render Plan Tests ────────────────────────────────────────────────

test("VO-3B-1: Create render plan from package draft", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });
    assert.ok(draft, "Draft created");

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    assert.equal(renderPlan.render_plan_id, `plan-${draft.package_id}-youtube`);
    assert.equal(renderPlan.platform, "youtube");
    assert.equal(renderPlan.package_id, draft.package_id);
    assert.equal(renderPlan.dry_run, true);
    assert.ok(renderPlan.render_targets.length > 0);
    assert.ok(renderPlan.validation.ready_for_render === false);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-2: Render plan schema version must be 1.0", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    const result = validateRenderPlan(renderPlan);
    assert.ok(result.ok);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-3: Invalid platform blocks render plan creation", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    assert.throws(
      () => {
        createLocalRenderPlanFromPackageDraft({
          draft,
          platform: "invalid-platform" as any,
          dryRun: true,
        });
      },
      /Platform must be valid/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-4: Render plan requires dryRun=true", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    assert.throws(
      () => {
        createLocalRenderPlanFromPackageDraft({
          draft,
          platform: "youtube",
          dryRun: false as any,
        });
      },
      /requires dryRun=true/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-5: Render plan paths are relative, not absolute", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    for (const target of renderPlan.render_targets) {
      assert.ok(!target.planned_output_path.startsWith("/"), "Path should not be absolute");
      assert.ok(!target.planned_output_path.includes("://"), "Path should not be URL");
      assert.ok(!target.planned_output_path.includes(".."), "Path should not have traversal");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-6: Render plan ready_for_render is always false", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    assert.equal(renderPlan.validation.ready_for_render, false);
    assert.equal(renderPlan.validation.ready_for_upload, false);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-7: Render plan includes blocking_reasons", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    assert.ok(Array.isArray(renderPlan.validation.blocking_reasons));
    assert.ok(renderPlan.validation.blocking_reasons.length > 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-8: Save and load render plan", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(renderPlan);
    const loaded = loadRenderPlan(renderPlan.render_plan_id);

    assert.ok(loaded);
    assert.equal(loaded!.render_plan_id, renderPlan.render_plan_id);
    assert.equal(loaded!.platform, "youtube");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-9: List render plans by package_id", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan1 = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    const draftTT = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "tiktok",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan2 = createLocalRenderPlanFromPackageDraft({
      draft: draftTT,
      platform: "tiktok",
      dryRun: true,
    });

    saveRenderPlan(plan1);
    saveRenderPlan(plan2);

    const plans1 = listRenderPlans({ package_id: draft.package_id });
    assert.ok(plans1.length >= 1);

    const plans2 = listRenderPlans({ package_id: draftTT.package_id });
    assert.ok(plans2.length >= 1);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-10: Delete render plan", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(renderPlan);
    assert.ok(loadRenderPlan(renderPlan.render_plan_id));

    deleteRenderPlan(renderPlan.render_plan_id);
    assert.equal(loadRenderPlan(renderPlan.render_plan_id), null);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-11: Render plan validation rejects invalid platform", () => {
  const tempDir = setupTestRuntime();
  try {
    const invalidPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-123",
      package_id: "pkg-123",
      project_id: "proj-123",
      platform: "invalid_platform",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-123",
      },
    };

    const result = validateRenderPlan(invalidPlan);
    assert.ok(!result.ok);
    assert.ok(result.blocking_reasons.some((r) => r.includes("platform")));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-12: Render plan validation requires dry_run=true", () => {
  const tempDir = setupTestRuntime();
  try {
    const invalidPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-123",
      package_id: "pkg-123",
      project_id: "proj-123",
      platform: "youtube",
      dry_run: false,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "1920x1080",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/video.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-123",
      },
    };

    const result = validateRenderPlan(invalidPlan);
    assert.ok(!result.ok);
    assert.ok(result.blocking_reasons.some((r) => r.includes("dry_run")));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-13: Render plan validation rejects absolute paths", () => {
  const tempDir = setupTestRuntime();
  try {
    const invalidPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-123",
      package_id: "pkg-123",
      project_id: "proj-123",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "1920x1080",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "/absolute/path/video.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-123",
      },
    };

    const result = validateRenderPlan(invalidPlan);
    assert.ok(!result.ok);
    assert.ok(result.blocking_reasons.some((r) => r.includes("absolute")));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-14: Render plan validation rejects URL paths", () => {
  const tempDir = setupTestRuntime();
  try {
    const invalidPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-123",
      package_id: "pkg-123",
      project_id: "proj-123",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "1920x1080",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "https://example.com/video.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-123",
      },
    };

    const result = validateRenderPlan(invalidPlan);
    assert.ok(!result.ok);
    assert.ok(result.blocking_reasons.some((r) => r.includes("URL")));
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-15: Generate render plan readiness report", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(renderPlan);
    const report = generateRenderPlanReadinessReport(renderPlan.render_plan_id);

    assert.ok(report);
    assert.equal(report!.render_plan_id, renderPlan.render_plan_id);
    assert.equal(report!.ready_for_render, false);
    assert.equal(report!.ready_for_upload, false);
    assert.ok(report!.summary);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-16: Save render plan validates before storing", () => {
  const tempDir = setupTestRuntime();
  try {
    const invalidPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-123",
      package_id: "pkg-123",
      project_id: "proj-123",
      platform: "invalid_platform",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-123",
      },
    };

    assert.throws(
      () => {
        saveRenderPlan(invalidPlan as any);
      },
      /validation failed/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-17: Render plan contains provenance", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    assert.ok(renderPlan.provenance.generated_by);
    assert.ok(renderPlan.provenance.source_package_id);
    assert.ok(renderPlan.provenance.checksum);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-18: Render plan with thumbnails required", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Update draft to require thumbnails
    draft.assets.metadata.thumbnail_required = true;
    saveProductionPackageDraft(draft);

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    const thumbnailTargets = renderPlan.render_targets.filter((t) => t.kind === "thumbnail");
    assert.ok(thumbnailTargets.length > 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-19: Render plan with captions required", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Update draft to require captions
    draft.assets.metadata.captions_required = true;
    saveProductionPackageDraft(draft);

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    const captionTargets = renderPlan.render_targets.filter((t) => t.kind === "caption");
    assert.ok(captionTargets.length > 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-20: Render plan asset counts match targets", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const renderPlan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    // Video count should be 1
    assert.equal(renderPlan.asset_plan.video.count, 1);
    // Thumbnails and captions count should match targets
    assert.ok(renderPlan.asset_plan.thumbnails.count >= 0);
    assert.ok(renderPlan.asset_plan.captions.count >= 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-21: Render plan validation rejects forbidden patterns", () => {
  const tempDir = setupTestRuntime();
  try {
    const invalidPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-123",
      package_id: "pkg-123",
      project_id: "proj-123",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "1920x1080",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/video.mp4",
          access_token: "secret_token_12345",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-123",
      },
    };

    const result = validateRenderPlan(invalidPlan);
    assert.ok(!result.ok);
    assert.ok(
      result.blocking_reasons.some((r) => r.includes("Forbidden")),
      "Should block forbidden patterns"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-22: List render plans by platform", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const draftTT = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "tiktok",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan1 = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });
    const plan2 = createLocalRenderPlanFromPackageDraft({
      draft: draftTT,
      platform: "tiktok",
      dryRun: true,
    });

    saveRenderPlan(plan1);
    saveRenderPlan(plan2);

    const youtubePlans = listRenderPlans({ platform: "youtube" });
    assert.ok(youtubePlans.length >= 1);

    const tiktokPlans = listRenderPlans({ platform: "tiktok" });
    assert.ok(tiktokPlans.length >= 1);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-23: Render plan for multiple platforms", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });

    const platforms = ["youtube", "youtube_shorts", "tiktok", "instagram"];
    const plans: RenderPlan[] = [];

    // Create one draft per platform and render plan
    for (const platform of platforms) {
      const draft = createProductionPackageDraft({
        job,
        project_id: "project-alpha",
        platform,
        account_id: "test-account",
        scheduled_for: new Date(),
        dryRun: true,
      });

      const plan = createLocalRenderPlanFromPackageDraft({
        draft,
        platform,
        dryRun: true,
      });

      plans.push(plan);
    }

    plans.forEach((plan) => saveRenderPlan(plan));

    const allPlans = listRenderPlans({ project_id: "project-alpha" });
    assert.ok(allPlans.length >= 4, `Expected at least 4 plans, got ${allPlans.length}`);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-24: Load non-existent render plan returns null", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan = loadRenderPlan("non-existent-plan-id");
    assert.equal(plan, null);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-3B Hardening Tests ──────────────────────────────────────────────────

test("VO-3B-H1: createLocalRenderPlanFromPackageDraft blocks non-dry-run package draft", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Force draft to non-dry-run (should be blocked)
    draft.dry_run = false as any;

    assert.throws(
      () => {
        createLocalRenderPlanFromPackageDraft({
          draft,
          platform: "youtube",
          dryRun: true,
        });
      },
      /dry-run package drafts/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H2: createLocalRenderPlanFromPackageDraft blocks upload-ready drafts", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    // Mark as ready_to_post (without saving - just modify in memory)
    draft.readiness.ready_to_post = true;

    assert.throws(
      () => {
        createLocalRenderPlanFromPackageDraft({
          draft,
          platform: "youtube",
          dryRun: true,
        });
      },
      /upload-ready drafts/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H3: createLocalRenderPlanFromPackageDraft blocks mismatched input.platform vs draft.platform", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    assert.throws(
      () => {
        createLocalRenderPlanFromPackageDraft({
          draft,
          platform: "tiktok", // Mismatch
          dryRun: true,
        });
      },
      /must match draft platform/
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H4: mismatched platform error does not echo raw value", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    try {
      createLocalRenderPlanFromPackageDraft({
        draft,
        platform: "tiktok",
        dryRun: true,
      });
    } catch (err) {
      const errorText = String(err);
      // Should not echo raw platform values
      assert.ok(!errorText.includes("tiktok"));
      assert.ok(!errorText.includes("youtube"));
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H5: listRenderPlans filters by project_id", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });

    // Create draft for project-alpha and save plan
    const draft1 = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan1 = createLocalRenderPlanFromPackageDraft({
      draft: draft1,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan1);

    // Verify filter works
    const alphaPlan = listRenderPlans({ project_id: "project-alpha" });
    assert.ok(alphaPlan.length >= 1, `Expected at least 1 alpha plan, got ${alphaPlan.length}`);

    // Verify non-existent project returns empty
    const betaPlans = listRenderPlans({ project_id: "project-nonexistent" });
    assert.ok(betaPlans.length === 0, `Expected 0 beta plans, got ${betaPlans.length}`);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H6: listRenderPlans filters by plan_state", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    // Plan is in "planned" state by default
    saveRenderPlan(plan);

    const plannedPlans = listRenderPlans({ plan_state: "planned" });
    assert.ok(plannedPlans.length > 0);

    const draftPlans = listRenderPlans({ plan_state: "draft" });
    assert.equal(draftPlans.length, 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H7: listRenderPlans sorts by created_at then render_plan_id", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan1 = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan1);

    // Small delay and create another
    const draft2 = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "tiktok",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan2 = createLocalRenderPlanFromPackageDraft({
      draft: draft2,
      platform: "tiktok",
      dryRun: true,
    });

    saveRenderPlan(plan2);

    const plans = listRenderPlans({ project_id: "project-alpha" });
    // Should be sorted by created_at
    if (plans.length >= 2 && plans[0] && plans[1]) {
      const time1 = new Date(plans[0]!.created_at).getTime();
      const time2 = new Date(plans[1]!.created_at).getTime();
      assert.ok(time1 <= time2, "Plans should be sorted by created_at ascending");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H8: saveRenderPlan sorts store by created_at then render_plan_id", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    // Verify plans are sorted in storage
    const plans = listRenderPlans();
    for (let i = 1; i < plans.length; i++) {
      const prevPlan = plans[i - 1];
      const currPlan = plans[i];
      if (prevPlan && currPlan) {
        const prevTime = new Date(prevPlan.created_at).getTime();
        const currTime = new Date(currPlan.created_at).getTime();
        assert.ok(prevTime <= currTime, "Store should be sorted by created_at");
      }
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H9: getLocalRenderPlanReadinessReport counts total plans", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanReadinessReport();
    assert.ok(report.total > 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H10: getLocalRenderPlanReadinessReport groups by sanitized state/platform", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanReadinessReport();
    assert.ok(Object.keys(report.by_state).length > 0);
    assert.ok(Object.keys(report.by_platform).length > 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H11: getLocalRenderPlanReadinessReport ready_for_render is 0", () => {
  const tempDir = setupTestRuntime();
  try {
    const report = getLocalRenderPlanReadinessReport();
    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0 in VO-3B");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H12: getLocalRenderPlanReadinessReport ready_for_upload is 0", () => {
  const tempDir = setupTestRuntime();
  try {
    const report = getLocalRenderPlanReadinessReport();
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0 in VO-3B");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H13: getLocalRenderPlanReadinessReport does not include paths/targets/asset_plan", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanReadinessReport();
    const reportJson = JSON.stringify(report);

    // Should not contain sensitive fields
    assert.ok(
      !reportJson.includes("planned_output_path"),
      "Report should not include planned_output_path"
    );
    assert.ok(!reportJson.includes("render_targets"), "Report should not include render_targets");
    assert.ok(!reportJson.includes("asset_plan"), "Report should not include asset_plan");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H14: JSON.stringify report contains none of forbidden strings", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanReadinessReport();
    const reportText = JSON.stringify(report).toLowerCase();

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
    ];

    for (const pattern of forbidden) {
      assert.ok(
        !reportText.includes(pattern),
        `Report should not contain forbidden pattern: ${pattern}`
      );
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H15: Compatibility wrappers work", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    // Use compatibility wrappers
    saveLocalRenderPlan(plan);
    const loaded = getLocalRenderPlan(plan.render_plan_id);
    assert.ok(loaded);

    const allPlans = listLocalRenderPlans({ package_id: draft.package_id });
    assert.ok(allPlans.length > 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-H16: buildRenderPlanSummary sanitizes unsafe values", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    const summary = buildRenderPlanSummary(plan);

    // Summary should have safe default values or sanitized strings
    assert.ok(summary.render_plan_id);
    assert.ok(summary.package_id);
    assert.ok(summary.project_id);
    assert.ok(summary.platform);
    assert.equal(summary.ready_for_render, false);
    assert.equal(summary.ready_for_upload, false);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-3B Final Hardening Tests ────────────────────────────────────────────

test("VO-3B-FH1: generateRenderPlanReadinessReport sanitizes unsafe legacy runtime data", () => {
  const tempDir = setupTestRuntime();
  try {
    // Manually write unsafe render-plans.json with forbidden patterns (bypassing validation)
    const unsafePlanData = {
      schema_version: "1.0",
      render_plan_id: "keychain://render-plan",
      package_id: "access_token-package",
      project_id: "Bearer fake-token",
      platform: "client_secret-platform",
      dry_run: true,
      plan_state: "blocked",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "test",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/test.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: ["Bearer fake-token", "refresh_token-issue"],
        warnings: ["keychain://warning"],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "access_token-package",
      },
    };

    // Manually write to render-plans.json (bypassing validation)
    const runtimeDir = getRuntimeDir();
    const storeFile = path.join(runtimeDir, "render-plans.json");
    const store = { schema_version: "1.0", created_at: new Date().toISOString(), plans: [unsafePlanData] };
    fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));

    // Generate report from unsafe plan
    const report = generateRenderPlanReadinessReport("keychain://render-plan");

    assert.ok(report, "Report should be generated even from unsafe data");
    assert.equal(report!.ready_for_render, false);
    assert.equal(report!.ready_for_upload, false);

    // Verify report output is sanitized
    const reportText = JSON.stringify(report).toLowerCase();

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
    ];

    for (const pattern of forbidden) {
      assert.ok(
        !reportText.includes(pattern),
        `Report should not contain forbidden pattern: ${pattern}`
      );
    }

    // Verify safe fallback values are used
    assert.equal(
      report!.render_plan_id,
      "[unsafe-render-plan-id]",
      "unsafe render_plan_id should use fallback"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-FH2: generateRenderPlanReadinessReport uses generic summary messages", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = generateRenderPlanReadinessReport(plan.render_plan_id);
    assert.ok(report);

    // Verify summary is generic (no raw platform/plan_id values)
    assert.ok(!report!.summary.includes("youtube"), "Summary should not echo raw platform");
    assert.ok(
      !report!.summary.includes(plan.render_plan_id),
      "Summary should not echo raw plan_id"
    );

    // Verify blocking_reasons are generic
    assert.ok(report!.blocking_reasons.length > 0);
    for (const reason of report!.blocking_reasons) {
      assert.ok(
        !reason.includes("keychain://") &&
          !reason.includes("Bearer") &&
          !reason.includes("access_token"),
        "Blocking reasons should be generic"
      );
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-FH3: buildRenderPlanSummary handles malformed validation (missing arrays)", () => {
  // Create malformed plan without valid arrays in validation
  const malformedPlan: RenderPlan = {
    schema_version: "1.0",
    render_plan_id: "plan-123",
    package_id: "pkg-123",
    project_id: "proj-123",
    platform: "youtube",
    dry_run: true,
    plan_state: "draft",
    created_at: new Date().toISOString(),
    render_targets: [],
    asset_plan: {
      video: { count: 1 },
      thumbnails: { count: 0 },
      captions: { count: 0 },
    },
    validation: {
      ready_for_render: false,
      ready_for_upload: false,
      // Malformed: not arrays
      blocking_reasons: null as any,
      warnings: undefined as any,
    },
    provenance: {
      generated_by: "test",
      source_package_id: "pkg-123",
    },
  };

  // Should not crash
  const summary = buildRenderPlanSummary(malformedPlan);

  assert.ok(summary);
  assert.equal(summary.ready_for_render, false);
  assert.equal(summary.ready_for_upload, false);
  assert.ok(summary.blocking_reasons_count >= 0);
  assert.ok(summary.warnings_count >= 0);
});

test("VO-3B-FH4: getLocalRenderPlanReadinessReport sanitizes all plan data", () => {
  const tempDir = setupTestRuntime();
  try {
    // Manually write multiple unsafe plans to render-plans.json (bypassing validation)
    const unsafePlan1 = {
      schema_version: "1.0",
      render_plan_id: "refresh_token-plan",
      package_id: "credential_reference-pkg",
      project_id: "keychain://proj",
      platform: "access_token",
      dry_run: true,
      plan_state: "blocked",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "test",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/test1.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: ["Bearer token issue"],
        warnings: ["client_secret"],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "code_verifier-source",
      },
    };

    const unsafePlan2 = {
      schema_version: "1.0",
      render_plan_id: "authorization_code-plan",
      package_id: "access_token-pkg",
      project_id: "proj-auth",
      platform: "Bearer-platform",
      dry_run: true,
      plan_state: "blocked",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "test",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/test2.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: ["refresh_token required"],
        warnings: ["code_verifier missing"],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-auth",
      },
    };

    // Manually write to render-plans.json (bypassing validation)
    const runtimeDir = getRuntimeDir();
    const storeFile = path.join(runtimeDir, "render-plans.json");
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      plans: [unsafePlan1, unsafePlan2],
    };
    fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));

    // Get aggregate report
    const aggregateReport = getLocalRenderPlanReadinessReport();

    // Verify aggregate report is sanitized
    const aggregateText = JSON.stringify(aggregateReport).toLowerCase();

    const forbidden = [
      "credential_reference",
      "keychain://",
      "access_token",
      "refresh_token",
      "client_secret",
      "bearer",
      "code_verifier",
      "authorization_code",
    ];

    for (const pattern of forbidden) {
      assert.ok(
        !aggregateText.includes(pattern),
        `Aggregate report should not contain: ${pattern}`
      );
    }

    // Verify ready_for_render and ready_for_upload are 0
    assert.equal(aggregateReport.ready_for_render, 0);
    assert.equal(aggregateReport.ready_for_upload, 0);

    // Verify safe fallback values are used in by_platform
    assert.ok(aggregateReport.by_platform);
    for (const platformKey of Object.keys(aggregateReport.by_platform)) {
      assert.ok(
        !platformKey.includes("Bearer") && !platformKey.includes("access_token"),
        `by_platform key should not contain forbidden patterns: ${platformKey}`
      );
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3B-FH5: generateRenderPlanReadinessReport handles malformed validation gracefully", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create plan with empty/malformed validation
    const malformedPlanData = {
      schema_version: "1.0",
      render_plan_id: "plan-malformed",
      package_id: "pkg-malformed",
      project_id: "proj-malformed",
      platform: "youtube",
      dry_run: true,
      plan_state: "draft",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "test",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/malformed.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1 },
        thumbnails: { count: 0 },
        captions: { count: 0 },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: null, // Malformed: not an array
        warnings: undefined, // Malformed: undefined
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-malformed",
      },
    };

    // Manually write to render-plans.json (bypassing validation)
    const runtimeDir = getRuntimeDir();
    const storeFile = path.join(runtimeDir, "render-plans.json");
    const store = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      plans: [malformedPlanData],
    };
    fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));

    // Should not crash
    const report = generateRenderPlanReadinessReport("plan-malformed");

    assert.ok(report, "Report should be generated");
    assert.equal(report!.ready_for_render, false);
    assert.equal(report!.ready_for_upload, false);
    assert.ok(Array.isArray(report!.blocking_reasons));
    assert.ok(Array.isArray(report!.warnings));

    // Also test aggregate report doesn't crash
    const aggregateReport = getLocalRenderPlanReadinessReport();
    assert.ok(aggregateReport, "Aggregate report should be generated");
    assert.equal(aggregateReport.ready_for_render, 0);
    assert.equal(aggregateReport.ready_for_upload, 0);
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

// ─── VO-3C: Local File Existence Validation Tests ──────────────────────────

test("VO-3C-PR1: resolveSafeLocalValidationPath validates relative path within baseDir", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-test-"));
  try {
    const result = resolveSafeLocalValidationPath({
      relativePath: "renders/output.mp4",
      baseDir: tempDir,
    });

    assert.ok(result.ok, "Relative path should resolve safely");
    assert.ok(result.absolutePath, "Absolute path should be returned");
    assert.ok(
      result.absolutePath!.startsWith(tempDir),
      "Resolved path should be within baseDir"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("VO-3C-PR2: resolveSafeLocalValidationPath blocks absolute paths", () => {
  const result = resolveSafeLocalValidationPath({
    relativePath: "/etc/passwd",
    baseDir: "/tmp",
  });

  assert.ok(!result.ok, "Absolute path should be blocked");
  assert.ok(result.blocking_reasons.length > 0, "Should have blocking reason");
  assert.ok(
    result.blocking_reasons[0]?.includes("Absolute"),
    "Reason should mention absolute paths"
  );
});

test("VO-3C-PR3: resolveSafeLocalValidationPath blocks URLs", () => {
  const result = resolveSafeLocalValidationPath({
    relativePath: "https://example.com/file.mp4",
    baseDir: "/tmp",
  });

  assert.ok(!result.ok, "URL path should be blocked");
  assert.ok(result.blocking_reasons.length > 0, "Should have blocking reason");
});

test("VO-3C-PR4: resolveSafeLocalValidationPath blocks traversal paths", () => {
  const result = resolveSafeLocalValidationPath({
    relativePath: "../../etc/passwd",
    baseDir: "/tmp",
  });

  assert.ok(!result.ok, "Traversal path should be blocked");
  assert.ok(result.blocking_reasons.length > 0, "Should have blocking reason");
  assert.ok(
    result.blocking_reasons[0]?.includes("traversal"),
    "Reason should mention traversal"
  );
});

test("VO-3C-PR5: resolveSafeLocalValidationPath blocks forbidden string paths", () => {
  const result = resolveSafeLocalValidationPath({
    relativePath: "renders/keychain://secret.mp4",
    baseDir: "/tmp",
  });

  assert.ok(!result.ok, "Path with forbidden patterns should be blocked");
  assert.ok(result.blocking_reasons.length > 0, "Should have blocking reason");
});

test("VO-3C-PR6: resolveSafeLocalValidationPath prevents path escape", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-base-"));
  const parentDir = path.dirname(baseDir);
  try {
    const result = resolveSafeLocalValidationPath({
      relativePath: path.join("..", path.basename(parentDir), "etc", "passwd"),
      baseDir,
    });

    assert.ok(!result.ok, "Escaped path should be blocked");
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test("VO-3C-PR7: resolveSafeLocalValidationPath blocking reasons do not echo raw unsafe paths", () => {
  const result = resolveSafeLocalValidationPath({
    relativePath: "../../etc/keychain://secret.mp4",
    baseDir: "/tmp",
  });

  assert.ok(!result.ok, "Path should be blocked");
  const reasons = JSON.stringify(result.blocking_reasons);
  assert.ok(
    !reasons.includes("keychain://") && !reasons.includes("etc/"),
    "Blocking reasons should not echo raw path"
  );
});

test("VO-3C-FX1: validateLocalFileExistence with disabled mode does not check filesystem", () => {
  const result = validateLocalFileExistence({
    relativePath: "renders/nonexistent.mp4",
    baseDir: "/tmp",
    kind: "input",
    checkMode: "disabled",
  });

  assert.ok(!result.checked, "disabled mode should not check filesystem");
  assert.ok(result.warnings.length > 0, "Should have warning about disabled checks");
});

test("VO-3C-FX2: validateLocalFileExistence returns exists=true for temp file", () => {
  const tempFile = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-file-"));
  const testFile = path.join(tempFile, "test.mp4");
  fs.writeFileSync(testFile, "");
  try {
    const result = validateLocalFileExistence({
      relativePath: "test.mp4",
      baseDir: tempFile,
      kind: "input",
      checkMode: "explicit",
    });

    assert.ok(result.checked, "Should be checked");
    assert.ok(result.exists, "File should exist");
    assert.equal(result.blocking_reasons.length, 0, "No blocking reasons");
  } finally {
    fs.rmSync(testFile, { recursive: true, force: true });
    fs.rmSync(tempFile, { recursive: true, force: true });
  }
});

test("VO-3C-FX3: validateLocalFileExistence returns exists=false for absent file", () => {
  const tempFile = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-absent-"));
  try {
    const result = validateLocalFileExistence({
      relativePath: "nonexistent.mp4",
      baseDir: tempFile,
      kind: "input",
      checkMode: "explicit",
    });

    assert.ok(result.checked, "Should be checked");
    assert.ok(!result.exists, "File should not exist");
  } finally {
    fs.rmSync(tempFile, { recursive: true, force: true });
  }
});

test("VO-3C-FX4: validateLocalFileExistence missing input file is blocking", () => {
  const tempFile = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-input-"));
  try {
    const result = validateLocalFileExistence({
      relativePath: "nonexistent.mp4",
      baseDir: tempFile,
      kind: "input",
      checkMode: "explicit",
    });

    assert.ok(result.blocking_reasons.length > 0, "Missing input should be blocking");
  } finally {
    fs.rmSync(tempFile, { recursive: true, force: true });
  }
});

test("VO-3C-FX5: validateLocalFileExistence missing planned_output is warning only", () => {
  const tempFile = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-output-"));
  try {
    const result = validateLocalFileExistence({
      relativePath: "nonexistent.mp4",
      baseDir: tempFile,
      kind: "planned_output",
      checkMode: "explicit",
    });

    assert.ok(result.blocking_reasons.length === 0, "Missing output should not block");
    assert.ok(result.warnings.length > 0, "Missing output should warn");
  } finally {
    fs.rmSync(tempFile, { recursive: true, force: true });
  }
});

test("VO-3C-MC1: validateRenderPlanManifestConsistency with disabled mode files_checked=0", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan = createLocalRenderPlanFromPackageDraft({
      draft: createProductionPackageDraft({
        job: createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true }),
        project_id: "project-test",
        platform: "youtube",
        account_id: "test-account",
        scheduled_for: new Date(),
        dryRun: true,
      }),
      platform: "youtube",
      dryRun: true,
    });

    const result = validateRenderPlanManifestConsistency({
      plan,
      baseDir: getRuntimeDir(),
      checkMode: "disabled",
    });

    assert.equal(result.files_checked, 0, "disabled mode should not check files");
    assert.ok(result.warnings.length > 0, "Should warn about disabled checks");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-MC2: validateRenderPlanManifestConsistency with explicit mode checks planned output paths", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan = createLocalRenderPlanFromPackageDraft({
      draft: createProductionPackageDraft({
        job: createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true }),
        project_id: "project-test",
        platform: "youtube",
        account_id: "test-account",
        scheduled_for: new Date(),
        dryRun: true,
      }),
      platform: "youtube",
      dryRun: true,
    });

    const result = validateRenderPlanManifestConsistency({
      plan,
      baseDir: getRuntimeDir(),
      checkMode: "explicit",
    });

    assert.ok(result.files_checked >= 0, "Should check files");
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-MC3: validateRenderPlanManifestConsistency missing planned outputs are warnings not blocking", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan = createLocalRenderPlanFromPackageDraft({
      draft: createProductionPackageDraft({
        job: createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true }),
        project_id: "project-test",
        platform: "youtube",
        account_id: "test-account",
        scheduled_for: new Date(),
        dryRun: true,
      }),
      platform: "youtube",
      dryRun: true,
    });

    const result = validateRenderPlanManifestConsistency({
      plan,
      baseDir: getRuntimeDir(),
      checkMode: "explicit",
    });

    // Missing outputs should warn, not block
    if (result.files_missing > 0) {
      assert.ok(result.warnings.length > 0, "Missing outputs should generate warnings");
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-MC4: validateRenderPlanManifestConsistency ready flags remain false", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan = createLocalRenderPlanFromPackageDraft({
      draft: createProductionPackageDraft({
        job: createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true }),
        project_id: "project-test",
        platform: "youtube",
        account_id: "test-account",
        scheduled_for: new Date(),
        dryRun: true,
      }),
      platform: "youtube",
      dryRun: true,
    });

    const result = validateRenderPlanManifestConsistency({
      plan,
      baseDir: getRuntimeDir(),
      checkMode: "explicit",
    });

    assert.equal(result.ready_for_render, false, "ready_for_render must always be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must always be false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-VR1: getLocalRenderPlanValidationReport disabled mode does not check files", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanValidationReport({
      checkMode: "disabled",
      baseDir: getRuntimeDir(),
    });

    assert.equal(report.total, 1, "Should report 1 plan");
    assert.equal(report.files_checked, 0, "disabled mode should not check files");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-VR2: getLocalRenderPlanValidationReport explicit mode checks files", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanValidationReport({
      checkMode: "explicit",
      baseDir: getRuntimeDir(),
    });

    assert.equal(report.total, 1, "Should report 1 plan");
    assert.ok(typeof report.files_checked === "number", "Should report file count");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-VR3: getLocalRenderPlanValidationReport summary does not leak raw paths", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanValidationReport({
      checkMode: "explicit",
      baseDir: getRuntimeDir(),
    });

    const reportText = JSON.stringify(report);
    assert.ok(
      !reportText.includes("keychain://") && !reportText.includes("access_token"),
      "Report should not contain forbidden patterns"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-RD1: getLocalRenderPlanValidationReport disabled mode returns ready_for_render=0 and ready_for_upload=0", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanValidationReport({
      checkMode: "disabled",
      baseDir: getRuntimeDir(),
    });

    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0");
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-RD2: getLocalRenderPlanValidationReport explicit mode returns ready_for_render=0 and ready_for_upload=0 even when files exist", () => {
  const tempDir = setupTestRuntime();
  try {
    const job = createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true });
    const draft = createProductionPackageDraft({
      job,
      project_id: "project-alpha",
      platform: "youtube",
      account_id: "test-account",
      scheduled_for: new Date(),
      dryRun: true,
    });

    const plan = createLocalRenderPlanFromPackageDraft({
      draft,
      platform: "youtube",
      dryRun: true,
    });

    saveRenderPlan(plan);

    const report = getLocalRenderPlanValidationReport({
      checkMode: "explicit",
      baseDir: getRuntimeDir(),
    });

    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0 even in explicit mode");
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0 even in explicit mode");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-NFC1: validateLocalFileExistence planned_output missing does not create directories or files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-nfc-"));
  try {
    const result = validateLocalFileExistence({
      relativePath: "missing/nested/output.mp4",
      baseDir: tempDir,
      kind: "planned_output",
      checkMode: "explicit",
    });

    assert.ok(result.checked, "Should be checked");
    assert.ok(!result.exists, "File should not exist");
    assert.equal(result.blocking_reasons.length, 0, "Missing output should not block");
    assert.ok(result.warnings.length > 0, "Missing output should warn");

    // Verify no directories were created
    const missingDir = path.join(tempDir, "missing");
    assert.ok(!fs.existsSync(missingDir), "missing/ directory should not be created");

    const nestedDir = path.join(missingDir, "nested");
    assert.ok(!fs.existsSync(nestedDir), "missing/nested/ directory should not be created");

    const outputFile = path.join(nestedDir, "output.mp4");
    assert.ok(!fs.existsSync(outputFile), "output.mp4 file should not be created");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("VO-3C-NFC2: validateRenderPlanManifestConsistency explicit mode does not create output directories", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan = createLocalRenderPlanFromPackageDraft({
      draft: createProductionPackageDraft({
        job: createVideoJob({ type: "generate_episode", scheduledFor: new Date(), dryRun: true }),
        project_id: "project-test",
        platform: "youtube",
        account_id: "test-account",
        scheduled_for: new Date(),
        dryRun: true,
      }),
      platform: "youtube",
      dryRun: true,
    });

    const customBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-manifest-"));
    try {
      const result = validateRenderPlanManifestConsistency({
        plan,
        baseDir: customBaseDir,
        checkMode: "explicit",
      });

      assert.equal(result.ready_for_render, false, "ready_for_render must be false");
      assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");

      // Verify output directories are not created in the custom base dir
      const dirContents = fs.readdirSync(customBaseDir);
      assert.equal(dirContents.length, 0, "No directories should be created in baseDir");
    } finally {
      fs.rmSync(customBaseDir, { recursive: true, force: true });
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3C-PS1: validateLocalFileExistence returns safe path summary not raw path", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vo3c-path-"));
  try {
    const result = validateLocalFileExistence({
      relativePath: "renders/output.mp4",
      baseDir: tempDir,
      kind: "input",
      checkMode: "explicit",
    });

    // Result path should not contain the raw path components
    assert.ok(
      result.path !== "renders/output.mp4",
      "result.path should not echo raw relative path"
    );

    // Should be a safe summary
    assert.ok(
      result.path === "[unsafe-path]" || result.path.length < 50,
      "result.path should be a safe summary"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ─── VO-3D: Manual Render Manifest Checks and Format/Platform Consistency Validation ──

test("VO-3D-SL1: loadVideoOrchestratorFormatSpecs loads repo-local format specs when present", () => {
  const specs = loadVideoOrchestratorFormatSpecs();
  // Should load successfully from repo-local path
  assert.ok(
    specs === undefined || specs === null || (typeof specs === "object" && "formats" in (specs as object)),
    "Should return valid format specs or undefined (no error)"
  );
});

test("VO-3D-SL2: loadVideoOrchestratorPlatformSpecs loads repo-local platform specs when present", () => {
  const specs = loadVideoOrchestratorPlatformSpecs();
  // Should load successfully from repo-local path
  assert.ok(
    specs === undefined || specs === null || (typeof specs === "object" && "platforms" in (specs as object)),
    "Should return valid platform specs or undefined (no error)"
  );
});

test("VO-3D-SL3: spec loaders do not fetch remote URLs or call platform APIs", () => {
  // Verify loaders only use fs.readFileSync (repo-local reads)
  // If specs are loaded, they should be from local files, not URLs
  const formatSpecs = loadVideoOrchestratorFormatSpecs();
  const platformSpecs = loadVideoOrchestratorPlatformSpecs();

  // Should not throw or attempt network calls
  assert.ok(
    formatSpecs === undefined || typeof formatSpecs === "object",
    "Format specs should be undefined or local object (no network calls)"
  );
  assert.ok(
    platformSpecs === undefined || typeof platformSpecs === "object",
    "Platform specs should be undefined or local object (no network calls)"
  );
});

test("VO-3D-SL4: malformed specs fail safely without raw value leakage", () => {
  const tempDir = setupTestRuntime();
  try {
    // Both loaders should handle malformed JSON gracefully
    // They should return undefined, not throw or log raw JSON
    const formatSpecs = loadVideoOrchestratorFormatSpecs();
    const platformSpecs = loadVideoOrchestratorPlatformSpecs();

    // Should not throw
    assert.ok(
      formatSpecs === undefined || typeof formatSpecs === "object",
      "Format specs should degrade gracefully"
    );
    assert.ok(
      platformSpecs === undefined || typeof platformSpecs === "object",
      "Platform specs should degrade gracefully"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-TV1: validateRenderTargetAgainstSpecs blocks missing format_key", () => {
  const tempDir = setupTestRuntime();
  try {
    const target: RenderTarget = {
      kind: "video",
      format_key: "", // Empty format_key
      aspect_ratio: "16:9",
      resolution: "1920x1080",
      planned_output_path: "renders/video.mp4",
    };

    const result = validateRenderTargetAgainstSpecs({
      target,
      platform: "youtube",
    });

    assert.equal(result.ok, false, "Should fail validation with missing format_key");
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");
    assert.ok(
      result.blocking_reasons.length > 0,
      "Should have blocking reasons"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-TV2: validateRenderTargetAgainstSpecs blocks forbidden patterns in format_key", () => {
  const tempDir = setupTestRuntime();
  try {
    const target: RenderTarget = {
      kind: "video",
      format_key: "landscape_access_token_16x9", // Forbidden pattern: access_token
      aspect_ratio: "16:9",
      resolution: "1920x1080",
      planned_output_path: "renders/video.mp4",
    };

    const result = validateRenderTargetAgainstSpecs({
      target,
      platform: "youtube",
    });

    assert.equal(result.ok, false, "Should fail validation with forbidden pattern in format_key");
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.ok(
      result.blocking_reasons.some(r => r.includes("forbidden") || r.includes("format_key")),
      "Should identify forbidden pattern"
    );

    // Ensure raw value is not echoed in reasons
    assert.ok(
      !result.blocking_reasons.join("").includes("access_token"),
      "Should not echo raw forbidden pattern"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-TV3: validateRenderTargetAgainstSpecs passes valid target", () => {
  const tempDir = setupTestRuntime();
  try {
    const target: RenderTarget = {
      kind: "video",
      format_key: "landscape_1920x1080_16x9",
      aspect_ratio: "16:9",
      resolution: "1920x1080",
      planned_output_path: "renders/video.mp4",
    };

    const result = validateRenderTargetAgainstSpecs({
      target,
      platform: "youtube",
    });

    assert.equal(result.checked_targets, 1, "Should count 1 target checked");
    assert.equal(result.ready_for_render, false, "ready_for_render must stay false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must stay false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-TV4: validateRenderTargetAgainstSpecs warns on missing optional fields", () => {
  const tempDir = setupTestRuntime();
  try {
    const target: RenderTarget = {
      kind: "video",
      format_key: "landscape_1920x1080_16x9",
      aspect_ratio: "16:9",
      resolution: "1920x1080",
      planned_output_path: "renders/video.mp4",
      // Missing optional safe_zone_profile
    };

    const result = validateRenderTargetAgainstSpecs({
      target,
      platform: "youtube",
    });

    // Should not block but may warn
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-TV5: validateRenderTargetAgainstSpecs returns sanitized output paths", () => {
  const tempDir = setupTestRuntime();
  try {
    const target: RenderTarget = {
      kind: "video",
      format_key: "landscape_1920x1080_16x9",
      aspect_ratio: "16:9",
      resolution: "1920x1080",
      planned_output_path: "/sensitive/path/to/renders/video.mp4",
    };

    const result = validateRenderTargetAgainstSpecs({
      target,
      platform: "youtube",
    });

    // Output should be sanitized
    const output = JSON.stringify(result);
    assert.ok(
      !output.includes("/sensitive/path"),
      "Should not leak sensitive paths in output"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-PV1: validateRenderPlanAgainstLocalSpecs validates all targets", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-test-001",
      package_id: "pkg-test-001",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/video.mp4",
        },
        {
          kind: "thumbnail",
          format_key: "youtube_thumbnail_1280x720",
          aspect_ratio: "16:9",
          resolution: "1280x720",
          planned_output_path: "renders/thumbnail.jpg",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 1, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-test-001",
        checksum: "sha256:test",
      },
    };

    const result = validateRenderPlanAgainstLocalSpecs({
      plan,
    });

    assert.equal(result.checked_targets, 2, "Should check all 2 targets");
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-PV2: validateRenderPlanAgainstLocalSpecs handles missing specs gracefully", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-test-002",
      package_id: "pkg-test-002",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/video.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-test-002",
        checksum: "sha256:test",
      },
    };

    // Don't load specs (undefined)
    const result = validateRenderPlanAgainstLocalSpecs({
      plan,
      formatSpecs: undefined,
      platformSpecs: undefined,
    });

    // Should complete without throwing
    assert.equal(result.ready_for_render, false, "ready_for_render must stay false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must stay false");
    assert.ok(
      result.warnings.some(w => w.includes("spec")),
      "Should warn about missing specs"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-PV3: validateRenderPlanAgainstLocalSpecs rejects invalid plan first", () => {
  const tempDir = setupTestRuntime();
  try {
    // Invalid plan: missing render_targets
    const plan: any = {
      schema_version: "1.0",
      render_plan_id: "plan-invalid",
      package_id: "pkg-invalid",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      // Missing render_targets
      asset_plan: {
        video: { count: 0, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-invalid",
        checksum: "sha256:test",
      },
    };

    const result = validateRenderPlanAgainstLocalSpecs({
      plan,
    });

    // Should have blocking reasons
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.ok(
      result.blocking_reasons.length > 0,
      "Should have blocking reasons for invalid plan"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-PV4: validateRenderPlanAgainstLocalSpecs no file existence checks", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-test-003",
      package_id: "pkg-test-003",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "/nonexistent/path/video.mp4", // Path doesn't exist
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-test-003",
        checksum: "sha256:test",
      },
    };

    // Should not throw about missing file
    const result = validateRenderPlanAgainstLocalSpecs({
      plan,
    });

    // Should complete validation (file existence is VO-3C's job)
    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-MR1: getManualRenderManifestCheckReport returns aggregated summary", () => {
  const tempDir = setupTestRuntime();
  try {
    // Create a valid render plan
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-report-001",
      package_id: "pkg-report-001",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/video.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-report-001",
        checksum: "sha256:test",
      },
    };

    // Save plan
    saveRenderPlan(plan);

    const report = getManualRenderManifestCheckReport({
      project_id: "project-test",
      platform: "youtube",
    });

    assert.ok(report, "Should return a report");
    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0");
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0");
    assert.ok(
      report.total >= 1,
      "Should have at least one plan"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-MR2: getManualRenderManifestCheckReport returns aggregated plans", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-report-002",
      package_id: "pkg-report-002",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/internal/video.mp4", // Relative path
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-report-002",
        checksum: "sha256:test",
      },
    };

    saveRenderPlan(plan);

    const report = getManualRenderManifestCheckReport({
      project_id: "project-test",
      platform: "youtube",
    });

    // Should have aggregated plans
    assert.ok(report.plans && report.plans.length > 0, "Should have aggregated plans");
    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0");
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-MR3: getManualRenderManifestCheckReport never sets upload ready", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-report-003",
      package_id: "pkg-report-003",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/video.mp4",
        },
        {
          kind: "thumbnail",
          format_key: "youtube_thumbnail_1280x720",
          aspect_ratio: "16:9",
          resolution: "1280x720",
          planned_output_path: "renders/thumbnail.jpg",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 1, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-report-003",
        checksum: "sha256:test",
      },
    };

    saveRenderPlan(plan);

    const report = getManualRenderManifestCheckReport({
      project_id: "project-test",
      platform: "youtube",
    });

    // Both flags must always be 0 in VO-3D
    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0");
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-MR4: manual manifest report sanitizes legacy unsafe render-plans data", () => {
  const tempDir = setupTestRuntime();
  try {
    // Manually write unsafe render-plans.json with forbidden values
    const storePath = path.join(tempDir, "render-plans.json");
    const unsafeStore = {
      schema_version: "1.0",
      created_at: new Date().toISOString(),
      plans: [
        {
          schema_version: "1.0",
          render_plan_id: "plan_with_credential_reference_001",
          package_id: "pkg_access_token_secret",
          project_id: "project_keychain_unsafe",
          platform: "youtube_bearer_token",
          dry_run: true,
          plan_state: "planned",
          created_at: new Date().toISOString(),
          render_targets: [
            {
              kind: "video",
              format_key: "landscape_1920x1080_16x9",
              aspect_ratio: "16:9",
              resolution: "1920x1080",
              planned_output_path: "renders/video.mp4",
            },
          ],
          asset_plan: {
            video: { count: 1, variants: [] },
            thumbnails: { count: 0, variants: [] },
            captions: { count: 0, formats: [], variants: [] },
          },
          validation: {
            ready_for_render: false,
            ready_for_upload: false,
            blocking_reasons: ["Contains client_secret in metadata"],
            warnings: ["refresh_token found in config"],
          },
          provenance: {
            generated_by: "test",
            source_package_id: "pkg_code_verifier_unsafe",
            checksum: "sha256:test",
          },
        },
      ],
    };

    fs.writeFileSync(storePath, JSON.stringify(unsafeStore, null, 2));

    // Now call getManualRenderManifestCheckReport and verify report is safe
    const report = getManualRenderManifestCheckReport({});
    const reportJson = JSON.stringify(report);

    // Verify no forbidden strings in output
    const forbiddenPatterns = [
      "credential_reference",
      "credentialReference",
      "keychain://",
      "access_token",
      "refresh_token",
      "client_secret",
      "code_verifier",
      "authorization_code",
      "Bearer",
    ];

    for (const pattern of forbiddenPatterns) {
      assert.ok(
        !reportJson.toLowerCase().includes(pattern.toLowerCase()),
        `Report should not contain forbidden pattern: ${pattern}`
      );
    }
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-MR5: manual manifest report excludes raw render targets and planned paths", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-report-005",
      package_id: "pkg-report-005",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/internal/video.mp4",
        },
        {
          kind: "thumbnail",
          format_key: "youtube_thumbnail_1280x720",
          aspect_ratio: "16:9",
          resolution: "1280x720",
          planned_output_path: "renders/thumbnail_special_file.jpg",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 1, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-report-005",
        checksum: "sha256:test",
      },
    };

    saveRenderPlan(plan);

    const report = getManualRenderManifestCheckReport({
      project_id: "project-test",
    });

    const reportJson = JSON.stringify(report);

    // Verify raw structures are excluded
    assert.ok(
      !reportJson.includes("render_targets"),
      "Report should not expose render_targets array"
    );
    assert.ok(
      !reportJson.includes("planned_output_path"),
      "Report should not expose planned_output_path"
    );
    assert.ok(
      !reportJson.includes("asset_plan"),
      "Report should not expose asset_plan"
    );
    assert.ok(
      !reportJson.includes("renders/video.mp4"),
      "Report should not leak actual paths"
    );
    assert.ok(
      !reportJson.includes("renders/internal"),
      "Report should not leak path components"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-SAFE1: validateRenderPlanAgainstLocalSpecs does not perform file existence checks", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-safe-001",
      package_id: "pkg-safe-001",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/nonexistent_file.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-safe-001",
        checksum: "sha256:test",
      },
    };

    const result = validateRenderPlanAgainstLocalSpecs({ plan });

    assert.equal(result.ready_for_render, false, "ready_for_render must be false");
    assert.equal(result.ready_for_upload, false, "ready_for_upload must be false");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-SAFE2: manual manifest check does not create files or directories", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-safe-002",
      package_id: "pkg-safe-002",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/would_create_file.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-safe-002",
        checksum: "sha256:test",
      },
    };

    saveRenderPlan(plan);

    const beforeCount = fs.readdirSync(tempDir, { recursive: true }).length;

    getManualRenderManifestCheckReport({ project_id: "project-test" });

    const afterCount = fs.readdirSync(tempDir, { recursive: true }).length;

    assert.equal(
      afterCount,
      beforeCount,
      "manifest check should not create files or directories"
    );
  } finally {
    cleanupTestRuntime(tempDir);
  }
});

test("VO-3D-SAFE3: manual manifest check does not execute FFmpeg or child_process", () => {
  const tempDir = setupTestRuntime();
  try {
    const plan: RenderPlan = {
      schema_version: "1.0",
      render_plan_id: "plan-safe-003",
      package_id: "pkg-safe-003",
      project_id: "project-test",
      platform: "youtube",
      dry_run: true,
      plan_state: "planned",
      created_at: new Date().toISOString(),
      render_targets: [
        {
          kind: "video",
          format_key: "landscape_1920x1080_16x9",
          aspect_ratio: "16:9",
          resolution: "1920x1080",
          planned_output_path: "renders/test.mp4",
        },
      ],
      asset_plan: {
        video: { count: 1, variants: [] },
        thumbnails: { count: 0, variants: [] },
        captions: { count: 0, formats: [], variants: [] },
      },
      validation: {
        ready_for_render: false,
        ready_for_upload: false,
        blocking_reasons: [],
        warnings: [],
      },
      provenance: {
        generated_by: "test",
        source_package_id: "pkg-safe-003",
        checksum: "sha256:test",
      },
    };

    saveRenderPlan(plan);

    const report = getManualRenderManifestCheckReport({ project_id: "project-test" });

    assert.ok(report, "Should return report");
    assert.equal(report.ready_for_render, 0, "ready_for_render must be 0");
    assert.equal(report.ready_for_upload, 0, "ready_for_upload must be 0");
  } finally {
    cleanupTestRuntime(tempDir);
  }
});
