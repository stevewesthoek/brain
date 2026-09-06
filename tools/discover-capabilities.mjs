#!/usr/bin/env node

/**
 * Brain capability discovery.
 *
 * This is intentionally read-only and dependency-free. It builds a compact
 * view from the canonical skill sources, profiles, CLI manifest, MCP
 * admission registry, and client configuration names. The view is assembled
 * at query time so it reflects the current repository and local PATH without
 * loading every skill into an agent prompt.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_ROOTS = [
  path.join(ROOT, 'ai/skills/custom'),
  path.join(ROOT, 'ai/skills/vendors'),
];
const PROFILE_ROOT = path.join(ROOT, 'docs/skills/profiles');
const RUNBOOK_ROOT = path.join(ROOT, 'operations/runbooks');
const CLI_MANIFEST = path.join(ROOT, 'operations/CLI-MANIFEST.md');
const MCP_ADMISSIONS = path.join(ROOT, 'operations/specs/mcp-provider-admissions.json');
const MCP_ROOT = path.join(ROOT, 'operations/system-configs/mcp');
const CODEX_CONFIG = path.join(ROOT, 'operations/system-configs/codex/config.toml');
const CLAUDE_TEMPLATE = path.join(ROOT, 'operations/system-configs/claude/claude.json.template');

const VALID_KINDS = new Set(['skill', 'cli', 'mcp']);
let runbookIndex;

function walk(root, predicate, results = []) {
  if (!fs.existsSync(root)) return results;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walk(current, predicate, results);
    } else if (predicate(current, entry.name)) {
      results.push(current);
    }
  }

  return results;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function stripYamlValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return {};

  const lines = (match[1] ?? '').split(/\r?\n/);
  const metadata = {};
  let collectingDescription = false;
  const descriptionLines = [];

  for (const line of lines) {
    if (collectingDescription) {
      if (/^\s+/.test(line) && line.trim()) {
        descriptionLines.push(line.trim());
        continue;
      }
      collectingDescription = false;
    }

    const nameMatch = line.match(/^name:\s*(.+?)\s*$/);
    if (nameMatch) {
      metadata.name = stripYamlValue(nameMatch[1]);
      continue;
    }

    const descriptionMatch = line.match(/^description:\s*(.*?)\s*$/);
    if (descriptionMatch) {
      const value = descriptionMatch[1];
      if (value === '>' || value === '>-' || value === '|' || value === '|-') {
        collectingDescription = true;
      } else if (value) {
        metadata.description = stripYamlValue(value);
      }
    }
  }

  if (descriptionLines.length > 0) {
    metadata.description = descriptionLines.join(' ');
  }

  return metadata;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function readProfiles() {
  const profiles = new Map();
  if (!fs.existsSync(PROFILE_ROOT)) return profiles;

  for (const file of fs.readdirSync(PROFILE_ROOT).filter((name) => name.endsWith('.txt')).sort()) {
    const entries = readText(path.join(PROFILE_ROOT, file))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    profiles.set(file.replace(/\.txt$/, ''), entries);
  }
  return profiles;
}

function activeSkillNames() {
  const active = path.join(ROOT, 'ai/skills/active');
  if (!fs.existsSync(active)) return new Set();
  return new Set(fs.readdirSync(active));
}

function getRunbookIndex() {
  if (runbookIndex) return runbookIndex;
  runbookIndex = new Map();
  if (!fs.existsSync(RUNBOOK_ROOT)) return runbookIndex;
  for (const file of fs.readdirSync(RUNBOOK_ROOT).filter((name) => name.endsWith('.md'))) {
    runbookIndex.set(slug(file.replace(/\.md$/, '')), relative(path.join(RUNBOOK_ROOT, file)));
  }
  return runbookIndex;
}

function findRunbook(...values) {
  const index = getRunbookIndex();
  for (const value of values.flat().filter(Boolean)) {
    const normalized = slug(String(value).replace(/\.md$/, ''));
    for (const candidate of [normalized, normalized.replace(/-cli$/, ''), `${normalized}-cli`]) {
      if (index.has(candidate)) return index.get(candidate);
    }
  }
  return null;
}

function buildSkillCapabilities() {
  const profiles = readProfiles();
  const active = activeSkillNames();
  const files = SKILL_ROOTS.flatMap((root) => walk(root, (file, name) => name.toLowerCase() === 'skill.md'));
  const records = [];

  for (const file of files.sort()) {
    const metadata = parseSkillFrontmatter(readText(file));
    const sourceName = path.basename(path.dirname(file));
    const name = metadata.name || sourceName;
    const source = relative(file);
    const isVendor = source.startsWith('ai/skills/vendors/');
    const profileNames = [];

    for (const [profile, entries] of profiles) {
      if (entries.some((entry) => entry === name || entry === sourceName || entry === `${sourceName}.md`)) {
        profileNames.push(profile);
      }
    }

    const aliases = [...new Set([
      name,
      sourceName,
      ...profileNames,
    ])];
    const baseId = `skill.${slug(name)}`;
    const id = records.some((record) => record.id === baseId)
      ? `${baseId}.${isVendor ? 'vendor' : 'custom'}`
      : baseId;

    const record = {
      id,
      kind: 'skill',
      name,
      aliases,
      description: metadata.description || `Brain skill source ${sourceName}.`,
      source,
      runbook: findRunbook(name, sourceName),
      profiles: profileNames.sort(),
      activeByDefault: active.has(sourceName) || active.has(name),
      sourceClass: isVendor ? 'vendor' : 'custom',
    };

    records.push(record);
  }

  return records.sort((left, right) => left.id.localeCompare(right.id));
}

function parseCliRows() {
  const rows = [];
  let section = 'unclassified';
  for (const line of readText(CLI_MANIFEST).split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) section = heading[1];

    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const nameMatch = cells[0].match(/`([^`]+)`/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    if (name === 'CLI') continue;
    const location = cells[1];
    const description = cells.at(-1) || `${name} command`;
    rows.push({
      id: `cli.${slug(name)}`,
      kind: 'cli',
      name,
      aliases: [name, name.replace(/-cli$/, '')],
      description: description.replace(/\*\*/g, ''),
      source: relative(CLI_MANIFEST),
      runbook: findRunbook(name),
      section,
      location,
      available: Boolean(spawnSync('/usr/bin/which', [name], { encoding: 'utf8' }).stdout.trim()),
    });
  }
  return rows;
}

