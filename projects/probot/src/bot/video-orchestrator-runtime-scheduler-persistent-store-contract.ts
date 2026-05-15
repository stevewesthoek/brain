import type { RuntimeSchedulerPersistentStoreApprovalPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-approval.js";

export type RuntimeSchedulerPersistentStoreContractState = "contract_ready_for_review" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStoreOperation = "load_queue" | "save_queue" | "append_event" | "mark_published" | "mark_failed" | "list_due_items";

export interface RuntimeSchedulerPersistentStoreContractInput {
  contract_id: string;
  operator_id: string;
  store_namespace: string;
  operations: readonly RuntimeSchedulerPersistentStoreOperation[];
  allow_contract_only: true;
  allow_file_write: false;
  allow_database_write: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPersistentStoreContract {
  schema_version: "1.0";
  contract_id: string;
  contract_state: RuntimeSchedulerPersistentStoreContractState;
  contract_only: true;
  source_approval_state: RuntimeSchedulerPersistentStoreApprovalPacket["approval_state"];
  store_kind: RuntimeSchedulerPersistentStoreApprovalPacket["proposed_store_kind"];
  store_reference: string;
  store_namespace: string;
  operations: RuntimeSchedulerPersistentStoreOperation[];
  required_next_confirmation: string;
  implementation_boundary: string;
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; contract_ready_for_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

const REQUIRED_OPERATIONS: RuntimeSchedulerPersistentStoreOperation[] = ["load_queue", "save_queue", "append_event", "mark_published", "mark_failed", "list_due_items"];

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function uniqueOperations(operations: readonly RuntimeSchedulerPersistentStoreOperation[]): RuntimeSchedulerPersistentStoreOperation[] {
  return [...new Set(operations)];
}

function hasRequiredOperations(operations: readonly RuntimeSchedulerPersistentStoreOperation[]): boolean {
  const set = new Set(operations);
  return REQUIRED_OPERATIONS.every((operation) => set.has(operation));
}

function inputReady(input: RuntimeSchedulerPersistentStoreContractInput): boolean {
  return input.allow_contract_only === true
    && input.allow_file_write === false
    && input.allow_database_write === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.contract_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.store_namespace.trim().length > 0
    && hasRequiredOperations(input.operations);
}

function approvalReady(packet: RuntimeSchedulerPersistentStoreApprovalPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.approval_state === "ready_for_operator_confirmation"
    && packet.approval_packet_only
    && packet.decision === "approve_persistent_store_planning"
    && packet.validation.complete
    && packet.validation.ready_for_operator_confirmation
    && packet.source_item_count > 0
    && !packet.file_write_enabled
    && !packet.database_write_enabled
    && !packet.live_scheduler_enabled
    && !packet.upload_execution_enabled
    && !packet.network_enabled
    && !packet.credential_access_enabled
    && !packet.media_read_enabled
    && !packet.git_add_executed
    && !packet.committed_now
    && !packet.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreContract(input: RuntimeSchedulerPersistentStoreContractInput, packet: RuntimeSchedulerPersistentStoreApprovalPacket): RuntimeSchedulerPersistentStoreContract {
  const operations = uniqueOperations(input.operations);
  const ready = inputReady(input) && approvalReady(packet);
  return {
    schema_version: "1.0",
    contract_id: safe(input.contract_id, "runtime-scheduler-persistent-store-contract"),
    contract_state: ready ? "contract_ready_for_review" : "blocked",
    contract_only: true,
    source_approval_state: packet.approval_state,
    store_kind: packet.proposed_store_kind,
    store_reference: safe(packet.proposed_path_or_reference, "blocked-reference"),
    store_namespace: safe(input.store_namespace, "runtime-scheduler"),
    operations: ready ? operations : [],
    required_next_confirmation: ready ? "I approve implementing the persistent scheduler store adapter contract only, with no live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Contract only; adapter implementation may be planned next, but actual writes, migrations, live scheduling, uploads, network, credential access, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked approval packet or unsafe contract input before continuing.",
    file_write_enabled: false,
    database_write_enabled: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, contract_ready_for_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store contract input or approval packet was unsafe/incomplete."], warnings: ["Contract only; no persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreContract(contract: RuntimeSchedulerPersistentStoreContract, reason?: string): RuntimeSchedulerPersistentStoreContract {
  return { ...contract, contract_state: "revoked", operations: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, contract_ready_for_review: false, blocking_reasons: contract.validation.blocking_reasons, warnings: [...contract.validation.warnings, safe(reason, "Runtime scheduler persistent-store contract was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreContract(contract: RuntimeSchedulerPersistentStoreContract): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store contract",
    `State: ${contract.contract_state}`,
    `Store kind: ${contract.store_kind}`,
    `Store reference: ${contract.store_reference}`,
    `Namespace: ${contract.store_namespace}`,
    "Operations:",
    ...(contract.operations.length ? contract.operations.map((operation) => `- ${operation}`) : ["- blocked"]),
    `Required next confirmation: ${contract.required_next_confirmation}`,
    `Implementation boundary: ${contract.implementation_boundary}`,
    `File writes enabled: ${contract.file_write_enabled}`,
    `Database writes enabled: ${contract.database_write_enabled}`,
    `Live scheduler enabled: ${contract.live_scheduler_enabled}`,
  ].join("\n");
}
