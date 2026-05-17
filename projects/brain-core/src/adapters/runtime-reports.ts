import fs from 'node:fs';
import path from 'node:path';
import { getDefaultAuditPath } from './actions.js';
import type {
  BrainCoreRuntimeReportSummary,
  BrainCoreRuntimeReportStatus,
} from '../types/api.js';

const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', '/mind/', '/mind\\', '/Mind/'];

export function listRuntimeReports(): BrainCoreRuntimeReportSummary[] {
  return [
    readJsonRuntimeReport({
      id: 'model-router',
      envPath: process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH,
      defaultPath: path.resolve(process.cwd(), 'runtime/local/model-router/latest.json'),
      fallbackMessage: 'Model-router dry-run report not connected yet.',
    }),
    readApprovalAuditReport(),
    {
      id: 'video',
      status: 'missing',
      path: 'runtime/local/video/latest.json',
      latestRunStatus: 'unknown',
      message: 'Video runtime report not connected yet',
      writesToMind: false,
      executableActions: false,
    },
  ];
}

function readApprovalAuditReport(): BrainCoreRuntimeReportSummary {
  const defaultPath = getDefaultAuditPath();
  const configuredPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const resolved = configuredPath ? resolveSafeRuntimePath(configuredPath) : defaultPath;

  if (!resolved) {
    return {
      id: 'approval-audit',
      status: 'invalid',
      path: 'runtime/local/brain-core/approval-audit.jsonl',
      latestRunStatus: 'unknown',
      message: 'Approval audit path is unsafe or invalid.',
      writesToMind: false,
      executableActions: false,
    };
  }

  if (!fs.existsSync(resolved)) {
    return {
      id: 'approval-audit',
      status: 'missing',
      path: relativeRuntimePath(resolved),
      latestRunStatus: 'unknown',
      message: 'Approval audit JSONL report not connected yet.',
      writesToMind: false,
      executableActions: false,
    };
  }

  try {
    if (fs.readFileSync(resolved, 'utf8').trim().length === 0) {
      return {
        id: 'approval-audit',
        status: 'missing',
        path: relativeRuntimePath(resolved),
        latestRunStatus: 'unknown',
        message: 'Approval audit JSONL report is empty.',
        writesToMind: false,
        executableActions: false,
      };
    }
    return {
      id: 'approval-audit',
      status: 'available',
      path: relativeRuntimePath(resolved),
      latestRunStatus: 'unknown',
      message: 'Approval audit JSONL report is available.',
      writesToMind: false,
      executableActions: false,
    };
  } catch {
    return {
      id: 'approval-audit',
      status: 'invalid',
      path: relativeRuntimePath(resolved),
      latestRunStatus: 'unknown',
      message: 'Approval audit report could not be read safely.',
      writesToMind: false,
      executableActions: false,
    };
  }
}

function readJsonRuntimeReport(input: {
  id: 'model-router';
  envPath: string | undefined;
  defaultPath: string;
  fallbackMessage: string;
}): BrainCoreRuntimeReportSummary {
  const resolved = input.envPath ? resolveSafeRuntimePath(input.envPath) : input.defaultPath;

  if (!resolved) {
    return invalidRuntimeReport(input.id, input.defaultPath, 'Runtime report path is unsafe or invalid.');
  }

  if (!fs.existsSync(resolved)) {
    return missingRuntimeReport(input.id, relativeRuntimePath(resolved), input.fallbackMessage);
  }

  try {
    const body = JSON.parse(fs.readFileSync(resolved, 'utf8')) as { status?: string; message?: string; endedAtLisbon?: string };
    const latestRunStatus = body.status === 'success' ? 'ok' : body.status === 'failed' ? 'failed' : 'unknown';
    return {
      id: input.id,
      status: 'available',
      path: relativeRuntimePath(resolved),
      latestRunStatus,
      message: body.message || 'Runtime report is available.',
      writesToMind: false,
      executableActions: false,
    };
  } catch {
    return invalidRuntimeReport(input.id, relativeRuntimePath(resolved), 'Runtime report JSON could not be parsed safely.');
  }
}

function missingRuntimeReport(
  id: BrainCoreRuntimeReportSummary['id'],
  reportPath: string,
  message: string,
): BrainCoreRuntimeReportSummary {
  return {
    id,
    status: 'missing',
    path: reportPath,
    latestRunStatus: 'unknown',
    message,
    writesToMind: false,
    executableActions: false,
  };
}

function invalidRuntimeReport(
  id: BrainCoreRuntimeReportSummary['id'],
  reportPath: string,
  message: string,
): BrainCoreRuntimeReportSummary {
  return {
    id,
    status: 'invalid',
    path: reportPath,
    latestRunStatus: 'unknown',
    message,
    writesToMind: false,
    executableActions: false,
  };
}

function resolveSafeRuntimePath(rawPath: string): string | undefined {
  const normalized = rawPath.replace(/\\/g, '/').toLowerCase();
  if (DISALLOWED_SEGMENTS.some((segment) => normalized.includes(segment))) {
    return undefined;
  }

  return path.resolve(rawPath);
}

function relativeRuntimePath(resolvedPath: string): string {
  const root = path.resolve(process.cwd());
  const relative = path.relative(root, resolvedPath);
  return relative || path.basename(resolvedPath);
}
