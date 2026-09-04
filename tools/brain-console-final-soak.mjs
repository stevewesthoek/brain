import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:4881';
const DEBUG_PORT = 9231;
const SOAK_MS = Number(process.env.BRAIN_SOAK_MS ?? 30 * 60 * 1000);
const CHECKPOINTS = [0, 5, 10, 15, 20, 25, 30].map((minutes) => minutes * 60 * 1000);
const routes = [
  ['/command-center', 'Command Center'],
  ['/brain', 'Brain overview'],
  ['/brain/active-work', 'Active Work'],
  ['/brain/tasks/0C-C', 'TASK DETAIL'],
  ['/brain/tasks/0C-C?context=ctx-missing', 'TASK DETAIL'],
  ['/brain/tasks/0C-C?evidence=evidence-missing', 'TASK DETAIL'],
  ['/brain/tasks-evidence', 'Tasks & Evidence'],
  ['/brain/quality-safety', 'Quality & Safety'],
  ['/brain/continuity', 'Continuity'],
  ['/brain/capability-routing', 'Capability Routing'],
  ['/', 'Operational control'],
  ['/monitoring', 'Infrastructure Telemetry'],
  ['/scheduler', 'Brain Scheduler'],
  ['/local-apps', 'Apps'],
  ['/infrastructure', 'Infrastructure'],
  ['/dokploy', 'Dokploy'],
  ['/tunnels', 'Tunnels'],
  ['/ai-models', 'AI Models'],
];

function now() { return new Date().toISOString(); }
function psRows() {
  try { return execFileSync('ps', ['-ww', '-axo', 'pid=,rss=,%cpu=,command='], { encoding: 'utf8' }).split('\n'); } catch { return []; }
}
function processMetric(pattern, field) {
  return psRows().reduce((sum, line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.+)$/);
    return match && pattern.test(match[4]) ? sum + Number(match[field]) : sum;
  }, 0);
}
function snapshot(label, profile) {
  const profilePattern = new RegExp(profile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const corePattern = /brain-core\/dist\/index\.js/;
  const consolePattern = /next-server \(v15\.5\.19\)/;
  return {
    at: now(), label,
    coreRssMb: Number((processMetric(corePattern, 2) / 1024).toFixed(1)),
    consoleRssMb: Number((processMetric(consolePattern, 2) / 1024).toFixed(1)),
    browserRssMb: Number((processMetric(profilePattern, 2) / 1024).toFixed(1)),
    coreCpuPct: Number(processMetric(corePattern, 3).toFixed(1)),
    consoleCpuPct: Number(processMetric(consolePattern, 3).toFixed(1)),
  };
}

const profile = `/tmp/brain-console-final-soak-${process.pid}`;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${DEBUG_PORT}`,
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}
async function waitForPageTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const target = targets.find((item) => item.type === 'page' && item.url === 'about:blank');
      if (target) return target;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome page target did not start');
}

const target = await waitForPageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const events = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method) events.push(message);
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await cdp('Runtime.enable');
await cdp('Network.enable');
await cdp('Page.enable');
await cdp('Performance.enable');
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
  (() => {
    const activeIntervals = new Set();
    const activeTimeouts = new Set();
    const errors = [];
    const setIntervalOriginal = window.setInterval.bind(window);
    const clearIntervalOriginal = window.clearInterval.bind(window);
    const setTimeoutOriginal = window.setTimeout.bind(window);
    const clearTimeoutOriginal = window.clearTimeout.bind(window);
    window.setInterval = (...args) => { const id = setIntervalOriginal(...args); activeIntervals.add(id); return id; };
    window.clearInterval = (id) => { activeIntervals.delete(id); return clearIntervalOriginal(id); };
    window.setTimeout = (...args) => { const id = setTimeoutOriginal(...args); activeTimeouts.add(id); return id; };
    window.clearTimeout = (id) => { activeTimeouts.delete(id); return clearTimeoutOriginal(id); };
    const listeners = new Map();
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const key = [this, type, listener, typeof options === 'boolean' ? options : options?.capture].join('|');
      listeners.set(key, true); return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const key = [this, type, listener, typeof options === 'boolean' ? options : options?.capture].join('|');
      listeners.delete(key); return remove.call(this, type, listener, options);
    };
    add.call(window, 'error', (event) => errors.push({ message: event.message, source: event.filename, line: event.lineno, column: event.colno }));
    add.call(window, 'unhandledrejection', (event) => errors.push({ message: String(event.reason?.stack || event.reason) }));
    let longTasks = 0;
    try { new PerformanceObserver((list) => { longTasks += list.getEntries().length; }).observe({ type: 'longtask', buffered: true }); } catch {}
    window.__brainSoakStats = () => ({ intervals: activeIntervals.size, timeouts: activeTimeouts.size, listeners: listeners.size, errors: errors.slice(-5), longTasks });
  })();
`});
events.splice(0);

const requestCounts = new Map();
const failures = [];
const consoleErrors = [];
const exceptions = [];
const httpFailures = [];
let responseErrors = 0;

