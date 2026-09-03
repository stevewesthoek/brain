import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { inspectRenderedScreenshot } from './visual-qa.mjs';

export const SHARED_VISUAL_PROVIDER_ID = 'brain.shared.local-playwright';
export const SHARED_VISUAL_PROVIDER_REVISION = 'shared-visual-runtime@1.0.0';
export const SHARED_VISUAL_CAPABILITIES = Object.freeze([
  { capabilityId: 'browser.render', available: true, quality: 'canonical' },
  { capabilityId: 'screenshot.capture', available: true, quality: 'canonical' },
  { capabilityId: 'visual.inspection', available: true, quality: 'canonical' },
  { capabilityId: 'functional.interaction', available: true, quality: 'canonical' }
]);

const MIME_TYPES = Object.freeze({ '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' });
const FORBIDDEN_SEGMENTS = new Set(['.git', '.env', '.env.local', '.env.production', 'credentials', 'secrets', 'private', 'auth']);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24); }
function isInside(parent, child) { return child === parent || child.startsWith(`${parent}${path.sep}`); }
function assertSafePath(boundary, candidate, label, { allowMissing = false } = {}) {
  const root = fs.realpathSync(boundary);
  let resolved;
  if (!allowMissing) resolved = fs.realpathSync(candidate);
  else {
    const absolute = path.resolve(candidate);
    let existingParent = absolute;
    const missing = [];
    while (!fs.existsSync(existingParent)) {
      missing.unshift(path.basename(existingParent));
      existingParent = path.dirname(existingParent);
    }
    resolved = path.join(fs.realpathSync(existingParent), ...missing);
  }
  if (!isInside(root, resolved)) throw new Error(`shared_visual:${label}_outside_workspace`);
  const relative = path.relative(root, resolved);
  if (relative.split(path.sep).some((segment) => FORBIDDEN_SEGMENTS.has(segment))) throw new Error(`shared_visual:${label}_sensitive_path`);
  return resolved;
}
function assertLoopback(urlString) {
  const url = new URL(urlString);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('shared_visual:non_loopback_endpoint');
  return url;
}
function localBrowserExecutable() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  const discovered = chromium.executablePath();
  if (discovered && fs.existsSync(discovered)) return discovered;
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (cacheRoot && fs.existsSync(cacheRoot)) {
    const candidates = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const next = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (entry.name === 'headless_shell' || entry.name === 'Google Chrome for Testing') candidates.push(next);
      }
    };
    walk(cacheRoot);
    if (candidates[0]) return candidates.sort().at(-1);
  }
  return null;
}

function createStaticServer(root) {
  const server = http.createServer((request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      if (requestPath === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }
      const candidate = path.resolve(root, `.${requestPath}`);
      if (!isInside(root, candidate)) throw new Error('path traversal');
      const file = fs.realpathSync(fs.statSync(candidate).isDirectory() ? path.join(candidate, 'index.html') : candidate);
      if (!isInside(root, file)) throw new Error('path traversal');
      response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  return new Promise((resolve, reject) => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, url: `http://127.0.0.1:${address.port}/` });
  }).on('error', reject));
}

function closeServer(server) { return new Promise((resolve) => server.close(() => resolve())); }
function ref(type, value, sourceRevision) { return { refId: `${type}:${hash(value)}`, refType: type, value, sourceRevision }; }

async function applyAction(page, action, index) {
  const actionRef = `visual-action://${hash({ action, index })}`;
  try {
    if (action.kind === 'click') await page.locator(action.selector).click();
    else if (action.kind === 'fill') await page.locator(action.selector).fill(action.value ?? '');
    else if (action.kind === 'press') await page.locator(action.selector).press(action.key);
    else if (action.kind === 'expectVisible') await page.locator(action.selector).waitFor({ state: 'visible' });
    else if (action.kind === 'expectAttribute') {
      const actual = await page.locator(action.selector).getAttribute(action.name);
      if (actual !== action.value) throw new Error(`attribute ${action.name} expected ${action.value}, got ${actual}`);
    } else if (action.kind === 'expectText') {
      const text = await page.locator(action.selector).innerText();
      if (!text.includes(action.value)) throw new Error(`text did not include ${action.value}`);
    } else throw new Error(`unsupported_action:${action.kind}`);
    return { ref: actionRef, kind: action.kind, status: 'PASS' };
  } catch (error) {
    return { ref: actionRef, kind: action.kind, status: 'FAIL', reason: error instanceof Error ? error.message : String(error) };
  }
}

