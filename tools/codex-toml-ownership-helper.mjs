#!/usr/bin/env node
import fs from 'node:fs';

const EXTERNAL_TOP_LEVEL = new Set(['openai_base_url','experimental_realtime_webrtc_call_base_url','model']);
const EXTERNAL_SECTIONS = new Set(['agents','features','hooks','marketplaces','plugins','projects','tui','desktop','mcp_servers']);
const APP_LOCAL_NODE_REPL_ENV_KEYS = new Set(['BROWSER_USE_CODEX_APP_VERSION','BROWSER_USE_TINYSKY_ENABLED','NODE_REPL_TRUSTED_SERVICES']);

function stripComment(line) {
  let quote = null, escape = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escape) { escape = false; continue; }
    if (quote === '"' && ch === '\\') { escape = true; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '#') return line.slice(0, i);
  }
  return line;
}

function splitOutside(input, delimiter) {
  const parts = []; let start = 0, quote = null, escape = false, depth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) { escape = false; continue; }
    if (quote === '"' && ch === '\\') { escape = true; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if ('[{'.includes(ch)) depth++;
    else if (']}'.includes(ch)) depth--;
    else if (ch === delimiter && depth === 0) { parts.push(input.slice(start, i)); start = i + 1; }
  }
  parts.push(input.slice(start)); return parts;
}

function parseKeyPath(input) {
  return splitOutside(input.trim(), '.').map((part) => {
    const v = part.trim();
    if (!v) throw new Error('empty TOML key segment');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return parseValue(v);
    if (!/^[A-Za-z0-9_-]+$/.test(v)) throw new Error(`unsupported TOML key: ${v}`);
    return v;
  });
}

function parseValue(raw) {
  const v = raw.trim();
  if (v.startsWith('"')) {
    if (!v.endsWith('"')) throw new Error('unterminated TOML string');
    return JSON.parse(v);
  }
  if (v.startsWith("'")) {
    if (!v.endsWith("'")) throw new Error('unterminated TOML literal string');
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^[+-]?\d+$/.test(v)) return Number(v);
  if (/^[+-]?\d+\.\d+$/.test(v)) return Number(v);
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new Error('unterminated TOML array');
    const inner = v.slice(1, -1).trim();
    return inner ? splitOutside(inner, ',').filter((x) => x.trim()).map(parseValue) : [];
  }
  if (v.startsWith('{')) {
    if (!v.endsWith('}')) throw new Error('unterminated TOML inline table');
    const obj = {}; const inner = v.slice(1, -1).trim();
    for (const item of inner ? splitOutside(inner, ',') : []) {
      const idx = splitAssignmentIndex(item); if (idx < 0) throw new Error('invalid inline table assignment');
      setPath(obj, parseKeyPath(item.slice(0, idx)), parseValue(item.slice(idx + 1)));
    }
    return obj;
  }
  throw new Error(`unsupported TOML value: ${v.slice(0, 40)}`);
}

function splitAssignmentIndex(line) {
  let quote = null, escape = false, depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escape) { escape = false; continue; }
    if (quote === '"' && ch === '\\') { escape = true; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if ('[{'.includes(ch)) depth++;
    else if (']}'.includes(ch)) depth--;
    else if (ch === '=' && depth === 0) return i;
  }
  return -1;
}

function setPath(root, path, value) {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (node[key] == null) node[key] = {};
    if (!node[key] || typeof node[key] !== 'object' || Array.isArray(node[key])) throw new Error(`TOML path conflict at ${key}`);
    node = node[key];
  }
  const key = path.at(-1);
  if (Object.prototype.hasOwnProperty.call(node, key)) throw new Error(`duplicate TOML key: ${path.join('.')}`);
  node[key] = value;
}

function parseToml(text) {
  const root = {}; let section = [];
  const lines = text.split(/\r?\n/);
  let pending = '';
  for (let index = 0; index < lines.length; index++) {
    let line = stripComment(lines[index]).trim();
    if (!line && !pending) continue;
    if (pending) line = `${pending}\n${line}`;
    const balance = structuralBalance(line);
    if (balance > 0) { pending = line; continue; }
    if (balance < 0) throw new Error(`unbalanced TOML at line ${index + 1}`);
    pending = '';
    if (!line) continue;
    if (line.startsWith('[[')) throw new Error('array-of-tables TOML is unsupported in Codex managed-root config');
    if (line.startsWith('[')) {
      if (!line.endsWith(']')) throw new Error(`invalid TOML section at line ${index + 1}`);
      section = parseKeyPath(line.slice(1, -1));
      let node = root;
      for (const key of section) {
        if (node[key] == null) node[key] = {};
        if (!node[key] || typeof node[key] !== 'object' || Array.isArray(node[key])) throw new Error(`TOML section conflict at ${section.join('.')}`);
        node = node[key];
      }
      continue;
    }
    const eq = splitAssignmentIndex(line);
    if (eq < 0) throw new Error(`invalid TOML assignment at line ${index + 1}`);
    setPath(root, [...section, ...parseKeyPath(line.slice(0, eq))], parseValue(line.slice(eq + 1)));
  }
  if (pending) throw new Error('unterminated TOML value');
  return root;
}

