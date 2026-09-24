import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

function lifecyclePersistenceError(processMayHaveStarted) {
  const error = new Error('managed provider lifecycle persistence failed');
  error.name = 'ProviderLifecyclePersistenceError';
  error.code = 'BRAIN_PROVIDER_LIFECYCLE_PERSISTENCE_FAILED';
  error.providerEffectMayHaveStarted = processMayHaveStarted;
  return error;
}

function safeErrorKind(error) {
  if (error?.code === 'ETIMEDOUT' || /timed out/i.test(error?.message ?? '')) return 'timeout';
  if (/bounded output limit/i.test(error?.message ?? '')) return 'output_limit';
  return 'spawn_error';
}

export function runManagedCommand(command, args, options) {
  const maxOutputBytes = options.maxOutputBytes ?? 5 * 1024 * 1024;
  const killGraceMs = options.killGraceMs ?? 1_000;
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const stdout = [];
    const stderr = [];
    let child;
    let outputBytes = 0;
    let failure;
    let killTimer;
    let processStarted = false;
    let lifecyclePersistenceFailed = false;

    const emit = (event) => {
      if (lifecyclePersistenceFailed || typeof options.onLifecycleEvent !== 'function') return !lifecyclePersistenceFailed;
      try {
        options.onLifecycleEvent({
          ...event,
          elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
        });
        return true;
      } catch {
        lifecyclePersistenceFailed = true;
        failure = lifecyclePersistenceError(processStarted);
        return false;
      }
    };

    const terminate = (error) => {
      failure ??= error;
      if (!child || child.exitCode !== null || child.signalCode !== null || killTimer) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, killGraceMs);
    };

    if (!emit({ stage: 'provider_command_prepare' }) || !emit({ stage: 'provider_command_spawn_start' })) {
      reject(failure ?? lifecyclePersistenceError(false));
      return;
    }

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      emit({ stage: 'provider_command_spawn_failure', errorKind: 'spawn_error' });
      reject(failure ?? Object.assign(new Error('managed command could not be started'), { code: 'ENOENT' }));
      return;
    }

    const collect = (chunk, retain) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        terminate(new Error(`${command} exceeded the bounded output limit`));
        return;
      }
      if (retain) stdout.push(chunk);
      else stderr.push(chunk);
    };

    child.stdout.on('data', (chunk) => collect(chunk, true));
    child.stderr.on('data', (chunk) => collect(chunk, false));
    child.stdin.on('error', (error) => terminate(error));
    child.on('spawn', () => {
      processStarted = true;
      if (!emit({ stage: 'provider_command_spawn_success' })) terminate(failure);
    });
    child.on('error', (error) => {
      failure ??= error;
      if (!processStarted) emit({ stage: 'provider_command_spawn_failure', errorKind: 'spawn_error' });
    });

    const timeoutTimer = setTimeout(() => {
      terminate(new Error(`${command} timed out`));
    }, options.timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (processStarted && typeof code === 'number') emit({ stage: 'provider_process_exit', exitCode: code, ...(failure ? { errorKind: safeErrorKind(failure) } : {}) });
      if (processStarted && signal) emit({ stage: 'provider_process_signal', signal });
      emit({ stage: 'provider_stderr_present', stderrPresent: stderr.length > 0 });

      const processFailed = Boolean(failure) || code !== 0 || Boolean(signal);
      let providerDiagnostic;
      let awsCode;
      if (processFailed && processStarted) {
        const diagnostic = Buffer.concat(stderr).toString('utf8');
        awsCode = diagnostic.match(/An error occurred \(([^)]+)\)/)?.[1];
        if (diagnostic.length > 0 && typeof options.failureDiagnosticParser === 'function') {
          emit({ stage: 'provider_error_parse_start' });
          let parserThrew = false;
          try {
            providerDiagnostic = options.failureDiagnosticParser(diagnostic);
          } catch {
            parserThrew = true;
          }
          if (!lifecyclePersistenceFailed) {
            emit(parserThrew
              ? { stage: 'provider_error_parse_failure', parserOutcome: 'failure', errorKind: 'parser_failure' }
              : providerDiagnostic
                ? { stage: 'provider_error_parse_success', parserOutcome: 'success' }
                : { stage: 'provider_error_parse_failure', parserOutcome: 'failure', errorKind: 'malformed_error_output' });
          }
        } else if (processFailed) {
          emit({ stage: 'provider_error_parse_start' });
          emit({ stage: 'provider_error_parse_failure', parserOutcome: 'failure', errorKind: diagnostic.length === 0 ? 'empty_stderr' : 'parser_failure' });
        }
      }

      if (lifecyclePersistenceFailed) {
        reject(failure ?? lifecyclePersistenceError(processStarted));
      } else if (processFailed) {
        const error = failure ?? new Error(`${command} exited unsuccessfully`);
        if (!failure && awsCode) error.code = awsCode;
        if (providerDiagnostic && typeof providerDiagnostic === 'object') error.providerDiagnostic = providerDiagnostic;
        reject(error);
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
