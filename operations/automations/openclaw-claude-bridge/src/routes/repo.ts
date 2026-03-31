import { FastifyInstance } from 'fastify';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config';
import { validateRepoPath } from '../sessions/manager';
import { formatRepoStatus } from '../format/telegram';

const exec = promisify(execCb);

export async function repoRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { repo?: string } }>('/repo/status', async (req, reply) => {
    const { repo } = req.query;

    if (!repo) {
      return reply.code(400).send({ ok: false, error: 'repo query param is required (relative to REPOS_ROOT)' });
    }

    const repoPath = path.join(config.repos.root, repo);
    const validation = validateRepoPath(repoPath);

    if (!validation.ok) {
      return reply.code(400).send({ ok: false, error: validation.error });
    }

    const cwd = validation.resolved;

    try {
      const [statusOut, branchOut, logOut] = await Promise.all([
        exec('git status --short', { cwd }).then(r => r.stdout.trim()).catch(() => '(not a git repo)'),
        exec('git rev-parse --abbrev-ref HEAD', { cwd }).then(r => r.stdout.trim()).catch(() => 'unknown'),
        exec('git log -1 --format="%h %s"', { cwd }).then(r => r.stdout.trim()).catch(() => 'none'),
      ]);

      const statusDisplay = statusOut || '(clean)';
      const text = formatRepoStatus(cwd, branchOut, statusDisplay, logOut);

      return reply.send({
        ok: true,
        action: 'repo_status',
        repo: cwd,
        branch: branchOut,
        status: statusDisplay,
        lastCommit: logOut,
        telegram: { text, parse_mode: 'HTML' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, action: 'repo_status', error: message });
    }
  });
}