async function evaluate(expression, awaitPromise = false) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  return result?.result?.value;
}
async function usageDiagnostics() {
  return evaluate(`fetch('http://127.0.0.1:4877/ops/ai-usage-windows', { cache: 'no-store' }).then((response) => response.json()).then((payload) => payload.data?.diagnostics ?? null).catch((error) => ({ error: String(error) }))`, true);
}
async function navigate(path, expectedText) {
  const targetUrl = new URL(path, BASE);
  const clickResult = await evaluate(`(() => {
    const target = ${JSON.stringify(targetUrl.href)};
    const link = [...document.querySelectorAll('a')].find((candidate) => candidate.href === target);
    if (link) { link.click(); return 'existing-link'; }
    const fallback = document.createElement('a');
    fallback.href = target;
    fallback.textContent = 'soak navigation';
    fallback.style.display = 'none';
    document.body.appendChild(fallback);
    fallback.click();
    return 'fallback-link';
  })()`);
  if (!clickResult) throw new Error(`navigation dispatch failed for ${path}`);
  const startedAt = performance.now();
  let found = false;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    found = await evaluate(`location.pathname + location.search === ${JSON.stringify(targetUrl.pathname + targetUrl.search)} && document.body?.innerText?.toLowerCase().includes(${JSON.stringify(expectedText.toLowerCase())})`);
    if (found) break;
    await delay(50);
  }
  const elapsed = Math.round(performance.now() - startedAt);
  if (!found) {
    const body = await evaluate('document.body?.innerText?.slice(0, 800)');
    throw new Error(`target text not found for ${path}; body=${JSON.stringify(body)}`);
  }
  await delay(750);
  const batch = events.splice(0, events.length);
  for (const event of batch) {
    if (event.method === 'Runtime.exceptionThrown') exceptions.push({ path, message: event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || 'unknown' });
    if (event.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(event.params?.type)) consoleErrors.push({ path, message: (event.params?.args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' ') });
    if (event.method === 'Network.loadingFailed' && event.params?.errorText !== 'net::ERR_ABORTED') failures.push({ path, error: event.params?.errorText || 'unknown' });
    if (event.method === 'Network.responseReceived') {
      const status = event.params?.response?.status ?? 200;
      if (status >= 400) {
        responseErrors += 1;
        httpFailures.push({ path, url: event.params?.response?.url, status });
      }
    }
    if (event.method === 'Network.requestWillBeSent') {
      const pathname = new URL(event.params.request.url).pathname;
      requestCounts.set(pathname, (requestCounts.get(pathname) || 0) + 1);
    }
  }
  return { elapsed, stats: await evaluate('window.__brainSoakStats?.()'), memory: await evaluate('performance.memory ? { used: performance.memory.usedJSHeapSize } : null') };
}

const startedAt = Date.now();
const profileForSnapshot = profile;
const checkpoints = [];
let nextCheckpoint = 0;
let interrupted = false;
try {
  while (Date.now() - startedAt <= SOAK_MS) {
    for (const [path, expectedText] of routes) {
      const result = await navigate(path, expectedText);
      while (nextCheckpoint < CHECKPOINTS.length && Date.now() - startedAt >= CHECKPOINTS[nextCheckpoint]) {
        const point = snapshot(`${CHECKPOINTS[nextCheckpoint] / 60000}m`, profileForSnapshot);
        point.lastRouteMs = result.elapsed;
        point.pageStats = result.stats;
        point.heapMb = result.memory ? Number((result.memory.used / 1024 / 1024).toFixed(1)) : null;
        point.requests = [...requestCounts.values()].reduce((sum, count) => sum + count, 0);
        point.failedRequests = failures.length + responseErrors;
        point.browserErrors = exceptions.length + consoleErrors.length;
        point.usageDiagnostics = await usageDiagnostics();
        checkpoints.push(point);
        console.log(JSON.stringify(point));
        nextCheckpoint += 1;
      }
      if (nextCheckpoint >= 4 && !interrupted) {
        interrupted = true;
        const before = snapshot('before-core-interruption', profileForSnapshot);
        execFileSync('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/com.office.brain-core`]);
        let recovered = false;
        for (let attempt = 0; attempt < 30; attempt += 1) {
          try { await getJson('http://127.0.0.1:4877/runtime/identity'); recovered = true; break; } catch { await delay(1000); }
        }
        const after = snapshot('after-core-interruption', profileForSnapshot);
        console.log(JSON.stringify({ recovery: { at: now(), coreInterruption: 'PASS', recovered, before, after } }));
      }
      if (Date.now() - startedAt > SOAK_MS) break;
    }
    await delay(1000);
  }
  while (nextCheckpoint < CHECKPOINTS.length) {
    const point = snapshot(`${CHECKPOINTS[nextCheckpoint] / 60000}m`, profileForSnapshot);
    point.requests = [...requestCounts.values()].reduce((sum, count) => sum + count, 0);
    point.failedRequests = failures.length + responseErrors;
    point.browserErrors = exceptions.length + consoleErrors.length;
    point.usageDiagnostics = await usageDiagnostics();
    checkpoints.push(point); console.log(JSON.stringify(point)); nextCheckpoint += 1;
  }
  console.log(JSON.stringify({ complete: true, startedAt: new Date(startedAt).toISOString(), endedAt: now(), checkpoints, failures, responseErrors, httpFailures, exceptions, consoleErrors, requestCounts: Object.fromEntries(requestCounts) }));
} finally {
  socket.close();
  chrome.kill('SIGTERM');
}
