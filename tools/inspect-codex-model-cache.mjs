#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cachePath = path.join(os.homedir(), '.codex', 'models_cache.json');
if (!fs.existsSync(cachePath)) {
  console.error(`MODEL_CACHE_MISSING ${cachePath}`);
  process.exit(2);
}
let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
} catch (error) {
  console.error(`MODEL_CACHE_INVALID ${error.message}`);
  process.exit(3);
}
const webModels = new Set();
const allModelLike = new Set();
function walk(value) {
  if (typeof value === 'string') {
    if (/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._/-]*$/i.test(value)) allModelLike.add(value);
    if (value.startsWith('chatgpt-web/')) webModels.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) walk(item);
  }
}
walk(parsed);
console.log(JSON.stringify({
  cachePath,
  webModelCount: webModels.size,
  webModels: [...webModels].sort(),
  modelLikeStringCount: allModelLike.size,
}, null, 2));
if (webModels.size === 0) process.exit(4);
