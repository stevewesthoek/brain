#!/usr/bin/env node

/**
 * Read-only consistency gate for Brain's agent capability onboarding contract.
 *
 * This validates the shared discovery inputs rather than attempting to prove
 * that every external account is authenticated. Runtime state is reported by
 * the relevant client/provider checks and remains a separate claim.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildCapabilityInventory, parseSkillFrontmatter } from './discover-capabilities.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_ROOTS = [
  path.join(ROOT, 'ai/skills/custom'),
  path.join(ROOT, 'ai/skills/vendors'),
];
const PROFILE_ROOT = path.join(ROOT, 'docs/skills/profiles');
const CLI_MANIFEST = path.join(ROOT, 'operations/CLI-MANIFEST.md');
const CLI_HEALTH_REGISTRY = path.join(ROOT, 'operations/specs/cli-access-health.json');
const MCP_ROOT = path.join(ROOT, 'operations/system-configs/mcp');
const MCP_ADMISSIONS = path.join(ROOT, 'operations/specs/mcp-provider-admissions.json');

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function walk(root, predicate, output = []) {
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) walk(current, predicate, output);
    else if (predicate(current, entry.name)) output.push(current);
  }
  return output;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function reportPath(filePath) {
  return path.isAbsolute(filePath) ? relative(filePath) : filePath;
}

function loadSkillSources() {
  return SKILL_ROOTS.flatMap((root) => walk(root, (file, name) => name.toLowerCase() === 'skill.md'))
    .sort()
    .map((file) => {
      const metadata = parseSkillFrontmatter(readText(file));
      return {
        file,
        sourceName: path.basename(path.dirname(file)),
        sourceClass: relative(file).startsWith('ai/skills/vendors/') ? 'vendor' : 'custom',
        name: metadata.name || '',
        description: metadata.description || '',
      };
    });
}

function loadProfiles() {
  if (!fs.existsSync(PROFILE_ROOT)) return [];
  return fs.readdirSync(PROFILE_ROOT)
    .filter((name) => name.endsWith('.txt'))
    .sort()
    .flatMap((file) => readText(path.join(PROFILE_ROOT, file))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((skill) => ({ profile: file.replace(/\.txt$/, ''), skill })));
}

function loadAdmissions() {
  try {
    return JSON.parse(readText(MCP_ADMISSIONS)).admissions ?? [];
  } catch {
    return [];
  }
}

function commandAvailable(name) {
  return Boolean(spawnSync('/usr/bin/which', [name], { encoding: 'utf8' }).stdout?.trim());
}

function validateOnboarding() {
  const failures = [];
  const warnings = [];
  const inventory = buildCapabilityInventory();
  const skills = loadSkillSources();
  const profiles = loadProfiles();
  const admissions = loadAdmissions();

  const fail = (message) => failures.push(message);
  const warn = (message) => warnings.push(message);

  for (const record of inventory.capabilities) {
    if (record.source && !fs.existsSync(path.join(ROOT, record.source))) {
      fail(`discovery record source does not exist: ${record.id} -> ${record.source}`);
    }
    if (record.runbook && !fs.existsSync(path.join(ROOT, record.runbook))) {
      fail(`discovery record runbook does not exist: ${record.id} -> ${record.runbook}`);
    }
  }

  for (const required of [
    'ai/policy/capability-discovery.md',
    'docs/skills/skill-index.md',
    'docs/skills/profiles/default.txt',
    'operations/CLI-MANIFEST.md',
    'operations/specs/cli-access-health.json',
    'operations/specs/mcp-provider-admissions.json',
    'tools/discover-capabilities.mjs',
    'tools/check-cli-access-health.mjs',
  ]) {
    if (!fs.existsSync(path.join(ROOT, required))) fail(`missing canonical discovery input: ${required}`);
  }

  for (const runtimeDoc of [
    'operations/system-configs/claude/CLAUDE.md',
    'operations/system-configs/codex/AGENTS.md',
    'operations/system-configs/gemini/GEMINI.md',
  ]) {
    if (!readText(path.join(ROOT, runtimeDoc)).includes('discover-capabilities.mjs')) {
      fail(`runtime adapter does not reference shared discovery: ${runtimeDoc}`);
    }
  }

  const names = new Map();
  for (const skill of skills) {
    if (!skill.name) fail(`skill is missing frontmatter name: ${relative(skill.file)}`);
    if (!skill.description) fail(`skill is missing frontmatter description: ${relative(skill.file)}`);
    const key = skill.name.toLowerCase();
    const existing = names.get(key) ?? [];
    existing.push(skill);
    names.set(key, existing);
  }

  for (const [name, entries] of names) {
    if (entries.length < 2) continue;
    const classes = new Set(entries.map((entry) => entry.sourceClass));
    if (classes.size === 1) {
      fail(`duplicate skill name has no deterministic source class: ${name}`);
    } else {
      warn(`vendor/custom duplicate is retained with deterministic IDs: ${name}`);
    }
  }

  const resolveSkill = (requested) => skills.find((skill) => (
    skill.name === requested
    || skill.sourceName === requested
    || `${skill.sourceName}.md` === requested
  ));

  for (const { profile, skill } of profiles) {
    if (!resolveSkill(skill)) fail(`profile ${profile} references unresolved skill: ${skill}`);
  }

  const defaultProfile = profiles.filter((entry) => entry.profile === 'default').map((entry) => entry.skill);
  if (!defaultProfile.includes('capability-discovery')) {
    fail('default profile does not include capability-discovery');
  }

  const cliRecords = inventory.capabilities.filter((record) => record.kind === 'cli');
  let cliHealthRegistry = {};
  try {
    cliHealthRegistry = JSON.parse(readText(CLI_HEALTH_REGISTRY));
  } catch {
    fail('CLI access health registry is not valid JSON');
  }
  const cliNames = new Set();
  for (const cli of cliRecords) {
    if (cliNames.has(cli.name)) fail(`duplicate CLI manifest entry: ${cli.name}`);
    cliNames.add(cli.name);
    if (!cli.location) fail(`CLI has no manifest path: ${cli.name}`);
    if (!commandAvailable(cli.name)) warn(`CLI is documented but unavailable on this PATH: ${cli.name}`);
  }
  if (!cliNames.has('stripe')) fail('Stripe CLI is missing from operations/CLI-MANIFEST.md');
  if (!readText(CLI_MANIFEST).includes('BEGIN REGISTERED CLI ENTRIES')) {
    fail('CLI manifest is missing the managed registration block');
  }
  const healthOverrides = new Set(Object.keys(cliHealthRegistry.overrides ?? {}));
  for (const name of cliNames) {
    if (!healthOverrides.has(name) && !cliHealthRegistry.default) {
      fail(`CLI access health has no default or override: ${name}`);
    }
  }
  for (const name of healthOverrides) {
    if (!cliNames.has(name)) fail(`CLI access health override is not registered in the CLI manifest: ${name}`);
  }

  for (const adapter of [
    'projects/brain-core/src/adapters/agent-capabilities.ts',
    'projects/brain-core/src/adapters/agent-cli-capability-manifest.ts',
  ]) {
    const adapterText = readText(path.join(ROOT, adapter));
    for (const source of [...adapterText.matchAll(/source:\s*'([^']+)'/g)].map((match) => match[1])) {
      if (!fs.existsSync(path.join(ROOT, source))) fail(`Brain Core capability source does not exist: ${adapter} -> ${source}`);
    }
  }

  const providerIds = new Set();
  for (const admission of admissions) {
    const providerId = admission.provider?.providerId || admission.admissionId;
    providerIds.add(providerId);
    const docs = path.join(MCP_ROOT, providerId, 'README.md');
    if (!fs.existsSync(docs)) fail(`admitted MCP provider has no provider README: ${providerId}`);
  }

  if (!providerIds.has('mind-context')) fail('Mind Context MCP admission is missing');
  for (const entry of fs.existsSync(MCP_ROOT)
    ? fs.readdirSync(MCP_ROOT, { withFileTypes: true }).filter((item) => item.isDirectory())
    : []) {
    if (!fs.existsSync(path.join(MCP_ROOT, entry.name, 'README.md'))) {
      fail(`MCP documentation directory has no README: ${entry.name}`);
    }
  }

  const stripeMatches = inventory.capabilities.filter((record) => (
    record.aliases?.some((alias) => String(alias).toLowerCase() === 'stripe')
    || record.name.toLowerCase() === 'stripe'
  ));
  for (const expectedKind of ['skill', 'cli']) {
    if (!stripeMatches.some((record) => record.kind === expectedKind)) {
      fail(`Stripe discovery is missing ${expectedKind} route`);
    }
  }
  if (stripeMatches.some((record) => record.kind === 'mcp')) {
    fail('Stripe must remain CLI-only and must not expose an MCP route');
  }
  for (const expectedKind of ['skill', 'cli']) {
    const route = stripeMatches.find((record) => record.kind === expectedKind);
    if (!route?.runbook) fail(`Stripe ${expectedKind} route has no runbook`);
  }

  return {
    failures,
    warnings,
    counts: {
      skills: skills.length,
      profiles: new Set(profiles.map((entry) => entry.profile)).size,
      cli: cliRecords.length,
      mcpAdmissions: admissions.length,
      mcpInventory: inventory.capabilities.filter((record) => record.kind === 'mcp').length,
    },
  };
}

export { validateOnboarding };

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateOnboarding();
  process.stdout.write(`Brain capability onboarding validation\n`);
  process.stdout.write(`inventory skills=${result.counts.skills} profiles=${result.counts.profiles} cli=${result.counts.cli} mcp-admissions=${result.counts.mcpAdmissions} mcp-inventory=${result.counts.mcpInventory}\n`);
  for (const warning of result.warnings) process.stdout.write(`WARN ${warning}\n`);
  for (const failure of result.failures) process.stdout.write(`FAIL ${failure}\n`);
  if (result.failures.length > 0) {
    process.stdout.write(`result=FAIL failures=${result.failures.length} warnings=${result.warnings.length}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`result=PASS failures=0 warnings=${result.warnings.length}\n`);
  }
}
