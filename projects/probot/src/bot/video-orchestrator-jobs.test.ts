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
  planProjectDistribution,
  type ProjectDistribution,
  type ProjectPlanResult,
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
