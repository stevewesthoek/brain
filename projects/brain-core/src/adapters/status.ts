import os from 'node:os';
import type { BrainCoreStatus } from '../types/api.js';

export function createStatusAdapter(input: {
  startedAt: Date;
  version: string;
}): () => BrainCoreStatus {
  return () => {
    const now = Date.now();
    const startedAtMs = input.startedAt.getTime();
    const generationModeRuntime = process.env.AWS_VIDEO_GENERATION_MODE || 'fixture';

    return {
      service: 'brain-core',
      mode: 'read-only',
      ok: true,
      startedAt: input.startedAt.toISOString(),
      uptimeSeconds: Math.max(0, Math.floor((now - startedAtMs) / 1000)),
      version: input.version,
      host: os.hostname(),
      generationModeRuntime,
    };
  };
}
