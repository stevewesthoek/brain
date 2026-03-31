/**
 * ⚠️  DANGEROUS ENDPOINT
 *
 * POST /shell — executes arbitrary shell commands in a repo working directory.
 * Disabled by default. Only enabled when ALLOW_SHELL_EXEC=true.
 *
 * Even when enabled:
 *   - cwd must be inside REPOS_ROOT and pass allowlist check
 *   - output is truncated to OUTPUT_TRUNCATE_CHARS
 *   - 30s timeout enforced
 */

import { FastifyInstance } from 'fastify';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config';
import { validateRepoPath } from '../sessions/manager';
import { esc } from '../format/telegram';

const exec = promisify(execCb);
const SHELL_TIMEOUT_MS = 30_000;

interface ShellBody {
  command: string;
  cwd?: string;
}

export async function shellRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ShellBody }>('/shell', async (req, reply) => {
    if (!config.shell.allowExec) {
      return reply.code(403).send({
        ok: false,
        dangerous: true,
        error: 'Shell execution is disabled. Set ALLOW_SHELL_EXEC=true to enable.',
      });
    }

    const { command, cwd } = req.body || {};

    if (!command || typeof command !== 'string' || !command.trim()) {
      return reply.code(400).send({ ok: false, error: 'command is required' });
    }

    // Validate and resolve cwd
    let resolvedCwd = config.repos.root;
    if (cwd) {
      const cwdPath = path.isAbsolute(cwd) ? cwd : path.join(config.repos.root, cwd);
      const validation = validateRepoPath(cwdPath);
      if (!validation.ok) {
        return reply.code(400).send({ ok: false, error: validation.error });
      }
      resolvedCwd = validation.resolved;
    }

    try {
      const { stdout, stderr } = await exec(command.trim(), {
        cwd: resolvedCwd,
        timeout: SHELL_TIMEOUT_MS,
      });

      const raw = (stdout + (stderr ? `\nSTDERR:\n${stderr}` : '')).trim();
      const output =
        raw.length > config.session.outputTruncateChars
          ? '…[truncated]\n' + raw.slice(-config.session.outputTruncateChars)
          : raw;

      return reply.send({
        ok: true,
        action: 'shell_exec',
        dangerous: true,
        command: command.trim(),
        cwd: resolvedCwd,
        output,
        telegram: {
          text: [
            `<b>⚠️ Shell output</b>`,
            `<code>${esc(command.trim())}</code>`,
            ``,
            `<pre>${esc(output)}</pre>`,
          ].join('\n'),
          parse_mode: 'HTML',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, action: 'shell_exec', error: message });
    }
  });
}
