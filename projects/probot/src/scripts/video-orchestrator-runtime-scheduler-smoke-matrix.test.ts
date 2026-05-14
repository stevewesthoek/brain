import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerSmokeMatrix, renderRuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";

test("VO-7FH-RUNTIME-SCHEDULER-SMOKE-MATRIX-1: defines safe smoke rows without executing commands", () => {
  const matrix = createRuntimeSchedulerSmokeMatrix();

  assert.equal(matrix.schema_version, "1.0");
  assert.equal(matrix.matrix_only, true);
  assert.equal(matrix.rows.length, 5);
  assert.equal(matrix.rows.some((row) => row.command === "summary"), true);
  assert.equal(matrix.rows.some((row) => row.command === "unsafe-flags"), true);
  assert.equal(matrix.safety.commands_executed, false);
  assert.equal(matrix.safety.package_json_edited, false);
  assert.equal(matrix.safety.live_scheduler_executed, false);
  assert.equal(matrix.safety.upload_executed, false);
  assert.equal(matrix.safety.network_calls_made, false);
  assert.equal(matrix.safety.credential_accessed, false);
  assert.equal(matrix.safety.media_read_performed, false);
  assert.equal(matrix.safety.files_written, false);
  assert.equal(matrix.safety.git_add_executed, false);
  assert.equal(matrix.safety.committed_now, false);
  assert.equal(matrix.safety.pushed_now, false);
});

test("VO-7FH-RUNTIME-SCHEDULER-SMOKE-MATRIX-2: every row keeps dangerous side effects disabled", () => {
  const matrix = createRuntimeSchedulerSmokeMatrix();

  for (const row of matrix.rows) {
    assert.equal(row.live_scheduler_expected, false);
    assert.equal(row.upload_expected, false);
    assert.equal(row.network_expected, false);
    assert.equal(row.credential_access_expected, false);
    assert.equal(row.media_read_expected, false);
    assert.equal(row.file_write_expected, false);
    assert.equal(row.expected_output_excludes.includes("access_token"), true);
    assert.equal(row.expected_output_excludes.includes("client_secret"), true);
    assert.equal(row.expected_output_excludes.includes("api_key"), true);
  }
});

test("VO-7FI-RUNTIME-SCHEDULER-SMOKE-MATRIX-REVIEW-1: rendered smoke matrix is safe", () => {
  const text = renderRuntimeSchedulerSmokeMatrix(createRuntimeSchedulerSmokeMatrix());

  assert.equal(text.includes("Video Orchestrator runtime scheduler smoke matrix"), true);
  assert.equal(text.includes("node src/scripts/video-orchestrator-runtime-scheduler.mjs summary"), true);
  assert.equal(text.includes("commands are not executed"), true);
  assert.equal(text.includes("access_token"), false);
  assert.equal(text.includes("client_secret"), false);
  assert.equal(text.includes("api_key"), false);
});
