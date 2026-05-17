export interface BrainCoreStatusResponse {
  service: 'brain-core';
  mode: 'read-only';
  ok: boolean;
  startedAt: string;
  uptimeSeconds: number;
  version: string;
  host: string;
}

export async function readBrainCoreStatusLine(baseUrl: string): Promise<string> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);

  try {
    const response = await fetch(`${normalizedBaseUrl}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return `Brain Core: unavailable (${response.status})`;
    }

    const body = (await response.json()) as Partial<BrainCoreStatusResponse>;
    if (body.service !== 'brain-core') {
      return 'Brain Core: unexpected response';
    }

    return `Brain Core: ${body.ok ? 'ok' : 'not ok'} · ${body.mode ?? 'unknown'} · ${body.host ?? 'unknown host'}`;
  } catch {
    return 'Brain Core: unavailable';
  } finally {
    clearTimeout(timeout);
  }
}
