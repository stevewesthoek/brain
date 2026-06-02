import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4880);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function safePath(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath.split('?')[0] || '/')).replace(/^\/+/, '');
  if (cleanPath.startsWith('..')) return null;
  return cleanPath;
}

async function serveFile(response, relativePath) {
  const filePath = join(rootDir, relativePath);
  const body = await readFile(filePath);
  response.writeHead(200, { 'content-type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream' });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const path = safePath(request.url ?? '/');
    if (!path) {
      response.writeHead(400);
      response.end('Bad request');
      return;
    }

    if (path === '' || path === '/' || path === 'aws-video') {
      await serveFile(response, 'index.html');
      return;
    }

    await serveFile(response, path);
  } catch (error) {
    if (request.url?.startsWith('/aws-video')) {
      try {
        await serveFile(response, 'index.html');
        return;
      } catch {
        // fall through
      }
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Brain Console Web listening on http://${host}:${port}/aws-video`);
});
