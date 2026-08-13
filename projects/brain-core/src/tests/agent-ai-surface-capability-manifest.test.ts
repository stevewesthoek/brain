import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listAgentAiSurfaceCapabilities } from '../adapters/agent-ai-surface-capability-manifest.js';

test('listAgentAiSurfaceCapabilities maps live selector providers', async () => {
  const server: any = http.createServer((req: any, res: any) => {
    if (req.url === '/providers') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          providers: [
            {
              id: 'codex-cli',
              type: 'cli',
              capabilities: ['text/small', 'text/medium'],
              healthy: true,
              rate_limited: false,
              cost_per_1k_tokens: 0,
              priority: 1,
            },
          ],
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const address = server.address() as { port: number } | null;
  assert.ok(address);
  const selectorUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await listAgentAiSurfaceCapabilities(1000, selectorUrl);

    assert.equal(result.warning, undefined);
    assert.equal(result.capabilities.length, 1);
    assert.equal(result.capabilities[0]?.id, 'ai.codex-cli');
    assert.equal(result.capabilities[0]?.label, 'codex-cli');
    assert.equal(result.capabilities[0]?.enabled, true);
    assert.deepEqual(result.capabilities[0]?.preferredAiTaskTypes, ['text/small', 'text/medium']);
  } finally {
    server.close();
  }
});

test('listAgentAiSurfaceCapabilities fallback never resurrects local text surfaces', async () => {
  const result = await listAgentAiSurfaceCapabilities(100, 'http://127.0.0.1:9');

  assert.ok(result.warning?.includes('AI Model Selector unavailable'));
  assert.deepEqual(result.capabilities.map((capability) => capability.id), ['ai.claude-bedrock', 'ai.codex-cli']);
  assert.equal(result.capabilities[0]?.priority, 1);
  assert.equal(result.capabilities.some((capability) => capability.id.includes('ollama') || capability.id.includes('mtplx')), false);
});