function structuralBalance(input) {
  let quote = null, escape = false, depth = 0;
  for (const ch of input) {
    if (escape) { escape = false; continue; }
    if (quote === '"' && ch === '\\') { escape = true; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if ('[{'.includes(ch)) depth++;
    else if (']}'.includes(ch)) depth--;
  }
  return quote ? 1 : depth;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function contains(actual, managed, path = []) {
  if (managed && typeof managed === 'object' && !Array.isArray(managed)) {
    const entries = Object.entries(managed).filter(([key]) => path.length || !EXTERNAL_TOP_LEVEL.has(key));
    return entries.every(([key, value]) => Object.prototype.hasOwnProperty.call(actual ?? {}, key) && ((!path.length && key === 'desktop') || contains(actual[key], value, [...path, key])));
  }
  return deepEqual(actual, managed);
}

function sections(text) {
  const lines = text.split(/(?<=\n)/); const found = []; let start = -1, name = null;
  const header = /^\s*\[([^\[\]]+)\]\s*(?:#.*)?(?:\n)?$/;
  for (let i = 0; i < lines.length; i++) {
    const m = header.exec(lines[i]); if (!m) continue;
    if (start >= 0) found.push({ name, block: lines.slice(start, i).join('') });
    start = i; name = m[1].trim();
  }
  if (start >= 0) found.push({ name, block: lines.slice(start).join('') });
  return found;
}

function assignmentLines(block) {
  const out = new Map();
  for (const line of block.split(/\r?\n/)) { const m = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line); if (m) out.set(m[1], line); }
  return out;
}

function topLevelAssignments(text) {
  const out = new Map();
  for (const line of text.split(/(?<=\n)/)) {
    if (line.trimStart().startsWith('[')) break;
    const m = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line); if (m) out.set(m[1], line.endsWith('\n') ? line : `${line}\n`);
  }
  return out;
}

function replaceOrInsertTopLevel(text, key, replacement) {
  const lines = text.split(/(?<=\n)/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('[')) { lines.splice(i, 0, replacement); return lines.join(''); }
    if (new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`).test(lines[i])) { lines[i] = replacement; return lines.join(''); }
  }
  lines.push(replacement); return lines.join('');
}

function preserve(currentText, stagedText) {
  const currentData = parseToml(currentText); const stagedData = parseToml(stagedText);
  const currentSections = sections(currentText); const stagedSections = sections(stagedText);
  const currentDesktop = !deepEqual(currentData.desktop, stagedData.desktop) ? currentSections.filter(({name}) => name === 'desktop' || name.startsWith('desktop.')) : [];
  if (currentDesktop.length) {
    for (const {name, block} of sections(stagedText)) if (name === 'desktop' || name.startsWith('desktop.')) stagedText = stagedText.replace(block, '');
    stagedText = `${stagedText.trimEnd()}\n\n# Preserved app-local desktop state; not Git-owned.\n${currentDesktop.map(({block}) => block.trimEnd()).join('\n')}\n`;
  }
  const curEnvBlock = currentSections.find(({name}) => name === 'mcp_servers.node_repl.env')?.block ?? '';
  const stagedEnvBlock = sections(stagedText).find(({name}) => name === 'mcp_servers.node_repl.env')?.block ?? '';
  const curEnv = assignmentLines(curEnvBlock), stagedEnv = assignmentLines(stagedEnvBlock);
  const missing = [...curEnv.entries()].filter(([key]) => APP_LOCAL_NODE_REPL_ENV_KEYS.has(key) && !stagedEnv.has(key)).map(([,line]) => line);
  if (missing.length) {
    const target = sections(stagedText).find(({name}) => name === 'mcp_servers.node_repl.env');
    if (target) stagedText = stagedText.replace(target.block, `${target.block.trimEnd()}\n${missing.join('\n')}\n`);
  }
  const currentTop = topLevelAssignments(currentText), stagedTop = topLevelAssignments(stagedText);
  for (const [key, line] of currentTop) {
    if ((EXTERNAL_TOP_LEVEL.has(key) && stagedTop.has(key) && line !== stagedTop.get(key)) || !stagedTop.has(key)) stagedText = replaceOrInsertTopLevel(stagedText, key, line);
  }
  const stagedNames = new Set(sections(stagedText).map(({name}) => name));
  const extra = currentSections.filter(({name}) => !stagedNames.has(name));
  if (extra.length) stagedText = `${stagedText.trimEnd()}\n\n# Preserved app-local upgrade state; not Git-owned.\n${extra.map(({block}) => block.trimEnd()).join('\n')}\n`;
  parseToml(stagedText);
  return stagedText;
}

const [op, a, b, c] = process.argv.slice(2);
try {
  if (op === 'contains-managed') {
    const actual = parseToml(fs.readFileSync(a, 'utf8')); const managed = parseToml(fs.readFileSync(b, 'utf8'));
    process.exit(contains(actual, managed) ? 0 : 1);
  } else if (op === 'plan') {
    const current = parseToml(fs.readFileSync(a, 'utf8')); const canonical = parseToml(fs.readFileSync(b, 'utf8'));
    const externalSections = Object.keys(current).filter((key) => !(key in canonical) && EXTERNAL_SECTIONS.has(key));
    const preservedTop = Object.keys(current).filter((key) => !(key in canonical) || EXTERNAL_TOP_LEVEL.has(key));
    console.log(`OWNERSHIP_PLAN operation=${c} resource=codex.config action=preserve external_top_level=${preservedTop.length} external_sections=${externalSections.length}`);
  } else if (op === 'preserve') {
    const current = fs.readFileSync(a, 'utf8'); const staged = fs.readFileSync(b, 'utf8');
    fs.writeFileSync(b, preserve(current, staged), { mode: 0o600 });
  } else if (op === 'validate') {
    parseToml(fs.readFileSync(a, 'utf8'));
  } else {
    throw new Error('usage: codex-toml-ownership-helper.mjs <contains-managed|plan|preserve|validate> ...');
  }
} catch (error) {
  console.error(`TOML_OWNERSHIP_BLOCKED ${error.message}`);
  process.exit(2);
}
