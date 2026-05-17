import type { BrainConsoleClientSummary } from './client.js';
import { readBrainConsoleSummary } from './client.js';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, type BrainConsoleSettings } from './settings.js';

export interface BrainConsoleWidgetState {
  status: string;
  summary: BrainConsoleClientSummary | undefined;
  settings: BrainConsoleSettings;
}

export async function createBrainConsoleWidgetState(
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS,
): Promise<BrainConsoleWidgetState> {
  const summary = await readBrainConsoleSummary(settings.brainCoreUrl);
  return {
    status: summary.status,
    summary,
    settings,
  };
}
