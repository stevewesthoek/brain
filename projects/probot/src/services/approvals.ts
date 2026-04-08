import type { AppContext } from "../types/app.js";
import type { ApprovalRecord } from "../store/db.js";
import { describeRunPresets, executeRunPreset } from "./operations.js";

interface SendFilePayload {
  path: string;
}

interface RunPresetPayload {
  preset: string;
}

export interface ApprovalDecisionResult {
  statusText: string;
  messageText: string;
  filePath?: string;
}

function parsePayload<T>(record: ApprovalRecord): T | null {
  try {
    return JSON.parse(record.payloadJson) as T;
  } catch {
    return null;
  }
}

function isExpired(record: ApprovalRecord): boolean {
  return new Date(record.expiresAt).getTime() < Date.now();
}

export function formatPendingApprovals(app: AppContext, limit = 5): string {
  const pending = app.approvals.list("pending", limit);
  if (pending.length === 0) {
    return "No pending approvals.";
  }

  return pending
    .map((record) => {
      let detail = "";
      if (record.kind === "send_file") {
        const payload = parsePayload<SendFilePayload>(record);
        detail = payload?.path ?? "(unknown file)";
      } else if (record.kind === "run_preset") {
        const payload = parsePayload<RunPresetPayload>(record);
        detail = payload?.preset ?? "(unknown preset)";
      }

      return `${record.id} · ${record.kind} · expires ${record.expiresAt}${detail ? `\n${detail}` : ""}`;
    })
    .join("\n\n");
}

export async function handleApprovalDecision(
  app: AppContext,
  approvalId: string,
  decision: "approve" | "reject",
  transport: "slack" | "telegram",
): Promise<ApprovalDecisionResult> {
  const record = app.approvals.get(approvalId);
  if (!record) {
    return {
      statusText: "Approval not found.",
      messageText: "Approval not found.",
    };
  }

  if (record.status !== "pending") {
    return {
      statusText: "Approval already handled.",
      messageText: `Approval ${approvalId} is already ${record.status}.`,
    };
  }

  if (isExpired(record)) {
    app.approvals.updateStatus(approvalId, "expired");
    return {
      statusText: "Approval expired.",
      messageText: `Approval ${approvalId} expired.`,
    };
  }

  if (decision === "reject") {
    app.approvals.updateStatus(approvalId, "rejected");
    return {
      statusText: "Rejected.",
      messageText: `Rejected approval ${approvalId}.`,
    };
  }

  if (record.kind === "send_file") {
    const payload = parsePayload<SendFilePayload>(record);
    if (!payload?.path) {
      return {
        statusText: "Invalid approval payload.",
        messageText: "Invalid send-file approval payload.",
      };
    }

    if (transport !== "telegram") {
      return {
        statusText: "Unsupported transport.",
        messageText: "File-send approvals can only be completed from Telegram.",
      };
    }

    app.approvals.updateStatus(approvalId, "approved");
    return {
      statusText: "Approved.",
      messageText: `Sent file:\n${payload.path}`,
      filePath: payload.path,
    };
  }

  if (record.kind === "run_preset") {
    const payload = parsePayload<RunPresetPayload>(record);
    if (!payload?.preset) {
      return {
        statusText: "Invalid approval payload.",
        messageText: `Invalid run-preset approval payload.\n\nAvailable presets:\n${describeRunPresets()}`,
      };
    }

    const result = await executeRunPreset(payload.preset);
    app.approvals.updateStatus(approvalId, "approved");
    return {
      statusText: "Approved.",
      messageText: result,
    };
  }

  return {
    statusText: "Unknown approval action.",
    messageText: `Unknown approval kind: ${record.kind}`,
  };
}
