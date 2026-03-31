import { FastifyInstance } from 'fastify';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { getJob, updateJob } from '../jobs';
import { capturePane, pollForOutput } from '../sessions/capture';
import { callbackToOpenClaw } from '../openclaw/callback';
import { formatResult, formatError, esc } from '../format/telegram';

const exec = promisify(execCb);

interface ConfirmBody {
  job_id?: string;
  session_id?: string;
  action: 'approve' | 'deny';
  session_key?: string;
  agent_id?: string;
}

export async function confirmRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ConfirmBody }>('/confirm', async (req, reply) => {
    const { job_id, session_id, action, session_key, agent_id } = req.body || {};

    if (!action || !['approve', 'deny'].includes(action)) {
      return reply.code(400).send({ ok: false, error: 'action must be "approve" or "deny"' });
    }

    // Resolve session ID from job_id or direct session_id
    let sessionId = session_id;

    if (job_id) {
      const job = getJob(job_id);
      if (!job) {
        return reply.code(404).send({ ok: false, error: `Job ${job_id} not found` });
      }
      sessionId = job.sessionId;
    }

    if (!sessionId) {
      return reply.code(400).send({ ok: false, error: 'job_id or session_id is required' });
    }

    if (!sessionId.startsWith('claude-')) {
      return reply.code(400).send({ ok: false, error: 'Invalid session ID' });
    }

    const decisionText =
      action === 'approve'
        ? `✅ <b>Approved</b> — sending to Claude…`
        : `❌ <b>Denied</b> — cancelling…`;

    // Return 202 immediately
    reply.code(202).send({
      ok: true,
      action: 'confirm',
      decision: action,
      sessionId,
      telegram: { text: decisionText, parse_mode: 'HTML' },
    });

    // Apply the decision asynchronously
    runConfirmJob(sessionId, action, job_id, session_key, agent_id).catch(console.error);
  });
}

async function runConfirmJob(
  sessionId: string,
  action: 'approve' | 'deny',
  jobId?: string,
  sessionKey?: string,
  agentId?: string
): Promise<void> {
  try {
    const baseline = await capturePane(sessionId);

    if (action === 'approve') {
      // Send 'y' + Enter — covers Claude Code's [1] Yes and shell y/n prompts
      await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} y Enter`);
    } else {
      // Ctrl+C to cancel
      await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} C-c`);
    }

    const result = await pollForOutput(sessionId, baseline);

    if (jobId) updateJob(jobId, { status: 'done' });

    await callbackToOpenClaw({
      content: formatResult(sessionId, result.output, result.timedOut),
      sessionKey,
      agentId,
      metadata: {
        jobId,
        sessionId,
        confirmedAction: action,
        timedOut: result.timedOut,
        parse_mode: 'HTML',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobId) updateJob(jobId, { status: 'error' });
    await callbackToOpenClaw({
      content: formatError('confirm', message),
      sessionKey,
      agentId,
      metadata: { jobId, sessionId, error: message, parse_mode: 'HTML' },
    });
  }
}
