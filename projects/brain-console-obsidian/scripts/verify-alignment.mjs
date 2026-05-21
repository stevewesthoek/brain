#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const viewPath = path.join(root, 'src', 'view.ts');
const source = fs.readFileSync(viewPath, 'utf8');

const errors = [];

const promiseStart = source.indexOf('const results = await Promise.allSettled(');
if (promiseStart === -1) {
  fail('Could not find Promise.allSettled assignment in src/view.ts.');
}

const arrayOpen = source.indexOf('[', promiseStart);
const arrayClose = findMatching(source, arrayOpen, '[', ']');
const promiseCount = countTopLevelItems(source.slice(arrayOpen + 1, arrayClose));

const destructureStart = source.indexOf('const [', arrayClose);
if (destructureStart === -1) {
  fail('Could not find settledValues destructuring after Promise.allSettled.');
}

const destructureOpen = source.indexOf('[', destructureStart);
const destructureClose = findMatching(source, destructureOpen, '[', ']');
const destructureTarget = source.slice(destructureClose, source.indexOf(';', destructureClose));
if (!destructureTarget.includes('= settledValues')) {
  fail('The first destructuring after Promise.allSettled does not target settledValues.');
}
const destructureCount = countTopLevelItems(source.slice(destructureOpen + 1, destructureClose));

const paddingStart = source.indexOf('withSafeEndpointPadding(', arrayClose);
if (paddingStart === -1) {
  fail('Could not find withSafeEndpointPadding call after Promise.allSettled.');
}
const paddingOpen = source.indexOf('(', paddingStart);
const paddingClose = findMatching(source, paddingOpen, '(', ')');
const paddingArgs = splitTopLevel(source.slice(paddingOpen + 1, paddingClose));
const paddingValue = Number.parseInt((paddingArgs[1] ?? '').trim(), 10);
if (!Number.isFinite(paddingValue)) {
  fail('Could not parse withSafeEndpointPadding minimum length.');
}

if (promiseCount !== destructureCount) {
  errors.push(`Promise count (${promiseCount}) does not match destructured variable count (${destructureCount}).`);
}
if (promiseCount !== paddingValue) {
  errors.push(`Promise count (${promiseCount}) does not match padding value (${paddingValue}).`);
}
if (destructureCount !== paddingValue) {
  errors.push(`Destructured variable count (${destructureCount}) does not match padding value (${paddingValue}).`);
}

if (errors.length > 0) {
  console.error('Brain Console alignment check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Brain Console alignment OK: ${promiseCount} promises, ${destructureCount} destructured vars, padding ${paddingValue}.`);

function fail(message) {
  console.error(`Brain Console alignment check failed: ${message}`);
  process.exit(1);
}

function findMatching(text, openIndex, openChar, closeChar) {
  if (openIndex < 0 || text[openIndex] !== openChar) {
    fail(`Could not find opening ${openChar}.`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  fail(`Could not find closing ${closeChar}.`);
}

function countTopLevelItems(text) {
  return splitTopLevel(text).filter((item) => item.trim().length > 0).length;
}

function splitTopLevel(text) {
  const items = [];
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let current = '';

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      current += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  items.push(current);
  return items;
}
