import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type {
  ControlledRuntimeImplementationBoundaryDryRun,
  ControlledRuntimeImplementationBoundarySafetyContract,
} from "./controlled-runtime-implementation-boundary.js";

export type ControlledRuntimeImplementationCandidateState = "draft" | "ready_for_operator_review" | "approved_for_future_candidate_review" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeImplementationCandidateReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_candidate_safe_report" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeImplementationCandidateSafeReportState = "draft" | "complete" | "approved_for_future_runtime_implementation_final_boundary" | "rejected" | "revoked" | "blocked";
export type CandidateReviewItemState = "passed" | "failed" | "blocked" | "deferred";

export interface ImplementationCandidateItem {
  item_id: string;
  item_kind: string;
  safe_summary: string;
  implemented_now: false;
}

export interface ImplementationCandidateReviewItem {
  item_id: string;
  item_kind: string;
  review_state: CandidateReviewItemState;
  safe_summary: string;
  implemented_now: false;
}

export interface CandidateSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface ControlledRuntimeImplementationCandidate {
  schema_version: "1.0";
  controlled_runtime_implementation_candidate_id: string;
  controlled_runtime_implementation_boundary_dry_run_id: string;
  controlled_runtime_implementation_boundary_safety_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  candidate_state: ControlledRuntimeImplementationCandidateState;
  required_artifacts: {
    controlled_runtime_implementation_boundary_dry_run_validated: true;
    controlled_runtime_implementation_boundary_safety_contract_validated: true;
  };
  candidate_scope: ControlledRuntimeActivationScope;
  candidate_controls: {
    candidate_only: true;
    safe_stub_only: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  candidate_items: ImplementationCandidateItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationCandidate" | "revokeControlledRuntimeImplementationCandidate";
    source_controlled_runtime_implementation_boundary_dry_run_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeImplementationCandidateReview {
  schema_version: "1.0";
  controlled_runtime_implementation_candidate_review_id: string;
  controlled_runtime_implementation_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  candidate_review_state: ControlledRuntimeImplementationCandidateReviewState;
  required_artifacts: { controlled_runtime_implementation_candidate_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    candidate_reviewed: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  review_items: ImplementationCandidateReviewItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationCandidateReview" | "revokeControlledRuntimeImplementationCandidateReview";
    source_controlled_runtime_implementation_candidate_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeImplementationCandidateSafeReport {
  schema_version: "1.0";
  controlled_runtime_implementation_candidate_safe_report_id: string;
  controlled_runtime_implementation_candidate_review_id: string;
  controlled_runtime_implementation_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: ControlledRuntimeImplementationCandidateSafeReportState;
  required_artifacts: {
    controlled_runtime_implementation_candidate_review_validated: true;
    controlled_runtime_implementation_candidate_validated: true;
  };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: CandidateSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationCandidateSafeReport" | "revokeControlledRuntimeImplementationCandidateSafeReport";
    source_controlled_runtime_implementation_candidate_review_id: string;
    source_render_plan_id: string;
  };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
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

const ITEMS: Array<{ id: string; kind: string }> = [
  { id: "kill-switch", kind: "kill_switch" },
  { id: "single-upload", kind: "single_upload_limit" },
  { id: "credential", kind: "credential_boundary" },
  { id: "network", kind: "network_boundary" },
  { id: "media", kind: "media_boundary" },
];

const REPORT_SECTIONS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "boundaries", kind: "boundaries", summary: "Candidate safe report only." },
  { id: "controls", kind: "controls", summary: "Candidate safe report only." },
  { id: "review", kind: "review", summary: "Candidate safe report only." },
  { id: "status", kind: "status", summary: "Real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return {
    artifact_only: true,
    future_next_phase_requested: futureNextPhaseRequested,
    real_upload_enabled_now: false,
    upload_execution_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    credential_access_enabled_now: false,
    media_read_enabled_now: false,
    dependencies_requested: false,
    package_metadata_changes_requested: false,
  };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return {
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
    warnings,
  };
}

function boundaryDryRunReady(dryRun: ControlledRuntimeImplementationBoundaryDryRun): boolean {
  return (
    dryRun.dry_run_state === "passed" &&
    dryRun.validation.complete === true &&
    dryRun.validation.ready_for_next_phase === true &&
    dryRun.validation.ready_for_real_upload === false &&
    dryRun.validation.real_upload_enabled === false &&
    dryRun.validation.upload_allowed === false &&
    dryRun.validation.network_calls_allowed === false &&
    dryRun.validation.platform_api_calls_allowed === false &&
    dryRun.validation.credentials_accessed === false &&
    dryRun.validation.media_file_read === false &&
    dryRun.dry_run_checks.length >= 5 &&
    dryRun.dry_run_checks.every((check) => check.check_state === "passed" && check.implemented_now === false)
  );
}

function boundarySafetyReady(contract: ControlledRuntimeImplementationBoundarySafetyContract): boolean {
  return (
    contract.safety_contract_state === "approved_for_future_boundary_dry_run" &&
    contract.validation.complete === true &&
    contract.validation.ready_for_next_phase === true &&
    contract.safety_controls.safe_stub_only === true &&
    contract.safety_controls.raw_payload_storage_allowed === false &&
    contract.safety_controls.raw_response_storage_allowed === false &&
    contract.safety_controls.real_upload_still_blocked === true &&
    contract.implementation_contracts.length >= 5 &&
    contract.implementation_contracts.every((item) => item.implemented_now === false)
  );
}

function candidateReady(candidate: ControlledRuntimeImplementationCandidate): boolean {
  return (
    candidate.candidate_state === "approved_for_future_candidate_review" &&
    candidate.validation.complete === true &&
    candidate.validation.ready_for_next_phase === true &&
    candidate.candidate_controls.candidate_only === true &&
    candidate.candidate_controls.safe_stub_only === true &&
    candidate.candidate_controls.real_upload_still_blocked === true &&
    candidate.candidate_items.length >= 5 &&
    candidate.candidate_items.every((item) => item.implemented_now === false)
  );
}

function candidateReviewReady(review: ControlledRuntimeImplementationCandidateReview): boolean {
  return (
    review.candidate_review_state === "approved_for_future_candidate_safe_report" &&
    review.validation.complete === true &&
    review.validation.ready_for_next_phase === true &&
    review.review_controls.review_only === true &&
    review.review_controls.candidate_reviewed === true &&
    review.review_controls.real_upload_still_blocked === true &&
    review.review_items.length >= 5 &&
    review.review_items.every((item) => item.review_state === "passed" && item.implemented_now === false)
  );
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime implementation candidate prerequisite was not validated.")))];
}

function candidateItems(): ImplementationCandidateItem[] {
  return ITEMS.map((item) => ({
    item_id: `candidate-${sanitizeSafeSummary(item.id, "item")}`,
    item_kind: sanitizeSafeSummary(item.kind, "candidate_item"),
    safe_summary: "Candidate item only.",
    implemented_now: false,
  }));
}

function reviewItems(passed: boolean): ImplementationCandidateReviewItem[] {
  return ITEMS.map((item) => ({
    item_id: `review-${sanitizeSafeSummary(item.id, "item")}`,
    item_kind: sanitizeSafeSummary(item.kind, "review_item"),
    review_state: passed ? "passed" : "blocked",
    safe_summary: "Candidate review only.",
    implemented_now: false,
  }));
}

function safeReportSections(): CandidateSafeReportSection[] {
  return REPORT_SECTIONS.map((section) => ({
    section_id: `candidate-safe-report-${sanitizeSafeSummary(section.id, "section")}`,
    section_kind: sanitizeSafeSummary(section.kind, "safe_report_section"),
    safe_summary: sanitizeSafeSummary(section.summary, "Candidate safe report only."),
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
  }));
}

export function createControlledRuntimeImplementationCandidate(
  dryRun: ControlledRuntimeImplementationBoundaryDryRun,
  safetyContract: ControlledRuntimeImplementationBoundarySafetyContract,
  options: { id?: string; created_at?: string; requestFutureCandidateReview?: boolean } = {},
): ControlledRuntimeImplementationCandidate {
  const ready = boundaryDryRunReady(dryRun) && boundarySafetyReady(safetyContract);
  const requestReview = options.requestFutureCandidateReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Boundary dry-run or safety contract was not ready for implementation candidate.", [...dryRun.validation.blocking_reasons, ...safetyContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_implementation_candidate_id: safe(options.id, "controlled-runtime-implementation-candidate-001"),
    controlled_runtime_implementation_boundary_dry_run_id: dryRun.controlled_runtime_implementation_boundary_dry_run_id,
    controlled_runtime_implementation_boundary_safety_contract_id: safetyContract.controlled_runtime_implementation_boundary_safety_contract_id,
    render_plan_id: dryRun.render_plan_id,
    project_id: dryRun.project_id,
    platform: dryRun.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    candidate_state: readyForNext ? "approved_for_future_candidate_review" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      controlled_runtime_implementation_boundary_dry_run_validated: true,
      controlled_runtime_implementation_boundary_safety_contract_validated: true,
    },
    candidate_scope: scope(readyForNext),
    candidate_controls: {
      candidate_only: true,
      safe_stub_only: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      real_upload_still_blocked: true,
    },
    candidate_items: candidateItems(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeImplementationCandidate",
      source_controlled_runtime_implementation_boundary_dry_run_id: dryRun.controlled_runtime_implementation_boundary_dry_run_id,
      source_render_plan_id: dryRun.render_plan_id,
    },
  };
}

