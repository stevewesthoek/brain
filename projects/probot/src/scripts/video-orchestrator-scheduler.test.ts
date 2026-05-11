import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseSchedulerArgs, type SchedulerArgs } from "./video-orchestrator-scheduler-args.js";
import { resolveProjectDistributionFilePath } from "./video-orchestrator-project-scheduler-paths.js";

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

// Path resolver tests
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const exampleFile = "operations/specs/video-orchestrator/examples/project-distribution.example.json";
const absoluteExamplePath = path.resolve(repoRoot, exampleFile);

test("Path resolver: resolves absolute path when it exists", () => {
  const result = resolveProjectDistributionFilePath(absoluteExamplePath);
  assert.strictEqual(result, absoluteExamplePath);
  assert.ok(fs.existsSync(result), "resolved path should exist");
});

test("Path resolver (VO-2B-H1-regression-1): from repo root cwd with repo-relative path", () => {
  const originalCwd = process.cwd();
  try {
    process.chdir(repoRoot);
    // Exact command: npm run probot:video:plan-projects -- --dry-run=true --file operations/specs/...
    const result = resolveProjectDistributionFilePath(exampleFile);
    assert.ok(fs.existsSync(result), "resolved path should exist");
    assert.ok(result.includes("project-distribution.example.json"));
  } finally {
    process.chdir(originalCwd);
  }
});

test("Path resolver (VO-2B-H1-regression-2): from projects/probot cwd with ../../ relative path", () => {
  const originalCwd = process.cwd();
  try {
    const probotRoot = path.join(repoRoot, "projects", "probot");
    process.chdir(probotRoot);
    // Exact command: cd projects/probot && npm run probot:video:plan-projects -- --dry-run=true --file ../../operations/specs/...
    const relativeFromProbot = "../../operations/specs/video-orchestrator/examples/project-distribution.example.json";
    const result = resolveProjectDistributionFilePath(relativeFromProbot);
    assert.ok(fs.existsSync(result), "resolved path should exist");
    assert.ok(result.includes("project-distribution.example.json"));
  } finally {
    process.chdir(originalCwd);
  }
});

test("Path resolver (VO-2B-H1-regression-3): from arbitrary cwd falls back to repo-root", () => {
  const originalCwd = process.cwd();
  try {
    // Change to tmpdir (arbitrary cwd, not repo-root, not projects/probot)
    process.chdir(os.tmpdir());
    // Path should resolve via repo-root fallback, not cwd
    const result = resolveProjectDistributionFilePath(exampleFile);
    assert.ok(fs.existsSync(result), "resolved path should exist via repo-root fallback");
    assert.ok(result.includes("project-distribution.example.json"));
  } finally {
    process.chdir(originalCwd);
  }
});

test("Path resolver: throws error when absolute path does not exist", () => {
  const nonexistent = "/nonexistent/path/to/file-does-not-exist.json";
  assert.throws(
    () => resolveProjectDistributionFilePath(nonexistent),
    (err: any) => {
      assert.ok(
        err.message.includes("Absolute path not found"),
        "error should mention absolute path"
      );
      return true;
    }
  );
});

test("Path resolver (VO-2B-H1-regression-4): error lists cwdPath, repoPath, probotPath safely", () => {
  const originalCwd = process.cwd();
  try {
    process.chdir(repoRoot);
    const missingFile = "does-not-exist-anywhere-xyz-123.json";
    assert.throws(
      () => resolveProjectDistributionFilePath(missingFile),
      (err: any) => {
        const message = err.message;
        assert.ok(
          message.includes("File not found"),
          "error should mention file not found"
        );
        assert.ok(
          message.includes("Attempted paths"),
          "error should list attempted paths"
        );
        // Verify paths are listed with bullet format
        assert.ok(
          message.includes("  -"),
          "error should list attempted paths with bullet format"
        );
        // Verify no env vars or secrets are leaked
        assert.ok(
          !message.includes("process.env"),
          "error should not contain process.env"
        );
        assert.ok(
          !message.includes("access_token"),
          "error should not contain access_token"
        );
        assert.ok(
          !message.includes("refresh_token"),
          "error should not contain refresh_token"
        );
        assert.ok(
          !message.includes("secret"),
          "error should not contain secret"
        );
        assert.ok(
          !message.includes("password"),
          "error should not contain password"
        );
        return true;
      }
    );
  } finally {
    process.chdir(originalCwd);
  }
});
