import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadDryRunAdapterContractTests } from "./real-upload-dry-run-adapter.js";

export type FinalOperatorChecklistState =
  | "draft"
  | "ready_for_operator_review"
  | "approved_for_future_real_upload_enablement_request"
  | "rejected"
  | "revoked"
  | "blocked";

export interface FinalOperatorAcknowledgementsInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_final_checklist_only?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_future_enablement_request_required?: boolean;
  understands_credentials_are_not_accessed?: boolean;
  understands_network_calls_are_not_enabled?: boolean;
  understands_media_reads_are_not_enabled?: boolean;
  understands_platform_api_calls_are_not_enabled?: boolean;
  understands_dependencies_are_not_added?: boolean;
  decision_note_summary?: string;
}

export interface DisabledFinalChecklistBoundary {
  ready_for_real_upload: false;
  real_upload_enabled: false;
  adapter_code_created: false;
  runtime_enabled: false;
  runtime_executed: false;
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
  dependencies_added: false;
  package_metadata_changed: false;
}

export interface RealUploadFinalOperatorChecklist {
  schema_version: "1.0";
  real_upload_final_operator_checklist_id: string;
  real_upload_dry_run_adapter_contract_tests_id: string;
  real_upload_dry_run_adapter_contracts_id: string;
  real_upload_dry_run_adapter_design_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_checklist_state: FinalOperatorChecklistState;
  required_artifacts: {
    real_upload_dry_run_adapter_contract_tests_validated: true;
    real_upload_dry_run_adapter_contracts_validated: true;
    real_upload_dry_run_adapter_design_validated: true;
  };
  checklist_scope: {
    final_operator_checklist_only: true;
    future_real_upload_enablement_request_allowed: boolean;
    real_upload_enabled_now: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  operator_acknowledgements: Required<FinalOperatorAcknowledgementsInput>;
  remaining_real_upload_blocks: {
    real_upload_enablement_request_required: true;
    explicit_credentials_boundary_required: true;
    explicit_network_boundary_required: true;
    explicit_media_read_boundary_required: true;
    explicit_platform_api_boundary_required: true;
    separate_commit_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledFinalChecklistBoundary;
  validation: {
    complete: boolean;
    ready_for_next_phase: boolean;
    ready_for_real_upload: false;
    real_upload_enabled: false;
    upload_allowed: false;
    network_calls_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealUploadFinalOperatorChecklist" | "revokeRealUploadFinalOperatorChecklist";
    source_real_upload_dry_run_adapter_contract_tests_id: string;
    source_render_plan_id: string;
  };
}

const DISABLED_BOUNDARY: DisabledFinalChecklistBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  adapter_code_created: false,
  runtime_enabled: false,
  runtime_executed: false,
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
  dependencies_added: false,
  package_metadata_changed: false,
};

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function normalizeAcknowledgements(input: FinalOperatorAcknowledgementsInput = {}): Required<FinalOperatorAcknowledgementsInput> {
  return {
    reviewed_by_label: safe(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_final_checklist_only: input.understands_final_checklist_only === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_future_enablement_request_required: input.understands_future_enablement_request_required === true,
    understands_credentials_are_not_accessed: input.understands_credentials_are_not_accessed === true,
    understands_network_calls_are_not_enabled: input.understands_network_calls_are_not_enabled === true,
    understands_media_reads_are_not_enabled: input.understands_media_reads_are_not_enabled === true,
    understands_platform_api_calls_are_not_enabled: input.understands_platform_api_calls_are_not_enabled === true,
    understands_dependencies_are_not_added: input.understands_dependencies_are_not_added === true,
    decision_note_summary: safe(input.decision_note_summary, "Final checklist only. Real upload remains disabled until a separate enablement request."),
  };
}

function acknowledgementsComplete(ack: Required<FinalOperatorAcknowledgementsInput>): boolean {
  return (
    ack.checklist_acknowledged &&
    ack.understands_final_checklist_only &&
    ack.understands_real_upload_not_enabled &&
    ack.understands_future_enablement_request_required &&
    ack.understands_credentials_are_not_accessed &&
    ack.understands_network_calls_are_not_enabled &&
    ack.understands_media_reads_are_not_enabled &&
    ack.understands_platform_api_calls_are_not_enabled &&
    ack.understands_dependencies_are_not_added
  );
}

function contractTestsReady(tests: RealUploadDryRunAdapterContractTests): boolean {
  return (
    (tests.dry_run_adapter_contract_tests_state === "ready_for_operator_review" || tests.dry_run_adapter_contract_tests_state === "approved_for_final_operator_checklist") &&
    tests.validation.complete === true &&
    tests.validation.ready_for_next_phase === true &&
    tests.validation.ready_for_real_upload === false &&
    tests.validation.real_upload_enabled === false &&
    tests.validation.upload_allowed === false &&
    tests.validation.network_calls_allowed === false &&
    tests.validation.platform_api_calls_allowed === false &&
    tests.validation.credentials_accessed === false &&
    tests.validation.media_file_read === false &&
    tests.execution_boundary.real_upload_enabled === false &&
    tests.execution_boundary.upload_allowed === false &&
    tests.execution_boundary.network_calls_allowed === false &&
    tests.execution_boundary.platform_api_calls_allowed === false &&
    tests.execution_boundary.credentials_accessed === false &&
    tests.execution_boundary.media_file_read === false &&
    tests.dry_run_contract_test_results.every((result) => result.test_state === "passed" && result.contract_shape_checked === true)
  );
}

function blockingReasonsFromTests(tests: RealUploadDryRunAdapterContractTests): string[] {
  if (contractTestsReady(tests)) return [];
  return [
    ...tests.validation.blocking_reasons,
    "Dry-run adapter contract tests were not ready for the final operator checklist.",
  ].map((reason) => sanitizeSafeSummary(reason, "Final checklist prerequisite was not validated."));
}

export function createRealUploadFinalOperatorChecklist(
  contractTests: RealUploadDryRunAdapterContractTests,
  options: {
    id?: string;
    created_at?: string;
    acknowledgements?: FinalOperatorAcknowledgementsInput;
    requestFutureRealUploadEnablement?: boolean;
  } = {},
): RealUploadFinalOperatorChecklist {
  const testsReady = contractTestsReady(contractTests);
  const acknowledgements = normalizeAcknowledgements(options.acknowledgements);
  const ackReady = acknowledgementsComplete(acknowledgements);
  const requestEnablement = options.requestFutureRealUploadEnablement !== false;
  const complete = testsReady && ackReady;
  const readyForNextPhase = complete && requestEnablement;
  let state: FinalOperatorChecklistState = "blocked";
  if (testsReady && ackReady && requestEnablement) state = "approved_for_future_real_upload_enablement_request";
  else if (testsReady) state = "ready_for_operator_review";
  const blockingReasons = testsReady ? [] : blockingReasonsFromTests(contractTests);

  return {
    schema_version: "1.0",
    real_upload_final_operator_checklist_id: safe(options.id, "real-upload-final-operator-checklist-001"),
    real_upload_dry_run_adapter_contract_tests_id: contractTests.real_upload_dry_run_adapter_contract_tests_id,
    real_upload_dry_run_adapter_contracts_id: contractTests.real_upload_dry_run_adapter_contracts_id,
    real_upload_dry_run_adapter_design_id: contractTests.real_upload_dry_run_adapter_design_id,
    render_plan_id: contractTests.render_plan_id,
    project_id: contractTests.project_id,
    platform: contractTests.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_checklist_state: state,
    required_artifacts: {
      real_upload_dry_run_adapter_contract_tests_validated: true,
      real_upload_dry_run_adapter_contracts_validated: true,
      real_upload_dry_run_adapter_design_validated: true,
    },
    checklist_scope: {
      final_operator_checklist_only: true,
      future_real_upload_enablement_request_allowed: readyForNextPhase,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    operator_acknowledgements: acknowledgements,
    remaining_real_upload_blocks: {
      real_upload_enablement_request_required: true,
      explicit_credentials_boundary_required: true,
      explicit_network_boundary_required: true,
      explicit_media_read_boundary_required: true,
      explicit_platform_api_boundary_required: true,
      separate_commit_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete,
      ready_for_next_phase: readyForNextPhase,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: blockingReasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createRealUploadFinalOperatorChecklist",
      source_real_upload_dry_run_adapter_contract_tests_id: contractTests.real_upload_dry_run_adapter_contract_tests_id,
      source_render_plan_id: contractTests.render_plan_id,
    },
  };
}

export function revokeRealUploadFinalOperatorChecklist(
  checklist: RealUploadFinalOperatorChecklist,
  reason?: string,
): RealUploadFinalOperatorChecklist {
  const warning = sanitizeSafeSummary(reason, "Final operator checklist was revoked.");
  return {
    ...checklist,
    final_checklist_state: "revoked",
    checklist_scope: {
      ...checklist.checklist_scope,
      future_real_upload_enablement_request_allowed: false,
    },
    validation: {
      ...checklist.validation,
      complete: false,
      ready_for_next_phase: false,
      warnings: [...checklist.validation.warnings, warning],
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: {
      ...checklist.provenance,
      generated_by: "revokeRealUploadFinalOperatorChecklist",
    },
  };
}

export function rejectRealUploadFinalOperatorChecklist(
  checklist: RealUploadFinalOperatorChecklist,
  reason?: string,
): RealUploadFinalOperatorChecklist {
  const warning = sanitizeSafeSummary(reason, "Final operator checklist was rejected.");
  return {
    ...checklist,
    final_checklist_state: "rejected",
    checklist_scope: {
      ...checklist.checklist_scope,
      future_real_upload_enablement_request_allowed: false,
    },
    validation: {
      ...checklist.validation,
      complete: false,
      ready_for_next_phase: false,
      warnings: [...checklist.validation.warnings, warning],
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
  };
}
