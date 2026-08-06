/**
 * b8-1-process-metrics.mjs — Bounded macOS child-process sampler using /usr/bin/time -l.
 *
 * Executes a child process in a bounded subprocess group, captures /usr/bin/time metrics,
 * and parses CPU %, wall time, and peak RSS (in MB).
 *
 * All measurements are real; no injected test values in production results.
 */

import { spawn } from 'node:child_process';
import os from 'node:os';

/**
 * Parse /usr/bin/time -l stderr output (macOS).
 * Returns { wallSeconds, userSeconds, systemSeconds, rssBytes, parsed: true/false }
 *
 * macOS time -l format (note: indentation, "real", "user", "sys" on same line):
 *   "        0.00 real         0.00 user         0.00 sys"
 *   "             1228800  maximum resident set size"
 */
export function parseTimeOutput(stderr) {
  if (!stderr || typeof stderr !== 'string') {
    return { wallSeconds: null, userSeconds: null, systemSeconds: null, rssBytes: null, parsed: false };
  }

  let wallSeconds = null;
  let userSeconds = null;
  let systemSeconds = null;
  let rssBytes = null;

  // Parse "X real Y user Z sys" line (allows leading whitespace)
  const timeMatch = stderr.match(/\s+([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys/);
  if (timeMatch) {
    wallSeconds = parseFloat(timeMatch[1]);
    userSeconds = parseFloat(timeMatch[2]);
    systemSeconds = parseFloat(timeMatch[3]);
  }

  // Parse "N maximum resident set size" line (allows leading whitespace)
  const rssMatch = stderr.match(/\s+(\d+)\s+maximum resident set size/);
  if (rssMatch) {
    rssBytes = parseInt(rssMatch[1], 10);
  }

  const parsed = wallSeconds !== null && userSeconds !== null && systemSeconds !== null && rssBytes !== null;
  return { wallSeconds, userSeconds, systemSeconds, rssBytes, parsed };
}

/**
 * Validate parsed time metrics. Reject negative, malformed, or contradictory values.
 * Allow zero wall time (fast commands may round to 0.00).
 * Returns { valid: true/false, reason: string }
 */
export function validateTimeMetrics(metrics) {
  if (!metrics.parsed) {
    return { valid: false, reason: 'time output not parsed' };
  }

  if (typeof metrics.wallSeconds !== 'number' || metrics.wallSeconds < 0) {
    return { valid: false, reason: `wallSeconds invalid: ${metrics.wallSeconds}` };
  }
  if (typeof metrics.userSeconds !== 'number' || metrics.userSeconds < 0) {
    return { valid: false, reason: `userSeconds invalid: ${metrics.userSeconds}` };
  }
  if (typeof metrics.systemSeconds !== 'number' || metrics.systemSeconds < 0) {
    return { valid: false, reason: `systemSeconds invalid: ${metrics.systemSeconds}` };
  }
  if (typeof metrics.rssBytes !== 'number' || metrics.rssBytes < 0) {
    return { valid: false, reason: `rssBytes invalid: ${metrics.rssBytes}` };
  }

  // Check for contradiction: CPU time should be <= wall time
  const totalCpuSeconds = metrics.userSeconds + metrics.systemSeconds;
  if (totalCpuSeconds > metrics.wallSeconds + 0.1) { // allow 100ms tolerance for rounding
    return { valid: false, reason: `CPU time ${totalCpuSeconds}s exceeds wall time ${metrics.wallSeconds}s` };
  }

  return { valid: true };
}

/**
 * Compute CPU percent from user + system seconds divided by wall seconds.
 * For zero wall time with zero CPU, return 0% (fast command).
 * For zero wall time with nonzero CPU, reject (contradictory measurement).
 * Returns { cpuPercent: number, isValid: boolean }
 */
export function computeCpuPercent(wallSeconds, userSeconds, systemSeconds) {
  if (wallSeconds < 0 || userSeconds < 0 || systemSeconds < 0) {
    return { cpuPercent: null, isValid: false };
  }
  // For zero wall time with zero CPU (very fast commands), CPU is 0%
  if (wallSeconds === 0) {
    const totalCpuSeconds = userSeconds + systemSeconds;
    if (totalCpuSeconds > 0) {
      return { cpuPercent: null, isValid: false }; // Contradictory: CPU time without wall time
    }
    return { cpuPercent: 0, isValid: true };
  }
  const cpuPercent = ((userSeconds + systemSeconds) / wallSeconds) * 100;
  // Clamp to [0, 100*NUM_CORES] realistic range on this machine
  const numCores = os.cpus().length;
  const maxCpuPercent = 100 * numCores;
  if (cpuPercent < 0 || cpuPercent > maxCpuPercent + 10) { // allow 10% overshoot for sampling variance
    return { cpuPercent: null, isValid: false };
  }
  return { cpuPercent, isValid: true };
}

/**
 * Execute a child process with /usr/bin/time -l wrapper.
 * Terminate the complete process group on timeout.
 *
 * @param {object} opts
 * @param {string} opts.executable - absolute path to the executable
 * @param {array} opts.argv - command arguments (excluding executable name)
 * @param {string} [opts.cwd] - working directory
 * @param {object} [opts.env] - explicit environment (merged with process.env)
 * @param {number} [opts.timeout] - timeout in milliseconds (0 = no timeout)
 * @param {boolean} [opts.detached] - use process group for cleanup
 * @returns {Promise<{
 *   success: boolean,
 *   cpuPercent: number|null,
 *   peakRssMb: number|null,
 *   wallMs: number|null,
 *   stdout: string,
 *   stderr: string,
 *   exitCode: number|null,
 *   signal: string|null,
 *   timedOut: boolean,
 *   provenance: {method, samplerExecutable, childExecutable, pid, exitCode, signal, durationMs, timeoutMs}
 * }>}
 */
export async function runChildWithTimeMetrics(opts = {}) {
  const { executable, argv, cwd, env, timeout = 0, detached = true } = opts;

  if (!executable || !Array.isArray(argv)) {
    return {
      success: false,
      cpuPercent: null,
      peakRssMb: null,
      wallMs: null,
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: null,
      timedOut: false,
      provenance: {
        method: '/usr/bin/time -l',
        samplerExecutable: '/usr/bin/time',
        childExecutable: executable,
        pid: null,
        exitCode: null,
        signal: null,
        durationMs: null,
        timeoutMs: timeout,
      },
    };
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    let timedOut = false;
    let timeoutHandle = null;

    // Spawn /usr/bin/time with the child executable
    const timeProcess = spawn('/usr/bin/time', ['-l', executable, ...argv], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached, // Create process group for group termination on timeout
    });

    const pid = timeProcess.pid;
    let childStdout = '';
    let childStderr = '';

    if (timeProcess.stdout) {
      timeProcess.stdout.on('data', (chunk) => {
        childStdout += chunk.toString();
      });
    }

    if (timeProcess.stderr) {
      timeProcess.stderr.on('data', (chunk) => {
        childStderr += chunk.toString();
      });
    }

    // Set timeout: kill process group if exceeded
    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        try {
          if (detached && pid) {
            process.kill(-pid, 'SIGKILL'); // Kill entire process group
          } else {
            timeProcess.kill('SIGKILL');
          }
        } catch (e) {
          // Process may have already exited
        }
      }, timeout);
    }

    timeProcess.on('close', (code, signal) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      const metrics = parseTimeOutput(childStderr);
      const validation = validateTimeMetrics(metrics);

      let cpuPercent = null;
      let peakRssMb = null;

      if (validation.valid) {
        const cpuResult = computeCpuPercent(metrics.wallSeconds, metrics.userSeconds, metrics.systemSeconds);
        if (cpuResult.isValid) {
          cpuPercent = cpuResult.cpuPercent;
        }
        peakRssMb = metrics.rssBytes / (1024 * 1024);
      }

      resolve({
        success: validation.valid && cpuPercent !== null && peakRssMb !== null,
        cpuPercent,
        peakRssMb,
        wallMs: metrics.wallSeconds !== null ? Math.round(metrics.wallSeconds * 1000) : null,
        stdout: childStdout,
        stderr: childStderr,
        exitCode: code,
        signal,
        timedOut,
        provenance: {
          method: '/usr/bin/time -l',
          samplerExecutable: '/usr/bin/time',
          childExecutable: executable,
          pid,
          exitCode: code,
          signal: signal || null,
          durationMs,
          timeoutMs: timeout,
        },
      });
    });

    timeProcess.on('error', (err) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      resolve({
        success: false,
        cpuPercent: null,
        peakRssMb: null,
        wallMs: null,
        stdout: childStdout,
        stderr: `spawn error: ${err.message}`,
        exitCode: null,
        signal: null,
        timedOut,
        provenance: {
          method: '/usr/bin/time -l',
          samplerExecutable: '/usr/bin/time',
          childExecutable: executable,
          pid: null,
          exitCode: null,
          signal: null,
          durationMs,
          timeoutMs: timeout,
        },
      });
    });
  });
}
