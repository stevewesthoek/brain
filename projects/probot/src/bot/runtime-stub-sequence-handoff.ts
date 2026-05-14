import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubArchiveFinalSummary } from "./runtime-stub-archive.js";
import type { RuntimeStubSequenceFinalHandoff } from "./runtime-stub-sequence-integrity.js";

export type RuntimeStubSequenceIndexState = "draft" | "complete" | "approved_for_future_operator_handoff_checklist" | "rejected" | "revoked" | "blocked";
export type RuntimeStubOperatorHandoffChecklistState = "draft" | "ready_for_operator_review" | "approved_for_future_next_phase_decision_record" | "rejected" | "revoked" | "blocked";
export type RuntimeStubNextPhaseDecisionRecordState = "draft" | "recorded" | "deferred" | "approved_for_future_explicit_runtime_activation_design" | "rejected" | "revoked" | "blocked";
export type RuntimeStubChecklistItemState = "checked" | "unchecked" | "blocked" | "deferred";
export type RuntimeStubSelectedDecisionKind = "defer" | "document_future_activation_design" | "stop_runtime_stub_track" | "blocked";

export interface RuntimeStubIndexedArtifact {
  artifact_key: string;
  artifact_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubOperatorHandoffChecklistItem {
  item_id: string;
  item_kind: string;
  item_state: RuntimeStubChecklistItemState;
  safe_summary: string;
  operator_action_required_now: false;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubDecisionOption {
  option_id: string;
  option_kind: Exclude<RuntimeStubSelectedDecisionKind, "blocked">;
  safe_summary: string;
  would_enable_runtime_now: false;
  would_enable_real_upload_now: false;
}

export interface RuntimeStubSelectedDecision {
  decision_id: string;
  decision_kind: RuntimeStubSelectedDecisionKind;
  safe_summary: string;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubSequenceIndex {
  schema_version: "1.0";
  runtime_stub_sequence_index_id: string;
  runtime_stub_sequence_final_handoff_id: string;
  runtime_stub_archive_final_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  index_state: RuntimeStubSequenceIndexState;
  required_artifacts: { runtime_stub_sequence_final_handoff_validated: true; runtime_stub_archive_final_summary_validated: true };
  index_scope: ControlledRuntimeActivationScope;
  index_controls: {
    index_only: true;
    operator_summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  indexed_artifacts: RuntimeStubIndexedArtifact[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubSequenceIndex" | "revokeRuntimeStubSequenceIndex"; source_runtime_stub_sequence_final_handoff_id: string; source_render_plan_id: string };
}

export interface RuntimeStubOperatorHandoffChecklist {
  schema_version: "1.0";
  runtime_stub_operator_handoff_checklist_id: string;
  runtime_stub_sequence_index_id: string;
  runtime_stub_sequence_final_handoff_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  checklist_state: RuntimeStubOperatorHandoffChecklistState;
  required_artifacts: { runtime_stub_sequence_index_validated: true; runtime_stub_sequence_final_handoff_validated: true };
  checklist_scope: ControlledRuntimeActivationScope;
  checklist_controls: {
    checklist_only: true;
    operator_handoff_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  checklist_items: RuntimeStubOperatorHandoffChecklistItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubOperatorHandoffChecklist" | "revokeRuntimeStubOperatorHandoffChecklist"; source_runtime_stub_sequence_index_id: string; source_render_plan_id: string };
}

export interface RuntimeStubNextPhaseDecisionRecord {
  schema_version: "1.0";
  runtime_stub_next_phase_decision_record_id: string;
  runtime_stub_operator_handoff_checklist_id: string;
  runtime_stub_sequence_index_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  decision_state: RuntimeStubNextPhaseDecisionRecordState;
  required_artifacts: { runtime_stub_operator_handoff_checklist_validated: true; runtime_stub_sequence_index_validated: true };
  decision_scope: ControlledRuntimeActivationScope;
  decision_controls: {
    decision_record_only: true;
    future_phase_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  decision_options: RuntimeStubDecisionOption[];
  selected_decision: RuntimeStubSelectedDecision;
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubNextPhaseDecisionRecord" | "revokeRuntimeStubNextPhaseDecisionRecord"; source_runtime_stub_operator_handoff_checklist_id: string; source_render_plan_id: string };
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

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub sequence handoff prerequisite was not validated.")))];
}

function finalHandoffReady(handoff: RuntimeStubSequenceFinalHandoff): boolean {
  return handoff.handoff_state === "runtime_stub_sequence_handed_off" && handoff.validation.complete && !handoff.validation.ready_for_next_phase && !handoff.validation.ready_for_real_upload && handoff.handoff_controls.handoff_only && handoff.handoff_controls.sequence_handoff_only && !handoff.handoff_controls.contains_runtime_callable && !handoff.handoff_controls.contains_raw_payload && !handoff.handoff_controls.contains_raw_response && !handoff.handoff_controls.contains_secret_material && handoff.handoff_controls.runtime_invocation_disabled && handoff.handoff_controls.real_upload_still_blocked && handoff.handoff_sections.length >= 4 && handoff.handoff_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.ready_for_real_upload_now);
}

function archiveFinalSummaryReady(summary: RuntimeStubArchiveFinalSummary): boolean {
  return summary.final_summary_state === "runtime_stub_sequence_complete" && summary.validation.complete && !summary.validation.ready_for_next_phase && !summary.validation.ready_for_real_upload && summary.final_summary_controls.final_summary_only && summary.final_summary_controls.runtime_stub_sequence_only && !summary.final_summary_controls.contains_runtime_callable && !summary.final_summary_controls.contains_raw_payload && !summary.final_summary_controls.contains_raw_response && !summary.final_summary_controls.contains_secret_material && summary.final_summary_controls.runtime_invocation_disabled && summary.final_summary_controls.real_upload_still_blocked && summary.final_summary_sections.length >= 4 && summary.final_summary_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.ready_for_real_upload_now);
}

function sequenceIndexReady(index: RuntimeStubSequenceIndex): boolean {
  return index.index_state === "approved_for_future_operator_handoff_checklist" && index.validation.complete && index.validation.ready_for_next_phase && index.index_controls.index_only && index.index_controls.operator_summary_only && !index.index_controls.contains_runtime_callable && !index.index_controls.contains_raw_payload && !index.index_controls.contains_raw_response && !index.index_controls.contains_secret_material && index.index_controls.runtime_invocation_disabled && index.index_controls.real_upload_still_blocked && index.indexed_artifacts.length >= 6 && index.indexed_artifacts.every((artifact) => !artifact.contains_runtime_callable && !artifact.contains_raw_payload && !artifact.contains_secret_material && !artifact.ready_for_real_upload_now);
}

function checklistReady(checklist: RuntimeStubOperatorHandoffChecklist): boolean {
  return checklist.checklist_state === "approved_for_future_next_phase_decision_record" && checklist.validation.complete && checklist.validation.ready_for_next_phase && checklist.checklist_controls.checklist_only && checklist.checklist_controls.operator_handoff_only && !checklist.checklist_controls.contains_runtime_callable && !checklist.checklist_controls.contains_raw_payload && !checklist.checklist_controls.contains_raw_response && !checklist.checklist_controls.contains_secret_material && checklist.checklist_controls.runtime_invocation_disabled && checklist.checklist_controls.real_upload_still_blocked && checklist.checklist_items.length >= 5 && checklist.checklist_items.every((item) => item.item_state === "checked" && !item.operator_action_required_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function indexedArtifacts(): RuntimeStubIndexedArtifact[] {
  const artifacts = [
    ["noop-runtime-stub", "stub", "No-op runtime stub summarized only."],
    ["runtime-stub-store", "store", "Runtime stub store summarized only."],
    ["runtime-stub-manifest", "manifest", "Manifest summarized only."],
    ["runtime-stub-release-candidate", "release_candidate", "Release candidate summarized only."],
    ["runtime-stub-archive-final-summary", "final_summary", "Archive final summary summarized only."],
    ["runtime-stub-sequence-final-handoff", "handoff", "Final handoff summarized only."],
  ] as const;
  return artifacts.map(([key, kind, summary]) => ({ artifact_key: key, artifact_kind: kind, safe_summary: summary, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, ready_for_real_upload_now: false }));
}

function checklistItems(checked: boolean): RuntimeStubOperatorHandoffChecklistItem[] {
  const items = [
    ["check-index", "index", "Sequence index available for operator review."],
    ["check-final-handoff", "final_handoff", "Final handoff available for operator review."],
    ["check-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["check-real-upload", "real_upload", "Real upload remains disabled."],
    ["check-next-phase", "next_phase", "Future phase requires separate decision record."],
  ] as const;
  return items.map(([id, kind, summary]) => ({ item_id: id, item_kind: kind, item_state: checked ? "checked" : "blocked", safe_summary: summary, operator_action_required_now: false, runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function decisionOptions(): RuntimeStubDecisionOption[] {
  return [
    { option_id: "decision-defer", option_kind: "defer", safe_summary: "Defer future runtime activation design.", would_enable_runtime_now: false, would_enable_real_upload_now: false },
    { option_id: "decision-document-future-design", option_kind: "document_future_activation_design", safe_summary: "Document a future explicit runtime activation design only.", would_enable_runtime_now: false, would_enable_real_upload_now: false },
    { option_id: "decision-stop-track", option_kind: "stop_runtime_stub_track", safe_summary: "Stop the runtime stub track after handoff.", would_enable_runtime_now: false, would_enable_real_upload_now: false },
  ];
}

export function createRuntimeStubSequenceIndex(finalHandoff: RuntimeStubSequenceFinalHandoff, archiveFinalSummary: RuntimeStubArchiveFinalSummary, options: { id?: string; created_at?: string; requestFutureOperatorHandoffChecklist?: boolean } = {}): RuntimeStubSequenceIndex {
  const ready = finalHandoffReady(finalHandoff) && archiveFinalSummaryReady(archiveFinalSummary);
  const requestChecklist = options.requestFutureOperatorHandoffChecklist !== false;
  const complete = ready;
  const readyForNext = complete && requestChecklist;
  const reasons = blocking(ready, "Runtime stub sequence final handoff or archive final summary was not ready for sequence index.", [...finalHandoff.validation.blocking_reasons, ...archiveFinalSummary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_sequence_index_id: safe(options.id, "runtime-stub-sequence-index-001"),
    runtime_stub_sequence_final_handoff_id: finalHandoff.runtime_stub_sequence_final_handoff_id,
    runtime_stub_archive_final_summary_id: archiveFinalSummary.runtime_stub_archive_final_summary_id,
    render_plan_id: finalHandoff.render_plan_id,
    project_id: finalHandoff.project_id,
    platform: finalHandoff.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    index_state: readyForNext ? "approved_for_future_operator_handoff_checklist" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_sequence_final_handoff_validated: true, runtime_stub_archive_final_summary_validated: true },
    index_scope: scope(readyForNext),
    index_controls: { index_only: true, operator_summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    indexed_artifacts: indexedArtifacts(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubSequenceIndex", source_runtime_stub_sequence_final_handoff_id: finalHandoff.runtime_stub_sequence_final_handoff_id, source_render_plan_id: finalHandoff.render_plan_id },
  };
}

export function createRuntimeStubOperatorHandoffChecklist(index: RuntimeStubSequenceIndex, finalHandoff: RuntimeStubSequenceFinalHandoff, options: { id?: string; created_at?: string; requestFutureNextPhaseDecisionRecord?: boolean } = {}): RuntimeStubOperatorHandoffChecklist {
  const ready = sequenceIndexReady(index) && finalHandoffReady(finalHandoff);
  const requestDecision = options.requestFutureNextPhaseDecisionRecord !== false;
  const complete = ready;
  const readyForNext = complete && requestDecision;
  const reasons = blocking(ready, "Runtime stub sequence index or final handoff was not ready for operator handoff checklist.", [...index.validation.blocking_reasons, ...finalHandoff.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_operator_handoff_checklist_id: safe(options.id, "runtime-stub-operator-handoff-checklist-001"),
    runtime_stub_sequence_index_id: index.runtime_stub_sequence_index_id,
    runtime_stub_sequence_final_handoff_id: finalHandoff.runtime_stub_sequence_final_handoff_id,
    render_plan_id: index.render_plan_id,
    project_id: index.project_id,
    platform: index.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    checklist_state: readyForNext ? "approved_for_future_next_phase_decision_record" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_sequence_index_validated: true, runtime_stub_sequence_final_handoff_validated: true },
    checklist_scope: scope(readyForNext),
    checklist_controls: { checklist_only: true, operator_handoff_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    checklist_items: checklistItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubOperatorHandoffChecklist", source_runtime_stub_sequence_index_id: index.runtime_stub_sequence_index_id, source_render_plan_id: index.render_plan_id },
  };
}

export function createRuntimeStubNextPhaseDecisionRecord(checklist: RuntimeStubOperatorHandoffChecklist, index: RuntimeStubSequenceIndex, options: { id?: string; created_at?: string; decisionKind?: RuntimeStubSelectedDecisionKind } = {}): RuntimeStubNextPhaseDecisionRecord {
  const ready = checklistReady(checklist) && sequenceIndexReady(index);
  const decisionKind: RuntimeStubSelectedDecisionKind = ready ? options.decisionKind ?? "document_future_activation_design" : "blocked";
  const readyForNext = ready && decisionKind === "document_future_activation_design";
  const decisionState: RuntimeStubNextPhaseDecisionRecordState = !ready ? "blocked" : decisionKind === "document_future_activation_design" ? "approved_for_future_explicit_runtime_activation_design" : decisionKind === "defer" ? "deferred" : "recorded";
  const reasons = blocking(ready, "Runtime stub operator handoff checklist or sequence index was not ready for next phase decision record.", [...checklist.validation.blocking_reasons, ...index.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_next_phase_decision_record_id: safe(options.id, "runtime-stub-next-phase-decision-record-001"),
    runtime_stub_operator_handoff_checklist_id: checklist.runtime_stub_operator_handoff_checklist_id,
    runtime_stub_sequence_index_id: index.runtime_stub_sequence_index_id,
    render_plan_id: checklist.render_plan_id,
    project_id: checklist.project_id,
    platform: checklist.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    decision_state: decisionState,
    required_artifacts: { runtime_stub_operator_handoff_checklist_validated: true, runtime_stub_sequence_index_validated: true },
    decision_scope: scope(readyForNext),
    decision_controls: { decision_record_only: true, future_phase_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    decision_options: decisionOptions(),
    selected_decision: { decision_id: `selected-${decisionKind.replaceAll("_", "-")}`, decision_kind: decisionKind, safe_summary: decisionKind === "document_future_activation_design" ? "Proceed only to a future explicit activation design artifact. Do not enable runtime or real upload now." : decisionKind === "defer" ? "Defer future runtime activation design. Do not enable runtime or real upload now." : decisionKind === "stop_runtime_stub_track" ? "Stop the runtime stub track after handoff. Do not enable runtime or real upload now." : "Decision record is blocked.", runtime_enabled_now: false, ready_for_real_upload_now: false },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(ready, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubNextPhaseDecisionRecord", source_runtime_stub_operator_handoff_checklist_id: checklist.runtime_stub_operator_handoff_checklist_id, source_render_plan_id: checklist.render_plan_id },
  };
}

export function revokeRuntimeStubSequenceIndex(index: RuntimeStubSequenceIndex, reason?: string): RuntimeStubSequenceIndex {
  const warning = sanitizeSafeSummary(reason, "Runtime stub sequence index was revoked.");
  return { ...index, index_state: "revoked", index_scope: scope(false), validation: validation(false, false, index.validation.blocking_reasons, [...index.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...index.provenance, generated_by: "revokeRuntimeStubSequenceIndex" } };
}

export function revokeRuntimeStubOperatorHandoffChecklist(checklist: RuntimeStubOperatorHandoffChecklist, reason?: string): RuntimeStubOperatorHandoffChecklist {
  const warning = sanitizeSafeSummary(reason, "Runtime stub operator handoff checklist was revoked.");
  return { ...checklist, checklist_state: "revoked", checklist_scope: scope(false), checklist_items: checklist.checklist_items.map((item) => ({ ...item, item_state: "blocked" })), validation: validation(false, false, checklist.validation.blocking_reasons, [...checklist.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...checklist.provenance, generated_by: "revokeRuntimeStubOperatorHandoffChecklist" } };
}

export function revokeRuntimeStubNextPhaseDecisionRecord(record: RuntimeStubNextPhaseDecisionRecord, reason?: string): RuntimeStubNextPhaseDecisionRecord {
  const warning = sanitizeSafeSummary(reason, "Runtime stub next phase decision record was revoked.");
  return { ...record, decision_state: "revoked", decision_scope: scope(false), selected_decision: { ...record.selected_decision, decision_kind: "blocked", safe_summary: "Decision record was revoked.", runtime_enabled_now: false, ready_for_real_upload_now: false }, validation: validation(false, false, record.validation.blocking_reasons, [...record.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...record.provenance, generated_by: "revokeRuntimeStubNextPhaseDecisionRecord" } };
}
