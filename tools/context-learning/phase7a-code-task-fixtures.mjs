import { isolatedCodeTasks } from './phase6c-code-task-fixtures.mjs';

export const phase7aAdditionalCodeTasks = Object.freeze([
  {
    id: 'phase7a-task-21-bounded-retry', category: 'FEATURE_WORK', prompt: 'Add the bounded retry helper in code.', expectedQuestion: false,
    files: { 'src/retry.mjs': 'export function retryCount(attempts) { return attempts; }\n', 'test/retry.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { retryCount } from '../src/retry.mjs';\ntest('retry count is capped at three', () => { assert.equal(retryCount(2), 2); assert.equal(retryCount(9), 3); });\n" },
    patches: [{ path: 'src/retry.mjs', find: 'return attempts;', replace: 'return Math.min(3, Math.max(0, attempts));' }], testFile: 'test/retry.test.mjs', expectedFiles: ['src/retry.mjs'], requirements: ['caps retries', 'preserves small counts']
  },
  {
    id: 'phase7a-task-22-frontend-status', category: 'FRONTEND_IMPLEMENTATION', prompt: 'Add the accessible status text to the frontend code.', expectedQuestion: false,
    files: { 'src/status.html': '<section id="status"></section>\n', 'test/status.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';\ntest('status has an accessible live region', () => assert.match(fs.readFileSync('src/status.html', 'utf8'), /role=\"status\" aria-live=\"polite\"/));\n" },
    patches: [{ path: 'src/status.html', find: '<section id="status"></section>', replace: '<section id="status" role="status" aria-live="polite"></section>' }], testFile: 'test/status.test.mjs', expectedFiles: ['src/status.html'], requirements: ['declares status role', 'declares polite live updates']
  },
  {
    id: 'phase7a-task-23-api-normalization', category: 'API', prompt: 'Normalize the API page parameter in code.', expectedQuestion: false,
    files: { 'src/page.mjs': 'export function pageNumber(value) { return Number(value); }\n', 'test/page.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { pageNumber } from '../src/page.mjs';\ntest('page numbers are positive integers', () => { assert.equal(pageNumber('2'), 2); assert.equal(pageNumber('0'), 1); assert.equal(pageNumber('x'), 1); });\n" },
    patches: [{ path: 'src/page.mjs', find: 'return Number(value);', replace: "const page = Number(value); return Number.isInteger(page) && page > 0 ? page : 1;" }], testFile: 'test/page.test.mjs', expectedFiles: ['src/page.mjs'], requirements: ['accepts positive page', 'normalizes invalid page']
  },
  {
    id: 'phase7a-task-24-multifile-result', category: 'FEATURE_WORK', prompt: 'Add a small result factory across the code files.', expectedQuestion: false,
    files: { 'src/result.mjs': 'export function result(data) { return { data }; }\n', 'src/result-status.mjs': "export const ok = 'ok';\n", 'test/result.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { result } from '../src/result.mjs';\ntest('result factory includes a stable status', () => assert.deepEqual(result(4), { status: 'ok', data: 4 }));\n" },
    patches: [{ path: 'src/result.mjs', find: 'export function result(data) { return { data }; }', replace: "import { ok } from './result-status.mjs';\n\nexport function result(data) { return { status: ok, data }; }" }], testFile: 'test/result.test.mjs', expectedFiles: ['src/result.mjs', 'src/result-status.mjs'], requirements: ['includes status', 'preserves data']
  },
  {
    id: 'phase7a-task-25-refactor-clamp', category: 'REFACTORING', prompt: 'Refactor the bounded value helper without changing its output.', expectedQuestion: false,
    files: { 'src/clamp.mjs': 'export function clamp(value, min, max) { if (value < min) return min; if (value > max) return max; return value; }\n', 'test/clamp.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import { clamp } from '../src/clamp.mjs';\ntest('clamp keeps values in range', () => { assert.equal(clamp(1, 2, 4), 2); assert.equal(clamp(5, 2, 4), 4); assert.equal(clamp(3, 2, 4), 3); });\n" },
    patches: [{ path: 'src/clamp.mjs', find: 'if (value < min) return min; if (value > max) return max;', replace: 'return Math.min(max, Math.max(min, value));' }], testFile: 'test/clamp.test.mjs', expectedFiles: ['src/clamp.mjs'], requirements: ['keeps lower bound', 'keeps upper bound', 'preserves in-range output']
  }
]);

export const phase7aIsolatedCodeTasks = Object.freeze([...isolatedCodeTasks, ...phase7aAdditionalCodeTasks]);
export default phase7aIsolatedCodeTasks;