export function createControlledRuntimeImplementationCandidateReview(
  candidate: ControlledRuntimeImplementationCandidate,
  options: { id?: string; created_at?: string; requestFutureCandidateSafeReport?: boolean } = {},
): ControlledRuntimeImplementationCandidateReview {
  const ready = candidateReady(candidate);
  const requestReport = options.requestFutureCandidateSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Implementation candidate was not ready for candidate review.", candidate.validation.blocking_reasons);
  return {
    schema_version: "1.0",
    controlled_runtime_implementation_candidate_review_id: safe(options.id, "controlled-runtime-implementation-candidate-review-001"),
    controlled_runtime_implementation_candidate_id: candidate.controlled_runtime_implementation_candidate_id,
    render_plan_id: candidate.render_plan_id,
    project_id: candidate.project_id,
    platform: candidate.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    candidate_review_state: readyForNext ? "approved_for_future_candidate_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_implementation_candidate_validated: true },
    review_scope: scope(readyForNext),
    review_controls: {
      review_only: true,
      candidate_reviewed: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      real_upload_still_blocked: true,
    },
    review_items: reviewItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeImplementationCandidateReview",
      source_controlled_runtime_implementation_candidate_id: candidate.controlled_runtime_implementation_candidate_id,
      source_render_plan_id: candidate.render_plan_id,
    },
  };
}

