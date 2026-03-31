import Fastify from 'fastify';
import { config } from './config';
import { authHook } from './auth';
import { healthRoutes } from './routes/health';
import { skillsRoutes } from './routes/skills';
import { sessionRoutes } from './routes/sessions';
import { promptRoutes } from './routes/prompt';
import { confirmRoutes } from './routes/confirm';
import { jobRoutes } from './routes/jobs';
import { repoRoutes } from './routes/repo';
import { shellRoutes } from './routes/shell';

async function main() {
  const fastify = Fastify({
    logger: {
      level: config.log.level,
      serializers: {
        req(req) {
          // Never log secret header values
          return { method: req.method, url: req.url, ip: req.ip };
        },
      },
    },
  });

  // Global auth: runs on every request except /health
  fastify.addHook('preHandler', authHook);

  // Routes
  await fastify.register(healthRoutes);
  await fastify.register(skillsRoutes);
  await fastify.register(sessionRoutes);
  await fastify.register(promptRoutes);
  await fastify.register(confirmRoutes);
  await fastify.register(jobRoutes);
  await fastify.register(repoRoutes);
  await fastify.register(shellRoutes);

  fastify.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ ok: false, error: 'Not found' });
  });

  fastify.setErrorHandler((err, _req, reply) => {
    fastify.log.error(err);
    reply.code(500).send({ ok: false, error: 'Internal server error' });
  });

  try {
    await fastify.listen({ port: config.bridge.port, host: config.bridge.host });

    if (!config.bridge.secret) {
      fastify.log.warn('⚠️  BRIDGE_SECRET is not set — all requests bypass auth!');
    }
    if (!config.openclaw.bearerToken) {
      fastify.log.warn('⚠️  OPENCLAW_BEARER_TOKEN is not set — callbacks to OpenClaw will be skipped!');
    }
    if (config.shell.allowExec) {
      fastify.log.warn('⚠️  ALLOW_SHELL_EXEC=true — arbitrary shell execution is enabled!');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
