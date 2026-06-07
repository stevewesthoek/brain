#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const brainRoot = resolve(new URL('../..', import.meta.url).pathname);
const examplesPath = resolve(brainRoot, 'operations/specs/graphify-profile.examples.json');
const defaultReportJson = resolve(brainRoot, 'runtime/local/graphify/orchestrator-latest.json');
const defaultReportMarkdown = resolve(brainRoot, 'runtime/local/graphify/orchestrator-latest.md');

function parseArgs(argv) {
  const args = {
    repo: null,
    profile: null,
    reportJson: defaultReportJson,
    reportMarkdown: defaultReportMarkdown,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      args.repo = argv[++index] ?? null;
    } else if (arg === '--profile') {
      args.profile = argv[++index] ?? null;
    } else if (arg === '--report-json') {
      args.reportJson = resolve(brainRoot, argv[++index] ?? '');
    } else if (arg === '--report-md') {
      args.reportMarkdown = resolve(brainRoot, argv[++index] ?? '');
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function helpText() {
  return `Usage: node tools/graphify/run-graphify-orchestrator.mjs --repo <path> [--profile <name>]\n\nReport-only Graphify orchestrator preflight.\n\nOptions:\n  --repo <path>         Target repository path to inspect. Required.\n  --profile <name>      Named example profile fallback when .graphify-profile.json is absent.\n  --report-json <path>  Brain-relative report JSON output.\n  --report-md <path>    Brain-relative report Markdown output.\n`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function validateProfile(profile) {
  const errors = [];
  const required = [
    'graphifyStandardVersion',
    'profile',
    'repoRole',
    'modes',
    'outputs',
    'initialBuildPolicy',
    'criticalRebuildPolicy',
    'incrementalPolicy',
    'exclude',
  ];

  for (const key of required) {
    if (!(key in profile)) errors.push(`missing required field: ${key}`);
  }

  if (profile.graphifyStandardVersion !== '1') errors.push('graphifyStandardVersion must be "1"');
  if (!['mind-knowledge', 'brain-runtime', 'code-app', 'research', 'mixed'].includes(profile.profile)) {
    errors.push(`unsupported profile: ${profile.profile}`);
  }

  for (const key of ['modes', 'outputs', 'exclude']) {
    if (!Array.isArray(profile[key])) errors.push(`${key} must be an array`);
  }

  for (const key of ['initialBuildPolicy', 'criticalRebuildPolicy', 'incrementalPolicy']) {
    if (!profile[key] || typeof profile[key] !== 'object' || Array.isArray(profile[key])) {
      errors.push(`${key} must be an object`);
    }
  }

  const tracked = profile.trackGeneratedArtifacts ?? [];
  if (!Array.isArray(tracked)) {
    errors.push('trackGeneratedArtifacts must be an array when provided');
  } else {
    for (const artifact of tracked) {
      if (typeof artifact !== 'string' || !artifact.startsWith('graphify-out/')) {
        errors.push(`tracked artifact must live under graphify-out/: ${artifact}`);
      }
    }
  }

  return errors;
}

async function loadProfile(repoRoot, profileName) {
  const profilePath = resolve(repoRoot, '.graphify-profile.json');
  if (existsSync(profilePath)) {
    return {
      source: 'repo-local',
      path: profilePath,
      profile: await readJson(profilePath),
    };
  }

  if (!profileName) {
    throw new Error('No .graphify-profile.json found and --profile was not provided.');
  }

  const examples = await readJson(examplesPath);
  const profile = examples.examples?.[profileName];
  if (!profile) throw new Error(`Unknown example profile: ${profileName}`);

  return {
    source: 'brain-example',
    path: examplesPath,
    profile,
  };
}

function expectedOutputs(repoRoot, profile) {
  const outputs = [];
  if (profile.outputs?.includes('report')) outputs.push('graphify-out/GRAPH_REPORT.md');
  if (profile.outputs?.includes('json')) outputs.push('graphify-out/graph.json');
  if (profile.outputs?.includes('html')) outputs.push('graphify-out/graph.html');
  for (const optional of profile.optionalOutputs ?? []) {
    if (optional === 'callflow-html') outputs.push('graphify-out/callflow.html');
    if (optional === 'architecture-html') outputs.push('graphify-out/architecture.html');
  }

  return outputs.map(relativePath => ({
    path: relativePath,
    exists: existsSync(resolve(repoRoot, relativePath)),
  }));
}

function toMarkdown(report) {
  const lines = [
    '# Graphify Orchestrator Preflight',
    '',
    `Status: ${report.status}`,
    '',
    `Generated: ${report.generatedAt}`,
    `Target repo: ${report.repo.path}`,
    `Profile source: ${report.profile.source}`,
    `Profile: ${report.profile.name}`,
    '',
    '## Safety',
    '',
    `- Runs Graphify: ${report.safety.runsGraphify}`,
    `- Calls AI Model Selector: ${report.safety.callsAiModelSelector}`,
    `- Writes target repo: ${report.safety.writesTargetRepo}`,
    `- Hardcodes model fallback: ${report.safety.hardcodesModelFallback}`,
    '',
    '## Validation',
    '',
    ...(report.validation.errors.length === 0
      ? ['- Profile validation passed.']
      : report.validation.errors.map(error => `- ${error}`)),
    '',
    '## Expected outputs',
    '',
    ...report.expectedOutputs.map(output => `- [${output.exists ? 'x' : ' '}] ${output.path}`),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(helpText());
    return;
  }
  if (!args.repo) throw new Error('--repo is required');

  const repoRoot = resolve(args.repo);
  if (!existsSync(repoRoot)) throw new Error(`Target repo does not exist: ${repoRoot}`);

  const loadedProfile = await loadProfile(repoRoot, args.profile);
  const errors = validateProfile(loadedProfile.profile);
  const report = {
    status: errors.length === 0 ? 'ok' : 'invalid-profile',
    mode: 'report-only-preflight',
    generatedAt: new Date().toISOString(),
    repo: {
      path: repoRoot,
    },
    profile: {
      source: loadedProfile.source,
      sourcePath: loadedProfile.path,
      name: loadedProfile.profile.profile ?? null,
      repoRole: loadedProfile.profile.repoRole ?? null,
      modes: loadedProfile.profile.modes ?? [],
    },
    validation: {
      errors,
    },
    expectedOutputs: expectedOutputs(repoRoot, loadedProfile.profile),
    safety: {
      runsGraphify: false,
      callsAiModelSelector: false,
      writesTargetRepo: false,
      hardcodesModelFallback: false,
    },
  };

  await mkdir(dirname(args.reportJson), { recursive: true });
  await mkdir(dirname(args.reportMarkdown), { recursive: true });
  await writeFile(args.reportJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(args.reportMarkdown, toMarkdown(report), 'utf8');

  process.stdout.write(`Wrote ${args.reportJson}\nWrote ${args.reportMarkdown}\nStatus: ${report.status}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
