import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config';

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Health check is always public
  if (request.routeOptions.url === '/health') return;

  // IP allowlist check
  if (config.bridge.allowedIps.length > 0) {
    const ip =
      (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
      request.ip ||
      '';
    if (!config.bridge.allowedIps.includes(ip)) {
      request.log.warn({ ip }, 'rejected: IP not in allowlist');
      reply.code(403).send({ ok: false, error: 'Forbidden' });
      return;
    }
  }

  // Shared secret check
  if (config.bridge.secret) {
    const header = request.headers['x-bridge-secret'] as string | undefined;
    if (!header || header !== config.bridge.secret) {
      request.log.warn('rejected: invalid or missing X-Bridge-Secret');
      reply.code(401).send({ ok: false, error: 'Unauthorized' });
      return;
    }
  }
}
