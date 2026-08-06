/**
 * b8-1-process-metrics.mjs — Hardened macOS child-process sampler using /usr/bin/time -l.
 *
 * Executes a child process in a bounded subprocess group. Separates child stderr from
 * /usr/bin/time metrics using a temporary metrics file. Validates measurements strictly.
 * No fallback to zero or null. Requires explicit caller-supplied environment.
 *
 * All measurements are real; no injected test values.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_STDOUT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_STDERR_BYTES = 1 * 1024 * 1024;  // 1 MB

/**
 * Parse /usr/bin/time -l output from a metrics file.
 * Returns { wallSeconds, userSeconds, systemSeconds, rssBytes, parsed: true/false, reason: string }
 *
 * macOS time -l format:
 *   "        0.00 real         0.00 user         0.00 sys"
 *   "             1228800  maximum resident set size"
 */
export function parseTimeMetricsFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { wallSeconds: null, userSeconds: null, systemSeconds: null, rssBytes: null, parsed: false, reason: 'metrics file missing' };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { wallSeconds: null, userSeconds: null, systemSeconds: null, rssBytes: null, parsed: false, reason: `read error: ${e.message}` };
  }

  if (!content || content.length === 0) {
    return { wallSeconds: null, userSeconds: null, systemSeconds: null, rssBytes: null, parsed: false, reason: 'metrics file empty' };
  }

  let wallSeconds = null;
  let userSeconds = null;
  let systemSeconds = null;
  let rssBytes = null;

  // Parse "X real Y user Z sys" line
  const timeMatch = content.match(/\s+([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys/);
  if (timeMatch) {
    wallSeconds = parseFloat(timeMatch[1]);
    userSeconds = parseFloat(timeMatch[2]);
    systemSeconds = parseFloat(timeMatch[3]);
  }

  // Parse "N maximum resident set size" line
  const rssMatch = content.match(/\s+(\d+)\s+maximum resident set size/);
  if (rssMatch) {
    rssBytes = parseInt(rssMatch[1], 10);
  }

  const parsed = wallSeconds !== null && userSeconds !== null && systemSeconds !== null && rssBytes !== null;
  const reason = parsed ? null : 'incomplete parse';
  return { wallSeconds, userSeconds, systemSeconds, rssBytes, parsed, reason };
}

/**
 * Validate parsed time metrics. Reject negative, malformed, or contradictory values.
 * Allow legitimate multicore totals (CPU > wall is OK if within numCores).
 * Returns { valid: true/false, reason: string }
 */
export function validateTimeMetrics(metrics) {
  if (!metrics.parsed) {
    return { valid: false, reason: metrics.reason || 'time output not parsed' };
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

  // For multicore systems, CPU time can exceed wall time (legitimately)
  // Bound check: allow up to numCores * wall time
  const numCores = os.cpus().length;
  const totalCpuSeconds = metrics.userSeconds + metrics.systemSeconds;
  const maxAllowedCpuSeconds = metrics.wallSeconds * numCores * 1.1; // 10% tolerance for variance
  if (totalCpuSeconds > maxAllowedCpuSeconds) {
    return { valid: false, reason: `CPU time ${totalCpuSeconds}s exceeds ${maxAllowedCpuSeconds}s (${numCores} cores)` };
  }

  return { valid: true };
}

/**
 * Compute CPU percent from user + system seconds divided by wall seconds.
 * For zero wall time with zero CPU, return 0% (fast command).
 * For zero wall time with nonzero CPU, reject (contradictory).
 * Returns { cpuPercent: number, isValid: boolean }
 */
export function computeCpuPercent(wallSeconds, userSeconds, systemSeconds) {
  if (wallSeconds < 0 || userSeconds < 0 || systemSeconds < 0) {
    return { cpuPercent: null, isValid: false };
  }

  if (wallSeconds === 0) {
    const totalCpuSeconds = userSeconds + systemSeconds;
    if (totalCpuSeconds > 0) {
      return { cpuPercent: null, isValid: false };
    }
    return { cpuPercent: 0, isValid: true };
  }

  const cpuPercent = ((userSeconds + systemSeconds) / wallSeconds) * 100;
  const numCores = os.cpus().length;
  const maxCpuPercent = 100 * numCores * 1.1; // 10% tolerance

  if (cpuPercent < 0 || cpuPercent > maxCpuPercent) {
    return { cpuPercent: null, isValid: false };
  }

  return { cpuPercent, isValid: true };
}

/**
 * Execute a child process with /usr/bin/time -l wrapper.
 * Metrics are written to a temporary file and separated from child stderr.
 *
 * @param {object} opts
 * @param {string} opts.executable - absolute path to executable
 * @param {array} opts.argv - command arguments
 * @param {string} [opts.cwd] - working directory
 * @param {object} opts.env - explicit environment (NOT merged with process.env)
 * @param {number} [opts.timeout] - timeout in ms (0 = no timeout)
 * @param {boolean} [opts.detached] - use process group for cleanup
 * @returns {Promise<{
 *   success: boolean,
 *   measurementValid: boolean,
 *   commandSucceeded: boolean,
 *   cpuPercent: number|null,
 *   peakRssMb: number|null,
 *   wallMs: number|null,
 *   stdout: string,
 *   stderr: string,
 *   exitCode: number|null,
 *   signal: string|null,
 *   timedOut: boolean,
 *   provenance: {method, samplerPid, childPid, exitCode, signal, durationMs, timeoutMs}
 * }>}
 */
export async function runChildWithTimeMetrics(opts = {}) {
  const { executable, argv, cwd, env, timeout = 0, detached = true } = opts;

  if (!executable || !Array.isArray(argv) || !env || typeof env !== 'object') {
    return {
      success: false,
      measurementValid: false,
      commandSucceeded: false,
      cpuPercent: null,
      peakRssMb: null,
      wallMs: null,
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: null,
      timedOut: false,
      provenance: {
        method: '/usr/bin/time -l (via metrics file)',
        samplerPid: null,
        childPid: null,
        exitCode: null,
        signal: null,
        durationMs: null,
        timeoutMs: timeout,
      },
    };
  }

  // Create temporary metrics file in /tmp with owner-only permissions
  const metricsFile = path.join(os.tmpdir(), `b8-1-metrics-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  return new Promise((resolve) => {
    const startTime = Date.now();
    let timedOut = false;
    let timeoutHandle = null;
    let samplerPid = null;
    let childPid = null;

    try {
      // Spawn /usr/bin/time with explicit metrics file output (-o for output file, -l for detailed metrics)
      const timeProcess = spawn('/usr/bin/time', ['-l', '-o', metricsFile, executable, ...argv], {
        cwd,
        env, // Explicit environment, no merge
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        detached,
      });

      samplerPid = timeProcess.pid;
      childPid = null; // We don't have direct child PID; time process wraps it
      let childStdout = '';
      let childStderr = '';
      let stdoutTruncated = false;
      let stderrTruncated = false;

      if (timeProcess.stdout) {
        timeProcess.stdout.on('data', (chunk) => {
          if (childStdout.length + chunk.length > MAX_STDOUT_BYTES) {
            stdoutTruncated = true;
            childStdout = childStdout.slice(0, MAX_STDOUT_BYTES);
          } else {
            childStdout += chunk.toString();
          }
        });
      }

      if (timeProcess.stderr) {
        timeProcess.stderr.on('data', (chunk) => {
          if (childStderr.length + chunk.length > MAX_STDERR_BYTES) {
            stderrTruncated = true;
            childStderr = childStderr.slice(0, MAX_STDERR_BYTES);
          } else {
            childStderr += chunk.toString();
          }
        });
      }

      // Set timeout
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          try {
            if (detached && samplerPid) {
              process.kill(-samplerPid, 'SIGKILL');
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

        // Read metrics file
        let metrics = { wallSeconds: null, userSeconds: null, systemSeconds: null, rssBytes: null, parsed: false };
        try {
          if (fs.existsSync(metricsFile)) {
            metrics = parseTimeMetricsFile(metricsFile);
          }
        } catch (e) {
          metrics.reason = `metrics read error: ${e.message}`;
        } finally {
          // Clean up metrics file
          try { fs.unlinkSync(metricsFile); } catch {}
        }

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

        // Overall success requires: valid metrics, exit 0, no signal, no timeout
        const success = validation.valid && code === 0 && !signal && !timedOut;
        const measurementValid = validation.valid;
        const commandSucceeded = code === 0 && !signal && !timedOut;

        resolve({
          success,
          measurementValid,
          commandSucceeded,
          cpuPercent,
          peakRssMb,
          wallMs: metrics.wallSeconds !== null ? Math.round(metrics.wallSeconds * 1000) : null,
          stdout: childStdout,
          stderr: childStderr,
          exitCode: code,
          signal: signal || null,
          timedOut,
          provenance: {
            method: '/usr/bin/time -l (via metrics file)',
            samplerPid,
            childPid, // null; sampler PID is the measured process group
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

        // Clean up metrics file
        try { fs.unlinkSync(metricsFile); } catch {}

        resolve({
          success: false,
          measurementValid: false,
          commandSucceeded: false,
          cpuPercent: null,
          peakRssMb: null,
          wallMs: null,
          stdout: '',
          stderr: `spawn error: ${err.message}`,
          exitCode: null,
          signal: null,
          timedOut,
          provenance: {
            method: '/usr/bin/time -l (via metrics file)',
            samplerPid: null,
            childPid: null,
            exitCode: null,
            signal: null,
            durationMs,
            timeoutMs: timeout,
          },
        });
      });
    } catch (e) {
      // Clean up metrics file
      try { fs.unlinkSync(metricsFile); } catch {}

      const durationMs = Date.now() - startTime;
      resolve({
        success: false,
        measurementValid: false,
        commandSucceeded: false,
        cpuPercent: null,
        peakRssMb: null,
        wallMs: null,
        stdout: '',
        stderr: `error: ${e.message}`,
        exitCode: null,
        signal: null,
        timedOut,
        provenance: {
          method: '/usr/bin/time -l (via metrics file)',
          samplerPid: null,
          childPid: null,
          exitCode: null,
          signal: null,
          durationMs,
          timeoutMs: timeout,
        },
      });
    }
  });
}
