import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export type RuntimeProcessIdentity = {
  startedAt: string;
  command: string;
  token: string;
};

export type RuntimeProcessIdentityOptions = {
  commandMarker?: string;
  commandIdentity?: string;
};

function observed(pid: number, options: RuntimeProcessIdentityOptions = {}): Omit<RuntimeProcessIdentity, 'token'> | undefined {
  try {
    const startedAt = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8' }).trim();
    const observedCommand = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim();
    const commandMarker = options.commandMarker ?? 'brain-agent';
    if (!startedAt || !observedCommand || !observedCommand.includes(commandMarker)) return undefined;
    return { startedAt, command: options.commandIdentity ?? observedCommand };
  } catch {
    return undefined;
  }
}

export function readRuntimeProcessIdentity(pid: number, runId: string, options: RuntimeProcessIdentityOptions = {}): RuntimeProcessIdentity | undefined {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !runId) return undefined;
  const value = observed(pid, options);
  if (!value) return undefined;
  return { ...value, token: createHash('sha256').update(JSON.stringify({ pid, runId, ...value })).digest('hex') };
}

export function verifyRuntimeProcessIdentity(pid: number | undefined, runId: string, identity: RuntimeProcessIdentity | undefined, options: RuntimeProcessIdentityOptions = {}): boolean {
  if (!pid || !identity) return false;
  const current = readRuntimeProcessIdentity(pid, runId, options);
  return Boolean(current
    && current.startedAt === identity.startedAt
    && current.command === identity.command
    && current.token === identity.token);
}
