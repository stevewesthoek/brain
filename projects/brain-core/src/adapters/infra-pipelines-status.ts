import { getInfraVideoOrchestratorStatus } from './infra-video-orchestrator-status.js';

export interface InfraStbStatus {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  health: 'ok' | 'unreachable' | 'unknown';
  port: number;
  url: string;
  lastChecked: string;
}

export interface InfraVOPipelineSummary {
  status: 'active' | 'error' | 'unknown';
  queueDepth: { pending: number; running: number; failed: number };
  activeAccounts: number;
  lastJobAt: string | null;
  lastChecked: string;
}

export interface InfraPipelinesStatusResponse {
  ok: boolean;
  stb: InfraStbStatus;
  videoOrchestrator: InfraVOPipelineSummary;
}

const STB_HEALTH_URL = 'http://localhost:3058/api/health';
const STB_ADMIN_URL = 'http://localhost:3058/admin';
const STB_PORT = 3058;
const HEALTH_CHECK_TIMEOUT_MS = 2000;

async function checkStbHealth(): Promise<{ alive: boolean }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    const res = await fetch(STB_HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { alive: false };
    const body = await res.json() as { status?: string };
    return { alive: body.status === 'ok' };
  } catch {
    return { alive: false };
  }
}

export async function getInfraPipelinesStatus(): Promise<InfraPipelinesStatusResponse> {
  const now = new Date().toISOString();

  const [stbResult, voResult] = await Promise.allSettled([
    checkStbHealth(),
    getInfraVideoOrchestratorStatus(),
  ]);

  const stbAlive = stbResult.status === 'fulfilled' && stbResult.value.alive;
  const stb: InfraStbStatus = {
    name: 'Says the Bible',
    status: stbAlive ? 'running' : 'stopped',
    health: stbAlive ? 'ok' : 'unreachable',
    port: STB_PORT,
    url: STB_ADMIN_URL,
    lastChecked: now,
  };

  let videoOrchestrator: InfraVOPipelineSummary;
  if (voResult.status === 'fulfilled' && voResult.value.ok) {
    const vo = voResult.value;
    videoOrchestrator = {
      status: 'active',
      queueDepth: vo.queueDepth ?? { pending: 0, running: 0, failed: 0 },
      activeAccounts: vo.activeAccounts ?? 0,
      lastJobAt: vo.lastJobAt ?? null,
      lastChecked: now,
    };
  } else {
    videoOrchestrator = {
      status: 'unknown',
      queueDepth: { pending: 0, running: 0, failed: 0 },
      activeAccounts: 0,
      lastJobAt: null,
      lastChecked: now,
    };
  }

  return { ok: true, stb, videoOrchestrator };
}
