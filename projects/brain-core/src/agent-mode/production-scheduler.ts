import os from 'node:os';
import { existsSync } from 'node:fs';
import { JARVIS_CONTEXT_READY_EVENT } from './event-source.js';
import { JarvisContextIntakeService } from './jarvis-context-intake.js';
import { loadJarvisProductionRuntimeConfiguration, type JarvisProductionRuntimeConfiguration } from './jarvis-production-runtime.js';
import { loadBrainRuntimeConfig } from './portable-runtime-config.js';
import { runAgentModeSchedulerTickAsync, type AgentModeSchedulerEventHandler, type AgentModeSchedulerTickResult } from './scheduler.js';
import { defaultAgentModeDatabasePath, AgentModeSqliteStateStore } from './sqlite-state-store.js';
import type { AgentRuntime } from './runtime-dispatch.js';
import type { JarvisSystemOneReflexHook } from './jarvis-system-one-reflex.js';

const DEFAULT_INTERVAL_MS = 1_000;
const MAX_INTERVAL_MS = 60_000;

export type AgentModeProductionSchedulerOptions = {
  databasePath?: string;
  intervalMs?: number;
  ownerId?: string;
  clock?: () => string;
  home?: string;
  eligibleRoots?: readonly string[];
  writableRoots?: readonly string[];
  codexCommand?: string;
  runtimeFactory?: (store: AgentModeSqliteStateStore) => AgentRuntime;
  productionRuntime?: JarvisProductionRuntimeConfiguration;
  reflex?: JarvisSystemOneReflexHook;
};

function boundedInterval(value: number | undefined): number {
  return Math.max(100, Math.min(MAX_INTERVAL_MS, Math.floor(value ?? DEFAULT_INTERVAL_MS)));
}

function rootGoalId(event: { payload: Record<string, unknown> }): string {
  const value = event.payload.rootGoalId;
  if (typeof value !== 'string' || value.length === 0) throw new Error('JARVIS_ROOT_GOAL_MISSING');
  return value;
}

/**
 * The one Core-owned long-lived consumer for Agent Mode scheduler events.
 * SQLite remains the queue and lease authority; this class only supplies the
 * process lifecycle and the production runtime factory around the shared pass.
 */
export class AgentModeProductionScheduler {
  private readonly databasePath: string;
  private readonly intervalMs: number;
  private readonly ownerId: string;
  private readonly clock: () => string;
  private readonly options: AgentModeProductionSchedulerOptions;
  private timer: ReturnType<typeof setInterval> | undefined;
  private activeTick: Promise<AgentModeSchedulerTickResult | null> | undefined;

  constructor(options: AgentModeProductionSchedulerOptions = {}) {
    this.databasePath = options.databasePath ?? defaultAgentModeDatabasePath();
    this.intervalMs = boundedInterval(options.intervalMs);
    this.ownerId = options.ownerId ?? 'brain-agent-core-scheduler';
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.options = options;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.runOnce(); }, this.intervalMs);
    void this.runOnce();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.activeTick;
  }

  runOnce(): Promise<AgentModeSchedulerTickResult | null> {
    if (this.activeTick) return this.activeTick;
    const task = this.executeOnce().finally(() => {
      if (this.activeTick === task) this.activeTick = undefined;
    });
    this.activeTick = task;
    return task;
  }

  private async executeOnce(): Promise<AgentModeSchedulerTickResult | null> {
    if (!existsSync(this.databasePath)) return null;
    const store = new AgentModeSqliteStateStore(this.databasePath);
    try {
      const config = this.options.runtimeFactory && this.options.eligibleRoots ? undefined : loadBrainRuntimeConfig();
      const productionRuntime = this.options.runtimeFactory
        ? undefined
        : this.options.productionRuntime ?? loadJarvisProductionRuntimeConfiguration(this.clock());
      const runtimeFactory = this.options.runtimeFactory ?? productionRuntime?.runtimeFactory;
      if (!runtimeFactory) {
        return await runAgentModeSchedulerTickAsync({
          store,
          ownerId: this.ownerId,
          clock: this.clock,
          eventHandlers: new Map(),
        });
      }
      const runtimeOptions = this.options.runtimeFactory
        ? { runtimeFactory }
        : productionRuntime
          ? { productionRuntime }
          : {};
      const service = new JarvisContextIntakeService(store, {
        home: this.options.home ?? os.homedir(),
        eligibleRoots: this.options.eligibleRoots ?? config!.eligibleLocalRoots,
        writableRoots: this.options.writableRoots ?? config!.writableLocalRoots,
        now: this.clock(),
      }, this.clock, { ...runtimeOptions, ...(this.options.reflex ? { reflex: this.options.reflex } : {}) });
      const eventHandlers = new Map<string, AgentModeSchedulerEventHandler>([
        [JARVIS_CONTEXT_READY_EVENT, ({ event, claim, now }) => service.execute(rootGoalId(event), event.eventId, claim)],
      ]);
      return await runAgentModeSchedulerTickAsync({ store, ownerId: this.ownerId, clock: this.clock, eventHandlers });
    } finally {
      store.close();
    }
  }
}

export function createAgentModeProductionScheduler(options: AgentModeProductionSchedulerOptions = {}): AgentModeProductionScheduler {
  return new AgentModeProductionScheduler(options);
}
