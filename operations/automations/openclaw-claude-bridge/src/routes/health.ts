import { FastifyInstance } from 'fastify';
import { listSessions } from '../sessions/manager';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_req, reply) => {
    const sessions = await listSessions();

    let claudeBin = 'not found';
    try {
      const { stdout } = await exec('which claude 2>/dev/null');
      claudeBin = stdout.trim() || 'not found';
    } catch {
      // not in PATH
    }

    let tmuxVersion = 'not found';
    try {
      const { stdout } = await exec('tmux -V 2>/dev/null');
      tmuxVersion = stdout.trim();
    } catch {
      // tmux not installed
    }

    return reply.send({
      ok: true,
      status: 'healthy',
      bridge: 'openclaw-claude-bridge v1',
      claudeBin,
      tmuxVersion,
      activeSessions: sessions.length,
      sessions,
      timestamp: new Date().toISOString(),
    });
  });
}
