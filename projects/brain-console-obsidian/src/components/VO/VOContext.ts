import type { VOContextState, DateRange } from './types.js';
import { DEFAULT_DATE_RANGE } from './types.js';

type VOContextListener = (state: VOContextState) => void;

const STORAGE_KEY = 'vo-context-state';

function getInitialState(): VOContextState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {
      projectId: null,
      accountId: null,
      platformTargets: [],
      pipelineProfileId: null,
      dateRange: DEFAULT_DATE_RANGE,
    };

    const parsed = JSON.parse(stored);
    return {
      projectId: parsed.projectId ?? null,
      accountId: parsed.accountId ?? null,
      platformTargets: parsed.platformTargets ?? [],
      pipelineProfileId: parsed.pipelineProfileId ?? null,
      dateRange: parsed.dateRange ?? DEFAULT_DATE_RANGE,
    };
  } catch {
    return {
      projectId: null,
      accountId: null,
      platformTargets: [],
      pipelineProfileId: null,
      dateRange: DEFAULT_DATE_RANGE,
    };
  }
}

export class VOContextManager {
  private state: VOContextState = getInitialState();
  private listeners: Set<VOContextListener> = new Set();

  getState(): VOContextState {
    return { ...this.state };
  }

  subscribe(listener: VOContextListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }

  setProjectId(projectId: string | null): void {
    this.state = {
      ...this.state,
      projectId,
      accountId: null,
      platformTargets: [],
      pipelineProfileId: null,
    };
    this.notify();
  }

  setAccountId(accountId: string | null): void {
    this.state = {
      ...this.state,
      accountId,
      platformTargets: [],
    };
    this.notify();
  }

  setPlatformTargets(platformTargets: string[]): void {
    this.state = {
      ...this.state,
      platformTargets,
    };
    this.notify();
  }

  setPipelineProfileId(pipelineProfileId: string | null): void {
    this.state = {
      ...this.state,
      pipelineProfileId,
    };
    this.notify();
  }

  setDateRange(dateRange: DateRange): void {
    this.state = {
      ...this.state,
      dateRange,
    };
    this.notify();
  }

  reset(): void {
    this.state = getInitialState();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail if localStorage is unavailable
    }
    this.notify();
  }
}

// Global singleton instance
let instance: VOContextManager | null = null;

export function getVOContextManager(): VOContextManager {
  if (!instance) {
    instance = new VOContextManager();
  }
  return instance;
}
