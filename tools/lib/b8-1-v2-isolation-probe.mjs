#!/usr/bin/env node
/** Contract V2 sandbox probe. No external address is contacted. */
import net from 'node:net';
import process from 'node:process';

const [kind, target, rawPort] = process.argv.slice(2);
const port = Number(rawPort);
console.log('B8_1_V2_ISOLATION_PROBE_STARTED');

function finish(result, error, code) {
  console.log(JSON.stringify({ kind, result, error: error ?? null, exitCode: code }));
  process.exit(code);
}

let socket;
if (kind === 'ipv4') socket = net.connect(port, '127.0.0.1');
else if (kind === 'ipv6') socket = net.connect(port, '::1');
else if (kind === 'unix') socket = net.connect(target);
else finish('malformed-invocation', 'kind must be ipv4, ipv6, or unix', 3);

socket.once('connect', () => {
  socket.destroy();
  finish('connected', null, 0);
});
socket.once('error', error => {
  const denied = error.code === 'EPERM' || error.code === 'EACCES';
  finish(denied ? 'denied-permission' : 'unexpected-error', `${error.code}: ${error.message}`, denied ? 1 : 4);
});
setTimeout(() => {
  socket.destroy();
  finish('timeout', 'probe timed out', 2);
}, 2000).unref();
