export interface ManagedCommandOptions {
  input?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxOutputBytes?: number;
  killGraceMs?: number;
}

export function runManagedCommand(
  command: string,
  args: string[],
  options: ManagedCommandOptions,
): Promise<string>;
