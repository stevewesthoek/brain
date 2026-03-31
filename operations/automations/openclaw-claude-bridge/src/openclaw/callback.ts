import { config } from '../config';

export interface CallbackPayload {
  content: string;
  sessionKey?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST the result of a Claude Code job back to OpenClaw's gateway as a new
 * agent turn. OpenClaw receives it, formats it, and delivers it to Telegram.
 *
 * Uses x-openclaw-session-key to land in the correct conversation context.
 */
export async function callbackToOpenClaw(payload: CallbackPayload): Promise<void> {
  const { gatewayUrl, bearerToken, agentId } = config.openclaw;

  if (!bearerToken) {
    console.warn('[callback] OPENCLAW_BEARER_TOKEN not set — skipping callback to OpenClaw');
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearerToken}`,
    'x-openclaw-agent-id': payload.agentId || agentId,
  };

  if (payload.sessionKey) {
    headers['x-openclaw-session-key'] = payload.sessionKey;
  }

  const body = JSON.stringify({
    model: 'bridge-callback',
    messages: [
      {
        role: 'user',
        content: payload.content,
      },
    ],
    // metadata is passed through for OpenClaw to use (e.g. buttons, parse_mode)
    metadata: payload.metadata || {},
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[callback] OpenClaw returned ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[callback] Failed to reach OpenClaw gateway:', msg);
  } finally {
    clearTimeout(timeoutId);
  }
}