export function createLocalPlaywrightVisualProvider({ sourceRevision = 'unknown', outputRoot = null } = {}) {
  const descriptor = {
    providerId: SHARED_VISUAL_PROVIDER_ID,
    providerRevision: SHARED_VISUAL_PROVIDER_REVISION,
    providerKind: 'shared_brain', authority: 'brain', health: 'healthy', freshness: 'fresh', workspacePolicy: 'local_workspace_only',
    capabilities: clone(SHARED_VISUAL_CAPABILITIES)
  };
  return Object.freeze({
    descriptor,
    async preflight() {
      const executablePath = localBrowserExecutable();
      if (!executablePath) return { status: 'UNAVAILABLE', reason: 'chromium_executable_missing' };
      try {
        const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-gpu'] });
        await browser.close();
        return { status: 'AVAILABLE', executablePath: path.basename(executablePath) };
      } catch (error) {
        return { status: 'UNAVAILABLE', reason: error instanceof Error ? error.message : String(error) };
      }
    },
    async execute({ taskPacket, workspace, artifact, viewport = { width: 1280, height: 720 }, actions = [], route = '/', state = 'default' } = {}) {
      const boundary = assertSafePath(workspace?.boundary, workspace?.boundary, 'workspace');
      const artifactPath = assertSafePath(boundary, artifact?.path, 'artifact');
      const artifactRoot = fs.statSync(artifactPath).isDirectory() ? artifactPath : path.dirname(artifactPath);
      const entry = fs.statSync(artifactPath).isDirectory() ? 'index.html' : path.basename(artifactPath);
      const destinationRoot = assertSafePath(boundary, outputRoot ?? path.join(boundary, '.brain', 'visual-evidence'), 'output', { allowMissing: true });
      fs.mkdirSync(destinationRoot, { recursive: true });
      const executablePath = localBrowserExecutable();
      if (!executablePath) return { status: 'UNAVAILABLE', failure: 'chromium_executable_missing', provider: descriptor };
      const serverBundle = await createStaticServer(artifactRoot);
      const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-gpu'] });
      const context = await browser.newContext({ viewport: { width: Number(viewport.width), height: Number(viewport.height) } });
      const page = await context.newPage();
      const consoleErrors = [];
      const requestFailures = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300)); });
      page.on('requestfailed', (request) => requestFailures.push(`${request.url().slice(0, 300)}:${request.failure()?.errorText ?? 'failed'}`));
      const executionId = `visual-execution:${hash({ taskId: taskPacket?.taskId ?? 'unbound', artifactPath, viewport, route, state })}`;
      const screenshotPath = path.join(destinationRoot, `${executionId.replace(/[^a-z0-9:-]/gi, '-')}.png`);
      try {
        const response = await page.goto(`${serverBundle.url}${entry}${route === '/' ? '' : route}`, { waitUntil: 'networkidle', timeout: 15000 });
        const interactions = [];
        for (const [index, action] of actions.entries()) interactions.push(await applyAction(page, action, index));
        const layout = await page.evaluate(() => ({ title: document.title, bodyTextLength: document.body?.innerText?.length ?? 0, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, viewport: { width: window.innerWidth, height: window.innerHeight } }));
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const source = sourceRevision === 'unknown' ? taskPacket?.sourceRevision ?? 'unknown' : sourceRevision;
        const screenshot = { ref: `screenshot://${executionId}`, path: screenshotPath, viewport: { ...viewport }, route, state, capturedAt: new Date().toISOString() };
        const evidence = { status: 'RENDERED', executionId, provider: { providerId: descriptor.providerId, providerRevision: descriptor.providerRevision, authority: descriptor.authority }, artifact: { ref: `artifact://${hash(artifactPath)}`, path: artifactPath, entry }, screenshot, responseStatus: response?.status() ?? null, layout, interactions, consoleErrors, requestFailures, sourceRevision: source };
        evidence.visualInspection = inspectRenderedScreenshot(evidence);
        return evidence;
      } finally {
        await page.close(); await context.close(); await browser.close(); await closeServer(serverBundle.server);
      }
    }
  });
}
