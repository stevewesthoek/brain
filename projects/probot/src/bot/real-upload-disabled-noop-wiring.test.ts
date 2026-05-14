import { test } from "node:test";
import assert from "node:assert";
import {
  createRealUploadDisabledNoopWiringActivationResult,
  createRealUploadNoopWiringSmokeTestResult,
  revokeRealUploadDisabledNoopWiringActivationResult,
  revokeRealUploadNoopWiringSmokeTestResult,
  sanitizeSafeSummary,
} from "./real-upload-disabled-noop-wiring.js";
import type { DisabledNoopExecutionBoundary, RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

function assertDisabledBoundary(boundary: DisabledNoopExecutionBoundary) {
  assert.equal(boundary.runtime_enabled, false);
  assert.equal(boundary.runtime_executed, false);
  assert.equal(boundary.upload_allowed, false);
  assert.equal(boundary.upload_execution_enabled, false);
  assert.equal(boundary.platform_api_calls_allowed, false);
  assert.equal(boundary.network_calls_allowed, false);
  assert.equal(boundary.credentials_accessed, false);
  assert.equal(boundary.token_accessed, false);
  assert.equal(boundary.keychain_accessed, false);
  assert.equal(boundary.env_accessed, false);
  assert.equal(boundary.media_file_read, false);
  assert.equal(boundary.file_mutation_allowed, false);
  assert.equal(boundary.dependencies_added, false);
  assert.equal(boundary.package_metadata_changed, false);
  assert.equal(boundary.ready_for_real_upload, false);
}

test("VO-7AB-ACTIVATION-1: activation result records disabled no-op state only", () => {
  const result = createRealUploadDisabledNoopWiringActivationResult(PLAN, {
    id: "activation-result-001",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_summary: "Disabled no-op wiring activation recorded for future smoke tests.",
  });

  assert.equal(result.schema_version, "1.0");
  assert.equal(result.activation_result_state, "disabled_noop_activation_recorded");
  assert.equal(result.activation_scope.disabled_noop_activation_only, true);
  assert.equal(result.activation_scope.activation_recorded, true);
  assert.equal(result.activation_scope.activation_applied_to_runtime, false);
  assert.equal(result.activation_scope.runtime_feature_flag_created, false);
  assert.equal(result.activation_scope.runtime_feature_flag_enabled, false);
  assert.equal(result.activation_scope.production_imports_applied, false);
  assert.equal(result.activation_scope.automatic_invocation_enabled, false);
  assert.equal(result.activation_scope.live_execution_path_changed, false);
  assert.equal(result.activation_scope.upload_execution_path_changed, false);
  assert.equal(result.activation_scope.real_upload_requested, false);
  assert.equal(result.validation.disabled_noop_wiring_activation_complete, true);
  assert.equal(result.validation.ready_for_future_noop_wiring_smoke_test, true);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7AB-ACTIVATION-2: blocked activation never becomes smoke-test ready", () => {
  const result = createRealUploadDisabledNoopWiringActivationResult(PLAN, {
    prerequisites_validated: false,
  });

  assert.equal(result.activation_result_state, "blocked");
  assert.equal(result.activation_scope.activation_recorded, false);
  assert.equal(result.disabled_activation_summary.noop_wiring_available_for_future_tests, false);
  assert.equal(result.validation.disabled_noop_wiring_activation_complete, false);
  assert.equal(result.validation.ready_for_future_noop_wiring_smoke_test, false);
  assert.equal(result.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7AB-ACTIVATION-3: smoke test passes only disabled no-op checks without invoking runtime paths", () => {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation, {
    id: "smoke-result-001",
    check_kinds: ["disabled_import_boundary", "disabled_upload_boundary"],
  });

  assert.equal(smoke.schema_version, "1.0");
  assert.equal(smoke.smoke_test_state, "passed_noop_disabled");
  assert.equal(smoke.smoke_test_scope.noop_smoke_test_only, true);
  assert.equal(smoke.smoke_test_scope.runtime_invoked, false);
  assert.equal(smoke.smoke_test_scope.production_path_invoked, false);
  assert.equal(smoke.smoke_test_scope.upload_invoked, false);
  assert.equal(smoke.smoke_test_scope.network_invoked, false);
  assert.equal(smoke.smoke_test_scope.platform_api_invoked, false);
  assert.equal(smoke.smoke_test_scope.credentials_accessed, false);
  assert.equal(smoke.smoke_test_scope.media_file_read, false);
  assert.equal(smoke.smoke_test_scope.file_mutation_allowed, false);
  assert.equal(smoke.noop_wiring_checks.length, 2);

  for (const check of smoke.noop_wiring_checks) {
    assert.equal(check.check_state, "passed");
    assert.equal(check.runtime_invoked, false);
    assert.equal(check.upload_invoked, false);
    assert.equal(check.network_invoked, false);
    assert.equal(check.credential_invoked, false);
    assert.equal(check.media_read_invoked, false);
    assert.equal(check.file_mutation_invoked, false);
  }

  assert.equal(smoke.validation.noop_wiring_smoke_test_complete, true);
  assert.equal(smoke.validation.ready_for_future_real_upload_readiness_gate_v2, true);
  assert.equal(smoke.validation.ready_for_real_upload, false);
  assertDisabledBoundary(smoke.execution_boundary);
});

test("VO-7AB-ACTIVATION-4: smoke test blocks when activation result is not ready", () => {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, {
    prerequisites_validated: false,
  });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);

  assert.equal(smoke.smoke_test_state, "blocked");
  assert.equal(smoke.validation.noop_wiring_smoke_test_complete, false);
  assert.equal(smoke.validation.ready_for_future_real_upload_readiness_gate_v2, false);
  assert.equal(smoke.validation.ready_for_real_upload, false);
  assert.equal(smoke.validation.blocking_reasons.length > 0, true);
  assert.equal(smoke.noop_wiring_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(smoke.execution_boundary);
});

test("VO-7AB-ACTIVATION-5: sanitization removes unsafe credential, network, path, and payload hints", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const sanitized = sanitizeSafeSummary(unsafe, "safe fallback");
  assert.equal(sanitized, "safe fallback");

  const result = createRealUploadDisabledNoopWiringActivationResult(
    {
      ...PLAN,
      platform: "https://example.com/unsafe-platform",
    },
    { safe_summary: unsafe },
  );
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
});

test("VO-7AB-ACTIVATION-6: revocation keeps all execution boundaries disabled", () => {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const revokedActivation = revokeRealUploadDisabledNoopWiringActivationResult(activation, "Operator revoked disabled activation record.");
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const revokedSmoke = revokeRealUploadNoopWiringSmokeTestResult(smoke, "Operator revoked smoke test record.");

  assert.equal(revokedActivation.activation_result_state, "revoked");
  assert.equal(revokedActivation.validation.ready_for_future_noop_wiring_smoke_test, false);
  assertDisabledBoundary(revokedActivation.execution_boundary);

  assert.equal(revokedSmoke.smoke_test_state, "revoked");
  assert.equal(revokedSmoke.validation.noop_wiring_smoke_test_complete, false);
  assert.equal(revokedSmoke.validation.ready_for_future_real_upload_readiness_gate_v2, false);
  assert.equal(revokedSmoke.noop_wiring_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(revokedSmoke.execution_boundary);
});
