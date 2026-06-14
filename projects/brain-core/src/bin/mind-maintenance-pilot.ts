#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  loadMaintenanceFindingDecisionDocument,
  writeMaintenanceFindingDecisionDocument,
} from '../mind-maintenance-pilot/finding-decision-file.js';
import {
  recordMaintenanceFindingDecision,
} from '../mind-maintenance-pilot/finding-decision-recorder.js';
import type {
  MaintenanceDecisionValue,
  MaintenanceFindingDecision,
} from '../mind-maintenance-pilot/finding-decision-store.js';
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
  loadDecisionDocument?: typeof loadMaintenanceFindingDecisionDocument;
  writeDecisionDocument?: typeof writeMaintenanceFindingDecisionDocument;
  recordDecision?: typeof recordMaintenanceFindingDecision;
}

export interface MindMaintenanceRecordDecisionCliResult {
  ok: true;
  status: 'recorded';
  operation: 'created' | 'replaced';
  replacedFindingId: string | null;
  findingId: string;
  deduplicationKey: string;
  decision: MaintenanceDecisionValue;
  decisionPath: string;
  decisionCount: number;
}

export interface MindMaintenancePilotCliResult {
  exitCode: 0 | 1 | 2;
  result?: MindMaintenancePilotRunnerResult | MindMaintenanceRecordDecisionCliResult;
}

type CliCommand = 'run' | 'record-decision';

interface ParsedArguments {
  command: CliCommand;
  enabled: boolean;
  mindRoot?: string;
  sourceCommit?: string;
  generatedAt?: string;
  generatedBy?: string;
  findingId?: string;
  deduplicationKey?: string;
  sourceReportId?: string;
  reviewer?: string;
  reviewedAt?: string;
  decision?: MaintenanceDecisionValue;
  reason?: string;
  nextAction?: string;
  resolutionRef?: string;
  suppressionUntil?: string;
  help: boolean;
}

const USAGE = [
  'Usage:',
  '  mind-maintenance-pilot run --enable-report-only --mind-root <path> [options]',
  '  mind-maintenance-pilot record-decision --mind-root <path> --finding-id <id> --deduplication-key <key> --source-report <id> --source-commit <hash> --reviewer <name> --reviewed-at <iso> --decision <accepted|dismissed|resolved> --reason <text> [decision options]',
  '',
  'Run options:',
  '  --source-commit <hash>  Override the Mind HEAD commit.',
  '  --generated-at <iso>    Override the generated timestamp.',
  '  --generated-by <name>   Override the report generator identity.',
  '',
  'Decision options:',
  '  --next-action <text>       Required for accepted decisions.',
  '  --resolution-ref <ref>     Required for resolved decisions.',
  '  --suppression-until <date> Optional for dismissed decisions only.',
  '  --help                     Show this usage text.',
].join('\n');