export function createControlledRuntimeImplementationCandidateSafeReport(
  review: ControlledRuntimeImplementationCandidateReview,
  candidate: ControlledRuntimeImplementationCandidate,
  options: { id?: string; created_at?: string; requestFutureRuntimeImplementationFinalBoundary?: boolean } = {},
): ControlledRuntimeImplementationCandidateSafeReport {
  const ready = candidateReviewReady(review) && candidateReady(candidate);
  const requestFinalBoundary = options.requestFutureRuntimeImplementationFinalBoundary !== false;
  const complete = ready;
  const readyForNext = complete && requestFinalBoundary;
  const reasons = blocking(ready, "Implementation candidate review or candidate was not ready for candidate safe report.", [...review.validation.blocking_reasons, ...candidate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_implementation_candidate_safe_report_id: safe(options.id, "controlled-runtime-implementation-candidate-safe-report-001"),
    controlled_runtime_implementation_candidate_review_id: review.controlled_runtime_implementation_candidate_review_id,
    controlled_runtime_implementation_candidate_id: candidate.controlled_runtime_implementation_candidate_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_implementation_final_boundary" : ready ? "complete" : "blocked",
    required_artifacts: {
      controlled_runtime_implementation_candidate_review_validated: true,
      controlled_runtime_implementation_candidate_validated: true,
    },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeImplementationCandidateSafeReport",
      source_controlled_runtime_implementation_candidate_review_id: review.controlled_runtime_implementation_candidate_review_id,
      source_render_plan_id: review.render_plan_id,
    },
  };
}

export function revokeControlledRuntimeImplementationCandidate(candidate: ControlledRuntimeImplementationCandidate, reason?: string): ControlledRuntimeImplementationCandidate {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation candidate was revoked.");
  return { ...candidate, candidate_state: "revoked", candidate_scope: scope(false), validation: validation(false, false, candidate.validation.blocking_reasons, [...candidate.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...candidate.provenance, generated_by: "revokeControlledRuntimeImplementationCandidate" } };
}

export function revokeControlledRuntimeImplementationCandidateReview(review: ControlledRuntimeImplementationCandidateReview, reason?: string): ControlledRuntimeImplementationCandidateReview {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation candidate review was revoked.");
  return { ...review, candidate_review_state: "revoked", review_scope: scope(false), review_items: review.review_items.map((item) => ({ ...item, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeControlledRuntimeImplementationCandidateReview" } };
}

export function revokeControlledRuntimeImplementationCandidateSafeReport(report: ControlledRuntimeImplementationCandidateSafeReport, reason?: string): ControlledRuntimeImplementationCandidateSafeReport {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation candidate safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeControlledRuntimeImplementationCandidateSafeReport" } };
}
