import type { BrainConsoleClientSummary } from './client.js';
import { readBrainConsoleSummary } from './client.js';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';

export type BrainConsoleWidgetId =
  | 'brain-status'
  | 'brain-sessions'
  | 'brain-repos'
  | 'brain-orchestrators'
  | 'brain-capabilities'
  | 'brain-scheduler'
  | 'brain-local-apps'
  | 'brain-video'
  | 'brain-approvals'
  | 'brain-runtime-reports';

export interface BrainConsoleWidgetCard {
  id: BrainConsoleWidgetId;
  title: string;
  value: string;
  tone: 'ok' | 'warn' | 'muted';
}

export interface BrainConsoleViewModel {
  status: string;
  manualRefreshLabel: string;
  widgets: BrainConsoleWidgetCard[];
  settings: BrainConsoleSettings;
  warning?: string;
}

export async function createBrainConsoleViewModel(
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS,
): Promise<BrainConsoleViewModel> {
  const normalized = normalizeBrainCoreUrl(settings.brainCoreUrl);
  const resolvedSettings: BrainConsoleSettings = {
    brainCoreUrl: normalized.value,
  };
  const summary = await readBrainConsoleSummary(resolvedSettings.brainCoreUrl);

  return {
    status: summary.status,
    manualRefreshLabel: 'Manual refresh only',
    widgets: createWidgets(summary),
    settings: resolvedSettings,
    warning: normalized.warning ?? normalized.error,
  };
}

export function createWidgets(summary: BrainConsoleClientSummary | undefined): BrainConsoleWidgetCard[] {
  const offline = summary === undefined;

  return [
    widget('brain-status', 'Status', offline ? 'Brain Core offline' : summary.status),
    widget('brain-sessions', 'Sessions', offline ? 'Unavailable' : summary.sessions),
    widget('brain-repos', 'Repos', offline ? 'Unavailable' : summary.repos),
    widget('brain-orchestrators', 'Orchestrators', offline ? 'Unavailable' : summary.orchestrators),
    widget('brain-capabilities', 'Capabilities', offline ? 'Unavailable' : summary.capabilities),
    widget('brain-scheduler', 'Scheduler', offline ? 'Unavailable' : summary.scheduler),
    widget('brain-local-apps', 'Local Apps', offline ? 'Unavailable' : summary.localApps),
    widget('brain-video', 'Video', offline ? 'Unavailable' : summary.video),
    widget('brain-approvals', 'Approvals', offline ? 'Unavailable' : summary.approvals),
    widget('brain-runtime-reports', 'Runtime Reports', offline ? 'Unavailable' : summary.runtimeReports),
  ];
}

function widget(id: BrainConsoleWidgetId, title: string, value: string): BrainConsoleWidgetCard {
  const tone: BrainConsoleWidgetCard['tone'] = value.includes('unavailable') || value.includes('offline') ? 'warn' : 'ok';
  return { id, title, value, tone };
}
