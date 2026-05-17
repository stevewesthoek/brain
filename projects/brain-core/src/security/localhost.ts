import type { IncomingMessage } from 'node:http';

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

export function isLocalRequest(request: IncomingMessage): boolean {
  const remoteAddress = request.socket.remoteAddress;
  if (!remoteAddress) {
    return false;
  }

  return LOCAL_HOSTS.has(remoteAddress);
}

export function getBindHost(): string {
  return process.env.BRAIN_CORE_HOST || '127.0.0.1';
}

export function getPort(): number {
  const rawPort = process.env.BRAIN_CORE_PORT || '4877';
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid BRAIN_CORE_PORT: ${rawPort}`);
  }

  return port;
}