function parseJsonObjectKeys(filePath, objectKey) {
  try {
    const value = JSON.parse(readText(filePath));
    return Object.keys(value?.[objectKey] ?? {});
  } catch {
    return [];
  }
}

function buildMcpCapabilities() {
  const records = new Map();
  let admissions = {};
  try {
    admissions = JSON.parse(readText(MCP_ADMISSIONS));
  } catch {
    admissions = {};
  }

  for (const admission of admissions.admissions ?? []) {
    const providerId = admission.provider?.providerId || admission.admissionId;
    const docsPath = path.join(MCP_ROOT, providerId);
    records.set(`mcp.${slug(providerId)}`, {
      id: `mcp.${slug(providerId)}`,
      kind: 'mcp',
      name: providerId,
      aliases: [providerId, admission.transport?.serverName, admission.admissionId].filter(Boolean),
      description: `Brain-admitted MCP provider ${providerId}.`,
      source: relative(MCP_ADMISSIONS),
      docs: fs.existsSync(docsPath) ? relative(path.join(docsPath, 'README.md')) : null,
      runbook: relative(path.join(RUNBOOK_ROOT, 'mcp-centralization.md')),
      runtime: 'admission',
      status: admission.status,
    });
  }

  if (fs.existsSync(MCP_ROOT)) {
    for (const entry of fs.readdirSync(MCP_ROOT, { withFileTypes: true }).filter((item) => item.isDirectory())) {
      const id = `mcp.${slug(entry.name)}`;
      if (records.has(id)) continue;
      records.set(id, {
        id,
        kind: 'mcp',
        name: entry.name,
        aliases: [entry.name],
        description: `Documented MCP provider ${entry.name}.`,
        source: relative(path.join(MCP_ROOT, entry.name, 'README.md')),
        docs: relative(path.join(MCP_ROOT, entry.name, 'README.md')),
        runbook: relative(path.join(RUNBOOK_ROOT, 'mcp-centralization.md')),
        runtime: 'documentation',
        status: 'documented',
      });
    }
  }

  const codexConfig = readText(CODEX_CONFIG);
  for (const match of codexConfig.matchAll(/^\[mcp_servers\.([^\.\]]+)\]/gm)) {
    const name = match[1];
    const id = `mcp.codex.${slug(name)}`;
    records.set(id, {
      id,
      kind: 'mcp',
      name,
      aliases: [name, 'codex', 'mcp'],
      description: `Codex MCP server ${name} configured in the Brain-managed client configuration.`,
      source: relative(CODEX_CONFIG),
      runbook: relative(path.join(RUNBOOK_ROOT, 'mcp-centralization.md')),
      runtime: 'codex',
      status: 'configured',
    });
  }

  for (const plugin of [...codexConfig.matchAll(/^\[plugins\."([^"]+)"\]/gm)].map((match) => match[1])) {
    const name = plugin.split('@')[0];
    const id = `mcp.codex-plugin.${slug(name)}`;
    records.set(id, {
      id,
      kind: 'mcp',
      name,
      aliases: [name, plugin, 'codex', 'plugin', 'mcp'],
      description: `Codex-managed ${name} integration; client plugin configuration is outside Brain provider admission.`,
      source: relative(CODEX_CONFIG),
      runbook: relative(path.join(RUNBOOK_ROOT, 'mcp-centralization.md')),
      runtime: 'codex-plugin',
      status: 'configured',
    });
  }

  for (const name of parseJsonObjectKeys(CLAUDE_TEMPLATE, 'mcpServers')) {
    const id = `mcp.claude.${slug(name)}`;
    records.set(id, {
      id,
      kind: 'mcp',
      name,
      aliases: [name, 'claude', 'mcp'],
      description: `Claude Code MCP server ${name} documented in the Brain-managed client template.`,
      source: relative(CLAUDE_TEMPLATE),
      runbook: relative(path.join(RUNBOOK_ROOT, 'mcp-centralization.md')),
      runtime: 'claude',
      status: 'documented',
    });
  }

  return [...records.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function buildCapabilityInventory() {
  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      discoveryPolicy: relative(path.join(ROOT, 'ai/policy/capability-discovery.md')),
      skillIndex: relative(path.join(ROOT, 'docs/skills/skill-index.md')),
      cliManifest: relative(CLI_MANIFEST),
      mcpAdmissions: relative(MCP_ADMISSIONS),
    },
    capabilities: [
      ...buildSkillCapabilities(),
      ...parseCliRows(),
      ...buildMcpCapabilities(),
    ],
  };
}

