#!/usr/bin/env node
/**
 * b8-1-network-isolation-child.mjs
 *
 * Sandboxed child helper for network isolation proof testing.
 *
 * Prints a fixed startup marker, attempts one TCP connection to the supplied loopback port,
 * and emits one structured JSON result with a distinct exit code for each outcome.
 *
 * Exit codes:
 *   0 = successful connection (network NOT denied)
 *   1 = EPERM or EACCES (network denied — EXPECTED)
 *   2 = connection refused or timeout (network isolation proof incomplete)
 *   3 = malformed invocation or missing argument
 *   4 = unexpected error
 *
 * Usage:
 *   node b8-1-network-isolation-child.mjs <loopback-port>
 *
 * Output (stdout):
 *   CHILD_STARTUP_MARKER\n
 *   { "result": "...", "error": "...", "exitCode": N }\n
 */

import net from 'node:net';
import process from 'node:process';

// Fixed startup marker
console.log('CHILD_STARTUP_MARKER');

const port = parseInt(process.argv[2], 10);
if (!port || isNaN(port) || port < 1 || port > 65535) {
  console.log(JSON.stringify({
    result: 'malformed-invocation',
    error: 'port must be an integer 1-65535',
    exitCode: 3,
  }));
  process.exit(3);
}

const sock = net.connect(port, '127.0.0.1', () => {
  // Connection succeeded — network NOT denied
  sock.destroy();
  console.log(JSON.stringify({
    result: 'connection-succeeded',
    error: null,
    exitCode: 0,
  }));
  process.exit(0);
});

sock.on('error', (err) => {
  // Analyze the error code
  const code = err.code || '';
  const errno = err.errno || '';

  if (code === 'EPERM' || code === 'EACCES' || errno === 'EPERM' || errno === 'EACCES') {
    // Operation not permitted / Permission denied — network denied (EXPECTED)
    console.log(JSON.stringify({
      result: 'connection-denied-permission',
      error: `${code}: ${err.message}`,
      exitCode: 1,
    }));
    process.exit(1);
  } else if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    // Connection refused or timeout — does not prove sandbox
    console.log(JSON.stringify({
      result: 'connection-refused-or-timeout',
      error: `${code}: ${err.message}`,
      exitCode: 2,
    }));
    process.exit(2);
  } else {
    // Other error
    console.log(JSON.stringify({
      result: 'unexpected-error',
      error: `${code}: ${err.message}`,
      exitCode: 4,
    }));
    process.exit(4);
  }
});

// Timeout after 2 seconds
setTimeout(() => {
  sock.destroy();
  console.log(JSON.stringify({
    result: 'connection-timeout',
    error: 'socket timeout after 2 seconds',
    exitCode: 2,
  }));
  process.exit(2);
}, 2000);
