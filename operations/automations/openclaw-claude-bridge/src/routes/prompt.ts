import { FastifyInstance } from 'fastify';
import path from 'path';
import { config } from '../config';
import { ensureSession } from '../sessions/manager';
import { capturePane, sendKeys, pollForOutput } from '../sessions/capture';
import { createJob, updateJob } from '../jobs';
import {
  formatPromptAccepted,
  formatConfirmationRequest,
  confirmationButtons,
} from '../format/telegram';

interface PromptBody {
  prompt: string;
  repo?: string;
  session_key?: string;
  agent_id?: string;
}

export async function promptRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: PromptBody }>('/prompt', async (req, reply) => {
    const { prompt, repo, session_key, agent_id } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return reply.code(400).send({ ok: false, error: 'prompt is required and must be a non-empty string' });
    }

    const repoPath = repo ? path.join(config.repos.root, repo) : undefined;

    let sessionId: string;
    let repoResolved: string | null = null;

    try {
      const result = await ensureSession(repoPath);
      sessionId = result.sessionId;
      repoResolved = result.repoResolved;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ ok: false, action: 'send_prompt', error: message });
    }

    const job = createJob({
      sessionId,
      sessionKey: session_key,
      agentId: agent_id,
      prompt: prompt.trim(),
    });

    // Return 202 immediately — OpenClaw polls /jobs/:id for the result
    reply.code(202).send({
      ok: true,
      action: 'send_prompt',
      status: 'accepted',
      jobId: job.id,
      sessionId,
      repo: repoResolved,
      telegram: {
        text: formatPromptAccepted(sessionId, job.id, repoResolved),
        parse_mode: 'HTML',
      },
    });

    // Run async — result stored in job, OpenClaw polls to retrieve it
    runPromptJob(job.id, sessionId, prompt.trim(), repoResolved)
      .catch(err => req.log.error({ err, jobId: job.id }, 'prompt job crashed'));
  });
}

async function runPromptJob(
  jobId: string,
  sessionId: string,
  prompt: string,
  repo: string | null,
): Promise<void> {
  try {
    updateJob(jobId, { status: 'running' });

    const baseline = await capturePane(sessionId);
    await sendKeys(sessionId, prompt);
    const result = await pollForOutput(sessionId, baseline, prompt);

    if (result.confirmationDetected) {
      updateJob(jobId, {
        status: 'awaiting_confirmation',
        confirmationContext: {
          snapshot: result.output,
          question: result.confirmationText || '',
        },
        result: { output: result.output, timedOut: false, repo },
      });
      return;
    }

    updateJob(jobId, {
      status: 'done',
      result: { output: result.output, timedOut: result.timedOut, repo },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, {
      status: 'error',
      result: { output: message, timedOut: false, repo },
    });
  }
}