function requiredValue(args: readonly string[], index: number, argument: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${argument} requires a value.`);
  }
  return value;
}

function parseDecision(value: string): MaintenanceDecisionValue {
  if (value === 'accepted' || value === 'dismissed' || value === 'resolved') return value;
  throw new Error('--decision must be accepted, dismissed, or resolved.');
}

function parseArguments(args: readonly string[]): ParsedArguments {
  if (args.includes('--help')) {
    return { command: 'run', enabled: false, help: true };
  }

  const command = args[0];
  if (command !== 'run' && command !== 'record-decision') {
    throw new Error('The supported commands are "run" and "record-decision".');
  }

  const parsed: ParsedArguments = {
    command,
    enabled: false,
    help: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--enable-report-only') {
      if (command !== 'run') throw new Error('--enable-report-only is only valid for run.');
      parsed.enabled = true;
      continue;
    }

    const valueOptions = new Set([
      '--mind-root',
      '--source-commit',
      '--generated-at',
      '--generated-by',
      '--finding-id',
      '--deduplication-key',
      '--source-report',
      '--reviewer',
      '--reviewed-at',
      '--decision',
      '--reason',
      '--next-action',
      '--resolution-ref',
      '--suppression-until',
    ]);

    if (!argument || !valueOptions.has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = requiredValue(args, index, argument);
    index += 1;

    if (argument === '--mind-root') parsed.mindRoot = value;
    if (argument === '--source-commit') parsed.sourceCommit = value;
    if (argument === '--generated-at') parsed.generatedAt = value;
    if (argument === '--generated-by') parsed.generatedBy = value;
    if (argument === '--finding-id') parsed.findingId = value;
    if (argument === '--deduplication-key') parsed.deduplicationKey = value;
    if (argument === '--source-report') parsed.sourceReportId = value;
    if (argument === '--reviewer') parsed.reviewer = value;
    if (argument === '--reviewed-at') parsed.reviewedAt = value;
    if (argument === '--decision') parsed.decision = parseDecision(value);
    if (argument === '--reason') parsed.reason = value;
    if (argument === '--next-action') parsed.nextAction = value;
    if (argument === '--resolution-ref') parsed.resolutionRef = value;
    if (argument === '--suppression-until') parsed.suppressionUntil = value;
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
  loadDecisionDocument: loadMaintenanceFindingDecisionDocument,
  writeDecisionDocument: writeMaintenanceFindingDecisionDocument,
  recordDecision: recordMaintenanceFindingDecision,
};

function requireDecisionArguments(parsed: ParsedArguments): asserts parsed is ParsedArguments & {
  mindRoot: string;
  findingId: string;
  deduplicationKey: string;
  sourceReportId: string;
  sourceCommit: string;
  reviewer: string;
  reviewedAt: string;
  decision: MaintenanceDecisionValue;
  reason: string;
} {
  const required: Array<[keyof ParsedArguments, string]> = [
    ['mindRoot', '--mind-root'],
    ['findingId', '--finding-id'],
    ['deduplicationKey', '--deduplication-key'],
    ['sourceReportId', '--source-report'],
    ['sourceCommit', '--source-commit'],
    ['reviewer', '--reviewer'],
    ['reviewedAt', '--reviewed-at'],
    ['decision', '--decision'],
    ['reason', '--reason'],
  ];

  for (const [field, option] of required) {
    const value = parsed[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${option} is required for record-decision.`);
    }
  }

  if (parsed.decision === 'accepted' && !parsed.nextAction?.trim()) {
    throw new Error('--next-action is required for accepted decisions.');
  }
  if (parsed.decision === 'resolved' && !parsed.resolutionRef?.trim()) {
    throw new Error('--resolution-ref is required for resolved decisions.');
  }
  if (parsed.decision !== 'dismissed' && parsed.suppressionUntil !== undefined) {
    throw new Error('--suppression-until is only valid for dismissed decisions.');
  }
  if (parsed.decision === 'dismissed' && parsed.resolutionRef !== undefined) {
    throw new Error('--resolution-ref is not valid for dismissed decisions.');
  }
}

async function runRecordDecision(
  parsed: ParsedArguments,
  dependencies: MindMaintenancePilotCliDependencies,
): Promise<MindMaintenanceRecordDecisionCliResult> {
  requireDecisionArguments(parsed);
  const mindRoot = dependencies.resolveMindRoot(parsed.mindRoot);
  const updatedAt = dependencies.now().toISOString();
  const loadDecisionDocument = dependencies.loadDecisionDocument
    ?? loadMaintenanceFindingDecisionDocument;
  const writeDecisionDocument = dependencies.writeDecisionDocument
    ?? writeMaintenanceFindingDecisionDocument;
  const recordDecision = dependencies.recordDecision ?? recordMaintenanceFindingDecision;

  const document = await loadDecisionDocument(mindRoot, { whenMissingUpdatedAt: updatedAt });
  const decision: MaintenanceFindingDecision = {
    findingId: parsed.findingId.trim(),
    deduplicationKey: parsed.deduplicationKey.trim(),
    sourceReportId: parsed.sourceReportId.trim(),
    sourceCommit: parsed.sourceCommit.trim(),
    reviewedBy: parsed.reviewer.trim(),
    reviewedAt: parsed.reviewedAt,
    decision: parsed.decision,
    reason: parsed.reason.trim(),
    nextAction: parsed.nextAction?.trim() ?? '',
    resolutionRef: parsed.resolutionRef?.trim() || null,
    suppressionUntil: parsed.suppressionUntil?.trim() || null,
  };
  const recorded = recordDecision({ document, decision, updatedAt });
  const written = await writeDecisionDocument(mindRoot, recorded.document);

  return {
    ok: true,
    status: 'recorded',
    operation: recorded.operation,
    replacedFindingId: recorded.replacedFindingId,
    findingId: decision.findingId,
    deduplicationKey: decision.deduplicationKey,
    decision: decision.decision,
    decisionPath: written.path,
    decisionCount: written.decisionCount,
  };
}

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

  if (parsed.command === 'record-decision') {
    try {
      const result = await runRecordDecision(parsed, dependencies);
      io.stdout(`${JSON.stringify(result, null, 2)}\n`);
      return { exitCode: 0, result };
    } catch (error) {
      io.stderr(`${JSON.stringify({
        ok: false,
        status: 'decision-record-failed',
        error: error instanceof Error ? error.message : String(error),
        nextAction: 'Fix the decision arguments or decision file before retrying.',
      }, null, 2)}\n`);
      return { exitCode: 1 };
    }
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