function queryTokens(query) {
  return String(query ?? '').toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [];
}

export function rankCapabilities(capabilities, query, kind) {
  const tokens = queryTokens(query);
  const filtered = kind && VALID_KINDS.has(kind) ? capabilities.filter((item) => item.kind === kind) : capabilities;
  if (tokens.length === 0) return filtered;

  return filtered
    .map((item) => {
      const aliases = item.aliases.map((alias) => String(alias).toLowerCase());
      const haystack = [item.name, item.description, item.source, ...(item.profiles ?? []), ...aliases]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (aliases.some((alias) => alias === token)) score += 100;
        else if (aliases.some((alias) => alias.includes(token))) score += 40;
        else if (haystack.includes(token)) score += 10;
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .map((entry) => entry.item);
}

function parseArgs(argv) {
  const args = { query: '', kind: '', format: 'compact', limit: 8 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--query') args.query = argv[++index] ?? '';
    else if (arg === '--kind') args.kind = argv[++index] ?? '';
    else if (arg === '--format') args.format = argv[++index] ?? 'compact';
    else if (arg === '--limit') args.limit = Number(argv[++index] ?? 8);
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  process.stdout.write(`Usage: node tools/discover-capabilities.mjs [options]\n\nOptions:\n  --query <text>       Natural-language request to route\n  --kind <skill|cli|mcp>  Limit capability kind\n  --format <compact|json> Output format (default: compact)\n  --limit <n>          Maximum compact results (default: 8)\n`);
}

function compactRecord(record) {
  const availability = record.kind === 'cli'
    ? `available=${record.available ? 'yes' : 'no'}${record.location ? ` path=${record.location}` : ''}`
    : record.status
      ? `status=${record.status}`
      : record.activeByDefault
        ? 'active=default'
        : `profiles=${(record.profiles ?? []).join(',') || 'dormant/source'}`;
  const route = record.kind === 'skill'
    ? `read ${record.source}`
    : record.kind === 'cli'
      ? `run ${record.name} through the shared PATH`
      : `use the ${record.runtime ?? 'documented'} MCP surface`;
  const runbook = record.runbook ? `\n  runbook=${record.runbook}` : '';
  return `${record.id} [${record.kind}] ${availability}\n  ${record.description}\n  source=${record.source}${runbook}\n  route=${route}`;
}

export function discover(query = '', options = {}) {
  const inventory = buildCapabilityInventory();
  return rankCapabilities(inventory.capabilities, query, options.kind).slice(0, options.limit ?? 8);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const inventory = buildCapabilityInventory();
  const matches = rankCapabilities(inventory.capabilities, args.query, args.kind);
  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify({ ...inventory, matches: matches.slice(0, args.limit) }, null, 2)}\n`);
  } else {
    process.stdout.write(`Brain capability discovery${args.query ? ` for: ${args.query}` : ''}\n`);
    const selected = matches.slice(0, args.limit);
    if (selected.length === 0) {
      process.stdout.write('No matching registered capability. Check the source registries before proposing installation.\n');
    } else {
      process.stdout.write(`${selected.map(compactRecord).join('\n')}\n`);
    }
    process.stdout.write(`inventory=${inventory.capabilities.length} matches=${matches.length}\n`);
  }
}
