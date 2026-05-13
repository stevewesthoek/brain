import { test } from "node:test";
import assert from "node:assert";
import {
  REAL_UPLOAD_NOOP_STUB_FILE_KINDS,
  createAllRealUploadNoopStubResults,
  createRealUploadNoopStubResult,
  credentialProviderNoopStub,
  mediaReferenceResolverNoopStub,
  platformAdapterNoopStub,
  payloadBuilderNoopStub,
  networkClientNoopStub,
  uploadExecutorNoopStub,
  retryIdempotencyNoopStub,
  rollbackNoopStub,
  postUploadVerificationNoopStub,
  auditEventNoopStub,
  operatorConfirmationNoopStub,
  emergencyStopNoopStub,
  statusReporterNoopStub,
  uploadScaffoldIndexNoopStub,
} from "./real-upload-noop-stubs.js";
import type { RealUploadNoopStubResult } from "./real-upload-noop-stubs.js";

const REQUIRED_KINDS = [
  "credential_provider_noop_stub_file",
  "media_reference_resolver_noop_stub_file",
  "platform_adapter_noop_stub_file",
  "payload_builder_noop_stub_file",
  "network_client_noop_stub_file",
  "upload_executor_noop_stub_file",
  "retry_idempotency_noop_stub_file",
  "rollback_noop_stub_file",
  "post_upload_verification_noop_stub_file",
  "audit_event_noop_stub_file",
  "operator_confirmation_noop_stub_file",
  "emergency_stop_noop_stub_file",
  "status_reporter_noop_stub_file",
  "upload_scaffold_index_noop_stub_file",
] as const;

const STUB_CASES = [
  credentialProviderNoopStub,
  mediaReferenceResolverNoopStub,
  platformAdapterNoopStub,
  payloadBuilderNoopStub,
  networkClientNoopStub,
  uploadExecutorNoopStub,
  retryIdempotencyNoopStub,
  rollbackNoopStub,
  postUploadVerificationNoopStub,
  auditEventNoopStub,
  operatorConfirmationNoopStub,
  emergencyStopNoopStub,
  statusReporterNoopStub,
  uploadScaffoldIndexNoopStub,
] as const;

test("VO-7W-STUBS-1: noop stub kinds include all required kinds exactly once", () => {
  assert.deepEqual([...REAL_UPLOAD_NOOP_STUB_FILE_KINDS].sort(), [...REQUIRED_KINDS].sort());
  assert.equal(new Set(REAL_UPLOAD_NOOP_STUB_FILE_KINDS).size, REQUIRED_KINDS.length);
});

test("VO-7W-STUBS-2: each noop stub stays disabled and inert", () => {
  for (const stub of STUB_CASES) {
    const result = stub();
    assert.equal(result.status, "noop_disabled");
    assert.equal(result.ready_for_real_upload, false);
    assert.equal(result.upload_allowed, false);
    assert.equal(result.upload_execution_enabled, false);
    assert.equal(result.platform_api_calls_allowed, false);
    assert.equal(result.network_calls_allowed, false);
    assert.equal(result.credentials_accessed, false);
    assert.equal(result.token_accessed, false);
    assert.equal(result.keychain_accessed, false);
    assert.equal(result.env_accessed, false);
    assert.equal(result.media_file_read, false);
    assert.equal(result.file_mutation_allowed, false);
    assert.equal(result.raw_payload_created, false);
    assert.equal(result.raw_response_stored, false);
    assert.equal(result.blocking_reasons.includes("Real upload remains disabled."), true);
  }
});

test("VO-7W-STUBS-3: factory sanitizes unsafe summary input without echoing it", () => {
  const unsafe = "../unsafe https://example.com access_token";
  const result = createRealUploadNoopStubResult("credential_provider_noop_stub_file", unsafe);
  assert.equal(result.safe_summary.includes("../unsafe"), false);
  assert.equal(result.safe_summary.includes("https://example.com"), false);
  assert.equal(result.safe_summary.includes("access_token"), false);
  assert.equal(result.safe_summary.includes("Real upload remains disabled."), true);
});

test("VO-7W-STUBS-4: createAllRealUploadNoopStubResults returns exactly one result per kind", () => {
  const results = createAllRealUploadNoopStubResults();
  assert.equal(results.length, REQUIRED_KINDS.length);
  assert.deepEqual(results.map((result: RealUploadNoopStubResult) => result.stub_kind).sort(), [...REQUIRED_KINDS].sort());
  assert.equal(new Set(results.map((result: RealUploadNoopStubResult) => result.stub_kind)).size, REQUIRED_KINDS.length);
  assert.equal(JSON.stringify(results).includes("videos.insert"), false);
  assert.equal(JSON.stringify(results).includes("youtube.videos().insert"), false);
  assert.equal(JSON.stringify(results).includes("fetch("), false);
  assert.equal(JSON.stringify(results).includes("access_token"), false);
  assert.equal(JSON.stringify(results).includes("refresh_token"), false);
  assert.equal(JSON.stringify(results).includes("client_secret"), false);
});
