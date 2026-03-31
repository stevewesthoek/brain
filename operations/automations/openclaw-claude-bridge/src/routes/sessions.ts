import { FastifyInstance } from 'fastify';
import path from 'path';
import { config } from '../config';
import {
  listSessions,
  ensureSession,
  stopSession,
} from '../sessions/manager';
import { esc, formatSessionList } from '../format/telegram';

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  // List active sessions
  fastify.get('/sessions', async (_req, reply) => {
    const sessions = await listSessions();
    return reply.send({
      ok: true,
      action: 'list_sessions',
      count: sessions.length,
      sessions,
      telegram: { text: formatSessionList(sessions), parse_mode: 'HTML' },
    });
  });

  // Create (or resume) session for a repo
  fastify.post<{ Body: { repo?: string } }>('/sessions', async (req, reply) => {
    const { repo } = req.body || {};
    const repoPath = repo ? path.join(config.repos.root, repo) : undefined;

    try {
      const { sessionId, repoResolved, created } = await ensureSession(repoPath);

      const statusIcon = created ? '✅' : 'ℹ️';
      const statusText = created ? 'Session created' : 'Session already active';
      const repoLine = repoResolved ? `\n<b>Repo:</b> <code>${esc(repoResolved)}</code>` : '';

      return reply.code(created ? 201 : 200).send({
        ok: true,
        action: 'create_session',
        sessionId,
        repo: repoResolved,
        created,
        telegram: {
          text: `${statusIcon} <b>${statusText}</b>\n<b>Session:</b> <code>${esc(sessionId)}</code>${repoLine}`,
          parse_mode: 'HTML',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({
        ok: false,
        action: 'create_session',
        error: message,
        telegram: { text: `❌ <b>Failed to create session</b>\n<pre>${esc(message)}</pre>`, parse_mode: 'HTML' },
      });
    }
  });

  // Stop a session
  fastify.delete<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const { id } = req.params;

    if (!id || !id.startsWith('claude-')) {
      return reply.code(400).send({ ok: false, error: 'Invalid session ID — must start with claude-' });
    }

    try {
      await stopSession(id);
      return reply.send({
        ok: true,
        action: 'stop_session',
        sessionId: id,
        telegram: {
          text: `🛑 <b>Session stopped</b>\n<code>${esc(id)}</code>`,
          parse_mode: 'HTML',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, action: 'stop_session', error: message });
    }
  });
}
