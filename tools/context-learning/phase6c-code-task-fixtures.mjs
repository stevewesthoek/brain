export const isolatedCodeTasks = Object.freeze([
  {
    id: 'task-01-bug-fix-math', category: 'BUG_FIXES', prompt: 'Fix the division bug in the code.', expectedQuestion: false,
    files: { 'src/math.mjs': 'export function divide(a, b) { return a / b; }\n', 'test/math.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { divide } from '../src/math.mjs';\ntest('division by zero is bounded', () => assert.equal(divide(8, 0), null));\ntest('normal division works', () => assert.equal(divide(8, 2), 4));\n" },
    patches: [{ path: 'src/math.mjs', find: 'return a / b;', replace: 'return b === 0 ? null : a / b;' }], testFile: 'test/math.test.mjs', expectedFiles: ['src/math.mjs'], requirements: ['division by zero returns null', 'normal division remains correct']
  },
  {
    id: 'task-02-feature-slug', category: 'FEATURE_WORK', prompt: 'Build the slug feature in code.', expectedQuestion: false,
    files: { 'src/text.mjs': 'export function titleCase(value) { return value.replace(/\\b\\w/g, (letter) => letter.toUpperCase()); }\n', 'test/text.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { slugify } from '../src/text.mjs';\ntest('slugify creates stable URL text', () => assert.equal(slugify('Hello, New World!'), 'hello-new-world'));\n" },
    patches: [{ path: 'src/text.mjs', find: 'export function titleCase', replace: "export function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }\n\nexport function titleCase" }], testFile: 'test/text.test.mjs', expectedFiles: ['src/text.mjs'], requirements: ['slugifies punctuation and whitespace']
  },
  {
    id: 'task-03-multifile-settings', category: 'FEATURE_WORK', prompt: 'Add the settings loading code and keep it testable.', expectedQuestion: false,
    files: { 'src/settings.mjs': "export function loadSettings(input) { return { ...input }; }\n", 'src/settings-defaults.mjs': "export const defaults = { retries: 2, mode: 'safe' };\n", 'test/settings.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { loadSettings } from '../src/settings.mjs';\ntest('settings merge defaults and overrides', () => assert.deepEqual(loadSettings({ mode: 'fast' }), { retries: 2, mode: 'fast' }));\n" },
    patches: [{ path: 'src/settings.mjs', find: "export function loadSettings(input) { return { ...input }; }", replace: "import { defaults } from './settings-defaults.mjs';\n\nexport function loadSettings(input) { return { ...defaults, ...input }; }" }], testFile: 'test/settings.test.mjs', expectedFiles: ['src/settings.mjs', 'src/settings-defaults.mjs'], requirements: ['preserves defaults', 'allows explicit overrides']
  },
  {
    id: 'task-04-refactor-format', category: 'REFACTORING', prompt: 'Clean up the duplicated formatter code without changing its output.', expectedQuestion: false,
    files: { 'src/format.mjs': "function pad(value) { return String(value).padStart(2, '0'); }\nexport function formatDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }\nexport function formatTime(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }\n", 'test/format.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { formatDate, formatTime } from '../src/format.mjs';\nconst date = new Date(2026, 0, 2, 3, 4);\ntest('formatter keeps stable date and time output', () => { assert.equal(formatDate(date), '2026-01-02'); assert.equal(formatTime(date), '03:04'); });\n" },
    patches: [{ path: 'src/format.mjs', find: "function pad(value) { return String(value).padStart(2, '0'); }", replace: "const pad = (value) => String(value).padStart(2, '0');" }], testFile: 'test/format.test.mjs', expectedFiles: ['src/format.mjs'], requirements: ['preserves date formatting', 'preserves time formatting']
  },
  {
    id: 'task-05-test-failure', category: 'TEST_FAILURES', prompt: 'Fix the validation bug in the code without changing its public behavior.', expectedQuestion: false,
    files: { 'src/validate.mjs': "export function isEmail(value) { return value.includes('@'); }\n", 'test/validate.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { isEmail } from '../src/validate.mjs';\ntest('email validation rejects malformed values', () => { assert.equal(isEmail('person@example.com'), true); assert.equal(isEmail('person@'), false); assert.equal(isEmail('person'), false); });\n" },
    patches: [{ path: 'src/validate.mjs', find: "return value.includes('@');", replace: "return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value);" }], testFile: 'test/validate.test.mjs', expectedFiles: ['src/validate.mjs'], requirements: ['rejects malformed email', 'accepts complete email']
  },
  {
    id: 'task-06-frontend-a11y', category: 'FRONTEND_IMPLEMENTATION', prompt: 'Improve the frontend code with an accessible submit control.', expectedQuestion: false,
    files: { 'src/form.html': '<form><input id="email"><button>Send</button></form>\n', 'test/form.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';\ntest('form has accessible labels and button type', () => { const html = fs.readFileSync('src/form.html', 'utf8'); assert.match(html, /label[^>]+for=\"email\"/); assert.match(html, /button type=\"submit\"/); });\n" },
    patches: [{ path: 'src/form.html', find: '<form><input id="email"><button>Send</button></form>', replace: '<form><label for="email">Email</label><input id="email"><button type="submit">Send</button></form>' }], testFile: 'test/form.test.mjs', expectedFiles: ['src/form.html'], requirements: ['labels the email input', 'declares submit button type']
  },
  {
    id: 'task-07-backend-api', category: 'BACKEND', prompt: 'Improve the API response code for a missing record.', expectedQuestion: false,
    files: { 'src/api.mjs': "export function responseFor(record) { return { status: 200, body: record }; }\n", 'test/api.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { responseFor } from '../src/api.mjs';\ntest('missing API record is not successful', () => assert.deepEqual(responseFor(null), { status: 404, body: { error: 'not_found' } }));\ntest('present API record remains successful', () => assert.deepEqual(responseFor({ id: 1 }), { status: 200, body: { id: 1 } }));\n" },
    patches: [{ path: 'src/api.mjs', find: "export function responseFor(record) { return { status: 200, body: record }; }", replace: "export function responseFor(record) { return record ? { status: 200, body: record } : { status: 404, body: { error: 'not_found' } }; }" }], testFile: 'test/api.test.mjs', expectedFiles: ['src/api.mjs'], requirements: ['returns 404 for missing record', 'preserves 200 for present record']
  },
  {
    id: 'task-08-configuration', category: 'CONFIGURATION', prompt: 'Make the configuration code reject an invalid port safely.', expectedQuestion: false,
    files: { 'src/config.mjs': "export function readConfig(input) { return { port: Number(input.port) }; }\n", 'test/config.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { readConfig } from '../src/config.mjs';\ntest('config accepts a valid port and rejects invalid input', () => { assert.equal(readConfig({ port: '3000' }).port, 3000); assert.throws(() => readConfig({ port: 'nope' }), /port/); });\n" },
    patches: [{ path: 'src/config.mjs', find: "return { port: Number(input.port) };", replace: "const port = Number(input.port); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid port'); return { port };" }], testFile: 'test/config.test.mjs', expectedFiles: ['src/config.mjs'], requirements: ['validates port bounds', 'retains numeric port']
  },
  {
    id: 'task-09-performance-cache', category: 'PERFORMANCE', prompt: 'Make this code much faster by caching repeated parsing.', expectedQuestion: false,
    files: { 'src/parser.mjs': "export function parse(value) { return value.split(',').map((item) => item.trim()); }\n", 'test/parser.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { parse, parseCalls } from '../src/parser.mjs';\ntest('parser caches repeated input', () => { assert.deepEqual(parse('a,b'), ['a', 'b']); assert.deepEqual(parse('a,b'), ['a', 'b']); assert.equal(parseCalls(), 1); });\n" },
    patches: [{ path: 'src/parser.mjs', find: "export function parse(value) { return value.split(',').map((item) => item.trim()); }", replace: "const cache = new Map(); let calls = 0;\nexport function parse(value) { if (cache.has(value)) return cache.get(value); calls += 1; const result = value.split(',').map((item) => item.trim()); cache.set(value, result); return result; }\nexport function parseCalls() { return calls; }" }], testFile: 'test/parser.test.mjs', expectedFiles: ['src/parser.mjs'], requirements: ['caches repeated parse', 'preserves parsed values']
  },
  {
    id: 'task-10-security-escape', category: 'SECURITY', prompt: 'Improve the security of this rendering code without changing its API.', expectedQuestion: false,
    files: { 'src/render.mjs': "export function renderName(name) { return `<p>${name}</p>`; }\n", 'test/render.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { renderName } from '../src/render.mjs';\ntest('renderer escapes markup', () => assert.equal(renderName('<script>'), '<p>&lt;script&gt;</p>'));\n" },
    patches: [{ path: 'src/render.mjs', find: "export function renderName(name) { return `<p>${name}</p>`; }", replace: "export function renderName(name) { const escaped = String(name).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); return `<p>${escaped}</p>`; }" }], testFile: 'test/render.test.mjs', expectedFiles: ['src/render.mjs'], requirements: ['escapes untrusted markup']
  },
  {
    id: 'task-11-docs-plus-code', category: 'DOCUMENTATION_PLUS_CODE', prompt: 'Document and improve the code contract for a bounded retry helper.', expectedQuestion: false,
    files: { 'src/retry.mjs': 'export function retriesFor(attempts) { return Math.max(0, attempts - 1); }\n', 'test/retry.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { retriesFor } from '../src/retry.mjs';\ntest('retry helper never returns a negative count', () => assert.equal(retriesFor(0), 0));\n" },
    patches: [{ path: 'src/retry.mjs', find: 'export function retriesFor(attempts)', replace: '/** Returns the number of retries after the first attempt, never below zero. */\nexport function retriesFor(attempts)' }], testFile: 'test/retry.test.mjs', expectedFiles: ['src/retry.mjs'], requirements: ['documents retry semantics', 'preserves non-negative behavior']
  },
  {
    id: 'task-12-storage-normalization', category: 'DATA_STORAGE', prompt: 'Fix the storage adapter code so missing values normalize consistently.', expectedQuestion: false,
    files: { 'src/store.mjs': "export function readValue(record, key) { return record[key]; }\n", 'test/store.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { readValue } from '../src/store.mjs';\ntest('missing stored value is null', () => assert.equal(readValue({}, 'name'), null));\ntest('stored value is preserved', () => assert.equal(readValue({ name: 'Ada' }, 'name'), 'Ada'));\n" },
    patches: [{ path: 'src/store.mjs', find: 'return record[key];', replace: 'return record[key] ?? null;' }], testFile: 'test/store.test.mjs', expectedFiles: ['src/store.mjs'], requirements: ['normalizes missing value', 'preserves stored value']
  },
  {
    id: 'task-13-api-error', category: 'API', prompt: 'Make the API code return a stable error shape for invalid input.', expectedQuestion: false,
    files: { 'src/request.mjs': "export function handleRequest(input) { return { ok: true, data: input.value }; }\n", 'test/request.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { handleRequest } from '../src/request.mjs';\ntest('invalid request returns stable error', () => assert.deepEqual(handleRequest({}), { ok: false, error: 'invalid_input' }));\n" },
    patches: [{ path: 'src/request.mjs', find: "export function handleRequest(input) { return { ok: true, data: input.value }; }", replace: "export function handleRequest(input) { return input && input.value ? { ok: true, data: input.value } : { ok: false, error: 'invalid_input' }; }" }], testFile: 'test/request.test.mjs', expectedFiles: ['src/request.mjs'], requirements: ['rejects missing input', 'keeps stable error shape']
  },
  {
    id: 'task-14-review-heavy', category: 'REVIEW_HEAVY_TASKS', prompt: 'Implement this bounded code change with a clear validation target.', expectedQuestion: false,
    files: { 'src/limit.mjs': 'export function limit(items, max) { return items.slice(0, max); }\n', 'test/limit.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { limit } from '../src/limit.mjs';\ntest('limit returns at most the requested items', () => assert.deepEqual(limit([1, 2, 3], 2), [1, 2]));\n" },
    patches: [{ path: 'src/limit.mjs', find: 'export function limit(items, max)', replace: '/** Returns a bounded prefix without mutating the input array. */\nexport function limit(items, max)' }], testFile: 'test/limit.test.mjs', expectedFiles: ['src/limit.mjs'], requirements: ['keeps output bounded', 'does not mutate input']
  },
  {
    id: 'task-15-qa-heavy', category: 'QA_HEAVY_TASKS', prompt: 'Implement the code fix and include targeted QA coverage.', expectedQuestion: false,
    files: { 'src/flags.mjs': "export function enabled(value) { return value === true; }\n", 'test/flags.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { enabled } from '../src/flags.mjs';\ntest('flag only accepts boolean true', () => { assert.equal(enabled(true), true); assert.equal(enabled('true'), false); assert.equal(enabled(1), false); });\n" },
    patches: [{ path: 'src/flags.mjs', find: 'return value === true;', replace: 'return typeof value === \'boolean\' && value === true;' }], testFile: 'test/flags.test.mjs', expectedFiles: ['src/flags.mjs'], requirements: ['rejects truthy non-booleans', 'accepts boolean true']
  },
  {
    id: 'task-16-unknown-area', category: 'UNKNOWN_REPO_AREA', prompt: 'Why is this code not working? Map the smallest relevant area and fix the parser.', expectedQuestion: false,
    files: { 'src/unknown.mjs': "export function parseCount(value) { return parseInt(value); }\n", 'test/unknown.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { parseCount } from '../src/unknown.mjs';\ntest('count parser rejects trailing junk', () => { assert.equal(parseCount('12'), 12); assert.equal(parseCount('12px'), null); });\n" },
    patches: [{ path: 'src/unknown.mjs', find: 'return parseInt(value);', replace: "return /^\\d+$/.test(String(value)) ? Number(value) : null;" }], testFile: 'test/unknown.test.mjs', expectedFiles: ['src/unknown.mjs'], requirements: ['maps bounded unknown area', 'rejects malformed count']
  },
  {
    id: 'task-17-known-file', category: 'KNOWN_EXACT_FILE', prompt: 'Fix the exact code file src/queue.mjs and keep the queue ordering.', expectedQuestion: false,
    files: { 'src/queue.mjs': 'export function dequeue(queue) { return queue.pop(); }\n', 'test/queue.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { dequeue } from '../src/queue.mjs';\ntest('queue removes the oldest item', () => { const queue = ['first', 'second']; assert.equal(dequeue(queue), 'first'); assert.deepEqual(queue, ['second']); });\n" },
    patches: [{ path: 'src/queue.mjs', find: 'return queue.pop();', replace: 'return queue.shift();' }], testFile: 'test/queue.test.mjs', expectedFiles: ['src/queue.mjs'], requirements: ['targets exact file', 'preserves FIFO ordering']
  },
  {
    id: 'task-18-continuation', category: 'CONTINUATION', prompt: 'Continue the bounded code task and finish the missing implementation.', expectedQuestion: false,
    files: { 'src/continue.mjs': 'export function nextStep(state) { return state.step; }\n', 'test/continue.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { nextStep } from '../src/continue.mjs';\ntest('continuation advances one bounded step', () => assert.equal(nextStep({ step: 3 }), 4));\n" },
    patches: [{ path: 'src/continue.mjs', find: 'return state.step;', replace: 'return state.step + 1;' }], testFile: 'test/continue.test.mjs', expectedFiles: ['src/continue.mjs'], requirements: ['advances continuation state once']
  },
  {
    id: 'task-19-dormant-specialist', category: 'DORMANT_SPECIALIST_REQUIRED', prompt: 'Implement the code input validation fix using the relevant security specialist.', expectedQuestion: false,
    files: { 'src/input.mjs': "export function safeValue(value) { return value.trim(); }\n", 'test/input.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { safeValue } from '../src/input.mjs';\ntest('input validation handles non-strings safely', () => { assert.equal(safeValue(' ok '), 'ok'); assert.equal(safeValue(null), ''); });\n" },
    patches: [{ path: 'src/input.mjs', find: 'return value.trim();', replace: "return typeof value === 'string' ? value.trim() : '';" }], testFile: 'test/input.test.mjs', expectedFiles: ['src/input.mjs'], requirements: ['handles untrusted non-string input', 'trims strings'], dormantCapability: 'security specialist'
  },
  {
    id: 'task-20-repair-cycle', category: 'REPAIR_LOOP', prompt: 'Implement the bounded summary code change and enforce the output limit.', expectedQuestion: false,
    files: { 'src/summary.mjs': "export function summarize(items) { return items.map((item) => item.name).join(', '); }\n", 'test/summary.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { summarize } from '../src/summary.mjs';\ntest('summary returns a bounded list', () => assert.equal(summarize([{ name: 'a' }, { name: 'b' }]), 'a, b'));\n" },
    patches: [{ path: 'src/summary.mjs', find: "return items.map((item) => item.name).join(', ');", replace: "return items.map((item) => item.name).join(', ');" }], repairPatches: [{ path: 'src/summary.mjs', find: "return items.map((item) => item.name).join(', ');", replace: "return items.slice(0, 10).map((item) => item.name).join(', ');" }], testFile: 'test/summary.test.mjs', expectedFiles: ['src/summary.mjs'], requirements: ['returns a bounded list'], review: { type: 'required-token', path: 'src/summary.mjs', token: 'slice(0, 10)', finding: 'Review requires an explicit ten-item output bound.' }
  }
]);

export default isolatedCodeTasks;
