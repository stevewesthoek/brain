import { test } from "node:test";
import assert from "node:assert";
import {
  createDisabledVideoOrchestratorRuntimeActivationResult,
  revokeDisabledVideoOrchestratorRuntimeActivationResult,
  type VideoOrchestratorRuntimeActivationInput,
} from "./video-orchestrator-runtime-activation-entrypoint.js";

const INPUT: VideoOrchestratorRuntimeActivationInput = {
  request_id: "runtime-activation-request-001",
  project_id: "project-001",
  render_plan_id: "render-plan-001",
  platform: "youtube",
  operator_approval_id: "operator-approval-001",
  dry_run: true,
  runtime_enabled: false,
};

test("VO-7BS-RUNTIME-ENTRYPOINT-1: disabled runtime entrypoint never invokes runtime or upload behavior", () => {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult(INPUT);

  assert.equal(result.schema_version, "1.0");
  assert.equal(result.entrypoint_state, "disabled");
  assert.equal(result.runtime_entrypoint_defined, true);
  assert.equal(result.runtime_invoked, false);
  assert.equal(result.upload_executed, false);
  assert.equal(result.platform_api_called, false);
  assert.equal(result.network_called, false);
  assert.equal(result.credentials_accessed, false);
  assert.equal(result.token_accessed, false);
  assert.equal(result.keychain_accessed, false);
  assert.equal(result.env_accessed, false);
  assert.equal(result.media_read, false);
  assert.equal(result.contains_runtime_callable, false);
  assert.equal(result.contains_raw_payload, false);
  assert.equal(result.contains_raw_response, false);
  assert.equal(result.contains_secret_material, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_next_phase, false);
  assert.equal(result.validation.ready_for_real_upload, false);
  for (const value of Object.values(result.execution_boundary)) assert.equal(value, false);
});

test("VO-7BS-RUNTIME-ENTRYPOINT-2: unsafe strings are sanitized", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const result = createDisabledVideoOrchestratorRuntimeActivationResult({ ...INPUT, request_id: unsafe, project_id: unsafe, render_plan_id: unsafe, platform: unsafe, operator_approval_id: unsafe }, { safe_summary: unsafe, warnings: [unsafe] });
  const serialized = JSON.stringify(result);

  for (const blocked of ["https://example.com", "access_token", "client_secret", "videos.insert", "fetch(", "../unsafe"]) {
    assert.equal(serialized.includes(blocked), false);
  }
});

test("VO-7BS-RUNTIME-ENTRYPOINT-3: revoked disabled result remains disabled", () => {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult(INPUT);
  const revoked = revokeDisabledVideoOrchestratorRuntimeActivationResult(result, "Operator revoked disabled runtime entrypoint.");

  assert.equal(revoked.entrypoint_state, "revoked");
  assert.equal(revoked.runtime_invoked, false);
  assert.equal(revoked.upload_executed, false);
  assert.equal(revoked.platform_api_called, false);
  assert.equal(revoked.network_called, false);
  assert.equal(revoked.credentials_accessed, false);
  assert.equal(revoked.media_read, false);
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.ready_for_next_phase, false);
  assert.equal(revoked.validation.ready_for_real_upload, false);
  for (const value of Object.values(revoked.execution_boundary)) assert.equal(value, false);
});
