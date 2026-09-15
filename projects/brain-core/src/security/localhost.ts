import type { IncomingMessage } from 'node:http';
import { loadBrainRuntimeConfig } from '../agent-mode/portable-runtime-config.js';

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

export function isLocalRequest(request: IncomingMessage): boolean {
  const remoteAddress = request.socket.remoteAddress;
  if (!remoteAddress) {
    return false;
  }

  return LOCAL_HOSTS.has(remoteAddress);
}

export function getBindHost(): string {
  return loadBrainRuntimeConfig().core.bindHost;
}

export function getPort(): number {
  return loadBrainRuntimeConfig().core.port;
}
