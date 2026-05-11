import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseSchedulerArgs, type SchedulerArgs } from "./video-orchestrator-scheduler-args.js";

test("CLI: parseSchedulerArgs supports --key=value format", () => {
  const args: SchedulerArgs = parseSchedulerArgs(["--dry-run=true", "--max-jobs=3", "--episode-count=2"]);
  assert.equal(args["dry-run"], true);
  assert.equal(args["max-jobs"], "3");
  assert.equal(args["episode-count"], "2");
});

test("CLI: parseSchedulerArgs supports --key value format", () => {
  const args: SchedulerArgs = parseSchedulerArgs(["--dry-run", "false", "--max-jobs", "5"]);
  assert.equal(args["dry-run"], false);
  assert.equal(args["max-jobs"], "5");
});

test("CLI: parseSchedulerArgs handles mixed formats", () => {
  const args: SchedulerArgs = parseSchedulerArgs(["--dry-run=true", "--max-jobs", "2", "--status=scheduled"]);
  assert.equal(args["dry-run"], true);
  assert.equal(args["max-jobs"], "2");
  assert.equal(args["status"], "scheduled");
});

test("CLI: parseSchedulerArgs handles flags without values", () => {
  const args: SchedulerArgs = parseSchedulerArgs(["--verbose", "--debug"]);
  assert.equal(args["verbose"], true);
  assert.equal(args["debug"], true);
});

test("CLI: parseSchedulerArgs converts boolean strings", () => {
  const args: SchedulerArgs = parseSchedulerArgs(["--dry-run=true", "--enabled=false"]);
  assert.equal(args["dry-run"], true, "true string should convert to boolean");
  assert.equal(args["enabled"], false, "false string should convert to boolean");
});

test("CLI: parser import causes no side effects on job/quota/log files", () => {
  // Create a temp runtime dir for this test
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "probot-parser-test-"));
  process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR = tempDir;

  try {
    // Verify that importing and using parser does not create any files
    const jobsPath = path.join(tempDir, "jobs.json");
    const quotaPath = path.join(tempDir, "quota.json");
    const logPath = path.join(tempDir, "scheduler.log");

    assert.ok(!fs.existsSync(jobsPath), "jobs.json should not exist after parser import");
    assert.ok(!fs.existsSync(quotaPath), "quota.json should not exist after parser import");
    assert.ok(!fs.existsSync(logPath), "scheduler.log should not exist after parser import");

    // Parse some args to ensure the parser ran
    const args = parseSchedulerArgs(["--dry-run=true"]);
    assert.equal(args["dry-run"], true, "Parser should have executed");

    // Verify files still don't exist after parsing
    assert.ok(!fs.existsSync(jobsPath), "jobs.json should not exist after parsing");
    assert.ok(!fs.existsSync(quotaPath), "quota.json should not exist after parsing");
    assert.ok(!fs.existsSync(logPath), "scheduler.log should not exist after parsing");
  } finally {
    delete process.env.PROBOT_VIDEO_ORCHESTRATOR_RUNTIME_DIR;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }
});
