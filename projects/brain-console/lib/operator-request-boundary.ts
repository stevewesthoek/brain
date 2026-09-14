import 'server-only';

import type { NextRequest } from 'next/server';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const FORWARDED_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'] as const;

function normalizedHostname(value: string): string {
  return value.toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '');
}

function directHostMatches(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host || host.includes(',') || /[\s\\/]/u.test(host)) return false;
  try {
    const parsed = new URL(`${request.nextUrl.protocol}//${host}`);
    return parsed.username === ''
      && parsed.password === ''
      && parsed.pathname === '/'
      && parsed.search === ''
      && parsed.hash === ''
      && normalizedHostname(parsed.hostname) === normalizedHostname(request.nextUrl.hostname)
      && parsed.port === request.nextUrl.port;
  } catch {
    return false;
  }
}

/** No trusted proxy is configured for the local deployment; forwarded metadata is rejected. */
export function loopbackTransport(request: NextRequest): boolean {
  if (!LOOPBACK_HOSTS.has(normalizedHostname(request.nextUrl.hostname))) return false;
  if (FORWARDED_HEADERS.some((header) => request.headers.has(header))) return false;
  return directHostMatches(request);
}

export function sameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export function secureTransport(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:';
}
