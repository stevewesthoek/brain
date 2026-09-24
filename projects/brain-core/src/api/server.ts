import http, { type Server } from 'node:http';
import { createAgentModeProductionScheduler } from '../agent-mode/production-scheduler.js';
import { loadJarvisProductionRuntimeConfiguration } from '../agent-mode/jarvis-production-runtime.js';
import { createConfiguredJarvisSystemOneReflexService } from '../agent-mode/jarvis-system-one-reflex.js';
import { getBindHost, getPort } from '../security/localhost.js';
import { routeRequest } from './routes.js';

export function createBrainCoreServer(): Server {
  return http.createServer((request, response) => {
    void routeRequest(request, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      response.writeHead(500, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(`${JSON.stringify({ error: { code: 'internal_error', message } })}\n`);
    });
  });
}

export async function startBrainCoreServer(): Promise<Server> {
  const host = getBindHost();
  const port = getPort();
  const server = createBrainCoreServer();
  const productionRuntime = loadJarvisProductionRuntimeConfiguration();
  const reflex = createConfiguredJarvisSystemOneReflexService(productionRuntime ? {
    runtimeFacts: {
      available: [...productionRuntime.availableModels],
      policyVersion: 'jarvis-reflex-policy-v1',
    },
  } : {});
  const scheduler = createAgentModeProductionScheduler({
    ...(reflex ? { reflex } : {}),
    ...(productionRuntime ? { productionRuntime } : {}),
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

  console.log(`Brain Core API listening at http://${host}:${port}`);
  scheduler.start();
  (server as unknown as { once(event: 'close', listener: () => void): void }).once('close', () => { void scheduler.stop(); });
  return server;
}
