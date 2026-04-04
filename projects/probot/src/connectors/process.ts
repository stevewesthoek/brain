import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runCommand(
  command: string,
  args: string[],
  timeoutMs = 10_000,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
}
