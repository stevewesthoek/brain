#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  runMindMaintenancePilot,
  type MindMaintenancePilotRunnerResult,
} from '../mind-maintenance-pilot/pilot-runner.js';

const execFile = promisify(execFileCallback);

export interface MindMaintenancePilotCliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

export interface MindMaintenancePilotCliDependencies {
  now: () => Date;
  resolveMindRoot: (value: string) => string;
  resolveSourceCommit: (mindRoot: string) => Promise<string>;
  listChangedPaths: (mindRoot: string) => Promise<readonly string[]>;
  runPilot: typeof runMindMaintenancePilot;
}

export interface MindMaintenancePilotCliResult {
  exitCode: 0 | 1 | 2;
  result?: MindMaintenancePilotRunnerResult;
}

interface ParsedArguments {
  enabled: boolean;
  mindRoot?: string;
  sourceCommit?: string;
  generatedAt?: string;
  generatedBy?: string;
  help: boolean;
}

const USAGE = [
  'Usage:',
  '  mind-maintenance-pilot run --enable-report-only --mind-root <path> [options]',
  '',
  'Options:',
  '  --source-commit <hash>  Override the Mind HEAD commit.',
  '  --generated-at <iso>    Override the generated timestamp.',
  '  --generated-by <name>   Override the report generator identity.',
  '  --help                  Show this usage text.',
].join('\n');

function parseArguments(args: readonly string[]): ParsedArguments {
  if (args.includes('--help')) {
    return { enabled: false, help: true };
  }

  if (args[0] !== 'run') {
    throw new Error('The only supported command is "run".');
  }

  const parsed: ParsedArguments = {
    enabled: false,
    help: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--enable-report-only') {
      parsed.enabled = true;
      continue;
    }

    if (
      argument === '--mind-root'
      || argument === '--source-commit'
      || argument === '--generated-at'
      || argument === '--generated-by'
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;

      if (argument === '--mind-root') parsed.mindRoot = value;
      if (argument === '--source-commit') parsed.sourceCommit = value;
      if (argument === '--generated-at') parsed.generatedAt = value;
      if (argument === '--generated-by') parsed.generatedBy = value;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

function normalizeGitStatusPath(value: string): string {
  return value.trim().replaceAll('\\', '/');
}

async function defaultResolveSourceCommit(mindRoot: string): Promise<string> {
  const { stdout } = await execFile('git', ['-C', mindRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    timeout: 3000,
  });
  const commit = stdout.trim();
  if (!commit) throw new Error('Mind HEAD did not return a source commit.');
  return commit;
}

async function defaultListChangedPaths(mindRoot: string): Promise<readonly string[]> {
  const { stdout } = await execFile(
    'git',
    ['-C', mindRoot, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { encoding: 'utf8', timeout: 3000 },
  );

  const entries = stdout.split('\0').filter((entry) => entry.length > 0);
  const paths: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? '';
    const status = entry.slice(0, 2);
    const primaryPath = normalizeGitStatusPath(entry.slice(3));

    if (status.includes('R') || status.includes('C')) {
      const destinationPath = entries[index + 1];
      if (destinationPath) {
        paths.push(normalizeGitStatusPath(destinationPath));
        index += 1;
        continue;
      }
    }

    if (primaryPath) paths.push(primaryPath);
  }

  return paths;
}

const defaultDependencies: MindMaintenancePilotCliDependencies = {
  now: () => new Date(),
  resolveMindRoot: (value) => path.resolve(value),
  resolveSourceCommit: defaultResolveSourceCommit,
  listChangedPaths: defaultListChangedPaths,
  runPilot: runMindMaintenancePilot,
};

export async function runMindMaintenancePilotCli(
  args: readonly string[],
  io: MindMaintenancePilotCliIo,
  dependencies: MindMaintenancePilotCliDependencies = defaultDependencies,
): Promise<MindMaintenancePilotCliResult> {
  let parsed: ParsedArguments;

  try {
    parsed = parseArguments(args);
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    return { exitCode: 2 };
  }

  if (parsed.help) {
    io.stdout(`${USAGE}\n`);
    return { exitCode: 0 };
  }

  if (!parsed.enabled) {
    io.stderr(`The pilot is disabled unless --enable-report-only is provided.\n\n${USAGE}\n`);
    return { exitCode: 2 };
  }

  if (!parsed.mindRoot) {
    io.stderr(`--mind-root is required.\n\n${USAGE}\n`);
    return { exitCode: 2 };
  }

  try {
    const mindRoot = dependencies.resolveMindRoot(parsed.mindRoot);
    const sourceCommit = parsed.sourceCommit?.trim()
      || await dependencies.resolveSourceCommit(mindRoot);
    const generatedAt = parsed.generatedAt ?? dependencies.now().toISOString();

    const result = await dependencies.runPilot({
      enabled: true,
      mindRoot,
      sourceCommit,
      generatedAt,
      ...(parsed.generatedBy === undefined ? {} : { generatedBy: parsed.generatedBy }),
      listChangedPaths: () => dependencies.listChangedPaths(mindRoot),
    });

    const output = `${JSON.stringify(result, null, 2)}\n`;
    if (result.ok) {
      io.stdout(output);
      return { exitCode: 0, result };
    }

    io.stderr(output);
    return { exitCode: 1, result };
  } catch (error) {
    io.stderr(
      `${JSON.stringify({
        ok: false,
        status: 'failed',
        mode: 'report-only',
        error: error instanceof Error ? error.message : String(error),
        nextAction: 'Fix the reported CLI or repository error before retrying.',
      }, null, 2)}\n`,
    );
    return { exitCode: 1 };
  }
}

async function main(): Promise<void> {
  const result = await runMindMaintenancePilotCli(process.argv.slice(2), {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  });
  process.exitCode = result.exitCode;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  void main();
}
