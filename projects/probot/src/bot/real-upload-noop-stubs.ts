export const credential_provider_noop_stub_file = "credential_provider_noop_stub_file" as const;
export const media_reference_resolver_noop_stub_file = "media_reference_resolver_noop_stub_file" as const;
export const platform_adapter_noop_stub_file = "platform_adapter_noop_stub_file" as const;
export const payload_builder_noop_stub_file = "payload_builder_noop_stub_file" as const;
export const network_client_noop_stub_file = "network_client_noop_stub_file" as const;
export const upload_executor_noop_stub_file = "upload_executor_noop_stub_file" as const;
export const retry_idempotency_noop_stub_file = "retry_idempotency_noop_stub_file" as const;
export const rollback_noop_stub_file = "rollback_noop_stub_file" as const;
export const post_upload_verification_noop_stub_file = "post_upload_verification_noop_stub_file" as const;
export const audit_event_noop_stub_file = "audit_event_noop_stub_file" as const;
export const operator_confirmation_noop_stub_file = "operator_confirmation_noop_stub_file" as const;
export const emergency_stop_noop_stub_file = "emergency_stop_noop_stub_file" as const;
export const status_reporter_noop_stub_file = "status_reporter_noop_stub_file" as const;
export const upload_scaffold_index_noop_stub_file = "upload_scaffold_index_noop_stub_file" as const;

export const REAL_UPLOAD_NOOP_STUB_FILE_KINDS = [
  credential_provider_noop_stub_file,
  media_reference_resolver_noop_stub_file,
  platform_adapter_noop_stub_file,
  payload_builder_noop_stub_file,
  network_client_noop_stub_file,
  upload_executor_noop_stub_file,
  retry_idempotency_noop_stub_file,
  rollback_noop_stub_file,
  post_upload_verification_noop_stub_file,
  audit_event_noop_stub_file,
  operator_confirmation_noop_stub_file,
  emergency_stop_noop_stub_file,
  status_reporter_noop_stub_file,
  upload_scaffold_index_noop_stub_file,
] as const;

export type RealUploadNoopStubFileKind = (typeof REAL_UPLOAD_NOOP_STUB_FILE_KINDS)[number];

export interface RealUploadNoopStubResult {
  stub_kind: RealUploadNoopStubFileKind;
  status: "noop_disabled";
  ready_for_real_upload: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  platform_api_calls_allowed: false;
  network_calls_allowed: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_accessed: false;
  media_file_read: false;
  file_mutation_allowed: false;
  raw_payload_created: false;
  raw_response_stored: false;
  safe_summary: string;
  blocking_reasons: string[];
  warnings: string[];
}

function sanitizeNoopStubSummary(summary?: string): string {
  const fallback = "No-op stub file remains disabled.";
  if (typeof summary !== "string") return fallback;
  const text = summary.trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  const forbidden = [
    "://",
    "..",
    "stdout",
    "stderr",
    "process.env",
    "access_token",
    "refresh_token",
    "client_secret",
    "code_verifier",
    "authorization_code",
    "bearer",
    "videos.insert",
    "youtube.videos().insert",
    "fetch(",
    "/users/",
    "http://",
    "https://",
    "keychain://",
  ];
  if (forbidden.some((pattern) => lower.includes(pattern))) {
    return fallback;
  }
  return text.length > 160 ? text.slice(0, 160) : text;
}

export function createRealUploadNoopStubResult(stub_kind: RealUploadNoopStubFileKind, safe_summary?: string): RealUploadNoopStubResult {
  return {
    stub_kind,
    status: "noop_disabled",
    ready_for_real_upload: false,
    upload_allowed: false,
    upload_execution_enabled: false,
    platform_api_calls_allowed: false,
    network_calls_allowed: false,
    credentials_accessed: false,
    token_accessed: false,
    keychain_accessed: false,
    env_accessed: false,
    media_file_read: false,
    file_mutation_allowed: false,
    raw_payload_created: false,
    raw_response_stored: false,
    safe_summary: sanitizeNoopStubSummary(safe_summary),
    blocking_reasons: ["Real upload remains disabled."],
    warnings: [],
  };
}

export function credentialProviderNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(credential_provider_noop_stub_file, "Credential provider noop stub file remains disabled.");
}

export function mediaReferenceResolverNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(media_reference_resolver_noop_stub_file, "Media reference resolver noop stub file remains disabled.");
}

export function platformAdapterNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(platform_adapter_noop_stub_file, "Platform adapter noop stub file remains disabled.");
}

export function payloadBuilderNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(payload_builder_noop_stub_file, "Payload builder noop stub file remains disabled.");
}

export function networkClientNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(network_client_noop_stub_file, "Network client noop stub file remains disabled.");
}

export function uploadExecutorNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(upload_executor_noop_stub_file, "Upload executor noop stub file remains disabled.");
}

export function retryIdempotencyNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(retry_idempotency_noop_stub_file, "Retry idempotency noop stub file remains disabled.");
}

export function rollbackNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(rollback_noop_stub_file, "Rollback noop stub file remains disabled.");
}

export function postUploadVerificationNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(post_upload_verification_noop_stub_file, "Post-upload verification noop stub file remains disabled.");
}

export function auditEventNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(audit_event_noop_stub_file, "Audit event noop stub file remains disabled.");
}

export function operatorConfirmationNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(operator_confirmation_noop_stub_file, "Operator confirmation noop stub file remains disabled.");
}

export function emergencyStopNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(emergency_stop_noop_stub_file, "Emergency stop noop stub file remains disabled.");
}

export function statusReporterNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(status_reporter_noop_stub_file, "Status reporter noop stub file remains disabled.");
}

export function uploadScaffoldIndexNoopStub(): RealUploadNoopStubResult {
  return createRealUploadNoopStubResult(upload_scaffold_index_noop_stub_file, "Upload scaffold index noop stub file remains disabled.");
}

export function createAllRealUploadNoopStubResults(): RealUploadNoopStubResult[] {
  return [
    credentialProviderNoopStub(),
    mediaReferenceResolverNoopStub(),
    platformAdapterNoopStub(),
    payloadBuilderNoopStub(),
    networkClientNoopStub(),
    uploadExecutorNoopStub(),
    retryIdempotencyNoopStub(),
    rollbackNoopStub(),
    postUploadVerificationNoopStub(),
    auditEventNoopStub(),
    operatorConfirmationNoopStub(),
    emergencyStopNoopStub(),
    statusReporterNoopStub(),
    uploadScaffoldIndexNoopStub(),
  ];
}
