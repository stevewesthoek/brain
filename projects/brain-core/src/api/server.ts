import http, { type Server } from 'node:http';
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

  console.log(`Brain Core read-only API listening at http://${host}:${port}`);
  return server;
}
