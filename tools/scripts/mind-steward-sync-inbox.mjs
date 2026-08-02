#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EXECUTION_MODES = new Set(['dry-run', 'apply']);

export function resolveMindInboxSyncMode({ mode, dryRun } = {}) {
  if (mode === undefined) {
    if (dryRun !== undefined && typeof dryRun !== 'boolean') {
      throw new Error('dryRun must be a boolean when supplied');
    }
    return 'dry-run';
  }
  if (!EXECUTION_MODES.has(mode)) {
    throw new Error("mode must be exactly 'dry-run' or 'apply'");
  }
  if (dryRun !== undefined && typeof dryRun !== 'boolean') {
    throw new Error('dryRun must be a boolean when supplied');
  }
  if (dryRun !== undefined && dryRun !== (mode === 'dry-run')) {
    throw new Error('mode and dryRun conflict; refusing to sync');
  }
  return mode;
}

export function syncMindInbox({ sourceRoot, mindRoot, mode, dryRun }) {
  const executionMode = resolveMindInboxSyncMode({ mode, dryRun });
  const isDryRun = executionMode === 'dry-run';
  const sourceDir = path.resolve(sourceRoot, 'inbox/new');
  const targetDir = path.resolve(mindRoot, 'inbox/new');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`source inbox does not exist: ${sourceDir}`);
  }

  const sourceFiles = fs.readdirSync(sourceDir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();

  const copied = [];
  const skipped = [];

  if (!isDryRun) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const name of sourceFiles) {
    const source = path.join(sourceDir, name);
    const target = path.join(targetDir, name);
    if (fs.existsSync(target)) {
      skipped.push(path.relative(mindRoot, target));
      continue;
    }

    if (!isDryRun) {
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    }
    copied.push(path.relative(mindRoot, target));
  }

  return {
    sourceDir,
    targetDir,
    mode: executionMode,
    dryRun: isDryRun,
    copied,
    skipped,
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (key === 'dry-run') {
      const value = inlineValue ?? (() => {
        const next = argv[index + 1];
        if (next && !next.startsWith('--')) {
          index += 1;
          return next;
        }
        return 'true';
      })();
      if (value !== 'true' && value !== 'false') {
        throw new Error("--dry-run must be 'true' or 'false' when supplied");
      }
      values.dryRun = value === 'true';
      continue;
    }
    if (inlineValue !== undefined) {
      values[key] = inlineValue;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for --${key}`);
    }
    values[key] = value;
    index += 1;
  }
  return values;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceRoot = args['source-root'] ?? process.env.MIND_STEWARD_SYNC_SOURCE_ROOT;
  const mindRoot = args['mind-root'] ?? process.env.MIND_STEWARD_MIND_ROOT;

  if (!sourceRoot) {
    throw new Error('source root is required via --source-root or MIND_STEWARD_SYNC_SOURCE_ROOT');
  }
  if (!mindRoot) {
    throw new Error('Mind root is required via --mind-root or MIND_STEWARD_MIND_ROOT');
  }

  const result = syncMindInbox({
    sourceRoot,
    mindRoot,
    mode: args.mode,
    dryRun: args.dryRun,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
