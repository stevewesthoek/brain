#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { loadJson } from './context-learning/context-learning-core.mjs';
import { applyCodexProfileAdmission, buildCodexProfileAdmissionPlan } from './infrastructure-identity-access/codex-profile-admission.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCHEMA = path.join(ROOT, 'operations/specs/infrastructure-identity-access-v1.schema.json');
const CANONICAL = path.join(ROOT, 'operations/infrastructure/catalog/identity-access.v1.json');

function usage() {
  return [
    'Usage: npm run codex:admit-profiles -- [options]',
    '',
    '  --candidate-catalog PATH  successful candidate catalog used by the pilot',
    '  --acceptance PATH         successful codex-cli-pilot finalize report',
    '  --catalog PATH            canonical catalog (default: identity-access.v1.json)',
    '  --backup-dir PATH         owner-only backup directory',
    '  --output PATH             write a redacted plan/result report',
    '  --execute --confirm       atomically publish the admitted metadata',
    '',
    'Default mode is a read-only plan. This operation never reads or copies OAuth, Keychain, browser, or auth-file contents.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  const options = { catalog: CANONICAL, candidateCatalog: null, acceptance: null, backupDir: undefined, output: undefined, execute: false, confirm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--confirm') options.confirm = true;
    else if (['--catalog', '--candidate-catalog', '--acceptance', '--backup-dir', '--output'].includes(arg)) {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[{ '--catalog': 'catalog', '--candidate-catalog': 'candidateCatalog', '--acceptance': 'acceptance', '--backup-dir': 'backupDir', '--output': 'output' }[arg]] = value;
    } else throw new Error(`unknown option: ${arg}\n${usage()}`);
  }
  if (!options.candidateCatalog || !options.acceptance) throw new Error('--candidate-catalog and --acceptance are required');
  if (options.execute && !options.confirm) throw new Error('--execute requires --confirm');
  return options;
}

function publicResult(plan, applied = null) {
  const { mergedCatalog: _mergedCatalog, ...safePlan } = plan;
  return { ...safePlan, applied };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const schema = loadJson(SCHEMA);
    const canonicalCatalog = loadJson(path.resolve(options.catalog));
    const candidateCatalog = loadJson(path.resolve(options.candidateCatalog));
    const acceptanceReport = loadJson(path.resolve(options.acceptance));
    const plan = buildCodexProfileAdmissionPlan({
      canonicalCatalog,
      candidateCatalog,
      acceptanceReport,
      acceptanceReportPath: options.acceptance,
      schema,
    });
    let applied = null;
    if (options.execute && plan.status === 'READY') {
      applied = applyCodexProfileAdmission({ plan, targetPath: path.resolve(options.catalog), backupDir: options.backupDir, now: new Date() });
    }
    const result = publicResult(plan, applied);
    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(path.resolve(options.output), 0o600);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== 'READY' && result.status !== 'OK') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
