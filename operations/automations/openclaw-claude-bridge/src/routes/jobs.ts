import { FastifyInstance } from 'fastify';
import { getJob } from '../jobs';
import { formatResult, formatConfirmationRequest, formatError, esc, confirmationButtons } from '../format/telegram';

export async function jobRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>('/jobs/:id', async (req, reply) => {
    const { id } = req.params;
    const job = getJob(id);

    if (!job) {
      return reply.code(404).send({ ok: false, error: `Job ${id} not found` });
    }

    const base = {
      ok: true,
      jobId: job.id,
      sessionId: job.sessionId,
      status: job.status,
      updatedAt: job.updatedAt,
    };

    if (job.status === 'pending' || job.status === 'running') {
      return reply.send({
        ...base,
        telegram: {
          text: `<i>⏳ thinking…</i>`,
          parse_mode: 'text',
        },
      });
    }

    if (job.status === 'awaiting_confirmation') {
      const question = job.confirmationContext?.question || '';
      return reply.send({
        ...base,
        confirmationQuestion: question,
        telegram: {
          text: formatConfirmationRequest(job.sessionId, question, job.id),
          parse_mode: 'text',
          buttons: confirmationButtons(job.id),
        },
      });
    }

    // done or error
    const output = job.result?.output || '';
    const timedOut = job.result?.timedOut || false;
    const repo = job.result?.repo;

    return reply.send({
      ...base,
      output,
      telegram: {
        text: job.status === 'error'
          ? formatError('claude', output)
          : formatResult(job.sessionId, output, timedOut, repo),
        parse_mode: 'text',
      },
    });
  });
}
