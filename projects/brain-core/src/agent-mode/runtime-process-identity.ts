import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export type RuntimeProcessIdentity = {
  startedAt: string;
  command: string;
  token: string;
};

function observed(pid: number): Omit<RuntimeProcessIdentity, 'token'> | undefined {
  try {
    const startedAt = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8' }).trim();
    const command = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim();
    if (!startedAt || !command || !command.includes('brain-agent')) return undefined;
    return { startedAt, command };
  } catch {
    return undefined;
  }
}

export function readRuntimeProcessIdentity(pid: number, runId: string): RuntimeProcessIdentity | undefined {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !runId) return undefined;
  const value = observed(pid);
  if (!value) return undefined;
  return { ...value, token: createHash('sha256').update(JSON.stringify({ pid, runId, ...value })).digest('hex') };
}

export function verifyRuntimeProcessIdentity(pid: number | undefined, runId: string, identity: RuntimeProcessIdentity | undefined): boolean {
  if (!pid || !identity) return false;
  const current = readRuntimeProcessIdentity(pid, runId);
  return Boolean(current
    && current.startedAt === identity.startedAt
    && current.command === identity.command
    && current.token === identity.token);
}
