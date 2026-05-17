import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreLocalAppSummary } from '../types/api.js';

const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build'];

const PLACEHOLDER_APPS: BrainCoreLocalAppSummary[] = [
  {
    id: 'probot',
    name: 'ProBot legacy dashboard/client service',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
  {
    id: 'office-scheduler',
    name: 'Office Nightly Scheduler',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
];

export function listLocalApps(): BrainCoreLocalAppSummary[] {
  const report = readLocalAppsRuntimeReport();
  if (!report || report.status === 'missing') {
    return PLACEHOLDER_APPS;
  }
  if (report.status === 'invalid') {
    return [
      {
        id: 'local-apps-report',
        name: 'Local apps report invalid',
        status: 'unknown',
        source: 'runtime-report',
        actionsSupported: false,
      },
    ];
  }

  return (report.apps ?? []).map((app, index) => ({
    id: safeText(app.id, `local-app-${index + 1}`),
    name: safeText(app.name, 'Unnamed local app'),
    status: normalizeStatus(app.status),
    source: 'runtime-report',
    actionsSupported: false,
  }));
}

function readLocalAppsRuntimeReport(): LocalAppsRuntimeReport | undefined {
  const configuredPath = process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
  const defaultPath = path.resolve(process.cwd(), 'runtime/local/local-apps/latest.json');
  const resolved = configuredPath ? resolveSafeRuntimePath(configuredPath) : defaultPath;
  if (!resolved || !fs.existsSync(resolved)) {
    return undefined;
  }

  try {
    const body = JSON.parse(fs.readFileSync(resolved, 'utf8')) as LocalAppsRuntimeReport;
    if (body.executableActions || body.writesToMind) {
      return { status: 'invalid', message: 'Local apps report declares unsupported execution flags.', apps: [] };
    }
    return body;
  } catch {
    return { status: 'invalid', message: 'Local apps report JSON could not be parsed safely.', apps: [] };
  }
}

function resolveSafeRuntimePath(rawPath: string): string | undefined {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (DISALLOWED_SEGMENTS.some((segment) => segments.includes(segment))) {
    return undefined;
  }
  if (segments.includes('mind')) {
    return undefined;
  }
  return path.resolve(rawPath);
}

function normalizeStatus(status: LocalAppsRuntimeReport['apps'][number]['status']): BrainCoreLocalAppSummary['status'] {
  return status === 'running' || status === 'stopped' || status === 'disabled' ? status : 'unknown';
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

interface LocalAppsRuntimeReport {
  status: 'ok' | 'failed' | 'unknown' | 'available' | 'invalid' | 'missing';
  apps: Array<{
    id?: string;
    name?: string;
    status?: 'unknown' | 'disabled' | 'running' | 'stopped';
    actionsSupported?: boolean;
  }>;
  writesToMind?: false;
  executableActions?: false;
  message?: string;
}
