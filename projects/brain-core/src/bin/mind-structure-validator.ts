#!/usr/bin/env node

import path from 'node:path';
import { buildMindStructureValidationReport } from '../mind-structure-validator/validator.js';

interface ParsedArgs {
  mindRoot?: string;
  generatedBy?: string;
  help: boolean;
}

const USAGE = [
  'Usage:',
  '  mind-structure-validator --mind-root <path> [--generated-by <name>]',
  '',
  'Description:',
  '  Builds a report-only structural validation report for the Mind repository.',
  '  The validator prints JSON to stdout and performs no writes.',
].join('\n');

function requiredValue(args: readonly string[], index: number, argument: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${argument} requires a value.`);
  }
  return value;
}

function parseArgs(args: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }

    if (argument === '--mind-root') {
      parsed.mindRoot = requiredValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument === '--generated-by') {
      parsed.generatedBy = requiredValue(args, index, argument);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

async function main(): Promise<number> {
  let parsed: ParsedArgs;

  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    return 2;
  }

  if (parsed.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (!parsed.mindRoot) {
    process.stderr.write(`--mind-root is required.\n\n${USAGE}\n`);
    return 2;
  }

  try {
    const report = await buildMindStructureValidationReport({
      mindRoot: path.resolve(process.cwd(), parsed.mindRoot),
      ...(parsed.generatedBy === undefined ? {} : { generatedBy: parsed.generatedBy }),
    });

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === 'fail' ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

main().then((exitCode) => {
  process.exitCode = exitCode;
});
