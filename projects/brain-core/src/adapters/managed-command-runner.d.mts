import type { ManagedProviderLifecycleEvent } from '../agent-mode/model-gateway.js';

export interface ManagedCommandOptions {
  input?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxOutputBytes?: number;
  killGraceMs?: number;
  failureDiagnosticParser?: (stderr: string) => Record<string, string | number> | undefined;
  onLifecycleEvent?: (event: ManagedProviderLifecycleEvent) => void;
}

export function runManagedCommand(
  command: string,
  args: string[],
  options: ManagedCommandOptions,
): Promise<string>;
