import { spawn } from 'node:child_process';

export function runManagedCommand(command, args, options) {
  const maxOutputBytes = options.maxOutputBytes ?? 5 * 1024 * 1024;
  const killGraceMs = options.killGraceMs ?? 1_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    let outputBytes = 0;
    let failure;
    let killTimer;

    const terminate = (error) => {
      failure ??= error;
      if (child.exitCode !== null || child.signalCode !== null || killTimer) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, killGraceMs);
    };

    const collect = (chunk, retain) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        terminate(new Error(`${command} exceeded the bounded output limit`));
        return;
      }
      if (retain) stdout.push(chunk);
    };

    child.stdout.on('data', (chunk) => collect(chunk, true));
    child.stderr.on('data', (chunk) => collect(chunk, false));
    child.stdin.on('error', (error) => terminate(error));
    child.on('error', (error) => { failure ??= error; });

    const timeoutTimer = setTimeout(() => {
      terminate(new Error(`${command} timed out`));
    }, options.timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (failure) {
        reject(failure);
      } else if (code !== 0) {
        reject(new Error(`${command} exited unsuccessfully`));
      } else {
        resolve(Buffer.concat(stdout).toString('utf8'));
      }
    });

    try {
      child.stdin.end(options.input ?? '');
    } catch (error) {
      terminate(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
