#!/usr/bin/env node

import {realpathSync} from 'node:fs';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {MAX_CAPTURE_BYTES, writeRawCapture} from './capture.mjs';
import {renderPasteIntoEvermindHtml} from '../intake/paste-ui.mjs';

const LOOPBACK_HOST = '127.0.0.1';
const MAX_HTTP_BODY_BYTES = MAX_CAPTURE_BYTES + 64 * 1024;

function jsonResponse(response, statusCode, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function htmlResponse(response, statusCode, html) {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(html),
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
  });
  response.end(html);
}

function validateLocalRequest(request, token = '') {
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const hostHeader = String(request.headers.host ?? '');
  let requestHost = '';
  try {
    requestHost = new URL(`http://${hostHeader}`).hostname;
  } catch {
    requestHost = '';
  }
  if (!allowedHosts.has(requestHost)) return 'host_not_allowed';

  const origin = String(request.headers.origin ?? '');
  if (!origin) return null;
  try {
    const parsedOrigin = new URL(origin);
    if (allowedHosts.has(parsedOrigin.hostname)) return null;
  } catch {
    // Non-HTTP extension origins are handled by token authentication below.
  }

  const suppliedToken = String(request.headers['x-evermind-token'] ?? '');
  if (token && suppliedToken && suppliedToken === token) return null;
  return 'origin_not_allowed';
}

function parseCaptureBody(buffer, contentType) {
  if (contentType.startsWith('application/json')) {
    let payload;
    try { payload = JSON.parse(buffer.toString('utf8')); }
    catch { throw new Error('invalid_json'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_json');
    return {
      content: payload.content,
      sourceType: payload.sourceType ?? 'http',
      provenance: payload.provenance ?? 'localhost-http',
    };
  }
  if (contentType.startsWith('text/plain') || !contentType) {
    return {content: buffer.toString('utf8'), sourceType: 'http', provenance: 'localhost-http'};
  }
  throw new Error('unsupported_content_type');
}

export function createCaptureHttpServer({root, token = ''} = {}) {
  if (!root) throw new Error('missing_root');
  return http.createServer((request, response) => {
    const localError = validateLocalRequest(request, token);
    if (localError) {
      jsonResponse(response, 403, {status: 'error', code: localError});
      return;
    }

    if (request.url === '/' && request.method === 'GET') {
      htmlResponse(response, 200, renderPasteIntoEvermindHtml());
      return;
    }
    if (request.url !== '/capture') {
      jsonResponse(response, 404, {status: 'error', code: 'not_found'});
      return;
    }
    if (request.method !== 'POST') {
      response.setHeader('allow', 'POST');
      jsonResponse(response, 405, {status: 'error', code: 'method_not_allowed'});
      return;
    }

    let total = 0;
    const chunks = [];
    let rejected = false;
    request.on('data', (chunk) => {
      if (rejected) return;
      total += chunk.length;
      if (total > MAX_HTTP_BODY_BYTES) {
        rejected = true;
        jsonResponse(response, 413, {status: 'error', code: 'capture_too_large'});
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (rejected) return;
      try {
        const input = parseCaptureBody(Buffer.concat(chunks), String(request.headers['content-type'] ?? '').toLowerCase());
        const result = writeRawCapture({root, ...input});
        jsonResponse(response, 201, {status: 'captured', ...result});
      } catch (cause) {
        const code = cause instanceof Error ? cause.message : String(cause);
        const statusCode = code === 'capture_too_large' ? 413 : code === 'unsupported_content_type' ? 415 : 400;
        jsonResponse(response, statusCode, {status: 'error', code});
      }
    });
    request.on('error', () => {
      if (!response.headersSent) jsonResponse(response, 400, {status: 'error', code: 'request_error'});
    });
  });
}

export async function startCaptureHttpServer({root, port = 0, token = ''} = {}) {
  const server = createCaptureHttpServer({root, token});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(port), LOOPBACK_HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return {server, host: LOOPBACK_HOST, port: typeof address === 'object' && address ? address.port : Number(port)};
}

function parseServerArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') args.root = argv[++index];
    else if (arg === '--port') args.port = argv[++index];
    else if (arg === '--token') args.token = argv[++index];
    else if (arg === '--help') args.help = true;
    else throw new Error('invalid_argument');
  }
  return args;
}

const executedDirectly = process.argv[1]
  ? realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  try {
    const args = parseServerArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write('Usage: node src/capture/server.mjs --root PATH [--port N] [--token TOKEN]\n');
    } else {
      const root = args.root ?? process.env.EVERMIND_ROOT ?? process.env.MIND_CONTEXT_ROOT;
      const token = args.token ?? process.env.EVERMIND_CAPTURE_TOKEN ?? '';
      const {host, port} = await startCaptureHttpServer({root, port: args.port ?? process.env.EVERMIND_CAPTURE_PORT ?? 0, token});
      process.stdout.write(`${JSON.stringify({status: 'listening', host, port})}\n`);
    }
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exitCode = 2;
  }
}

export {LOOPBACK_HOST, MAX_HTTP_BODY_BYTES, parseCaptureBody, parseServerArgs};
