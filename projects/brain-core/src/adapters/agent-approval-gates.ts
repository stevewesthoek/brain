import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listApprovalRecords, getApprovalStoreSummary, listApprovalAuditEvents } from './actions.js';
import type {
  BrainCoreAgentApprovalGateSummary,
  BrainCoreApprovalRecord,
} from '../types/api.js';

const DEFAULT_APPROVAL_GATE_PATH = path.join(
  os.homedir(),
  '.local',
  'video-orchestrator',
  'state',
  'agent-approval-gates.json',
);

interface AgentApprovalGateSnapshotFile {
  approvalGates?: BrainCoreAgentApprovalGateSummary;
}

export function readAgentApprovalGates(): BrainCoreAgentApprovalGateSummary {
  const snapshot = readSnapshotFile<AgentApprovalGateSnapshotFile>(DEFAULT_APPROVAL_GATE_PATH)?.approvalGates;

  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
      status: 'snapshot',
      persistence: {
        enabled: true,
        path: DEFAULT_APPROVAL_GATE_PATH,
        loadedFromDisk: true,
      },
    };
  }

  const approvals = listApprovalRecords().filter((approval) => approval.status !== 'placeholder');
  const audits = listApprovalAuditEvents();
  const store = getApprovalStoreSummary();
  const supportedApprovalKinds = [...new Set(approvals.map((approval) => approval.kind))].sort();
  const blockedApprovalKinds = approvals
    .filter((approval) => approval.status === 'expired' || approval.status === 'rejected')
    .map((approval) => approval.kind)
    .sort();

  return {
    id: 'agent-approval-gates',
    generatedAt: new Date().toISOString(),
    source: 'derived',
    status: 'read-only',
    approvalStoreEnabled: store.enabled,
    approvalStoreStatus: store.status,
    approvalStorePath: store.path,
    pendingCount: approvals.filter((approval) => approval.status === 'pending').length,
    approvedCount: approvals.filter((approval) => approval.status === 'approved').length,
    rejectedCount: approvals.filter((approval) => approval.status === 'rejected').length,
    expiredCount: approvals.filter((approval) => approval.status === 'expired').length,
    supportedApprovalKinds,
    blockedApprovalKinds,
    nextSafeStep: audits.length > 0
      ? 'Review the latest approval audit records before allowing any approval-bound execution.'
      : 'Request an approval to seed the gate record, then inspect the audit log before execution.',
    persistence: {
      enabled: fs.existsSync(DEFAULT_APPROVAL_GATE_PATH),
      path: DEFAULT_APPROVAL_GATE_PATH,
      loadedFromDisk: false,
    },
  };
}

export function saveAgentApprovalGatesSnapshot(approvalGates: BrainCoreAgentApprovalGateSummary): boolean {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_APPROVAL_GATE_PATH), { recursive: true });
    const payload = `${JSON.stringify(
      {
        approvalGates: {
          ...approvalGates,
          source: 'snapshot',
          status: 'snapshot',
          persistence: {
            enabled: true,
            path: DEFAULT_APPROVAL_GATE_PATH,
            loadedFromDisk: true,
          },
        },
      } satisfies AgentApprovalGateSnapshotFile,
      null,
      2,
    )}\n`;
    fs.writeFileSync(DEFAULT_APPROVAL_GATE_PATH, payload);
    return true;
  } catch {
    return false;
  }
}

function readSnapshotFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}
